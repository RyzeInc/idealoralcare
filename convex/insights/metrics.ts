/**
 * METRICS — the KPI tiles and trend series behind the Insights dashboard.
 *
 * Every exported query resolves a ViewerScope first and reads only what that
 * scope allows. There is no "unscoped for convenience" path.
 *
 * A note on comparisons. Metrics here are of two kinds and they cannot be
 * compared the same way:
 *
 *   FLOW  (new enrollments, terminations) — countable inside a window, so the
 *         previous period is simply the equivalent window before it.
 *
 *   STOCK (active members, MRR) — a point-in-time level. Comparing it needs
 *         the level as it stood at the start of the window, which we only
 *         truly know if a rollup was written that day. Where one exists we use
 *         it; otherwise we derive the opening level by unwinding the flows and
 *         mark the result `derived`, so nobody mistakes an estimate for a
 *         measurement.
 */

import { v } from "convex/values";
import { query } from "../_generated/server";
import { Doc } from "../_generated/dataModel";
import { resolveViewerScope, scopeLabel, ViewerScope } from "./scope";
import { QueryCtx } from "../_generated/server";
import { loadScopedMembers } from "./book";
import {
  revenueForMembers,
  loadBillingContext,
  billingFor,
  RevenueTotals,
} from "./revenue";
import { hasExited } from "../lib/memberLifecycle";
import { isOnBook } from "../lib/memberBilling";
import { currentPeriod, periodKey } from "../lib/periods";
import { partnerEarningsForPeriods } from "./revenue";

const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC "YYYY-MM-DD" for a timestamp. Rollups are keyed this way. */
export function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export interface Delta {
  current: number;
  previous: number;
  /** Absolute change. Percent is left to the client, which knows the format. */
  change: number;
  /** True when `previous` was reconstructed rather than measured. */
  derived?: boolean;
}

function delta(current: number, previous: number, derived = false): Delta {
  return { current, previous, change: current - previous, derived };
}

/** When a member joined the book. `enrolledAt` if we have it, else creation. */
function joinedAt(m: Doc<"memberProfiles">): number {
  return m.enrolledAt ?? m.createdAt;
}

export interface OverviewKpis {
  activeMembers: Delta;
  newEnrollments: Delta;
  terminations: Delta;
  netGrowth: Delta;
  mrrCents: Delta;
  arpmCents: Delta;
  /** Members still on the book at window end, as a share of those at start. */
  retentionRate: number | null;
  churnRate: number | null;
  atRiskMembers: number;
  pendingMembers: number;
  totalMembers: number;
  payingMembers: number;
  unclassifiedPayingMembers: number;
}

/**
 * Compute every headline figure for a scope over a window.
 *
 * Reads the scope's members once and derives everything from that single pass,
 * rather than re-querying per tile.
 */
export async function computeOverview(
  ctx: QueryCtx,
  scope: ViewerScope,
  windowStart: number,
  windowEnd: number,
): Promise<{ kpis: OverviewKpis; revenue: RevenueTotals; truncated: boolean }> {
  const { members, truncated } = await loadScopedMembers(ctx, scope);
  const windowMs = windowEnd - windowStart;
  const prevStart = windowStart - windowMs;

  const bctx = await loadBillingContext(ctx, members);

  // "On the book" means what the invoice generator bills: active + enrolling +
  // eligible. Counting only "active" reported zero members for a freshly
  // loaded employer group that was already being invoiced.
  const active = members.filter((m) => isOnBook(m) && m.memberRole !== "dependent");
  const revenue = revenueForMembers(active, bctx);

  // Flow metrics.
  let newInWindow = 0;
  let newInPrev = 0;
  let termInWindow = 0;
  let termInPrev = 0;
  let pending = 0;

  for (const m of members) {
    if (m.memberRole === "dependent") continue;

    const joined = joinedAt(m);
    if (joined >= windowStart && joined < windowEnd) newInWindow++;
    else if (joined >= prevStart && joined < windowStart) newInPrev++;

    if (typeof m.terminatedAt === "number") {
      if (m.terminatedAt >= windowStart && m.terminatedAt < windowEnd) termInWindow++;
      else if (m.terminatedAt >= prevStart && m.terminatedAt < windowStart) termInPrev++;
    }

    // A lead is a prospect. "enrolling"/"eligible" are covered and billed, so
    // they belong in the active count above, not here.
    if (m.memberType === "lead") pending++;
  }

  // At risk: covered today, but the money is failing. For a direct member that
  // is a declined card; for a list-bill member it is their employer's invoice
  // going overdue — previously they could never be flagged at all.
  const overdueGroupIds = new Set<string>();
  const overdueInvoices = await ctx.db
    .query("listBillInvoices")
    .withIndex("by_status", (q) => q.eq("status", "overdue"))
    .collect();
  for (const inv of overdueInvoices) overdueGroupIds.add(String(inv.groupId));

  let atRisk = 0;
  for (const m of active) {
    const facts = billingFor(m, bctx);
    if (facts.source === "list_bill") {
      if (overdueGroupIds.has(String(m.groupId))) atRisk++;
      continue;
    }
    const bundle = m.customerId ? bctx.bundlesByCustomer.get(m.customerId) : undefined;
    if (bundle && (bundle.status === "past_due" || bundle.status === "payment_failed")) {
      atRisk++;
    }
  }

  // Stock metrics: prefer a measured opening level, fall back to unwinding.
  const opening = await openingLevels(ctx, scope, windowStart);
  const activeAtStartDerived = active.length - newInWindow + termInWindow;
  const activeAtStart = opening?.activeMembers ?? activeAtStartDerived;
  const mrrAtStart = opening?.mrrCents ?? null;

  // Retention over the window, measured against who was here at the start.
  const retentionRate =
    activeAtStart > 0
      ? Math.max(0, Math.min(1, (activeAtStart - termInWindow) / activeAtStart))
      : null;

  const arpmNow = active.length > 0 ? Math.round(revenue.mrrCents / active.length) : 0;
  const arpmPrev =
    activeAtStart > 0 && mrrAtStart !== null
      ? Math.round(mrrAtStart / activeAtStart)
      : arpmNow;

  return {
    truncated,
    revenue,
    kpis: {
      activeMembers: delta(active.length, activeAtStart, opening == null),
      newEnrollments: delta(newInWindow, newInPrev),
      terminations: delta(termInWindow, termInPrev),
      netGrowth: delta(newInWindow - termInWindow, newInPrev - termInPrev),
      mrrCents: delta(revenue.mrrCents, mrrAtStart ?? revenue.mrrCents, mrrAtStart === null),
      arpmCents: delta(arpmNow, arpmPrev, mrrAtStart === null),
      retentionRate,
      churnRate: retentionRate === null ? null : 1 - retentionRate,
      atRiskMembers: atRisk,
      pendingMembers: pending,
      totalMembers: members.length,
      payingMembers: revenue.payingMembers,
      unclassifiedPayingMembers: revenue.unclassifiedPayingMembers,
    },
  };
}

/** The rollup row for a scope on a given day, if one was written. */
async function openingLevels(
  ctx: QueryCtx,
  scope: ViewerScope,
  at: number,
): Promise<{ activeMembers: number; mrrCents: number } | null> {
  const { scopeKind, scopeId } = rollupKeyFor(scope);
  const row = await ctx.db
    .query("insightsDaily")
    .withIndex("by_scope_date", (q) =>
      q.eq("scopeKind", scopeKind).eq("scopeId", scopeId).eq("date", dayKey(at)),
    )
    .first();
  if (!row) return null;
  return { activeMembers: row.activeMembers, mrrCents: row.mrrCents };
}

/** How a scope is keyed in `insightsDaily`. */
export function rollupKeyFor(scope: ViewerScope): {
  scopeKind: "global" | "agency" | "rep";
  scopeId: string;
} {
  switch (scope.kind) {
    case "admin":
      return { scopeKind: "global", scopeId: "" };
    case "partner":
      return { scopeKind: "agency", scopeId: String(scope.partnerId) };
    case "rep":
      return { scopeKind: "rep", scopeId: String(scope.leaderId) };
  }
}

/* ------------------------------------------------------------------ */
/* Exported queries                                                   */
/* ------------------------------------------------------------------ */

/** Headline KPIs for the signed-in viewer over the last N days. */
export const getOverview = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const scope = await resolveViewerScope(ctx);
    const days = Math.min(Math.max(args.days ?? 30, 1), 365);
    const now = Date.now();
    const windowStart = now - days * DAY_MS;

    const { kpis, revenue, truncated } = await computeOverview(ctx, scope, windowStart, now);

    return {
      scope: { kind: scope.kind, label: scopeLabel(scope) },
      windowDays: days,
      kpis,
      /** Revenue mix — employer-billed vs self-pay vs comped. */
      bySource: revenue.bySource,
      dispersal: revenue.dispersal,
      truncated,
    };
  },
});

/**
 * Daily trend series.
 *
 * Historical days come from `insightsDaily`, so the cost is proportional to
 * the number of days rather than the size of the book. Today is computed live
 * and appended, so the chart's right edge is always current.
 */
export const getTrends = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const scope = await resolveViewerScope(ctx);
    const days = Math.min(Math.max(args.days ?? 90, 7), 365);
    const now = Date.now();
    const { scopeKind, scopeId } = rollupKeyFor(scope);
    const since = dayKey(now - days * DAY_MS);
    const today = dayKey(now);

    const rows = await ctx.db
      .query("insightsDaily")
      .withIndex("by_scope_date", (q) =>
        q.eq("scopeKind", scopeKind).eq("scopeId", scopeId).gte("date", since),
      )
      .collect();

    const series = rows
      .filter((r) => r.date !== today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => ({
        date: r.date,
        activeMembers: r.activeMembers,
        newMembers: r.newMembers,
        terminatedMembers: r.terminatedMembers,
        mrrCents: r.mrrCents,
        visits: r.visits,
        cartsCreated: r.cartsCreated,
        cartsCompleted: r.cartsCompleted,
        enrollmentsStarted: r.enrollmentsStarted,
        enrollmentsCompleted: r.enrollmentsCompleted,
      }));

    // Live tail so the chart is current without waiting for tonight's cron.
    // MUST use the same member rule and pricing as rollups.ts, or the chart
    // shows a cliff at today's point where the two definitions meet.
    const { members } = await loadScopedMembers(ctx, scope);
    const primaries = members.filter((m) => m.memberRole !== "dependent");
    const active = primaries.filter((m) => isOnBook(m));
    const bctx = await loadBillingContext(ctx, members);
    const liveRevenue = revenueForMembers(active, bctx);
    const startOfToday = new Date(today + "T00:00:00.000Z").getTime();

    series.push({
      date: today,
      activeMembers: active.length,
      newMembers: primaries.filter((m) => joinedAt(m) >= startOfToday).length,
      terminatedMembers: primaries.filter(
        (m) => typeof m.terminatedAt === "number" && m.terminatedAt >= startOfToday,
      ).length,
      mrrCents: liveRevenue.mrrCents,
      visits: 0,
      cartsCreated: 0,
      cartsCompleted: 0,
      enrollmentsStarted: 0,
      enrollmentsCompleted: 0,
    });

    return {
      scope: { kind: scope.kind, label: scopeLabel(scope) },
      series,
      /** Days before this had no rollup written — the series starts thin. */
      backfilledFrom: series[0]?.date ?? null,
    };
  },
});

/**
 * Estimated partner earnings by closed month.
 *
 * Drawn from the frozen dispersal in `invoicePeriods`, NOT from
 * `commissionPayables` — see the keySpace note in schema.ts for why that
 * ledger is not reportable. These are estimates from the revenue model, not a
 * payout statement, and the UI labels them so.
 */
export const getEarningsByPeriod = query({
  args: { months: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const scope = await resolveViewerScope(ctx);
    const months = Math.min(Math.max(args.months ?? 12, 1), 36);

    const cur = currentPeriod();
    const periods: string[] = [];
    let year = cur.year;
    let month = cur.month;
    for (let i = 0; i < months; i++) {
      periods.push(periodKey(year, month));
      month--;
      if (month < 1) {
        month = 12;
        year--;
      }
    }

    const earnings = await partnerEarningsForPeriods(ctx, scope, periods);

    return {
      scope: { kind: scope.kind, label: scopeLabel(scope) },
      earnings,
      totalPartnerVendorCents: earnings.reduce((s, e) => s + e.partnerVendorCents, 0),
      /** Always true — surfaced so the UI cannot forget to say it. */
      isEstimate: true,
      basis: "Frozen dispersal from closed invoice periods, not a payout statement.",
    };
  },
});

/**
 * How the scope's members are billed, and the health of each mechanism.
 *
 * Was bundle-only, so a list-bill member appeared in no bucket at all and the
 * status counts silently summed to less than the roster.
 */
export const getBundleHealth = query({
  args: {},
  handler: async (ctx) => {
    const scope = await resolveViewerScope(ctx);
    const { members } = await loadScopedMembers(ctx, scope);
    const primaries = members.filter((m) => m.memberRole !== "dependent");
    const bctx = await loadBillingContext(ctx, members);

    const byStatus: Record<string, number> = {};
    const bySource: Record<string, number> = {
      direct: 0, list_bill: 0, comp: 0, none: 0,
    };

    for (const m of primaries) {
      const facts = billingFor(m, bctx);
      bySource[facts.source] += 1;

      if (facts.source === "list_bill") {
        // Their "status" is the employer relationship, not a Stripe state.
        byStatus["employer_billed"] = (byStatus["employer_billed"] ?? 0) + 1;
        continue;
      }
      const bundle = m.customerId ? bctx.bundlesByCustomer.get(m.customerId) : undefined;
      const key = bundle?.status ?? "no_billing_record";
      byStatus[key] = (byStatus[key] ?? 0) + 1;
    }

    return {
      byStatus,
      bySource,
      live: primaries.filter((m) => isOnBook(m)).length,
      exitedMembers: primaries.filter((m) => hasExited(m.memberType)).length,
    };
  },
});
