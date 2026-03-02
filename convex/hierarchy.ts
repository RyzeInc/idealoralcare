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
    const normalizedSlug = slug || "ideal-health";

    // Try database first
    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q: any) => q.eq("slug", normalizedSlug))
      .first();

    if (site) return site;

    // Legacy slug support
    if (normalizedSlug === "ryze-health") {
      const legacySite = await ctx.db
        .query("sites")
        .withIndex("by_slug", (q: any) => q.eq("slug", "ideal-health"))
        .first();
      if (legacySite) return legacySite;
    }

    // Return a sensible default for DTC (the enrollment/sessions.ts auto-creates the real site)
    return {
      _id: "pending" as any,
      name: "Ideal Health",
      slug: normalizedSlug,
      type: "primary" as const,
      status: "active" as const,
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
      },
      allowedPlanIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  },
});

/**
 * Resolve account by site and slug
 */
export const resolveAccountBySite = query({
  args: { siteId: v.string(), slug: v.string() },
  handler: async (ctx, { siteId, slug }) => {
    // Query database for account
    const account = await ctx.db
      .query("accounts")
      .filter((q) => q.eq(q.field("siteId"), siteId))
      .first();
    return account || null;
  },
});

/**
 * Resolve group by site and account
 */
export const resolveGroupBySiteAndAccount = query({
  args: { siteId: v.string(), accountId: v.string(), slug: v.optional(v.string()) },
  handler: async (ctx, { siteId, accountId, slug }) => {
    // Query database for group
    const group = await ctx.db
      .query("groups")
      .filter((q) => q.eq(q.field("accountId"), accountId))
      .first();
    return group || null;
  },
});

/**
 * Get site details
 */
export const getSite = query({
  args: { siteId: v.string() },
  handler: async (ctx, { siteId }) => {
    if (!siteId) return null;
    try {
      return await ctx.db.get(siteId as any);
    } catch {
      return null;
    }
  },
});

/**
 * Get account details
 */
export const getAccount = query({
  args: { accountId: v.string() },
  handler: async (ctx, { accountId }) => {
    if (!accountId) return null;
    try {
      return await ctx.db.get(accountId as any);
    } catch {
      return null;
    }
  },
});

/**
 * Get group details
 */
export const getGroup = query({
  args: { groupId: v.string() },
  handler: async (ctx, { groupId }) => {
    if (!groupId) return null;
    try {
      return await ctx.db.get(groupId as any);
    } catch {
      return null;
    }
  },
});
