/**
 * ADVANCING AN ENROLLMENT ON SEND — the bridge between a blast going out and
 * the campaign phase a contact is recorded at.
 *
 * Separate from dripCampaigns.ts (which holds the staff-facing mutations) for
 * the dealCache.ts reason: campaignEngine.ts must be able to advance a phase
 * without importing the whole mutation module, and dripCampaigns.ts imports
 * activities.ts, which would put a cycle through the send path.
 */

import type { MutationCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { syncPrimaryDripCache, syncDripCampaignCounts } from "./dripCache";

/**
 * Take a contact out of every sequence they are running, because something
 * about the contact — not about one campaign — changed.
 *
 * THIS IS THE FUNCTION THAT ACTUALLY STOPS MAIL. Writing "replied" or "paused"
 * onto the contact's cached dripStatus column does nothing durable: that column
 * is recomputed from the enrollment by syncPrimaryDripCache, so the next bulk
 * advance or phase send silently restores it — and the send path checks the
 * ENROLLMENT, not the cache. Reply/bounce handling must land here.
 *
 * Scope is deliberately every campaign, not just the one that sent the mail:
 * a reply means the person is talking to us, and a dead address is dead for
 * all of them. Continuing a second automated drip in either case is the same
 * harm the first one was stopped for.
 */
export async function exitEnrollmentsForContact(
  ctx: MutationCtx,
  contactId: Id<"crmContacts">,
  opts: { status: "replied" | "paused"; reason?: string; at?: number },
): Promise<number> {
  const at = opts.at ?? Date.now();
  const enrollments = await ctx.db
    .query("crmDripEnrollments")
    .withIndex("by_contact", (q) => q.eq("contactId", contactId))
    .collect();

  // A reply supersedes a pause, but a bounce must never overwrite a reply —
  // "they answered us" is the more important fact and the harder one to undo.
  const candidates = enrollments.filter((e) => e.status === "active" || e.status === "paused");
  const touched = opts.status === "replied" ? candidates : candidates.filter((e) => e.status === "active");
  if (touched.length === 0) return 0;

  for (const enrollment of touched) {
    await ctx.db.patch(enrollment._id, {
      status: opts.status,
      // A pause is recoverable and keeps no exit stamp; a reply is an exit.
      exitedAt: opts.status === "replied" ? at : undefined,
      exitReason: opts.reason,
      updatedAt: at,
    });
  }

  await syncPrimaryDripCache(ctx, contactId);
  for (const campaignId of new Set(touched.map((e) => e.dripCampaignId))) {
    await syncDripCampaignCounts(ctx, campaignId);
  }
  return touched.length;
}

/**
 * Record that a contact has received a phase of a drip campaign.
 *
 * `phase` is the phase the blast declares itself to be. It is set ABSOLUTELY
 * rather than incremented, because the blast knows which email it is and the
 * enrollment might not: someone added to the campaign late, at phase 0, who
 * receives the phase-3 email is at phase 3 — not phase 1. Incrementing would
 * quietly claim they had received emails 1 and 2.
 *
 * Never moves a contact backwards: a re-send, or a late webhook for an earlier
 * phase, must not undo progress.
 */
export async function advanceEnrollmentForSend(
  ctx: MutationCtx,
  args: {
    contactId: Id<"crmContacts">;
    dripCampaignId: Id<"crmDripCampaigns">;
    /** Omit to simply step the enrollment forward by one. */
    phase?: number;
    at?: number;
  },
): Promise<void> {
  const campaign = await ctx.db.get(args.dripCampaignId);
  if (!campaign) return;

  const enrollment = await ctx.db
    .query("crmDripEnrollments")
    .withIndex("by_campaign_contact", (q) =>
      q.eq("dripCampaignId", args.dripCampaignId).eq("contactId", args.contactId),
    )
    .first();
  // "replied" and "removed" are EXITS, not pauses. A stray blast that reaches
  // someone who already answered must not record them as having progressed a
  // phase — the same monotonic rule Odoo's mailing.trace uses, where an open
  // never overwrites a reply. A paused enrollment does advance: the pause is
  // about deliverability, so if mail genuinely went out, the record should say
  // so and the sequence resumes.
  if (!enrollment || enrollment.status === "removed" || enrollment.status === "replied") return;

  const at = args.at ?? Date.now();
  const target = args.phase ?? enrollment.phase + 1;
  const phase = Math.max(enrollment.phase, Math.min(Math.round(target), campaign.phaseCount));

  await ctx.db.patch(enrollment._id, {
    phase,
    status: phase >= campaign.phaseCount ? "completed" : "active",
    completedAt: phase >= campaign.phaseCount ? (enrollment.completedAt ?? at) : enrollment.completedAt,
    lastPhaseSentAt: at,
    updatedAt: at,
  });

  await syncPrimaryDripCache(ctx, args.contactId);
  await syncDripCampaignCounts(ctx, args.dripCampaignId);
}
