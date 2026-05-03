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
    phone: v.optional(v.string()),
    role: v.union(v.literal("owner"), v.literal("editor")),
    departments: v.optional(v.array(
      v.union(
        v.literal("program_manager"),
        v.literal("fmo"),
        v.literal("broker"),
        v.literal("sales"),
        v.literal("hr"),
        v.literal("executive"),
        v.literal("admin")
      )
    )),
    commissionRate: v.optional(v.number()), // Commission percentage for brokers
    createdAt: v.number(),
  })
    .index("by_clerk_id", ["clerkUserId"])
    .index("by_departments", ["departments"]),

  // Admin invitations (invite-first flow — no Clerk account required up front)
  adminInvites: defineTable({
    email: v.string(),
    name: v.string(),
    role: v.union(v.literal("owner"), v.literal("editor")),
    departments: v.optional(v.array(
      v.union(
        v.literal("program_manager"),
        v.literal("fmo"),
        v.literal("broker"),
        v.literal("sales"),
        v.literal("hr"),
        v.literal("executive"),
        v.literal("admin")
      )
    )),
    commissionRate: v.optional(v.number()),
    inviteToken: v.string(),
    inviteStatus: v.union(v.literal("pending"), v.literal("claimed"), v.literal("cancelled")),
    inviteExpiry: v.number(),
    invitedBy: v.string(), // clerkUserId of the admin who sent the invite
    clerkUserId: v.optional(v.string()), // populated when the invite is claimed
    createdAt: v.number(),
  })
    .index("by_token", ["inviteToken"])
    .index("by_email", ["email"])
    .index("by_status", ["inviteStatus"]),

  // Admin audit trail — append-only log of admin-initiated actions.
  // Written via internal helper from admin mutations/actions; surfaced
  // in the user-audit page for compliance review.
  adminAuditLog: defineTable({
    actorClerkUserId: v.string(),       // who performed the action
    actorName: v.optional(v.string()),  // denormalized at write time for fast display
    actorRole: v.optional(v.string()),  // "owner" | "editor"
    action: v.string(),                 // e.g. "member.status_change", "subscription.cancel", "stripe.refund"
    targetType: v.optional(v.string()), // e.g. "memberProfile", "subscriptionBundle", "adminUser"
    targetId: v.optional(v.string()),   // Convex id or external id (Stripe charge, etc.)
    summary: v.string(),                // human-readable one-liner
    metadata: v.optional(v.any()),      // structured details (before/after, params)
    createdAt: v.number(),
  })
    .index("by_created", ["createdAt"])
    .index("by_actor", ["actorClerkUserId", "createdAt"])
    .index("by_action", ["action", "createdAt"])
    .index("by_target", ["targetType", "targetId", "createdAt"]),

  // ============================================
  // DISTRIBUTION PARTNERS (Program Managers, FMOs, Agencies)
  // Top-down pay chain: Carrier → Program Manager → FMO/Agency → Broker/Agent
  // ============================================
  distributionPartners: defineTable({
    name: v.string(),
    type: v.union(
      v.literal("program_manager"), // Ideal Health's direct PM partners (underwriting/management fee)
      v.literal("fmo"),             // Field Marketing Organizations (manage agents, get override)
      v.literal("agency"),          // Agencies under an FMO
    ),
    parentId: v.optional(v.id("distributionPartners")), // FMO/Agency → parent PM
    // Primary contact
    contactName: v.string(),
    contactEmail: v.string(),
    contactPhone: v.optional(v.string()),
    // Set after the contact claims their invite — grants /admin portal access for PMs/FMOs
    clerkUserId: v.optional(v.string()),
    // Invitation flow
    inviteToken: v.optional(v.string()),
    inviteStatus: v.optional(v.union(
      v.literal("pending"),
      v.literal("claimed"),
    )),
    inviteExpiry: v.optional(v.number()),
    // Commission override rate (e.g. 5 for 5%)
    overrideRate: v.optional(v.number()),
    status: v.union(
      v.literal("active"),
      v.literal("inactive"),
      v.literal("suspended"),
    ),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.optional(v.string()),
  })
    .index("by_type", ["type"])
    .index("by_parent", ["parentId"])
    .index("by_clerk_id", ["clerkUserId"])
    .index("by_invite_token", ["inviteToken"])
    .index("by_status", ["status"]),

  // Leaders / representatives for each distribution partner
  // A Program Manager, FMO, or Agency can have multiple people representing them.
  partnerLeaders: defineTable({
    partnerId: v.id("distributionPartners"),
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    title: v.optional(v.string()),   // e.g. "VP of Sales", "Account Executive"
    isPrimary: v.boolean(),
    clerkUserId: v.optional(v.string()),
    inviteToken: v.optional(v.string()),
    inviteStatus: v.optional(v.union(v.literal("pending"), v.literal("claimed"))),
    inviteExpiry: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_partner", ["partnerId"])
    .index("by_invite_token", ["inviteToken"])
    .index("by_clerk_id", ["clerkUserId"]),

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
      // Per-dependent add-on pricing (optional — if absent, dependents are included free)
      dependentMonthlyCardCents: v.optional(v.number()),
      dependentMonthlyACHCents: v.optional(v.number()),
      dependentAnnualCardCents: v.optional(v.number()),
      dependentAnnualACHCents: v.optional(v.number()),
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
      v.literal("past_due"), // Payment failed, suspended pending retry
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
    cancellationReason: v.optional(v.string()), // Reason for cancellation
    pastDueAt: v.optional(v.number()), // When bundle entered past_due status (payment failed)
    
    // PENDING TIER CHANGE (downgrade scheduled for period end)
    pendingDowngrade: v.optional(v.object({
      targetProductId: v.id("catalogProducts"),
      targetTotalCents: v.number(),
      effectiveDate: v.number(), // Unix ms — when the downgrade takes effect
      scheduledAt: v.number(), // When the user requested the downgrade
    })),
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
    
    // PROVIDER GROUP CODE (Careington/DialCare-required, e.g. "IDEALDO")
    groupCode: v.string(), // Unique code for URL and signup
    // ORGANIZATION CODE (account/card-facing org identifier, e.g. "ACME-0042" / "IDC-0001")
    // When set, member.subscriberId is backfilled from this on creation.
    organizationCode: v.optional(v.string()),
    
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

    // BROKER ATTRIBUTION (Scenario B: broker sells to company/group)
    brokerId: v.optional(v.string()), // Clerk user ID of broker who owns this group account
    brokerTrackingCode: v.optional(v.string()), // Broker's tracking code tied to this group deal

    // LIST-BILL CONFIGURATION (for FT/payroll-deducted groups)
    listBill: v.optional(v.object({
      enabled: v.boolean(),                       // true = this group uses list-bill/payroll deduction
      paymentMethod: v.union(                     // how the employer remits monthly payment
        v.literal("check"),
        v.literal("ach")
      ),
      paymentDueDayOfMonth: v.optional(v.number()), // e.g. 1 = 1st of month
      employerContactEmail: v.optional(v.string()),  // billing contact at the employer
      notes: v.optional(v.string()),
    })),
    
    // AUDIT
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.optional(v.string()),
  })
    .index("by_site", ["siteId"])
    .index("by_account", ["accountId"])
    .index("by_group_code", ["groupCode"]) // For signup resolution
    .index("by_status", ["status"])
    .index("by_broker", ["brokerId"]),

  // ============================================
  // ENROLLMENT SYSTEM - MEMBER PROFILES & CRM
  // ============================================

  // MEMBER PROFILES (Central person record)
  memberProfiles: defineTable({
    // IDENTITY
    memberId: v.string(), // Unique ID: "MBR-2026-00001" — internal person identifier
    subscriberId: v.optional(v.string()), // Account/card-facing org identifier (= organizationCode), e.g. "ACME-0042" or "IDC-0001"
    barcode: v.string(), // For ID cards / scanning
    customerId: v.optional(v.string()), // Clerk user ID
    
    // HIERARCHY
    siteId: v.id("sites"),
    accountId: v.id("accounts"),
    groupId: v.id("groups"),
    groupMemberId: v.optional(v.string()), // Company's internal employee ID
    externalMemberId: v.optional(v.string()), // Company system ID
    
    // PERSONAL INFORMATION
    title: v.optional(v.string()), // Mr, Mrs, Ms, etc.
    firstName: v.string(),
    middleName: v.optional(v.string()), // Middle name or initial
    lastName: v.string(),
    suffix: v.optional(v.string()), // Jr, Sr, II, etc.
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    workPhone: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()), // ISO format: "1990-05-15"
    effectiveDate: v.optional(v.string()), // Coverage effective date ISO: "2026-05-01"
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

    // EMPLOYEE TYPE (for employer groups: FT = list-bill/payroll, PT = direct/platform)
    employeeType: v.optional(v.union(
      v.literal("full_time"),
      v.literal("part_time")
    )),

    // LIST-BILL TRACKING (for FT members on payroll deduction)
    listBillStatus: v.optional(v.union(
      v.literal("active"),       // Currently on payroll deduction
      v.literal("termed"),       // Left payroll deduction; eligible to switch to direct pay
      v.literal("converted")     // Converted from list-bill to direct CC/ACH enrollment
    )),
    listBillTermedAt: v.optional(v.number()), // Timestamp when removed from list bill
    reenrollmentToken: v.optional(v.string()), // One-time token sent to termed ee for direct re-enrollment
    
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
    
    // VENDOR IDENTITY — CAREINGTON / DIALCARE / TOOTHLENS
    //
    // IMPORTANT: The Careington/DialCare Unique ID is ASSIGNED BY US (Ideal Health).
    // We determine this number and report it to Careington in the outbound eligibility
    // file. Careington does NOT assign it. The same ID must be shown to the member on
    // their ID card, PDF, and in all emails — so they can use it to register at
    // dialcare.com/verify and to present at dental providers.
    //
    // careingtonUniqueId  = the Unique ID we assign and submit in the Careington/DialCare
    //                       eligibility file (shared by the whole family, numeric, max 12 chars)
    // careingtonSeqNum    = "00" for primary; "01", "02"... for dependents
    // toothlensMemberId   = careingtonUniqueId + careingtonSeqNum  (e.g., "1234567801")
    //   → Careington and DialCare both use careingtonUniqueId for eligibility lookups
    //   → Toothlens uses toothlensMemberId so each family member has a distinct account
    //
    // If careingtonUniqueId is not set, the system derives it from memberId by stripping
    // non-numeric characters (see toUniqueId() in convex/admin/vendorFiles.ts). The
    // getMemberCardDataPublic query applies this same logic when building the member-facing
    // memberId so the card, PDF, and emails always match the eligibility file.
    careingtonUniqueId: v.optional(v.string()),
    careingtonSeqNum: v.optional(v.string()),
    toothlensMemberId: v.optional(v.string()),

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
      seqNum: v.optional(v.string()),            // e.g., "01", "02"
      toothlensMemberId: v.optional(v.string()),  // careingtonUniqueId + seqNum
    }))),

    // FAMILY / DEPENDENT ROLE
    memberRole: v.optional(v.union(v.literal("primary"), v.literal("dependent"))),
    primaryMemberId: v.optional(v.id("memberProfiles")),
    relationship: v.optional(v.union(
      v.literal("spouse"),
      v.literal("child"),
      v.literal("domestic_partner"),
      v.literal("other")
    )),
    inviteToken: v.optional(v.string()),
    inviteStatus: v.optional(v.union(
      v.literal("pending"),
      v.literal("claimed"),
      v.literal("expired")
    )),
    invitedEmail: v.optional(v.string()),

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
    .index("by_member_type", ["memberType"])
    .index("by_primary_member", ["primaryMemberId"])
    .index("by_invite_token", ["inviteToken"])
    .index("by_email", ["email"])
    .index("by_group_email", ["groupId", "email"])
    .index("by_careington_id", ["careingtonUniqueId"]),

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
      v.literal("dependent_added"),
      v.literal("dependent_removed"),
      v.literal("dependent_invited"),
      v.literal("dependent_claimed"),
      // Payment
      v.literal("payment_succeeded"),
      v.literal("payment_failed"),
      v.literal("payment_method_updated"),
      // Communications
      v.literal("email_sent"),
      v.literal("email_delivered"),
      v.literal("email_bounced"),
      v.literal("email_complained"),
      v.literal("email_failed"),
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
    /** Resend email ID — set on email_sent activities so we can correlate delivery events. */
    resendEmailId: v.optional(v.string()),
    /** Last known delivery status from Resend webhook (delivered, bounced, complained, etc.). */
    emailEvent: v.optional(v.string()),
    
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
    .index("by_created", ["createdAt"])
    .index("by_resend_email_id", ["resendEmailId"]),

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

    // BROKER ATTRIBUTION (Scenario A: broker sells directly to individual)
    brokerId: v.optional(v.string()), // Clerk user ID of attributed broker
    brokerTrackingCode: v.optional(v.string()), // Broker's unique tracking code used at signup
    
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
    .index("by_created", ["createdAt"])
    .index("by_broker", ["brokerId"]),

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
      v.literal("json"),
      v.literal("txt")
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
  // VENDOR FILE DELIVERIES (outbound to Careington/DialCare/etc.)
  // ============================================
  vendorDeliveries: defineTable({
    groupId: v.id("groups"),
    vendor: v.union(
      v.literal("careington"),
      v.literal("dialcare"),
      v.literal("dental_discount_network")
    ),
    vendorLabel: v.string(),                          // human-readable
    fileType: v.union(v.literal("full"), v.literal("delta")),
    filename: v.string(),
    fileBytes: v.number(),
    fileSha256: v.string(),
    storageId: v.optional(v.string()),                // Convex storage ID for the file
    memberCount: v.number(),
    rowCount: v.number(),
    method: v.union(
      v.literal("sftp"),
      v.literal("manual_download")
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("uploading"),
      v.literal("delivered"),
      v.literal("failed")
    ),
    sftpHost: v.optional(v.string()),
    sftpRemotePath: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    triggeredBy: v.optional(v.string()),              // Clerk user id
    sourceEligibilityFileId: v.optional(v.id("eligibilityFiles")),
    createdAt: v.number(),
    deliveredAt: v.optional(v.number()),
  })
    .index("by_group", ["groupId"])
    .index("by_vendor", ["vendor"])
    .index("by_status", ["status"])
    .index("by_created", ["createdAt"]),

  // ============================================
  // COMMISSION SYSTEM
  // ============================================

  // BROKER TRACKING CODES (Unique codes for URL-based attribution)
  brokerTrackingCodes: defineTable({
    // BROKER IDENTITY
    brokerId: v.string(), // Clerk user ID of the broker
    agencyId: v.optional(v.string()),

    // CODE
    code: v.string(), // Unique short code, e.g. "BRK-SMITH-01" — used in ?ref= URLs

    // OPTIONAL SCOPE (if nil, code applies to all sales by this broker)
    groupId: v.optional(v.id("groups")), // Pin code to a specific group/company deal
    siteId: v.optional(v.id("sites")),

    // USAGE TRACKING
    usageCount: v.number(), // Incremented each time code is used at enrollment
    lastUsedAt: v.optional(v.number()),

    // STATUS
    status: v.union(
      v.literal("active"),
      v.literal("inactive"),
      v.literal("revoked")
    ),

    // AUDIT
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.optional(v.string()), // Admin who generated the code
    notes: v.optional(v.string()),
  })
    .index("by_broker", ["brokerId"])
    .index("by_code", ["code"]) // Primary lookup — must be unique
    .index("by_group", ["groupId"])
    .index("by_status", ["status"]),

  // COMMISSION RATES (Broker rates and overrides)
  commissionRates: defineTable({
    // BROKER IDENTITY
    brokerId: v.string(), // Clerk user ID
    agencyId: v.optional(v.string()), // Agency this broker belongs to
    
    // RATE CONFIG
    siteId: v.optional(v.id("sites")), // Optional: site-specific rate
    groupId: v.optional(v.id("groups")), // Optional: group-specific rate (broker+group deal override)
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
    .index("by_group", ["groupId"])
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
    groupId: v.optional(v.id("groups")), // Group/company this commission belongs to (Scenario B)
    
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
    .index("by_group", ["groupId"])
    .index("by_period", ["period"])
    .index("by_status", ["status"])
    .index("by_enrollment", ["enrollmentSessionId"]),

  // ============================================
  // TOOTHLENS / AI ORAL SCANNING
  // ============================================

  // Toothlens detection user registrations (maps our members to Toothlens UIDs)
  toothlensUsers: defineTable({
    clerkUserId: v.string(),                // Clerk user ID
    memberProfileId: v.optional(v.id("memberProfiles")),
    toothlensUid: v.string(),               // UID returned from / sent to Toothlens API
    company: v.string(),                    // "idealhealth" or other company slug
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_clerk_user", ["clerkUserId"])
    .index("by_uid", ["toothlensUid"]),

  // Individual scan sessions
  toothlensScans: defineTable({
    clerkUserId: v.string(),
    toothlensUid: v.string(),               // The Toothlens UID used
    sessionId: v.string(),                  // Unique per scan
    status: v.union(
      v.literal("started"),
      v.literal("completed"),
      v.literal("cancelled"),
      v.literal("abandoned")   // User exited without completing
    ),
    scanUrl: v.optional(v.string()),        // Full selfcheck URL (kept for audit; never re-embedded)
    reportUrl: v.optional(v.string()),      // Direct report/PDF URL captured via postMessage
    forwardedToTeledentist: v.optional(v.boolean()),
    forwardedAt: v.optional(v.number()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_clerk_user", ["clerkUserId"])
    .index("by_session", ["sessionId"])
    .index("by_uid", ["toothlensUid"]),

  // Cached RyzeHealth JWT tokens — reuse until expiry per spec
  // (§2 Authentication: "Reuse the token until it expires")
  ryzehealthTokenCache: defineTable({
    authCompany: v.string(),                // e.g. "ryzehealth"
    token: v.string(),                      // JWT
    expiresAt: v.number(),                  // ms epoch — token TTL (conservative)
    updatedAt: v.number(),
  }).index("by_auth_company", ["authCompany"]),

  // ============================================
  // MEMBERSHIP AGREEMENTS & LEGAL DOCUMENTS
  // ============================================

  // MEMBERSHIP AGREEMENTS (Digital member agreements with signatures)
  membershipAgreements: defineTable({
    // MEMBER IDENTITY
    userId: v.string(), // Clerk user ID
    memberId: v.string(), // Careington member ID
    memberName: v.string(),
    memberAddress: v.string(),
    email: v.string(),

    // PLAN DETAILS
    planName: v.string(),
    groupCode: v.string(),
    term: v.string(), // "Annual", "Monthly", "Quarterly"
    effectiveDate: v.string(), // YYYY-MM-DD format

    // BILLING INFORMATION
    classification: v.string(),
    paymentMode: v.string(),
    periodicCharge: v.string(),
    processingFee: v.string(),

    // AGREEMENT ACCEPTANCE
    membershipTermsAgreed: v.boolean(),
    termsAndConditionsAgreed: v.boolean(),
    memberSignature: v.string(), // Signature image/data
    signatureTimestamp: v.number(),

    // STATUS & TRACKING
    status: v.union(
      v.literal("active"),
      v.literal("cancelled"),
      v.literal("expired")
    ),
    cancelReason: v.optional(v.string()),

    // AUDIT
    createdAt: v.number(),
    lastUpdated: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_memberId", ["memberId"])
    .index("by_email", ["email"])
    .index("by_status", ["status"])
    .index("by_date", ["createdAt"]),

  // ============================================
  // CAREINGTON ENROLLMENT RECORDS
  // Source of truth for who is enrolled with Careington,
  // directly mirrors the fields in Careington's eligibility file format.
  // ============================================

  careingtonEnrollments: defineTable({
    // HIERARCHY LINKS
    memberProfileId: v.optional(v.id("memberProfiles")), // Our internal member record
    siteId: v.optional(v.id("sites")),
    accountId: v.optional(v.id("accounts")),
    groupId: v.optional(v.id("groups")),

    // CAREINGTON IDENTITY FIELDS (from eligibility file)
    title: v.optional(v.string()),            // e.g., "Mr.", "Dr."
    firstName: v.string(),
    middleName: v.optional(v.string()),
    lastName: v.string(),
    postName: v.optional(v.string()),         // e.g., "Jr.", "Sr.", "II"
    careingtonUniqueId: v.optional(v.string()), // Careington-assigned unique member ID
    sequenceNumber: v.optional(v.string()),   // Sequence within household

    // ADDRESS
    addressLine1: v.optional(v.string()),
    addressLine2: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    zip: v.optional(v.string()),
    zipPlus4: v.optional(v.string()),

    // CONTACT
    homePhone: v.optional(v.string()),
    workPhone: v.optional(v.string()),
    email: v.optional(v.string()),

    // PLAN & GROUP
    coverage: v.optional(v.string()),         // Careington plan/coverage code
    groupCode: v.string(),                    // Careington group code

    // DATES
    effectiveDate: v.string(),                // YYYY-MM-DD — when coverage begins
    terminationDate: v.optional(v.string()),  // YYYY-MM-DD — when coverage ends (null = active)
    dateOfBirth: v.optional(v.string()),      // YYYY-MM-DD

    // DEMOGRAPHICS
    gender: v.optional(v.string()),           // "M", "F", etc.
    relation: v.optional(v.string()),         // Relationship to subscriber: "01"=self, "02"=spouse, etc.
    studentStatus: v.optional(v.string()),    // Full-time, part-time, etc.
    guardian: v.optional(v.string()),         // Guardian name if minor

    // REPORTING
    reportingSegment: v.optional(v.string()), // Careington reporting segment code

    // ENROLLMENT STATUS (our tracking, separate from Careington's file)
    enrollmentStatus: v.union(
      v.literal("pending"),          // Written but not yet delivered via SFTP
      v.literal("submitted"),        // Delivered to Careington via SFTP
      v.literal("active"),           // Confirmed active at Careington
      v.literal("pending_termination"), // Termination queued for next SFTP run
      v.literal("terminated"),       // Termination delivered and confirmed
      v.literal("rejected")          // Careington rejected this record
    ),

    // SFTP DELIVERY TRACKING
    sftpDeliveredAt: v.optional(v.number()),  // When last sent via SFTP
    sftpBatchId: v.optional(v.string()),      // Batch/file identifier
    sftpError: v.optional(v.string()),        // Error message if delivery failed

    // LEGAL AGREEMENT LINK
    membershipAgreementId: v.optional(v.id("membershipAgreements")), // The signed agreement doc

    // AUDIT
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.optional(v.string()),  // Clerk user ID
    updatedBy: v.optional(v.string()),
  })
    .index("by_member_profile", ["memberProfileId"])
    .index("by_group_code", ["groupCode"])
    .index("by_careington_unique_id", ["careingtonUniqueId"])
    .index("by_enrollment_status", ["enrollmentStatus"])
    .index("by_email", ["email"])
    .index("by_site", ["siteId"])
    .index("by_group", ["groupId"])
    .index("by_effective_date", ["effectiveDate"])
    .index("by_termination_date", ["terminationDate"])
    .index("by_sftp_batch", ["sftpBatchId"]),

  // ============================================
  // LIST-BILL PAYMENTS (monthly employer remittances for FT payroll-deduction groups)
  // ============================================
  listBillPayments: defineTable({
    groupId: v.id("groups"),
    accountId: v.id("accounts"),
    siteId: v.id("sites"),

    // Billing period (e.g. "2026-05" = May 2026)
    billingPeriod: v.string(),    // "YYYY-MM"
    periodStart: v.number(),      // Unix ms — first day of billing month
    periodEnd: v.number(),        // Unix ms — last day of billing month

    // Snapshot at time of invoice generation
    memberCount: v.number(),       // Active list-bill members in the period
    ratePerMemberCents: v.number(),// Agreed per-member rate in cents
    totalCents: v.number(),        // memberCount × ratePerMemberCents

    // Payment adjudication
    paymentMethod: v.union(
      v.literal("check"),
      v.literal("ach")
    ),
    paymentStatus: v.union(
      v.literal("pending"),
      v.literal("paid"),
      v.literal("partial"),
      v.literal("overdue")
    ),

    // Check details (when paymentMethod = "check")
    checkNumber: v.optional(v.string()),
    checkDate: v.optional(v.string()),   // ISO date "YYYY-MM-DD"

    // ACH details (when paymentMethod = "ach")
    achConfirmationNumber: v.optional(v.string()),
    achInitiatedAt: v.optional(v.number()),

    // Partial payment tracking
    amountReceivedCents: v.optional(v.number()),
    remainingCents: v.optional(v.number()),

    // Notes / reconciliation
    notes: v.optional(v.string()),
    reconciledBy: v.optional(v.string()), // admin Clerk user ID

    // Audit
    createdAt: v.number(),
    updatedAt: v.number(),
    paidAt: v.optional(v.number()),
    dueDate: v.optional(v.number()),      // Unix ms — when payment is due
  })
    .index("by_group", ["groupId"])
    .index("by_account", ["accountId"])
    .index("by_site", ["siteId"])
    .index("by_period", ["billingPeriod"])
    .index("by_group_period", ["groupId", "billingPeriod"])
    .index("by_status", ["paymentStatus"]),

  // ============================================
  // SYSTEM COUNTERS (for atomic ID generation)
  // ============================================
  counters: defineTable({
    name: v.string(),   // e.g. "memberIdSeq"
    value: v.number(),  // current counter value
  }).index("by_name", ["name"]),
});
