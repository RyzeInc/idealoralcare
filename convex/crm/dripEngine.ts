/**
 * DRIP SEND ENGINE — sends each configured phase of a running drip campaign on
 * its own delay.
 *
 * SHAPED DELIBERATELY LIKE workflowEngine.ts, because it is the same problem:
 * an internalAction claims a bounded batch through internalMutations, does the
 * one thing needing the network (Resend), and self-limits rather than running
 * one long action.
 *
 * THE ENROLLMENT IS THE RUN. There is no parallel "drip run" table holding a
 * second copy of someone's position. crmDripEnrollments.phase is the only
 * record of where a contact is, and `nextPhaseDueAt` on that same row is the
 * work queue. A second table would recreate exactly the dual-source-of-truth
 * bug that let replied contacts keep receiving phases 3-5.
 *
 * IT REUSES THE ONE COMPLIANCE LADDER. checkEmailEligibility (opt-out,
 * deliverability, suppression, role address), the shared crmSendCounters daily
 * cap, the CAN-SPAM footer and the RFC 8058 one-click headers are all the same
 * code a manual campaign goes through. Automation is held to a standard at
 * least as strict as a human clicking send, never a laxer one.
 */

import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { sendViaResend } from "../lib/resend";
import { getBaseUrl } from "../lib/env";
import { renderMergeFields, appendComplianceFooter } from "./lib/merge";
import { checkEmailEligibility } from "./lib/emailGate";
import { insertActivity } from "./activities";
import { recordEmailSent } from "./lib/emailProgress";
import { advanceEnrollmentForSend, exitEnrollmentsForContact } from "./lib/dripAdvance";
import {
  computeDueAt, isWithinSendWindow, nextWindowOpening, msUntilNextUtcMidnight,
  retryDelayMs, DEFAULT_PHASE_DELAY_DAYS,
} from "./lib/dripSchedule";

const BATCH_SIZE = 25;
const SEND_INTERVAL_MS = 550; // ~2 req/sec, under Resend's rate limit
const MAX_BATCHES_PER_TICK = 5;
const MAX_SEND_ATTEMPTS = 3;
const CRM_DAILY_SEND_CAP = Number(process.env.CRM_DAILY_SEND_CAP ?? 500);
const CRM_POSTAL_ADDRESS = process.env.CRM_POSTAL_ADDRESS ?? "";
const CRM_FROM_NAME = process.env.CRM_FROM_NAME ?? "Ideal Oral Health";
const CRM_FROM_EMAIL = process.env.CRM_FROM_EMAIL;

function todayUtc(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

type PreparedSend =
  | { kind: "send"; enrollmentId: Id<"crmDripEnrollments">; contactId: Id<"crmContacts">; dripCampaignId: Id<"crmDripCampaigns">; phase: number; to: string; subject: string; html: string; unsubscribeApiUrl: string }
  | { kind: "handled" };

export const claimDue = internalQuery({
  args: {},
  handler: async (ctx): Promise<Id<"crmDripEnrollments">[]> => {
    const due = await ctx.db
      .query("crmDripEnrollments")
      .withIndex("by_due", (q) => q.eq("status", "active").lte("nextPhaseDueAt", Date.now()))
      .take(BATCH_SIZE);
    // An enrollment with no due date is not queued; the index range above
    // cannot express "is set", so filter it here.
    return due.filter((e) => e.nextPhaseDueAt !== undefined).map((e) => e._id);
  },
});

/**
 * Decide what to do with one due enrollment, and CLAIM it.
 *
 * Every branch either clears `nextPhaseDueAt` or moves it forward before
 * returning, so a row is never left claimable by a second overlapping tick.
 */
export const prepareSend = internalMutation({
  args: { enrollmentId: v.id("crmDripEnrollments") },
  handler: async (ctx, args): Promise<PreparedSend> => {
    const now = Date.now();
    const enrollment = await ctx.db.get(args.enrollmentId);
    if (!enrollment || enrollment.status !== "active" || enrollment.nextPhaseDueAt === undefined) {
      return { kind: "handled" };
    }

    const hold = async (until: number) => {
      await ctx.db.patch(enrollment._id, { nextPhaseDueAt: until, updatedAt: now });
    };
    const unqueue = async () => {
      await ctx.db.patch(enrollment._id, { nextPhaseDueAt: undefined, updatedAt: now });
    };

    const campaign = await ctx.db.get(enrollment.dripCampaignId);
    if (!campaign || campaign.isArchived || campaign.automation !== "running") {
      // Paused or reverted to manual: stop queueing, but keep the position.
      await unqueue();
      return { kind: "handled" };
    }

    const nextPhase = enrollment.phase + 1;
    if (nextPhase > campaign.phaseCount) {
      await ctx.db.patch(enrollment._id, {
        status: "completed",
        completedAt: enrollment.completedAt ?? now,
        nextPhaseDueAt: undefined,
        updatedAt: now,
      });
      return { kind: "handled" };
    }

    const phaseConfig = await ctx.db
      .query("crmDripPhases")
      .withIndex("by_campaign_order", (q) => q.eq("dripCampaignId", campaign._id).eq("order", nextPhase))
      .first();
    if (!phaseConfig?.templateId) {
      // Automatable phases are opt-in. An unconfigured phase hands the
      // sequence back to a human rather than guessing what to send.
      await unqueue();
      return { kind: "handled" };
    }

    const template = await ctx.db.get(phaseConfig.templateId);
    if (!template || template.isArchived) {
      await unqueue();
      return { kind: "handled" };
    }

    if (!isWithinSendWindow(now, campaign)) {
      await hold(nextWindowOpening(now, campaign));
      return { kind: "handled" };
    }

    const contact = await ctx.db.get(enrollment.contactId);
    if (!contact) {
      await unqueue();
      return { kind: "handled" };
    }

    // THE GATE — identical ladder to a manual campaign build.
    const eligibility = await checkEmailEligibility(ctx, contact);
    if (!eligibility.emailable) {
      // Pausing the enrollment (rather than skipping this one phase) is the
      // honest outcome: the reason is a property of the contact, so the next
      // phase would fail for the same reason.
      await unqueue();
      await exitEnrollmentsForContact(ctx, contact._id, {
        status: "paused",
        reason: eligibility.reason ?? "not_emailable",
        at: now,
      });
      return { kind: "handled" };
    }

    // Shared daily budget with campaigns and workflows — one CRM outbound
    // quota, not a third parallel one. Hold rather than drop.
    const day = todayUtc(now);
    const counter = await ctx.db.query("crmSendCounters").withIndex("by_day", (q) => q.eq("day", day)).first();
    if ((counter?.sentCount ?? 0) >= CRM_DAILY_SEND_CAP) {
      await hold(now + msUntilNextUtcMidnight(now));
      return { kind: "handled" };
    }
    if (counter) await ctx.db.patch(counter._id, { sentCount: counter.sentCount + 1, updatedAt: now });
    else await ctx.db.insert("crmSendCounters", { day, sentCount: 1, updatedAt: now });

    // Claimed: clear the due date so no concurrent tick can pick it up. The
    // outcome mutation sets the next one.
    await unqueue();

    const mergeData: Record<string, string | undefined> = {
      firstName: contact.firstName,
      lastName: contact.lastName,
      fullName: contact.fullName,
      companyName: contact.companyName,
      jobTitle: contact.jobTitle,
    };
    // The contact id doubles as the unsubscribe token for sends with no
    // per-recipient row — the pattern suppressions.ts already resolves.
    const unsubscribePageUrl = `${getBaseUrl()}/unsubscribe/${contact._id}`;
    const renderedBody = renderMergeFields(template.bodyHtml, mergeData);
    const html = CRM_POSTAL_ADDRESS
      ? appendComplianceFooter(renderedBody, {
          postalAddress: CRM_POSTAL_ADDRESS,
          unsubscribeUrl: unsubscribePageUrl,
          companyName: CRM_FROM_NAME,
        })
      : renderedBody;

    return {
      kind: "send",
      enrollmentId: enrollment._id,
      contactId: contact._id,
      dripCampaignId: campaign._id,
      phase: nextPhase,
      to: eligibility.email!,
      subject: renderMergeFields(template.subject, mergeData),
      html,
      unsubscribeApiUrl: `${getBaseUrl()}/api/crm/unsubscribe?token=${contact._id}`,
    };
  },
});

export const recordSendOutcome = internalMutation({
  args: {
    enrollmentId: v.id("crmDripEnrollments"),
    contactId: v.id("crmContacts"),
    dripCampaignId: v.id("crmDripCampaigns"),
    phase: v.number(),
    subject: v.string(),
    resendEmailId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const enrollment = await ctx.db.get(args.enrollmentId);
    if (!enrollment) return;

    if (!args.resendEmailId) {
      const attempts = (enrollment.sendAttempts ?? 0) + 1;
      if (attempts >= MAX_SEND_ATTEMPTS) {
        // Out of retries: pause rather than silently abandoning the contact
        // mid-sequence, so it shows up as paused in the phase breakdown.
        await ctx.db.patch(args.enrollmentId, {
          status: "paused", sendAttempts: attempts, lastSendError: args.error,
          nextPhaseDueAt: undefined, updatedAt: now,
        });
      } else {
        await ctx.db.patch(args.enrollmentId, {
          sendAttempts: attempts, lastSendError: args.error,
          nextPhaseDueAt: now + retryDelayMs(attempts), updatedAt: now,
        });
      }
      return;
    }

    const [campaign, contact] = await Promise.all([
      ctx.db.get(args.dripCampaignId),
      ctx.db.get(args.contactId),
    ]);

    // resendEmailId on the timeline row is what lets convex/emailEvents.ts
    // match delivery/open/bounce webhooks back to this send.
    await insertActivity(ctx, {
      contactId: args.contactId,
      activityType: "email_outbound",
      title: `Email: ${args.subject}`,
      isTouch: true,
      direction: "outbound",
      resendEmailId: args.resendEmailId,
      emailSubject: args.subject,
      emailTo: contact?.email,
      metadata: { dripCampaignId: args.dripCampaignId, phase: args.phase },
      actorType: "system",
      actorName: campaign ? `Drip: ${campaign.name}` : "Drip campaign",
    });

    // advanceSequence: false — the ENROLLMENT is authoritative for the phase,
    // and advanceEnrollmentForSend re-syncs the contact's cached dripStep.
    await recordEmailSent(ctx, args.contactId, { advanceSequence: false, at: now });
    await advanceEnrollmentForSend(ctx, {
      contactId: args.contactId,
      dripCampaignId: args.dripCampaignId,
      phase: args.phase,
      at: now,
    });

    // Queue the phase after this one, if there is one and it is configured.
    const fresh = await ctx.db.get(args.enrollmentId);
    if (!fresh || fresh.status !== "active" || !campaign) return;

    const upcoming = fresh.phase + 1;
    if (upcoming > campaign.phaseCount) {
      await ctx.db.patch(args.enrollmentId, { sendAttempts: 0, lastSendError: undefined, nextPhaseDueAt: undefined, updatedAt: now });
      return;
    }
    const nextConfig = await ctx.db
      .query("crmDripPhases")
      .withIndex("by_campaign_order", (q) => q.eq("dripCampaignId", campaign._id).eq("order", upcoming))
      .first();

    await ctx.db.patch(args.enrollmentId, {
      sendAttempts: 0,
      lastSendError: undefined,
      nextPhaseDueAt: nextConfig
        ? computeDueAt(now, nextConfig.delayDays ?? DEFAULT_PHASE_DELAY_DAYS)
        : undefined,
      updatedAt: now,
    });
  },
});

/**
 * The drain loop. Runs on a cron and is also scheduled directly when a
 * campaign starts, so the first phase does not wait for the next tick.
 */
export const tick = internalAction({
  args: {},
  handler: async (ctx): Promise<{ sent: number }> => {
    let sent = 0;

    for (let batch = 0; batch < MAX_BATCHES_PER_TICK; batch++) {
      const dueIds = await ctx.runQuery(internal.crm.dripEngine.claimDue, {});
      if (dueIds.length === 0) break;

      for (const enrollmentId of dueIds) {
        const prepared = await ctx.runMutation(internal.crm.dripEngine.prepareSend, { enrollmentId });
        if (prepared.kind !== "send") continue;

        const result = await sendViaResend({
          to: prepared.to,
          subject: prepared.subject,
          html: prepared.html,
          from: CRM_FROM_EMAIL ? `${CRM_FROM_NAME} <${CRM_FROM_EMAIL}>` : undefined,
          category: "crm-drip",
          tags: [{ name: "drip", value: String(prepared.dripCampaignId) }],
          headers: {
            "List-Unsubscribe": `<${prepared.unsubscribeApiUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            // Marks bulk mail so mailbox providers and auto-responders treat
            // it correctly — the convention EspoCRM's mass sender uses.
            Precedence: "bulk",
          },
          idempotencyKey: `crm-drip-${prepared.enrollmentId}-${prepared.phase}`,
          useOutreachKey: true,
        });

        await ctx.runMutation(internal.crm.dripEngine.recordSendOutcome, {
          enrollmentId: prepared.enrollmentId,
          contactId: prepared.contactId,
          dripCampaignId: prepared.dripCampaignId,
          phase: prepared.phase,
          subject: prepared.subject,
          resendEmailId: result.messageId,
          error: result.error,
        });

        if (result.messageId) sent++;
        await new Promise((resolve) => setTimeout(resolve, SEND_INTERVAL_MS));
      }
    }

    return { sent };
  },
});
