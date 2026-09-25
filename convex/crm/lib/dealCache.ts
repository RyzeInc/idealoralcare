/**
 * PRIMARY-DEAL CACHE — the single writer for the deal columns on crmCompanies.
 *
 * crmCompanies still carries stage / stageChangedAt / winProbability /
 * estimatedMrrCents / estimatedLives / expectedCloseDate / lostReason, because
 * they are load-bearing: `stage` is a search-index filterField, the key of
 * by_stage and by_owner_stage, and the string persisted inside saved segments.
 * Those columns are now a CACHE of the company's primary deal, and this
 * function is the only thing allowed to write them.
 *
 * It lives in lib/ rather than in deals.ts so that pipelines.ts (which must
 * re-sync when a stage's canonical mapping changes) and deals.ts can both call
 * it without an import cycle — the same reason lib/filters.ts is separate from
 * contacts.ts.
 */

import type { MutationCtx } from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";

type CanonicalStage = Doc<"crmCompanies">["stage"];

/**
 * Mirror a company's primary deal onto its cached columns.
 *
 * When the current primary is archived or gone, the most recently updated
 * remaining open deal is promoted rather than leaving the company pointing at
 * a dead row. A company with no open deals keeps its last cached values — its
 * history is still real, and blanking the stage would silently drop it out of
 * every funnel it legitimately appeared in.
 */
export async function syncPrimaryDealCache(
  ctx: MutationCtx,
  companyId: Id<"crmCompanies">,
): Promise<Id<"crmDeals"> | null> {
  const company = await ctx.db.get(companyId);
  if (!company) return null;

  const open = (
    await ctx.db.query("crmDeals").withIndex("by_company", (q) => q.eq("companyId", companyId)).collect()
  ).filter((d) => !d.isArchived);

  if (open.length === 0) return null;

  let primary = open.find((d) => d.isPrimary);
  if (!primary) {
    primary = open.sort((a, b) => b.updatedAt - a.updatedAt)[0];
    await ctx.db.patch(primary._id, { isPrimary: true, updatedAt: Date.now() });
  }

  // Exactly one primary per company — demote any extras picked up from a
  // merge or a concurrent write.
  for (const deal of open) {
    if (deal._id !== primary._id && deal.isPrimary) {
      await ctx.db.patch(deal._id, { isPrimary: false, updatedAt: Date.now() });
    }
  }

  const stage = await ctx.db.get(primary.stageId);
  if (!stage) return primary._id;

  const canonical: CanonicalStage = stage.canonicalStage;
  const now = Date.now();

  await ctx.db.patch(companyId, {
    stage: canonical,
    stageChangedAt: primary.stageChangedAt,
    winProbability: primary.winProbability ?? stage.probability,
    estimatedMrrCents: primary.mrrCents,
    estimatedLives: primary.estimatedLives,
    expectedCloseDate: primary.expectedCloseDate,
    lostReason: stage.isLost ? primary.lostReason : undefined,
    convertedAt: stage.isWon && !company.convertedAt ? (primary.closedAt ?? now) : company.convertedAt,
    updatedAt: now,
  });

  return primary._id;
}

/** Sparse gap so ordinary drags never need a full-column renumber. */
export const BOARD_POSITION_GAP = 1000;

/**
 * Position for a card dropped between two neighbours. Callers pass the
 * positions either side of the drop point (undefined at a column edge).
 */
export function positionBetween(before?: number, after?: number): number {
  if (before === undefined && after === undefined) return BOARD_POSITION_GAP;
  if (before === undefined) return after! - BOARD_POSITION_GAP;
  if (after === undefined) return before + BOARD_POSITION_GAP;
  return (before + after) / 2;
}
