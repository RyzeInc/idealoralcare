import { mutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Seed catalog + hierarchy for the New Ideal Health (`newideal`) site.
 *
 * Run from CLI:
 *   npx convex run admin/seedNewIdeal:seedNewIdeal
 *
 * Creates 4 catalog products (Essentials Plan, 4 coverage tiers)
 * and the site/account/group hierarchy.
 *
 * `stripeProductId` for each tier must be filled in via the admin
 * `setNewIdealStripeIds` mutation after Stripe Products are created.
 */

const ESSENTIALS_TIERS = [
  { suffix: "employee", label: "Employee", cents: 5795 },
  { suffix: "employee-spouse", label: "Employee + Spouse", cents: 6595 },
  { suffix: "employee-child", label: "Employee + Child", cents: 7795 },
  { suffix: "employee-family", label: "Employee + Family", cents: 8295 },
];

const ESSENTIALS_INCLUSIONS = [
  "Lyric Telehealth — Virtual Urgent Care (24/7), Virtual Primary Care & Virtual Dermatology",
  "RxValet Prescription Savings — Use Rx Group GIH1000 at any major pharmacy",
  "QuestSelect Lab Services — Discounted lab testing at Quest locations nationwide",
  "Balance for Life — Behavioral health, mindfulness & substance disorder support",
];

const ORALCARE_TIERS = [
  { suffix: "employee", label: "Employee", cents: 1499 },
  { suffix: "employee-family", label: "Employee + Family", cents: 2499 },
];

const ORALCARE_INCLUSIONS = [
  "Dental Savings — 20\u201360% off dental procedures at 100,000+ participating dentists nationwide",
  "Vision Discounts — Savings on eye exams, glasses frames, lenses, and contacts at major optical providers",
  "Hearing Care — Discounts on hearing exams and hearing aid devices",
];

export const seedNewIdeal = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // ── 1. Catalog products (skip any that already exist by slug) ──
    const productIds: Record<string, any> = {};

    const insertProductIfMissing = async (doc: any) => {
      const existing = await ctx.db
        .query("catalogProducts")
        .withIndex("by_slug", (q: any) => q.eq("slug", doc.slug))
        .first();
      if (existing) {
        productIds[doc.slug] = existing._id;
        // Keep pricing, inclusions, description and visibility in sync on every seed run
        await ctx.db.patch(existing._id, {
          inclusions: doc.inclusions,
          description: doc.description,
          pricing: doc.pricing,
          isVisible: doc.isVisible,
          name: doc.name,
          updatedAt: doc.updatedAt,
        });
        return;
      }
      productIds[doc.slug] = await ctx.db.insert("catalogProducts", doc);
    };

    let order = 100;
    for (const tier of ESSENTIALS_TIERS) {
      await insertProductIfMissing({
        slug: `essentials-${tier.suffix}`,
        name: `Essentials Plan — ${tier.label}`,
        category: "newideal",
        description: `New Ideal Health Essentials membership for ${tier.label}.`,
        inclusions: ESSENTIALS_INCLUSIONS,
        exclusions: ["Not insurance", "Not a substitute for major medical coverage"],
        eligibilityRules: {
          requiresVerification: false,
          disclosureText:
            "This is a membership program and is NOT insurance. Discounts vary by program.",
        },
        activationBehavior: "immediate" as const,
        pricing: {
          monthlyCardCents: tier.cents,
          monthlyACHCents: tier.cents,
          annualCardCents: tier.cents * 12,
          annualACHCents: tier.cents * 12,
        },
        metadata: { icon: "Heart", bestFor: [tier.label], color: "blue" },
        isVisible: true,
        isFeatured: tier.suffix === "employee",
        order: order++,
        createdAt: now,
        updatedAt: now,
      });
    }

    for (const tier of ORALCARE_TIERS) {
      await insertProductIfMissing({
        slug: `oralcare-${tier.suffix}`,
        name: `Oral Care — ${tier.label}`,
        category: "newideal",
        description: `Ideal Health Oral Care add-on for ${tier.label}. Dental, vision & hearing discounts.`,
        inclusions: ORALCARE_INCLUSIONS,
        exclusions: ["Not insurance", "Not a substitute for dental insurance"],
        eligibilityRules: {
          requiresVerification: false,
          disclosureText:
            "This is a discount membership and is NOT insurance. Savings vary by provider and location.",
        },
        activationBehavior: "immediate" as const,
        pricing: {
          monthlyCardCents: tier.cents,
          monthlyACHCents: tier.cents,
          annualCardCents: tier.cents * 12,
          annualACHCents: tier.cents * 12,
        },
        metadata: { icon: "Smile", bestFor: [tier.label], color: "teal" },
        isVisible: true,
        isFeatured: false,
        order: order++,
        createdAt: now,
        updatedAt: now,
      });
    }

    // ── Cleanup: delete any oralcare products not in the current tier list ──
    const validOralCareSlugs = new Set(ORALCARE_TIERS.map((t) => `oralcare-${t.suffix}`));
    const allNewidealProducts = await ctx.db
      .query("catalogProducts")
      .collect();
    for (const p of allNewidealProducts) {
      if (p.slug?.startsWith("oralcare-") && !validOralCareSlugs.has(p.slug)) {
        await ctx.db.delete(p._id);
      }
    }

    // ── 2. Site ──
    let site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q: any) => q.eq("slug", "newideal"))
      .first();

    if (!site) {
      const siteId = await ctx.db.insert("sites", {
        slug: "newideal",
        name: "New Ideal Health",
        type: "whitelabel",
        branding: {
          logoUrl: "/newideal/logo.png",
          primaryColor: "#1e3a5f",
          secondaryColor: "#14b8a6",
        },
        allowedPlanIds: Object.values(productIds),
        defaultCadence: "monthly",
        defaultPaymentMethod: "card",
        enrollmentDefaults: {
          requireGroupCode: false,
          requireEligibilityMatch: false,
          allowSelfEnrollment: true,
          requirePayment: true,
          autoActivate: true,
          collectAddress: true,
          collectPhone: true,
          collectEmployeeId: false,
          collectDependents: false,
          welcomeMessage: "Welcome to New Ideal Health!",
          supportEmail: "support@newidealhealth.com",
        },
        status: "active",
        createdAt: now,
        updatedAt: now,
        activatedAt: now,
      });
      site = await ctx.db.get(siteId);
    }

    if (!site) throw new Error("Failed to create newideal site");

    // Ensure allowedPlanIds includes all current products (essentials + oral care)
    await ctx.db.patch(site._id, {
      allowedPlanIds: Object.values(productIds),
      updatedAt: now,
    });

    // ── 3. Account ──
    let account = await ctx.db
      .query("accounts")
      .withIndex("by_site", (q: any) => q.eq("siteId", site!._id))
      .filter((q: any) => q.eq(q.field("slug"), "individual"))
      .first();

    if (!account) {
      const accountId = await ctx.db.insert("accounts", {
        siteId: site._id,
        slug: "individual",
        name: "New Ideal Health Individual Members",
        accountType: "individual",
        billingModel: "direct",
        contacts: [
          {
            name: "Support",
            email: "support@newidealhealth.com",
            role: "primary",
          },
        ],
        status: "active",
        createdAt: now,
        updatedAt: now,
        activatedAt: now,
      });
      account = await ctx.db.get(accountId);
    }

    if (!account) throw new Error("Failed to create newideal account");

    // ── 4. Group ──
    let group = await ctx.db
      .query("groups")
      .withIndex("by_account", (q: any) => q.eq("accountId", account!._id))
      .filter((q: any) => q.eq(q.field("slug"), "newideal-dtc"))
      .first();

    if (!group) {
      const groupId = await ctx.db.insert("groups", {
        siteId: site._id,
        accountId: account._id,
        slug: "newideal-dtc",
        name: "New Ideal Health DTC",
        description: "Default group for newidealhealth.com self-enrollment",
        groupCode: "NEWIDEAL",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      group = await ctx.db.get(groupId);
    }

    return {
      success: true,
      productSlugs: Object.keys(productIds),
      productIds,
      siteId: site._id,
      accountId: account._id,
      groupId: group?._id,
    };
  },
});

/**
 * Attach Stripe Product IDs to the seeded newideal catalog products.
 * The same Stripe Product ID is used for both card and ACH (same price).
 *
 * Run from CLI after creating Stripe Products:
 *   npx convex run admin/seedNewIdeal:setNewIdealStripeIds \
 *     '{"mapping": {"essentials-employee": "prod_xxx", ...}}'
 */
export const setNewIdealStripeIds = mutation({
  args: {
    mapping: v.any(),
  },
  handler: async (ctx, args) => {
    const updates: { slug: string; stripeProductId: string }[] = [];
    const mapping = args.mapping as Record<string, string>;

    for (const [slug, stripeProductId] of Object.entries(mapping)) {
      const product = await ctx.db
        .query("catalogProducts")
        .withIndex("by_slug", (q: any) => q.eq("slug", slug))
        .first();
      if (!product) continue;

      await ctx.db.patch(product._id, {
        stripeProducts: {
          monthlyCardId: stripeProductId,
          monthlyACHId: stripeProductId,
          annualCardId: stripeProductId,
          annualACHId: stripeProductId,
        },
        updatedAt: Date.now(),
      });
      updates.push({ slug, stripeProductId });
    }

    return { success: true, updates };
  },
});

/**
 * Remove deprecated Financial Shield catalog products. Run once after
 * dropping the Shield program from the site.
 *
 *   npx convex run admin/seedNewIdeal:removeFinancialShield
 */
export const removeFinancialShield = mutation({
  args: {},
  handler: async (ctx) => {
    const products = await ctx.db
      .query("catalogProducts")
      .withIndex("by_category", (q: any) => q.eq("category", "newideal"))
      .collect();

    const removed: string[] = [];
    for (const p of products) {
      if (p.slug?.startsWith("financial-shield-")) {
        await ctx.db.delete(p._id);
        removed.push(p.slug);
      }
    }

    // Refresh site.allowedPlanIds to the remaining products
    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q: any) => q.eq("slug", "newideal"))
      .first();

    if (site) {
      const remaining = await ctx.db
        .query("catalogProducts")
        .withIndex("by_category", (q: any) => q.eq("category", "newideal"))
        .collect();
      await ctx.db.patch(site._id, {
        allowedPlanIds: remaining.map((p) => p._id),
        updatedAt: Date.now(),
      });
    }

    return { success: true, removed };
  },
});
