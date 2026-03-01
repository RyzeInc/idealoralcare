/**
 * SUBSCRIPTION MUTATIONS
 *
 * Mutations for managing subscriptions, bundles, and entitlements
 */

import { mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { requireAdmin, requireSelf } from "../lib/authGuards";

/**
 * Create a new subscription bundle
 * Called after successful Stripe Checkout Session
 */
export const createBundle = mutation({
  args: {
    customerId: v.string(), // Clerk user ID
    cadence: v.union(v.literal("monthly"), v.literal("annual")),
    paymentMethod: v.union(v.literal("card"), v.literal("ach")),
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
    stripeInvoiceId: v.optional(v.string()),
    totalCents: v.number(), // pricing snapshot
    planCount: v.number(),
    currentPeriodStart: v.number(), // Unix timestamp
    currentPeriodEnd: v.number(),
  },
  handler: async (ctx, args) => {
    // Admin-only access
    await requireAdmin(ctx);
    const now = Date.now();
    const bundleId = await ctx.db.insert("subscriptionBundles", {
      customerId: args.customerId,
      cadence: args.cadence,
      paymentMethod: args.paymentMethod,
      stripeCustomerId: args.stripeCustomerId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      stripeInvoiceId: args.stripeInvoiceId,
      status: "active",
      currentPeriodStart: args.currentPeriodStart,
      currentPeriodEnd: args.currentPeriodEnd,
      pricingSnapshot: {
        cadence: args.cadence,
        paymentMethod: args.paymentMethod,
        totalCents: args.totalCents,
        planCount: args.planCount,
        capturedAt: now,
      },
      createdAt: now,
      updatedAt: now,
      activatedAt: now,
    });

    return bundleId;
  },
});

/**
 * Internal mutation: Create a new subscription bundle (no auth check)
 * For use by system processes, webhooks, etc.
 */
export const internalCreateBundle = internalMutation({
  args: {
    customerId: v.string(), // Clerk user ID
    cadence: v.union(v.literal("monthly"), v.literal("annual")),
    paymentMethod: v.union(v.literal("card"), v.literal("ach")),
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
    stripeInvoiceId: v.optional(v.string()),
    totalCents: v.number(), // pricing snapshot
    planCount: v.number(),
    currentPeriodStart: v.number(), // Unix timestamp
    currentPeriodEnd: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const bundleId = await ctx.db.insert("subscriptionBundles", {
      customerId: args.customerId,
      cadence: args.cadence,
      paymentMethod: args.paymentMethod,
      stripeCustomerId: args.stripeCustomerId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      stripeInvoiceId: args.stripeInvoiceId,
      status: "active",
      currentPeriodStart: args.currentPeriodStart,
      currentPeriodEnd: args.currentPeriodEnd,
      pricingSnapshot: {
        cadence: args.cadence,
        paymentMethod: args.paymentMethod,
        totalCents: args.totalCents,
        planCount: args.planCount,
        capturedAt: now,
      },
      createdAt: now,
      updatedAt: now,
      activatedAt: now,
    });

    return bundleId;
  },
});

/**
 * Activate an entitlement for a product
 * Links a bundle to a specific product with access dates
 */
export const activateEntitlement = mutation({
  args: {
    customerId: v.string(),
    bundleId: v.id("subscriptionBundles"),
    productId: v.id("catalogProducts"),
    stripeSubscriptionItemId: v.optional(v.string()),
    periodStart: v.number(),
    periodEnd: v.number(),
    endCondition: v.union(
      v.literal("renew"),
      v.literal("expire"),
      v.literal("unknown")
    ),
  },
  handler: async (ctx, args) => {
    // Admin-only access
    await requireAdmin(ctx);
    
    const now = Date.now();
    const entitlementId = await ctx.db.insert("entitlements", {
      customerId: args.customerId,
      bundleId: args.bundleId,
      productId: args.productId,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      status: "active",
      endCondition: args.endCondition,
      stripeSubscriptionItemId: args.stripeSubscriptionItemId,
      createdAt: now,
      activatedAt: now,
      expiresAt: args.periodEnd,
      createdVia: "initial_purchase",
    });

    return entitlementId;
  },
});

/**
 * Internal mutation: Activate an entitlement (no auth check)
 */
export const internalActivateEntitlement = internalMutation({
  args: {
    customerId: v.string(),
    bundleId: v.id("subscriptionBundles"),
    productId: v.id("catalogProducts"),
    stripeSubscriptionItemId: v.optional(v.string()),
    periodStart: v.number(),
    periodEnd: v.number(),
    endCondition: v.union(
      v.literal("renew"),
      v.literal("expire"),
      v.literal("unknown")
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const entitlementId = await ctx.db.insert("entitlements", {
      customerId: args.customerId,
      bundleId: args.bundleId,
      productId: args.productId,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      status: "active",
      endCondition: args.endCondition,
      stripeSubscriptionItemId: args.stripeSubscriptionItemId,
      createdAt: now,
      activatedAt: now,
      expiresAt: args.periodEnd,
      createdVia: "initial_purchase",
    });

    return entitlementId;
  },
});

/**
 * Extend an entitlement period (renewal)
 */
export const extendEntitlementPeriod = mutation({
  args: {
    entitlementId: v.id("entitlements"),
    newPeriodEnd: v.number(),
    newExpiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    // Admin-only access
    await requireAdmin(ctx);
    
    await ctx.db.patch(args.entitlementId, {
      periodEnd: args.newPeriodEnd,
      expiresAt: args.newExpiresAt,
    });
    return args.entitlementId;
  },
});

/**
 * Internal mutation: Extend an entitlement period (no auth check)
 */
export const internalExtendEntitlementPeriod = internalMutation({
  args: {
    entitlementId: v.id("entitlements"),
    newPeriodEnd: v.number(),
    newExpiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.entitlementId, {
      periodEnd: args.newPeriodEnd,
      expiresAt: args.newExpiresAt,
    });
    return args.entitlementId;
  },
});

/**
 * Cancel an entitlement
 */
export const cancelEntitlement = mutation({
  args: {
    entitlementId: v.id("entitlements"),
    customerId: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // User can only cancel their own entitlements
    await requireSelf(ctx, args.customerId);
    
    const now = Date.now();
    await ctx.db.patch(args.entitlementId, {
      status: "expired",
      revokedAt: now,
    });
    return args.entitlementId;
  },
});

/**
 * Cancel a subscription bundle
 */
export const cancelBundle = mutation({
  args: {
    bundleId: v.id("subscriptionBundles"),
    customerId: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // User can only cancel their own bundles
    await requireSelf(ctx, args.customerId);
    
    const now = Date.now();
    
    // Cancel the bundle
    await ctx.db.patch(args.bundleId, {
      status: "cancelled",
      cancelledAt: now,
    });

    // Cancel all active entitlements in this bundle
    const entitlements = await ctx.db
      .query("entitlements")
      .withIndex("by_bundle", (q) => q.eq("bundleId", args.bundleId))
      .collect();

    for (const ent of entitlements) {
      if (ent.status !== "expired" && ent.status !== "revoked") {
        await ctx.db.patch(ent._id, {
          status: "expired",
          revokedAt: now,
        });
      }
    }

    return args.bundleId;
  },
});

/**
 * Log an event
 * Used for audit trail: enrollment started, payment completed, entitlement activated, etc.
 */
export const logEvent = mutation({
  args: {
    eventType: v.string(), // e.g. "checkout.session.completed", "subscription.created"
    actor: v.union(
      v.literal("system"),
      v.literal("stripe"),
      v.literal("user"),
      v.literal("admin")
    ),
    customerId: v.optional(v.string()),
    bundleId: v.optional(v.id("subscriptionBundles")),
    productId: v.optional(v.id("catalogProducts")),
    entitlementId: v.optional(v.id("entitlements")),
    stripeEventId: v.optional(v.string()),
    stripeObjectId: v.optional(v.string()),
    payload: v.optional(v.any()),
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Admin-only access
    await requireAdmin(ctx);
    const now = Date.now();

    // Check idempotency: if idempotencyKey provided and already logged, return existing
    if (args.idempotencyKey) {
      const existing = await ctx.db
        .query("events")
        .filter((q) => q.eq(q.field("idempotencyKey"), args.idempotencyKey))
        .first();
      if (existing) {
        return existing._id;
      }
    }

    const eventId = await ctx.db.insert("events", {
      eventType: args.eventType,
      actor: args.actor,
      customerId: args.customerId,
      bundleId: args.bundleId,
      productId: args.productId,
      entitlementId: args.entitlementId,
      stripeEventId: args.stripeEventId,
      stripeObjectId: args.stripeObjectId,
      payload: args.payload,
      success: args.success,
      errorMessage: args.errorMessage,
      createdAt: now,
      idempotencyKey: args.idempotencyKey,
    });

    return eventId;
  },
});
/**
 * Internal mutation: Log an event (no auth check)
 * For use by system processes, webhooks, etc.
 */
export const internalLogEvent = internalMutation({
  args: {
    eventType: v.string(),
    actor: v.union(
      v.literal("system"),
      v.literal("stripe"),
      v.literal("user"),
      v.literal("admin")
    ),
    customerId: v.optional(v.string()),
    bundleId: v.optional(v.id("subscriptionBundles")),
    productId: v.optional(v.id("catalogProducts")),
    entitlementId: v.optional(v.id("entitlements")),
    stripeEventId: v.optional(v.string()),
    stripeObjectId: v.optional(v.string()),
    payload: v.optional(v.any()),
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check idempotency: if idempotencyKey provided and already logged, return existing
    if (args.idempotencyKey) {
      const existing = await ctx.db
        .query("events")
        .filter((q) => q.eq(q.field("idempotencyKey"), args.idempotencyKey))
        .first();
      if (existing) {
        return existing._id;
      }
    }

    const eventId = await ctx.db.insert("events", {
      eventType: args.eventType,
      actor: args.actor,
      customerId: args.customerId,
      bundleId: args.bundleId,
      productId: args.productId,
      entitlementId: args.entitlementId,
      stripeEventId: args.stripeEventId,
      stripeObjectId: args.stripeObjectId,
      payload: args.payload,
      success: args.success,
      errorMessage: args.errorMessage,
      createdAt: now,
      idempotencyKey: args.idempotencyKey,
    });

    return eventId;
  },
});

/**
 * WEBHOOK WRAPPER MUTATIONS
 *
 * Public mutations designed for Stripe webhook handlers.
 * These bypass auth checks and implement internal mutation logic without auth guards.
 * Note: In production, webhook endpoints should validate Stripe event signatures
 * before reaching these mutations. See src/app/api/stripe/webhook/route.ts
 */

/**
 * Create a subscription bundle from webhook
 * Public wrapper that implements internalCreateBundle logic without auth
 */
export const webhookCreateBundle = mutation({
  args: {
    customerId: v.string(),
    cadence: v.union(v.literal("monthly"), v.literal("annual")),
    paymentMethod: v.union(v.literal("card"), v.literal("ach")),
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
    stripeInvoiceId: v.optional(v.string()),
    totalCents: v.number(),
    planCount: v.number(),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const bundleId = await ctx.db.insert("subscriptionBundles", {
      customerId: args.customerId,
      cadence: args.cadence,
      paymentMethod: args.paymentMethod,
      stripeCustomerId: args.stripeCustomerId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      stripeInvoiceId: args.stripeInvoiceId,
      status: "active",
      currentPeriodStart: args.currentPeriodStart,
      currentPeriodEnd: args.currentPeriodEnd,
      pricingSnapshot: {
        cadence: args.cadence,
        paymentMethod: args.paymentMethod,
        totalCents: args.totalCents,
        planCount: args.planCount,
        capturedAt: now,
      },
      createdAt: now,
      updatedAt: now,
      activatedAt: now,
    });
    return bundleId;
  },
});

/**
 * Activate an entitlement from webhook
 * Public wrapper that implements internalActivateEntitlement logic without auth
 */
export const webhookActivateEntitlement = mutation({
  args: {
    customerId: v.string(),
    bundleId: v.id("subscriptionBundles"),
    productId: v.id("catalogProducts"),
    stripeSubscriptionItemId: v.optional(v.string()),
    periodStart: v.number(),
    periodEnd: v.number(),
    endCondition: v.union(
      v.literal("renew"),
      v.literal("expire"),
      v.literal("unknown")
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const entitlementId = await ctx.db.insert("entitlements", {
      customerId: args.customerId,
      bundleId: args.bundleId,
      productId: args.productId,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      status: "active",
      endCondition: args.endCondition,
      stripeSubscriptionItemId: args.stripeSubscriptionItemId,
      createdAt: now,
      activatedAt: now,
      expiresAt: args.periodEnd,
      createdVia: "initial_purchase",
    });
    return entitlementId;
  },
});

/**
 * Log an event from webhook
 * Public wrapper that implements internalLogEvent logic without auth
 */
export const webhookLogEvent = mutation({
  args: {
    eventType: v.string(),
    actor: v.union(
      v.literal("system"),
      v.literal("stripe"),
      v.literal("user"),
      v.literal("admin")
    ),
    customerId: v.optional(v.string()),
    bundleId: v.optional(v.id("subscriptionBundles")),
    productId: v.optional(v.id("catalogProducts")),
    entitlementId: v.optional(v.id("entitlements")),
    stripeEventId: v.optional(v.string()),
    stripeObjectId: v.optional(v.string()),
    payload: v.optional(v.any()),
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check idempotency: if idempotencyKey provided and already logged, return existing
    if (args.idempotencyKey) {
      const existing = await ctx.db
        .query("events")
        .filter((q) => q.eq(q.field("idempotencyKey"), args.idempotencyKey))
        .first();
      if (existing) {
        return existing._id;
      }
    }

    const eventId = await ctx.db.insert("events", {
      eventType: args.eventType,
      actor: args.actor,
      customerId: args.customerId,
      bundleId: args.bundleId,
      productId: args.productId,
      entitlementId: args.entitlementId,
      stripeEventId: args.stripeEventId,
      stripeObjectId: args.stripeObjectId,
      payload: args.payload,
      success: args.success,
      errorMessage: args.errorMessage,
      createdAt: now,
      idempotencyKey: args.idempotencyKey,
    });
    return eventId;
  },
});