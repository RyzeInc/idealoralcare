import { defineTable } from "convex/server";
import { v } from "convex/values";

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
