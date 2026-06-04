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

/** Get broker commission summaries joined with reps (partnerLeaders) and agencies */
export const getBrokerCommissions = query({
  handler: async (ctx) => {
    const [rates, leaders, partners, payables] = await Promise.all([
      ctx.db.query("commissionRates").collect(),
      ctx.db.query("partnerLeaders").collect(),
      ctx.db.query("distributionPartners").collect(),
      ctx.db.query("commissionPayables").collect(),
    ]);

    // Clerk-free joins: rate.brokerId = partnerLeaders._id, rate.agencyId = distributionPartners._id
    const leaderById = new Map(leaders.map((l: any) => [l._id, l]));
    const partnerById = new Map(partners.map((p: any) => [p._id, p]));

    const activeRates = rates.filter((r: any) => r.status === "active");
    return activeRates.map((rate: any) => {
      const leader = leaderById.get(rate.brokerId);
      const partner =
        partnerById.get(rate.agencyId) ??
        (leader?.partnerId ? partnerById.get(leader.partnerId) : undefined);
      const brokerPayables = payables.filter((p: any) => p.brokerId === rate.brokerId);
      const pending = brokerPayables.filter((p: any) => p.status === "pending");
      const paid = brokerPayables.filter((p: any) => p.status === "paid");
      const activeEnrollments = brokerPayables.length;
      const pendingAmountCents = pending.reduce((sum: number, p: any) => sum + (p.amountCents ?? 0), 0);
      const calculatedPayout = activeEnrollments * (rate.ratePercentage / 100) * 1500; // $15/member

      return {
        brokerId: rate.brokerId,
        brokerName: leader?.name ?? rate.brokerId,
        partnerName: partner?.name ?? "Independent",
        commissionRate: rate.ratePercentage,
        overrideRate: rate.overridePercentage,
        activeEnrollments,
        pendingAmountCents,
        paidCount: paid.length,
        calculatedPayout,
        status: pending.length > 0 ? "pending" : "paid",
        _id: rate._id,
      };
    });
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
