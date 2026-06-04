/**
 * COMMISSION MANAGEMENT MUTATIONS & QUERIES
 *
 * Handles broker commission rates and payables tracking
 */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";

/**
 * Create or update a commission rate for a broker
 */
export const setCommissionRate = mutation({
  args: {
    brokerId: v.string(),
    agencyId: v.optional(v.string()),
    siteId: v.optional(v.id("sites")),
    ratePercentage: v.number(),
    overridePercentage: v.optional(v.number()),
    effectiveFrom: v.number(),
    effectiveTo: v.optional(v.number()),
    status: v.union(v.literal("active"), v.literal("inactive"), v.literal("archived")),
  },
  handler: async (ctx, args) => {
    // Check if rate already exists and is active
    const existing = await ctx.db
      .query("commissionRates")
      .filter(
        (q) =>
          q.and(
            q.eq(q.field("brokerId"), args.brokerId),
            q.eq(q.field("status"), "active")
          )
      )
      .first();

    // If updating existing active rate, deactivate it
    if (existing) {
      await ctx.db.patch(existing._id, { status: "inactive" });
    }

    // Create new rate
    const rateId = await ctx.db.insert("commissionRates", {
      brokerId: args.brokerId,
      agencyId: args.agencyId,
      siteId: args.siteId,
      ratePercentage: args.ratePercentage,
      overridePercentage: args.overridePercentage,
      effectiveFrom: args.effectiveFrom,
      effectiveTo: args.effectiveTo,
      status: args.status,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: (await ctx.auth.getUserIdentity())?.tokenIdentifier || "system",
    });

    return await ctx.db.get(rateId);
  },
});

/**
 * Get active commission rate for a broker
 */
export const getActiveBrokerRate = query({
  args: {
    brokerId: v.string(),
    siteId: v.optional(v.id("sites")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Try site-specific rate first if provided
    if (args.siteId) {
      const siteSpecific = await ctx.db
        .query("commissionRates")
        .filter(
          (q) =>
            q.and(
              q.eq(q.field("brokerId"), args.brokerId),
              q.eq(q.field("siteId"), args.siteId),
              q.eq(q.field("status"), "active"),
              q.lte(q.field("effectiveFrom"), now)
            )
        )
        .first();

      if (siteSpecific) {
        // Check if still within valid range
        if (!siteSpecific.effectiveTo || siteSpecific.effectiveTo > now) {
          return siteSpecific;
        }
      }
    }

    // Fall back to global rate (no siteId)
    const global = await ctx.db
      .query("commissionRates")
      .filter(
        (q) =>
          q.and(
            q.eq(q.field("brokerId"), args.brokerId),
            q.eq(q.field("siteId"), undefined),
            q.eq(q.field("status"), "active"),
            q.lte(q.field("effectiveFrom"), now)
          )
      )
      .first();

    if (global && (!global.effectiveTo || global.effectiveTo > now)) {
      return global;
    }

    return null;
  },
});

/**
 * Record a commission payable.
 * Clerk-free identity: brokerId = partnerLeaders._id, agencyId = distributionPartners._id.
 */
export const createCommissionPayable = mutation({
  args: {
    brokerId: v.string(), // partnerLeaders._id of the rep
    agencyId: v.optional(v.string()), // distributionPartners._id of the agency
    enrollmentSessionId: v.optional(v.id("enrollmentSessions")),
    memberId: v.optional(v.id("memberProfiles")),
    rateApplied: v.number(),
    overrideApplied: v.optional(v.number()),
    amount: v.number(), // Cents
    period: v.string(), // "2026-03"
  },
  handler: async (ctx, args) => {
    const payableId = await ctx.db.insert("commissionPayables", {
      brokerId: args.brokerId,
      agencyId: args.agencyId,
      enrollmentSessionId: args.enrollmentSessionId,
      memberId: args.memberId,
      rateApplied: args.rateApplied,
      overrideApplied: args.overrideApplied,
      amount: args.amount,
      period: args.period,
      status: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return await ctx.db.get(payableId);
  },
});

/**
 * Update commission payable status
 */
export const updateCommissionPayableStatus = mutation({
  args: {
    payableId: v.id("commissionPayables"),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("paid"),
      v.literal("disputed"),
      v.literal("voided")
    ),
    paidAt: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.payableId, {
      status: args.status,
      paidAt: args.paidAt,
      notes: args.notes,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(args.payableId);
  },
});

/**
 * Get all pending commissions for a broker
 */
export const getBrokerPendingCommissions = query({
  args: {
    brokerId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("commissionPayables")
      .filter((q) => q.eq(q.field("brokerId"), args.brokerId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();
  },
});

/**
 * Get commissions by period (for payroll)
 */
export const getCommissionsByPeriod = query({
  args: {
    period: v.string(), // "2026-03"
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("paid"),
        v.literal("disputed"),
        v.literal("voided")
      )
    ),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("commissionPayables")
      .filter((q) => q.eq(q.field("period"), args.period));

    if (args.status) {
      query = query.filter((q) => q.eq(q.field("status"), args.status));
    }

    return await query.collect();
  },
});

/**
 * Calculate total commissions for a broker in a period
 */
export const calculateBrokerCommissionsForPeriod = query({
  args: {
    brokerId: v.string(),
    period: v.string(), // "2026-03"
    statusFilter: v.optional(v.array(v.string())), // e.g., ["approved", "paid"]
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("commissionPayables")
      .filter((q) => q.eq(q.field("brokerId"), args.brokerId))
      .filter((q) => q.eq(q.field("period"), args.period));

    const payables = await query.collect();

    let filtered = payables;
    if (args.statusFilter && args.statusFilter.length > 0) {
      filtered = payables.filter((p) => args.statusFilter!.includes(p.status));
    }

    const total = filtered.reduce((sum, p) => sum + p.amount, 0);

    return {
      brokerId: args.brokerId,
      period: args.period,
      count: filtered.length,
      totalCents: total,
      totalDollars: (total / 100).toFixed(2),
      payables: filtered,
    };
  },
});

/**
 * Get commissions by agency for rollup/reporting
 */
export const getAgencyCommissions = query({
  args: {
    agencyId: v.string(),
    period: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("commissionPayables")
      .filter((q) => q.eq(q.field("agencyId"), args.agencyId));

    if (args.period) {
      query = query.filter((q) => q.eq(q.field("period"), args.period));
    }

    const payables = await query.collect();

    const total = payables.reduce((sum, p) => sum + p.amount, 0);

    return {
      agencyId: args.agencyId,
      period: args.period,
      brokerCount: new Set(payables.map((p) => p.brokerId)).size,
      payableCount: payables.length,
      totalCents: total,
      totalDollars: (total / 100).toFixed(2),
    };
  },
});
