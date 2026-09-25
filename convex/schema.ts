import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { shopNetworkValidator } from "./shop/constants";
import { promoLinkValidator } from "./lib/promoLinks";

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
    // 4-digit numeric agency code, e.g. "1000". First rep = XXXX01, next = XXXX02, etc.
    agencyCode: v.optional(v.string()),
    // Agreement terms, as YYYY-MM-DD. Informational: `status` still gates access.
    effectiveDate: v.optional(v.string()),
    terminationDate: v.optional(v.string()),
    npn: v.optional(v.string()), // National Producer Number of the organization
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.optional(v.string()),
  })
    .index("by_type", ["type"])
    .index("by_parent", ["parentId"])
    .index("by_clerk_id", ["clerkUserId"])
    .index("by_invite_token", ["inviteToken"])
    .index("by_status", ["status"])
    .index("by_agency_code", ["agencyCode"]),

  // Leaders / representatives for each distribution partner
  // A Program Manager, FMO, or Agency can have multiple people representing them.
  partnerLeaders: defineTable({
    partnerId: v.id("distributionPartners"),
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    title: v.optional(v.string()),   // e.g. "VP of Sales", "Account Executive"
    isPrimary: v.boolean(),
    // Missing fields preserve existing rep-only portal behavior.
    portalAccess: v.optional(v.boolean()),
    reportScope: v.optional(v.union(v.literal("own"), v.literal("agency"), v.literal("downline"))),
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
  // BROKER / AGENCY / REP ONBOARDING SUBMISSIONS
  // ============================================
  // Public submissions captured at /register/rep. Admins review these and then
  // promote into distributionPartners + partnerLeaders.
  repOnboardingSubmissions: defineTable({
    submissionType: v.union(
      v.literal("agency"),
      v.literal("rep"),
      v.literal("both"),
    ),
    // Broker / Agency fields
    agencyName: v.optional(v.string()),
    dba: v.optional(v.string()),
    ein: v.optional(v.string()),
    agencyNpn: v.optional(v.string()),
    primaryContactName: v.optional(v.string()),
    primaryContactEmail: v.optional(v.string()),
    primaryContactPhone: v.optional(v.string()),
    programManager: v.optional(v.string()),
    physicalAddress: v.optional(v.string()),
    mailingAddress: v.optional(v.string()),
    agencyLicenses: v.optional(v.string()),
    eoCarrier: v.optional(v.string()),
    eoExpiration: v.optional(v.string()),
    commissionTier: v.optional(v.string()),
    agencyEffectiveDate: v.optional(v.string()),
    agencyStatus: v.optional(v.string()),
    w9Status: v.optional(v.string()),
    w9ReceivedDate: v.optional(v.string()),
    paymentMethod: v.optional(v.string()),
    achAuthorizationStatus: v.optional(v.string()),
    // Front-line rep fields
    repFirstName: v.optional(v.string()),
    repLastName: v.optional(v.string()),
    repEmail: v.optional(v.string()),
    repPhone: v.optional(v.string()),
    repNpn: v.optional(v.string()),
    assignedAgency: v.optional(v.string()),
    repLicenses: v.optional(v.string()),
    repEffectiveDate: v.optional(v.string()),
    repStatus: v.optional(v.string()),
    writingNumber: v.optional(v.string()),
    // Workflow
    status: v.union(
      v.literal("new"),
      v.literal("reviewing"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
    notes: v.optional(v.string()),
    submittedFromIp: v.optional(v.string()),
    // Set during approval — links back to the created distributionPartners row
    approvedPartnerId: v.optional(v.string()),
    approvedRepLeaderId: v.optional(v.string()),
    // PIPELINE LINKS
    sourceLeadId: v.optional(v.id("partnerRegistrations")),          // lead this application was invited from
    partnerKitSubmissionId: v.optional(v.id("partnerKitSubmissions")), // matched signed Partner Kit (agreement + W-9)
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_type", ["submissionType"])
    .index("by_email", ["primaryContactEmail"])
    .index("by_rep_email", ["repEmail"])
    // Partner → their application, for the "your signed agreement" lookup.
    .index("by_approved_partner", ["approvedPartnerId"]),

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

  // Partner / agency registration leads (from /register page)
  partnerRegistrations: defineTable({
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    business: v.string(),
    wantsPartnerKit: v.boolean(),
    status: v.union(
      v.literal("new"),
      v.literal("contacted"),
      v.literal("closed"),
      v.literal("invited"),   // application invite sent, awaiting submission
      v.literal("converted"), // lead completed a Partner Application
    ),
    createdAt: v.number(),

    // PIPELINE LINKS (Lead → Application via self-serve invite)
    inviteToken: v.optional(v.string()),        // token embedded in /register/rep?leadToken=…
    inviteStatus: v.optional(v.union(v.literal("pending"), v.literal("claimed"))),
    invitedAt: v.optional(v.number()),
    convertedToApplicationId: v.optional(v.id("repOnboardingSubmissions")), // set when the lead submits an application
  })
    .index("by_status", ["status"])
    .index("by_email", ["email"])
    .index("by_invite_token", ["inviteToken"]),

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
  // PREVENTATIVE CARE SHOP (affiliate retail)
  //
  // Curated third-party products we link out to for commission. We never sell,
  // stock, or ship any of it. Deliberately separate from catalogProducts
  // (plans/entitlements) and nexusProducts (B2B partner collateral): a shop
  // item must never be presented as a plan benefit.
  // Rules: docs/internal/SHOP_DESIGN.md
  // ============================================

  // Master on/off switch for the whole storefront (single document, key "main").
  //
  // Absent means ON. The shop is live today, so the row-less state a deploy
  // lands in must not read as "off" — only an explicit toggle writes `false`.
  // This is the inverse default from `sites.shopEnabled`, which is opt-in for
  // partners who never had a shop to begin with. See SHOP_DESIGN.md rule 7.
  shopSettings: defineTable({
    key: v.string(), // "main" — only one document
    isEnabled: v.boolean(),
    updatedAt: v.number(),
    updatedBy: v.optional(v.string()), // Clerk user ID
  }).index("by_key", ["key"]),

  // Editorial grouping — "Daily Care", "Interdental", "Whitening", "Kids"
  shopCategories: defineTable({
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()), // Lucide icon name
    order: v.number(),
    isVisible: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_visible", ["isVisible"])
    .index("by_order", ["order"]),

  shopProducts: defineTable({
    // IDENTITY
    categoryId: v.id("shopCategories"),
    name: v.string(),
    slug: v.string(),
    brand: v.string(),

    // COPY
    // Descriptive only. No therapeutic or disease claims — a shop item is a
    // cosmetic or a device, and claiming it treats a condition converts it into
    // an unapproved drug claim. See SHOP_DESIGN.md hard rule 2.
    shortDescription: v.string(), // Card
    description: v.optional(v.string()), // Detail view
    highlights: v.optional(v.array(v.string())),

    // IMAGERY
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),

    // AFFILIATE
    affiliateUrl: v.string(), // Fully tagged destination, rendered as-is
    merchant: v.string(), // Display name: "Amazon", "Boka"
    network: shopNetworkValidator,
    // Internal economics — never rendered to a shopper. These are our terms
    // with the network, not the shopper's business.
    commissionRate: v.optional(v.number()), // Percent, e.g. 15 for 15%
    cookieWindowDays: v.optional(v.number()),

    // PRICE DISPLAY
    // A snapshot for orientation only, entered by an admin (no scraping). We
    // don't control merchant pricing, so this always renders as an
    // approximation qualified by priceCapturedAt.
    priceCents: v.optional(v.number()),
    priceCapturedAt: v.optional(v.number()),

    // MERCHANDISING
    order: v.number(),
    isVisible: v.boolean(),
    isFeatured: v.boolean(),

    // COUNTERS (denormalized for admin lists; shopClicks is the source of truth)
    clickCount: v.number(),
    lastClickedAt: v.optional(v.number()),

    // AUDIT
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.optional(v.string()), // Clerk user ID
    updatedBy: v.optional(v.string()),
  })
    .index("by_category", ["categoryId"])
    .index("by_slug", ["slug"])
    .index("by_visible", ["isVisible"])
    .index("by_featured", ["isFeatured"])
    .index("by_order", ["order"])
    .index("by_network", ["network"]),

  // Append-only outbound click log. Networks report conversions but never our
  // own funnel, so this is the only attribution data we own. No IP or
  // user-agent is stored — no product need, and needless PII.
  shopClicks: defineTable({
    productId: v.id("shopProducts"),
    productSlug: v.string(), // Denormalized so the row outlives the product
    siteSlug: v.optional(v.string()), // Which tenant the click came from
    network: shopNetworkValidator,
    // Recorded when a logged-in member clicks, for funnel analysis only.
    // Never used to personalize what a member is shown (hard rule 3).
    clerkUserId: v.optional(v.string()),
    referrerPath: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_product", ["productId"])
    .index("by_created", ["createdAt"])
    .index("by_site", ["siteSlug"]),

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

  // TIER-CHANGE HISTORY (added 2026-07-01 — supports point-in-time
  // reconstruction of a bundle's tier for Invoice Calculator closePeriod).
  // `subscriptionBundles.pricingSnapshot` only ever holds the CURRENT tier —
  // `processTierChange` (upgrade/downgrade) overwrites it in place with no
  // record of what the tier was before. Without this, closing/reconstructing
  // a past period after a mid-cycle tier change would use the wrong
  // (current, not as-of-period-end) tier. One row is written per superseded
  // segment — the still-current segment lives only on the bundle itself
  // (no open-ended row here).
  bundleTierHistory: defineTable({
    bundleId: v.id("subscriptionBundles"),
    customerId: v.string(), // Denormalized for convenience/future querying.
    totalCents: v.number(), // The tier's price during [effectiveFrom, effectiveTo).
    effectiveFrom: v.number(), // Unix ms — when this segment began (bundle creation or previous change).
    effectiveTo: v.number(), // Unix ms — when this segment ended (superseded by a new tier).
    reason: v.union(v.literal("upgrade"), v.literal("downgrade")),
    createdAt: v.number(),
  })
    .index("by_bundle", ["bundleId"])
    .index("by_customer", ["customerId"]),

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
      logoWidth: v.optional(v.number()), // display width in px (height scales automatically)
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

    // PREVENTATIVE CARE SHOP
    // Opt-in per site. White-label partners inherit our pages, and some have a
    // compliance posture that forbids affiliate retail — so absent/false means
    // the shop 404s for that site. See docs/internal/SHOP_DESIGN.md rule 6.
    shopEnabled: v.optional(v.boolean()),

    // THIRD-PARTY PROMO LINKS
    // A white-label partner may want to surface an offer we neither sell nor
    // underwrite — e.g. a vision carrier's own co-branded landing page. Held
    // per-site, never hardcoded into the shared pages, because every brand
    // inherits those pages: a link stored here cannot leak onto another
    // brand's site the way the hardcoded `networks` block in
    // subscriptions/queries.ts currently does.
    promoLinks: v.optional(v.array(promoLinkValidator)),


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
    // ESSENTIALS GROUP NUMBER (6-digit numeric, required by the Essentials vendor files)
    essentialsGroupNumber: v.optional(v.string()),
    
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

    // BROKER ATTRIBUTION (Scenario B: broker sells to company/group) — Clerk-free
    brokerId: v.optional(v.string()), // partnerLeaders._id of rep who owns this group deal
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
      autoIssue: v.optional(v.boolean()),           // auto-transition draft → issued on 1st of coverage month
      // Per-tier contracted rates (override dispersal defaults)
      rates: v.optional(v.object({
        moCents: v.number(),          // Member Only rate in cents
        msCents: v.number(),          // Member + Spouse rate in cents
        mfCents: v.number(),          // Member + Family rate in cents
        effectiveFrom: v.optional(v.string()), // "YYYY-MM" — applies from this period onward
        rateLabel: v.optional(v.string()),     // e.g. "Financial Shield (List Bill)"
      })),
      // Admin-configurable list-bill invoice columns. Controls which parameters
      // appear on this group's generated list-bill invoice + CSV export. Admins
      // can add/remove/reorder these dynamically (e.g. Soar wants Employee SSN,
      // Employee Name, Company Name, and Monthly Premium). When omitted, a
      // sensible default column set is used.
      invoiceColumns: v.optional(v.array(v.object({
        key: v.string(),                  // stable column identifier (e.g. "ssn", "rate", "employeeName")
        label: v.string(),                // display/header label
        enabled: v.boolean(),             // whether the column is shown
        sensitive: v.optional(v.boolean()), // true = contains PII like SSN (shows a warning)
      }))),
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

    // EMPLOYER / PAYROLL AUDIT
    ssn: v.optional(v.string()),            // Social Security Number (for audit/list-bill reporting)
    location: v.optional(v.string()),       // Sub-location within employer (e.g. "Soar 2", "SOAR II")
    department: v.optional(v.string()),     // Department within location (e.g. "NA", "Kitchen")
    monthlyPremiumCents: v.optional(v.number()), // Per-member monthly premium from the eligibility file (e.g. Soar "Approved EE Cost"). Overrides tier rate on list-bill invoices when set.
    tierCode: v.optional(v.string()),       // Raw tier code from the eligibility file (e.g. "EMP", "ESP", "ECH")
    
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

    // ESSENTIALS VENDOR ID (Lyric / QuestSelect)
    // essentialsMemberNumber = the 9-digit numeric Member Number we assign and submit in
    // the Essentials eligibility files. Lyric Telehealth and QuestSelect both look members
    // up by this value, so it must match what the member sees on their ID card and packet.
    // Derived from memberId when not explicitly set — see convex/lib/essentialsCodes.ts.
    essentialsMemberNumber: v.optional(v.string()),

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

    // DENORMALIZED REP ATTRIBUTION (cache — see convex/lib/repAttribution.ts)
    //
    // "Which rep owns this member?" is authoritatively answered by
    // RepAttributionResolver, which reads enrollmentSessions and groups. That
    // costs a full scan of both tables, so the answer is also stamped here and
    // indexed. The resolver stays the source of truth; these fields are a cache
    // that convex/insights/* reads to avoid scanning. Drift is detectable via
    // admin/repAttributionBackfill.getAttributionDrift.
    //
    // Written by: lib/memberCreation.ts (on create), enrollment/sessions.ts (on
    // session completion), admin/hierarchy.ts (when a group's broker changes),
    // and admin/repAttributionBackfill.ts (retroactively).
    attributedRepId: v.optional(v.string()),        // partnerLeaders._id
    attributedAgencyId: v.optional(v.string()),     // distributionPartners._id
    attributedCode: v.optional(v.string()),         // brokerTrackingCodes.code
    attributionSource: v.optional(v.union(
      v.literal("enrollment"),                      // Scenario A — rep sold direct
      v.literal("group"),                           // Scenario B — rep owns the employer deal
      v.literal("none")
    )),
    attributionUpdatedAt: v.optional(v.number()),

    // LIFECYCLE EXIT
    // Set when memberType moves to terminated/inactive; cleared on reactivation.
    // Without this there is no way to build a retention cohort — see
    // admin/invoiceCalculator.ts, which cannot reconstruct historical rosters.
    terminatedAt: v.optional(v.number()),

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
    .index("by_careington_id", ["careingtonUniqueId"])
    .index("by_essentials_member_number", ["essentialsMemberNumber"])
    .index("by_attributed_rep", ["attributedRepId"])
    .index("by_attributed_agency", ["attributedAgencyId"])
    .index("by_attributed_rep_type", ["attributedRepId", "memberType"])
    .index("by_attributed_agency_type", ["attributedAgencyId", "memberType"]),

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
    // Existing notes remain internal unless explicitly shared.
    visibility: v.optional(v.union(v.literal("admin"), v.literal("shared"))),
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

  // Operational alerts and document references for the member workspace.
  memberAlerts: defineTable({
    memberProfileId: v.id("memberProfiles"),
    title: v.string(),
    severity: v.union(v.literal("info"), v.literal("warning"), v.literal("urgent")),
    visibility: v.union(v.literal("admin"), v.literal("shared")),
    expiresAt: v.optional(v.number()),
    resolvedAt: v.optional(v.number()),
    resolvedBy: v.optional(v.string()),
    authorId: v.string(),
    authorName: v.string(),
    createdAt: v.number(),
  }).index("by_member", ["memberProfileId"]),

  memberDocuments: defineTable({
    memberProfileId: v.id("memberProfiles"),
    name: v.string(),
    category: v.union(v.literal("agreement"), v.literal("enrollment"), v.literal("correspondence"), v.literal("other")),
    url: v.string(),
    visibility: v.union(v.literal("admin"), v.literal("shared")),
    authorId: v.string(),
    authorName: v.string(),
    createdAt: v.number(),
  }).index("by_member", ["memberProfileId"]),

  // ── MEMBER COMMUNICATIONS ────────────────────────────────────────────
  //
  // emailSends is the authoritative log of every email we deliberately send
  // to a member — from the member detail page, from a mass send, or from a
  // production code path that routes through admin/memberEmail.ts. It is the
  // record the Communications screens read, and the Resend webhook patches
  // its status by resendEmailId as delivery events arrive.
  //
  // memberActivities still gets its own email_sent row so the member timeline
  // and the existing bounce handling keep working; emailSends is the richer,
  // queryable record (subject, body, campaign, who sent it, re-send lineage).
  emailSends: defineTable({
    // RECIPIENT
    memberProfileId: v.optional(v.id("memberProfiles")), // absent for ad-hoc addresses
    memberName: v.string(),
    memberIdCode: v.optional(v.string()), // memberProfiles.memberId, for display
    to: v.string(),
    siteId: v.optional(v.id("sites")),
    groupId: v.optional(v.id("groups")),

    // WHAT WAS SENT
    /** Registry id from lib/emailTemplates.ts, or "custom" for a one-off compose. */
    templateId: v.string(),
    templateLabel: v.string(),
    subject: v.string(),
    /** Stored only for custom sends — template sends are re-rendered on demand. */
    html: v.optional(v.string()),
    hasAttachments: v.boolean(),

    mode: v.union(
      v.literal("template"), // rendered from the registry with real member data
      v.literal("custom"), // one-off subject + body written by an admin
      v.literal("resend") // re-send of a prior emailSends row
    ),
    /** Set when mode === "resend" — the original send this one duplicates. */
    sourceSendId: v.optional(v.id("emailSends")),
    campaignId: v.optional(v.id("emailCampaigns")),

    // DELIVERY
    status: v.union(
      v.literal("queued"),
      v.literal("sent"),
      v.literal("failed"),
      v.literal("delivered"),
      v.literal("bounced"),
      v.literal("complained"),
      v.literal("opened"),
      v.literal("clicked")
    ),
    resendEmailId: v.optional(v.string()),
    error: v.optional(v.string()),

    // AUDIT
    sentBy: v.optional(v.string()), // Clerk user ID of the admin, or "system"
    sentByName: v.optional(v.string()),
    createdAt: v.number(),
    sentAt: v.optional(v.number()),
    lastEventAt: v.optional(v.number()),
  })
    .index("by_member", ["memberProfileId"])
    .index("by_campaign", ["campaignId"])
    .index("by_resend_email_id", ["resendEmailId"])
    .index("by_created", ["createdAt"])
    .index("by_status", ["status"])
    .index("by_template", ["templateId"]),

  // One mass-send. Individual recipients are emailSends rows pointing here.
  emailCampaigns: defineTable({
    name: v.string(),
    templateId: v.string(),
    templateLabel: v.string(),
    subject: v.string(),
    html: v.optional(v.string()), // custom-compose body, so the campaign can be re-run
    mode: v.union(v.literal("template"), v.literal("custom"), v.literal("resend")),

    recipientCount: v.number(),
    sentCount: v.number(),
    failedCount: v.number(),

    status: v.union(
      v.literal("queued"),
      v.literal("sending"),
      v.literal("completed"),
      v.literal("completed_with_errors")
    ),

    createdBy: v.optional(v.string()),
    createdByName: v.optional(v.string()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_created", ["createdAt"])
    .index("by_status", ["status"]),

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

    // BROKER ATTRIBUTION (Scenario A: broker sells directly to individual) — Clerk-free.
    // Canonical "who is the rep for this sale" record.
    brokerId: v.optional(v.string()), // partnerLeaders._id of attributed rep
    agencyId: v.optional(v.string()), // distributionPartners._id of attributed agency
    brokerTrackingCode: v.optional(v.string()), // Rep's tracking code string used at signup
    
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
    // Source/as-of date parsed from the file name (e.g. "20260625")
    sourceDate: v.optional(v.string()),
    
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
    // BROKER IDENTITY (Clerk-free — see convex/enrollment/agents.ts)
    brokerId: v.string(), // partnerLeaders._id of the rep (placeholder until invite claimed)
    agencyId: v.optional(v.string()), // distributionPartners._id of the owning agency

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

    // URL ROUTING
    slug: v.optional(v.string()),         // canonical URL slug: lowercase [a-z0-9-] e.g. "johndoe01"
    productHint: v.optional(v.union(      // preferred landing page for this code's URL
      v.literal("essentials"),
      v.literal("oralcare"),
      v.literal("plans"),
    )),
    // Agency sequence number (1 = first rep "01", 2 = second rep "02", …)
    // Full code = agencyCode + seqNo.padStart(2,"0"), e.g. agency 1000 + seq 1 = "100001"
    agencySeqNo: v.optional(v.number()),

    // AUDIT
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.optional(v.string()), // Admin who generated the code
    notes: v.optional(v.string()),
  })
    .index("by_broker", ["brokerId"])
    .index("by_code", ["code"]) // Primary lookup — must be unique
    .index("by_slug", ["slug"]) // Secondary lookup — canonical URL slug
    .index("by_group", ["groupId"])
    .index("by_status", ["status"]),

  // COMMISSION RATES (Broker rates and overrides) — Clerk-free identity
  commissionRates: defineTable({
    // BROKER IDENTITY
    brokerId: v.string(), // partnerLeaders._id of the rep
    agencyId: v.optional(v.string()), // distributionPartners._id of the agency
    
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

  // COMMISSION PAYABLES (Detailed commission records owed to brokers) — Clerk-free identity
  commissionPayables: defineTable({
    // BROKER IDENTITY
    brokerId: v.string(), // partnerLeaders._id of the rep
    agencyId: v.optional(v.string()), // distributionPartners._id of the agency
    
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
    
    // KEY SPACE
    // Historically the Stripe webhook wrote the raw rep TRACKING CODE string
    // into `brokerId`, which does not join to partnerLeaders or commissionRates
    // — and it applied a hardcoded 15% rather than the contracted rate. Those
    // rows are unusable for reporting, so rather than invent values for them we
    // mark which key space each row was written in:
    //
    //   "leader_id"   — brokerId is a partnerLeaders._id and rateApplied came
    //                   from commissionRates. Trustworthy; safe to report on.
    //   "legacy_code" — brokerId held a code string and/or the rate was the
    //                   hardcoded default. Quarantined; excluded from reads.
    //
    // Rows with no keySpace predate the flag and are treated as "legacy_code".
    // See admin/repAttributionBackfill.ts for the re-keying pass.
    keySpace: v.optional(v.union(
      v.literal("leader_id"),
      v.literal("legacy_code")
    )),

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
    reportUrl: v.optional(v.string()),      // Direct report/PDF URL captured via postMessage or AI report URL
    forwardedToTeledentist: v.optional(v.boolean()),
    forwardedAt: v.optional(v.number()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    // Populated by the Toothlens completion callback
    s3Key: v.optional(v.string()),          // S3 object key for reconciliation
    findings: v.optional(v.any()),          // Optional AI scores/metadata payload
    callbackReceivedAt: v.optional(v.number()),
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

  // W-9 FORMS (Signed substitute Form W-9 for distributor partners/reps)
  // The raw TIN is embedded only in the generated PDF (storageId, access-gated
  // + audit-logged on view) — never stored as a plaintext DB field. Only a
  // masked version is kept here for display purposes.
  w9Forms: defineTable({
    repSubmissionId: v.optional(v.id("repOnboardingSubmissions")),
    partnerId: v.optional(v.id("distributionPartners")),
    legalName: v.string(),
    businessName: v.optional(v.string()),
    taxClassification: v.union(
      v.literal("individual"),
      v.literal("c_corp"),
      v.literal("s_corp"),
      v.literal("partnership"),
      v.literal("trust_estate"),
      v.literal("llc"),
      v.literal("other"),
    ),
    llcTaxClassification: v.optional(v.string()), // "C" | "S" | "P" — only when taxClassification === "llc"
    address: v.string(),
    city: v.string(),
    state: v.string(),
    zip: v.string(),
    tinType: v.union(v.literal("ssn"), v.literal("ein")),
    maskedTin: v.string(), // e.g. "***-**-6789"
    storageId: v.string(), // Convex _storage ID of the signed PDF (contains the full TIN)
    signedAt: v.number(),
    signerIp: v.optional(v.string()),
    status: v.union(v.literal("signed"), v.literal("superseded")),
    createdAt: v.number(),
  })
    .index("by_repSubmissionId", ["repSubmissionId"])
    .index("by_partnerId", ["partnerId"]),

  // PARTNER KIT — "Section 7: Partner Agreement & Acknowledgment" submissions.
  // Public intake (no account required), mirrors the fillable Partner Kit PDF.
  // Partners can complete & sign online OR upload a completed PDF, plus attach
  // a W-9 (e-signed via w9Forms, or uploaded as a file).
  partnerKitSubmissions: defineTable({
    // Section 7 fillable fields
    partnerAgencyName: v.string(),
    dba: v.optional(v.string()),
    primaryContactName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    npnLicenseInfo: v.optional(v.string()),
    effectiveDate: v.optional(v.string()),
    // Signature block (online path)
    signatureDataUrl: v.optional(v.string()),
    printedName: v.optional(v.string()),
    title: v.optional(v.string()),
    signedDate: v.optional(v.string()),
    acknowledged: v.boolean(),
    // How the agreement was provided
    method: v.union(v.literal("online"), v.literal("upload")),
    // Uploaded completed Partner Kit PDF (upload path or supplemental)
    partnerKitFileId: v.optional(v.string()),
    partnerKitFileName: v.optional(v.string()),
    // W-9: either an e-signed w9Forms row, or an uploaded file
    w9FormId: v.optional(v.id("w9Forms")),
    w9FileId: v.optional(v.string()),
    w9FileName: v.optional(v.string()),
    // Workflow
    status: v.union(
      v.literal("new"),
      v.literal("reviewing"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
    notes: v.optional(v.string()),
    submittedFromIp: v.optional(v.string()),
    // PIPELINE LINKS
    matchedApplicationId: v.optional(v.id("repOnboardingSubmissions")), // auto-matched by email
    matchedLeadId: v.optional(v.id("partnerRegistrations")),           // auto-matched by email
    approvedPartnerId: v.optional(v.string()),      // set on standalone promotion → distributionPartners
    approvedRepLeaderId: v.optional(v.string()),
    /**
     * Rendered executed agreement for the ONLINE path, cached after first
     * download. The upload path already has a signed PDF (`partnerKitFileId`);
     * an online signature is only field values + a signature image, so the
     * document has to be composed. Generated once, then reused.
     */
    executedAgreementFileId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_email", ["email"])
    // Serves the partner-facing "your signed agreement" lookup, which matches
    // on partner id — never on email, which is neither unique nor verified.
    .index("by_approved_partner", ["approvedPartnerId"]),

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
    guardian: v.optional(v.string()),         // Careington "Guardian" flag ("0"/"1"); should always be "0" — we don't track legal-guardian relationships

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
  // INVOICE CALCULATOR — period snapshots & adjustments
  // See docs/internal/INVOICE_CALCULATOR_SPEC.md
  // ============================================

  /**
   * Immutable per-group snapshots of revenue + dispersal for a closed
   * billing period. Written by the monthly `closePeriod` cron.
   *
   * Snapshots are the authoritative record for any historical period.
   * They are NEVER updated after close — corrections flow through
   * `invoiceAdjustments`.
   */
  invoicePeriods: defineTable({
    // PERIOD IDENTITY (UTC calendar month)
    period: v.string(),            // "YYYY-MM" — primary lookup key
    year: v.number(),
    month: v.number(),             // 1..12
    periodStartMs: v.number(),     // UTC start (inclusive)
    periodEndMs: v.number(),       // UTC end (exclusive)

    // SCOPE
    groupId: v.id("groups"),
    accountId: v.id("accounts"),
    // Which brand this group's revenue belongs to, denormalized from the group
    // at close time so a statement can be scoped to one white-label site without
    // re-reading every group. Optional: rows closed before multi-site scoping
    // shipped have none, and readers fall back to `groups.siteId` for those
    // (run `backfillInvoicePeriodSiteIds` to fill them in permanently).
    siteId: v.optional(v.id("sites")),
    isListBill: v.boolean(),       // employer-paid flag at close time

    // DENORMALIZED METADATA (frozen at close time)
    groupCode: v.string(),
    organizationCode: v.optional(v.string()),
    groupName: v.string(),
    accountName: v.optional(v.string()),

    // HEAD COUNTS
    activeMemberCount: v.number(),
    individualPrimaryCount: v.number(),
    familyPrimaryCount: v.number(),
    dependentCount: v.number(),
    unbilledPrimaryCount: v.number(),

    // DISPERSAL TOTALS (integer cents, INV-01 always holds)
    grossCents: v.number(),
    toothlensCents: v.number(),
    careingtonCents: v.number(),
    processingCents: v.number(),
    partnerVendorCents: v.number(),
    ryzeKeepCents: v.number(),

    // SOURCE PROVENANCE — ids of records included in the snapshot.
    // Lets auditors reproduce the math against historical data.
    memberProfileIds: v.array(v.id("memberProfiles")),
    bundleIds: v.array(v.id("subscriptionBundles")),
    // Frozen primary-level statement lines. Optional for snapshots created
    // before vendor statements shipped; those periods remain available as
    // aggregate-only statements and are never reconstructed from live data.
    memberLines: v.optional(v.array(v.object({
      memberProfileId: v.id("memberProfiles"),
      memberId: v.string(),
      firstName: v.string(),
      lastName: v.string(),
      groupCode: v.string(),
      tier: v.union(v.literal("individual"), v.literal("family"), v.literal("none")),
      grossCents: v.number(),
      toothlensCents: v.number(),
      careingtonCents: v.number(),
      processingCents: v.number(),
      partnerVendorCents: v.number(),
      ryzeKeepCents: v.number(),
      // Rep/broker attributed to this member at close time, so a statement
      // reprinted later still names whoever earned the sale. Optional: closes
      // written before attribution was frozen fall back to today's
      // attribution at read time, flagged as such.
      repId: v.optional(v.string()),          // partnerLeaders._id
      repName: v.optional(v.string()),
      repCode: v.optional(v.string()),        // broker tracking code
      repEmail: v.optional(v.string()),
      agencyId: v.optional(v.string()),       // distributionPartners._id
      agencyName: v.optional(v.string()),
      repSource: v.optional(v.union(
        v.literal("enrollment"),
        v.literal("group"),
        v.literal("none"),
      )),
    }))),

    // How this row's `memberLines` got there. Absent = written by the close
    // itself. "exact" = rebuilt later and reproduced the closed totals to the
    // cent. "forced" = rebuilt later by an owner who accepted a reconstruction
    // that does NOT match the closed totals, so the lines are indicative
    // rather than authoritative. Totals are never rewritten in any case.
    memberLinesRebuilt: v.optional(v.union(v.literal("exact"), v.literal("forced"))),

    // Set when an owner syncs this row's aggregates to its member list, making
    // the member list the system of record for the month. The figures the
    // month first closed with are preserved here in full — nothing is lost,
    // and the original close remains reproducible from them.
    supersededFigures: v.optional(v.object({
      individualPrimaryCount: v.number(),
      familyPrimaryCount: v.number(),
      grossCents: v.number(),
      toothlensCents: v.number(),
      careingtonCents: v.number(),
      processingCents: v.number(),
      partnerVendorCents: v.number(),
      ryzeKeepCents: v.number(),
      payloadHash: v.string(),
      closedAt: v.number(),
      supersededAt: v.number(),
      supersededBy: v.string(),
    })),

    // PRICING TABLE used at close time (period-stamped per spec §10 #6).
    // Ensures historical periods reproduce even if rates change later.
    pricing: v.object({
      individualGrossCents: v.number(),
      familyGrossCents: v.number(),
      individualSplits: v.object({
        toothlensCents: v.number(),
        careingtonCents: v.number(),
        processingCents: v.number(),
        partnerVendorCents: v.number(),
        ryzeKeepCents: v.number(),
      }),
      familySplits: v.object({
        toothlensCents: v.number(),
        careingtonCents: v.number(),
        processingCents: v.number(),
        partnerVendorCents: v.number(),
        ryzeKeepCents: v.number(),
      }),
    }),

    // CLOSE METADATA
    closedAt: v.number(),                  // UTC ms
    closedBy: v.string(),                  // "cron" | clerkUserId
    payloadHash: v.string(),               // SHA-256 hex of canonical JSON of this row's numeric fields
    sourceGitSha: v.optional(v.string()),  // git SHA of calculator code at close time
  })
    .index("by_period", ["period"])
    .index("by_period_group", ["period", "groupId"])
    .index("by_period_site", ["period", "siteId"])
    .index("by_group", ["groupId"])
    .index("by_account", ["accountId"]),

  /**
   * Append-only corrections to a closed period. NEVER mutate or delete
   * an existing row — record a new offsetting adjustment instead.
   */
  invoiceAdjustments: defineTable({
    periodId: v.id("invoicePeriods"),
    period: v.string(),                    // denormalized "YYYY-MM" for indexing
    groupId: v.id("groups"),
    reason: v.union(
      v.literal("refund"),
      v.literal("chargeback"),
      v.literal("retroactive_term"),
      v.literal("retroactive_enrollment"),
      v.literal("misclassification"),
      v.literal("other"),
    ),
    bucket: v.union(
      v.literal("gross"),
      v.literal("toothlens"),
      v.literal("careington"),
      v.literal("processing"),
      v.literal("partnerVendor"),
      v.literal("ryzeKeep"),
    ),
    deltaCents: v.number(),                // signed
    appliedToPeriod: v.optional(v.string()), // "YYYY-MM" where the cash actually moved
    notes: v.string(),
    createdBy: v.string(),                 // Clerk user id
    createdAt: v.number(),
  })
    .index("by_period", ["period"])
    .index("by_period_group", ["period", "groupId"])
    .index("by_periodId", ["periodId"])
    .index("by_group", ["groupId"]),

  // ============================================
  // VENDOR REMITTANCE STATEMENTS
  // See docs/internal/VENDOR_STATEMENT_RULES.md
  // ============================================

  /**
   * What each recipient is shown on their statement. One row per recipient;
   * absent rows fall back to the code defaults in `vendorStatements.ts`.
   *
   * Editing a profile takes effect immediately, including on reprints of
   * statements already generated: disclosure decides which columns appear, not
   * what anything is worth. Each statement still records the profile it was
   * cut under (`vendorStatements.disclosure`) so drift can be reported.
   */
  vendorStatementDisclosureProfiles: defineTable({
    vendor: v.union(
      v.literal("toothlens"),
      v.literal("careington"),
      v.literal("ideal"),
      v.literal("ryze"),
    ),

    // Per-primary lines at all, vs. totals only.
    memberDetail: v.boolean(),
    // Which employer groups are named. "listBillOnly" names the employer for
    // list-bill members and shows self-pay members as direct enrollments,
    // which is what a partner paying out on employer business needs without
    // exposing the whole book.
    groupVisibility: v.union(
      v.literal("none"),
      v.literal("listBillOnly"),
      v.literal("all"),
    ),
    // Itemized adjustment lines vs. a single net figure in the totals.
    adjustmentDetail: v.boolean(),

    // Which data points appear as columns in the Covered Primary Detail
    // table, mirroring the picker used elsewhere in the admin. Absent = the
    // registry defaults for that recipient.
    columns: v.optional(v.array(v.object({
      key: v.string(),
      enabled: v.boolean(),
    }))),

    // Superseded by `columns` — kept optional so rows written before the
    // picker existed still validate. Nothing reads them.
    rateClass: v.optional(v.boolean()),
    repAttribution: v.optional(v.boolean()),
    fullSplit: v.optional(v.boolean()),

    // Why this profile deviates from the default — shown in the settings UI.
    note: v.optional(v.string()),
    updatedBy: v.string(),
    updatedAt: v.number(),
  }).index("by_vendor", ["vendor"]),

  /**
   * A numbered, issued remittance statement for one recipient × coverage
   * month. One row per (recipient, period) unless the prior one was voided.
   *
   * Member-level lines are deliberately NOT duplicated here — they live in
   * the immutable `invoicePeriods` rows referenced by `sourcePeriodIds` and
   * are hydrated at read time. That keeps a Ryze statement (which spans every
   * group) far under the document size limit and guarantees the printed
   * detail can never drift from the close it was drawn from.
   *
   * Totals ARE frozen here, along with the exact `invoiceAdjustments` that
   * were in effect at generation. An adjustment recorded afterwards does not
   * silently change an issued statement — it surfaces as unapplied and the
   * admin voids + reissues.
   */
  vendorStatements: defineTable({
    // ── IDENTITY ──────────────────────────────────────────────────────────
    statementNumber: v.number(),          // sequential from counters["vendorStatementSeq"]
    statementNumberDisplay: v.string(),   // e.g. "VS-10001"

    // ── RECIPIENT ─────────────────────────────────────────────────────────
    vendor: v.union(
      v.literal("toothlens"),
      v.literal("careington"),
      v.literal("ideal"),
      v.literal("ryze"),
    ),
    vendorName: v.string(),               // frozen display name at generation

    // ── SITE SCOPE ────────────────────────────────────────────────────────
    // Absent = book-wide: every site's close rows for the month. That is what a
    // vendor contracted with the carrier rather than with one brand is owed, and
    // it is the default. Set = only that site's close rows, for a white-label
    // brand that settles its own revenue share.
    //
    // Within one (vendor, period) the two are mutually exclusive: either one
    // live book-wide statement OR live per-site statements, never both, or the
    // same dollar is remitted twice. `createStatement` enforces that.
    siteId: v.optional(v.id("sites")),
    siteName: v.optional(v.string()),     // frozen display name at generation

    // ── COVERAGE ──────────────────────────────────────────────────────────
    period: v.string(),                   // "YYYY-MM"
    coverageStart: v.number(),            // UTC ms, inclusive (first instant of the month)
    coverageEnd: v.number(),              // UTC ms, inclusive (23:59:59.999 of the last day)

    // ── DATES ─────────────────────────────────────────────────────────────
    statementDate: v.number(),            // UTC ms — when generated
    paymentDueDate: v.number(),           // UTC ms — when remittance is due

    // ── FROZEN TOTALS (integer cents) ─────────────────────────────────────
    primaryCount: v.number(),             // billable primaries on this statement
    subtotalCents: v.number(),
    adjustmentCents: v.number(),          // signed; sum of adjustmentIds below
    totalCents: v.number(),               // subtotalCents + adjustmentCents

    // ── REMITTANCE TRACKING ───────────────────────────────────────────────
    status: v.union(
      v.literal("draft"),
      v.literal("issued"),
      v.literal("partial"),
      v.literal("paid"),
      v.literal("voided"),
    ),
    amountPaidCents: v.number(),
    balanceCents: v.number(),
    paymentMethod: v.optional(v.union(
      v.literal("check"),
      v.literal("ach"),
      v.literal("wire"),
    )),
    paymentReference: v.optional(v.string()), // check no. / ACH trace / wire ref
    paidAt: v.optional(v.number()),

    // ── VOID / REPLACEMENT CHAIN ──────────────────────────────────────────
    voidedAt: v.optional(v.number()),
    voidedBy: v.optional(v.string()),
    voidReason: v.optional(v.string()),
    previousStatus: v.optional(v.union(
      v.literal("draft"),
      v.literal("issued"),
      v.literal("partial"),
      v.literal("paid"),
    )),
    unvoidedAt: v.optional(v.number()),
    unvoidedBy: v.optional(v.string()),
    supersededById: v.optional(v.id("vendorStatements")),
    replacesId: v.optional(v.id("vendorStatements")),

    // ── SOURCE PROVENANCE ─────────────────────────────────────────────────
    // The immutable close rows this statement was drawn from. Member detail
    // is hydrated from these, never from the live roster.
    sourcePeriodIds: v.array(v.id("invoicePeriods")),
    sourcePayloadHashes: v.array(v.string()),
    sourceClosedAt: v.number(),           // latest closedAt across sourcePeriodIds
    adjustmentIds: v.array(v.id("invoiceAdjustments")),
    // False for legacy closes that predate frozen member lines — those
    // statements print frozen totals only and are never reconstructed.
    memberDetailAvailable: v.boolean(),

    // The disclosure profile in force when this statement was cut. Documents
    // render from the recipient's CURRENT profile, not this — disclosure is
    // presentation only and never moves a figure. This is kept as the record
    // of what the recipient was originally sent, so a later settings change
    // can be reported as drift instead of passing unnoticed.
    disclosure: v.optional(v.object({
      memberDetail: v.boolean(),
      groupVisibility: v.union(
        v.literal("none"),
        v.literal("listBillOnly"),
        v.literal("all"),
      ),
      adjustmentDetail: v.boolean(),
      columns: v.optional(v.array(v.object({
        key: v.string(),
        enabled: v.boolean(),
      }))),
      // Superseded by `columns`; optional so older statements still validate.
      rateClass: v.optional(v.boolean()),
      repAttribution: v.optional(v.boolean()),
      fullSplit: v.optional(v.boolean()),
    })),

    // ── PER-PRIMARY EXCLUSIONS ────────────────────────────────────────────
    // Primaries deliberately left off this statement — a duplicate, someone
    // billed in error, a retro term. The line is removed and its amount comes
    // off the subtotal, so the document still foots. Kept as a list rather
    // than a deletion so the omission is always explainable.
    excludedMembers: v.optional(v.array(v.object({
      memberId: v.string(),
      memberName: v.string(),
      amountCents: v.number(),   // what was removed from the subtotal
      tier: v.union(v.literal("individual"), v.literal("family")),
      reason: v.string(),
      excludedBy: v.string(),
      excludedAt: v.number(),
    }))),

    // ── INTERNAL MEMO (never printed) ─────────────────────────────────────
    internalMemo: v.optional(v.string()),

    // ── AUDIT ─────────────────────────────────────────────────────────────
    generatedBy: v.string(),              // clerkUserId | "cron"
    sourceGitSha: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    issuedAt: v.optional(v.number()),
  })
    .index("by_number", ["statementNumber"])
    .index("by_period", ["period"])
    .index("by_vendor", ["vendor"])
    .index("by_vendor_period", ["vendor", "period"])
    .index("by_vendor_period_site", ["vendor", "period", "siteId"])
    .index("by_site_period", ["siteId", "period"])
    .index("by_status", ["status"]),

  // ============================================
  // LIST-BILL INVOICE GENERATOR
  // See docs/internal/LIST_BILL_INVOICE_SPEC.md
  // ============================================

  /**
   * Employer-facing billing documents. One row per (group, coveragePeriod).
   * Member lines are embedded as an array snapshot.
   * Invariants: LBI-01 through LBI-09 (see spec §16).
   */
  listBillInvoices: defineTable({
    // ── IDENTITY ──────────────────────────────────────────────────────────
    invoiceNumber: v.number(),         // sequential integer from counters["listBillInvoiceSeq"]
    invoiceNumberDisplay: v.string(),  // zero-padded, e.g. "10113"

    // ── SCOPE ─────────────────────────────────────────────────────────────
    groupId: v.id("groups"),
    accountId: v.id("accounts"),
    siteId: v.id("sites"),

    // ── BILLING PERIOD ────────────────────────────────────────────────────
    coveragePeriod: v.string(),        // "YYYY-MM"
    coverageStart: v.number(),         // Unix ms — first day of coverage month (UTC)
    coverageEnd: v.number(),           // Unix ms — last day of coverage month (UTC, inclusive)

    // ── DATES ─────────────────────────────────────────────────────────────
    billingDate: v.number(),           // Unix ms — when generated/issued
    paymentDueDate: v.number(),        // Unix ms — when payment is due

    // ── FROZEN GROUP METADATA ─────────────────────────────────────────────
    groupName: v.string(),
    groupCode: v.string(),
    organizationCode: v.optional(v.string()),
    accountName: v.string(),
    billingContactEmail: v.optional(v.string()),
    billingContactName: v.optional(v.string()),

    // ── RATES (frozen at generation) ──────────────────────────────────────
    moCents: v.number(),
    msCents: v.number(),
    mfCents: v.number(),
    rateLabel: v.string(),

    // ── MEMBER LINE ITEMS (one per active primary, snapshot) ──────────────
    lines: v.array(v.object({
      memberProfileId: v.id("memberProfiles"),
      memberId: v.string(),
      lastName: v.string(),
      firstName: v.string(),
      tier: v.union(v.literal("MO"), v.literal("MS"), v.literal("MF")),
      dependentCount: v.number(),
      rateCents: v.number(),
      productLabel: v.string(),
      // Enriched audit fields (optional; populated from memberProfile at generation time)
      ssn: v.optional(v.string()),
      location: v.optional(v.string()),
      department: v.optional(v.string()),
      effectiveDate: v.optional(v.string()),
      groupMemberId: v.optional(v.string()),
      // buildInvoiceLines writes both of these, but the validator did not
      // declare them — so a group whose eligibility file supplied an
      // "Approved EE Cost" or a "Tier" column (exactly the case these fields
      // exist for) would fail document validation on invoice generation.
      // Tests passed only because seeded members have neither field set.
      monthlyPremiumCents: v.optional(v.number()),
      tierCode: v.optional(v.string()),
    })),

    // ── HEAD COUNTS ───────────────────────────────────────────────────────
    memberCount: v.number(),
    moCount: v.number(),
    msCount: v.number(),
    mfCount: v.number(),

    // ── FINANCIALS (integer cents) ─────────────────────────────────────────
    subtotalCents: v.number(),         // sum(lines[i].rateCents)
    adjustmentCents: v.number(),       // signed; positive = credit
    totalCents: v.number(),            // subtotalCents + adjustmentCents
    adjustmentNotes: v.optional(v.string()),
    carriedForwardCents: v.optional(v.number()), // from prior period adjustment

    // ── PAYMENT TRACKING ──────────────────────────────────────────────────
    status: v.union(
      v.literal("draft"),
      v.literal("issued"),
      v.literal("paid"),
      v.literal("partial"),
      v.literal("overdue"),
      v.literal("voided"),
      v.literal("disputed")
    ),
    paymentMethod: v.optional(v.union(
      v.literal("check"),
      v.literal("ach"),
      v.literal("wire")
    )),
    checkNumber: v.optional(v.string()),
    checkDate: v.optional(v.string()),
    achConfirmationNumber: v.optional(v.string()),
    amountPaidCents: v.number(),       // running total paid (starts at 0)
    balanceCents: v.number(),          // totalCents - amountPaidCents
    paidAt: v.optional(v.number()),

    // ── VOID / REPLACEMENT CHAIN ──────────────────────────────────────────
    voidedAt: v.optional(v.number()),
    voidedBy: v.optional(v.string()),
    voidReason: v.optional(v.string()),
    // Status the invoice was in immediately before being voided — restored
    // (and re-derived for overdue/partial) when the void is undone.
    previousStatus: v.optional(v.union(
      v.literal("draft"),
      v.literal("issued"),
      v.literal("paid"),
      v.literal("partial"),
      v.literal("overdue"),
      v.literal("disputed")
    )),
    unvoidedAt: v.optional(v.number()),
    unvoidedBy: v.optional(v.string()),
    supersededById: v.optional(v.id("listBillInvoices")),

    // ── SOURCE PROVENANCE ─────────────────────────────────────────────────
    generatedBy: v.string(),           // "cron" | admin Clerk user ID
    memberProfileIdsSnapshot: v.array(v.id("memberProfiles")),

    // ── INTERNAL MEMO ─────────────────────────────────────────────────────
    internalMemo: v.optional(v.string()), // admin-only notes, not printed on PDF

    // ── AUDIT ─────────────────────────────────────────────────────────────
    createdAt: v.number(),
    updatedAt: v.number(),
    issuedAt: v.optional(v.number()),
    reconciledAt: v.optional(v.number()),
    reconciledBy: v.optional(v.string()),
  })
    .index("by_group", ["groupId"])
    .index("by_account", ["accountId"])
    .index("by_period", ["coveragePeriod"])
    .index("by_group_period", ["groupId", "coveragePeriod"])
    .index("by_status", ["status"])
    .index("by_invoice_number", ["invoiceNumber"])
    .index("by_due_date", ["paymentDueDate"]),

  // ============================================
  // SYSTEM COUNTERS (for atomic ID generation)
  // ============================================
  counters: defineTable({
    name: v.string(),   // e.g. "memberIdSeq"
    value: v.number(),  // current counter value
  }).index("by_name", ["name"]),

  // ============================================
  // SITE INTEGRATIONS (per-brand vendor config)
  // ============================================
  siteIntegrations: defineTable({
    siteId: v.id("sites"),

    // Toothlens AI oral scanning
    toothlensCompany: v.optional(v.string()),     // e.g. "idealhealth"
    toothlensAccessKey: v.optional(v.string()),   // encrypted access key

    // Email sender
    emailFromName: v.optional(v.string()),        // e.g. "Ideal Oral Health"
    emailFromAddress: v.optional(v.string()),     // e.g. "noreply@getidealoh.com"
    emailReplyTo: v.optional(v.string()),         // e.g. "support@getidealoh.com"

    // Stripe
    stripeMode: v.optional(v.union(v.literal("single"), v.literal("connect"))),
    stripeConnectAccountId: v.optional(v.string()),
    stripePriceMap: v.optional(v.any()),          // { productId -> { monthly, annual } }

    // Vendor group codes (if brand has its own Careington/DialCare group)
    careingtonGroupCode: v.optional(v.string()),
    dialcareGroupCode: v.optional(v.string()),

    // Legal entity overrides
    legalEntityName: v.optional(v.string()),
    legalAddress: v.optional(v.string()),
    carrierName: v.optional(v.string()),

    updatedAt: v.number(),
  }).index("by_site", ["siteId"]),

  // ============================================
  // INSIGHTS — rep link tracking & daily rollups
  // ============================================

  // REP LINK VISITS (top of the production funnel)
  //
  // Until now the only signal a rep code produced was a completed enrollment —
  // `brokerTrackingCodes.usageCount` was declared but never incremented, so
  // every "code usage" figure read zero and there was no way to tell a code
  // that nobody clicked from one that converted badly.
  //
  // Written from two places, mirroring how the code reaches us:
  //   - src/proxy.ts            vanity URL  /{slug}   (server-side redirect)
  //   - /api/track/rep-visit    ?ref=CODE landing     (sendBeacon)
  //
  // Rows are recorded raw. Bot filtering happens at READ time so the rule can
  // change later without having thrown data away.
  repLinkVisits: defineTable({
    code: v.string(),                      // brokerTrackingCodes.code
    slug: v.optional(v.string()),          // vanity slug, when that was the entry
    siteSlug: v.optional(v.string()),      // white-label brand the visit landed on
    path: v.string(),                      // where they arrived
    referrer: v.optional(v.string()),
    sessionId: v.optional(v.string()),     // browser session, for dedupe at read time
    source: v.union(
      v.literal("vanity_url"),
      v.literal("ref_param")
    ),
    isBot: v.optional(v.boolean()),        // best-effort UA classification
    createdAt: v.number(),
  })
    .index("by_code_created", ["code", "createdAt"])
    .index("by_created", ["createdAt"])
    .index("by_session", ["sessionId"]),

  // INSIGHTS DAILY ROLLUP
  //
  // Trend charts read this instead of the member table, so a chart costs
  // O(days) rather than O(members) and the portal stays inside Convex's
  // per-query document read limit as the book grows.
  //
  // Written nightly by the `insights-daily-rollup` cron (convex/crons.ts),
  // idempotent per (scopeKind, scopeId, date). Today's figures are always
  // computed live and merged on top, so the dashboard is never stale.
  insightsDaily: defineTable({
    scopeKind: v.union(
      v.literal("global"),                 // whole book — the admin view
      v.literal("agency"),                 // one distributionPartners row
      v.literal("rep")                     // one partnerLeaders row
    ),
    scopeId: v.string(),                   // "" for global
    date: v.string(),                      // "YYYY-MM-DD" (UTC)

    // Membership
    activeMembers: v.number(),             // point-in-time, end of day
    newMembers: v.number(),                // enrolled that day
    terminatedMembers: v.number(),         // exited that day

    // Revenue
    mrrCents: v.number(),                  // combined, all billing mechanisms
    // Split so the mix is queryable historically, not just live. Optional
    // because rows written before list-bill support have no split to report —
    // absent means "unknown", which is honest; zero would be a claim.
    mrrCentsDirect: v.optional(v.number()),
    mrrCentsListBill: v.optional(v.number()),
    // Members counted on the invoice generator's definition (active +
    // enrolling + eligible). `activeMembers` predates that reconciliation.
    billableMembers: v.optional(v.number()),

    // Funnel
    visits: v.number(),
    cartsCreated: v.number(),
    cartsCompleted: v.number(),
    enrollmentsStarted: v.number(),
    enrollmentsCompleted: v.number(),

    computedAt: v.number(),
  })
    .index("by_scope_date", ["scopeKind", "scopeId", "date"])
    .index("by_date", ["date"]),
  // ============================================
  // B2B SALES CRM  —  internal sales only (convex/crm/guards.ts)
  //
  // Separate from memberProfiles by necessity: memberActivities requires
  // siteId + groupId, which a prospect does not have. Links to the member /
  // partner world are optional pointers only — never joins we authorise
  // through, never cascades.
  // ============================================

  crmCompanies: defineTable({
    name: v.string(),
    /** Lowercased, suffix-stripped ("Acme Inc." → "acme"). Dedupe key. */
    nameKey: v.string(),
    /** Bare host, lowercased, no scheme/www. Second dedupe key. */
    domain: v.optional(v.string()),
    website: v.optional(v.string()),

    companyType: v.union(
      v.literal("employer"), v.literal("broker"), v.literal("agency"),
      v.literal("fmo"), v.literal("association"), v.literal("vendor"),
      v.literal("other"),
    ),
    industry: v.optional(v.string()),
    employeeCount: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneE164: v.optional(v.string()),

    address: v.optional(v.object({
      line1: v.optional(v.string()), line2: v.optional(v.string()),
      city: v.optional(v.string()), state: v.optional(v.string()),
      postalCode: v.optional(v.string()), country: v.optional(v.string()),
    })),
    /** Denormalised out of `address` so the list filters without a join. */
    city: v.optional(v.string()),
    state: v.optional(v.string()),

    // PIPELINE — one open opportunity per company. For a benefits sale the
    // employer IS the deal. A crmDeals table (phase 4) can be layered on
    // without breaking this; these become the "primary deal" cache.
    stage: v.union(
      v.literal("unqualified"), v.literal("prospect"), v.literal("contacted"),
      v.literal("engaged"), v.literal("proposal"), v.literal("verbal"),
      v.literal("won"), v.literal("lost"), v.literal("dormant"),
    ),
    stageChangedAt: v.number(),
    /** Covered lives — the unit a benefits deal is actually sized in. */
    estimatedLives: v.optional(v.number()),
    estimatedMrrCents: v.optional(v.number()),
    /** 0–100. Falls back to STAGE_DEFAULT_PROBABILITY when unset. */
    winProbability: v.optional(v.number()),
    expectedCloseDate: v.optional(v.string()), // ISO "2026-10-01"
    lostReason: v.optional(v.string()),

    ownerClerkUserId: v.optional(v.string()),
    /** Denormalised cache for render + AND-filter. crmContactTags is truth. */
    tagIds: v.array(v.id("crmTags")),

    // SOFT LINKS — pointers only
    linkedAccountId: v.optional(v.id("accounts")),
    linkedGroupId: v.optional(v.id("groups")),
    linkedPartnerId: v.optional(v.id("distributionPartners")),

    source: v.optional(v.string()),
    notes: v.optional(v.string()),
    isArchived: v.boolean(),

    firstTouchAt: v.optional(v.number()),
    convertedAt: v.optional(v.number()),
    lastActivityAt: v.optional(v.number()),

    /** name + domain + industry + city/state. Rebuilt on every write. */
    searchText: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.optional(v.string()),
  })
    .index("by_name_key", ["nameKey"])
    .index("by_domain", ["domain"])
    .index("by_stage", ["stage", "stageChangedAt"])
    .index("by_owner_stage", ["ownerClerkUserId", "stage"])
    .index("by_updated", ["updatedAt"])
    .index("by_last_activity", ["lastActivityAt"])
    .index("by_converted", ["convertedAt"])
    .index("by_linked_account", ["linkedAccountId"])
    .index("by_linked_partner", ["linkedPartnerId"])
    .searchIndex("search_companies", {
      searchField: "searchText",
      filterFields: ["stage", "companyType", "ownerClerkUserId", "isArchived", "state", "industry"],
    }),

  // ============================================
  // DEAL PIPELINE — configurable stages over a fixed canonical spine
  // ============================================
  // A company used to BE the deal (the hardcoded `stage` column above). It
  // still carries those columns, but they are now a CACHE of the company's
  // PRIMARY deal — crmDeals is the truth, and convex/crm/deals.ts's
  // syncPrimaryDealCache is the only writer. Two writers to one rollup is the
  // exact drift crmActivities' single-writer rule exists to prevent.
  //
  // WHY STAGES ARE TWO-LAYERED. Sales ops wants to rename, recolour, reorder
  // and insert stages without a deploy. But `crmCompanies.stage` is a
  // search-index filterField, the key of by_stage/by_owner_stage, AND the
  // string persisted in crmSegments.filters.stages — so it cannot become a
  // free-form string without a search-index migration plus a silent break in
  // every saved segment. Hence: a stage ROW is freely editable, but each row
  // declares the `canonicalStage` it rolls up into. Display and pipeline maths
  // read the row; indexes, segments and funnel analytics read the canonical
  // value. A custom stage therefore never lands on analytics' 0% fallback.
  crmPipelines: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    /** Exactly one row should be true. Enforced in pipelines.ts, not here. */
    isDefault: v.boolean(),
    isArchived: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.optional(v.string()),
  })
    .index("by_default", ["isDefault"])
    .index("by_archived", ["isArchived"]),

  crmPipelineStages: defineTable({
    pipelineId: v.id("crmPipelines"),
    name: v.string(),
    /** Ascending left-to-right board order. Gaps are fine; ties break by _id. */
    order: v.number(),
    /**
     * Default win % for deals sitting in this stage, 0–100. A deal's own
     * winProbability overrides it. THIS is what pipelineSummary weights by —
     * the hardcoded STAGE_DEFAULT_PROBABILITY map is only the fallback for a
     * canonical value with no stage row.
     */
    probability: v.number(),
    /**
     * The fixed spine every configurable stage must map to. Keeps
     * crmCompanies.stage a typed union, so the search index, by_stage, and
     * saved segments keep working while the display layer stays editable.
     */
    canonicalStage: v.union(
      v.literal("unqualified"), v.literal("prospect"), v.literal("contacted"),
      v.literal("engaged"), v.literal("proposal"), v.literal("verbal"),
      v.literal("won"), v.literal("lost"), v.literal("dormant"),
    ),
    /** Terminal markers — drive win-rate maths and "closed" filtering. */
    isWon: v.boolean(),
    isLost: v.boolean(),
    /** Palette key resolved by CRM_TAG_COLORS, not a raw Tailwind class. */
    color: v.optional(v.string()),
    /** Collapsed by default on the board when empty (long-tail stages). */
    isFolded: v.boolean(),
    isArchived: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_pipeline_order", ["pipelineId", "order"])
    .index("by_pipeline_archived", ["pipelineId", "isArchived"])
    .index("by_canonical", ["canonicalStage"]),

  crmDeals: defineTable({
    pipelineId: v.id("crmPipelines"),
    stageId: v.id("crmPipelineStages"),
    stageChangedAt: v.number(),
    /**
     * Required. A benefits deal without an employer/agency on it is not a
     * deal, and the primary-deal cache needs somewhere to write.
     */
    companyId: v.id("crmCompanies"),
    /** Optional champion — the person actually being worked. */
    primaryContactId: v.optional(v.id("crmContacts")),

    name: v.string(),
    ownerClerkUserId: v.optional(v.string()),

    /** Annualised or one-off contract value in cents. */
    amountCents: v.optional(v.number()),
    /** Recurring value in cents — what the company cache mirrors. */
    mrrCents: v.optional(v.number()),
    /** Covered lives — the unit a benefits deal is actually sized in. */
    estimatedLives: v.optional(v.number()),
    /** 0–100 override. Unset falls back to the STAGE ROW's probability. */
    winProbability: v.optional(v.number()),
    expectedCloseDate: v.optional(v.string()), // ISO "2026-10-01"
    lostReason: v.optional(v.string()),
    closedAt: v.optional(v.number()),

    /**
     * THE primary deal for its company — the one whose values mirror onto
     * crmCompanies. At most one non-archived primary per company (enforced in
     * deals.ts). Upsells and renewals are additional non-primary deals.
     */
    isPrimary: v.boolean(),
    /** Manual drag order WITHIN a stage column. Sparse; midpoint-inserted. */
    boardPosition: v.number(),

    source: v.optional(v.string()),
    notes: v.optional(v.string()),
    isArchived: v.boolean(),

    lastActivityAt: v.optional(v.number()),
    /** name + company name + owner. Rebuilt on every write. */
    searchText: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.optional(v.string()),
  })
    .index("by_stage_position", ["stageId", "boardPosition"])
    .index("by_company", ["companyId"])
    .index("by_company_primary", ["companyId", "isPrimary"])
    .index("by_pipeline_stage", ["pipelineId", "stageId"])
    .index("by_owner_stage", ["ownerClerkUserId", "stageId"])
    .index("by_updated", ["updatedAt"])
    .index("by_closed", ["closedAt"])
    .searchIndex("search_deals", {
      searchField: "searchText",
      filterFields: ["pipelineId", "stageId", "ownerClerkUserId", "isArchived"],
    }),

  crmContacts: defineTable({
    firstName: v.string(),
    lastName: v.string(),
    /** Precomputed. Every list row and every mail-merge needs it. */
    fullName: v.string(),

    /** THE targeting field — Jon segments primarily by title + tags. Verbatim. */
    jobTitle: v.optional(v.string()),
    /**
     * Bucketed title from crm/lib/jobTitles.ts. Free text alone can't be
     * segmented reliably ("VP People Ops" vs "Dir., Human Resources"), so keep
     * both: title for display + contains-filter, function for a clean facet.
     */
    jobFunction: v.optional(v.union(
      v.literal("hr"), v.literal("benefits"), v.literal("finance"),
      v.literal("operations"), v.literal("executive"), v.literal("owner"),
      v.literal("broker_producer"), v.literal("broker_principal"),
      v.literal("office_manager"), v.literal("other"),
    )),
    seniority: v.optional(v.union(
      v.literal("c_suite"), v.literal("vp"), v.literal("director"),
      v.literal("manager"), v.literal("individual_contributor"), v.literal("unknown"),
    )),

    // COMPANY — optional on purpose. An imported row has a company *string* and
    // no org identity; forcing a crmCompanies row per row manufactures junk.
    companyId: v.optional(v.id("crmCompanies")),
    companyName: v.optional(v.string()),

    email: v.optional(v.string()),
    /** Lowercased+trimmed. THE dedupe key. Only ever set via normalizeEmail(). */
    emailLower: v.optional(v.string()),
    secondaryEmail: v.optional(v.string()),
    mobilePhone: v.optional(v.string()),
    /** +1XXXXXXXXXX. Click-to-dial target and phone dedupe key. */
    mobilePhoneE164: v.optional(v.string()),
    officePhone: v.optional(v.string()),
    /** Indexed for lookup but NEVER auto-dedupe — it's a switchboard. */
    officePhoneE164: v.optional(v.string()),
    officePhoneExt: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),

    city: v.optional(v.string()),
    state: v.optional(v.string()),
    postalCode: v.optional(v.string()),

    /**
     * RELATIONSHIP STATUS — see crm/lib/contactStatus.ts for the meaning of
     * each value and why drip progress and deliverability are separate fields
     * rather than more members of this union.
     *
     * The trailing five are the pre-redesign values, kept accepted so the
     * deploy can land before migrateContactStatuses has rewritten every row
     * (Convex validates the entire table at deploy time). Drop them in a
     * follow-up once that migration reports zero remaining.
     */
    status: v.union(
      v.literal("prospect"), v.literal("contacted"), v.literal("nurturing"),
      v.literal("interested_qualified"), v.literal("meeting_scheduled"),
      v.literal("agreement_sent"), v.literal("partner"),
      v.literal("inactive_partner"), v.literal("not_interested"),
      v.literal("disqualified"),
      // Legacy — migrated by internal.crm.maintenance.migrateContactStatuses.
      v.literal("new"), v.literal("working"), v.literal("qualified"),
      v.literal("customer"), v.literal("unresponsive"),
    ),
    statusChangedAt: v.number(),
    /** What the rep does next. The list's day-to-day "what do I do" column. */
    nextAction: v.optional(v.union(
      v.literal("send_follow_up"), v.literal("call"), v.literal("schedule_meeting"),
      v.literal("send_partner_kit"), v.literal("send_agreement"), v.literal("awaiting_response"),
    )),
    disqualifiedReason: v.optional(v.string()),
    ownerClerkUserId: v.optional(v.string()),

    tagIds: v.array(v.id("crmTags")),

    // CONSENT / DELIVERABILITY — READ on every send. Unlike
    // memberProfiles.communicationPrefs, which is declared and never read.
    emailOptOut: v.boolean(),
    callOptOut: v.boolean(),
    /**
     * Deliverability. crm/lib/contactStatus.ts:BLOCKING_EMAIL_STATUSES decides
     * which of these stop a send — `bounced_soft` deliberately does not.
     */
    emailStatus: v.union(
      v.literal("unknown"), v.literal("valid"), v.literal("bounced_soft"),
      v.literal("bounced_hard"), v.literal("complained"), v.literal("unsubscribed"),
      v.literal("blocked"), v.literal("invalid"), v.literal("do_not_contact"),
    ),
    phoneStatus: v.union(
      v.literal("unknown"), v.literal("valid"), v.literal("wrong_number"),
      v.literal("disconnected"), v.literal("dnc"),
    ),

    // SOFT LINKS
    linkedMemberProfileId: v.optional(v.id("memberProfiles")),
    linkedPartnerLeaderId: v.optional(v.id("partnerLeaders")),
    linkedPartnerId: v.optional(v.id("distributionPartners")),

    source: v.union(
      v.literal("manual"), v.literal("csv_import"), v.literal("nexus_lead"),
      v.literal("inquiry"), v.literal("partner_registration"), v.literal("partner_kit"),
      v.literal("rep_onboarding"), v.literal("account_contact"), v.literal("web_form"),
      v.literal("referral"), v.literal("event"),
    ),
    sourceDetail: v.optional(v.string()),
    importBatchId: v.optional(v.id("crmImportBatches")),

    // ROLLUPS — maintained by the single activity writer so the list never
    // joins. Reconciled nightly by internal.crm.maintenance.reconcileCounters.
    lastActivityAt: v.optional(v.number()),
    lastActivityType: v.optional(v.string()),
    /** Last OUTBOUND touch — Jon's "who has been in recent contact". */
    lastContactedAt: v.optional(v.number()),
    lastContactedByName: v.optional(v.string()),
    firstTouchAt: v.optional(v.number()),
    emailsSentCount: v.number(),
    callsMadeCount: v.number(),
    callsConnectedCount: v.number(),
    nextTaskAt: v.optional(v.number()),

    // EMAIL SEQUENCE — written by the send paths and the Resend webhook, via
    // crm/lib/emailProgress.ts. Optional throughout because every one of them
    // has an honest "hasn't happened yet" state that a zero would fake.
    /** 0-5. The number automation keys off; dripStatus gives it meaning. */
    dripStep: v.optional(v.number()),
    dripStatus: v.optional(v.union(
      v.literal("not_started"), v.literal("in_progress"), v.literal("completed"),
      v.literal("paused"), v.literal("replied_removed"),
    )),
    /**
     * WHICH campaigns this contact is on. crmDripEnrollments is the source of
     * truth; this array is a denormalized cache so the contact list can filter
     * by campaign without a join — exactly the role tagIds plays for tags.
     * Written only by crm/lib/dripCache.ts.
     */
    dripCampaignIds: v.optional(v.array(v.id("crmDripCampaigns"))),
    /**
     * The enrollment that dripStep/dripStatus above mirror. A contact can be on
     * several campaigns at once, so those two columns show the primary (most
     * recently enrolled active) one — the same primary-row cache shape
     * crmCompanies.stage uses for its primary deal.
     */
    primaryDripCampaignId: v.optional(v.id("crmDripCampaigns")),
    lastEmailSentAt: v.optional(v.number()),
    /** Set by whoever schedules the next step; cleared when that send lands. */
    nextEmailScheduledAt: v.optional(v.number()),
    lastEmailOpenedAt: v.optional(v.number()),
    lastLinkClickedAt: v.optional(v.number()),
    /** A reply is the signal that ends a sequence — see advanceDrip. */
    hasReplied: v.optional(v.boolean()),
    repliedAt: v.optional(v.number()),
    /** Free-text scratchpad on the row itself, for the things a timeline note is too heavy for. */
    notes: v.optional(v.string()),

    // CONVERSION — materialised at conversion so "avg touches before convert"
    // is a pure indexed read, not an O(converts × activities) scan.
    convertedAt: v.optional(v.number()),
    convertEmailCount: v.optional(v.number()),
    convertCallCount: v.optional(v.number()),
    convertTouchCount: v.optional(v.number()),
    convertDaysToClose: v.optional(v.number()),

    isArchived: v.boolean(),
    /** nameKey|companyKey — fuzzy dedupe fallback when there is no email. */
    dedupeKey: v.optional(v.string()),
    /** fullName + email + companyName + jobTitle + phone digits. */
    searchText: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.optional(v.string()),
  })
    .index("by_email_lower", ["emailLower"])
    .index("by_mobile_e164", ["mobilePhoneE164"])
    .index("by_office_e164", ["officePhoneE164"])
    .index("by_dedupe_key", ["dedupeKey"])
    .index("by_company", ["companyId", "lastName"])
    .index("by_status", ["status", "statusChangedAt"])
    .index("by_owner_status", ["ownerClerkUserId", "status"])
    .index("by_last_activity", ["lastActivityAt"])
    .index("by_last_contacted", ["lastContactedAt"])
    .index("by_updated", ["updatedAt"])
    .index("by_job_function", ["jobFunction", "state"])
    .index("by_import_batch", ["importBatchId"])
    .index("by_linked_member", ["linkedMemberProfileId"])
    .index("by_next_task", ["nextTaskAt"])
    .index("by_converted", ["convertedAt"])
    /** "Who is due email N" — the query the whole drip model exists to make cheap. */
    .index("by_drip", ["dripStatus", "dripStep"])
    .index("by_primary_drip_campaign", ["primaryDripCampaignId", "dripStep"])
    /** Deliverability triage: every blocked/bounced address in one scan. */
    .index("by_email_status", ["emailStatus"])
    .searchIndex("search_contacts", {
      searchField: "searchText",
      filterFields: [
        "status", "ownerClerkUserId", "isArchived", "jobFunction",
        "seniority", "state", "companyId", "emailOptOut",
      ],
    }),

  // Jon's "tags AND tag categories": Location and Industry are CATEGORIES;
  // "Texas" and "Manufacturing" are tags inside them.
  crmTagCategories: defineTable({
    name: v.string(),          // "Location", "Industry", "Persona"
    slug: v.string(),
    description: v.optional(v.string()),
    /** Palette key resolved by CRM_TAG_COLORS, not a raw Tailwind class. */
    color: v.string(),
    /** Single-select: a second tag from this category replaces the first. */
    isExclusive: v.boolean(),
    /** Render as its own facet block on the list filter rail. */
    isPrimaryFilter: v.boolean(),
    order: v.number(),
    appliesTo: v.union(v.literal("contact"), v.literal("company"), v.literal("both")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_order", ["order"]),

  crmTags: defineTable({
    categoryId: v.id("crmTagCategories"),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    color: v.optional(v.string()), // overrides category colour
    /** Display-only. Reconciled nightly — never trusted for a send. */
    contactCount: v.number(),
    companyCount: v.number(),
    isArchived: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.optional(v.string()),
  })
    .index("by_category", ["categoryId", "name"])
    .index("by_category_slug", ["categoryId", "slug"])
    .index("by_archived", ["isArchived", "name"]),

  /** Source of truth for "who has tag X". The tagIds arrays are a cache. */
  crmContactTags: defineTable({
    tagId: v.id("crmTags"),
    categoryId: v.id("crmTagCategories"),
    /** Exactly one of contactId / companyId is set. */
    contactId: v.optional(v.id("crmContacts")),
    companyId: v.optional(v.id("crmCompanies")),
    createdAt: v.number(),
    createdBy: v.optional(v.string()),
  })
    .index("by_tag_contact", ["tagId", "contactId"])
    .index("by_tag_company", ["tagId", "companyId"])
    .index("by_contact", ["contactId"])
    .index("by_company", ["companyId"])
    .index("by_contact_category", ["contactId", "categoryId"]),

  // THE TIMELINE. Notes are activities with activityType "note" — no separate
  // notes table. memberNotes/memberActivities being split is exactly why
  // memberNotes.isPinned was stored and never rendered.
  crmActivities: defineTable({
    /** At least one set. Both when the contact has a company. */
    contactId: v.optional(v.id("crmContacts")),
    companyId: v.optional(v.id("crmCompanies")),
    /**
     * Set on deal-scoped events. A deal activity MUST also set companyId —
     * stageVelocity groups stage_changed events by companyId, so a
     * deal-only row would silently vanish from velocity analytics.
     */
    dealId: v.optional(v.id("crmDeals")),

    activityType: v.union(
      v.literal("note"), v.literal("call"),
      v.literal("email_outbound"), v.literal("email_inbound"),
      v.literal("email_delivered"), v.literal("email_bounced"),
      v.literal("email_complained"), v.literal("email_opened"),
      v.literal("email_clicked"), v.literal("email_unsubscribed"),
      v.literal("meeting"), v.literal("linkedin"),
      v.literal("task_created"), v.literal("task_completed"),
      v.literal("stage_changed"), v.literal("status_changed"),
      v.literal("owner_changed"), v.literal("tag_added"), v.literal("tag_removed"),
      v.literal("contact_created"), v.literal("imported"),
      v.literal("merged"), v.literal("system"),
    ),
    /** Counts as a human touch? Drives touches-to-convert + leaderboards. */
    isTouch: v.boolean(),
    direction: v.optional(v.union(v.literal("outbound"), v.literal("inbound"))),

    title: v.string(),
    body: v.optional(v.string()),

    // CALL
    callOutcome: v.optional(v.union(
      v.literal("connected"), v.literal("no_answer"), v.literal("voicemail"),
      v.literal("gatekeeper"), v.literal("wrong_number"), v.literal("bad_number"),
      v.literal("callback_requested"), v.literal("not_interested"), v.literal("do_not_call"),
    )),
    callDurationSeconds: v.optional(v.number()),
    callNumberDialed: v.optional(v.string()),
    /**
     * True while the call-log composer is open. Drafts are excluded from the
     * timeline and every count. Exists because clicking a dial URI may hand the
     * browser to another app — losing typed notes once will kill adoption.
     */
    isDraft: v.optional(v.boolean()),

    // TELEPHONY — phase 4 (Twilio). Declared now so the upgrade is not a
    // migration. Do NOT build UI against these yet.
    telephonyProvider: v.optional(v.string()),
    externalCallId: v.optional(v.string()),
    recordingUrl: v.optional(v.string()),

    // EMAIL
    resendEmailId: v.optional(v.string()),
    emailSubject: v.optional(v.string()),
    emailTo: v.optional(v.string()),
    emailEvent: v.optional(v.string()),
    campaignId: v.optional(v.id("crmCampaigns")),

    isPinned: v.boolean(),
    metadata: v.optional(v.any()),

    actorType: v.union(v.literal("staff"), v.literal("system"), v.literal("contact")),
    actorClerkUserId: v.optional(v.string()),
    actorName: v.optional(v.string()),

    /** Real-world event time; may precede createdAt for a backdated log. */
    occurredAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_contact", ["contactId", "occurredAt"])
    .index("by_company", ["companyId", "occurredAt"])
    .index("by_contact_pinned", ["contactId", "isPinned"])
    .index("by_type_occurred", ["activityType", "occurredAt"])
    .index("by_actor_occurred", ["actorClerkUserId", "occurredAt"])
    .index("by_touch_occurred", ["isTouch", "occurredAt"])
    .index("by_resend_email_id", ["resendEmailId"])
    .index("by_external_call_id", ["externalCallId"])
    .index("by_deal", ["dealId", "occurredAt"])
    .index("by_campaign", ["campaignId"]),

  crmTasks: defineTable({
    contactId: v.optional(v.id("crmContacts")),
    companyId: v.optional(v.id("crmCompanies")),
    dealId: v.optional(v.id("crmDeals")),
    title: v.string(),
    body: v.optional(v.string()),
    taskType: v.union(
      v.literal("call"), v.literal("email"), v.literal("follow_up"),
      v.literal("meeting"), v.literal("other"),
    ),
    dueAt: v.number(),
    status: v.union(v.literal("open"), v.literal("done"), v.literal("cancelled")),
    completedAt: v.optional(v.number()),
    assigneeClerkUserId: v.string(),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_assignee_status_due", ["assigneeClerkUserId", "status", "dueAt"])
    .index("by_contact_status", ["contactId", "status"])
    .index("by_deal_status", ["dealId", "status"])
    .index("by_status_due", ["status", "dueAt"]),

  // SAVED SEGMENTS. Filters are a TYPED object, not v.any() — a stored segment
  // is an input to a mass send, so typing it is the difference between a
  // validation error and mailing the wrong people.
  crmSegments: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    entity: v.union(v.literal("contact"), v.literal("company")),
    filters: v.object({
      searchTerm: v.optional(v.string()),
      statuses: v.optional(v.array(v.string())),
      stages: v.optional(v.array(v.string())),
      companyTypes: v.optional(v.array(v.string())),
      jobFunctions: v.optional(v.array(v.string())),
      seniorities: v.optional(v.array(v.string())),
      /** OR across entries, case-insensitive substring on jobTitle. */
      jobTitleContains: v.optional(v.array(v.string())),
      jobTitleExcludes: v.optional(v.array(v.string())),
      states: v.optional(v.array(v.string())),
      /** AND across groups; OR across tagIds within a group. */
      tagGroups: v.optional(v.array(v.object({
        categoryId: v.optional(v.id("crmTagCategories")),
        tagIds: v.array(v.id("crmTags")),
      }))),
      excludeTagIds: v.optional(v.array(v.id("crmTags"))),
      ownerClerkUserIds: v.optional(v.array(v.string())),
      hasEmail: v.optional(v.boolean()),
      hasMobile: v.optional(v.boolean()),
      /** Not opted out, not hard-bounced, not suppressed. */
      emailable: v.optional(v.boolean()),
      callable: v.optional(v.boolean()),
      neverContacted: v.optional(v.boolean()),
      lastContactedBeforeDays: v.optional(v.number()),
      createdAfter: v.optional(v.number()),
      importBatchId: v.optional(v.id("crmImportBatches")),
      isArchived: v.optional(v.boolean()),
    }),
    isShared: v.boolean(),
    ownerClerkUserId: v.string(),
    lastCount: v.optional(v.number()),
    lastCountAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerClerkUserId", "name"])
    .index("by_shared", ["isShared", "name"])
    .index("by_entity", ["entity", "name"]),

  crmEmailTemplates: defineTable({
    name: v.string(),
    subject: v.string(),
    bodyHtml: v.string(),
    category: v.optional(v.string()),
    /** Merge fields referenced, extracted at save so the composer can warn. */
    mergeFields: v.array(v.string()),
    isArchived: v.boolean(),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_name", ["name"])
    .index("by_archived", ["isArchived", "name"]),

  crmCampaigns: defineTable({
    name: v.string(),
    subject: v.string(),
    /** Merge tokens: {{firstName}} {{lastName}} {{companyName}} {{jobTitle}} */
    bodyHtml: v.string(),
    fromName: v.string(),
    fromEmail: v.string(),
    replyTo: v.string(),

    segmentId: v.optional(v.id("crmSegments")),
    /**
     * Frozen copy of the segment filters at build time. A segment edited later
     * must not retroactively change what this campaign claims it sent to.
     */
    filtersSnapshot: v.optional(v.any()),

    /**
     * Binds this blast to one phase of a drip campaign. When set, sending it
     * advances every recipient's enrollment to that phase — which is what
     * makes "Email 3 Sent" mean "phase 3 of THIS campaign" rather than a
     * free-floating counter. Unset for a standalone one-off blast.
     */
    dripCampaignId: v.optional(v.id("crmDripCampaigns")),
    dripPhase: v.optional(v.number()),

    status: v.union(
      v.literal("draft"), v.literal("ready"), v.literal("sending"),
      v.literal("paused"), v.literal("sent"), v.literal("cancelled"), v.literal("failed"),
    ),

    scheduledAt: v.optional(v.number()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),

    totalRecipients: v.number(),
    sentCount: v.number(),
    deliveredCount: v.number(),
    bouncedCount: v.number(),
    complainedCount: v.number(),
    openedCount: v.number(),
    clickedCount: v.number(),
    unsubscribedCount: v.number(),
    failedCount: v.number(),
    skippedCount: v.number(),

    createdBy: v.string(),
    approvedBy: v.optional(v.string()),
    approvedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status_created", ["status", "createdAt"])
    .index("by_created", ["createdAt"])
    .index("by_segment", ["segmentId"]),

  crmCampaignRecipients: defineTable({
    campaignId: v.id("crmCampaigns"),
    contactId: v.id("crmContacts"),
    /** Frozen at build — a later contact edit must not redirect a send. */
    email: v.string(),
    mergeData: v.optional(v.any()),
    status: v.union(
      v.literal("queued"), v.literal("sending"), v.literal("sent"),
      v.literal("delivered"), v.literal("bounced"), v.literal("complained"),
      v.literal("failed"), v.literal("skipped"), v.literal("cancelled"),
    ),
    skipReason: v.optional(v.string()),
    resendEmailId: v.optional(v.string()),
    /** Per-recipient unsubscribe token (nanoid). Unguessable. */
    token: v.string(),
    error: v.optional(v.string()),
    attempts: v.number(),
    sentAt: v.optional(v.number()),
    deliveredAt: v.optional(v.number()),
    firstOpenedAt: v.optional(v.number()),
    openCount: v.number(),
    firstClickedAt: v.optional(v.number()),
    clickCount: v.number(),
    unsubscribedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_campaign_status", ["campaignId", "status"])
    .index("by_campaign_contact", ["campaignId", "contactId"])
    .index("by_contact", ["contactId", "createdAt"])
    .index("by_resend_email_id", ["resendEmailId"])
    .index("by_token", ["token"]),

  /**
   * DRIP CAMPAIGNS — a named, multi-phase outreach track a contact is enrolled
   * in, e.g. "Broker Outreach 2026" with five phases.
   *
   * WHY THIS IS NOT crmCampaigns. A crmCampaigns row is ONE blast: one subject,
   * one body, and a recipient list that buildRecipients deletes and rebuilds
   * from a filter every time it runs. That makes it a point-in-time send
   * record, structurally incapable of answering "who is on the broker campaign
   * right now, and at which phase" — the recipient rows for phase 1 are gone by
   * the time phase 2 is built.
   *
   * WHY NOT A TAG. The relationship-type taxonomy is a tag category precisely
   * because it carries no per-contact state (see lib/relationshipTags.ts). A
   * campaign does: a phase, an enrolment date, a paused/replied status. A tag
   * cannot hold any of that, so this is a real table.
   */
  crmDripCampaigns: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    /** Number of phases (emails) in the track. The broker drip is 5. */
    phaseCount: v.number(),
    /**
     * Optional display names per phase; index 0 is phase 1. Display only — a
     * configured crmDripPhases row for the same order overrides this, and is
     * the only thing that can carry a template or a delay.
     */
    phaseLabels: v.optional(v.array(v.string())),

    /**
     * AUTOMATION. "manual" is the shipped behaviour: phases move only when a
     * human moves them, or when a bound blast goes out. "running" hands the
     * campaign to crm/dripEngine.ts, which sends each configured phase on its
     * own delay. Paused stops the engine without losing anyone's position.
     *
     * Deliberately NOT a boolean: "paused" has to be distinguishable from
     * "never automated", or resuming would have to guess whether the campaign
     * was ever running.
     */
    automation: v.union(v.literal("manual"), v.literal("running"), v.literal("paused")),
    /**
     * Quiet hours, in UTC. A cold sequence that fires at 3am local reads as
     * machine-sent and hurts deliverability. Both unset means no restriction.
     */
    sendWindowStartHour: v.optional(v.number()),
    sendWindowEndHour: v.optional(v.number()),
    /** Allowed weekdays, 0=Sunday. Unset means every day. */
    sendDays: v.optional(v.array(v.number())),
    isArchived: v.boolean(),
    /** Display-only rollups, reconciled nightly. Never trusted for a send. */
    activeCount: v.number(),
    completedCount: v.number(),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_archived_name", ["isArchived", "name"])
    .index("by_created", ["createdAt"]),

  /**
   * THE SOURCE OF TRUTH for campaign membership. One row per contact per
   * campaign, so a contact can sit on a nurture track and an event invite at
   * once, each at its own phase.
   */
  crmDripEnrollments: defineTable({
    dripCampaignId: v.id("crmDripCampaigns"),
    contactId: v.id("crmContacts"),
    /** 0 = enrolled, nothing sent yet. 1..phaseCount = that phase has gone out. */
    phase: v.number(),
    status: v.union(
      v.literal("active"), v.literal("completed"), v.literal("paused"),
      v.literal("replied"), v.literal("removed"),
    ),
    enrolledAt: v.number(),
    enrolledBy: v.optional(v.string()),
    lastPhaseSentAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    /** Set when status becomes removed/replied — kept, not deleted, so history survives a re-enrolment. */
    exitedAt: v.optional(v.number()),
    exitReason: v.optional(v.string()),

    /**
     * When the NEXT phase is due to send. The engine's work queue.
     *
     * Cleared the moment dripEngine claims this row, which is what stops two
     * overlapping ticks from sending the same phase twice — the claim is a
     * transactional patch, not an in-memory lock.
     */
    nextPhaseDueAt: v.optional(v.number()),
    sendAttempts: v.optional(v.number()),
    lastSendError: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_campaign_status", ["dripCampaignId", "status"])
    /** The engine's claim query: active enrollments whose next phase is due. */
    .index("by_due", ["status", "nextPhaseDueAt"])
    .index("by_campaign_contact", ["dripCampaignId", "contactId"])
    .index("by_campaign_phase", ["dripCampaignId", "phase"])
    .index("by_contact", ["contactId"]),

  /**
   * PER-PHASE CONFIGURATION — what each phase sends, and how long after the
   * previous one.
   *
   * Optional by design: a campaign with no phase rows is the manual mode that
   * already shipped (a human moves people through, or a bound blast does).
   * Adding a row with a template is what makes a phase automatable, so a team
   * can automate phases 1-3 and still hand-send 4 and 5.
   *
   * Shaped after crmWorkflowSteps (order + delay + a template reference)
   * because it is the same idea, and the two should read alike.
   */
  crmDripPhases: defineTable({
    dripCampaignId: v.id("crmDripCampaigns"),
    /** 1-based, matching crmDripEnrollments.phase. */
    order: v.number(),
    label: v.optional(v.string()),
    templateId: v.optional(v.id("crmEmailTemplates")),
    /** Days to wait after the previous phase landed before this one sends. */
    delayDays: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_campaign_order", ["dripCampaignId", "order"]),

  crmSuppressions: defineTable({
    /** Lowercased email, or bare domain when scope === "domain". */
    value: v.string(),
    scope: v.union(v.literal("email"), v.literal("domain")),
    reason: v.union(
      v.literal("unsubscribed"), v.literal("complained"), v.literal("hard_bounce"),
      v.literal("manual"), v.literal("role_address"), v.literal("competitor"),
      v.literal("member"), // already enrolled — never outreach-blast a customer
    ),
    note: v.optional(v.string()),
    campaignId: v.optional(v.id("crmCampaigns")),
    contactId: v.optional(v.id("crmContacts")),
    createdBy: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_value", ["value"])
    .index("by_scope_value", ["scope", "value"])
    .index("by_created", ["createdAt"]),

  /**
   * One row per UTC day. A cheap read+patch gives a HARD global cap on CRM
   * sends. At 20–100 recipients this will never bind in normal use — it exists
   * purely so a fat-fingered 5,000-recipient send cannot eat the Resend quota
   * that enrollment confirmations and payment receipts depend on.
   */
  crmSendCounters: defineTable({
    day: v.string(), // "2026-08-24"
    sentCount: v.number(),
    updatedAt: v.number(),
  }).index("by_day", ["day"]),

  crmImportBatches: defineTable({
    filename: v.string(),
    entity: v.union(v.literal("contact"), v.literal("company")),
    /** Confirmed header → field mapping, incl. header→tag rules. */
    columnMapping: v.any(),
    defaultTagIds: v.array(v.id("crmTags")),
    defaultOwnerClerkUserId: v.optional(v.string()),
    defaultSourceDetail: v.optional(v.string()),
    dedupeStrategy: v.union(
      v.literal("skip_existing"), v.literal("fill_blanks_only"),
      v.literal("update_existing"), v.literal("create_duplicates"),
    ),
    status: v.union(
      v.literal("staged"), v.literal("importing"), v.literal("completed"),
      v.literal("failed"), v.literal("rolled_back"),
    ),
    totalRows: v.number(),
    processedRows: v.number(),
    createdCount: v.number(),
    updatedCount: v.number(),
    skippedCount: v.number(),
    errorCount: v.number(),
    /** First 100 row errors verbatim; remainder counted only. */
    errors: v.optional(v.array(v.object({ row: v.number(), message: v.string() }))),
    storageId: v.optional(v.id("_storage")),
    createdBy: v.string(),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_created", ["createdAt"])
    .index("by_status_created", ["status", "createdAt"]),

  /**
   * Adoption ledger for the orphan inbound tables. Lives here rather than as a
   * crmContactId column on each source table, so the CRM adds ZERO schema
   * changes to nexusLeads / inquiries / partnerRegistrations / partnerKit.
   * (sourceTable, sourceId, sourceSlot) makes ingest idempotent.
   */
  crmIngestLinks: defineTable({
    sourceTable: v.union(
      v.literal("nexusLeads"), v.literal("inquiries"),
      v.literal("partnerRegistrations"), v.literal("partnerKitSubmissions"),
      v.literal("repOnboardingSubmissions"), v.literal("accountContacts"),
    ),
    sourceId: v.string(),
    /** repOnboardingSubmissions holds two people per row: "primary" | "rep". */
    sourceSlot: v.optional(v.string()),
    contactId: v.id("crmContacts"),
    companyId: v.optional(v.id("crmCompanies")),
    action: v.union(v.literal("created"), v.literal("merged"), v.literal("skipped")),
    createdBy: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_source", ["sourceTable", "sourceId", "sourceSlot"])
    .index("by_contact", ["contactId"]),

  crmUserSettings: defineTable({
    clerkUserId: v.string(),
    dialProvider: v.union(
      v.literal("tel"), v.literal("ringcentral"), v.literal("dialpad"),
      v.literal("zoom"), v.literal("twilio"), v.literal("custom"),
      v.literal("manual"), // copy-to-clipboard only
    ),
    /** {e164} and {digits} substituted. */
    dialUrlTemplate: v.string(),
    emailSignatureHtml: v.optional(v.string()),
    assignSelfOnCreate: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_clerk_id", ["clerkUserId"]),

  // ============================================
  // WORKFLOW AUTOMATION — rules as data
  // ============================================
  // A workflow is a trigger plus an ORDERED LIST of steps, stored as parent +
  // child rows rather than one JSON blob: individual steps stay queryable and
  // individually debuggable, and a malformed step can't corrupt the whole
  // rule. Config objects are TYPED unions, never v.any() — same reasoning as
  // crmSegments.filters: a stored rule is an input to automated outbound, so
  // typing it is the difference between a validation error and mailing the
  // wrong people unattended.
  //
  // Deliberately a linear sequence, not a branching DAG. Sequences ("touch →
  // wait 3 days → touch again") are what a benefits sales team actually runs;
  // a node canvas is a large UI surface for a capability nobody has asked for.
  crmWorkflows: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    isActive: v.boolean(),
    entity: v.union(v.literal("contact"), v.literal("company"), v.literal("deal")),

    triggerType: v.union(
      v.literal("contact_created"),
      v.literal("company_created"),
      v.literal("deal_created"),
      v.literal("stage_entered"),
      v.literal("tag_applied"),
      v.literal("status_changed"),
      v.literal("no_activity_days"),
      v.literal("manual"),
    ),
    /** Typed per triggerType; validated by workflows.ts on write. */
    triggerConfig: v.object({
      stageId: v.optional(v.id("crmPipelineStages")),
      tagId: v.optional(v.id("crmTags")),
      status: v.optional(v.string()),
      /** no_activity_days: fire when lastActivityAt is older than this. */
      days: v.optional(v.number()),
    }),

    /** Rollups for the list view; recomputed on each run, never authoritative. */
    runCount: v.number(),
    lastRunAt: v.optional(v.number()),

    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_active_trigger", ["isActive", "triggerType"])
    .index("by_entity", ["entity"])
    .index("by_created", ["createdAt"]),

  crmWorkflowSteps: defineTable({
    workflowId: v.id("crmWorkflows"),
    /** Ascending execution order. */
    order: v.number(),
    /** 0 runs immediately after the previous step; >0 schedules a resume. */
    delayMinutes: v.number(),

    actionType: v.union(
      v.literal("create_task"),
      v.literal("apply_tag"),
      v.literal("remove_tag"),
      v.literal("update_deal_stage"),
      v.literal("send_email_template"),
      v.literal("notify_owner"),
      v.literal("add_note"),
    ),
    actionConfig: v.object({
      // create_task
      taskType: v.optional(v.string()),
      taskTitle: v.optional(v.string()),
      dueInDays: v.optional(v.number()),
      assignTo: v.optional(v.string()), // clerkUserId, or "owner"
      // apply_tag / remove_tag
      tagId: v.optional(v.id("crmTags")),
      // update_deal_stage
      stageId: v.optional(v.id("crmPipelineStages")),
      // send_email_template
      templateId: v.optional(v.id("crmEmailTemplates")),
      // notify_owner / add_note
      message: v.optional(v.string()),
    }),

    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_workflow_order", ["workflowId", "order"]),

  /**
   * Execution ledger — idempotency AND the "why didn't this fire" audit trail.
   *
   * The unique key is (workflowId, targetId, occurrenceKey), NOT
   * (workflowId, targetId). Keying on the record alone would be wrong: a deal
   * that legitimately re-enters a stage should re-fire. The occurrence key is
   * trigger-specific and computed in workflowEngine.ts — for stage_entered it
   * is the stage id + stageChangedAt, so genuine re-entry produces a new key
   * while a duplicate event of the SAME entry collides and is dropped.
   */
  crmWorkflowRuns: defineTable({
    workflowId: v.id("crmWorkflows"),
    targetType: v.union(v.literal("contact"), v.literal("company"), v.literal("deal")),
    targetId: v.string(),
    occurrenceKey: v.string(),

    status: v.union(
      v.literal("pending_steps"), v.literal("completed"),
      v.literal("failed"), v.literal("cancelled"),
    ),
    /** Order of the NEXT step to run. */
    currentStepOrder: v.number(),
    nextStepAt: v.optional(v.number()),

    /** Per-step outcome log — what makes a skipped send explainable. */
    stepLog: v.array(v.object({
      order: v.number(),
      actionType: v.string(),
      outcome: v.union(v.literal("done"), v.literal("skipped"), v.literal("failed")),
      detail: v.optional(v.string()),
      at: v.number(),
    })),
    lastError: v.optional(v.string()),

    firedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_dedupe", ["workflowId", "targetId", "occurrenceKey"])
    .index("by_due", ["status", "nextStepAt"])
    .index("by_workflow_fired", ["workflowId", "firedAt"])
    .index("by_target", ["targetId"]),

  // ============================================
  // PARTNER RESOURCE LIBRARY
  // ============================================
  // Marketing collateral, the partner kit, training material and forms that
  // partners download from /partner/resources.
  //
  // WHITE-LABEL IS THE CONSTRAINT THAT SHAPES THIS TABLE. A Flourish XV agency
  // must never be handed Ideal-branded flyers. But `distributionPartners` has
  // no `siteId` — a partner is not bound to a brand, they sell into whichever
  // sites their groups and members belong to. So brand restriction is expressed
  // per RESOURCE (`siteIds`) and matched at read time against the set of sites
  // the viewer's own book actually touches.
  partnerResources: defineTable({
    title: v.string(),
    description: v.optional(v.string()),

    // Only the first three are offered to admins — see ACTIVE_CATEGORIES in
    // resources/library.ts, which is the single source for the picker and the
    // filter rail. The rest are RETIRED, not removed: dropping a literal from
    // this union would fail validation for any row already carrying it. They
    // still display, and can be un-retired by listing them again.
    category: v.union(
      v.literal("partner_kit"),     // agreement, W-9, onboarding paperwork
      v.literal("partner_pieces"),  // flyers, one-pagers, anything partners hand out
      v.literal("other"),
      // ── retired ───────────────────────────────────────────────────────
      v.literal("marketing"),
      v.literal("collateral"),
      v.literal("training"),
      v.literal("compliance"),
      v.literal("forms"),
    ),

    // A resource is either an uploaded file or a link out (a video, a shared
    // drive). Links avoid re-hosting large media we don't own.
    kind: v.union(v.literal("file"), v.literal("link")),
    storageId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    contentType: v.optional(v.string()),
    fileSizeBytes: v.optional(v.number()),
    externalUrl: v.optional(v.string()),

    // ── VISIBILITY ──────────────────────────────────────────────────────
    audience: v.union(
      v.literal("all"),            // every partner and rep
      v.literal("partner_types"),  // e.g. FMOs only
      v.literal("specific"),       // named partners
    ),
    partnerTypes: v.optional(v.array(v.union(
      v.literal("program_manager"),
      v.literal("fmo"),
      v.literal("agency"),
    ))),
    /** distributionPartners._id values, when audience is "specific". */
    partnerIds: v.optional(v.array(v.string())),
    /**
     * Brand restriction. ABSENT OR EMPTY MEANS ALL BRANDS — the common case.
     * When set, only viewers whose book touches one of these sites may see it.
     */
    siteIds: v.optional(v.array(v.id("sites"))),

    status: v.union(
      v.literal("draft"),      // staged, not visible to partners
      v.literal("published"),
      v.literal("archived"),   // hidden, retained for the download record
    ),
    featured: v.optional(v.boolean()),
    /** Manual ordering within a category; lower sorts first. */
    sortOrder: v.optional(v.number()),

    // Superseding rather than overwriting keeps a prior version's download
    // history meaningful — "who has the old flyer?" stays answerable.
    version: v.optional(v.number()),
    supersedesId: v.optional(v.id("partnerResources")),

    downloadCount: v.number(),
    lastDownloadedAt: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.optional(v.string()),
    publishedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_category", ["category", "status"])
    .index("by_created", ["createdAt"]),

  // Append-only download log. Answers "which agencies actually use what" and,
  // for compliance material, "who has taken this and when".
  partnerResourceDownloads: defineTable({
    resourceId: v.id("partnerResources"),
    /** Denormalized so a deleted resource still reports meaningfully. */
    resourceTitle: v.string(),
    clerkUserId: v.string(),
    partnerId: v.optional(v.string()),
    partnerName: v.optional(v.string()),
    leaderId: v.optional(v.string()),
    viewerKind: v.union(
      v.literal("admin"),
      v.literal("partner"),
      v.literal("rep"),
    ),
    downloadedAt: v.number(),
  })
    .index("by_resource", ["resourceId", "downloadedAt"])
    .index("by_partner", ["partnerId", "downloadedAt"])
    .index("by_downloaded", ["downloadedAt"]),

});
