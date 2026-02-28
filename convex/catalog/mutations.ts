/**
 * CATALOG MUTATIONS
 *
 * Mutations for managing the product catalog
 */

import { mutation } from "../_generated/server";
import { v } from "convex/values";

// Seed initial catalog data
export const seedInitialData = mutation({
  args: {},
  handler: async (ctx: any) => {
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
        slug: "oral-health-plan",
        name: "Ideal Health Oral Health Plan",
        category: "dental",
        description:
          "Comprehensive oral health coverage with Toothlens AI oral scanning, Dial Care teledentistry consultations, and access to the Careington POS dental discount network.",
        longDescription:
          "Our Oral Health Plan provides comprehensive access to dental care through innovative technology and a nationwide network of providers. Features include AI-powered oral scanning (Toothlens Smart Check), 24/7 teledentistry consultations via Dial Care, and significant discounts on procedures through the Careington dental provider network.",
        inclusions: [
          "Toothlens AI Oral Scanning",
          "Dial Care 24/7 Teledentistry",
          "Careington POS Network Access",
          "Preventive Discounts",
          "Member ID Card",
          "Emergency Access",
        ],
        exclusions: ["Not traditional dental insurance", "Savings-based discount plan"],
        eligibilityRules: {
          minAge: undefined,
          maxAge: undefined,
          requiresVerification: false,
          disclosureText: "This is a savings-based discount plan, not insurance.",
        },
        activationBehavior: "immediate",
        pricing: {
          monthlyCardCents: 1500,
          monthlyACHCents: 1300,
          annualCardCents: 15000,
          annualACHCents: 13000,
        },
        metadata: {
          icon: "🦷",
          bestFor: ["Individuals", "Families"],
        },
        isVisible: true,
        isFeatured: true,
        order: 0,
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
    // Get all existing products
    const existing = await ctx.db.query("catalogProducts").collect();

    // Delete all existing products
    for (const product of existing) {
      await ctx.db.delete(product._id);
    }

    const initialProducts = [
      {
        slug: "oral-health-plan",
        name: "Ideal Health Oral Health Plan",
        category: "dental",
        description:
          "Comprehensive oral health coverage with Toothlens AI oral scanning, Dial Care teledentistry consultations, and access to the Careington POS dental discount network.",
        longDescription:
          "Our Oral Health Plan provides comprehensive access to dental care through innovative technology and a nationwide network of providers. Features include AI-powered oral scanning (Toothlens Smart Check), 24/7 teledentistry consultations via Dial Care, and significant discounts on procedures through the Careington dental provider network.",
        inclusions: [
          "Toothlens AI Oral Scanning",
          "Dial Care 24/7 Teledentistry",
          "Careington POS Network Access",
          "Preventive Discounts",
          "Member ID Card",
          "Emergency Access",
        ],
        exclusions: ["Not traditional dental insurance", "Savings-based discount plan"],
        eligibilityRules: {
          minAge: undefined,
          maxAge: undefined,
          requiresVerification: false,
          disclosureText: "This is a savings-based discount plan, not insurance.",
        },
        activationBehavior: "immediate",
        pricing: {
          monthlyCardCents: 1500,
          monthlyACHCents: 1300,
          annualCardCents: 15000,
          annualACHCents: 13000,
        },
        metadata: {
          icon: "🦷",
          bestFor: ["Individuals", "Families"],
        },
        isVisible: true,
        isFeatured: true,
        order: 0,
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
