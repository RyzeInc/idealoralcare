/**
 * REVENUE — one definition, used by every insights surface.
 *
 * Revenue was previously computed in several places with different rules. In
 * `admin/unifiedData.ts` alone, `getBillingData` defaulted a missing rate to
 * 1500 cents while `getDashboardMetrics` defaulted to 15.00 dollars, in the
 * same file, for the same concept. Anything reading those disagreed.
 *
 * There are TWO genuinely different quantities here and they must not be
 * conflated:
 *
 *   MRR              — what customers actually pay us, normalized to a month.
 *                      Source: subscriptionBundles.pricingSnapshot.totalCents.
 *                      This is the growth metric.
 *
 *   Dispersal        — the $14.99 / $24.99 tier model the operating agreement
 *                      splits between Toothlens, Careington, processing, the
 *                      partner vendor share, and Ryze's residual.
 *                      Source: lib/dispersal.ts, frozen monthly into
 *                      invoicePeriods. This is what partners get paid from.
 *
 * A member can have non-zero MRR and zero dispersal (an annual plan, today —
 * see admin/revenueHealth.ts). Reporting one as the other would be wrong in
 * both directions, so they are returned separately and labelled everywhere.
 *
 * Closed months read the frozen `invoicePeriods.memberLines[]` — immutable,
 * hashed, and already carrying per-member rep attribution. The current month
 * is computed live. Nothing here invents a rate.
 */

import { Doc, Id } from "../_generated/dataModel";
import { QueryCtx } from "../_generated/server";
import { classifyTier, getSplitForTier, DispersalSplit, ZERO_SPLIT } from "../lib/dispersal";
import {
  memberBilling,
  normalizeToMonthlyCents,
  LIVE_BUNDLE_STATUSES as SHARED_LIVE_BUNDLE_STATUSES,
  type BillingSource,
  type BillingFacts,
} from "../lib/memberBilling";
import { ViewerScope, scopeAgencyIds, scopeRepIds } from "./scope";

/* ------------------------------------------------------------------ */
/* MRR                                                                */
/* ------------------------------------------------------------------ */

/**
 * Bundle states that represent a live, paying relationship.
 * Re-exported from lib/memberBilling so there is one definition.
 */
export const LIVE_BUNDLE_STATUSES = SHARED_LIVE_BUNDLE_STATUSES;

/** Statuses that mean money has actually stopped. */
export const DEAD_BUNDLE_STATUSES: ReadonlySet<string> = new Set([
  "cancelled",
  "payment_failed",
  "suspended",
]);

/** Re-exported so existing callers keep working. */
export { normalizeToMonthlyCents };

/** Monthly recurring cents for one bundle, or 0 if it is not live. */
export function bundleMrrCents(bundle: Doc<"subscriptionBundles">): number {
  if (!LIVE_BUNDLE_STATUSES.has(bundle.status)) return 0;
  return normalizeToMonthlyCents(
    bundle.pricingSnapshot?.totalCents,
    bundle.cadence,
  );
}

/* ------------------------------------------------------------------ */
/* Live dispersal                                                     */
/* ------------------------------------------------------------------ */

export interface SourceTotals {
  members: number;
  mrrCents: number;
}

export interface RevenueTotals {
  /** Combined monthly recurring revenue across every billing mechanism. */
  mrrCents: number;
  /** Members contributing to `mrrCents`. */
  payingMembers: number;
  /**
   * The mix. Employer-billed money and card payments behave differently
   * (collection risk, churn, timing), so the split is always available
   * alongside the combined figure rather than being collapsed into it.
   */
  bySource: Record<BillingSource, SourceTotals>;
  /** Dispersal split — what vendor and partner shares are drawn from. */
  dispersal: DispersalSplit;
  /**
   * Paying members the DISPERSAL engine cannot price (currently: annual
   * plans). These still contribute to mrrCents; they just produce no partner
   * share. Surfaced so a zero partner share is visibly a gap, not silently a
   * zero.
   */
  unclassifiedPayingMembers: number;
  /** Members on the book with no billing mechanism at all. */
  unbilledMembers: number;
}

const emptySource = (): SourceTotals => ({ members: 0, mrrCents: 0 });

export const ZERO_TOTALS: RevenueTotals = {
  mrrCents: 0,
  payingMembers: 0,
  bySource: {
    direct: emptySource(),
    list_bill: emptySource(),
    comp: emptySource(),
    none: emptySource(),
  },
  dispersal: ZERO_SPLIT,
  unclassifiedPayingMembers: 0,
  unbilledMembers: 0,
};

function addSplitInto(target: DispersalSplit, add: DispersalSplit): DispersalSplit {
  return {
    grossCents: target.grossCents + add.grossCents,
    toothlensCents: target.toothlensCents + add.toothlensCents,
    careingtonCents: target.careingtonCents + add.careingtonCents,
    processingCents: target.processingCents + add.processingCents,
    partnerVendorCents: target.partnerVendorCents + add.partnerVendorCents,
    ryzeKeepCents: target.ryzeKeepCents + add.ryzeKeepCents,
  };
}

/**
 * Everything a scope's members need in order to be priced.
 *
 * Replaces the old `loadBundlesByCustomer`, which returned only Stripe bundles
 * — leaving every caller unable to distinguish "no bundle" (unbilled) from
 * "employer-billed" (list-bill), and defaulting both to $0.
 */
export interface BillingContext {
  bundlesByCustomer: Map<string, Doc<"subscriptionBundles">>;
  groupsById: Map<string, Doc<"groups">>;
  accountsById: Map<string, Doc<"accounts">>;
  /** Primary member id -> their dependent member rows. */
  dependentsByPrimary: Map<string, Doc<"memberProfiles">[]>;
}

/**
 * Load the billing context for a set of members.
 *
 * Dependent counts come from `memberProfiles` rows with
 * `memberRole: "dependent"` — NOT from the primary's embedded `dependents[]`
 * array. Both exist and represent the same people; summing them double-counts
 * the household and would push tiers from MO to MF. See admin/members.ts,
 * which resolves the same ambiguity the same way.
 */
export async function loadBillingContext(
  ctx: QueryCtx,
  members: Doc<"memberProfiles">[],
): Promise<BillingContext> {
  const customerIds = members
    .map((m) => m.customerId)
    .filter((c): c is string => !!c);

  const bundlesByCustomer = await loadBundlesByCustomer(ctx, customerIds);

  const groupIds = new Set(members.map((m) => String(m.groupId)));
  const groupsById = new Map<string, Doc<"groups">>();
  const accountsById = new Map<string, Doc<"accounts">>();
  for (const groupId of groupIds) {
    const group = await ctx.db.get(groupId as Id<"groups">).catch(() => null);
    if (!group) continue;
    groupsById.set(groupId, group);
    const accountKey = String(group.accountId);
    if (!accountsById.has(accountKey)) {
      const account = await ctx.db.get(group.accountId).catch(() => null);
      if (account) accountsById.set(accountKey, account);
    }
  }

  // Dependents already present in `members` are indexed directly; for
  // primaries whose dependents fall outside the loaded set (a scoped read can
  // legitimately include one and not the other) we fetch by index.
  const dependentsByPrimary = new Map<string, Doc<"memberProfiles">[]>();
  const havePrimary = new Set(
    members.filter((m) => m.memberRole !== "dependent").map((m) => String(m._id)),
  );
  for (const m of members) {
    if (m.memberRole !== "dependent" || !m.primaryMemberId) continue;
    const key = String(m.primaryMemberId);
    const list = dependentsByPrimary.get(key) ?? [];
    list.push(m);
    dependentsByPrimary.set(key, list);
  }
  for (const primaryId of havePrimary) {
    if (dependentsByPrimary.has(primaryId)) continue;
    const deps = await ctx.db
      .query("memberProfiles")
      .withIndex("by_primary_member", (q) =>
        q.eq("primaryMemberId", primaryId as Id<"memberProfiles">),
      )
      .collect();
    if (deps.length > 0) dependentsByPrimary.set(primaryId, deps);
  }

  return { bundlesByCustomer, groupsById, accountsById, dependentsByPrimary };
}

/** Resolve one member's billing facts against a loaded context. */
export function billingFor(
  member: Doc<"memberProfiles">,
  bctx: BillingContext,
): BillingFacts {
  const group = bctx.groupsById.get(String(member.groupId)) ?? null;
  const account = group
    ? bctx.accountsById.get(String(group.accountId)) ?? null
    : null;
  const deps = bctx.dependentsByPrimary.get(String(member._id)) ?? [];
  const bundle = member.customerId
    ? bctx.bundlesByCustomer.get(member.customerId) ?? null
    : null;
  return memberBilling(member, group, account, deps, bundle);
}

/**
 * Live revenue for a set of members, across every billing mechanism.
 *
 * Only PRIMARY members produce revenue — dependents ride on the primary's
 * coverage and are worth $0 by design.
 *
 * Note the two different notions of "priced" in play. A list-bill member is
 * fully priced for REVENUE (from the employer's contracted rate) while still
 * being unpriced by the DISPERSAL model, which only recognises the fixed
 * $14.99 / $24.99 tiers. Both facts are reported rather than one masking the
 * other.
 */
export function revenueForMembers(
  members: Doc<"memberProfiles">[],
  bctx: BillingContext,
): RevenueTotals {
  const bySource: Record<BillingSource, SourceTotals> = {
    direct: emptySource(),
    list_bill: emptySource(),
    comp: emptySource(),
    none: emptySource(),
  };

  let mrrCents = 0;
  let payingMembers = 0;
  let unclassified = 0;
  let unbilled = 0;
  let dispersal = ZERO_SPLIT;

  for (const member of members) {
    if (member.memberRole === "dependent") continue;

    const facts = billingFor(member, bctx);
    bySource[facts.source].members += 1;
    bySource[facts.source].mrrCents += facts.mrrCents;

    if (facts.source === "none") {
      if (facts.onBook) unbilled++;
      continue;
    }

    mrrCents += facts.mrrCents;
    if (facts.mrrCents > 0) payingMembers++;

    // Dispersal is a separate model with its own tier rules — a list-bill
    // member is classified from their household, a direct member from the
    // exact price they pay.
    if (facts.source === "list_bill") {
      dispersal = addSplitInto(
        dispersal,
        getSplitForTier(facts.dependentCount > 0 ? "family" : "individual"),
      );
    } else {
      const bundle = member.customerId
        ? bctx.bundlesByCustomer.get(member.customerId)
        : undefined;
      const tier = classifyTier(bundle?.pricingSnapshot?.totalCents);
      if (tier === "none") {
        if (facts.mrrCents > 0) unclassified++;
      } else {
        dispersal = addSplitInto(dispersal, getSplitForTier(tier));
      }
    }
  }

  return {
    mrrCents,
    payingMembers,
    bySource,
    dispersal,
    unclassifiedPayingMembers: unclassified,
    unbilledMembers: unbilled,
  };
}

/**
 * Load the live bundle for each customer, preferring an active one.
 *
 * A customer can accumulate several bundle rows over time (cancel,
 * resubscribe, change tier). Taking the wrong one would double-count or
 * resurrect revenue.
 */
export async function loadBundlesByCustomer(
  ctx: QueryCtx,
  customerIds: Iterable<string>,
): Promise<Map<string, Doc<"subscriptionBundles">>> {
  const byCustomer = new Map<string, Doc<"subscriptionBundles">>();
  const seen = new Set<string>();

  for (const customerId of customerIds) {
    if (!customerId || seen.has(customerId)) continue;
    seen.add(customerId);

    const bundles = await ctx.db
      .query("subscriptionBundles")
      .withIndex("by_customer", (q) => q.eq("customerId", customerId))
      .collect();
    if (bundles.length === 0) continue;

    const live = bundles.filter((b) => LIVE_BUNDLE_STATUSES.has(b.status));
    const chosen =
      live.sort((a, b) => (b.activatedAt ?? b.createdAt) - (a.activatedAt ?? a.createdAt))[0] ??
      bundles.sort((a, b) => (b.activatedAt ?? b.createdAt) - (a.activatedAt ?? a.createdAt))[0];
    byCustomer.set(customerId, chosen);
  }

  return byCustomer;
}

/* ------------------------------------------------------------------ */
/* Closed-period partner earnings                                     */
/* ------------------------------------------------------------------ */

export interface PartnerEarnings {
  period: string;
  /** Partner-vendor share attributable to this scope, in cents. */
  partnerVendorCents: number;
  /** Gross the scope's members generated. */
  grossCents: number;
  /** Primary members counted. */
  memberCount: number;
}

/**
 * Partner earnings for one closed month, drawn from the frozen member lines.
 *
 * `invoicePeriods.memberLines[]` already carries `repId` / `agencyId` per
 * member alongside that member's dispersal split, snapshotted at close with a
 * SHA-256 payload hash. That makes it the only audit-grade source of
 * per-broker revenue in the system — and the reason this does not touch
 * `commissionPayables`, whose historical rows were written at a hardcoded rate
 * (see the keySpace note in schema.ts).
 *
 * These are EARNINGS ESTIMATES from the dispersal model, not a payout
 * statement. Every caller must label them as such.
 */
export async function partnerEarningsForPeriod(
  ctx: QueryCtx,
  scope: ViewerScope,
  period: string,
): Promise<PartnerEarnings> {
  const rows = await ctx.db
    .query("invoicePeriods")
    .withIndex("by_period", (q) => q.eq("period", period))
    .collect();

  const repIds = scopeRepIds(scope);
  const agencyIds = scopeAgencyIds(scope);
  const repSet = repIds ? new Set(repIds) : null;
  const agencySet = agencyIds ? new Set(agencyIds) : null;

  let partnerVendorCents = 0;
  let grossCents = 0;
  let memberCount = 0;

  for (const row of rows) {
    for (const line of row.memberLines ?? []) {
      // null sets mean admin — no filter.
      if (repSet || agencySet) {
        const repMatch = repSet && line.repId ? repSet.has(line.repId) : false;
        const agencyMatch =
          agencySet && line.agencyId ? agencySet.has(line.agencyId) : false;
        if (!repMatch && !agencyMatch) continue;
      }
      partnerVendorCents += line.partnerVendorCents ?? 0;
      grossCents += line.grossCents ?? 0;
      memberCount++;
    }
  }

  return { period, partnerVendorCents, grossCents, memberCount };
}

/** Partner earnings across a list of closed periods, most recent first. */
export async function partnerEarningsForPeriods(
  ctx: QueryCtx,
  scope: ViewerScope,
  periods: string[],
): Promise<PartnerEarnings[]> {
  const out: PartnerEarnings[] = [];
  for (const period of periods) {
    out.push(await partnerEarningsForPeriod(ctx, scope, period));
  }
  return out.sort((a, b) => b.period.localeCompare(a.period));
}
