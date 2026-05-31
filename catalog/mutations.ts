/**
 * CATALOG MUTATIONS
 *
 * Mutations for managing the product catalog
 */

import { mutation } from "../convex/_generated/server";
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
        slug: "dental-savings",
        name: "Oral Health Savings Plan",
        category: "dental",
        description:
          "AI Oral Scanning, teledentistry consultations, and access to our nationwide provider network with discount offerings.",
        longDescription:
          "Our Oral Health Savings Plan provides comprehensive access to oral care through innovative technology and a nationwide network of providers. Features include AI Oral Scanning, 24/7 teledentistry consultations, and significant discounts on procedures.",
        inclusions: [
          "AI-Powered Oral Scanning",
          "24/7 Teledentistry Access",
          "Nationwide Provider Network",
          "Discount Procedures",
          "Emergency Support",
        ],
        exclusions: ["Not traditional insurance", "Discounts only"],
        eligibilityRules: {
          minAge: undefined,
          maxAge: undefined,
          requiresVerification: false,
          disclosureText: "Not insurance.",
        },
        activationBehavior: "immediate",
        pricing: {
          monthlyCardCents: 2999,
          monthlyACHCents: 2799,
          annualCardCents: 29999,
          annualACHCents: 27999,
        },
        metadata: {
          icon: "🦷",
          bestFor: ["Individuals", "Families"],
        },
        isVisible: true,
        isFeatured: true,
        order: 0,
      },
      {
        slug: "wellness-glp",
        name: "Wellness GLP Plan",
        category: "wellness",
        description:
          "24/7/365 clinical support, GLP-1 and weight management medications, personalized treatment plans, and nutrition coaching.",
        longDescription:
          "Comprehensive weight management program with access to GLP-1 medications and clinical support. Our licensed team provides personalized treatment plans, ongoing monitoring, and nutrition coaching to help you achieve your health goals.",
        inclusions: [
          "24/7/365 Clinical Support",
          "GLP-1 Medications",
          "Personalized Treatment",
          "Nutrition Coaching",
          "Lab Testing & Monitoring",
        ],
        exclusions: ["Requires health assessment", "Medication costs separate"],
        eligibilityRules: {
          minAge: undefined,
          maxAge: undefined,
          requiresVerification: true,
          disclosureText: "Requires health assessment.",
        },
        activationBehavior: "verified_then_immediate",
        pricing: {
          monthlyCardCents: 9999,
          monthlyACHCents: 9799,
          annualCardCents: 99999,
          annualACHCents: 97999,
        },
        metadata: {
          icon: "💊",
          bestFor: ["Weight Management", "Wellness"],
        },
        isVisible: true,
        isFeatured: true,
        order: 1,
      },
      {
        slug: "telehealth-unlimited",
        name: "Telehealth Unlimited",
        category: "telehealth",
        description:
          "Unlimited 24/7 virtual doctor visits for common conditions, prescriptions, and health questions.",
        longDescription:
          "Get instant access to healthcare professionals 24/7 through virtual visits. Treat common conditions, get prescriptions, receive mental health support, and get answers to your health questions all from your phone or computer.",
        inclusions: [
          "Unlimited Virtual Visits",
          "24/7 Availability",
          "Prescription Services",
          "Mental Health Support",
          "No Per-Visit Fees",
        ],
        exclusions: ["Does not replace emergency care", "Some prescriptions excluded"],
        eligibilityRules: {
          minAge: undefined,
          maxAge: undefined,
          requiresVerification: false,
          disclosureText: "Virtual care only.",
        },
        activationBehavior: "immediate",
        pricing: {
          monthlyCardCents: 1999,
          monthlyACHCents: 1799,
          annualCardCents: 19999,
          annualACHCents: 17999,
        },
        metadata: {
          icon: "📱",
          bestFor: ["Individuals", "Families"],
        },
        isVisible: true,
        isFeatured: false,
        order: 3,
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
        slug: "dental-savings",
        name: "Oral Health Savings Plan",
        category: "dental",
        description:
          "AI Oral Scanning, teledentistry consultations, and access to our nationwide provider network with discount offerings.",
        longDescription:
          "Our Oral Health Savings Plan provides comprehensive access to oral care through innovative technology and a nationwide network of providers. Features include AI Oral Scanning, 24/7 teledentistry consultations, and significant discounts on procedures.",
        inclusions: [
          "AI-Powered Oral Scanning",
          "24/7 Teledentistry Access",
          "Nationwide Provider Network",
          "Discount Procedures",
          "Emergency Support",
        ],
        exclusions: ["Not traditional insurance", "Discounts only"],
        eligibilityRules: {
          minAge: undefined,
          maxAge: undefined,
          requiresVerification: false,
          disclosureText: "Not insurance.",
        },
        activationBehavior: "immediate",
        pricing: {
          monthlyCardCents: 2999,
          monthlyACHCents: 2799,
          annualCardCents: 29999,
          annualACHCents: 27999,
        },
        metadata: {
          icon: "🦷",
          bestFor: ["Individuals", "Families"],
        },
        isVisible: true,
        isFeatured: true,
        order: 0,
      },
      {
        slug: "wellness-glp",
        name: "Wellness GLP Plan",
        category: "wellness",
        description:
          "24/7/365 clinical support, GLP-1 and weight management medications, personalized treatment plans, and nutrition coaching.",
        longDescription:
          "Comprehensive weight management program with access to GLP-1 medications and clinical support. Our licensed team provides personalized treatment plans, ongoing monitoring, and nutrition coaching to help you achieve your health goals.",
        inclusions: [
          "24/7/365 Clinical Support",
          "GLP-1 Medications",
          "Personalized Treatment",
          "Nutrition Coaching",
          "Lab Testing & Monitoring",
        ],
        exclusions: ["Requires health assessment", "Medication costs separate"],
        eligibilityRules: {
          minAge: undefined,
          maxAge: undefined,
          requiresVerification: true,
          disclosureText: "Requires health assessment.",
        },
        activationBehavior: "verified_then_immediate",
        pricing: {
          monthlyCardCents: 9999,
          monthlyACHCents: 9799,
          annualCardCents: 99999,
          annualACHCents: 97999,
        },
        metadata: {
          icon: "💊",
          bestFor: ["Weight Management", "Wellness"],
        },
        isVisible: true,
        isFeatured: true,
        order: 1,
      },
      {
        slug: "telehealth-unlimited",
        name: "Telehealth Unlimited",
        category: "telehealth",
        description:
          "Unlimited 24/7 virtual doctor visits for common conditions, prescriptions, and health questions.",
        longDescription:
          "Get instant access to healthcare professionals 24/7 through virtual visits. Treat common conditions, get prescriptions, receive mental health support, and get answers to your health questions all from your phone or computer.",
        inclusions: [
          "Unlimited Virtual Visits",
          "24/7 Availability",
          "Prescription Services",
          "Mental Health Support",
          "No Per-Visit Fees",
        ],
        exclusions: ["Does not replace emergency care", "Some prescriptions excluded"],
        eligibilityRules: {
          minAge: undefined,
          maxAge: undefined,
          requiresVerification: false,
          disclosureText: "Virtual care only.",
        },
        activationBehavior: "immediate",
        pricing: {
          monthlyCardCents: 1999,
          monthlyACHCents: 1799,
          annualCardCents: 19999,
          annualACHCents: 17999,
        },
        metadata: {
          icon: "📱",
          bestFor: ["Individuals", "Families"],
        },
        isVisible: true,
        isFeatured: false,
        order: 3,
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
