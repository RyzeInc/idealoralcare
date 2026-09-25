/**
 * COMMISSION MANAGEMENT MUTATIONS & QUERIES
 *
 * Handles broker commission rates and payables tracking
 */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "../_generated/dataModel";
import { QueryCtx, MutationCtx } from "../_generated/server";
import { resolveBrokerKey } from "../lib/brokerResolve";
import { requireAdmin } from "../lib/authGuards";

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
    await requireAdmin(ctx);
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
    await requireAdmin(ctx);
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
    await requireAdmin(ctx);
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
    await requireAdmin(ctx);
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
    await requireAdmin(ctx);
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
    await requireAdmin(ctx);
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
    await requireAdmin(ctx);
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
    await requireAdmin(ctx);
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


/* ------------------------------------------------------------------ */
/* CONTRACTED RATE RESOLUTION                                         */
/* ------------------------------------------------------------------ */

/**
 * Find the commission rate that actually applies to a sale.
 *
 * Most specific wins: a rate pinned to the group (a negotiated employer deal)
 * beats one pinned to the site, which beats the broker's global rate. Only
 * active rows whose effective window contains `at` are eligible.
 *
 * `ratePercentage` is stored as a DECIMAL (0.25 means 25%) — see schema.ts.
 * Anything that divides it by 100 again is double-discounting.
 */
export async function resolveCommissionRate(
  ctx: QueryCtx | MutationCtx,
  args: {
    brokerId: string;
    siteId?: Id<"sites"> | null;
    groupId?: Id<"groups"> | null;
    at?: number;
  },
): Promise<Doc<"commissionRates"> | null> {
  const at = args.at ?? Date.now();

  const candidates = await ctx.db
    .query("commissionRates")
    .withIndex("by_broker", (q) => q.eq("brokerId", args.brokerId))
    .collect();

  const eligible = candidates.filter(
    (r) =>
      r.status === "active" &&
      r.effectiveFrom <= at &&
      (r.effectiveTo === undefined || r.effectiveTo > at),
  );
  if (eligible.length === 0) return null;

  const specificity = (r: Doc<"commissionRates">): number => {
    if (args.groupId && r.groupId === args.groupId) return 3;
    if (args.siteId && r.siteId === args.siteId) return 2;
    if (!r.groupId && !r.siteId) return 1;
    return 0; // pinned to a different group/site — not applicable
  };

  const applicable = eligible
    .map((r) => ({ r, score: specificity(r) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.r.effectiveFrom - a.r.effectiveFrom);

  return applicable[0]?.r ?? null;
}

/* ------------------------------------------------------------------ */
/* CHECKOUT COMMISSION                                                */
/* ------------------------------------------------------------------ */

export type CommissionSkipReason =
  | "no_broker_supplied"
  | "broker_unresolvable"
  | "no_rate_configured"
  | "already_recorded";

/**
 * Record the commission for a completed checkout.
 *
 * This replaces the webhook's previous inline insert, which wrote the raw rep
 * CODE string into `brokerId` and hardcoded a 15% rate. Both are fixed here:
 * the broker value is resolved to a `partnerLeaders._id` by lookup, and the
 * rate comes from `commissionRates`.
 *
 * When we cannot determine a real rate we record NOTHING and say why, rather
 * than inventing a number. The enrollment is still attributed via
 * `enrollmentSessions` and the member's attribution stamp, so a payable can be
 * generated later once a rate exists — no information is lost by declining to
 * guess.
 */
export const recordCommissionForCheckout = mutation({
  args: {
    /** A rep id, tracking code, or Clerk user ID — resolved by lookup. */
    brokerValue: v.optional(v.string()),
    enrollmentSessionId: v.optional(v.id("enrollmentSessions")),
    memberId: v.optional(v.id("memberProfiles")),
    groupId: v.optional(v.id("groups")),
    siteId: v.optional(v.id("sites")),
    /** Amount actually charged, in cents. */
    totalCents: v.number(),
    /** "YYYY-MM"; defaults to the current month. */
    period: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.brokerValue) {
      return { recorded: false, reason: "no_broker_supplied" as CommissionSkipReason };
    }

    const resolved = await resolveBrokerKey(ctx, args.brokerValue);
    if (!resolved) {
      // Deliberately not written. A row keyed by an unrecognised string is
      // exactly the legacy data this repair exists to stop producing.
      console.warn(
        `[commissions] Unresolvable broker value "${args.brokerValue}" — no payable recorded.`,
      );
      return {
        recorded: false,
        reason: "broker_unresolvable" as CommissionSkipReason,
        brokerValue: args.brokerValue,
      };
    }

    const period = args.period ?? new Date().toISOString().slice(0, 7);

    // Idempotency: a webhook replay must not double-pay. One payable per
    // enrollment session is the natural key for a checkout.
    if (args.enrollmentSessionId) {
      const existing = await ctx.db
        .query("commissionPayables")
        .withIndex("by_enrollment", (q) =>
          q.eq("enrollmentSessionId", args.enrollmentSessionId),
        )
        .first();
      if (existing) {
        return {
          recorded: false,
          reason: "already_recorded" as CommissionSkipReason,
          payableId: existing._id,
        };
      }
    }

    const rate = await resolveCommissionRate(ctx, {
      brokerId: resolved.leaderId,
      siteId: args.siteId ?? null,
      groupId: args.groupId ?? null,
    });
    if (!rate) {
      console.warn(
        `[commissions] No active commissionRates row for rep ${resolved.leaderId} — no payable recorded.`,
      );
      return {
        recorded: false,
        reason: "no_rate_configured" as CommissionSkipReason,
        brokerId: resolved.leaderId,
      };
    }

    const now = Date.now();
    const payableId = await ctx.db.insert("commissionPayables", {
      brokerId: resolved.leaderId,
      agencyId: resolved.agencyId ?? undefined,
      enrollmentSessionId: args.enrollmentSessionId,
      memberId: args.memberId,
      groupId: args.groupId,
      rateApplied: rate.ratePercentage,
      overrideApplied: rate.overridePercentage,
      // ratePercentage is already a decimal — no /100 here.
      amount: Math.round(args.totalCents * rate.ratePercentage),
      period,
      keySpace: "leader_id",
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    return {
      recorded: true,
      payableId,
      brokerId: resolved.leaderId,
      agencyId: resolved.agencyId,
      rateApplied: rate.ratePercentage,
      resolvedVia: resolved.via,
    };
  },
});
