/**
 * IDEAL ORAL HEALTH PLAN
 *
 * Convex module for oral health plan data
 * Integrates with Dental Discount Network and Teledentistry Program
 */

import { query } from "../_generated/server";
import { v } from "convex/values";

/**
 * Get the Ideal Oral Health Plan with Dental Discount Network + Teledentistry Program integration
 */
export const getOralPlan = query({
  args: {},
  handler: async (ctx) => {
    return {
      _id: "plan_oral_001",
      name: "Ideal Oral Health Plan",
      type: "oral-health",
      status: "active",

      // Pricing
      pricing: {
        monthlyCardPrice: 15,
        monthlyACHPrice: 13,
        annualCardPrice: 180,
        annualACHPrice: 156,
        currency: "USD",
      },

      // Plan Features
      features: [
        {
          id: "toothlens",
          name: "Toothlens Smart Check AI Scanning",
          description: "AI-powered oral health screening tool for home monitoring",
          icon: "zap",
          included: true,
        },
        {
          id: "teledentistry",
          name: "24/7 Teledentistry Program",
          description: "Licensed dental professionals available round-the-clock",
          icon: "clock",
          included: true,
        },
        {
          id: "network_discounts",
          name: "Dental Discount Network Discounts",
          description: "Access thousands of dentists nationwide with negotiated rates",
          icon: "smile",
          included: true,
        },
        {
          id: "member_card",
          name: "Digital Member Card",
          description: "Access to benefits at any participating provider within 24 hours of enrollment",
          icon: "shield",
          included: true,
        },
        {
          id: "emergency_support",
          name: "Emergency Dental Support",
          description: "Immediate access to emergency consultations and guidance",
          icon: "heart",
          included: true,
        },
        {
          id: "preventive_guidance",
          name: "Preventive Care Guidance",
          description: "Personalized oral health recommendations and coaching",
          icon: "sparkles",
          included: true,
        },
      ],

      // Dental Discount Network Integration
      careington: {
        provider: "Dental Discount Network International",
        networkSize: 10000,
        networkDescription: "Nationwide network of participating dentists",
        coverageAreas: {
          preventive: {
            coverage: "100% discount on preventive exams & cleanings",
            copay: 0,
          },
          basic: {
            coverage:
              "Negotiated discount rates on basic restorative services",
            savings: "Up to 30% off average fees",
          },
          major: {
            coverage: "Discounted rates on crowns, implants, and major work",
            savings: "Up to 40% off average fees",
          },
          ortho: {
            coverage: "Discounted orthodontic services",
            available: true,
          },
          cosmetic: {
            coverage: "Whitening and cosmetic services at discounted rates",
            available: true,
          },
        },
      },

      // Teledentistry Program Integration
      dialCare: {
        provider: "Teledentistry Program",
        availability: "24/7",
        responseTime: "Within 2 hours for urgent issues",
        services: [
          "Oral health consultations",
          "Treatment planning",
          "Emergency guidance",
          "Prescription services",
          "Referrals to in-network dentists",
        ],
        providerQualifications: {
          licensed: true,
          specialized: "Dental professionals",
          background: "Verified, insured providers",
        },
      },

      // Plan Rules & Restrictions
      enrollment: {
        requireSSN: false,
        requireMedicalHistory: false,
        requireWaitingPeriod: false,
        requireGroupCode: false,
        allowSelfEnrollment: true,
        cancelAnytime: true,
        noLongTermContracts: true,
      },

      // Restrictions & Exclusions (common for discount plans)
      restrictions: [
        "Not a replacement for dental insurance",
        "No coverage for cosmetic procedures unless explicitly stated",
        "Some orthodontic services may have additional waiting periods",
        "Network participation varies by location",
      ],

      // Member Support
      support: {
        phone: "801-820-0010",
        email: "support@idealoralhealth.com",
        hours: "24/7",
        availability: "Call, email, or via member app",
      },

      // Metadata
      createdAt: Date.now(),
      updatedAt: Date.now(),
      active: true,
      version: "1.0",
    };
  },
});

/**
 * Get providers in a specific ZIP code (Dental Discount Network network)
 */
export const getProvidersNearZIP = query({
  args: { zip: v.string() },
  handler: async (ctx, { zip }) => {
    // TODO: Integrate with actual Dental Discount Network provider directory API
    // For now, return mock data structure
    return {
      zip,
      count: 15, // Number of providers in this ZIP
      providers: [
        {
          id: "provider_001",
          name: "Bright Smile Dental",
          address: "123 Main St",
          phone: "(801) 555-0123",
          acceptingNewPatients: true,
          specialties: ["Preventive", "Cosmetic"],
          network: "Dental Discount Network",
        },
        {
          id: "provider_002",
          name: "Advanced Dental Care",
          address: "456 Oak Ave",
          phone: "(801) 555-0124",
          acceptingNewPatients: true,
          specialties: ["Preventive", "Restorative", "Ortho"],
          network: "Dental Discount Network",
        },
      ],
      message:
        "Integration with Dental Discount Network provider directory API coming soon",
    };
  },
});

/**
 * Get plan comparison data (if we ever add more plans)
 */
export const getOralPlanComparison = query({
  args: {},
  handler: async (ctx) => {
    return {
      plans: [
        {
          id: "plan_oral_001",
          name: "Ideal Oral Health Plan",
          monthlyPrice: 15,
          monthlyACHPrice: 13,
          features: [
            "Toothlens Scanning",
            "24/7 Teledentistry",
            "Network Discounts",
            "Member Card",
            "Emergency Support",
          ],
          recommended: true,
        },
      ],
      message: "Currently offering a single comprehensive plan",
    };
  },
});
