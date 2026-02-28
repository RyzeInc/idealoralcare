import { defineTable } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * ENTITLEMENT LEDGER TABLE
 *
 * This is the source of truth for WHO HAS ACCESS TO WHAT.
 * Not inferred from payments or invoices — explicitly tracked.
 *
 * Design principle: Stripe confirms money. This ledger confirms access.
 * Events drive state changes; events are idempotent and auditable.
 */
export const entitlementsTable = defineTable({
  // IDENTITY
  customerId: v.string(), // Clerk user ID
  bundleId: v.id("subscriptionBundles"), // Which bundle this entitlement belongs to
  productId: v.id("catalogProducts"), // Which plan/product
  
  // ACCESS PERIOD
  periodStart: v.number(), // Unix timestamp (ms) - when access begins
  periodEnd: v.number(), // Unix timestamp (ms) - when access expires
  
  // STATE MACHINE
  status: v.union(
    v.literal("active"), // User has access now
    v.literal("cancel_at_period_end"), // Access continues until periodEnd, then stops
    v.literal("expired"), // Access period is over
    v.literal("suspended"), // Temporary hold (e.g., payment failed)
    v.literal("revoked") // Admin-terminated access
  ),
  
  // END CONDITION (determines what happens at periodEnd)
  endCondition: v.union(
    v.literal("renew"), // New entitlement created automatically
    v.literal("expire"), // Access ends, no renewal
    v.literal("unknown") // Queued for admin decision
  ),
  
  // STRIPE REFERENCE (narrow: which subscription item this belongs to)
  stripeSubscriptionItemId: v.optional(v.string()), // Stripe SubscriptionItem ID
  
  // AUDIT TRAIL
  createdAt: v.number(),
  activatedAt: v.optional(v.number()), // When access actually began
  expiresAt: v.number(), // When to run expiration logic
  suspendedAt: v.optional(v.number()),
  revokedAt: v.optional(v.number()),
  
  // CONTEXT (for support & debugging)
  createdVia: v.union(
    v.literal("initial_purchase"),
    v.literal("plan_addition"),
    v.literal("reactivation"),
    v.literal("admin_action")
  ),
  
  notes: v.optional(v.string()), // Admin notes or system messages
})
  .index("by_customer", ["customerId"])
  .index("by_bundle", ["bundleId"])
  .index("by_product", ["productId"])
  .index("by_status", ["status"])
  .index("by_period_end", ["periodEnd"]) // For batch expiration
  .index("by_customer_active", ["customerId", "status"]) // Frequent query
  .index("by_stripe_item", ["stripeSubscriptionItemId"]);

/**
 * Activate an entitlement (grant access)
 */
export const activateEntitlement = mutation({
  args: {
    customerId: v.string(),
    bundleId: v.id("subscriptionBundles"),
    productId: v.id("catalogProducts"),
    periodStart: v.number(),
    periodEnd: v.number(),
    createdVia: v.string(),
    stripeSubscriptionItemId: v.optional(v.string()),
    endCondition: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const entitlementId = await ctx.db.insert("entitlements", {
      customerId: args.customerId,
      bundleId: args.bundleId,
      productId: args.productId,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      status: "active",
      endCondition: (args.endCondition as any) ?? "renew",
      stripeSubscriptionItemId: args.stripeSubscriptionItemId,
      createdAt: Date.now(),
      activatedAt: Date.now(),
      expiresAt: args.periodEnd,
      createdVia: (args.createdVia as any) ?? "initial_purchase",
      notes: args.notes,
    });

    return await ctx.db.get(entitlementId);
  },
});

/**
 * Cancel an entitlement (scheduled end at period boundary)
 */
export const scheduleEntitlementCancellation = mutation({
  args: {
    entitlementId: v.id("entitlements"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const entitlement = await ctx.db.get(args.entitlementId);
    if (!entitlement) throw new Error("Entitlement not found");

    await ctx.db.patch(args.entitlementId, {
      status: "cancel_at_period_end",
      endCondition: "expire",
      notes: args.notes ?? `Cancellation scheduled at ${new Date().toISOString()}`,
    });

    return await ctx.db.get(args.entitlementId);
  },
});

/**
 * Suspend an entitlement (temporary hold)
 */
export const suspendEntitlement = mutation({
  args: {
    entitlementId: v.id("entitlements"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const entitlement = await ctx.db.get(args.entitlementId);
    if (!entitlement) throw new Error("Entitlement not found");

    await ctx.db.patch(args.entitlementId, {
      status: "suspended",
      suspendedAt: Date.now(),
      notes: args.notes ?? `Suspended at ${new Date().toISOString()}`,
    });

    return await ctx.db.get(args.entitlementId);
  },
});

/**
 * Revoke an entitlement (admin-terminated)
 */
export const revokeEntitlement = mutation({
  args: {
    entitlementId: v.id("entitlements"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const entitlement = await ctx.db.get(args.entitlementId);
    if (!entitlement) throw new Error("Entitlement not found");

    await ctx.db.patch(args.entitlementId, {
      status: "revoked",
      revokedAt: Date.now(),
      notes: args.notes ?? `Revoked at ${new Date().toISOString()}`,
    });

    return await ctx.db.get(args.entitlementId);
  },
});

/**
 * Reactivate a suspended or cancelled entitlement
 */
export const reactivateEntitlement = mutation({
  args: {
    entitlementId: v.id("entitlements"),
    newPeriodEnd: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const entitlement = await ctx.db.get(args.entitlementId);
    if (!entitlement) throw new Error("Entitlement not found");

    const updates: any = {
      status: "active",
      suspendedAt: undefined,
      endCondition: "renew",
      notes: args.notes ?? `Reactivated at ${new Date().toISOString()}`,
    };

    if (args.newPeriodEnd) {
      updates.periodEnd = args.newPeriodEnd;
      updates.expiresAt = args.newPeriodEnd;
    }

    await ctx.db.patch(args.entitlementId, updates);
    return await ctx.db.get(args.entitlementId);
  },
});

/**
 * Get entitlements for a customer
 */
export const getEntitlementsByCustomer = query({
  args: {
    customerId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("entitlements")
      .withIndex("by_customer")
      .filter((q) => q.eq(q.field("customerId"), args.customerId))
      .collect();
  },
});

/**
 * Get active entitlements for a customer (ACTIVE status only)
 */
export const getActiveEntitlementsByCustomer = query({
  args: {
    customerId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("entitlements")
      .withIndex("by_customer_active")
      .filter((q) =>
        q.and(
          q.eq(q.field("customerId"), args.customerId),
          q.eq(q.field("status"), "active")
        )
      )
      .collect();
  },
});

/**
 * Get a single entitlement
 */
export const getEntitlement = query({
  args: {
    entitlementId: v.id("entitlements"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.entitlementId);
  },
});

/**
 * Check if a customer has access to a product
 */
export const hasAccess = query({
  args: {
    customerId: v.string(),
    productId: v.id("catalogProducts"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const entitlements = await ctx.db
      .query("entitlements")
      .withIndex("by_customer")
      .filter((q) => q.eq(q.field("customerId"), args.customerId))
      .collect();

    return entitlements.some(
      (e) =>
        e.productId === args.productId &&
        e.status === "active" &&
        e.periodStart <= now &&
        e.periodEnd >= now
    );
  },
});

/**
 * Get entitlements expiring soon (within N days)
 */
export const getExpiringEntitlements = query({
  args: {
    daysUntilExpiry: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const cutoff = now + args.daysUntilExpiry * 24 * 60 * 60 * 1000;

    const allEntitlements = await ctx.db
      .query("entitlements")
      .withIndex("by_status")
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    return allEntitlements.filter(
      (e) => e.expiresAt <= cutoff && e.expiresAt >= now
    );
  },
});

/**
 * Get bundle dashboard summary (total access across products)
 */
export const getBundleEntitlement = query({
  args: {
    bundleId: v.id("subscriptionBundles"),
  },
  handler: async (ctx, args) => {
    const entitlements = await ctx.db
      .query("entitlements")
      .withIndex("by_bundle")
      .filter((q) => q.eq(q.field("bundleId"), args.bundleId))
      .collect();

    const active = entitlements.filter((e) => e.status === "active");
    const total = entitlements.length;

    return {
      bundleId: args.bundleId,
      totalEntitlements: total,
      activeEntitlements: active.length,
      statuses: {
        active: active.length,
        cancelled: entitlements.filter((e) => e.status === "cancel_at_period_end").length,
        expired: entitlements.filter((e) => e.status === "expired").length,
        suspended: entitlements.filter((e) => e.status === "suspended").length,
        revoked: entitlements.filter((e) => e.status === "revoked").length,
      },
      entitlements,
    };
  },
});