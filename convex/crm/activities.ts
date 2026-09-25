/**
 * CRM TIMELINE — the single write path for crmActivities.
 *
 * `insertActivity` is exported as a plain function (not a Convex internal
 * mutation invoked via ctx.runMutation) so other CRM modules — contacts.ts,
 * companies.ts, tags.ts — call it directly inside their own mutation, the
 * same way convex/admin/adminUsers.ts imports and calls
 * autoGrantFreeAccess from grantFreeAccess.ts. One code path writes
 * lastActivityAt/lastActivityType so those rollups can never drift from what
 * the timeline actually shows.
 *
 * Call-specific counters (callsMadeCount, callsConnectedCount) and email
 * counters (emailsSentCount) are NOT bumped here — they're specific to
 * completeCall / the email send paths, which call insertActivity for the
 * timeline row and then bump their own counters explicitly.
 */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireCrmUser, requireCrmManager } from "./guards";
import { buildReplyPatch } from "./lib/emailProgress";
import { exitEnrollmentsForContact } from "./lib/dripAdvance";

type ActivityType = Doc<"crmActivities">["activityType"];
type CallOutcome = NonNullable<Doc<"crmActivities">["callOutcome"]>;

export interface InsertActivityArgs {
  contactId?: Id<"crmContacts">;
  companyId?: Id<"crmCompanies">;
  /**
   * Deal-scoped events. Callers passing this should pass companyId too —
   * stageVelocity groups stage_changed rows by companyId, so a deal-only row
   * would drop out of velocity analytics without any error.
   */
  dealId?: Id<"crmDeals">;
  activityType: ActivityType;
  title: string;
  body?: string;
  isTouch?: boolean;
  direction?: "outbound" | "inbound";
  callOutcome?: CallOutcome;
  callDurationSeconds?: number;
  callNumberDialed?: string;
  resendEmailId?: string;
  emailSubject?: string;
  emailTo?: string;
  emailEvent?: string;
  campaignId?: Id<"crmCampaigns">;
  isPinned?: boolean;
  metadata?: unknown;
  actorType: "staff" | "system" | "contact";
  actorClerkUserId?: string;
  actorName?: string;
  occurredAt?: number;
}

export async function insertActivity(ctx: MutationCtx, args: InsertActivityArgs): Promise<Id<"crmActivities">> {
  const now = Date.now();
  const occurredAt = args.occurredAt ?? now;

  const activityId = await ctx.db.insert("crmActivities", {
    contactId: args.contactId,
    companyId: args.companyId,
    dealId: args.dealId,
    activityType: args.activityType,
    isTouch: args.isTouch ?? false,
    direction: args.direction,
    title: args.title,
    body: args.body,
    callOutcome: args.callOutcome,
    callDurationSeconds: args.callDurationSeconds,
    callNumberDialed: args.callNumberDialed,
    resendEmailId: args.resendEmailId,
    emailSubject: args.emailSubject,
    emailTo: args.emailTo,
    emailEvent: args.emailEvent,
    campaignId: args.campaignId,
    isPinned: args.isPinned ?? false,
    metadata: args.metadata,
    actorType: args.actorType,
    actorClerkUserId: args.actorClerkUserId,
    actorName: args.actorName,
    occurredAt,
    createdAt: now,
  });

  if (args.contactId) {
    const contact = await ctx.db.get(args.contactId);
    if (contact) {
      const patch: Partial<Doc<"crmContacts">> = {
        lastActivityAt: occurredAt,
        lastActivityType: args.activityType,
        updatedAt: now,
      };
      if (args.direction === "outbound" && (args.isTouch ?? false)) {
        patch.lastContactedAt = occurredAt;
        patch.lastContactedByName = args.actorName;
      }
      // A reply is the one inbound event that changes the contact's own state:
      // it sets Replied and pulls them out of the drip. Folded into this patch
      // rather than written separately so the row is touched once.
      if (args.activityType === "email_inbound") {
        Object.assign(patch, buildReplyPatch(contact, occurredAt));
      }
      await ctx.db.patch(args.contactId, patch);

      // ...and then out of the enrollments themselves. The patch above only
      // moves the CACHED column, which syncPrimaryDripCache recomputes from
      // the enrollment — and the send path reads the enrollment, so without
      // this a contact who replied keeps receiving the remaining phases.
      // Ordered after the contact patch so the re-sync wins.
      if (args.activityType === "email_inbound") {
        await exitEnrollmentsForContact(ctx, args.contactId, {
          status: "replied",
          reason: "Replied to an email",
          at: occurredAt,
        });
      }
    }
  }
  if (args.companyId) {
    const company = await ctx.db.get(args.companyId);
    if (company) {
      await ctx.db.patch(args.companyId, { lastActivityAt: occurredAt, updatedAt: now });
    }
  }
  if (args.dealId) {
    const deal = await ctx.db.get(args.dealId);
    // lastActivityAt is what the no_activity_days workflow trigger reads to
    // decide a deal has gone quiet — it has to be maintained here, on the one
    // write path, for the same reason the contact/company rollups are.
    if (deal) await ctx.db.patch(args.dealId, { lastActivityAt: occurredAt });
  }

  return activityId;
}

const DRAFT_RECOVERY_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours

export const listByContact = query({
  args: {
    contactId: v.id("crmContacts"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const result = await ctx.db
      .query("crmActivities")
      .withIndex("by_contact", (q) => q.eq("contactId", args.contactId))
      .order("desc")
      .paginate(args.paginationOpts);
    return { ...result, page: result.page.filter((a) => !a.isDraft) };
  },
});

export const listByCompany = query({
  args: {
    companyId: v.id("crmCompanies"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const result = await ctx.db
      .query("crmActivities")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .order("desc")
      .paginate(args.paginationOpts);
    return { ...result, page: result.page.filter((a) => !a.isDraft) };
  },
});

export const listByDeal = query({
  args: {
    dealId: v.id("crmDeals"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const result = await ctx.db
      .query("crmActivities")
      .withIndex("by_deal", (q) => q.eq("dealId", args.dealId))
      .order("desc")
      .paginate(args.paginationOpts);
    return { ...result, page: result.page.filter((a) => !a.isDraft) };
  },
});

export const listPinned = query({
  args: { contactId: v.id("crmContacts") },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    return await ctx.db
      .query("crmActivities")
      .withIndex("by_contact_pinned", (q) => q.eq("contactId", args.contactId).eq("isPinned", true))
      .order("desc")
      .collect();
  },
});

export const addNote = mutation({
  args: {
    contactId: v.optional(v.id("crmContacts")),
    companyId: v.optional(v.id("crmCompanies")),
    content: v.string(),
    isPinned: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    if (!args.contactId && !args.companyId) {
      throw new Error("addNote requires a contactId or companyId");
    }
    return await insertActivity(ctx, {
      contactId: args.contactId,
      companyId: args.companyId,
      activityType: "note",
      title: "Note added",
      body: args.content,
      isTouch: false,
      isPinned: args.isPinned ?? false,
      actorType: "staff",
      actorClerkUserId: identity.clerkUserId,
      actorName: identity.name ?? identity.email ?? "Staff",
    });
  },
});

export const updateNote = mutation({
  args: { activityId: v.id("crmActivities"), content: v.string(), isPinned: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const activity = await ctx.db.get(args.activityId);
    if (!activity || activity.activityType !== "note") throw new Error("Note not found");
    await ctx.db.patch(args.activityId, {
      body: args.content,
      isPinned: args.isPinned ?? activity.isPinned,
      updatedAt: Date.now(),
    });
  },
});

export const togglePin = mutation({
  args: { activityId: v.id("crmActivities") },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const activity = await ctx.db.get(args.activityId);
    if (!activity) throw new Error("Activity not found");
    await ctx.db.patch(args.activityId, { isPinned: !activity.isPinned, updatedAt: Date.now() });
  },
});

/**
 * Fires the instant a dial is initiated, BEFORE navigating to a tel:/dial-app
 * URI — that navigation can hand the browser to another app, so the draft
 * must already be saved or a rep's typed notes could vanish.
 */
export const startCall = mutation({
  args: { contactId: v.id("crmContacts"), numberDialed: v.string() },
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    const contact = await ctx.db.get(args.contactId);
    if (!contact) throw new Error("Contact not found");

    const now = Date.now();
    return await ctx.db.insert("crmActivities", {
      contactId: args.contactId,
      activityType: "call",
      isTouch: false,
      direction: "outbound",
      title: "Call in progress",
      callNumberDialed: args.numberDialed,
      isDraft: true,
      isPinned: false,
      actorType: "staff",
      actorClerkUserId: identity.clerkUserId,
      actorName: identity.name ?? identity.email ?? "Staff",
      occurredAt: now,
      createdAt: now,
    });
  },
});

const CALL_OUTCOME_VALIDATOR = v.union(
  v.literal("connected"), v.literal("no_answer"), v.literal("voicemail"),
  v.literal("gatekeeper"), v.literal("wrong_number"), v.literal("bad_number"),
  v.literal("callback_requested"), v.literal("not_interested"), v.literal("do_not_call"),
);

export const completeCall = mutation({
  args: {
    activityId: v.id("crmActivities"),
    outcome: CALL_OUTCOME_VALIDATOR,
    durationSeconds: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    const activity = await ctx.db.get(args.activityId);
    if (!activity || activity.activityType !== "call") throw new Error("Call draft not found");
    const now = Date.now();

    await ctx.db.patch(args.activityId, {
      isDraft: false,
      isTouch: true,
      callOutcome: args.outcome,
      callDurationSeconds: args.durationSeconds,
      body: args.notes,
      title: `Call — ${args.outcome.replace(/_/g, " ")}`,
      updatedAt: now,
    });

    if (activity.contactId) {
      const contact = await ctx.db.get(activity.contactId);
      if (contact) {
        const patch: Partial<Doc<"crmContacts">> = {
          callsMadeCount: contact.callsMadeCount + 1,
          callsConnectedCount: contact.callsConnectedCount + (args.outcome === "connected" ? 1 : 0),
          lastActivityAt: now,
          lastActivityType: "call",
          lastContactedAt: now,
          lastContactedByName: identity.name ?? identity.email ?? "Staff",
          updatedAt: now,
        };
        if (args.outcome === "wrong_number") patch.phoneStatus = "wrong_number";
        if (args.outcome === "bad_number") patch.phoneStatus = "disconnected";
        if (args.outcome === "do_not_call") {
          patch.callOptOut = true;
          patch.phoneStatus = "dnc";
        }
        await ctx.db.patch(activity.contactId, patch);
      }
    }
  },
});

export const discardCall = mutation({
  args: { activityId: v.id("crmActivities") },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const activity = await ctx.db.get(args.activityId);
    if (!activity || !activity.isDraft) return;
    await ctx.db.delete(args.activityId);
  },
});

/**
 * Reopens an abandoned call-log draft on page mount — the recovery mechanism
 * that makes it safe for startCall to fire before the (possibly
 * page-unloading) dial navigation.
 */
export const getOpenCallDraft = query({
  args: { contactId: v.id("crmContacts") },
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    const cutoff = Date.now() - DRAFT_RECOVERY_WINDOW_MS;
    const drafts = await ctx.db
      .query("crmActivities")
      .withIndex("by_contact", (q) => q.eq("contactId", args.contactId))
      .order("desc")
      .take(5);
    return drafts.find(
      (a) => a.isDraft && a.actorClerkUserId === identity.clerkUserId && a.occurredAt >= cutoff
    ) ?? null;
  },
});

/** System-wide "who touched what" feed for the CRM home page — bounded, never a table scan target for anything else. */
export const listRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const recent = (
      await ctx.db
        .query("crmActivities")
        .withIndex("by_touch_occurred", (q) => q.eq("isTouch", true))
        .order("desc")
        .take(args.limit ?? 20)
    ).filter((a) => !a.isDraft);

    return await Promise.all(
      recent.map(async (activity) => {
        const contact = activity.contactId ? await ctx.db.get(activity.contactId) : null;
        return { activity, contactName: contact?.fullName };
      })
    );
  },
});

export const deleteActivity = mutation({
  args: { activityId: v.id("crmActivities") },
  handler: async (ctx, args) => {
    await requireCrmManager(ctx);
    await ctx.db.delete(args.activityId);
  },
});
