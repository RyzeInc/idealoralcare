/**
 * RETENTION — cohorts, churn, and MRR movement.
 *
 * All of this rests on `terminatedAt`, which did not exist before this project
 * (see lib/memberLifecycle.ts). Members who left prior to that have a
 * reconstructed timestamp from admin/lifecycleBackfill.ts, whose accuracy
 * varies by source — a Stripe cancellation is exact, an `updatedAt` fallback is
 * only an upper bound. `getRetentionConfidence` reports that mix so a cohort
 * chart is read with the right amount of trust rather than assumed precise.
 *
 * `inactive` counts as churn alongside `terminated`: it means "no active
 * plans", which for a retention curve is the same event. Treating only
 * `terminated` as churn would overstate retention.
 */

import { v } from "convex/values";
import { query } from "../_generated/server";
import { Doc } from "../_generated/dataModel";
import { resolveViewerScope, scopeLabel } from "./scope";
import { loadScopedMembers } from "./book";
import { loadBillingContext, billingFor } from "./revenue";
import { hasExited } from "../lib/memberLifecycle";

/** "YYYY-MM" for a timestamp, UTC. */
function monthKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 7);
}

/** Whole months between two month keys. */
function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

function joinedAt(m: Doc<"memberProfiles">): number {
  return m.enrolledAt ?? m.createdAt;
}

/**
 * Cohort retention grid.
 *
 * Rows are the month a member joined; columns are months since. A cell is the
 * share of that cohort still on the book at that point. Cells beyond the
 * present are null rather than zero — a cohort three months old has no
 * six-month figure, and rendering that as 0% would invent a cliff.
 */
export const getCohortRetention = query({
  args: { months: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const scope = await resolveViewerScope(ctx);
    const months = Math.min(Math.max(args.months ?? 12, 3), 24);
    const now = Date.now();
    const thisMonth = monthKey(now);

    const { members, truncated } = await loadScopedMembers(ctx, scope);
    const primaries = members.filter((m) => m.memberRole !== "dependent");

    // Build the list of cohort months, oldest first.
    const cohortMonths: string[] = [];
    const cursor = new Date(now);
    cursor.setUTCDate(1);
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(cursor);
      d.setUTCMonth(d.getUTCMonth() - i);
      cohortMonths.push(monthKey(d.getTime()));
    }
    const cohortSet = new Set(cohortMonths);

    const byCohort = new Map<string, Doc<"memberProfiles">[]>();
    for (const m of primaries) {
      const key = monthKey(joinedAt(m));
      if (!cohortSet.has(key)) continue;
      const list = byCohort.get(key) ?? [];
      list.push(m);
      byCohort.set(key, list);
    }

    const rows = cohortMonths.map((cohort) => {
      const cohortMembers = byCohort.get(cohort) ?? [];
      const size = cohortMembers.length;
      const elapsed = monthsBetween(cohort, thisMonth);

      const cells: Array<number | null> = [];
      for (let offset = 0; offset < months; offset++) {
        if (offset > elapsed) {
          cells.push(null); // hasn't happened yet
          continue;
        }
        if (size === 0) {
          cells.push(null);
          continue;
        }
        // Still retained at `offset` months means: not exited, or exited later.
        const boundary = new Date(cohort + "-01T00:00:00.000Z");
        boundary.setUTCMonth(boundary.getUTCMonth() + offset + 1);
        const boundaryMs = boundary.getTime();

        const retained = cohortMembers.filter((m) => {
          if (!hasExited(m.memberType)) return true;
          if (typeof m.terminatedAt !== "number") return false;
          return m.terminatedAt >= boundaryMs;
        }).length;

        cells.push(retained / size);
      }

      return { cohort, size, cells };
    });

    return {
      scope: { kind: scope.kind, label: scopeLabel(scope) },
      months,
      cohorts: rows,
      truncated,
    };
  },
});

/** Monthly churn, split by kind so a list-bill exit is not read as a loss. */
export const getChurn = query({
  args: { months: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const scope = await resolveViewerScope(ctx);
    const months = Math.min(Math.max(args.months ?? 12, 1), 36);
    const now = Date.now();

    const { members } = await loadScopedMembers(ctx, scope);
    const primaries = members.filter((m) => m.memberRole !== "dependent");
    const bctx = await loadBillingContext(ctx, members);

    const monthKeys: string[] = [];
    const cursor = new Date(now);
    cursor.setUTCDate(1);
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(cursor);
      d.setUTCMonth(d.getUTCMonth() - i);
      monthKeys.push(monthKey(d.getTime()));
    }

    const series = monthKeys.map((mk) => {
      const start = new Date(mk + "-01T00:00:00.000Z").getTime();
      const endD = new Date(start);
      endD.setUTCMonth(endD.getUTCMonth() + 1);
      const end = endD.getTime();

      const joined = primaries.filter((m) => {
        const j = joinedAt(m);
        return j >= start && j < end;
      });
      const churned = primaries.filter(
        (m) => typeof m.terminatedAt === "number" && m.terminatedAt >= start && m.terminatedAt < end,
      );

      // At risk of being read wrong: a member who moved off payroll deduction
      // is usually converting to direct pay, not leaving.
      const listBillExits = churned.filter((m) => m.listBillStatus === "termed").length;

      // Everyone on the book at the start of the month.
      const atStart = primaries.filter((m) => {
        if (joinedAt(m) >= start) return false;
        if (typeof m.terminatedAt === "number" && m.terminatedAt < start) return false;
        return true;
      });

      // A departing list-bill member is a real revenue loss at the employer's
      // contracted rate; this previously recorded $0 for all of them.
      const churnedMrr = churned.reduce(
        (sum, m) => sum + billingFor(m, bctx).mrrCents,
        0,
      );

      return {
        month: mk,
        openingMembers: atStart.length,
        newMembers: joined.length,
        churnedMembers: churned.length,
        listBillExits,
        trueChurn: churned.length - listBillExits,
        churnRate: atStart.length > 0 ? churned.length / atStart.length : null,
        churnedMrrCents: churnedMrr,
        netChange: joined.length - churned.length,
      };
    });

    const reasons = new Map<string, number>();
    for (const m of primaries) {
      if (!hasExited(m.memberType)) continue;
      // Employer-billed departures have no Stripe cancellation reason; lumping
      // them into "(not recorded)" let them dominate the chart and mask the
      // real reasons among self-pay members.
      let reason: string;
      if (m.listBillStatus === "termed") {
        reason = "Left employer coverage";
      } else {
        const b = m.customerId ? bctx.bundlesByCustomer.get(m.customerId) : undefined;
        reason = b?.cancellationReason ?? "(not recorded)";
      }
      reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
    }

    return {
      scope: { kind: scope.kind, label: scopeLabel(scope) },
      series,
      cancellationReasons: [...reasons]
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count),
    };
  },
});

/**
 * MRR movement: where this month's revenue change came from.
 *
 * Expansion and contraction are read from `bundleTierHistory`, which records
 * every upgrade and downgrade with an effective window — the only place a tier
 * change leaves a trace once the bundle's current snapshot has moved on.
 *
 * KNOWN GAP: a list-bill household changing tier (a member adding a spouse,
 * moving MO -> MS) is a real expansion but writes no `bundleTierHistory` row,
 * because employer-billed members have no bundle. Their tier is recomputed
 * from the household at each invoice, leaving no event to read. Expansion and
 * contraction below therefore cover self-pay members only; new and churned
 * cover everyone. Closing this needs a household-change event at the source.
 */
export const getMrrMovement = query({
  args: { months: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const scope = await resolveViewerScope(ctx);
    const months = Math.min(Math.max(args.months ?? 6, 1), 24);
    const now = Date.now();

    const { members } = await loadScopedMembers(ctx, scope);
    const primaries = members.filter((m) => m.memberRole !== "dependent");
    const bctx = await loadBillingContext(ctx, members);
    const scopedBundleIds = new Set(
      [...bctx.bundlesByCustomer.values()].map((b) => String(b._id)),
    );

    const tierHistory = await ctx.db.query("bundleTierHistory").collect();
    const scopedHistory = tierHistory.filter((h) => scopedBundleIds.has(String(h.bundleId)));

    const monthKeys: string[] = [];
    const cursor = new Date(now);
    cursor.setUTCDate(1);
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(cursor);
      d.setUTCMonth(d.getUTCMonth() - i);
      monthKeys.push(monthKey(d.getTime()));
    }

    return {
      scope: { kind: scope.kind, label: scopeLabel(scope) },
      series: monthKeys.map((mk) => {
        const start = new Date(mk + "-01T00:00:00.000Z").getTime();
        const endD = new Date(start);
        endD.setUTCMonth(endD.getUTCMonth() + 1);
        const end = endD.getTime();

        let newMrr = 0;
        let churnedMrr = 0;
        for (const m of primaries) {
          // Priced through the shared resolver, so an employer-billed member
          // contributes their contracted rate rather than nothing.
          const mrr = billingFor(m, bctx).mrrCents;
          if (mrr <= 0) continue;
          const j = joinedAt(m);
          if (j >= start && j < end) newMrr += mrr;
          if (typeof m.terminatedAt === "number" && m.terminatedAt >= start && m.terminatedAt < end) {
            churnedMrr += mrr;
          }
        }

        let expansion = 0;
        let contraction = 0;
        for (const h of scopedHistory) {
          if (h.effectiveFrom < start || h.effectiveFrom >= end) continue;
          if (h.reason === "upgrade") expansion += h.totalCents;
          else if (h.reason === "downgrade") contraction += h.totalCents;
        }

        return {
          month: mk,
          newMrrCents: newMrr,
          expansionMrrCents: expansion,
          contractionMrrCents: -contraction,
          churnedMrrCents: -churnedMrr,
          netMrrCents: newMrr + expansion - contraction - churnedMrr,
        };
      }),
    };
  },
});

/**
 * How much of the retention data is measured versus reconstructed.
 *
 * Surfaced next to every cohort chart. A grid built mostly on
 * `updated_at_fallback` is directionally useful and precisely wrong, and the
 * reader deserves to know which they are looking at.
 */
export const getRetentionConfidence = query({
  args: {},
  handler: async (ctx) => {
    const scope = await resolveViewerScope(ctx);
    const { members } = await loadScopedMembers(ctx, scope);
    const primaries = members.filter((m) => m.memberRole !== "dependent");

    const exited = primaries.filter((m) => hasExited(m.memberType));
    const withTimestamp = exited.filter((m) => typeof m.terminatedAt === "number");

    return {
      scope: { kind: scope.kind, label: scopeLabel(scope) },
      totalMembers: primaries.length,
      exitedMembers: exited.length,
      exitedWithTimestamp: withTimestamp.length,
      exitedMissingTimestamp: exited.length - withTimestamp.length,
      /** Cohorts are unreliable while this is non-zero. */
      complete: exited.length === withTimestamp.length,
    };
  },
});
