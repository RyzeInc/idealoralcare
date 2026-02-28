/**
 * SUBSCRIPTION QUERIES
 *
 * Queries for reading subscription/entitlement state
 */

import { query } from "../_generated/server";
import { v } from "convex/values";
import type { QueryCtx } from "../_generated/server";

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
 * Get a customer's current subscription bundle
 */
export const getCustomerBundle = query({
  args: {
    customerId: v.string(),
  },
  handler: async (ctx: QueryCtx, args: GetCustomerBundleArgs) => {
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
 * Get all active entitlements for a customer
 */
export const getCustomerEntitlements = query({
  args: {
    customerId: v.string(),
    includeExpired: v.optional(v.boolean()),
  },
  handler: async (ctx: QueryCtx, args: GetCustomerEntitlementsArgs) => {
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
 * Get a specific entitlement
 */
export const getEntitlement = query({
  args: {
    entitlementId: v.id("entitlements"),
  },
  handler: async (ctx: QueryCtx, args: GetEntitlementArgs) => {
    const entitlement = await ctx.db.get(args.entitlementId as any);
    if (!entitlement) return null;

    const product = await ctx.db.get((entitlement as any).productId as any);
    return { ...entitlement, product };
  },
});

/**
 * Check if customer has access to a product
 */
export const hasAccess = query({
  args: {
    customerId: v.string(),
    productId: v.id("catalogProducts"),
  },
  handler: async (ctx: QueryCtx, args: HasAccessArgs) => {
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
 * Get customer dashboard summary
 */
export const getCustomerDashboard = query({
  args: {
    customerId: v.string(),
  },
  handler: async (ctx: QueryCtx, args: GetCustomerDashboardArgs) => {
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
