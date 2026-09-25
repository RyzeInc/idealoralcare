/**
 * CAMPAIGN SEND ENGINE — internal-only, driven by scheduler.runAfter, never
 * called directly. Three independent limits, three mechanisms, sized for
 * 20–100 recipients per send (not cold lists of thousands):
 *
 *   Resend API rate    → SEND_INTERVAL_MS between individual sends
 *   Daily quota         → crmSendCounters, a hard cap well below anything
 *                          that would threaten transactional email headroom
 *   Convex action time  → BATCH_SIZE per drainCampaign invocation, then
 *                          self-reschedule rather than one long-running action
 */

import { internalAction, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { sendViaResend } from "../lib/resend";
import { renderMergeFields, appendComplianceFooter } from "./lib/merge";
import { insertActivity } from "./activities";
import { recordEmailSent } from "./lib/emailProgress";
import { advanceEnrollmentForSend } from "./lib/dripAdvance";
import { getBaseUrl } from "../lib/env";

const BATCH_SIZE = 25;
const SEND_INTERVAL_MS = 550; // ~2 req/sec, under Resend's rate limit
const CRM_DAILY_SEND_CAP = Number(process.env.CRM_DAILY_SEND_CAP ?? 500);
const MAX_ATTEMPTS = 3;
const CRM_POSTAL_ADDRESS = process.env.CRM_POSTAL_ADDRESS ?? "";
const CRM_FROM_DEFAULT_NAME = process.env.CRM_FROM_NAME ?? "Ideal Oral Health";

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function msUntilNextUtcMidnight(): number {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return next.getTime() - now.getTime();
}

interface ClaimedBatch {
  capped: boolean;
  campaign: { subject: string; bodyHtml: string; fromName: string; fromEmail: string; replyTo: string } | null;
  recipients: Doc<"crmCampaignRecipients">[];
}

export const claimBatch = internalMutation({
  args: { campaignId: v.id("crmCampaigns") },
  handler: async (ctx, args): Promise<ClaimedBatch> => {
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign || campaign.status !== "sending") return { capped: false, campaign: null, recipients: [] };

    const day = todayUtc();
    const counter = await ctx.db.query("crmSendCounters").withIndex("by_day", (q) => q.eq("day", day)).first();
    if ((counter?.sentCount ?? 0) >= CRM_DAILY_SEND_CAP) {
      return { capped: true, campaign: null, recipients: [] };
    }

    const batch = await ctx.db
      .query("crmCampaignRecipients")
      .withIndex("by_campaign_status", (q) => q.eq("campaignId", args.campaignId).eq("status", "queued"))
      .take(BATCH_SIZE);

    if (batch.length === 0) return { capped: false, campaign: null, recipients: [] };

    const now = Date.now();
    for (const r of batch) await ctx.db.patch(r._id, { status: "sending", attempts: r.attempts + 1 });

    if (counter) await ctx.db.patch(counter._id, { sentCount: counter.sentCount + batch.length, updatedAt: now });
    else await ctx.db.insert("crmSendCounters", { day, sentCount: batch.length, updatedAt: now });

    return {
      capped: false,
      campaign: { subject: campaign.subject, bodyHtml: campaign.bodyHtml, fromName: campaign.fromName, fromEmail: campaign.fromEmail, replyTo: campaign.replyTo },
      recipients: batch,
    };
  },
});

export const markSent = internalMutation({
  args: {
    recipientId: v.id("crmCampaignRecipients"),
    campaignId: v.id("crmCampaigns"),
    subject: v.string(),
    resendEmailId: v.optional(v.string()),
    error: v.optional(v.string()),
    retryable: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const recipient = await ctx.db.get(args.recipientId);
    const campaign = await ctx.db.get(args.campaignId);
    if (!recipient || !campaign) return;
    const now = Date.now();

    if (args.resendEmailId) {
      await ctx.db.patch(args.recipientId, { status: "sent", resendEmailId: args.resendEmailId, sentAt: now });
      await ctx.db.patch(args.campaignId, { sentCount: campaign.sentCount + 1 });

      // Writing resendEmailId onto the timeline row here is what lets the
      // webhook dispatcher (convex/emailEvents.ts) find this send later —
      // the exact thing every non-CRM sender in this codebase forgets.
      await insertActivity(ctx, {
        contactId: recipient.contactId,
        activityType: "email_outbound",
        title: `Email: ${args.subject}`,
        isTouch: true,
        direction: "outbound",
        resendEmailId: args.resendEmailId,
        emailSubject: args.subject,
        emailTo: recipient.email,
        campaignId: args.campaignId,
        actorType: "system",
        actorName: `Campaign: ${campaign.name}`,
      });

      // A campaign send IS the drip — this is what moves a contact from
      // "Email 2 Sent" to "Email 3 Sent", and what the next step keys off.
      //
      // When the blast is bound to a drip campaign phase, the ENROLLMENT is
      // authoritative: advancing it re-syncs the contact's cached dripStep, so
      // the two can never disagree about where someone is. Only an unbound
      // blast falls back to bumping the contact's counter directly.
      if (campaign.dripCampaignId !== undefined) {
        await advanceEnrollmentForSend(ctx, {
          contactId: recipient.contactId,
          dripCampaignId: campaign.dripCampaignId,
          phase: campaign.dripPhase,
          at: now,
        });
        await recordEmailSent(ctx, recipient.contactId, { advanceSequence: false, at: now });
      } else {
        await recordEmailSent(ctx, recipient.contactId, { advanceSequence: true, at: now });
      }
      return;
    }

    if (args.retryable && recipient.attempts < MAX_ATTEMPTS) {
      await ctx.db.patch(args.recipientId, { status: "queued", error: args.error });
      return;
    }

    await ctx.db.patch(args.recipientId, { status: "failed", error: args.error });
    await ctx.db.patch(args.campaignId, { failedCount: campaign.failedCount + 1 });
  },
});

export const finalize = internalMutation({
  args: { campaignId: v.id("crmCampaigns") },
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign || campaign.status !== "sending") return; // paused/cancelled mid-drain — leave its status alone
    await ctx.db.patch(args.campaignId, { status: "sent", completedAt: Date.now() });
  },
});

export const drainCampaign = internalAction({
  args: { campaignId: v.id("crmCampaigns") },
  handler: async (ctx, args): Promise<void> => {
    const claimed = await ctx.runMutation(internal.crm.campaignEngine.claimBatch, { campaignId: args.campaignId });

    if (claimed.capped) {
      await ctx.scheduler.runAfter(msUntilNextUtcMidnight(), internal.crm.campaignEngine.drainCampaign, { campaignId: args.campaignId });
      return;
    }
    if (claimed.recipients.length === 0 || !claimed.campaign) {
      await ctx.runMutation(internal.crm.campaignEngine.finalize, { campaignId: args.campaignId });
      return;
    }

    const { campaign } = claimed;
    for (const recipient of claimed.recipients) {
      const mergeData = (recipient.mergeData ?? {}) as Record<string, string | undefined>;
      const renderedSubject = renderMergeFields(campaign.subject, mergeData);
      const renderedBody = renderMergeFields(campaign.bodyHtml, mergeData);
      // Visible footer link → human page (GET). List-Unsubscribe header → API
      // route, since RFC 8058 one-click requires a POST target and a Next.js
      // page route doesn't handle POST.
      const unsubscribePageUrl = `${getBaseUrl()}/unsubscribe/${recipient.token}`;
      const unsubscribeApiUrl = `${getBaseUrl()}/api/crm/unsubscribe?token=${recipient.token}`;
      const finalHtml = CRM_POSTAL_ADDRESS
        ? appendComplianceFooter(renderedBody, { postalAddress: CRM_POSTAL_ADDRESS, unsubscribeUrl: unsubscribePageUrl, companyName: campaign.fromName || CRM_FROM_DEFAULT_NAME })
        : renderedBody;

      const result = await sendViaResend({
        to: recipient.email,
        subject: renderedSubject,
        html: finalHtml,
        from: `${campaign.fromName} <${campaign.fromEmail}>`,
        replyTo: campaign.replyTo,
        category: "crm-campaign",
        tags: [{ name: "campaign", value: String(args.campaignId) }],
        headers: { "List-Unsubscribe": `<${unsubscribeApiUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        idempotencyKey: `crm-campaign-${recipient._id}`,
        useOutreachKey: true,
      });

      await ctx.runMutation(internal.crm.campaignEngine.markSent, {
        recipientId: recipient._id,
        campaignId: args.campaignId,
        subject: renderedSubject,
        resendEmailId: result.messageId,
        error: result.error,
        retryable: result.retryable,
      });

      await new Promise((resolve) => setTimeout(resolve, SEND_INTERVAL_MS));
    }

    await ctx.scheduler.runAfter(0, internal.crm.campaignEngine.drainCampaign, { campaignId: args.campaignId });
  },
});
