import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * CATALOG PRODUCTS TABLE
 *
 * This is the source of truth for all plan types.
 * Products are modular "capabilities" - not SKUs.
 * Pricing is attached separately; billing is an execution layer.
 *
 * Design principle: Catalog is independent of payment.
 * Stripe never sees or defines these.
 */
export const catalogProductsTable = defineTable({
  // IDENTITY
  slug: v.string(), // Unique, URL-safe identifier
  name: v.string(), // Display name
  category: v.string(), // "dental", "wellness", "vision", etc.
  
  // VALUE DEFINITION
  description: v.string(), // Short marketing description
  longDescription: v.optional(v.string()), // Detailed explanation
  inclusions: v.array(v.string()), // What's included (bullet points)
  exclusions: v.array(v.string()), // What's NOT included (prevents misinterpretation)
  
  // ELIGIBILITY & DISCLOSURE
  eligibilityRules: v.object({
    minAge: v.optional(v.number()),
    maxAge: v.optional(v.number()),
    requiresVerification: v.boolean(), // e.g., ACH requires bank verification
    disclosureText: v.string(), // "This is not insurance", etc.
  }),
  
  // ACTIVATION SEMANTICS
  activationBehavior: v.union(
    v.literal("immediate"), // User gets access instantly
    v.literal("next_renewal"), // Access starts on next billing cycle
    v.literal("verified_then_immediate") // E.g., ACH pending verification
  ),
  
  // PRICING (decoupled from product definition)
  pricing: v.object({
    monthlyCardCents: v.number(), // Price for monthly cadence, card payment
    monthlyACHCents: v.number(), // Price for monthly cadence, ACH (with discount)
    annualCardCents: v.number(), // Price for annual cadence, card payment
    annualACHCents: v.number(), // Price for annual cadence, ACH (with discount)
  }),
  
  // STRIPE PRODUCT MAPPING (narrow: only for price lookups)
  stripeProducts: v.optional(v.object({
    monthlyCardId: v.optional(v.string()), // Stripe Product ID for monthly card billing
    monthlyACHId: v.optional(v.string()), // Stripe Product ID for monthly ACH billing
    annualCardId: v.optional(v.string()), // Stripe Product ID for annual card billing
    annualACHId: v.optional(v.string()), // Stripe Product ID for annual ACH billing
  })),
  
  // METADATA
  metadata: v.optional(v.object({
    icon: v.optional(v.string()), // Lucide icon name
    color: v.optional(v.string()), // Tailwind color
    bestFor: v.optional(v.array(v.string())), // "Individuals", "Families", etc.
    recommendedAddOns: v.optional(v.array(v.id("catalogProducts"))), // Cross-sell
  })),
  
  // LIFECYCLE
  isVisible: v.boolean(), // Show in catalog
  isFeatured: v.boolean(), // Highlight in recommendations
  order: v.number(), // Display sort order
  
  // AUDIT
  createdAt: v.number(),
  updatedAt: v.number(),
  createdBy: v.optional(v.string()), // Admin user ID from Clerk
  updatedBy: v.optional(v.string()),
})
  .index("by_slug", ["slug"])
  .index("by_category", ["category"])
  .index("by_visible", ["isVisible"])
  .index("by_featured", ["isFeatured"])
  .index("by_order", ["order"]);
