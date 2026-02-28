/**
 * HIERARCHY MODULE
 * Site, Account, Group resolution and context management
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Resolve site by slug
 * Used in DTC enrollment to get site context from ZIP code
 */
export const resolveSiteBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    // For Phase 1 DTC: always resolve to default site
    if (slug === "ryze-health" || slug === "ideal-health" || slug === "") {
      return {
        _id: "site_dtc_001",
        name: slug === "ideal-health" ? "Ideal Health" : "Ideal Health DTC",
        slug: slug || "ideal-health",
        type: "primary",
        status: "active",
        logoUrl: "/assets/logo.png",
        primaryColor: "#0066cc",
        secondaryColor: "#00cc99",
        enrollmentDefaults: {
          requireGroupCode: false,
          requireEligibilityMatch: false,
          allowSelfEnrollment: true,
          collectPhone: true,
          collectAddress: true,
          collectEmployeeId: false,
          collectDependents: false,
          requirePayment: true,
          autoActivate: true,
          requireEnrollmentTerms: true,
          requirePrivacyConsent: true,
          requireAutoPayConsent: true,
          requireDataSharing: false,
          requireHipaa: false,
        },
        allowedPlanIds: ["dental-savings", "wellness-glp"],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }

    // Fallback for unknown slugs
    throw new Error("Site not found");
  },
});

/**
 * Resolve account by site and slug
 */
export const resolveAccountBySite = query({
  args: { siteId: v.string(), slug: v.string() },
  handler: async (ctx, { siteId, slug }) => {
    // For Phase 1 DTC: default account
    return {
      _id: "account_dtc_001",
      siteId,
      name: "Ideal Health Direct",
      slug: "ryze-health-direct",
      type: "internal",
      status: "active",
      billingModel: "per_member",
      billingDetails: {
        currency: "USD",
        paymentTerms: "monthly",
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  },
});

/**
 * Resolve group by site and account
 */
export const resolveGroupBySiteAndAccount = query({
  args: { siteId: v.string(), accountId: v.string(), slug: v.optional(v.string()) },
  handler: async (ctx, { siteId, accountId, slug }) => {
    // For Phase 1 DTC: default group
    return {
      _id: "group_dtc_001",
      siteId,
      accountId,
      name: "General Public",
      slug: "general-public",
      groupCode: "RYZE-PUBLIC",
      status: "active",
      currentMemberCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  },
});

/**
 * Get site details
 */
export const getSite = query({
  args: { siteId: v.string() },
  handler: async (ctx, { siteId }) => {
    // For Phase 1: return mock site
    if (siteId === "site_dtc_001" || siteId === "") {
      return {
        _id: "site_dtc_001",
        name: "Ideal Health DTC",
        slug: "ryze-health",
        type: "primary",
        status: "active",
        primaryColor: "#0066cc",
        enrollmentDefaults: {
          requireGroupCode: false,
          requireEligibilityMatch: false,
          allowSelfEnrollment: true,
          collectPhone: true,
          collectAddress: true,
          collectEmployeeId: false,
          collectDependents: false,
          requirePayment: true,
          autoActivate: true,
          requireEnrollmentTerms: true,
          requirePrivacyConsent: true,
          requireAutoPayConsent: true,
          requireDataSharing: false,
          requireHipaa: false,
        },
        allowedPlanIds: ["dental-savings", "wellness-glp"],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }

    return null;
  },
});

/**
 * Get account details
 */
export const getAccount = query({
  args: { accountId: v.string() },
  handler: async (ctx, { accountId }) => {
    // For Phase 1: return mock account
    if (accountId === "account_dtc_001" || accountId === "") {
      return {
        _id: "account_dtc_001",
        siteId: "site_dtc_001",
        name: "Ideal Health Direct",
        slug: "ryze-health-direct",
        type: "internal",
        status: "active",
        billingModel: "per_member",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }

    return null;
  },
});

/**
 * Get group details
 */
export const getGroup = query({
  args: { groupId: v.string() },
  handler: async (ctx, { groupId }) => {
    // For Phase 1: return mock group
    if (groupId === "group_dtc_001" || groupId === "") {
      return {
        _id: "group_dtc_001",
        siteId: "site_dtc_001",
        accountId: "account_dtc_001",
        name: "General Public",
        slug: "general-public",
        groupCode: "RYZE-PUBLIC",
        status: "active",
        currentMemberCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }

    return null;
  },
});
