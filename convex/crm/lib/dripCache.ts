/**
 * PRIMARY-ENROLLMENT CACHE — the single writer for the campaign columns on
 * crmContacts.
 *
 * Directly modelled on lib/dealCache.ts, for the same reason it exists: a
 * contact can be on several drip campaigns at once, but the contact list has
 * to render and filter without joining a second table per row. So
 * crmDripEnrollments is the source of truth, and these contact columns are a
 * cache of it:
 *
 *   dripCampaignIds        — every campaign the contact is currently on
 *   primaryDripCampaignId  — the one dripStep/dripStatus describe
 *   dripStep / dripStatus  — the primary enrollment's phase and state
 *
 * dripStep/dripStatus predate campaigns (they were a free-floating 0-5
 * counter). Making them a projection of the primary enrollment is what gives
 * them a subject: "Email 3 Sent" now means phase 3 OF a named campaign.
 *
 * It lives in lib/ rather than in dripCampaigns.ts so campaignEngine.ts can
 * re-sync after a send without importing the mutation module — the same
 * import-cycle argument as dealCache.ts.
 */

import type { MutationCtx } from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import type { DripStatus } from "./contactStatus";

type EnrollmentStatus = Doc<"crmDripEnrollments">["status"];

/** Enrollments that still count as "on the campaign". */
const LIVE_STATUSES: readonly EnrollmentStatus[] = ["active", "paused", "completed", "replied"];

/**
 * How an enrollment projects onto the contact's drip columns.
 *
 * Pure and exported so the mapping is unit-testable without a database — it is
 * the one place two different vocabularies (enrollment status vs. the drip
 * status the UI already shipped) are reconciled.
 */
export function dripStatusForEnrollment(status: EnrollmentStatus, phase: number): DripStatus {
  switch (status) {
    case "completed":
      return "completed";
    case "paused":
      return "paused";
    case "replied":
      return "replied_removed";
    case "removed":
      return "not_started";
    case "active":
      // Enrolled but nothing sent yet is genuinely "Not Started" — phase 0
      // means no phase has gone out, not "in progress at zero".
      return phase > 0 ? "in_progress" : "not_started";
  }
}

/**
 * Pick the enrollment the contact's cached columns should mirror.
 *
 * Active beats everything else — if someone is actively being mailed by one
 * campaign and completed another, the live one is the answer to "what are they
 * on". Within a tier, most recently enrolled wins.
 */
export function pickPrimaryEnrollment(
  enrollments: Doc<"crmDripEnrollments">[],
): Doc<"crmDripEnrollments"> | null {
  const live = enrollments.filter((e) => e.status !== "removed");
  if (live.length === 0) return null;
  const active = live.filter((e) => e.status === "active");
  const pool = active.length > 0 ? active : live;
  return pool.sort((a, b) => b.enrolledAt - a.enrolledAt)[0];
}

/**
 * Mirror a contact's enrollments onto its cached columns. Call after ANY write
 * to crmDripEnrollments for that contact.
 *
 * A contact with no live enrollment has its campaign pointers cleared and its
 * drip columns reset to not_started — unlike the deal cache, which deliberately
 * preserves a company's last stage. The difference is that a stage is history
 * worth keeping, whereas "Email 3 Sent" with no campaign attached is the exact
 * orphaned counter this whole model exists to eliminate.
 */
export async function syncPrimaryDripCache(
  ctx: MutationCtx,
  contactId: Id<"crmContacts">,
): Promise<Id<"crmDripEnrollments"> | null> {
  const contact = await ctx.db.get(contactId);
  if (!contact) return null;

  const enrollments = await ctx.db
    .query("crmDripEnrollments")
    .withIndex("by_contact", (q) => q.eq("contactId", contactId))
    .collect();

  const primary = pickPrimaryEnrollment(enrollments);
  const campaignIds = enrollments
    .filter((e) => (LIVE_STATUSES as readonly string[]).includes(e.status))
    .map((e) => e.dripCampaignId);

  if (!primary) {
    await ctx.db.patch(contactId, {
      dripCampaignIds: [],
      primaryDripCampaignId: undefined,
      dripStatus: "not_started",
      dripStep: 0,
      updatedAt: Date.now(),
    });
    return null;
  }

  await ctx.db.patch(contactId, {
    dripCampaignIds: campaignIds,
    primaryDripCampaignId: primary.dripCampaignId,
    dripStatus: dripStatusForEnrollment(primary.status, primary.phase),
    dripStep: primary.phase,
    updatedAt: Date.now(),
  });

  return primary._id;
}

/**
 * Recompute a campaign's display counters. Cheap at this scale (a campaign is
 * hundreds of rows, not millions) and, like crmTags.contactCount, display-only
 * — targeting always re-queries the enrollments table.
 */
export async function syncDripCampaignCounts(
  ctx: MutationCtx,
  dripCampaignId: Id<"crmDripCampaigns">,
): Promise<void> {
  const campaign = await ctx.db.get(dripCampaignId);
  if (!campaign) return;
  const enrollments = await ctx.db
    .query("crmDripEnrollments")
    .withIndex("by_campaign_status", (q) => q.eq("dripCampaignId", dripCampaignId))
    .collect();

  await ctx.db.patch(dripCampaignId, {
    activeCount: enrollments.filter((e) => e.status === "active").length,
    completedCount: enrollments.filter((e) => e.status === "completed").length,
    updatedAt: Date.now(),
  });
}
