import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ============================================
  // ADMIN-EDITABLE CONTENT
  // ============================================

  // Site settings (single document pattern)
  siteSettings: defineTable({
    key: v.string(), // "main" - only one document
    siteName: v.string(),
    tagline: v.string(),
    description: v.string(),
    contactEmail: v.string(),
    supportEmail: v.optional(v.string()),
    socialTwitter: v.optional(v.string()),
    socialLinkedin: v.optional(v.string()),
    socialGithub: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  // Team members (editable via admin)
  teamMembers: defineTable({
    name: v.string(),
    role: v.union(
      v.literal("Co-Founder & Operator"),
      v.literal("Co-Founder & Partner"),
      v.literal("Advisor"),
      v.literal("Team Member")
    ),
    bio: v.string(),
    experience: v.array(
      v.object({
        title: v.string(),
        description: v.string(),
      })
    ),
    linkedin: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    order: v.number(), // Display order
    isVisible: v.boolean(), // Show/hide toggle
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_visible", ["isVisible"])
    .index("by_order", ["order"]),

  // Portfolio ventures (editable via admin)
  ventures: defineTable({
    slug: v.string(),
    name: v.string(),
    tagline: v.string(),
    description: v.string(),
    problem: v.string(),
    solution: v.string(),
    category: v.union(
      v.literal("Apps"),
      v.literal("Partnerships"),
      v.literal("In Development")
    ),
    status: v.union(
      v.literal("Active"),
      v.literal("In Development"),
      v.literal("Coming Soon")
    ),
    link: v.optional(v.string()),
    values: v.array(v.string()), // Core values
    metrics: v.optional(
      v.array(
        v.object({
          label: v.string(),
          value: v.string(),
        })
      )
    ),
    features: v.optional(v.array(v.string())),
    order: v.number(), // Display order
    isVisible: v.boolean(), // Show/hide toggle
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_category", ["category"])
    .index("by_status", ["status"])
    .index("by_visible", ["isVisible"])
    .index("by_order", ["order"]),

  // Navigation items (editable via admin)
  navigationItems: defineTable({
    name: v.string(),
    href: v.string(),
    order: v.number(),
    isVisible: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_visible", ["isVisible"])
    .index("by_order", ["order"]),

  // Core values (editable via admin)
  coreValues: defineTable({
    name: v.string(),
    description: v.string(),
    order: v.number(),
    isVisible: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_visible", ["isVisible"])
    .index("by_order", ["order"]),

  // Admin users (who can edit)
  adminUsers: defineTable({
    clerkUserId: v.string(),
    email: v.string(),
    name: v.string(),
    role: v.union(v.literal("owner"), v.literal("editor")),
    createdAt: v.number(),
  }).index("by_clerk_id", ["clerkUserId"]),

  // ============================================
  // FORM SUBMISSIONS (existing)
  // ============================================

  // Contact form submissions
  contactSubmissions: defineTable({
    name: v.string(),
    email: v.string(),
    subject: v.string(),
    message: v.string(),
    status: v.union(v.literal("new"), v.literal("read"), v.literal("replied")),
    createdAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_email", ["email"]),

  // Partnership/Investment/Career inquiries
  inquiries: defineTable({
    // Common fields
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    inquiryType: v.union(
      v.literal("partnership"),
      v.literal("investment"),
      v.literal("careers"),
      v.literal("other")
    ),
    
    // Partnership-specific fields
    companyName: v.optional(v.string()),
    industry: v.optional(v.string()),
    partnershipDescription: v.optional(v.string()),
    timeline: v.optional(v.string()),
    
    // Investment-specific fields
    investmentType: v.optional(v.string()),
    amountRange: v.optional(v.string()),
    investmentDescription: v.optional(v.string()),
    
    // Careers-specific fields
    positionInterest: v.optional(v.string()),
    careerIntro: v.optional(v.string()),
    
    // Other
    otherMessage: v.optional(v.string()),
    
    // Meta
    status: v.union(
      v.literal("new"),
      v.literal("reviewing"),
      v.literal("contacted"),
      v.literal("closed")
    ),
    createdAt: v.number(),
  })
    .index("by_type", ["inquiryType"])
    .index("by_status", ["status"])
    .index("by_email", ["email"]),

  // Newsletter subscriptions
  newsletterSubscriptions: defineTable({
    email: v.string(),
    subscribedAt: v.number(),
    status: v.union(v.literal("active"), v.literal("unsubscribed")),
  }).index("by_email", ["email"]),

  // ============================================
  // NEXUS BENEFITS PORTAL
  // ============================================

  // Nexus product categories
  nexusCategories: defineTable({
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()), // Lucide icon name
    color: v.optional(v.string()), // Tailwind color class
    order: v.number(),
    isVisible: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_visible", ["isVisible"])
    .index("by_order", ["order"]),

  // Nexus products/services
  nexusProducts: defineTable({
    categoryId: v.id("nexusCategories"),
    name: v.string(),
    slug: v.string(),
    provider: v.optional(v.string()), // e.g., "Legal Club of America", "TallyUp"
    description: v.optional(v.string()),
    shortDescription: v.optional(v.string()), // For card display
    icon: v.optional(v.string()), // Lucide icon name
    flyerUrl: v.optional(v.string()), // URL to flyer PDF/image
    flyerStorageId: v.optional(v.id("_storage")), // Convex storage ID for flyer
    externalLink: v.optional(v.string()), // Link to external resource
    features: v.optional(v.array(v.string())),
    order: v.number(),
    isVisible: v.boolean(),
    isFeatured: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_category", ["categoryId"])
    .index("by_slug", ["slug"])
    .index("by_visible", ["isVisible"])
    .index("by_featured", ["isFeatured"])
    .index("by_order", ["order"]),

  // Nexus portal leads (email capture)
  nexusLeads: defineTable({
    name: v.string(),
    email: v.string(),
    company: v.optional(v.string()),
    accessGrantedAt: v.number(),
    lastAccessedAt: v.number(),
    accessCount: v.number(),
    source: v.optional(v.string()), // UTM or referral source
    status: v.union(
      v.literal("active"),
      v.literal("contacted"),
      v.literal("converted"),
      v.literal("inactive")
    ),
    notes: v.optional(v.string()),
  })
    .index("by_email", ["email"])
    .index("by_status", ["status"])
    .index("by_access", ["lastAccessedAt"]),

  // ============================================
  // HEALTH PLANS CATALOG & SUBSCRIPTION SYSTEM
  // (Product-Led, Entitlement-Driven Commerce)
  // ============================================

  // CATALOG LAYER (what we're selling - independent of payment)
  catalogProducts: defineTable({
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
    .index("by_order", ["order"]),

  // SUBSCRIPTION BUNDLE (billing context: one per customer at a time)
  subscriptionBundles: defineTable({
    // CUSTOMER IDENTITY
    customerId: v.string(), // Clerk user ID
    
    // BILLING CONTEXT (locked early, changed only at renewal)
    cadence: v.union(v.literal("monthly"), v.literal("annual")),
    paymentMethod: v.union(v.literal("card"), v.literal("ach")), // Chosen at checkout
    
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
    .index("by_renewal_date", ["currentPeriodEnd"]),

  // ENTITLEMENT LEDGER (source of truth for access)
  entitlements: defineTable({
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
    .index("by_stripe_item", ["stripeSubscriptionItemId"]),

  // EVENT LOG (immutable record of all state transitions)
  events: defineTable({
    // EVENT IDENTITY
    eventType: v.string(),
    
    // ACTOR (who triggered this)
    actor: v.string(),
    
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
    .index("by_success", ["success"]), // Error tracking

  // CART SESSION (temporary shopping context)
  cartSessions: defineTable({
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
    .index("by_activity", ["lastActivityAt"]), // For cleanup

  // ============================================
  // ENROLLMENT SYSTEM - HIERARCHY
  // ============================================
  
  // SITES (Brand/Domain level - white-label container)
  sites: defineTable({
    slug: v.string(), // URL-safe identifier: "ryze-health", "acme-dental"
    name: v.string(), // Display name: "Ideal Oral Health"
    type: v.union(
      v.literal("primary"), // Our main brand
      v.literal("whitelabel"), // Client-owned white-label
      v.literal("channel") // Channel partner
    ),
    
    // CUSTOM DOMAIN SUPPORT
    domain: v.optional(v.string()), // e.g., "acme-dental.com" for white-label
    basePath: v.optional(v.string()), // e.g., "/benefits" for multi-tenant path
    
    // BRANDING
    branding: v.object({
      logoUrl: v.optional(v.string()),
      logoStorageId: v.optional(v.id("_storage")),
      faviconUrl: v.optional(v.string()),
      primaryColor: v.optional(v.string()), // CSS color
      secondaryColor: v.optional(v.string()),
      accentColor: v.optional(v.string()),
      heroHeadline: v.optional(v.string()),
      heroSubtext: v.optional(v.string()),
      heroImageUrl: v.optional(v.string()),
      customCSS: v.optional(v.string()), // Custom CSS overrides
      footerText: v.optional(v.string()),
    }),
    
    // PRODUCT CATALOG SETTINGS
    allowedPlanIds: v.array(v.id("catalogProducts")), // Which products available at this site
    defaultCadence: v.optional(v.union(v.literal("monthly"), v.literal("annual"))),
    defaultPaymentMethod: v.optional(v.union(v.literal("card"), v.literal("ach"))),
    
    // ENROLLMENT FLOW CONFIGURATION
    enrollmentDefaults: v.object({
      requireGroupCode: v.boolean(), // Must user enter a group code?
      requireEligibilityMatch: v.boolean(), // Must match eligibility file?
      allowSelfEnrollment: v.boolean(), // Can user enroll themselves?
      requirePayment: v.boolean(), // Must user enter payment?
      autoActivate: v.boolean(), // Immediately activate after checkout?
      collectAddress: v.boolean(),
      collectPhone: v.boolean(),
      collectEmployeeId: v.boolean(),
      collectDependents: v.optional(v.boolean()),
      termsDocumentUrl: v.optional(v.string()),
      privacyPolicyUrl: v.optional(v.string()),
      welcomeMessage: v.optional(v.string()),
      supportEmail: v.optional(v.string()),
      supportPhone: v.optional(v.string()),
    }),
    
    // STATUS
    status: v.union(
      v.literal("onboarding"),
      v.literal("active"),
      v.literal("suspended"),
      v.literal("terminated")
    ),
    
    // AUDIT
    createdAt: v.number(),
    updatedAt: v.number(),
    activatedAt: v.optional(v.number()),
    terminatedAt: v.optional(v.number()),
    createdBy: v.optional(v.string()), // Clerk user ID
  })
    .index("by_slug", ["slug"])
    .index("by_domain", ["domain"])
    .index("by_status", ["status"]),

  // ACCOUNTS (Business entity - customer, partner, employer)
  accounts: defineTable({
    siteId: v.id("sites"), // Parent site
    slug: v.string(), // URL-safe identifier
    name: v.string(), // Display name
    accountType: v.union(
      v.literal("owner"), // Site owner
      v.literal("employer"), // B2B employer
      v.literal("broker"), // Broker/consultant
      v.literal("franchisee"), // Franchise partner
      v.literal("partner"), // Other partner
      v.literal("individual") // Individual (DTC)
    ),
    
    // BILLING CONFIGURATION
    billingModel: v.union(
      v.literal("per_member"), // Charge per enrolled member
      v.literal("flat_rate"), // Fixed monthly/annual fee
      v.literal("direct"), // Direct payment (no B2B billing)
      v.literal("subsidized"), // Employer subsidizes portion
      v.literal("tiered") // Tiered based on member count
    ),
    billingDetails: v.optional(v.object({
      perMemberRateCents: v.optional(v.number()), // For per_member model
      flatRateCents: v.optional(v.number()), // For flat_rate model
      subsidyPercentage: v.optional(v.number()), // 0-100, for subsidized
      tieredRates: v.optional(v.array(v.object({
        minMembers: v.number(),
        maxMembers: v.optional(v.number()),
        rateCents: v.number(),
      }))),
      billingCadence: v.optional(v.union(v.literal("monthly"), v.literal("annual"))),
      stripeCustomerId: v.optional(v.string()),
      paymentTermDays: v.optional(v.number()), // Net 30, etc.
    })),
    
    // CUSTOM PRICING (overrides catalog prices)
    customPricing: v.optional(v.array(v.object({
      productId: v.id("catalogProducts"),
      monthlyCardCents: v.optional(v.number()),
      monthlyACHCents: v.optional(v.number()),
      annualCardCents: v.optional(v.number()),
      annualACHCents: v.optional(v.number()),
    }))),
    
    // ENROLLMENT OVERRIDES (overrides site defaults)
    enrollmentOverrides: v.optional(v.object({
      requireGroupCode: v.optional(v.boolean()),
      requireEligibilityMatch: v.optional(v.boolean()),
      allowSelfEnrollment: v.optional(v.boolean()),
      requirePayment: v.optional(v.boolean()),
      autoActivate: v.optional(v.boolean()),
      collectAddress: v.optional(v.boolean()),
      collectPhone: v.optional(v.boolean()),
      collectEmployeeId: v.optional(v.boolean()),
      termsDocumentUrl: v.optional(v.string()),
      welcomeMessage: v.optional(v.string()),
    })),
    
    // CONTACTS
    contacts: v.array(v.object({
      name: v.string(),
      email: v.string(),
      phone: v.optional(v.string()),
      role: v.union(
        v.literal("primary"),
        v.literal("billing"),
        v.literal("technical"),
        v.literal("enrollment_admin"),
        v.literal("hr"),
        v.literal("broker_contact")
      ),
    })),
    
    // STATUS & LIFECYCLE
    status: v.union(
      v.literal("onboarding"),
      v.literal("active"),
      v.literal("suspended"),
      v.literal("terminated")
    ),
    contractStartDate: v.optional(v.number()),
    contractEndDate: v.optional(v.number()),
    
    // AUDIT
    createdAt: v.number(),
    updatedAt: v.number(),
    activatedAt: v.optional(v.number()),
    terminatedAt: v.optional(v.number()),
    createdBy: v.optional(v.string()),
  })
    .index("by_site", ["siteId"])
    .index("by_slug", ["slug"])
    .index("by_status", ["status"]),

  // GROUPS (Enrollment groups - departments, subsidiaries, etc.)
  groups: defineTable({
    siteId: v.id("sites"), // Grandparent site
    accountId: v.id("accounts"), // Parent account
    slug: v.string(), // URL-safe identifier
    name: v.string(), // Display name
    description: v.optional(v.string()),
    
    // GROUP CODE FOR ENROLLMENT
    groupCode: v.string(), // Unique code for URL and signup
    
    // PLAN & PRICING CONSTRAINTS
    allowedPlanIds: v.optional(v.array(v.id("catalogProducts"))), // null = inherit from account/site
    customPricing: v.optional(v.array(v.object({
      productId: v.id("catalogProducts"),
      monthlyCardCents: v.optional(v.number()),
      monthlyACHCents: v.optional(v.number()),
      annualCardCents: v.optional(v.number()),
      annualACHCents: v.optional(v.number()),
    }))),
    
    // ENROLLMENT OVERRIDES (most specific level)
    enrollmentOverrides: v.optional(v.object({
      requireGroupCode: v.optional(v.boolean()),
      requireEligibilityMatch: v.optional(v.boolean()),
      allowSelfEnrollment: v.optional(v.boolean()),
      requirePayment: v.optional(v.boolean()),
      autoActivate: v.optional(v.boolean()),
      collectAddress: v.optional(v.boolean()),
      collectPhone: v.optional(v.boolean()),
      collectEmployeeId: v.optional(v.boolean()),
      termsDocumentUrl: v.optional(v.string()),
      welcomeMessage: v.optional(v.string()),
    })),
    
    // CAPACITY
    maxMembers: v.optional(v.number()), // null = unlimited
    
    // STATUS & LIFECYCLE
    status: v.union(
      v.literal("active"),
      v.literal("suspended"),
      v.literal("closed")
    ),
    effectiveDate: v.optional(v.number()),
    terminationDate: v.optional(v.number()),
    
    // AUDIT
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.optional(v.string()),
  })
    .index("by_site", ["siteId"])
    .index("by_account", ["accountId"])
    .index("by_group_code", ["groupCode"]) // For signup resolution
    .index("by_status", ["status"]),

  // ============================================
  // ENROLLMENT SYSTEM - MEMBER PROFILES & CRM
  // ============================================

  // MEMBER PROFILES (Central person record)
  memberProfiles: defineTable({
    // IDENTITY
    memberId: v.string(), // Unique ID: "MBR-2026-00001"
    barcode: v.string(), // For ID cards / scanning
    customerId: v.optional(v.string()), // Clerk user ID
    
    // HIERARCHY
    siteId: v.id("sites"),
    accountId: v.id("accounts"),
    groupId: v.id("groups"),
    groupMemberId: v.optional(v.string()), // Company's internal employee ID
    externalMemberId: v.optional(v.string()), // Company system ID
    
    // PERSONAL INFORMATION
    firstName: v.string(),
    lastName: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()), // ISO format: "1990-05-15"
    gender: v.optional(v.union(
      v.literal("male"),
      v.literal("female"),
      v.literal("non_binary"),
      v.literal("prefer_not_to_say"),
      v.literal("other")
    )),
    preferredLanguage: v.optional(v.string()),
    
    // ADDRESS
    address: v.optional(v.object({
      line1: v.string(),
      line2: v.optional(v.string()),
      city: v.string(),
      state: v.string(),
      postalCode: v.string(),
      country: v.string(),
    })),
    
    // EMERGENCY CONTACT
    emergencyContact: v.optional(v.object({
      name: v.string(),
      phone: v.string(),
      relationship: v.optional(v.string()),
    })),
    
    // PHOTO
    photoUrl: v.optional(v.string()),
    photoStorageId: v.optional(v.id("_storage")),
    
    // STAFF ASSIGNMENT
    assignedStaffId: v.optional(v.id("adminUsers")),
    assignedStaffName: v.optional(v.string()),
    assignedAt: v.optional(v.number()),
    
    // MEMBER STATUS
    memberType: v.union(
      v.literal("lead"), // Prospect
      v.literal("eligible"), // Matches eligibility file
      v.literal("enrolling"), // In enrollment flow
      v.literal("active"), // Enrolled and active
      v.literal("inactive"), // No active plans
      v.literal("terminated"), // Removed
      v.literal("declined") // Declined enrollment
    ),
    
    leadType: v.optional(v.union(
      v.literal("walk_in"),
      v.literal("referral"),
      v.literal("group_eligible"),
      v.literal("campaign"),
      v.literal("inbound"),
      v.literal("outbound"),
      v.literal("partner")
    )),
    
    signupSource: v.optional(v.string()), // UTM or source tracking
    
    // ENROLLMENT REFERENCES
    enrollmentSessionId: v.optional(v.id("enrollmentSessions")),
    enrolledBundleId: v.optional(v.id("subscriptionBundles")),
    enrolledAt: v.optional(v.number()),
    eligibilityFileId: v.optional(v.id("eligibilityFiles")),
    
    // DEPENDENTS
    dependents: v.optional(v.array(v.object({
      firstName: v.string(),
      lastName: v.string(),
      dateOfBirth: v.optional(v.string()),
      relationship: v.union(
        v.literal("spouse"),
        v.literal("child"),
        v.literal("domestic_partner"),
        v.literal("other")
      ),
    }))),
    
    // COMMUNICATION PREFERENCES
    communicationPrefs: v.optional(v.object({
      emailOptIn: v.boolean(),
      smsOptIn: v.boolean(),
      callOptIn: v.boolean(),
      preferredChannel: v.optional(v.union(
        v.literal("email"),
        v.literal("sms"),
        v.literal("phone")
      )),
    })),
    
    // STATUS
    status: v.union(
      v.literal("active"),
      v.literal("inactive"),
      v.literal("suspended"),
      v.literal("terminated")
    ),
    
    // AUDIT
    createdAt: v.number(),
    updatedAt: v.number(),
    lastActivityAt: v.optional(v.number()),
    createdBy: v.optional(v.string()),
  })
    .index("by_site", ["siteId"])
    .index("by_account", ["accountId"])
    .index("by_group", ["groupId"])
    .index("by_member_id", ["memberId"])
    .index("by_customer", ["customerId"])
    .index("by_status", ["status"])
    .index("by_member_type", ["memberType"]),

  // MEMBER ACTIVITIES (Timeline/activity log)
  memberActivities: defineTable({
    memberProfileId: v.id("memberProfiles"),
    siteId: v.id("sites"),
    groupId: v.id("groups"),
    
    activityType: v.union(
      // Enrollment lifecycle
      v.literal("lead_created"),
      v.literal("eligibility_verified"),
      v.literal("enrollment_started"),
      v.literal("enrollment_completed"),
      v.literal("plan_activated"),
      v.literal("plan_cancelled"),
      v.literal("plan_reactivated"),
      v.literal("plan_changed"),
      // Payment
      v.literal("payment_succeeded"),
      v.literal("payment_failed"),
      v.literal("payment_method_updated"),
      // Communications
      v.literal("email_sent"),
      v.literal("email_opened"),
      v.literal("email_clicked"),
      v.literal("sms_sent"),
      v.literal("sms_delivered"),
      v.literal("call_made"),
      v.literal("call_received"),
      // Admin
      v.literal("staff_assigned"),
      v.literal("note_added"),
      v.literal("waiver_signed"),
      v.literal("profile_updated"),
      v.literal("status_changed"),
      v.literal("group_transferred"),
      // System
      v.literal("login"),
      v.literal("portal_accessed"),
      v.literal("document_viewed"),
      v.literal("custom")
    ),
    
    title: v.string(),
    description: v.optional(v.string()),
    metadata: v.optional(v.any()),
    
    actorType: v.union(
      v.literal("system"),
      v.literal("member"),
      v.literal("staff"),
      v.literal("admin")
    ),
    actorId: v.optional(v.string()),
    actorName: v.optional(v.string()),
    
    createdAt: v.number(),
  })
    .index("by_member", ["memberProfileId"])
    .index("by_group", ["groupId"])
    .index("by_activity_type", ["activityType"])
    .index("by_created", ["createdAt"]),

  // MEMBER NOTES (Staff notes)
  memberNotes: defineTable({
    memberProfileId: v.id("memberProfiles"),
    siteId: v.id("sites"),
    
    content: v.string(),
    noteType: v.union(
      v.literal("general"),
      v.literal("enrollment"),
      v.literal("billing"),
      v.literal("support"),
      v.literal("compliance"),
      v.literal("follow_up"),
      v.literal("internal")
    ),
    isPinned: v.boolean(),
    
    authorId: v.string(), // Clerk user ID
    authorName: v.string(),
    
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_member", ["memberProfileId"])
    .index("by_pinned", ["isPinned"]),

  // ENROLLMENT SESSIONS (Temporary state during checkout)
  enrollmentSessions: defineTable({
    // SESSION IDENTITY
    sessionId: v.string(), // UUID
    memberId: v.optional(v.id("memberProfiles")), // Linked after personal info step
    
    // HIERARCHY CONTEXT
    siteId: v.id("sites"),
    accountId: v.id("accounts"),
    groupId: v.id("groups"),
    
    // ENROLLMENT TYPE
    enrollmentType: v.union(
      v.literal("individual"),
      v.literal("group"),
      v.literal("admin_assisted")
    ),
    
    // STEP PROGRESS
    currentStep: v.string(), // "eligibility", "plan_selection", etc.
    completedSteps: v.array(v.string()),
    
    // STEP DATA
    stepData: v.optional(v.any()), // Full EnrollmentWizardState
    
    // LINKED RESOURCES
    cartSessionId: v.optional(v.string()), // Reference to cartSessions
    finalBundleId: v.optional(v.id("subscriptionBundles")),
    
    // METADATA
    status: v.union(
      v.literal("in_progress"),
      v.literal("pending_payment"),
      v.literal("completed"),
      v.literal("abandoned"),
      v.literal("expired"),
      v.literal("failed")
    ),
    signupSource: v.optional(v.string()),
    referredByMemberId: v.optional(v.id("memberProfiles")),
    assistedBy: v.optional(v.string()), // Staff user ID
    
    // AUDIT
    createdAt: v.number(),
    updatedAt: v.number(),
    expiresAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_session_id", ["sessionId"])
    .index("by_member", ["memberId"])
    .index("by_site", ["siteId"])
    .index("by_status", ["status"])
    .index("by_created", ["createdAt"]),

  // ELIGIBILITY FILES (Uploaded member lists)
  eligibilityFiles: defineTable({
    siteId: v.id("sites"),
    accountId: v.optional(v.id("accounts")),
    groupId: v.id("groups"),
    
    fileName: v.string(),
    storageId: v.optional(v.string()), // Storage ID from Convex _storage
    fileType: v.union(
      v.literal("csv"),
      v.literal("xlsx"),
      v.literal("json")
    ),
    
    // PROCESSING STATUS
    status: v.union(
      v.literal("uploaded"),
      v.literal("validating"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("completed_with_errors"),
      v.literal("failed")
    ),
    
    // METRICS
    totalRecords: v.number(),
    processedRecords: v.number(),
    errorRecords: v.number(),
    newMembers: v.number(),
    updatedMembers: v.number(),
    terminatedMembers: v.number(),
    
    // ERRORS
    errors: v.optional(v.array(v.object({
      row: v.number(),
      field: v.optional(v.string()),
      message: v.string(),
    }))),
    
    // FILE ACTION
    fileAction: v.union(
      v.literal("full_replace"),
      v.literal("additions"),
      v.literal("terminations"),
      v.literal("delta")
    ),
    
    // AUDIT
    uploadedBy: v.optional(v.string()), // Clerk user ID
    uploadedAt: v.number(),
    processedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index("by_group", ["groupId"])
    .index("by_status", ["status"]),

  // ============================================
  // COMMISSION SYSTEM
  // ============================================

  // COMMISSION RATES (Broker rates and overrides)
  commissionRates: defineTable({
    // BROKER IDENTITY
    brokerId: v.string(), // Clerk user ID
    agencyId: v.optional(v.string()), // Agency this broker belongs to
    
    // RATE CONFIG
    siteId: v.optional(v.id("sites")), // Optional: site-specific rate
    ratePercentage: v.number(), // Base rate as decimal (e.g., 0.25 for 25%)
    overridePercentage: v.optional(v.number()), // Agency-level override per Feb 27 meeting
    
    // EFFECTIVE DATES
    effectiveFrom: v.number(), // Timestamp
    effectiveTo: v.optional(v.number()), // Timestamp, undefined = ongoing
    
    // STATUS
    status: v.union(
      v.literal("active"),
      v.literal("inactive"),
      v.literal("archived")
    ),
    
    // AUDIT
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.optional(v.string()), // Clerk user ID of admin who created
  })
    .index("by_broker", ["brokerId"])
    .index("by_agency", ["agencyId"])
    .index("by_status", ["status"])
    .index("by_date_range", ["effectiveFrom", "effectiveTo"]),

  // COMMISSION PAYABLES (Detailed commission records owed to brokers)
  commissionPayables: defineTable({
    // BROKER IDENTITY
    brokerId: v.string(), // Clerk user ID
    agencyId: v.optional(v.string()), // For rollup/reporting
    
    // ENROLLMENT REFERENCE
    enrollmentSessionId: v.optional(v.id("enrollmentSessions")),
    memberId: v.optional(v.id("memberProfiles")),
    
    // RATE APPLIED
    rateApplied: v.number(), // Base rate as decimal
    overrideApplied: v.optional(v.number()), // Agency override if any
    
    // AMOUNT CALCULATIONS
    amount: v.number(), // Commission amount in cents
    period: v.string(), // "2026-03" YYYY-MM format for monthly reconciliation
    
    // STATUS
    status: v.union(
      v.literal("pending"), // Commission earned, awaiting approval
      v.literal("approved"), // Approved for payout
      v.literal("paid"), // Payout processed
      v.literal("disputed"), // Under dispute/review
      v.literal("voided") // Canceled (e.g., member cancellation)
    ),
    paidAt: v.optional(v.number()), // Timestamp of payout
    
    // AUDIT
    createdAt: v.number(),
    updatedAt: v.number(),
    notes: v.optional(v.string()),
  })
    .index("by_broker", ["brokerId"])
    .index("by_agency", ["agencyId"])
    .index("by_period", ["period"])
    .index("by_status", ["status"])
    .index("by_enrollment", ["enrollmentSessionId"]),
});
