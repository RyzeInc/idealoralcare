import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "../lib/authGuards";

/**
 * COMMISSION MANAGEMENT
 * Full CRUD against the commissionRates and commissionPayables tables.
 */

/** All commission rates */
export const getAllRates = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("commissionRates").collect();
  },
});

/** Active rates for a specific broker */
export const getRatesForBroker = query({
  args: { brokerId: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("commissionRates")
      .withIndex("by_broker", (q) => q.eq("brokerId", args.brokerId))
      .collect();
  },
});

/** Create or update a commission rate for a broker */
export const upsertRate = mutation({
  args: {
    brokerId: v.string(),
    agencyId: v.optional(v.string()),
    siteId: v.optional(v.id("sites")),
    groupId: v.optional(v.id("groups")),
    ratePercentage: v.number(),
    overridePercentage: v.optional(v.number()),
    effectiveFrom: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const identity = await ctx.auth.getUserIdentity();
    const existing = await ctx.db
      .query("commissionRates")
      .withIndex("by_broker", (q) => q.eq("brokerId", args.brokerId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ratePercentage: args.ratePercentage,
        overridePercentage: args.overridePercentage,
        updatedAt: Date.now(),
      });
      return existing._id;
    } else {
      return await ctx.db.insert("commissionRates", {
        brokerId: args.brokerId,
        agencyId: args.agencyId,
        siteId: args.siteId,
        groupId: args.groupId,
        ratePercentage: args.ratePercentage,
        overridePercentage: args.overridePercentage,
        effectiveFrom: args.effectiveFrom ?? Date.now(),
        status: "active",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: identity?.subject,
      });
    }
  },
});

/** Deactivate a commission rate */
export const deactivateRate = mutation({
  args: { id: v.id("commissionRates") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.id, { status: "inactive", updatedAt: Date.now() });
  },
});

/** All commission payables (optionally filtered to a period) */
export const getAllPayables = query({
  args: {
    brokerId: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("commissionPayables").collect();
    return all.filter((p: any) => {
      if (args.brokerId && p.brokerId !== args.brokerId) return false;
      if (args.status && p.status !== args.status) return false;
      return true;
    });
  },
});

/**
 * A payable is only reportable if it was written in the current key space.
 *
 * Legacy rows hold a tracking-code string in `brokerId` and a hardcoded 15%
 * rate, so they neither join to `partnerLeaders` nor reflect a contracted
 * rate. Counting them would produce confidently wrong money. They are
 * surfaced as a `quarantined` count instead of being silently dropped.
 */
function isReportablePayable(p: { keySpace?: string }): boolean {
  return p.keySpace === "leader_id";
}

/**
 * Broker commission summaries joined to their rep and agency.
 *
 * Previously this summed `p.amountCents` (a field that does not exist, so
 * every total read 0), divided an already-decimal `ratePercentage` by 100
 * again, multiplied by a hardcoded $15, and joined `rate.brokerId` — a
 * `partnerLeaders._id` — against `distributionPartners.clerkUserId`, which
 * never matches. Totals now come from the payables themselves.
 */
export const getBrokerCommissions = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const [rates, partners, leaders, payables] = await Promise.all([
      ctx.db.query("commissionRates").collect(),
      ctx.db.query("distributionPartners").collect(),
      ctx.db.query("partnerLeaders").collect(),
      ctx.db.query("commissionPayables").collect(),
    ]);

    const leaderById = new Map(leaders.map((l) => [String(l._id), l]));
    const partnerById = new Map(partners.map((p) => [String(p._id), p]));

    const payablesByBroker = new Map<string, typeof payables>();
    for (const p of payables) {
      if (!p.brokerId) continue;
      const list = payablesByBroker.get(p.brokerId) ?? [];
      list.push(p);
      payablesByBroker.set(p.brokerId, list);
    }

    const activeRates = rates.filter((r) => r.status === "active");
    return activeRates.map((rate) => {
      const leader = leaderById.get(rate.brokerId);
      const agency = leader
        ? partnerById.get(String(leader.partnerId))
        : rate.agencyId
        ? partnerById.get(rate.agencyId)
        : undefined;

      const all = payablesByBroker.get(rate.brokerId) ?? [];
      const reportable = all.filter(isReportablePayable);
      const quarantined = all.length - reportable.length;

      const sum = (rows: typeof reportable) =>
        rows.reduce((total, p) => total + (p.amount ?? 0), 0);
      const pending = reportable.filter((p) => p.status === "pending");
      const approved = reportable.filter((p) => p.status === "approved");
      const paid = reportable.filter((p) => p.status === "paid");

      return {
        _id: rate._id,
        brokerId: rate.brokerId,
        brokerName: leader?.name ?? rate.brokerId,
        partnerName: agency?.name ?? "Independent",
        // Stored as a decimal (0.25 = 25%); expose both so callers cannot
        // guess wrong about the unit.
        commissionRate: rate.ratePercentage,
        commissionRatePercent: rate.ratePercentage * 100,
        overrideRate: rate.overridePercentage,
        activeEnrollments: reportable.length,
        pendingCount: pending.length,
        pendingAmountCents: sum(pending),
        approvedAmountCents: sum(approved),
        paidCount: paid.length,
        paidAmountCents: sum(paid),
        totalEarnedCents: sum(reportable),
        /** Pre-repair rows excluded from every total above. */
        quarantinedCount: quarantined,
        status: pending.length > 0 ? "pending" : "paid",
      };
    });
  },
});

/**
 * How much of the commission ledger is trustworthy.
 *
 * Read this before presenting any commission figure: a ledger that is mostly
 * `quarantined` is not a report, it is a backlog.
 */
export const getCommissionLedgerHealth = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const payables = await ctx.db.query("commissionPayables").collect();

    let reportable = 0;
    let quarantined = 0;
    let reportableCents = 0;
    let quarantinedCents = 0;

    for (const p of payables) {
      if (isReportablePayable(p)) {
        reportable++;
        reportableCents += p.amount ?? 0;
      } else {
        quarantined++;
        quarantinedCents += p.amount ?? 0;
      }
    }

    return {
      total: payables.length,
      reportable,
      quarantined,
      reportableCents,
      /** Not included in any total — shown so the backlog is visible. */
      quarantinedCents,
    };
  },
});

/** Mark payables as paid */
export const markAsPaid = mutation({
  args: {
    payableIds: v.array(v.id("commissionPayables")),
    paymentNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    for (const id of args.payableIds) {
      await ctx.db.patch(id, {
        status: "paid",
        paidAt: Date.now(),
        notes: args.paymentNote,
      } as any);
    }
    return { updated: args.payableIds.length };
  },
});

/** Pending commissions for export */
export const getPendingCommissions = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("commissionPayables")
      .filter((q: any) => q.eq(q.field("status"), "pending"))
      .collect();
  },
});

/** Get commissions for a single broker */
export const getCommissionsByBroker = query({
  args: { brokerId: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const records = await ctx.db
      .query("commissionPayables")
      .filter((q: any) => q.eq(q.field("brokerId"), args.brokerId))
      .collect();
    return { brokerId: args.brokerId, records };
  },
});
