import { defineTable } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { requireAdmin } from "../lib/authGuards";

/**
 * EVENT LOG TABLE
 *
 * Immutable record of all meaningful state transitions.
 * The source of truth for system behavior and debugging.
 * Enables idempotency, auditability, and recoverability.
 *
 * Design principle: Events drive state changes.
 * One event = one fact that happened.
 */
export const eventsTable = defineTable({
  // EVENT IDENTITY
  eventType: v.string(), // Accepts any event type string
  
  // ACTOR (who triggered this)
  actor: v.string(), // "system" | "stripe" | "user" | "admin"
  
  // SUBJECT (what this is about)
  customerId: v.optional(v.string()), // If customer-related
  bundleId: v.optional(v.id("subscriptionBundles")), // If bundle-related
  productId: v.optional(v.id("catalogProducts")), // If product-related
  entitlementId: v.optional(v.id("entitlements")), // If entitlement-related
  
  // STRIPE CONTEXT (if applicable)
  stripeEventId: v.optional(v.string()), // Stripe event ID for deduplication
  stripeObjectId: v.optional(v.string()), // e.g., Stripe subscription ID
  
  // PAYLOAD (event-specific data)
  payload: v.optional(v.any()), // Structured data about what changed
  
  // ERROR HANDLING
  success: v.boolean(), // Did this event process successfully?
  errorMessage: v.optional(v.string()), // If not successful
  
  // AUDIT
  createdAt: v.number(),
  processedAt: v.optional(v.number()), // When we handled this
  
  // IDEMPOTENCY
  idempotencyKey: v.optional(v.string()), // For deduplication across retries
})
  .index("by_event_type", ["eventType"])
  .index("by_customer", ["customerId"])
  .index("by_bundle", ["bundleId"])
  .index("by_stripe_event", ["stripeEventId"]) // Deduplication
  .index("by_created", ["createdAt"]) // Timeline
  .index("by_success", ["success"]); // Error tracking

/**
 * Log an event to the audit trail
 * Idempotent: if idempotencyKey already exists, returns existing event
 */
export const logEvent = mutation({
  args: {
    eventType: v.string(), // One of the union values above
    actor: v.string(), // "system" | "stripe" | "user" | "admin"
    customerId: v.optional(v.string()),
    bundleId: v.optional(v.id("subscriptionBundles")),
    productId: v.optional(v.id("catalogProducts")),
    entitlementId: v.optional(v.id("entitlements")),
    stripeEventId: v.optional(v.string()),
    stripeObjectId: v.optional(v.string()),
    payload: v.optional(v.any()),
    success: v.optional(v.boolean()),
    errorMessage: v.optional(v.string()),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Admin-only access
    await requireAdmin(ctx);
    
    // Deduplication: if idempotencyKey exists, return existing event
    if (args.idempotencyKey) {
      const existing = await ctx.db
        .query("events")
        .withIndex("by_created")
        .filter((q) => q.eq(q.field("idempotencyKey"), args.idempotencyKey))
        .first();
      
      if (existing) {
        return existing;
      }
    }

    // Deduplication by Stripe event ID
    if (args.stripeEventId) {
      const existing = await ctx.db
        .query("events")
        .withIndex("by_stripe_event")
        .filter((q) => q.eq(q.field("stripeEventId"), args.stripeEventId))
        .first();
      
      if (existing) {
        return existing;
      }
    }

    // Insert new event
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
      success: args.success ?? true,
      errorMessage: args.errorMessage,
      createdAt: Date.now(),
      idempotencyKey: args.idempotencyKey,
    });

    return await ctx.db.get(eventId);
  },
});

/**
 * Get events for a specific customer
 */
export const getEventsByCustomer = query({
  args: {
    customerId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("events")
      .withIndex("by_customer")
      .filter((q) => q.eq(q.field("customerId"), args.customerId))
      .order("desc")
      .take(args.limit ?? 50);
  },
});

/**
 * Get events by type
 */
export const getEventsByType = query({
  args: {
    eventType: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("events")
      .withIndex("by_event_type")
      .filter((q) => q.eq(q.field("eventType"), args.eventType))
      .order("desc")
      .take(args.limit ?? 50);
  },
});

/**
 * Get recent events (most recent first)
 */
export const getRecentEvents = query({
  args: {
    limit: v.optional(v.number()),
    successOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Admin-only access
    await requireAdmin(ctx);
    
    let query = ctx.db
      .query("events")
      .withIndex("by_created")
      .order("desc");

    if (args.successOnly) {
      query = query.filter((q) => q.eq(q.field("success"), true));
    }

    return await query.take(args.limit ?? 100);
  },
});

/**
 * Get events for a bundle
 */
export const getEventsByBundle = query({
  args: {
    bundleId: v.id("subscriptionBundles"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("events")
      .withIndex("by_bundle")
      .filter((q) => q.eq(q.field("bundleId"), args.bundleId))
      .order("desc")
      .take(args.limit ?? 50);
  },
});

/**
 * Get events by actor (system, stripe, user, admin)
 */
export const getEventsByActor = query({
  args: {
    actor: v.string(), // "system" | "stripe" | "user" | "admin"
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const allEvents = await ctx.db
      .query("events")
      .withIndex("by_created")
      .order("desc")
      .take(args.limit ?? 100);

    return allEvents.filter((event) => event.actor === args.actor);
  },
});