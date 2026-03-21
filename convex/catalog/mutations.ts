/**
 * CATALOG MUTATIONS
 *
 * Mutations for managing the product catalog
 */

import { mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "../lib/authGuards";

// Seed initial catalog data
export const seedInitialData = mutation({
  args: {},
  handler: async (ctx: any) => {
    // Admin-only access
    await requireAdmin(ctx);
    
    // Check if products already exist
    const existing = await ctx.db.query("catalogProducts").collect();
    if (existing.length > 0) {
      return {
        success: false,
        message: `Catalog already has ${existing.length} products. Clear them first if you want to reseed.`,
      };
    }

    const initialProducts = [
      {
        slug: "oral-health-individual",
        name: "Ideal Oral Health Plan",
        category: "dental",
        description:
          "Comprehensive oral health coverage with AI Oral Scanning, 24/7 teledentistry consultations, and access to the Dental Discount Network dental discount network.",
        longDescription:
          "Our Oral Health Plan provides comprehensive access to dental care through innovative technology and a nationwide network of providers. Features include AI Oral Scanning, 24/7 teledentistry consultations, and significant discounts on procedures through the Dental Discount Network dental provider network.",
        inclusions: [
          "AI Oral Scanning",
          "24/7 Teledentistry Program",
          "Dental Discount Network Access",
          "Preventive Discounts",
          "Member ID Card",
          "Emergency Access",
        ],
        exclusions: ["Not traditional dental insurance", "Savings-based discount plan"],
        eligibilityRules: {
          requiresVerification: false,
          disclosureText: "This is a savings-based discount plan, not insurance.",
        },
        activationBehavior: "immediate",
        pricing: {
          monthlyCardCents: 1499,
          monthlyACHCents: 1499,
          annualCardCents: 14999,
          annualACHCents: 14999,
        },
        stripeProducts: {
          monthlyCardId: "prod_U3no15TNX9iTj1",
          monthlyACHId: "prod_U3nrt0liKgXRmq",
          annualCardId: "prod_U3nsR7DN8AVcL9",
          annualACHId: "prod_U3ns1IYNVgNwGM",
        },
        metadata: {
          icon: "Heart",
          bestFor: ["Individuals"],
        },
        isVisible: true,
        isFeatured: true,
        order: 0,
      },
      {
        slug: "oral-health-family",
        name: "Ideal Oral Health Plan \u2014 Family",
        category: "dental",
        description:
          "Comprehensive oral health coverage for the whole family with AI Oral Scanning, 24/7 teledentistry, and the Dental Discount Network.",
        longDescription:
          "Everything in the Individual plan, extended to your entire family.",
        inclusions: [
          "Everything in Individual Plan",
          "Unlimited Dependents Covered",
          "AI Oral Scanning for Family",
          "24/7 Teledentistry Program",
          "Dental Discount Network Access",
          "Family Member ID Cards",
        ],
        exclusions: ["Not traditional dental insurance", "Savings-based discount plan"],
        eligibilityRules: {
          requiresVerification: false,
          disclosureText: "This is a savings-based discount plan, not insurance.",
        },
        activationBehavior: "immediate",
        pricing: {
          monthlyCardCents: 2499,
          monthlyACHCents: 2499,
          annualCardCents: 24999,
          annualACHCents: 24999,
        },
        stripeProducts: {
          monthlyCardId: "prod_FAMILY_MONTHLY_CARD_TBD",
          monthlyACHId: "prod_FAMILY_MONTHLY_ACH_TBD",
          annualCardId: "prod_FAMILY_ANNUAL_CARD_TBD",
          annualACHId: "prod_FAMILY_ANNUAL_ACH_TBD",
        },
        metadata: {
          icon: "Users",
          bestFor: ["Families"],
        },
        isVisible: true,
        isFeatured: true,
        order: 1,
      },
    ];

    const createdProducts = [];
    const now = Date.now();

    for (const product of initialProducts) {
      const id = await ctx.db.insert("catalogProducts", {
        ...product,
        createdAt: now,
        updatedAt: now,
      });
      createdProducts.push(id);
    }

    return {
      success: true,
      message: `Successfully seeded ${createdProducts.length} products`,
      count: createdProducts.length,
    };
  },
});

// Reseed catalog data (clears existing and reseeds)
export const reseedData = mutation({
  args: {},
  handler: async (ctx: any) => {
    // Admin-only access
    await requireAdmin(ctx);
    
    // Get all existing products
    const existing = await ctx.db.query("catalogProducts").collect();

    // Delete all existing products
    for (const product of existing) {
      await ctx.db.delete(product._id);
    }

    const initialProducts = [
      {
        slug: "oral-health-individual",
        name: "Ideal Oral Health Plan",
        category: "dental",
        description:
          "Comprehensive oral health coverage with AI Oral Scanning, 24/7 teledentistry consultations, and access to the Dental Discount Network dental discount network.",
        longDescription:
          "Our Oral Health Plan provides comprehensive access to dental care through innovative technology and a nationwide network of providers. Features include AI Oral Scanning, 24/7 teledentistry consultations, and significant discounts on procedures through the Dental Discount Network dental provider network.",
        inclusions: [
          "AI Oral Scanning",
          "24/7 Teledentistry Program",
          "Dental Discount Network Access",
          "Preventive Discounts",
          "Member ID Card",
          "Emergency Access",
        ],
        exclusions: ["Not traditional dental insurance", "Savings-based discount plan"],
        eligibilityRules: {
          requiresVerification: false,
          disclosureText: "This is a savings-based discount plan, not insurance.",
        },
        activationBehavior: "immediate",
        pricing: {
          monthlyCardCents: 1499,
          monthlyACHCents: 1499,
          annualCardCents: 14999,
          annualACHCents: 14999,
        },
        stripeProducts: {
          monthlyCardId: "prod_U3no15TNX9iTj1",
          monthlyACHId: "prod_U3nrt0liKgXRmq",
          annualCardId: "prod_U3nsR7DN8AVcL9",
          annualACHId: "prod_U3ns1IYNVgNwGM",
        },
        metadata: {
          icon: "Heart",
          bestFor: ["Individuals"],
        },
        isVisible: true,
        isFeatured: true,
        order: 0,
      },
      {
        slug: "oral-health-family",
        name: "Ideal Oral Health Plan \u2014 Family",
        category: "dental",
        description:
          "Comprehensive oral health coverage for the whole family with AI Oral Scanning, 24/7 teledentistry, and the Dental Discount Network.",
        longDescription:
          "Everything in the Individual plan, extended to your entire family.",
        inclusions: [
          "Everything in Individual Plan",
          "Unlimited Dependents Covered",
          "AI Oral Scanning for Family",
          "24/7 Teledentistry Program",
          "Dental Discount Network Access",
          "Family Member ID Cards",
        ],
        exclusions: ["Not traditional dental insurance", "Savings-based discount plan"],
        eligibilityRules: {
          requiresVerification: false,
          disclosureText: "This is a savings-based discount plan, not insurance.",
        },
        activationBehavior: "immediate",
        pricing: {
          monthlyCardCents: 2499,
          monthlyACHCents: 2499,
          annualCardCents: 24999,
          annualACHCents: 24999,
        },
        stripeProducts: {
          monthlyCardId: "prod_FAMILY_MONTHLY_CARD_TBD",
          monthlyACHId: "prod_FAMILY_MONTHLY_ACH_TBD",
          annualCardId: "prod_FAMILY_ANNUAL_CARD_TBD",
          annualACHId: "prod_FAMILY_ANNUAL_ACH_TBD",
        },
        metadata: {
          icon: "Users",
          bestFor: ["Families"],
        },
        isVisible: true,
        isFeatured: true,
        order: 1,
      },
    ];

    const createdProducts = [];
    const now = Date.now();

    for (const product of initialProducts) {
      const id = await ctx.db.insert("catalogProducts", {
        ...product,
        createdAt: now,
        updatedAt: now,
      });
      createdProducts.push(id);
    }

    return {
      success: true,
      message: `Successfully reseeded ${createdProducts.length} products (cleared ${existing.length} old products)`,
      count: createdProducts.length,
    };
  },
});

/** Internal version — no auth check, callable via `npx convex run --prod catalog/mutations:reseedInternal` */
export const reseedInternal = internalMutation({
  args: {},
  handler: async (ctx: any) => {
    const existing = await ctx.db.query("catalogProducts").collect();
    for (const product of existing) {
      await ctx.db.delete(product._id);
    }

    const product = {
      slug: "oral-health-individual",
      name: "Ideal Oral Health Plan",
      category: "dental",
      description:
        "Comprehensive oral health coverage with AI Oral Scanning, 24/7 teledentistry consultations, and access to the Dental Discount Network.",
      longDescription:
        "Our Oral Health Plan provides comprehensive access to dental care through innovative technology and a nationwide network of providers. Features include AI Oral Scanning, 24/7 teledentistry consultations, and significant discounts on procedures through the Dental Discount Network.",
      inclusions: [
        "AI Oral Scanning",
        "24/7 Teledentistry Program",
        "Dental Discount Network Access",
        "Preventive Discounts",
        "Member ID Card",
        "Emergency Access",
      ],
      exclusions: ["Not traditional dental insurance", "Savings-based discount plan"],
      eligibilityRules: {
        requiresVerification: false,
        disclosureText: "This is a savings-based discount plan, not insurance.",
      },
      activationBehavior: "immediate" as const,
      pricing: {
        monthlyCardCents: 1499,
        monthlyACHCents: 1499,
        annualCardCents: 14999,
        annualACHCents: 14999,
      },
      stripeProducts: {
        monthlyCardId: "prod_U3no15TNX9iTj1",
        monthlyACHId: "prod_U3nrt0liKgXRmq",
        annualCardId: "prod_U3nsR7DN8AVcL9",
        annualACHId: "prod_U3ns1IYNVgNwGM",
      },
      metadata: {
        icon: "Heart",
        bestFor: ["Individuals"],
      },
      isVisible: true,
      isFeatured: true,
      order: 0,
    };

    const familyProduct = {
      slug: "oral-health-family",
      name: "Ideal Oral Health Plan \u2014 Family",
      category: "dental",
      description:
        "Comprehensive oral health coverage for the whole family with AI Oral Scanning, 24/7 teledentistry, and the Dental Discount Network.",
      longDescription:
        "Everything in the Individual plan, extended to your entire family. Add unlimited dependents and enjoy AI Oral Scanning, teledentistry, and dental discount network access.",
      inclusions: [
        "Everything in Individual Plan",
        "Unlimited Dependents Covered",
        "AI Oral Scanning for Family",
        "24/7 Teledentistry Program",
        "Dental Discount Network Access",
        "Family Member ID Cards",
      ],
      exclusions: ["Not traditional dental insurance", "Savings-based discount plan"],
      eligibilityRules: {
        requiresVerification: false,
        disclosureText: "This is a savings-based discount plan, not insurance.",
      },
      activationBehavior: "immediate" as const,
      pricing: {
        monthlyCardCents: 2499,
        monthlyACHCents: 2499,
        annualCardCents: 24999,
        annualACHCents: 24999,
      },
      stripeProducts: {
        monthlyCardId: "prod_FAMILY_MONTHLY_CARD_TBD",
        monthlyACHId: "prod_FAMILY_MONTHLY_ACH_TBD",
        annualCardId: "prod_FAMILY_ANNUAL_CARD_TBD",
        annualACHId: "prod_FAMILY_ANNUAL_ACH_TBD",
      },
      metadata: {
        icon: "Users",
        bestFor: ["Families"],
      },
      isVisible: true,
      isFeatured: true,
      order: 1,
    };

    const now = Date.now();
    const id = await ctx.db.insert("catalogProducts", { ...product, createdAt: now, updatedAt: now });
    const familyId = await ctx.db.insert("catalogProducts", { ...familyProduct, createdAt: now, updatedAt: now });

    return {
      success: true,
      message: `Reseeded 2 products (cleared ${existing.length} old)`,
      ids: [id, familyId],
    };
  },
});

/**
 * v0.7 upsert: updates individual plan pricing and adds family tier without clearing data.
 * Run via: npx convex run catalog/mutations:upsertV07Products
 */
export const upsertV07Products = internalMutation({
  args: {},
  handler: async (ctx: any) => {
    const now = Date.now();
    const existing = await ctx.db.query("catalogProducts").collect();

    // Update existing individual plan pricing
    for (const p of existing) {
      if (p.slug === "oral-health-plan" || p.slug === "oral-health-individual") {
        await ctx.db.patch(p._id, {
          slug: "oral-health-individual",
          pricing: {
            monthlyCardCents: 1499,
            monthlyACHCents: 1499,
            annualCardCents: 14999,
            annualACHCents: 14999,
          },
          metadata: { icon: "Heart", bestFor: ["Individuals"] },
          updatedAt: now,
        });
      }
    }

    // Add family tier if it doesn't exist
    const familyExists = existing.some((p: any) => p.slug === "oral-health-family");
    let familyId = null;
    if (!familyExists) {
      familyId = await ctx.db.insert("catalogProducts", {
        slug: "oral-health-family",
        name: "Ideal Oral Health Plan \u2014 Family",
        category: "dental",
        description: "Comprehensive oral health coverage for the whole family.",
        longDescription: "Everything in the Individual plan, extended to your entire family.",
        inclusions: [
          "Everything in Individual Plan",
          "Unlimited Dependents Covered",
          "AI Oral Scanning for Family",
          "24/7 Teledentistry Program",
          "Dental Discount Network Access",
          "Family Member ID Cards",
        ],
        exclusions: ["Not traditional dental insurance", "Savings-based discount plan"],
        eligibilityRules: {
          requiresVerification: false,
          disclosureText: "This is a savings-based discount plan, not insurance.",
        },
        activationBehavior: "immediate",
        pricing: {
          monthlyCardCents: 2499,
          monthlyACHCents: 2499,
          annualCardCents: 24999,
          annualACHCents: 24999,
        },
        stripeProducts: {
          monthlyCardId: "prod_FAMILY_MONTHLY_CARD_TBD",
          monthlyACHId: "prod_FAMILY_MONTHLY_ACH_TBD",
          annualCardId: "prod_FAMILY_ANNUAL_CARD_TBD",
          annualACHId: "prod_FAMILY_ANNUAL_ACH_TBD",
        },
        metadata: { icon: "Users", bestFor: ["Families"] },
        isVisible: true,
        isFeatured: true,
        order: 1,
        createdAt: now,
        updatedAt: now,
      });
    }

    return {
      success: true,
      message: `v0.7 upsert complete. Family tier ${familyExists ? "already existed" : "created"}.`,
      familyId,
    };
  },
});

/** Fix annual pricing: individual $149.99, family $249.99 (save ~17%).
 *  Run via: npx convex run catalog/mutations:fixPricingV1
 */
export const fixPricingV1 = internalMutation({
  args: {},
  handler: async (ctx: any) => {
    const now = Date.now();
    const existing = await ctx.db.query("catalogProducts").collect();
    let updated = 0;

    for (const p of existing) {
      if (p.slug === "oral-health-individual" || p.slug === "oral-health-plan") {
        await ctx.db.patch(p._id, {
          pricing: {
            monthlyCardCents: 1499,
            monthlyACHCents: 1499,
            annualCardCents: 14999,
            annualACHCents: 14999,
          },
          updatedAt: now,
        });
        updated++;
      }
      if (p.slug === "oral-health-family") {
        await ctx.db.patch(p._id, {
          pricing: {
            monthlyCardCents: 2499,
            monthlyACHCents: 2499,
            annualCardCents: 24999,
            annualACHCents: 24999,
          },
          updatedAt: now,
        });
        updated++;
      }
    }

    return {
      success: true,
      message: `Pricing fixed on ${updated} product(s).`,
    };
  },
});
