import { mutation, query } from "../_generated/server";
import { v } from "convex/values";

/**
 * Seed the catalog with initial products — no auth required.
 * Use this from the CLI: npx convex run admin/devTools:seedCatalog
 * (The regular catalog/mutations:seedInitialData requires admin JWT which CLI can't provide.)
 */
export const seedCatalog = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("catalogProducts").collect();
    if (existing.length > 0) {
      return {
        success: false,
        message: `Catalog already has ${existing.length} products. Clear them first if needed.`,
      };
    }

    const now = Date.now();
    const products = [
      {
        slug: "oral-health-individual",
        name: "Ideal Oral Savings Plan",
        category: "dental",
        description:
          "Wide Ranging oral healthcare discount plan with AI Oral Scanning, 24/7 teledentistry consultations, and access to the Dental Discount Network.",
        inclusions: [
          "AI Oral Scanning",
          "24/7 Teledentistry Program",
          "Dental Discount Network Access",
          "Preventive Discounts",
          "Member ID Card",
          "Emergency Access",
        ],
        exclusions: ["Not traditional dental insurance", "Savings-based discount plan"],
        eligibilityRules: { requiresVerification: false, disclosureText: "This plan is not insurance." },
        activationBehavior: "immediate" as const,
        pricing: { monthlyCardCents: 1499, monthlyACHCents: 1499, annualCardCents: 16499, annualACHCents: 16499 },
        metadata: { icon: "Heart", bestFor: ["Individuals"] },
        isVisible: true,
        isFeatured: true,
        order: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        slug: "oral-health-family",
        name: "Ideal Oral Savings Plan — Family",
        category: "dental",
        description:
          "Wide Ranging oral healthcare discount plan for the whole family with AI Oral Scanning, 24/7 teledentistry, and the Dental Discount Network.",
        inclusions: [
          "Everything in Individual Plan",
          "Unlimited Dependents Covered",
          "AI Oral Scanning for Family",
          "24/7 Teledentistry Program",
          "Dental Discount Network Access",
          "Family Member ID Cards",
        ],
        exclusions: ["Not traditional dental insurance", "Savings-based discount plan"],
        eligibilityRules: { requiresVerification: false, disclosureText: "This plan is not insurance." },
        activationBehavior: "immediate" as const,
        pricing: { monthlyCardCents: 2499, monthlyACHCents: 2499, annualCardCents: 27499, annualACHCents: 27499 },
        metadata: { icon: "Users", bestFor: ["Families"] },
        isVisible: true,
        isFeatured: true,
        order: 1,
        createdAt: now,
        updatedAt: now,
      },
    ];

    const ids = [];
    for (const p of products) {
      ids.push(await ctx.db.insert("catalogProducts", p));
    }

    return { success: true, message: `Seeded ${ids.length} products`, count: ids.length };
  },
});

/**
 * Links an admin account to an active memberProfile so they can test
 * all member-facing flows (dependents, entitlements, member cards, etc.).
 *
 * - Idempotent: if a profile already exists for this admin, returns it unchanged.
 * - Attaches to the first active site → account → group hierarchy found in the DB.
 * - Run once from the Convex dashboard: pass your Clerk user_xxx ID as clerkUserId.
 */
export const linkAdminAsMember = mutation({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    // Look up the admin record to get name/email
    const adminRecord = await ctx.db
      .query("adminUsers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();

    if (!adminRecord) throw new Error("Admin record not found");

    // Idempotency: return existing profile if already linked
    const existing = await ctx.db
      .query("memberProfiles")
      .withIndex("by_customer", (q) => q.eq("customerId", args.clerkUserId))
      .filter((q) => q.neq(q.field("status"), "terminated"))
      .first();

    if (existing) {
      return { profileId: existing._id, memberId: existing.memberId, created: false };
    }

    // Resolve hierarchy — pick the first active site/account/group
    const site = await ctx.db
      .query("sites")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .first();
    if (!site) throw new Error("No active site found. Run seedDTCData first.");

    const account = await ctx.db
      .query("accounts")
      .withIndex("by_site", (q) => q.eq("siteId", site._id))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();
    if (!account) throw new Error("No active account found under that site.");

    const group = await ctx.db
      .query("groups")
      .withIndex("by_account", (q) => q.eq("accountId", account._id))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();
    if (!group) throw new Error("No active group found under that account.");

    // Generate member ID
    const memberCount = await ctx.db
      .query("memberProfiles")
      .withIndex("by_site", (q) => q.eq("siteId", site._id))
      .collect();

    const sequence = memberCount.length + 1;
    const memberId = String(100000000 + sequence).slice(0, 9);
    const year = String(new Date().getFullYear()).slice(2);
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const barcode = `ADM${year}${random}`;

    const nameParts = adminRecord.name.split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ") || "-";

    const now = Date.now();

    const profileId = await ctx.db.insert("memberProfiles", {
      memberId,
      barcode,
      customerId: args.clerkUserId,
      siteId: site._id,
      accountId: account._id,
      groupId: group._id,
      firstName,
      lastName,
      email: adminRecord.email,
      phone: adminRecord.phone,
      memberType: "active",
      memberRole: "primary",
      signupSource: "admin-dev-tool",
      status: "active",
      communicationPrefs: {
        emailOptIn: true,
        smsOptIn: false,
        callOptIn: false,
        preferredChannel: "email",
      },
      createdAt: now,
      updatedAt: now,
    });

    return { profileId, memberId, created: true };
  },
});

/**
 * Check whether a given Clerk user ID already has a linked member profile.
 */
export const getMyMemberProfile = query({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("memberProfiles")
      .withIndex("by_customer", (q) => q.eq("customerId", args.clerkUserId))
      .filter((q) => q.neq(q.field("status"), "terminated"))
      .first();
  },
});

/**
 * Set Stripe product IDs on a catalog product by slug.
 * Called by scripts/setup-test-stripe.js to wire up test Stripe products.
 * No auth required — intended to be run via `npx convex run` in dev only.
 */
export const setTestStripeIds = mutation({
  args: {
    slug: v.string(),
    stripeProducts: v.object({
      monthlyCardId: v.string(),
      monthlyACHId: v.string(),
      annualCardId: v.string(),
      annualACHId: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db
      .query("catalogProducts")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (!product) {
      throw new Error(`Catalog product not found: ${args.slug}`);
    }

    await ctx.db.patch(product._id, {
      stripeProducts: args.stripeProducts,
      updatedAt: Date.now(),
    });

    return { success: true, productId: product._id, slug: args.slug };
  },
});
