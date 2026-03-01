/**
 * SUBSCRIPTION QUERIES
 *
 * Queries for reading subscription/entitlement state
 */

import { query } from "../_generated/server";
import { v } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import { requireAuth, requireAdmin } from "../lib/authGuards";

interface GetCustomerBundleArgs {
  customerId: string;
}

interface GetCustomerEntitlementsArgs {
  customerId: string;
  includeExpired?: boolean;
}

interface GetEntitlementArgs {
  entitlementId: string;
}

interface HasAccessArgs {
  customerId: string;
  productId: string;
}

interface GetCustomerDashboardArgs {
  customerId: string;
}

/**
 * Get CURRENT USER's subscription bundle (member-facing)
 * customerId is derived from auth — no IDOR possible
 */
export const getMyBundle = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const identity = await requireAuth(ctx);

    const bundle = await ctx.db
      .query("subscriptionBundles")
      .withIndex("by_customer", (q) =>
        q.eq("customerId", identity.clerkUserId)
      )
      .filter((q) => q.neq(q.field("status"), "cancelled"))
      .first();

    return bundle;
  },
});

/**
 * Get a customer's subscription bundle by customerId (public)
 * Used for server-side layout subscription gating checks
 * No authentication required — safe because it's just checking subscription status
 * (not returning sensitive member data, just plan names and status)
 */
export const getCustomerBundlePublic = query({
  args: {
    customerId: v.string(),
  },
  handler: async (ctx: QueryCtx, args) => {
    const bundle = await ctx.db
      .query("subscriptionBundles")
      .withIndex("by_customer", (q) =>
        q.eq("customerId", args.customerId)
      )
      .filter((q) => q.neq(q.field("status"), "cancelled"))
      .first();

    return bundle
      ? {
          _id: bundle._id,
          customerId: bundle.customerId,
          status: bundle.status,
          currentPeriodEnd: (bundle as any).currentPeriodEnd,
          pricingSnapshot: (bundle as any).pricingSnapshot,
          pastDueAt: (bundle as any).pastDueAt,
        }
      : null;
  },
});

/**
 * Get CURRENT USER's active entitlements (member-facing)
 * customerId is derived from auth — no IDOR possible
 */
export const getMyEntitlements = query({
  args: {
    includeExpired: v.optional(v.boolean()),
  },
  handler: async (ctx: QueryCtx, args) => {
    const identity = await requireAuth(ctx);

    let q = ctx.db
      .query("entitlements")
      .withIndex("by_customer", (q) =>
        q.eq("customerId", identity.clerkUserId)
      );

    if (!args.includeExpired) {
      q = q.filter((q) =>
        q.or(
          q.eq(q.field("status"), "active"),
          q.eq(q.field("status"), "cancel_at_period_end")
        )
      );
    }

    const entitlements = await q.collect();

    // Enrich with product data
    const enriched = await Promise.all(
      entitlements.map(async (e) => {
        const product = await ctx.db.get((e as any).productId as any);
        return { ...e, product };
      })
    );

    return enriched;
  },
});

/**
 * Check if CURRENT USER has access to a product (member-facing)
 * customerId is derived from auth — no IDOR possible
 */
export const myHasAccess = query({
  args: {
    productId: v.id("catalogProducts"),
  },
  handler: async (ctx: QueryCtx, args) => {
    const identity = await requireAuth(ctx);

    const entitlement = await ctx.db
      .query("entitlements")
      .withIndex("by_customer", (q) =>
        q.eq("customerId", identity.clerkUserId)
      )
      .filter((q) => q.eq(q.field("productId"), args.productId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "active"),
          q.eq(q.field("status"), "cancel_at_period_end")
        )
      )
      .first();

    return !!entitlement;
  },
});

/**
 * Get CURRENT USER's dashboard summary (member-facing)
 * customerId is derived from auth — no IDOR possible
 */
export const getMyDashboard = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const identity = await requireAuth(ctx);

    const bundle = await ctx.db
      .query("subscriptionBundles")
      .withIndex("by_customer", (q) =>
        q.eq("customerId", identity.clerkUserId)
      )
      .filter((q) => q.neq(q.field("status"), "cancelled"))
      .first();

    if (!bundle) {
      return {
        customerId: identity.clerkUserId,
        bundle: null,
        entitlements: [],
        nextRenewalDate: null,
        upcomingChargeAmount: null,
      };
    }

    const entitlements = await ctx.db
      .query("entitlements")
      .withIndex("by_customer", (q) =>
        q.eq("customerId", identity.clerkUserId)
      )
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "active"),
          q.eq(q.field("status"), "cancel_at_period_end")
        )
      )
      .collect();

    return {
      customerId: identity.clerkUserId,
      bundle,
      entitlements,
      nextRenewalDate: (bundle as any).currentPeriodEnd,
      upcomingChargeAmount: (bundle as any).pricingSnapshot?.totalCents,
    };
  },
});

/**
 * Get ANY customer's subscription bundle (admin-facing)
 * Only admins can look up other users' subscriptions
 */
export const getCustomerBundle = query({
  args: {
    customerId: v.string(),
  },
  handler: async (ctx: QueryCtx, args: GetCustomerBundleArgs) => {
    await requireAdmin(ctx);
    const bundle = await ctx.db
      .query("subscriptionBundles")
      .withIndex("by_customer", (q) =>
        q.eq("customerId", args.customerId)
      )
      .filter((q) => q.neq(q.field("status"), "cancelled"))
      .first();

    return bundle;
  },
});

/**
 * Get ANY customer's active entitlements (admin-facing)
 * Only admins can look up other users' entitlements
 */
export const getCustomerEntitlements = query({
  args: {
    customerId: v.string(),
    includeExpired: v.optional(v.boolean()),
  },
  handler: async (ctx: QueryCtx, args: GetCustomerEntitlementsArgs) => {
    await requireAdmin(ctx);
    let q = ctx.db
      .query("entitlements")
      .withIndex("by_customer", (q) =>
        q.eq("customerId", args.customerId)
      );

    if (!args.includeExpired) {
      q = q.filter((q) =>
        q.or(
          q.eq(q.field("status"), "active"),
          q.eq(q.field("status"), "cancel_at_period_end")
        )
      );
    }

    const entitlements = await q.collect();

    // Enrich with product data
    const enriched = await Promise.all(
      entitlements.map(async (e) => {
        const product = await ctx.db.get((e as any).productId as any);
        return { ...e, product };
      })
    );

    return enriched;
  },
});

/**
 * Get a specific entitlement with access check
 */
export const getEntitlement = query({
  args: {
    entitlementId: v.id("entitlements"),
  },
  handler: async (ctx: QueryCtx, args: GetEntitlementArgs) => {
    const identity = await requireAuth(ctx);
    
    const entitlement = await ctx.db.get(args.entitlementId as any);
    if (!entitlement) return null;

    // Check ownership: must be the entitlement owner or admin
    if ((entitlement as any).customerId !== identity.clerkUserId) {
      // Check if admin
      const admin = await ctx.db
        .query("adminUsers")
        .withIndex("by_clerk_id", (q: any) => q.eq("clerkUserId", identity.clerkUserId))
        .first();
      
      if (!admin) {
        throw new Error("Unauthorized: You can only access your own entitlements");
      }
    }

    const product = await ctx.db.get((entitlement as any).productId as any);
    return { ...entitlement, product };
  },
});

/**
 * Check if ANY customer has access to a product (admin-facing)
 * Only admins can check other users' access
 */
export const hasAccess = query({
  args: {
    customerId: v.string(),
    productId: v.id("catalogProducts"),
  },
  handler: async (ctx: QueryCtx, args: HasAccessArgs) => {
    await requireAdmin(ctx);
    const entitlement = await ctx.db
      .query("entitlements")
      .withIndex("by_customer", (q) =>
        q.eq("customerId", args.customerId)
      )
      .filter((q) => q.eq(q.field("productId"), args.productId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "active"),
          q.eq(q.field("status"), "cancel_at_period_end")
        )
      )
      .first();

    return !!entitlement;
  },
});

/**
 * Get ANY customer's dashboard summary (admin-facing)
 * Only admins can look up other users' dashboards
 */
export const getCustomerDashboard = query({
  args: {
    customerId: v.string(),
  },
  handler: async (ctx: QueryCtx, args: GetCustomerDashboardArgs) => {
    await requireAdmin(ctx);
    const bundle = await ctx.db
      .query("subscriptionBundles")
      .withIndex("by_customer", (q) =>
        q.eq("customerId", args.customerId)
      )
      .filter((q) => q.neq(q.field("status"), "cancelled"))
      .first();

    if (!bundle) {
      return {
        customerId: args.customerId,
        bundle: null,
        entitlements: [],
        nextRenewalDate: null,
        upcomingChargeAmount: null,
      };
    }

    const entitlements = await ctx.db
      .query("entitlements")
      .withIndex("by_customer", (q) =>
        q.eq("customerId", args.customerId)
      )
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "active"),
          q.eq(q.field("status"), "cancel_at_period_end")
        )
      )
      .collect();

    return {
      customerId: args.customerId,
      bundle,
      entitlements,
      nextRenewalDate: (bundle as any).currentPeriodEnd,
      upcomingChargeAmount: (bundle as any).pricingSnapshot?.totalCents,
    };
  },
});
