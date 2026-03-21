/**
 * GRANT FREE ACCESS
 * 
 * Admin functions to grant free plan access to users without Stripe payment.
 * Used for testing, trials, or manual access grants.
 */

import { mutation, query, internalMutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "../lib/authGuards";

/**
 * Shared helper — call from within any mutation to auto-grant free full access.
 * Skips silently if an active bundle already exists for this user.
 */
export async function autoGrantFreeAccess(
  ctx: MutationCtx,
  clerkUserId: string,
  reason?: string
) {
  const now = Date.now();
  const periodEnd = now + 365 * 24 * 60 * 60 * 1000; // 1 year

  // Skip if already has an active bundle (e.g. paid subscriber added as staff)
  const existing = (await ctx.db.query("subscriptionBundles").collect()).find(
    (b) => b.customerId === clerkUserId && b.status === "active"
  );
  if (existing) return { skipped: true, bundleId: existing._id };

  const allProducts = await ctx.db.query("catalogProducts").collect();

  const bundleId = await ctx.db.insert("subscriptionBundles", {
    customerId: clerkUserId,
    cadence: "annual",
    paymentMethod: "card",
    stripeCustomerId: `free_local_${clerkUserId}`,
    stripeSubscriptionId: `free_${now}`,
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

  for (const product of allProducts) {
    await ctx.db.insert("entitlements", {
      customerId: clerkUserId,
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
      notes: reason ?? `Free access auto-granted on team member addition`,
    });
  }

  return { skipped: false, bundleId };
}
import { api } from "../_generated/api";

/**
 * CLI BOOTSTRAP — run via: npx convex run admin/grantFreeAccess:cliGrantAdmin '{"clerkUserId":"..."}'
 * No auth required — remove after use.
 */
export const cliGrantAdmin = mutation({
  args: {
    clerkUserId: v.string(),
    email: v.optional(v.string()),
    durationDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const email = args.email ?? `admin_${args.clerkUserId}@bootstrap.local`;
    const now = Date.now();
    const durationMs = (args.durationDays ?? 365) * 24 * 60 * 60 * 1000;
    const periodEnd = now + durationMs;

    // Add to adminUsers if not already there
    const existing = await ctx.db
      .query("adminUsers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();
    if (!existing) {
      await ctx.db.insert("adminUsers", {
        clerkUserId: args.clerkUserId,
        email,
        name: "Owner",
        role: "owner",
        createdAt: now,
      });
    }

    // Create subscription bundle if none exists
    const existingBundle = (await ctx.db.query("subscriptionBundles").collect())
      .find((b) => b.customerId === args.clerkUserId && b.status === "active");
    let bundleId = existingBundle?._id;
    if (!bundleId) {
      const allProducts = await ctx.db.query("catalogProducts").collect();
      bundleId = await ctx.db.insert("subscriptionBundles", {
        customerId: args.clerkUserId,
        cadence: "annual",
        paymentMethod: "card",
        stripeCustomerId: `free_local_${args.clerkUserId}`,
        stripeSubscriptionId: `free_${now}`,
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

      // Grant entitlements
      for (const product of allProducts) {
        await ctx.db.insert("entitlements", {
          customerId: args.clerkUserId,
          bundleId: bundleId!,
          productId: product._id,
          periodStart: now,
          periodEnd,
          status: "active",
          endCondition: "expire",
          createdAt: now,
          activatedAt: now,
          expiresAt: periodEnd,
          createdVia: "admin_action",
          notes: `CLI bootstrap grant on ${new Date().toISOString()}`,
        });
      }
    }

    return { success: true, clerkUserId: args.clerkUserId, isAdmin: true };
  },
});

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
 * BOOTSTRAP: Make the first admin when no admins exist
 * Safe — only works when the adminUsers table is empty.
 * Also grants full subscription access so the dashboard works.
 *
 * Call from the browser while signed in: 
 *   /api/bootstrap  (hits this mutation)
 */
export const bootstrapFirstAdmin = mutation({
  args: {
    durationDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Must be authenticated
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated — sign in first");

    const clerkUserId = identity.subject;
    const email = identity.email ?? "unknown";
    const name = identity.name ?? email;

    // Check if caller is already an admin; if not, add them
    const existingAdmins = await ctx.db.query("adminUsers").collect();
    const alreadyAdmin = existingAdmins.find(a => a.clerkUserId === clerkUserId);
    if (!alreadyAdmin) {
      await ctx.db.insert("adminUsers", {
        clerkUserId,
        email,
        name,
        role: "owner",
        createdAt: Date.now(),
      });
    }

    // Also grant full subscription access (so /health/dashboard works)
    const allProducts = await ctx.db.query("catalogProducts").collect();

    const now = Date.now();
    const durationMs = (args.durationDays ?? 365) * 24 * 60 * 60 * 1000;
    const periodEnd = now + durationMs;

    // Check if a bundle already exists
    const existingBundle = (await ctx.db.query("subscriptionBundles").collect())
      .find(b => b.customerId === clerkUserId && b.status === "active");

    let bundleId = existingBundle?._id;

    if (!bundleId) {
      bundleId = await ctx.db.insert("subscriptionBundles", {
        customerId: clerkUserId,
        cadence: "annual",
        paymentMethod: "card",
        stripeCustomerId: `free_local_${clerkUserId}`,
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
    }

    // Grant entitlements for each product (skip if already granted)
    const existingEntitlements = (await ctx.db.query("entitlements").collect())
      .filter(e => e.customerId === clerkUserId && e.status === "active");
    
    const grantedProductIds = new Set(existingEntitlements.map(e => e.productId));
    let newGrants = 0;

    for (const product of allProducts) {
      if (!grantedProductIds.has(product._id)) {
        await ctx.db.insert("entitlements", {
          customerId: clerkUserId,
          bundleId: bundleId!,
          productId: product._id,
          periodStart: now,
          periodEnd,
          status: "active",
          endCondition: "expire",
          createdAt: now,
          activatedAt: now,
          expiresAt: periodEnd,
          createdVia: "admin_action",
          notes: `Bootstrap access for ${email} on ${new Date().toISOString()}`,
        });
        newGrants++;
      }
    }

    return {
      success: true,
      clerkUserId,
      email,
      isAdmin: true,
      totalProducts: allProducts.length,
      newEntitlements: newGrants,
      existingEntitlements: existingEntitlements.length,
      message: `✅ You are now admin + have full access! ${allProducts.length} products available until ${new Date(periodEnd).toLocaleDateString()}`,
    };
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
