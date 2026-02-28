import { defineTable } from "convex/server";
import { v } from "convex/values";

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
  eventType: v.union(
    // Checkout flow
    v.literal("checkout.initiated"),
    v.literal("checkout.completed"),
    v.literal("checkout.abandoned"),
    
    // Payment events (from Stripe webhooks)
    v.literal("payment.succeeded"),
    v.literal("payment.failed"),
    v.literal("payment.requires_action"),
    
    // Subscription events
    v.literal("subscription.created"),
    v.literal("subscription.updated"),
    v.literal("subscription.scheduled_cancellation"),
    v.literal("subscription.cancelled"),
    
    // Entitlement events
    v.literal("entitlement.activated"),
    v.literal("entitlement.extended"),
    v.literal("entitlement.expired"),
    v.literal("entitlement.suspended"),
    v.literal("entitlement.revoked"),
    
    // Plan management
    v.literal("plan.added_to_cart"),
    v.literal("plan.removed_from_cart"),
    v.literal("plan.added_to_bundle"),
    v.literal("plan.removed_from_bundle"),
    v.literal("plan.cancel_scheduled"),
    
    // Admin actions
    v.literal("admin.manual_adjustment"),
    v.literal("admin.suspension"),
    v.literal("admin.resumption"),
    
    // System
    v.literal("system.migration"),
    v.literal("system.error")
  ),
  
  // ACTOR (who triggered this)
  actor: v.union(
    v.literal("system"), // Cron job, scheduled event
    v.literal("stripe"), // Webhook from Stripe
    v.literal("user"), // Customer action
    v.literal("admin") // Staff action
  ),
  
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
