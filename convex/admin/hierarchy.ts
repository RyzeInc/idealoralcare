import { mutation, query } from "../_generated/server";
import { v } from "convex/values";

/**
 * ADMIN HIERARCHY MANAGEMENT
 * 
 * CRUD operations for sites, accounts, and groups.
 * Follows the admin pattern: getAll / getById / getBySlug / create / update / remove / toggleVisibility
 */

// ============================================================================
// SITES
// ============================================================================

export const createSite = mutation({
  args: {
    slug: v.string(),
    name: v.string(),
    type: v.union(v.literal("primary"), v.literal("whitelabel"), v.literal("channel")),
    domain: v.optional(v.string()),
    branding: v.optional(v.any()), // Flexible branding object
    allowedPlanIds: v.optional(v.array(v.id("catalogProducts"))),
    enrollmentDefaults: v.optional(v.any()), // Flexible enrollment defaults object
    status: v.optional(v.union(v.literal("active"), v.literal("suspended"), v.literal("onboarding"), v.literal("terminated"))),
  },
  handler: async (ctx, args) => {
    const existingSite = await ctx.db
      .query("sites")
      .filter((q) => q.eq(q.field("slug"), args.slug))
      .first();

    if (existingSite) {
      throw new Error(`Site with slug "${args.slug}" already exists`);
    }

    const siteId = await ctx.db.insert("sites", {
      slug: args.slug,
      name: args.name,
      type: args.type,
      domain: args.domain,
      branding: args.branding ?? {},
      allowedPlanIds: args.allowedPlanIds ?? [],
      enrollmentDefaults: args.enrollmentDefaults ?? {},
      status: args.status ?? "active",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return await ctx.db.get(siteId);
  },
});

export const updateSite = mutation({
  args: {
    siteId: v.id("sites"),
    slug: v.optional(v.string()),
    name: v.optional(v.string()),
    type: v.optional(v.string()),
    domain: v.optional(v.string()),
    branding: v.optional(v.any()),
    allowedPlanIds: v.optional(v.array(v.id("catalogProducts"))),
    enrollmentDefaults: v.optional(v.any()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const site = await ctx.db.get(args.siteId);
    if (!site) throw new Error("Site not found");

    const updates: any = {
      updatedAt: Date.now(),
    };

    if (args.slug !== undefined) updates.slug = args.slug;
    if (args.name !== undefined) updates.name = args.name;
    if (args.type !== undefined) updates.type = args.type;
    if (args.domain !== undefined) updates.domain = args.domain;
    if (args.branding !== undefined) updates.branding = args.branding;
    if (args.allowedPlanIds !== undefined) updates.allowedPlanIds = args.allowedPlanIds;
    if (args.enrollmentDefaults !== undefined) updates.enrollmentDefaults = args.enrollmentDefaults;
    if (args.status !== undefined) updates.status = args.status;

    await ctx.db.patch(args.siteId, updates);
    return await ctx.db.get(args.siteId);
  },
});

export const getSites = query({
  handler: async (ctx) => {
    return await ctx.db.query("sites").order("asc").collect();
  },
});

export const getSiteById = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.siteId);
  },
});

export const getSiteBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sites")
      .filter((q) => q.eq(q.field("slug"), args.slug))
      .first();
  },
});

export const removeSite = mutation({
  args: { siteId: v.id("sites") },
  handler: async (ctx, args) => {
    const site = await ctx.db.get(args.siteId);
    if (!site) throw new Error("Site not found");

    await ctx.db.delete(args.siteId);
    return site;
  },
});

// ============================================================================
// ACCOUNTS
// ============================================================================

export const createAccount = mutation({
  args: {
    siteId: v.id("sites"),
    slug: v.string(),
    accountType: v.union(v.literal("owner"), v.literal("employer"), v.literal("broker"), v.literal("franchisee"), v.literal("partner"), v.literal("individual")),
    billingModel: v.union(v.literal("per_member"), v.literal("flat_rate"), v.literal("direct"), v.literal("subsidized"), v.literal("tiered")),
    customPricing: v.optional(v.array(v.any())),
    enrollmentOverrides: v.optional(v.any()),
    contacts: v.optional(v.array(v.any())),
    status: v.optional(v.union(v.literal("active"), v.literal("suspended"), v.literal("onboarding"), v.literal("terminated"))),
  },
  handler: async (ctx, args) => {
    const site = await ctx.db.get(args.siteId);
    if (!site) throw new Error("Site not found");

    const existingAccount = await ctx.db
      .query("accounts")
      .filter(
        (q) =>
          q.and(
            q.eq(q.field("siteId"), args.siteId),
            q.eq(q.field("slug"), args.slug)
          )
      )
      .first();

    if (existingAccount) {
      throw new Error(`Account with slug "${args.slug}" already exists for this site`);
    }

    const accountId = await ctx.db.insert("accounts", {
      siteId: args.siteId,
      slug: args.slug,
      accountType: args.accountType,
      billingModel: args.billingModel,
      customPricing: args.customPricing ?? [],
      enrollmentOverrides: args.enrollmentOverrides ?? {},
      contacts: args.contacts ?? [],
      status: args.status ?? "active",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as any);

    return await ctx.db.get(accountId);
  },
});

export const updateAccount = mutation({
  args: {
    accountId: v.id("accounts"),
    slug: v.optional(v.string()),
    accountType: v.optional(v.union(v.literal("owner"), v.literal("employer"), v.literal("broker"), v.literal("franchisee"), v.literal("partner"), v.literal("individual"))),
    billingModel: v.optional(v.string()),
    customPricing: v.optional(v.array(v.any())),
    enrollmentOverrides: v.optional(v.any()),
    contacts: v.optional(v.array(v.any())),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account) throw new Error("Account not found");

    const updates: any = {
      updatedAt: Date.now(),
    };

    if (args.slug !== undefined) updates.slug = args.slug;
    if (args.accountType !== undefined) updates.accountType = args.accountType;
    if (args.billingModel !== undefined) updates.billingModel = args.billingModel;
    if (args.customPricing !== undefined) updates.customPricing = args.customPricing;
    if (args.enrollmentOverrides !== undefined) updates.enrollmentOverrides = args.enrollmentOverrides;
    if (args.contacts !== undefined) updates.contacts = args.contacts;
    if (args.status !== undefined) updates.status = args.status;

    await ctx.db.patch(args.accountId, updates);
    return await ctx.db.get(args.accountId);
  },
});

export const getAccountsBySite = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("accounts")
      .filter((q) => q.eq(q.field("siteId"), args.siteId))
      .order("asc")
      .collect();
  },
});

export const getAccountById = query({
  args: { accountId: v.id("accounts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.accountId);
  },
});

export const getAccountBySlug = query({
  args: { siteId: v.id("sites"), slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("accounts")
      .filter(
        (q) =>
          q.and(
            q.eq(q.field("siteId"), args.siteId),
            q.eq(q.field("slug"), args.slug)
          )
      )
      .first();
  },
});

export const removeAccount = mutation({
  args: { accountId: v.id("accounts") },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account) throw new Error("Account not found");

    await ctx.db.delete(args.accountId);
    return account;
  },
});

// ============================================================================
// GROUPS
// ============================================================================

export const createGroup = mutation({
  args: {
    siteId: v.id("sites"),
    accountId: v.id("accounts"),
    slug: v.string(),
    groupCode: v.string(),
    allowedPlanIds: v.optional(v.array(v.id("catalogProducts"))),
    customPricing: v.optional(v.array(v.any())),
    enrollmentOverrides: v.optional(v.any()),
    maxMembers: v.optional(v.number()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const site = await ctx.db.get(args.siteId);
    if (!site) throw new Error("Site not found");

    const account = await ctx.db.get(args.accountId);
    if (!account) throw new Error("Account not found");

    if (account.siteId !== args.siteId) {
      throw new Error("Account does not belong to this site");
    }

    const existingGroup = await ctx.db
      .query("groups")
      .filter((q) => q.eq(q.field("groupCode"), args.groupCode))
      .first();

    if (existingGroup) {
      throw new Error(`Group with code "${args.groupCode}" already exists`);
    }

    const groupId = await ctx.db.insert("groups", {
      siteId: args.siteId,
      accountId: args.accountId,
      slug: args.slug,
      groupCode: args.groupCode,
      allowedPlanIds: args.allowedPlanIds ?? [],
      customPricing: args.customPricing ?? [],
      enrollmentOverrides: args.enrollmentOverrides ?? {},
      maxMembers: args.maxMembers,
      status: args.status ?? "active",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as any);

    return await ctx.db.get(groupId);
  },
});

export const updateGroup = mutation({
  args: {
    groupId: v.id("groups"),
    slug: v.optional(v.string()),
    groupCode: v.optional(v.string()),
    allowedPlanIds: v.optional(v.array(v.id("catalogProducts"))),
    customPricing: v.optional(v.array(v.any())),
    enrollmentOverrides: v.optional(v.any()),
    maxMembers: v.optional(v.number()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group) throw new Error("Group not found");

    const updates: any = {
      updatedAt: Date.now(),
    };

    if (args.slug !== undefined) updates.slug = args.slug;
    if (args.groupCode !== undefined) updates.groupCode = args.groupCode;
    if (args.allowedPlanIds !== undefined) updates.allowedPlanIds = args.allowedPlanIds;
    if (args.customPricing !== undefined) updates.customPricing = args.customPricing;
    if (args.enrollmentOverrides !== undefined) updates.enrollmentOverrides = args.enrollmentOverrides;
    if (args.maxMembers !== undefined) updates.maxMembers = args.maxMembers;
    if (args.status !== undefined) updates.status = args.status;

    await ctx.db.patch(args.groupId, updates);
    return await ctx.db.get(args.groupId);
  },
});

export const getGroupsByAccount = query({
  args: { accountId: v.id("accounts") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("groups")
      .filter((q) => q.eq(q.field("accountId"), args.accountId))
      .order("asc")
      .collect();
  },
});

export const getGroupById = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.groupId);
  },
});

export const getGroupByCode = query({
  args: { groupCode: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("groups")
      .filter((q) => q.eq(q.field("groupCode"), args.groupCode))
      .first();
  },
});

export const removeGroup = mutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group) throw new Error("Group not found");

    await ctx.db.delete(args.groupId);
    return group;
  },
});

// ============================================================================
// PRICING & PLAN MANAGEMENT
// ============================================================================

/**
 * Set custom pricing for an account or group
 */
export const setCustomPricing = mutation({
  args: {
    targetType: v.string(), // "account" | "group"
    targetId: v.string(), // account ID or group ID
    productId: v.id("catalogProducts"),
    monthlyPrice: v.optional(v.number()),
    achPrice: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let target;
    let targetTable;

    if (args.targetType === "account") {
      target = await ctx.db.get(args.targetId as any);
      targetTable = "accounts";
    } else if (args.targetType === "group") {
      target = await ctx.db.get(args.targetId as any);
      targetTable = "groups";
    } else {
      throw new Error("Invalid targetType");
    }

    if (!target) throw new Error(`${targetTable} not found`);

    const customPricing = [...((target as any).customPricing ?? [])];
    const existingIndex = customPricing.findIndex(
      (p: any) => p.productId === args.productId
    );

    if (existingIndex >= 0) {
      customPricing[existingIndex] = {
        productId: args.productId,
        monthlyPrice: args.monthlyPrice ?? customPricing[existingIndex].monthlyPrice,
        achPrice: args.achPrice ?? customPricing[existingIndex].achPrice,
      };
    } else {
      customPricing.push({
        productId: args.productId,
        monthlyPrice: args.monthlyPrice,
        achPrice: args.achPrice,
      });
    }

    await ctx.db.patch(args.targetId as any, {
      customPricing,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(args.targetId as any);
  },
});

/**
 * Set allowed plan IDs for a site, account, or group
 */
export const setAllowedPlanIds = mutation({
  args: {
    targetType: v.string(), // "site" | "account" | "group"
    targetId: v.string(),
    planIds: v.array(v.id("catalogProducts")),
  },
  handler: async (ctx, args) => {
    let target;
    let targetTable;

    if (args.targetType === "site") {
      target = await ctx.db.get(args.targetId as any);
      targetTable = "sites";
    } else if (args.targetType === "account") {
      target = await ctx.db.get(args.targetId as any);
      targetTable = "accounts";
    } else if (args.targetType === "group") {
      target = await ctx.db.get(args.targetId as any);
      targetTable = "groups";
    } else {
      throw new Error("Invalid targetType");
    }

    if (!target) throw new Error(`${targetTable} not found`);

    await ctx.db.patch(args.targetId as any, {
      allowedPlanIds: args.planIds,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(args.targetId as any);
  },
});

/**
 * Set group capacity limit
 */
export const setGroupCapacity = mutation({
  args: {
    groupId: v.id("groups"),
    maxMembers: v.number(),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group) throw new Error("Group not found");

    await ctx.db.patch(args.groupId, {
      maxMembers: args.maxMembers,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(args.groupId);
  },
});

/**
 * Get group member count (for capacity checking)
 */
export const getGroupMemberCount = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const members = await ctx.db
      .query("memberProfiles")
      .filter((q) => q.eq(q.field("groupId"), args.groupId))
      .collect();

    const group = await ctx.db.get(args.groupId);
    const maxMembers = group?.maxMembers;

    return {
      groupId: args.groupId,
      currentCount: members.length,
      maxMembers: maxMembers ?? null,
      percentUsed: maxMembers ? (members.length / maxMembers) * 100 : null,
      isAtCapacity: maxMembers ? members.length >= maxMembers : false,
    };
  },
});
