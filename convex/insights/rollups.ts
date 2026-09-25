/**
 * DAILY ROLLUPS — what keeps the dashboard fast as the book grows.
 *
 * A trend chart asking "active members per day for 90 days" would otherwise
 * re-derive the whole book 90 times. Instead one nightly pass writes a row per
 * (scope, day) and charts read those: cost proportional to DAYS, not MEMBERS.
 * This is the specific mechanism that keeps every insights query inside
 * Convex's ~16k document read limit permanently.
 *
 * Today's numbers are never read from here — `metrics.getTrends` computes the
 * live tail and appends it — so a missed cron shows as a gap in history rather
 * than a stale headline figure.
 *
 * Idempotent per (scopeKind, scopeId, date): re-running patches the existing
 * row rather than inserting a duplicate, so a retry or a manual backfill is
 * always safe.
 */

import { v } from "convex/values";
import { internalMutation, mutation, MutationCtx } from "../_generated/server";
import { Doc } from "../_generated/dataModel";
import { requireStaffAdmin } from "../lib/authGuards";
import { loadBillingContext, billingFor } from "./revenue";
import { classifyTier } from "../lib/dispersal";
import { isOnBook } from "../lib/memberBilling";

const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function startOfDayUtc(dateKey: string): number {
  return new Date(dateKey + "T00:00:00.000Z").getTime();
}

interface Accum {
  activeMembers: number;
  billableMembers: number;
  newMembers: number;
  terminatedMembers: number;
  mrrCents: number;
  mrrCentsDirect: number;
  mrrCentsListBill: number;
  visits: number;
  cartsCreated: number;
  cartsCompleted: number;
  enrollmentsStarted: number;
  enrollmentsCompleted: number;
}

const emptyAccum = (): Accum => ({
  activeMembers: 0,
  billableMembers: 0,
  newMembers: 0,
  terminatedMembers: 0,
  mrrCents: 0,
  mrrCentsDirect: 0,
  mrrCentsListBill: 0,
  visits: 0,
  cartsCreated: 0,
  cartsCompleted: 0,
  enrollmentsStarted: 0,
  enrollmentsCompleted: 0,
});

/**
 * Compute and persist rollups for one UTC day, for every scope at once.
 *
 * Doing all scopes in a single pass is deliberate: the alternative — a query
 * per agency per day — would re-read the member table once per partner, which
 * is precisely the cost this table exists to avoid.
 */
async function writeRollupsForDay(ctx: MutationCtx, dateKey: string) {
  const dayStart = startOfDayUtc(dateKey);
  const dayEnd = dayStart + DAY_MS;

  const [members, leaders] = await Promise.all([
    ctx.db.query("memberProfiles").collect(),
    ctx.db.query("partnerLeaders").collect(),
  ]);

  // rep id -> agency id, so a rep's activity also credits their agency.
  const agencyForRep = new Map<string, string>();
  for (const l of leaders) agencyForRep.set(String(l._id), String(l.partnerId));

  // Full billing context — bundles, groups, accounts, households — so
  // employer-billed members are priced identically to the live path. Reading
  // only bundles here is what made every persisted mrrCents understate by the
  // entire list-bill book.
  const bctx = await loadBillingContext(ctx, members);

  const global = emptyAccum();
  const byAgency = new Map<string, Accum>();
  const byRep = new Map<string, Accum>();

  const bump = (m: Doc<"memberProfiles">, fn: (a: Accum) => void) => {
    fn(global);
    const agencyId =
      m.attributedAgencyId ??
      (m.attributedRepId ? agencyForRep.get(m.attributedRepId) : undefined);
    if (agencyId) {
      const a = byAgency.get(agencyId) ?? emptyAccum();
      fn(a);
      byAgency.set(agencyId, a);
    }
    if (m.attributedRepId) {
      const r = byRep.get(m.attributedRepId) ?? emptyAccum();
      fn(r);
      byRep.set(m.attributedRepId, r);
    }
  };

  for (const m of members) {
    if (m.memberRole === "dependent") continue;
    const joined = m.enrolledAt ?? m.createdAt;

    // Point-in-time: on the book at the END of this day.
    const joinedByThen = joined < dayEnd;
    const goneByThen = typeof m.terminatedAt === "number" && m.terminatedAt < dayEnd;
    if (joinedByThen && !goneByThen) {
      // Uses the same predicate as metrics.ts. These two disagreeing — the
      // rollup counting everyone, the live path counting only "active" — is
      // what produced fabricated deltas and a cliff at today's chart point.
      const onBook = isOnBook(m);
      bump(m, (a) => {
        a.activeMembers += 1;
        if (onBook) a.billableMembers += 1;
      });

      if (onBook) {
        const facts = billingFor(m, bctx);
        if (facts.mrrCents > 0) {
          bump(m, (a) => {
            a.mrrCents += facts.mrrCents;
            if (facts.source === "list_bill") a.mrrCentsListBill += facts.mrrCents;
            else a.mrrCentsDirect += facts.mrrCents;
          });
        }
      }
    }

    if (joined >= dayStart && joined < dayEnd) {
      bump(m, (a) => { a.newMembers += 1; });
    }
    if (typeof m.terminatedAt === "number" && m.terminatedAt >= dayStart && m.terminatedAt < dayEnd) {
      bump(m, (a) => { a.terminatedMembers += 1; });
    }
  }

  // Funnel counters, attributed through the enrollment session's broker.
  const sessions = await ctx.db
    .query("enrollmentSessions")
    .withIndex("by_created", (q) => q.gte("createdAt", dayStart))
    .collect();
  for (const s of sessions) {
    if (s.createdAt >= dayEnd) continue;
    const repId = s.brokerId ?? undefined;
    const agencyId = s.agencyId ?? (repId ? agencyForRep.get(repId) : undefined);
    const targets: Accum[] = [global];
    if (agencyId) {
      const a = byAgency.get(agencyId) ?? emptyAccum();
      byAgency.set(agencyId, a);
      targets.push(a);
    }
    if (repId) {
      const r = byRep.get(repId) ?? emptyAccum();
      byRep.set(repId, r);
      targets.push(r);
    }
    for (const t of targets) {
      t.enrollmentsStarted += 1;
      if (s.status === "completed") t.enrollmentsCompleted += 1;
    }
  }

  // Visits, attributed by code.
  const codes = await ctx.db.query("brokerTrackingCodes").collect();
  for (const code of codes) {
    const visits = await ctx.db
      .query("repLinkVisits")
      .withIndex("by_code_created", (q) =>
        q.eq("code", code.code).gte("createdAt", dayStart),
      )
      .collect();
    const human = visits.filter((v2: Doc<"repLinkVisits">) => v2.createdAt < dayEnd && !v2.isBot).length;
    if (human === 0) continue;

    global.visits += human;
    const agencyId = code.agencyId ?? agencyForRep.get(code.brokerId);
    if (agencyId) {
      const a = byAgency.get(agencyId) ?? emptyAccum();
      a.visits += human;
      byAgency.set(agencyId, a);
    }
    const r = byRep.get(code.brokerId) ?? emptyAccum();
    r.visits += human;
    byRep.set(code.brokerId, r);
  }

  // Carts are global only — cartSessions carries no broker attribution.
  const carts = await ctx.db.query("cartSessions").collect();
  for (const c of carts) {
    if (c.createdAt >= dayStart && c.createdAt < dayEnd) global.cartsCreated += 1;
    if (c.completedAt && c.completedAt >= dayStart && c.completedAt < dayEnd) {
      global.cartsCompleted += 1;
    }
  }

  // Persist. Upsert so a re-run corrects rather than duplicates.
  const now = Date.now();
  const upsert = async (
    scopeKind: "global" | "agency" | "rep",
    scopeId: string,
    a: Accum,
  ) => {
    const existing = await ctx.db
      .query("insightsDaily")
      .withIndex("by_scope_date", (q) =>
        q.eq("scopeKind", scopeKind).eq("scopeId", scopeId).eq("date", dateKey),
      )
      .first();
    const row = { scopeKind, scopeId, date: dateKey, ...a, computedAt: now };
    if (existing) await ctx.db.patch(existing._id, row);
    else await ctx.db.insert("insightsDaily", row);
  };

  await upsert("global", "", global);
  for (const [agencyId, a] of byAgency) await upsert("agency", agencyId, a);
  for (const [repId, a] of byRep) await upsert("rep", repId, a);

  return {
    date: dateKey,
    scopesWritten: 1 + byAgency.size + byRep.size,
    agencies: byAgency.size,
    reps: byRep.size,
    activeMembers: global.activeMembers,
    mrrCents: global.mrrCents,
  };
}

/** Nightly cron entry point — rolls up yesterday, which is now complete. */
export const rollupYesterday = internalMutation({
  args: {},
  handler: async (ctx) => {
    return await writeRollupsForDay(ctx, dayKey(Date.now() - DAY_MS));
  },
});

/** Roll up one specific day. Admin-triggered; used to fill gaps. */
export const rollupDay = mutation({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    await requireStaffAdmin(ctx);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) {
      throw new Error(`rollupDay: expected YYYY-MM-DD, got "${args.date}"`);
    }
    return await writeRollupsForDay(ctx, args.date);
  },
});

/**
 * Backfill history, one day per call.
 *
 * Deliberately not a loop over N days in a single mutation: each day reads the
 * whole member table, so batching them would blow the transaction limit on any
 * real book. The caller advances `daysAgo` and gets a progress report back.
 */
export const backfillRollupDay = mutation({
  args: { daysAgo: v.number() },
  handler: async (ctx, args) => {
    await requireStaffAdmin(ctx);
    const daysAgo = Math.max(0, Math.min(Math.floor(args.daysAgo), 730));
    const result = await writeRollupsForDay(ctx, dayKey(Date.now() - daysAgo * DAY_MS));
    return { ...result, daysAgo, nextDaysAgo: daysAgo > 0 ? daysAgo - 1 : null };
  },
});

/**
 * Live dispersal snapshot for the whole book. Used by the admin health panel
 * to spot the annual-plan gap (see admin/revenueHealth.ts).
 */
export const getRollupHealth = mutation({
  args: {},
  handler: async (ctx) => {
    await requireStaffAdmin(ctx);
    const rows = await ctx.db.query("insightsDaily").withIndex("by_date").order("desc").take(1);
    const bundles = await ctx.db
      .query("subscriptionBundles")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    const unclassified = bundles.filter(
      (b) => classifyTier(b.pricingSnapshot?.totalCents) === "none" &&
        (b.pricingSnapshot?.totalCents ?? 0) > 0,
    ).length;

    // Rows written before list-bill support carry no split. They are not
    // wrong about their combined total being understated — they simply cannot
    // say by how much, which is what makes a backfill necessary rather than
    // optional.
    const staleSplitRows = await ctx.db
      .query("insightsDaily")
      .withIndex("by_date")
      .order("desc")
      .take(400);
    const missingSplit = staleSplitRows.filter(
      (r) => r.mrrCentsListBill === undefined,
    ).length;

    return {
      latestRollupDate: rows[0]?.date ?? null,
      latestComputedAt: rows[0]?.computedAt ?? null,
      staleDays: rows[0]
        ? Math.floor((Date.now() - startOfDayUtc(rows[0].date)) / DAY_MS)
        : null,
      unclassifiedPaidBundles: unclassified,
      /** Sampled recent rows still lacking a direct/list-bill split. */
      rowsMissingBillingSplit: missingSplit,
      rowsSampled: staleSplitRows.length,
    };
  },
});
