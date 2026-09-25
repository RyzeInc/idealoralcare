/**
 * CRM CAMPAIGNS — batch sends, sized for 20–100 warm recipients (not cold
 * lists of thousands). Recipient build is a SINGLE mutation with a hard 500
 * ceiling, not a self-rescheduling cursor loop — that's the right shape at
 * this volume, and the ceiling is exactly what stops a fat-fingered filter
 * from turning into a 5,000-recipient send.
 */

import { action, internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { nanoid } from "nanoid";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { requireCrmUser, requireCrmManager, requireCrmManagerAction } from "./guards";
import { scanFiltered } from "./segments";
import { checkEmailEligibility } from "./lib/emailGate";
import { recordEmailBlocked, recordEmailEngagement } from "./lib/emailProgress";
import { recordAdminAction } from "../admin/adminAudit";
import type { ContactFilters } from "./lib/filters";
import { assertNotSearchDriven, chooseDriverIndex } from "./lib/filters";

const MAX_RECIPIENTS = 500;

const FILTERS_VALIDATOR = v.object({
  searchTerm: v.optional(v.string()),
  statuses: v.optional(v.array(v.string())),
  dripStatuses: v.optional(v.array(v.string())),
  emailStatuses: v.optional(v.array(v.string())),
  nextActions: v.optional(v.array(v.string())),
  hasReplied: v.optional(v.boolean()),
  dripCampaignIds: v.optional(v.array(v.id("crmDripCampaigns"))),
  dripPhases: v.optional(v.array(v.number())),
  jobFunctions: v.optional(v.array(v.string())),
  seniorities: v.optional(v.array(v.string())),
  jobTitleContains: v.optional(v.array(v.string())),
  jobTitleExcludes: v.optional(v.array(v.string())),
  states: v.optional(v.array(v.string())),
  tagGroups: v.optional(v.array(v.object({
    categoryId: v.optional(v.id("crmTagCategories")),
    tagIds: v.array(v.id("crmTags")),
  }))),
  excludeTagIds: v.optional(v.array(v.id("crmTags"))),
  ownerClerkUserIds: v.optional(v.array(v.string())),
  hasEmail: v.optional(v.boolean()),
  hasMobile: v.optional(v.boolean()),
  emailable: v.optional(v.boolean()),
  callable: v.optional(v.boolean()),
  neverContacted: v.optional(v.boolean()),
  lastContactedBeforeDays: v.optional(v.number()),
  createdAfter: v.optional(v.number()),
  importBatchId: v.optional(v.id("crmImportBatches")),
  isArchived: v.optional(v.boolean()),
});

export const createCampaign = mutation({
  args: {
    name: v.string(), subject: v.string(), bodyHtml: v.string(), fromName: v.string(),
    fromEmail: v.string(), replyTo: v.string(), segmentId: v.optional(v.id("crmSegments")),
    /** Bind this blast to one phase of a drip campaign — sending it then advances every recipient's enrollment. */
    dripCampaignId: v.optional(v.id("crmDripCampaigns")),
    dripPhase: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    const now = Date.now();
    return await ctx.db.insert("crmCampaigns", {
      name: args.name, subject: args.subject, bodyHtml: args.bodyHtml,
      fromName: args.fromName, fromEmail: args.fromEmail, replyTo: args.replyTo,
      segmentId: args.segmentId,
      dripCampaignId: args.dripCampaignId, dripPhase: args.dripPhase,
      status: "draft",
      totalRecipients: 0, sentCount: 0, deliveredCount: 0, bouncedCount: 0, complainedCount: 0,
      openedCount: 0, clickedCount: 0, unsubscribedCount: 0, failedCount: 0, skippedCount: 0,
      createdBy: identity.clerkUserId, createdAt: now, updatedAt: now,
    });
  },
});

export const updateCampaign = mutation({
  args: { campaignId: v.id("crmCampaigns"), name: v.string(), subject: v.string(), bodyHtml: v.string(), fromName: v.string(), fromEmail: v.string(), replyTo: v.string() },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) throw new Error("Campaign not found");
    if (campaign.status !== "draft") throw new Error("Only draft campaigns can be edited — cancel and duplicate instead");
    await ctx.db.patch(args.campaignId, {
      name: args.name, subject: args.subject, bodyHtml: args.bodyHtml,
      fromName: args.fromName, fromEmail: args.fromEmail, replyTo: args.replyTo, updatedAt: Date.now(),
    });
  },
});

export const getCampaign = query({
  args: { campaignId: v.id("crmCampaigns") },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    return await ctx.db.get(args.campaignId);
  },
});

export const listCampaigns = query({
  args: {},
  handler: async (ctx) => {
    await requireCrmUser(ctx);
    return await ctx.db.query("crmCampaigns").withIndex("by_created").order("desc").take(100);
  },
});

export const listRecipients = query({
  args: { campaignId: v.id("crmCampaigns"), status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const all = await ctx.db.query("crmCampaignRecipients").withIndex("by_campaign_status", (q) => q.eq("campaignId", args.campaignId)).collect();
    return args.status ? all.filter((r) => r.status === args.status) : all;
  },
});

/**
 * Resolves the segment/filters to a bounded recipient list and evaluates the
 * skip ladder — in order, each producing a distinct stored skipReason so
 * "why did only 88 of 96 go out" always has a real answer:
 * opted out → bad deliverability status → suppressed (email or domain) →
 * role address (info@, sales@, ...) → duplicate within this campaign → queued.
 */
export const buildRecipients = mutation({
  args: { campaignId: v.id("crmCampaigns"), filters: FILTERS_VALIDATOR },
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) throw new Error("Campaign not found");
    if (campaign.status !== "draft") throw new Error("Recipients can only be built for a draft campaign");

    const filters = args.filters as ContactFilters;
    assertNotSearchDriven(chooseDriverIndex(filters));

    const { matched, truncated } = await scanFiltered(ctx, filters, MAX_RECIPIENTS);
    if (truncated) {
      throw new Error(`This segment resolves to more than ${MAX_RECIPIENTS} contacts — narrow the filters. Batch campaigns are sized for warm sends, not cold lists.`);
    }

    // Clear any previously-built recipients (re-running buildRecipients on a draft is a resegment, not an append).
    const existing = await ctx.db.query("crmCampaignRecipients").withIndex("by_campaign_status", (q) => q.eq("campaignId", args.campaignId)).collect();
    for (const r of existing) await ctx.db.delete(r._id);

    const seenEmails = new Set<string>();
    let queued = 0;
    let skipped = 0;
    const now = Date.now();

    for (const contact of matched) {
      const emailLower = contact.emailLower;
      // The shared ladder (lib/emailGate.ts) — the same one workflow sends go
      // through, so an automated send can never be laxer than a manual one.
      const eligibility = await checkEmailEligibility(ctx, contact);
      let skipReason: string | null = eligibility.reason;

      // Campaign-only rung: dedupe within THIS build, which the shared gate
      // has no way to know about.
      if (!skipReason && emailLower && seenEmails.has(emailLower)) skipReason = "duplicate_in_campaign";

      if (skipReason) {
        skipped++;
        await ctx.db.insert("crmCampaignRecipients", {
          campaignId: args.campaignId, contactId: contact._id, email: contact.email ?? "",
          status: "skipped", skipReason, token: nanoid(24), attempts: 0, openCount: 0, clickCount: 0, createdAt: now,
        });
        continue;
      }

      seenEmails.add(emailLower!);
      queued++;
      await ctx.db.insert("crmCampaignRecipients", {
        campaignId: args.campaignId, contactId: contact._id, email: contact.email!,
        mergeData: { firstName: contact.firstName, lastName: contact.lastName, fullName: contact.fullName, companyName: contact.companyName, jobTitle: contact.jobTitle },
        status: "queued", token: nanoid(24), attempts: 0, openCount: 0, clickCount: 0, createdAt: now,
      });
    }

    await ctx.db.patch(args.campaignId, {
      status: "ready",
      filtersSnapshot: filters,
      totalRecipients: queued + skipped,
      skippedCount: skipped,
      updatedAt: now,
    });
    await recordAdminAction(ctx, identity, {
      action: "crm.campaign.build_recipients",
      targetType: "crmCampaigns",
      targetId: args.campaignId,
      summary: `Built ${queued} recipients, skipped ${skipped}, for campaign "${campaign.name}"`,
    });

    return { queued, skipped };
  },
});

export const approveCampaign = mutation({
  args: { campaignId: v.id("crmCampaigns") },
  handler: async (ctx, args) => {
    const identity = await requireCrmManager(ctx);
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) throw new Error("Campaign not found");
    if (campaign.status !== "ready") throw new Error("Only a campaign with built recipients can be approved");
    await ctx.db.patch(args.campaignId, { approvedBy: identity.clerkUserId, approvedAt: Date.now() });
    await recordAdminAction(ctx, identity, {
      action: "crm.campaign.approve", targetType: "crmCampaigns", targetId: args.campaignId,
      summary: `Approved campaign "${campaign.name}" for ${campaign.totalRecipients - campaign.skippedCount} recipients`,
    });
  },
});

const OUTREACH_DOMAIN = process.env.CRM_OUTREACH_DOMAIN; // e.g. "outreach.getidealoh.com" — set once a dedicated sending domain exists

export const startCampaign = action({
  args: { campaignId: v.id("crmCampaigns") },
  handler: async (ctx, args): Promise<{ started: boolean; error?: string }> => {
    const identity = await requireCrmManagerAction(ctx);
    const campaign = await ctx.runQuery(internal.crm.campaigns._getCampaignForStart, { campaignId: args.campaignId });
    if (!campaign) return { started: false, error: "Campaign not found" };
    if (campaign.status !== "ready" || !campaign.approvedBy) {
      return { started: false, error: "Campaign must be built and approved before sending" };
    }
    if (OUTREACH_DOMAIN && !campaign.fromEmail.toLowerCase().endsWith(`@${OUTREACH_DOMAIN.toLowerCase()}`)) {
      return { started: false, error: `From address must be on the outreach domain (${OUTREACH_DOMAIN})` };
    }

    await ctx.runMutation(internal.crm.campaigns._markSending, { campaignId: args.campaignId, actorClerkUserId: identity.clerkUserId });
    await ctx.scheduler.runAfter(0, internal.crm.campaignEngine.drainCampaign, { campaignId: args.campaignId });
    return { started: true };
  },
});

export const _getCampaignForStart = internalQuery({
  args: { campaignId: v.id("crmCampaigns") },
  handler: async (ctx, args): Promise<Doc<"crmCampaigns"> | null> => await ctx.db.get(args.campaignId),
});

export const _markSending = internalMutation({
  args: { campaignId: v.id("crmCampaigns"), actorClerkUserId: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.campaignId, { status: "sending", startedAt: Date.now() });
    await recordAdminAction(ctx, { clerkUserId: args.actorClerkUserId }, {
      action: "crm.campaign.send", targetType: "crmCampaigns", targetId: args.campaignId, summary: "Started sending",
    });
  },
});

export const pauseCampaign = mutation({
  args: { campaignId: v.id("crmCampaigns") },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign || campaign.status !== "sending") return;
    await ctx.db.patch(args.campaignId, { status: "paused" });
  },
});

export const resumeCampaign = action({
  args: { campaignId: v.id("crmCampaigns") },
  handler: async (ctx, args) => {
    await requireCrmManagerAction(ctx);
    await ctx.runMutation(internal.crm.campaigns._markSending, { campaignId: args.campaignId, actorClerkUserId: "system" });
    await ctx.scheduler.runAfter(0, internal.crm.campaignEngine.drainCampaign, { campaignId: args.campaignId });
  },
});

export const cancelCampaign = mutation({
  args: { campaignId: v.id("crmCampaigns") },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign || campaign.status === "sent") return;
    await ctx.db.patch(args.campaignId, { status: "cancelled" });
  },
});

const EVENT_STATUS_MAP: Record<string, Doc<"crmCampaignRecipients">["status"]> = {
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.failed": "failed",
};
const EVENT_COUNTER_FIELD: Record<string, keyof Doc<"crmCampaigns">> = {
  "email.delivered": "deliveredCount",
  "email.bounced": "bouncedCount",
  "email.complained": "complainedCount",
  "email.failed": "failedCount",
};

/** Called by convex/emailEvents.ts's webhook dispatcher when a Resend event matches a crmCampaignRecipients row. */
export const _recordRecipientEvent = internalMutation({
  args: { recipientId: v.id("crmCampaignRecipients"), eventType: v.string(), bounceType: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const recipient = await ctx.db.get(args.recipientId);
    if (!recipient) return;
    const now = Date.now();

    if (args.eventType === "email.opened") {
      await ctx.db.patch(args.recipientId, { openCount: recipient.openCount + 1, firstOpenedAt: recipient.firstOpenedAt ?? now });
      const campaign = await ctx.db.get(recipient.campaignId);
      if (campaign && recipient.openCount === 0) await ctx.db.patch(recipient.campaignId, { openedCount: campaign.openedCount + 1 });
      // Mirrored onto the contact as well as the recipient row: the campaign
      // row answers "how did this send perform", the contact field answers
      // "is this person warm", which is the one the list column shows.
      await recordEmailEngagement(ctx, recipient.contactId, "opened", now);
    } else if (args.eventType === "email.clicked") {
      await ctx.db.patch(args.recipientId, { clickCount: recipient.clickCount + 1, firstClickedAt: recipient.firstClickedAt ?? now });
      const campaign = await ctx.db.get(recipient.campaignId);
      if (campaign && recipient.clickCount === 0) await ctx.db.patch(recipient.campaignId, { clickedCount: campaign.clickedCount + 1 });
      await recordEmailEngagement(ctx, recipient.contactId, "clicked", now);
    } else if (EVENT_STATUS_MAP[args.eventType]) {
      await ctx.db.patch(args.recipientId, { status: EVENT_STATUS_MAP[args.eventType], deliveredAt: args.eventType === "email.delivered" ? now : recipient.deliveredAt });
      const campaign = await ctx.db.get(recipient.campaignId);
      const field = EVENT_COUNTER_FIELD[args.eventType];
      if (campaign) await ctx.db.patch(recipient.campaignId, { [field]: (campaign[field] as number) + 1 } as Partial<Doc<"crmCampaigns">>);

      if (args.eventType === "email.bounced" || args.eventType === "email.complained") {
        const hardBounce = args.eventType === "email.bounced" && args.bounceType !== "Transient";
        if (hardBounce || args.eventType === "email.complained") {
          const contact = await ctx.db.get(recipient.contactId);
          if (contact) {
            // Also pauses the drip — the whole point of tracking a sequence is
            // that emails 2-5 must not keep going to an address that just
            // hard-bounced or reported us.
            await recordEmailBlocked(ctx, recipient.contactId, {
              emailStatus: args.eventType === "email.complained" ? "complained" : "bounced_hard",
              optOut: true,
              at: now,
            });
            const emailLower = recipient.email.toLowerCase();
            const existing = await ctx.db.query("crmSuppressions").withIndex("by_scope_value", (q) => q.eq("scope", "email").eq("value", emailLower)).first();
            if (!existing) {
              await ctx.db.insert("crmSuppressions", {
                value: emailLower, scope: "email",
                reason: args.eventType === "email.complained" ? "complained" : "hard_bounce",
                campaignId: recipient.campaignId, contactId: recipient.contactId, createdAt: now,
              });
            }
          }
        }
      }
    }
  },
});
