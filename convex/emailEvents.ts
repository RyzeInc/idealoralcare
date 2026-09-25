/**
 * RESEND WEBHOOK DISPATCHER.
 *
 * src/app/api/resend/webhook/route.ts used to call exactly one hardcoded
 * mutation (admin/eligibilityProvisioning.recordEmailDeliveryEvent), so any
 * Resend event for a CRM send had nothing to match against. This tries each
 * possible origin of a resendEmailId in order and delegates to the existing
 * member-email logic UNCHANGED when none of the CRM tables recognize it.
 */

import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";
import { recordEmailBlocked, recordEmailEngagement } from "./crm/lib/emailProgress";

const EVENT_TO_ACTIVITY_TYPE: Record<string, "email_delivered" | "email_bounced" | "email_complained" | "email_opened" | "email_clicked"> = {
  "email.delivered": "email_delivered",
  "email.bounced": "email_bounced",
  "email.complained": "email_complained",
  "email.opened": "email_opened",
  "email.clicked": "email_clicked",
};

export const recordResendEvent = mutation({
  args: {
    resendEmailId: v.string(),
    eventType: v.string(),
    bounceType: v.optional(v.string()),
    bounceMessage: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ matched: boolean; via?: string }> => {
    // 1. A crmCampaignRecipients row (batch send — convex/crm/campaignEngine.ts).
    const recipient = await ctx.db.query("crmCampaignRecipients").withIndex("by_resend_email_id", (q) => q.eq("resendEmailId", args.resendEmailId)).first();
    if (recipient) {
      await ctx.runMutation(internal.crm.campaigns._recordRecipientEvent, {
        recipientId: recipient._id,
        eventType: args.eventType,
        bounceType: args.bounceType,
      });
      return { matched: true, via: "crmCampaignRecipients" };
    }

    // 2. A crmActivities row (one-off CRM send — convex/crm/email.ts).
    const activity = await ctx.db.query("crmActivities").withIndex("by_resend_email_id", (q) => q.eq("resendEmailId", args.resendEmailId)).first();
    if (activity) {
      const activityType = EVENT_TO_ACTIVITY_TYPE[args.eventType];
      await ctx.db.patch(activity._id, { emailEvent: args.eventType, updatedAt: Date.now() });
      if (activityType && activity.contactId) {
        await ctx.db.insert("crmActivities", {
          contactId: activity.contactId,
          activityType,
          isTouch: false,
          title: `Email ${args.eventType.replace("email.", "")}`,
          resendEmailId: args.resendEmailId,
          emailEvent: args.eventType,
          isPinned: false,
          actorType: "system",
          actorName: "Resend",
          occurredAt: Date.now(),
          createdAt: Date.now(),
        });

        if (args.eventType === "email.opened" || args.eventType === "email.clicked") {
          await recordEmailEngagement(ctx, activity.contactId, args.eventType === "email.opened" ? "opened" : "clicked");
        }

        if (args.eventType === "email.bounced" || args.eventType === "email.complained") {
          const contact = await ctx.db.get(activity.contactId);
          if (contact) {
            const hardBounce = args.eventType === "email.bounced" && args.bounceType !== "Transient";
            // Also pauses the drip, so a bad address stops at "Drip Paused"
            // instead of silently stalling mid-sequence.
            await recordEmailBlocked(ctx, activity.contactId, {
              emailStatus: args.eventType === "email.complained" ? "complained" : hardBounce ? "bounced_hard" : "bounced_soft",
              optOut: args.eventType === "email.complained" || hardBounce,
            });
            if ((args.eventType === "email.complained" || hardBounce) && contact.emailLower) {
              const existing = await ctx.db.query("crmSuppressions").withIndex("by_scope_value", (q) => q.eq("scope", "email").eq("value", contact.emailLower!)).first();
              if (!existing) {
                await ctx.db.insert("crmSuppressions", {
                  value: contact.emailLower, scope: "email",
                  reason: args.eventType === "email.complained" ? "complained" : "hard_bounce",
                  contactId: activity.contactId, createdAt: Date.now(),
                });
              }
            }
          }
        }
      }
      return { matched: true, via: "crmActivities" };
    }

    // 3. Fall through to the existing member-email logic, unchanged.
    const memberResult: { matched: boolean } = await ctx.runMutation(api.admin.eligibilityProvisioning.recordEmailDeliveryEvent, {
      resendEmailId: args.resendEmailId,
      eventType: args.eventType,
      bounceType: args.bounceType,
      bounceMessage: args.bounceMessage,
    });
    if (memberResult.matched) return { matched: true, via: "memberActivities" };

    return { matched: false };
  },
});
