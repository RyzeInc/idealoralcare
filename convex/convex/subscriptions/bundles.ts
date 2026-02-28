import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * SUBSCRIPTION BUNDLE TABLE
 *
 * Represents one customer's billing context.
 * One bundle = one recurring subscription
 * One cadence per bundle (monthly XOR annual)
 * Multiple plans within the bundle (many-to-many via entitlements)
 *
 * Design principle: Billing operates at bundle level.
 * Plans are added/removed without breaking the billing relationship.
 */
export const subscriptionBundlesTable = defineTable({
  // CUSTOMER IDENTITY
  customerId: v.string(), // Clerk user ID
  
  // BILLING CONTEXT (locked early, changed only at renewal)
  cadence: v.union(v.literal("monthly"), v.literal("annual")),
  paymentMethod: v.union(v.literal("card"), v.literal("ach")), // Chosen at checkout - ACH discount persists through renewals
  
  // STRIPE REFERENCES (narrowly scoped)
  stripeCustomerId: v.string(), // Stripe Customer object ID
  stripeSubscriptionId: v.optional(v.string()), // Stripe Subscription object ID
  stripeInvoiceId: v.optional(v.string()), // Latest invoice reference
  
  // BUNDLE LIFECYCLE
  status: v.union(
    v.literal("draft"), // Not yet paid
    v.literal("active"), // Subscription active
    v.literal("cancel_at_period_end"), // Cancellation scheduled
    v.literal("cancelled"), // Fully ended
    v.literal("payment_failed"), // Latest payment failed
    v.literal("suspended") // E.g., ACH issues
  ),
  
  // RENEWAL TRACKING (source of truth for schedule)
  currentPeriodStart: v.number(), // Unix timestamp (ms)
  currentPeriodEnd: v.number(), // Unix timestamp (ms) - next renewal date
  
  // PRICING SNAPSHOT (captured at checkout for transparency)
  pricingSnapshot: v.object({
    cadence: v.union(v.literal("monthly"), v.literal("annual")),
    paymentMethod: v.union(v.literal("card"), v.literal("ach")),
    totalCents: v.number(), // Total recurring charge
    planCount: v.number(), // How many plans in this bundle
    capturedAt: v.number(), // When this snapshot was created
  }),
  
  // AUDIT
  createdAt: v.number(),
  activatedAt: v.optional(v.number()), // When payment first succeeded
  updatedAt: v.number(),
  cancelledAt: v.optional(v.number()), // When bundle was cancelled
})
  .index("by_customer", ["customerId"])
  .index("by_status", ["status"])
  .index("by_stripe_customer", ["stripeCustomerId"])
  .index("by_stripe_subscription", ["stripeSubscriptionId"])
  .index("by_renewal_date", ["currentPeriodEnd"]);
