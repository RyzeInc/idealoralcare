/**
 * TWILIO VOICE — phase 4 upgrade path for click-to-dial. The schema fields
 * this reads/writes (telephonyProvider, externalCallId, recordingUrl on
 * crmActivities) were declared back in Phase 0 specifically so this upgrade
 * would never need a migration.
 *
 * NEEDS A REAL TWILIO ACCOUNT to do anything: TWILIO_ACCOUNT_SID,
 * TWILIO_AUTH_TOKEN, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET,
 * TWILIO_TWIML_APP_SID, and a purchased phone number for
 * TWILIO_CALLER_ID. Until those exist in the Convex/Next environment, the
 * routes in src/app/api/twilio/** return a clear "not configured" error —
 * see convex/crm/settings for how a rep chooses "manual"/"tel"/etc. instead.
 *
 * The mutations below are called by src/app/api/twilio/{status,recording}
 * routes, which are unauthenticated HTTP endpoints Twilio posts to directly
 * (verified via Twilio's request signature in the route itself — the same
 * split as convex/emailEvents.ts + the Resend webhook: signature check in
 * the Next.js layer, the Convex mutation trusts what reaches it).
 */

import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireCrmUser } from "./guards";

/** Called by the client right after Twilio's Device.connect() resolves with a CallSid — links the draft activity (already created by activities.startCall, same as the tel: flow) to the real Twilio call. */
export const attachTwilioCallId = mutation({
  args: { activityId: v.id("crmActivities"), externalCallId: v.string() },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    await ctx.db.patch(args.activityId, { telephonyProvider: "twilio", externalCallId: args.externalCallId });
  },
});

const TWILIO_STATUS_TO_OUTCOME: Record<string, "connected" | "no_answer" | "voicemail"> = {
  completed: "connected",
  "no-answer": "no_answer",
  busy: "no_answer",
  failed: "no_answer",
  canceled: "no_answer",
};

/** POST target for src/app/api/twilio/status/route.ts — Twilio's call status callback. Public (Twilio has no Clerk session); the route verifies Twilio's request signature before calling this. */
export const recordCallStatus = mutation({
  args: { externalCallId: v.string(), status: v.string(), durationSeconds: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const activity = await ctx.db.query("crmActivities").withIndex("by_external_call_id", (q) => q.eq("externalCallId", args.externalCallId)).first();
    if (!activity) return { matched: false };

    const isFinal = ["completed", "no-answer", "busy", "failed", "canceled"].includes(args.status);
    if (!isFinal) return { matched: true, final: false };

    const outcome = TWILIO_STATUS_TO_OUTCOME[args.status] ?? "no_answer";
    const now = Date.now();
    await ctx.db.patch(activity._id, {
      isDraft: false,
      isTouch: true,
      callOutcome: outcome,
      callDurationSeconds: args.durationSeconds ?? 0,
      title: `Call — ${outcome.replace(/_/g, " ")}`,
      updatedAt: now,
    });

    if (activity.contactId) {
      const contact = await ctx.db.get(activity.contactId);
      if (contact) {
        await ctx.db.patch(activity.contactId, {
          callsMadeCount: contact.callsMadeCount + 1,
          callsConnectedCount: contact.callsConnectedCount + (outcome === "connected" ? 1 : 0),
          lastActivityAt: now,
          lastActivityType: "call",
          lastContactedAt: now,
          lastContactedByName: activity.actorName,
          updatedAt: now,
        });
      }
    }
    return { matched: true, final: true };
  },
});

/** POST target for src/app/api/twilio/recording/route.ts. Two-party-consent recording rules vary by state — recording is OFF by default (see DialButton's twilio path); enabling it per-state consent mapping is a follow-up, not part of this scaffolding. */
export const attachRecording = mutation({
  args: { externalCallId: v.string(), recordingUrl: v.string() },
  handler: async (ctx, args) => {
    const activity = await ctx.db.query("crmActivities").withIndex("by_external_call_id", (q) => q.eq("externalCallId", args.externalCallId)).first();
    if (!activity) return { matched: false };
    await ctx.db.patch(activity._id, { recordingUrl: args.recordingUrl });
    return { matched: true };
  },
});
