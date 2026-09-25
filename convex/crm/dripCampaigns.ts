/**
 * DRIP CAMPAIGNS — named multi-phase outreach tracks, and the mass operations
 * that move people onto, through, and off them.
 *
 * Every mutation here is bulk-shaped (contactIds: []) even when a caller has
 * one contact, because every real use of this is "select 200 rows and move
 * them". A single-contact variant would be a second code path to keep in sync
 * for no gain.
 *
 * WRITE ORDER IS FIXED AND MATTERS: write the enrollment row, then
 * syncPrimaryDripCache(contact), then syncDripCampaignCounts(campaign). The
 * enrollments table is the source of truth; the contact columns and the
 * campaign counters are caches derived from it, and deriving them before the
 * write would cache the old value.
 */

import { internalMutation, mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireCrmUser, requireCrmManager } from "./guards";
import { insertActivity } from "./activities";
import { recordAdminAction } from "../admin/adminAudit";
import { syncPrimaryDripCache, syncDripCampaignCounts } from "./lib/dripCache";
import { computeDueAt, DEFAULT_PHASE_DELAY_DAYS } from "./lib/dripSchedule";

/** Same ceiling as every other CRM bulk op (contacts.bulkUpdate, tags.bulkApplyTags). */
const MAX_BULK_OP = 500;
const MAX_PHASES = 20;

const ENROLLMENT_STATUS_VALIDATOR = v.union(
  v.literal("active"), v.literal("completed"), v.literal("paused"),
  v.literal("replied"), v.literal("removed"),
);

/* ------------------------------------------------------------------ *
 * CAMPAIGN CRUD
 * ------------------------------------------------------------------ */

export const listDripCampaigns = query({
  args: { includeArchived: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const all = await ctx.db.query("crmDripCampaigns").withIndex("by_created").order("desc").take(200);
    return args.includeArchived ? all : all.filter((c) => !c.isArchived);
  },
});

export const getDripCampaign = query({
  args: { dripCampaignId: v.id("crmDripCampaigns") },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    return await ctx.db.get(args.dripCampaignId);
  },
});

export const createDripCampaign = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    phaseCount: v.number(),
    phaseLabels: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    const name = args.name.trim();
    if (!name) throw new Error("A campaign needs a name");
    const phaseCount = Math.max(1, Math.min(Math.round(args.phaseCount), MAX_PHASES));
    const now = Date.now();

    return await ctx.db.insert("crmDripCampaigns", {
      name,
      description: args.description?.trim() || undefined,
      phaseCount,
      phaseLabels: args.phaseLabels?.length ? args.phaseLabels : undefined,
      // Manual until someone configures phases and explicitly starts it —
      // creating a campaign must never begin sending mail.
      automation: "manual",
      isArchived: false,
      activeCount: 0,
      completedCount: 0,
      createdBy: identity.clerkUserId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateDripCampaign = mutation({
  args: {
    dripCampaignId: v.id("crmDripCampaigns"),
    name: v.string(),
    description: v.optional(v.string()),
    phaseCount: v.number(),
    phaseLabels: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const campaign = await ctx.db.get(args.dripCampaignId);
    if (!campaign) throw new Error("Campaign not found");

    const phaseCount = Math.max(1, Math.min(Math.round(args.phaseCount), MAX_PHASES));
    // Shrinking below where people already are would leave enrollments at a
    // phase the campaign no longer has. Refuse rather than silently clamp
    // hundreds of rows.
    if (phaseCount < campaign.phaseCount) {
      const beyond = (
        await ctx.db
          .query("crmDripEnrollments")
          .withIndex("by_campaign_status", (q) => q.eq("dripCampaignId", args.dripCampaignId))
          .collect()
      ).filter((e) => e.status !== "removed" && e.phase > phaseCount);
      if (beyond.length > 0) {
        throw new Error(
          `${beyond.length} contact(s) are already past phase ${phaseCount}. Move them back first, or keep the campaign at ${campaign.phaseCount} phases.`,
        );
      }
    }

    await ctx.db.patch(args.dripCampaignId, {
      name: args.name.trim(),
      description: args.description?.trim() || undefined,
      phaseCount,
      phaseLabels: args.phaseLabels?.length ? args.phaseLabels : undefined,
      updatedAt: Date.now(),
    });
  },
});

export const archiveDripCampaign = mutation({
  args: { dripCampaignId: v.id("crmDripCampaigns"), archived: v.boolean() },
  handler: async (ctx, args) => {
    await requireCrmManager(ctx);
    await ctx.db.patch(args.dripCampaignId, { isArchived: args.archived, updatedAt: Date.now() });
  },
});

/* ------------------------------------------------------------------ *
 * READS FOR THE CAMPAIGN VIEW
 * ------------------------------------------------------------------ */

const MEMBER_PAGE_CAP = 1000;

/** Members of a campaign, with the contact joined. Bounded — this is a review screen, not an export. */
export const listMembers = query({
  args: {
    dripCampaignId: v.id("crmDripCampaigns"),
    status: v.optional(ENROLLMENT_STATUS_VALIDATOR),
    phase: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const rows = args.status
      ? await ctx.db
          .query("crmDripEnrollments")
          .withIndex("by_campaign_status", (q) => q.eq("dripCampaignId", args.dripCampaignId).eq("status", args.status!))
          .take(MEMBER_PAGE_CAP)
      : await ctx.db
          .query("crmDripEnrollments")
          .withIndex("by_campaign_status", (q) => q.eq("dripCampaignId", args.dripCampaignId))
          .take(MEMBER_PAGE_CAP);

    const filtered = args.phase === undefined ? rows : rows.filter((e) => e.phase === args.phase);

    return (
      await Promise.all(
        filtered.map(async (enrollment) => {
          const contact = await ctx.db.get(enrollment.contactId);
          return contact ? { enrollment, contact } : null;
        }),
      )
    ).filter((row): row is { enrollment: Doc<"crmDripEnrollments">; contact: Doc<"crmContacts"> } => row !== null);
  },
});

/** How many contacts sit at each phase — the "where is everyone" view. */
export const phaseBreakdown = query({
  args: { dripCampaignId: v.id("crmDripCampaigns") },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const campaign = await ctx.db.get(args.dripCampaignId);
    if (!campaign) return null;

    const enrollments = await ctx.db
      .query("crmDripEnrollments")
      .withIndex("by_campaign_status", (q) => q.eq("dripCampaignId", args.dripCampaignId))
      .take(MEMBER_PAGE_CAP * 5);

    const live = enrollments.filter((e) => e.status !== "removed");
    const phases = Array.from({ length: campaign.phaseCount + 1 }, (_, phase) => ({
      phase,
      label: phase === 0 ? "Not sent yet" : (campaign.phaseLabels?.[phase - 1] ?? `Phase ${phase}`),
      count: live.filter((e) => e.phase === phase).length,
    }));

    return {
      phases,
      byStatus: {
        active: live.filter((e) => e.status === "active").length,
        paused: live.filter((e) => e.status === "paused").length,
        completed: live.filter((e) => e.status === "completed").length,
        replied: live.filter((e) => e.status === "replied").length,
      },
      removed: enrollments.length - live.length,
      truncated: enrollments.length >= MEMBER_PAGE_CAP * 5,
    };
  },
});

/** Every campaign one contact is on — drives the contact detail card. */
export const listEnrollmentsForContact = query({
  args: { contactId: v.id("crmContacts") },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const enrollments = await ctx.db
      .query("crmDripEnrollments")
      .withIndex("by_contact", (q) => q.eq("contactId", args.contactId))
      .collect();

    return (
      await Promise.all(
        enrollments
          .filter((e) => e.status !== "removed")
          .map(async (enrollment) => {
            const campaign = await ctx.db.get(enrollment.dripCampaignId);
            return campaign ? { enrollment, campaign } : null;
          }),
      )
    ).filter((row): row is { enrollment: Doc<"crmDripEnrollments">; campaign: Doc<"crmDripCampaigns"> } => row !== null);
  },
});

/* ------------------------------------------------------------------ *
 * MASS OPERATIONS
 * ------------------------------------------------------------------ */

function assertBulkSize(contactIds: unknown[]) {
  if (contactIds.length > MAX_BULK_OP) {
    throw new Error(`Bulk op limited to ${MAX_BULK_OP} contacts at a time`);
  }
}

/**
 * When the phase after `currentPhase` should send, or undefined when the
 * campaign is not running or that phase has no template configured.
 *
 * `from` is when the previous phase actually landed (or the enrolment date for
 * phase 1), so switching a long-idle campaign on makes people who have been
 * waiting immediately due rather than restarting their clock.
 */
async function nextDueAfterPhase(
  ctx: MutationCtx,
  campaign: Doc<"crmDripCampaigns">,
  currentPhase: number,
  from: number,
): Promise<number | undefined> {
  if (campaign.automation !== "running") return undefined;
  const upcoming = currentPhase + 1;
  if (upcoming > campaign.phaseCount) return undefined;
  const config = await ctx.db
    .query("crmDripPhases")
    .withIndex("by_campaign_order", (q) => q.eq("dripCampaignId", campaign._id).eq("order", upcoming))
    .first();
  if (!config?.templateId) return undefined;
  return computeDueAt(from, config.delayDays ?? DEFAULT_PHASE_DELAY_DAYS);
}

/** Find an existing enrollment for this pair, whatever its status. */
async function findEnrollment(
  ctx: MutationCtx,
  dripCampaignId: Id<"crmDripCampaigns">,
  contactId: Id<"crmContacts">,
) {
  return await ctx.db
    .query("crmDripEnrollments")
    .withIndex("by_campaign_contact", (q) => q.eq("dripCampaignId", dripCampaignId).eq("contactId", contactId))
    .first();
}

/**
 * Put contacts onto a campaign.
 *
 * Idempotent by (campaign, contact): re-enrolling someone who is already on it
 * reactivates their existing row rather than creating a second one, so the
 * phase they had reached survives a re-run of the same bulk action. Pass
 * `resetPhase` to deliberately start them over.
 */
export const enrollContacts = mutation({
  args: {
    contactIds: v.array(v.id("crmContacts")),
    dripCampaignId: v.id("crmDripCampaigns"),
    startPhase: v.optional(v.number()),
    resetPhase: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    assertBulkSize(args.contactIds);
    const campaign = await ctx.db.get(args.dripCampaignId);
    if (!campaign) throw new Error("Campaign not found");
    if (campaign.isArchived) throw new Error("That campaign is archived — restore it before enrolling anyone");

    const startPhase = Math.max(0, Math.min(Math.round(args.startPhase ?? 0), campaign.phaseCount));
    const now = Date.now();
    let enrolled = 0;
    let reactivated = 0;

    for (const contactId of args.contactIds) {
      const contact = await ctx.db.get(contactId);
      if (!contact) continue;

      const existing = await findEnrollment(ctx, args.dripCampaignId, contactId);
      if (existing) {
        const keepPhase = args.resetPhase ? startPhase : Math.max(existing.phase, startPhase);
        await ctx.db.patch(existing._id, {
          status: "active",
          phase: keepPhase,
          exitedAt: undefined,
          exitReason: undefined,
          completedAt: undefined,
          sendAttempts: 0,
          lastSendError: undefined,
          nextPhaseDueAt: await nextDueAfterPhase(ctx, campaign, keepPhase, existing.lastPhaseSentAt ?? now),
          updatedAt: now,
        });
        reactivated++;
      } else {
        await ctx.db.insert("crmDripEnrollments", {
          dripCampaignId: args.dripCampaignId,
          contactId,
          phase: startPhase,
          status: "active",
          enrolledAt: now,
          enrolledBy: identity.clerkUserId,
          nextPhaseDueAt: await nextDueAfterPhase(ctx, campaign, startPhase, now),
          updatedAt: now,
        });
        enrolled++;
      }

      await syncPrimaryDripCache(ctx, contactId);
      await insertActivity(ctx, {
        contactId,
        activityType: "system",
        title: `Added to campaign: ${campaign.name}`,
        metadata: { dripCampaignId: args.dripCampaignId, phase: startPhase },
        actorType: "staff",
        actorClerkUserId: identity.clerkUserId,
        actorName: identity.name ?? identity.email ?? "Staff",
      });
    }

    await syncDripCampaignCounts(ctx, args.dripCampaignId);
    return { enrolled, reactivated };
  },
});

/**
 * Set the phase for contacts on a campaign — "move them through it".
 *
 * This is the operation the whole feature is for: select everyone who got
 * email 2, set them to phase 2. It does not send anything.
 */
export const setPhase = mutation({
  args: {
    contactIds: v.array(v.id("crmContacts")),
    dripCampaignId: v.id("crmDripCampaigns"),
    phase: v.number(),
  },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    assertBulkSize(args.contactIds);
    const campaign = await ctx.db.get(args.dripCampaignId);
    if (!campaign) throw new Error("Campaign not found");

    const phase = Math.max(0, Math.min(Math.round(args.phase), campaign.phaseCount));
    const now = Date.now();
    let updated = 0;

    for (const contactId of args.contactIds) {
      const existing = await findEnrollment(ctx, args.dripCampaignId, contactId);
      if (!existing || existing.status === "removed") continue;
      await ctx.db.patch(existing._id, {
        phase,
        // Landing on the final phase completes the run; moving back off it
        // reopens one, so a correction is not a one-way door.
        status: phase >= campaign.phaseCount ? "completed" : existing.status === "completed" ? "active" : existing.status,
        completedAt: phase >= campaign.phaseCount ? now : undefined,
        updatedAt: now,
      });
      await syncPrimaryDripCache(ctx, contactId);
      updated++;
    }

    await syncDripCampaignCounts(ctx, args.dripCampaignId);
    return { updated };
  },
});

/** Bump everyone selected one phase forward. */
export const advancePhase = mutation({
  args: { contactIds: v.array(v.id("crmContacts")), dripCampaignId: v.id("crmDripCampaigns") },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    assertBulkSize(args.contactIds);
    const campaign = await ctx.db.get(args.dripCampaignId);
    if (!campaign) throw new Error("Campaign not found");
    const now = Date.now();
    let advanced = 0;

    for (const contactId of args.contactIds) {
      const existing = await findEnrollment(ctx, args.dripCampaignId, contactId);
      if (!existing || existing.status === "removed" || existing.status === "replied") continue;
      const phase = Math.min(existing.phase + 1, campaign.phaseCount);
      if (phase === existing.phase) continue;
      await ctx.db.patch(existing._id, {
        phase,
        status: phase >= campaign.phaseCount ? "completed" : "active",
        completedAt: phase >= campaign.phaseCount ? now : undefined,
        updatedAt: now,
      });
      await syncPrimaryDripCache(ctx, contactId);
      advanced++;
    }

    await syncDripCampaignCounts(ctx, args.dripCampaignId);
    return { advanced };
  },
});

export const setEnrollmentStatus = mutation({
  args: {
    contactIds: v.array(v.id("crmContacts")),
    dripCampaignId: v.id("crmDripCampaigns"),
    status: ENROLLMENT_STATUS_VALIDATOR,
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    assertBulkSize(args.contactIds);
    const now = Date.now();
    let updated = 0;

    for (const contactId of args.contactIds) {
      const existing = await findEnrollment(ctx, args.dripCampaignId, contactId);
      if (!existing) continue;
      const exiting = args.status === "removed" || args.status === "replied";
      await ctx.db.patch(existing._id, {
        status: args.status,
        exitedAt: exiting ? now : undefined,
        exitReason: exiting ? args.reason : undefined,
        completedAt: args.status === "completed" ? (existing.completedAt ?? now) : existing.completedAt,
        updatedAt: now,
      });
      await syncPrimaryDripCache(ctx, contactId);
      updated++;
    }

    await syncDripCampaignCounts(ctx, args.dripCampaignId);
    return { updated };
  },
});

/** Take contacts off a campaign. The row is kept (status "removed") so history survives. */
export const removeFromCampaign = mutation({
  args: {
    contactIds: v.array(v.id("crmContacts")),
    dripCampaignId: v.id("crmDripCampaigns"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    assertBulkSize(args.contactIds);
    const campaign = await ctx.db.get(args.dripCampaignId);
    const now = Date.now();
    let removed = 0;

    for (const contactId of args.contactIds) {
      const existing = await findEnrollment(ctx, args.dripCampaignId, contactId);
      if (!existing || existing.status === "removed") continue;
      await ctx.db.patch(existing._id, {
        status: "removed",
        exitedAt: now,
        exitReason: args.reason,
        updatedAt: now,
      });
      await syncPrimaryDripCache(ctx, contactId);
      await insertActivity(ctx, {
        contactId,
        activityType: "system",
        title: `Removed from campaign: ${campaign?.name ?? "campaign"}`,
        metadata: { dripCampaignId: args.dripCampaignId, reason: args.reason },
        actorType: "staff",
        actorClerkUserId: identity.clerkUserId,
        actorName: identity.name ?? identity.email ?? "Staff",
      });
      removed++;
    }

    await syncDripCampaignCounts(ctx, args.dripCampaignId);
    return { removed };
  },
});

/* ------------------------------------------------------------------ *
 * PHASE CONFIGURATION AND AUTOMATION
 * ------------------------------------------------------------------ */

export const listPhases = query({
  args: { dripCampaignId: v.id("crmDripCampaigns") },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    return await ctx.db
      .query("crmDripPhases")
      .withIndex("by_campaign_order", (q) => q.eq("dripCampaignId", args.dripCampaignId))
      .collect();
  },
});

/** Upsert one phase's configuration. Keyed on (campaign, order). */
export const savePhase = mutation({
  args: {
    dripCampaignId: v.id("crmDripCampaigns"),
    order: v.number(),
    label: v.optional(v.string()),
    templateId: v.optional(v.id("crmEmailTemplates")),
    delayDays: v.number(),
  },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const campaign = await ctx.db.get(args.dripCampaignId);
    if (!campaign) throw new Error("Campaign not found");
    const order = Math.round(args.order);
    if (order < 1 || order > campaign.phaseCount) {
      throw new Error(`Phase must be between 1 and ${campaign.phaseCount}`);
    }
    const delayDays = Math.max(0, args.delayDays);
    const now = Date.now();

    const existing = await ctx.db
      .query("crmDripPhases")
      .withIndex("by_campaign_order", (q) => q.eq("dripCampaignId", args.dripCampaignId).eq("order", order))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        label: args.label?.trim() || undefined,
        templateId: args.templateId,
        delayDays,
        updatedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("crmDripPhases", {
      dripCampaignId: args.dripCampaignId,
      order,
      label: args.label?.trim() || undefined,
      templateId: args.templateId,
      delayDays,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const deletePhase = mutation({
  args: { phaseId: v.id("crmDripPhases") },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    await ctx.db.delete(args.phaseId);
  },
});

export const setSendWindow = mutation({
  args: {
    dripCampaignId: v.id("crmDripCampaigns"),
    sendWindowStartHour: v.optional(v.number()),
    sendWindowEndHour: v.optional(v.number()),
    sendDays: v.optional(v.array(v.number())),
  },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const clampHour = (h: number | undefined) =>
      h === undefined ? undefined : Math.max(0, Math.min(24, Math.round(h)));
    await ctx.db.patch(args.dripCampaignId, {
      sendWindowStartHour: clampHour(args.sendWindowStartHour),
      sendWindowEndHour: clampHour(args.sendWindowEndHour),
      sendDays: args.sendDays?.length ? args.sendDays.filter((d) => d >= 0 && d <= 6) : undefined,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Start, pause, or hand a campaign back to manual control.
 *
 * Manager-only: switching to "running" is the act that lets this campaign send
 * unattended mail at volume, which is the same bar campaigns.approveCampaign
 * and the workflow activation hold.
 *
 * Starting refuses if no phase has a template — otherwise the engine would
 * claim every enrollment, find nothing to send, and quietly unqueue them,
 * which looks identical to "it is broken".
 */
export const setAutomation = mutation({
  args: {
    dripCampaignId: v.id("crmDripCampaigns"),
    automation: v.union(v.literal("manual"), v.literal("running"), v.literal("paused")),
  },
  handler: async (ctx, args) => {
    const identity = await requireCrmManager(ctx);
    const campaign = await ctx.db.get(args.dripCampaignId);
    if (!campaign) throw new Error("Campaign not found");

    if (args.automation === "running") {
      if (campaign.isArchived) throw new Error("Restore this campaign before starting it");
      const phases = await ctx.db
        .query("crmDripPhases")
        .withIndex("by_campaign_order", (q) => q.eq("dripCampaignId", args.dripCampaignId))
        .collect();
      if (!phases.some((p) => p.templateId)) {
        throw new Error("Configure at least one phase with an email template before starting this campaign");
      }
    }

    await ctx.db.patch(args.dripCampaignId, { automation: args.automation, updatedAt: Date.now() });
    // Campaign-level, so it belongs in the admin audit trail rather than on a
    // contact timeline — the same place campaigns.ts records approve and send.
    await recordAdminAction(ctx, identity, {
      action: "crm.drip.automation",
      targetType: "crmDripCampaigns",
      targetId: args.dripCampaignId,
      summary: `Drip campaign "${campaign.name}" set to ${args.automation}`,
    });

    // Requeue (or drain) every enrollment. Chunked and self-rescheduling: a
    // campaign can hold thousands of rows and this must not risk the mutation
    // compute budget.
    await ctx.scheduler.runAfter(0, internal.crm.dripCampaigns._requeueEnrollments, {
      dripCampaignId: args.dripCampaignId,
    });
    if (args.automation === "running") {
      await ctx.scheduler.runAfter(0, internal.crm.dripEngine.tick, {});
    }
    return { automation: args.automation };
  },
});

const REQUEUE_CHUNK = 100;

/** Recompute nextPhaseDueAt for a campaign's active enrollments after a start/pause. */
export const _requeueEnrollments = internalMutation({
  args: { dripCampaignId: v.id("crmDripCampaigns"), cursor: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ done: boolean; queued: number }> => {
    const campaign = await ctx.db.get(args.dripCampaignId);
    if (!campaign) return { done: true, queued: 0 };

    const page = await ctx.db
      .query("crmDripEnrollments")
      .withIndex("by_campaign_status", (q) => q.eq("dripCampaignId", args.dripCampaignId).eq("status", "active"))
      .paginate({ numItems: REQUEUE_CHUNK, cursor: args.cursor ?? null });

    const now = Date.now();
    let queued = 0;
    for (const enrollment of page.page) {
      const due = await nextDueAfterPhase(
        ctx,
        campaign,
        enrollment.phase,
        enrollment.lastPhaseSentAt ?? enrollment.enrolledAt,
      );
      if (due === enrollment.nextPhaseDueAt) continue;
      await ctx.db.patch(enrollment._id, { nextPhaseDueAt: due, updatedAt: now });
      if (due !== undefined) queued++;
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.crm.dripCampaigns._requeueEnrollments, {
        dripCampaignId: args.dripCampaignId,
        cursor: page.continueCursor,
      });
    }
    return { done: page.isDone, queued };
  },
});

/**
 * Mass move between campaigns: off the old one, onto the new one.
 *
 * `fromDripCampaignId` is optional — omitting it moves the selection onto the
 * target without touching any other enrollment, which is the right behaviour
 * when the selection is mixed (people from three different campaigns).
 */
export const moveToCampaign = mutation({
  args: {
    contactIds: v.array(v.id("crmContacts")),
    fromDripCampaignId: v.optional(v.id("crmDripCampaigns")),
    toDripCampaignId: v.id("crmDripCampaigns"),
    startPhase: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    assertBulkSize(args.contactIds);
    if (args.fromDripCampaignId === args.toDripCampaignId) {
      throw new Error("Source and destination campaigns are the same");
    }
    const target = await ctx.db.get(args.toDripCampaignId);
    if (!target) throw new Error("Destination campaign not found");
    if (target.isArchived) throw new Error("That campaign is archived — restore it before moving anyone onto it");

    const source = args.fromDripCampaignId ? await ctx.db.get(args.fromDripCampaignId) : null;
    const startPhase = Math.max(0, Math.min(Math.round(args.startPhase ?? 0), target.phaseCount));
    const now = Date.now();
    let moved = 0;

    for (const contactId of args.contactIds) {
      const contact = await ctx.db.get(contactId);
      if (!contact) continue;

      if (args.fromDripCampaignId) {
        const old = await findEnrollment(ctx, args.fromDripCampaignId, contactId);
        if (old && old.status !== "removed") {
          await ctx.db.patch(old._id, {
            status: "removed",
            exitedAt: now,
            exitReason: `Moved to ${target.name}`,
            updatedAt: now,
          });
        }
      }

      const existing = await findEnrollment(ctx, args.toDripCampaignId, contactId);
      if (existing) {
        await ctx.db.patch(existing._id, {
          status: "active",
          phase: startPhase,
          exitedAt: undefined,
          exitReason: undefined,
          completedAt: undefined,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("crmDripEnrollments", {
          dripCampaignId: args.toDripCampaignId,
          contactId,
          phase: startPhase,
          status: "active",
          enrolledAt: now,
          enrolledBy: identity.clerkUserId,
          updatedAt: now,
        });
      }

      await syncPrimaryDripCache(ctx, contactId);
      await insertActivity(ctx, {
        contactId,
        activityType: "system",
        title: source ? `Moved from ${source.name} to ${target.name}` : `Added to campaign: ${target.name}`,
        metadata: { from: args.fromDripCampaignId, to: args.toDripCampaignId, phase: startPhase },
        actorType: "staff",
        actorClerkUserId: identity.clerkUserId,
        actorName: identity.name ?? identity.email ?? "Staff",
      });
      moved++;
    }

    await syncDripCampaignCounts(ctx, args.toDripCampaignId);
    if (args.fromDripCampaignId) await syncDripCampaignCounts(ctx, args.fromDripCampaignId);
    return { moved };
  },
});
