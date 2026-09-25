import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "../lib/authGuards";

export const getSiteIntegrations = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, { siteId }) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("siteIntegrations")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .unique();
  },
});

export const upsertSiteIntegrations = mutation({
  args: {
    siteId: v.id("sites"),
    toothlensCompany: v.optional(v.string()),
    toothlensAccessKey: v.optional(v.string()),
    emailFromName: v.optional(v.string()),
    emailFromAddress: v.optional(v.string()),
    emailReplyTo: v.optional(v.string()),
    stripeMode: v.optional(v.union(v.literal("single"), v.literal("connect"))),
    stripeConnectAccountId: v.optional(v.string()),
    stripePriceMap: v.optional(v.any()),
    careingtonGroupCode: v.optional(v.string()),
    dialcareGroupCode: v.optional(v.string()),
    legalEntityName: v.optional(v.string()),
    legalAddress: v.optional(v.string()),
    carrierName: v.optional(v.string()),
  },
  handler: async (ctx, { siteId, ...fields }) => {
    await requireAdmin(ctx);
    const existing = await ctx.db
      .query("siteIntegrations")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .unique();

    const payload = { siteId, ...fields, updatedAt: Date.now() };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    } else {
      return await ctx.db.insert("siteIntegrations", payload);
    }
  },
});
