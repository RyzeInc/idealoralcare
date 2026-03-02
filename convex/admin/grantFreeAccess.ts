/**
 * GRANT FREE ACCESS
 * 
 * Admin functions to grant free plan access to users without Stripe payment.
 * Used for testing, trials, or manual access grants.
 */

import { mutation, query, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "../lib/authGuards";
import { api } from "../_generated/api";

/**
 * Create a free subscription bundle for a user
 * This creates a non-Stripe subscription that's manually managed
 */
export const createFreeBundle = mutation({
  args: {
    customerId: v.string(), // Clerk user ID (usually yourself)
    durationDays: v.optional(v.number()), // How many days the free access lasts (default: 365)
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    const now = Date.now();
    const durationMs = (args.durationDays ?? 365) * 24 * 60 * 60 * 1000;
    const periodEnd = now + durationMs;
    
    // Create a bundle with "card" payment method (required by schema)
    // but mark it as a free/trial subscription in the notes
    const bundleId = await ctx.db.insert("subscriptionBundles", {
      customerId: args.customerId,
      cadence: "annual",
      paymentMethod: "card", // Schema requires this, but we'll note it's free
      stripeCustomerId: `free_local_${args.customerId}`,
      stripeSubscriptionId: `free_${Date.now()}`,
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      pricingSnapshot: {
        cadence: "annual",
        paymentMethod: "card",
        totalCents: 0, // $0
        planCount: 0,
        capturedAt: now,
      },
      createdAt: now,
      updatedAt: now,
      activatedAt: now,
    });
    
    return { bundleId, periodEnd };
  },
});

/**
 * Grant free access to a specific plan/product
 * Creates an active entitlement for the user
 */
export const grantFreePlanAccess = mutation({
  args: {
    customerId: v.string(), // Clerk user ID
    productId: v.id("catalogProducts"), // Plan to grant access to
    bundleId: v.id("subscriptionBundles"), // The free bundle to associate with
    durationDays: v.optional(v.number()), // How many days (default: 365)
    notes: v.optional(v.string()), // Why access was granted
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    const now = Date.now();
    const durationMs = (args.durationDays ?? 365) * 24 * 60 * 60 * 1000;
    const periodEnd = now + durationMs;
    
    // Create the entitlement
    const entitlementId = await ctx.db.insert("entitlements", {
      customerId: args.customerId,
      bundleId: args.bundleId,
      productId: args.productId,
      periodStart: now,
      periodEnd: periodEnd,
      status: "active",
      endCondition: "expire", // Don't auto-renew
      createdAt: now,
      activatedAt: now,
      expiresAt: periodEnd,
      createdVia: "admin_action",
      notes: args.notes ?? `Free access granted by admin on ${new Date().toISOString()}`,
    });
    
    return { entitlementId, periodEnd };
  },
});

/**
 * Quick helper: Grant full free access in one call
 * Creates a bundle and grants access to all specified products
 */
export const grantFullFreeAccess = mutation({
  args: {
    customerId: v.string(), // Clerk user ID
    productIds: v.array(v.id("catalogProducts")), // Plans to grant
    durationDays: v.optional(v.number()), // Duration (default: 365)
    reason: v.optional(v.string()), // Reason for grant
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    const now = Date.now();
    const durationMs = (args.durationDays ?? 365) * 24 * 60 * 60 * 1000;
    const periodEnd = now + durationMs;
    
    // 1. Create the free bundle
    const bundleId = await ctx.db.insert("subscriptionBundles", {
      customerId: args.customerId,
      cadence: "annual",
      paymentMethod: "card",
      stripeCustomerId: `free_local_${args.customerId}`,
      stripeSubscriptionId: `free_${Date.now()}`,
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      pricingSnapshot: {
        cadence: "annual",
        paymentMethod: "card",
        totalCents: 0,
        planCount: args.productIds.length,
        capturedAt: now,
      },
      createdAt: now,
      updatedAt: now,
      activatedAt: now,
    });
    
    // 2. Create entitlements for each product
    const entitlementIds = [];
    for (const productId of args.productIds) {
      const entitlementId = await ctx.db.insert("entitlements", {
        customerId: args.customerId,
        bundleId: bundleId,
        productId: productId,
        periodStart: now,
        periodEnd: periodEnd,
        status: "active",
        endCondition: "expire",
        createdAt: now,
        activatedAt: now,
        expiresAt: periodEnd,
        createdVia: "admin_action",
        notes: args.reason ? `Free access: ${args.reason}` : `Free access granted on ${new Date().toISOString()}`,
      });
      entitlementIds.push(entitlementId);
    }
    
    return {
      bundleId,
      entitlementIds,
      periodEnd,
      message: `Free access granted to ${args.productIds.length} product(s) until ${new Date(periodEnd).toISOString()}`,
    };
  },
});

/**
 * View free bundles (for auditing)
 */
export const listFreeBundles = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    
    // Query bundles with free stripe IDs
    const freeBundles = await ctx.db
      .query("subscriptionBundles")
      .collect();
    
    return freeBundles.filter(
      (bundle) =>
        bundle.stripeCustomerId?.startsWith("free_local_") ||
        bundle.stripeSubscriptionId?.startsWith("free_")
    );
  },
});

/**
 * Quick grant: Get all products and grant full access in one call
 * This is the easiest way to give yourself immediate access to everything
 */
export const grantMeFullAccess = mutation({
  args: {
    durationDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    // Get current user (admin) from Clerk
    const userIdentity = await ctx.auth.getUserIdentity();
    if (!userIdentity) throw new Error("Not authenticated");
    
    const customerId = userIdentity.subject; // Clerk user ID
    
    // Get all catalog products
    const allProducts = await ctx.db
      .query("catalogProducts")
      .collect();
    
    if (allProducts.length === 0) {
      throw new Error("No products found in catalog");
    }
    
    const productIds = allProducts.map((p) => p._id);
    
    // Create free bundle
    const now = Date.now();
    const durationMs = (args.durationDays ?? 365) * 24 * 60 * 60 * 1000;
    const periodEnd = now + durationMs;
    
    const bundleId = await ctx.db.insert("subscriptionBundles", {
      customerId: customerId,
      cadence: "annual",
      paymentMethod: "card",
      stripeCustomerId: `free_local_${customerId}`,
      stripeSubscriptionId: `free_${Date.now()}`,
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      pricingSnapshot: {
        cadence: "annual",
        paymentMethod: "card",
        totalCents: 0,
        planCount: productIds.length,
        capturedAt: now,
      },
      createdAt: now,
      updatedAt: now,
      activatedAt: now,
    });
    
    // Create entitlements for each product
    const entitlementIds = [];
    for (const productId of productIds) {
      const entitlementId = await ctx.db.insert("entitlements", {
        customerId: customerId,
        bundleId: bundleId,
        productId: productId,
        periodStart: now,
        periodEnd: periodEnd,
        status: "active",
        endCondition: "expire",
        createdAt: now,
        activatedAt: now,
        expiresAt: periodEnd,
        createdVia: "admin_action",
        notes: `Free access granted to admin ${customerId} on ${new Date().toISOString()}`,
      });
      entitlementIds.push(entitlementId);
    }
    
    return {
      success: true,
      customerId,
      bundleId,
      productsGranted: productIds.length,
      entitlements: entitlementIds.length,
      expiresAt: new Date(periodEnd).toISOString(),
      message: `✅ Full free access granted! ${productIds.length} product(s) active until ${new Date(periodEnd).toLocaleDateString()}`,
    };
  },
});

/**
 * Internal version — no auth check.
 * Run from terminal: npx convex run admin/grantFreeAccess:grantMeFullAccessInternal --prod '{"customerId":"user_XXXX"}'
 */
export const grantMeFullAccessInternal = internalMutation({
  args: {
    customerId: v.string(),
    durationDays: v.optional(v.number()),
  },
  handler: async (ctx: any, args: any) => {
    const allProducts = await ctx.db.query("catalogProducts").collect();
    if (allProducts.length === 0) throw new Error("No products in catalog — run reseedInternal first");

    const now = Date.now();
    const durationMs = (args.durationDays ?? 365) * 24 * 60 * 60 * 1000;
    const periodEnd = now + durationMs;

    const bundleId = await ctx.db.insert("subscriptionBundles", {
      customerId: args.customerId,
      cadence: "annual",
      paymentMethod: "card",
      stripeCustomerId: `free_local_${args.customerId}`,
      stripeSubscriptionId: `free_${Date.now()}`,
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      pricingSnapshot: {
        cadence: "annual",
        paymentMethod: "card",
        totalCents: 0,
        planCount: allProducts.length,
        capturedAt: now,
      },
      createdAt: now,
      updatedAt: now,
      activatedAt: now,
    });

    const entitlementIds = [];
    for (const product of allProducts) {
      const id = await ctx.db.insert("entitlements", {
        customerId: args.customerId,
        bundleId,
        productId: product._id,
        periodStart: now,
        periodEnd,
        status: "active",
        endCondition: "expire",
        createdAt: now,
        activatedAt: now,
        expiresAt: periodEnd,
        createdVia: "admin_action",
        notes: `Free access granted internally on ${new Date().toISOString()}`,
      });
      entitlementIds.push(id);
    }

    return {
      success: true,
      customerId: args.customerId,
      bundleId,
      productsGranted: allProducts.length,
      entitlements: entitlementIds.length,
      expiresAt: new Date(periodEnd).toISOString(),
    };
  },
});
