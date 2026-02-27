import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * CART SESSION TABLE
 *
 * Temporary shopping context for unauthenticated/in-progress users.
 * Stores plan selection, cadence choice, and payment method before checkout.
 *
 * Expires after 7 days (non-sticky).
 * On checkout completion, cart is archived and bundle is created.
 */
export const cartSessionsTable = defineTable({
  // SESSION IDENTITY
  sessionId: v.string(), // Browser-based session ID (UUID or hash)
  customerId: v.optional(v.string()), // Clerk user ID, if authenticated
  
  // CADENCE LOCK (chosen on entry or first item add)
  cadence: v.union(v.literal("monthly"), v.literal("annual")),
  
  // PAYMENT METHOD PREFERENCE (selected before checkout)
  paymentMethod: v.optional(v.union(v.literal("card"), v.literal("ach"))),
  
  // PLAN ITEMS (what's in the cart)
  items: v.array(
    v.object({
      productId: v.id("catalogProducts"),
      quantity: v.number(), // Usually 1, but allows multiples if needed
      addedAt: v.number(),
    })
  ),
  
  // PRICING PREVIEW (client-side calculation, not authoritative)
  pricingPreview: v.optional(v.object({
    cadence: v.union(v.literal("monthly"), v.literal("annual")),
    paymentMethod: v.union(v.literal("card"), v.literal("ach")),
    totalCents: v.number(),
    breakdown: v.optional(
      v.array(
        v.object({
          productId: v.id("catalogProducts"),
          priceCents: v.number(),
        })
      )
    ),
    calculatedAt: v.number(),
  })),
  
  // LIFECYCLE
  status: v.union(
    v.literal("active"), // In progress
    v.literal("checked_out"), // Converted to bundle
    v.literal("abandoned"), // Expired or user left
    v.literal("error") // Failed to complete
  ),
  
  // AUDIT
  createdAt: v.number(),
  lastActivityAt: v.number(), // For expiration
  checkoutInitiatedAt: v.optional(v.number()), // When user started checkout
  completedAt: v.optional(v.number()), // When payment succeeded
  
  // REFERENCE TO FINAL BUNDLE (if successful)
  finalBundleId: v.optional(v.id("subscriptionBundles")),
})
  .index("by_session_id", ["sessionId"])
  .index("by_customer", ["customerId"])
  .index("by_status", ["status"])
  .index("by_activity", ["lastActivityAt"]); // For cleanup
