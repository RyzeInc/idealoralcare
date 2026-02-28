import { query } from "../_generated/server";
import { QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "../_generated/dataModel";

/**
 * Site Resolver - Resolve site context from URL slug or domain
 * Used to bootstrap enrollment wizard and white-label detection
 */

/**
 * Resolve site context by slug
 * Most common path: site resolves from URL slug (e.g., /health/enroll/ryze-health)
 */
export const resolveSiteBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx: QueryCtx, args: { slug: string }) => {
    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q: any) => q.eq("slug", args.slug))
      .first();

    if (!site) {
      throw new Error(`Site not found with slug: ${args.slug}`);
    }

    if (site.status !== "active") {
      throw new Error(`Site is not active: ${site.status}`);
    }

    return site;
  },
});

/**
 * Resolve site context by custom domain
 * Used for white-label custom domains
 */
export const resolveSiteByDomain = query({
  args: { domain: v.string() },
  handler: async (ctx: QueryCtx, args: { domain: string }) => {
    const site = await ctx.db
      .query("sites")
      .withIndex("by_domain", (q: any) => q.eq("domain", args.domain))
      .first();

    if (!site) {
      throw new Error(`Site not found with domain: ${args.domain}`);
    }

    if (site.status !== "active") {
      throw new Error(`Site is not active: ${site.status}`);
    }

    return site;
  },
});

/**
 * Resolve full hierarchy from group code
 * Path: Groups -> Accounts -> Sites
 * Returns: SiteContext + AccountContext + GroupContext
 */
export const resolveHierarchyByGroupCode = query({
  args: { groupCode: v.string() },
  handler: async (ctx: QueryCtx, args: { groupCode: string }) => {
    // Step 1: Find group by code
    const group = await ctx.db
      .query("groups")
      .withIndex("by_group_code", (q: any) => q.eq("groupCode", args.groupCode))
      .first();

    if (!group) {
      throw new Error(`Group not found with code: ${args.groupCode}`);
    }

    if (group.status !== "active") {
      throw new Error(`Group is not active: ${group.status}`);
    }

    // Check capacity
    if (group.maxMembers) {
      const memberCount = await ctx.db
        .query("memberProfiles")
        .withIndex("by_group", (q: any) => q.eq("groupId", group._id))
        .collect();

      if (memberCount.length >= group.maxMembers) {
        throw new Error(
          `Group enrollment is full (${memberCount.length}/${group.maxMembers})`
        );
      }
    }

    // Step 2: Fetch account
    const account = await ctx.db.get(group.accountId);
    if (!account || account.status !== "active") {
      throw new Error(`Account is not active`);
    }

    // Step 3: Fetch site
    const site = await ctx.db.get(group.siteId);
    if (!site || site.status !== "active") {
      throw new Error(`Site is not active`);
    }

    return {
      site,
      account,
      group,
    };
  },
});

/**
 * Resolve allowed plan IDs (intersection of site, account, group)
 * Accounts and groups can narrow the list, but not expand it
 */
export const resolveAllowedPlanIds = query({
  args: {
    siteId: v.id("sites"),
    accountId: v.optional(v.id("accounts")),
    groupId: v.optional(v.id("groups")),
  },
  handler: async (ctx: QueryCtx, args: any) => {
    const site = await ctx.db.get(args.siteId);
    if (!site) throw new Error("Site not found");

    let allowedIds = new Set(
      (site as any).allowedPlanIds.map((id: any) => id.toString())
    );

    // If account specified, narrow to account's allowed plans
    if (args.accountId) {
      const account = await ctx.db.get(args.accountId);
      if (account && (account as any).customPricing) {
        const accountProductIds = new Set(
          (account as any).customPricing.map((p: any) => p.productId.toString())
        );
        allowedIds = new Set(
          [...allowedIds].filter((id) => accountProductIds.has(id))
        );
      }
    }

    // If group specified, narrow to group's allowed plans
    if (args.groupId) {
      const group = await ctx.db.get(args.groupId);
      if (group && (group as any).allowedPlanIds) {
        const groupProductIds = new Set(
          (group as any).allowedPlanIds.map((id: any) => id.toString())
        );
        allowedIds = new Set(
          [...allowedIds].filter((id) => groupProductIds.has(id))
        );
      }
    }

    return Array.from(allowedIds).map((id) => id as Id<"catalogProducts">);
  },
});

/**
 * Get custom pricing for a product at a specific hierarchy level
 * Priority: group > account > catalog (default)
 */
export const resolveProductPricing = query({
  args: {
    productId: v.id("catalogProducts"),
    accountId: v.optional(v.id("accounts")),
    groupId: v.optional(v.id("groups")),
  },
  handler: async (ctx: QueryCtx, args: any) => {
    // Fetch product for default pricing
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found");

    const pricing = { ...(product as any).pricing };

    // Check group-level custom pricing (most specific)
    if (args.groupId) {
      const group = await ctx.db.get(args.groupId);
      if (group && (group as any).customPricing) {
        const customPrice = (group as any).customPricing.find(
          (p: any) => p.productId.toString() === args.productId.toString()
        );
        if (customPrice) {
          return {
            ...pricing,
            monthlyCardCents:
              customPrice.monthlyCardCents ?? pricing.monthlyCardCents,
            monthlyACHCents:
              customPrice.monthlyACHCents ?? pricing.monthlyACHCents,
            annualCardCents:
              customPrice.annualCardCents ?? pricing.annualCardCents,
            annualACHCents: customPrice.annualACHCents ?? pricing.annualACHCents,
            isCustomPriced: true,
          };
        }
      }
    }

    // Check account-level custom pricing
    if (args.accountId) {
      const account = await ctx.db.get(args.accountId);
      if (account && (account as any).customPricing) {
        const customPrice = (account as any).customPricing.find(
          (p: any) => p.productId.toString() === args.productId.toString()
        );
        if (customPrice) {
          return {
            ...pricing,
            monthlyCardCents:
              customPrice.monthlyCardCents ?? pricing.monthlyCardCents,
            monthlyACHCents:
              customPrice.monthlyACHCents ?? pricing.monthlyACHCents,
            annualCardCents:
              customPrice.annualCardCents ?? pricing.annualCardCents,
            annualACHCents: customPrice.annualACHCents ?? pricing.annualACHCents,
            isCustomPriced: true,
          };
        }
      }
    }

    // Return catalog pricing (default)
    return { ...pricing, isCustomPriced: false };
  },
});
