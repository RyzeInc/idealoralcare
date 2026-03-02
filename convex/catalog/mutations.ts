/**
 * CATALOG MUTATIONS
 *
 * Mutations for managing the product catalog
 */

import { mutation } from "../_generated/server";
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
        slug: "oral-health-plan",
        name: "Ideal Oral Health Plan",
        category: "dental",
        description:
          "Comprehensive oral health coverage with Toothlens AI oral scanning, 24/7 teledentistry consultations, and access to the Dental Discount Network dental discount network.",
        longDescription:
          "Our Oral Health Plan provides comprehensive access to dental care through innovative technology and a nationwide network of providers. Features include AI-powered oral scanning (Toothlens Smart Check), 24/7 teledentistry consultations, and significant discounts on procedures through the Dental Discount Network dental provider network.",
        inclusions: [
          "Toothlens AI Oral Scanning",
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
          monthlyACHCents: 1299,
          annualCardCents: 14999,
          annualACHCents: 12999,
        },
        stripeProducts: {
          monthlyCardId: "prod_U3no15TNX9iTj1",
          monthlyACHId: "prod_U3nrt0liKgXRmq",
          annualCardId: "prod_U3nsR7DN8AVcL9",
          annualACHId: "prod_U3ns1IYNVgNwGM",
        },
        metadata: {
          icon: "Heart",
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
        slug: "oral-health-plan",
        name: "Ideal Oral Health Plan",
        category: "dental",
        description:
          "Comprehensive oral health coverage with Toothlens AI oral scanning, 24/7 teledentistry consultations, and access to the Dental Discount Network dental discount network.",
        longDescription:
          "Our Oral Health Plan provides comprehensive access to dental care through innovative technology and a nationwide network of providers. Features include AI-powered oral scanning (Toothlens Smart Check), 24/7 teledentistry consultations, and significant discounts on procedures through the Dental Discount Network dental provider network.",
        inclusions: [
          "Toothlens AI Oral Scanning",
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
          monthlyACHCents: 1299,
          annualCardCents: 14999,
          annualACHCents: 12999,
        },
        stripeProducts: {
          monthlyCardId: "prod_U3no15TNX9iTj1",
          monthlyACHId: "prod_U3nrt0liKgXRmq",
          annualCardId: "prod_U3nsR7DN8AVcL9",
          annualACHId: "prod_U3ns1IYNVgNwGM",
        },
        metadata: {
          icon: "Heart",
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
