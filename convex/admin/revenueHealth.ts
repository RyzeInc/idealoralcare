/**
 * REVENUE HEALTH — which subscriptions the dispersal engine cannot price.
 *
 * `classifyTier` (lib/dispersal.ts) maps a bundle's `pricingSnapshot.totalCents`
 * onto a plan tier by EXACT match: 1499 → individual, 2499 → family. Anything
 * else returns "none", and `invoiceCalculator` then skips that member entirely
 * — they produce no gross, no vendor fees, and no partner share.
 *
 * That is correct for genuinely $0 members (employer-comped, list-bill), but it
 * fails silently for anyone priced differently. Annual subscriptions are the
 * live example: the catalog sells them at 16499 / 27499, neither of which
 * classifies, so every annual member currently contributes $0 to dispersal.
 *
 * Whether an annual member should disperse as 1/12th of their prepayment, at
 * the monthly rate, or on some other basis is a revenue-policy decision with
 * real money owed to Toothlens, Careington, and partners — so this module
 * only MEASURES the gap. It deliberately does not guess a rule.
 */

import { query } from "../_generated/server";
import { requireAdmin } from "../lib/authGuards";
import { classifyTier } from "../lib/dispersal";

/**
 * Group every live subscription by the tier it classifies as, and break the
 * unclassified ones down by price point so the size of each gap is visible.
 */
export const getTierClassificationHealth = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const bundles = await ctx.db
      .query("subscriptionBundles")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    const byTier: Record<string, number> = { individual: 0, family: 0, none: 0 };
    // totalCents -> { count, cadence breakdown }
    const unclassified = new Map<
      number,
      { totalCents: number; count: number; monthly: number; annual: number; card: number; ach: number }
    >();

    for (const b of bundles) {
      const totalCents = b.pricingSnapshot?.totalCents;
      const tier = classifyTier(totalCents);
      byTier[tier] = (byTier[tier] ?? 0) + 1;
      if (tier !== "none") continue;

      // A genuinely free member is expected to be unclassified; only paid
      // bundles represent lost revenue.
      if (!totalCents || totalCents <= 0) continue;

      const row =
        unclassified.get(totalCents) ??
        { totalCents, count: 0, monthly: 0, annual: 0, card: 0, ach: 0 };
      row.count++;
      if (b.cadence === "annual") row.annual++;
      else row.monthly++;
      if (b.paymentMethod === "ach") row.ach++;
      else row.card++;
      unclassified.set(totalCents, row);
    }

    const rows = [...unclassified.values()].sort((a, b) => b.count - a.count);

    return {
      activeBundles: bundles.length,
      byTier,
      /** Paid bundles the engine prices at $0, worst offender first. */
      unclassifiedPricePoints: rows,
      /** Paid members currently contributing nothing to dispersal. */
      unclassifiedPaidBundles: rows.reduce((sum, r) => sum + r.count, 0),
      /**
       * Gross the engine is NOT recognising each month, valuing every
       * unclassified bundle at its own charged amount (annual ÷ 12). An
       * estimate for triage — not a number to invoice from.
       */
      unrecognizedMonthlyCentsEstimate: rows.reduce((sum, r) => {
        const monthlyPortion = r.monthly * r.totalCents;
        const annualPortion = Math.round((r.annual * r.totalCents) / 12);
        return sum + monthlyPortion + annualPortion;
      }, 0),
    };
  },
});
