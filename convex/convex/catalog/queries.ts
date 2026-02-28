/**
 * CATALOG QUERIES
 *
 * Convex queries for reading product catalog
 * These are lightweight, cacheable, and public
 */

import { query } from "../_generated/server";
import { v } from "convex/values";

/**
 * Get all visible products, optionally filtered by category
 */
export const list = query({
  args: {
    category: v.optional(v.string()),
    featured: v.optional(v.boolean()),
  },
  handler: async (ctx: any, args: any) => {
    const products = await ctx.db
      .query("catalogProducts")
      .withIndex("by_visible", (q: any) => q.eq("isVisible", true))
      .collect();

    let filtered = products;

    if (args.category) {
      filtered = filtered.filter((p: any) => p.category === args.category);
    }

    if (args.featured) {
      filtered = filtered.filter((p: any) => p.isFeatured === true);
    }

    // Sort by order field
    return filtered.sort((a: any, b: any) => a.order - b.order);
  },
});

/**
 * Get a single product by slug
 */
export const getBySlug = query({
  args: {
    slug: v.string(),
  },
  handler: async (ctx: any, args: any) => {
    const product = await ctx.db
      .query("catalogProducts")
      .withIndex("by_slug", (q: any) => q.eq("slug", args.slug))
      .first();
    return product;
  },
});

/**
 * Get a product by ID
 */
export const getById = query({
  args: {
    id: v.id("catalogProducts"),
  },
  handler: async (ctx: any, args: any) => {
    const product = await ctx.db.get(args.id);
    return product;
  },
});

/**
 * Get all categories
 */
export const categories = query({
  args: {},
  handler: async (ctx: any) => {
    const products = await ctx.db
      .query("catalogProducts")
      .filter((q: any) => q.eq(q.field("isVisible"), true))
      .collect();

    // Extract unique categories
    const uniqueCategories = Array.from(
      new Set(products.map((p: any) => p.category))
    ) as string[];

    return uniqueCategories.sort();
  },
});

/**
 * Get recommended add-ons for a product
 */
export const getRecommendations = query({
  args: {
    productId: v.id("catalogProducts"),
  },
  handler: async (ctx: any, args: any) => {
    const product = await ctx.db.get(args.productId);
    if (!product || !product.metadata?.recommendedAddOns?.length) {
      return [];
    }

    const recommendations = await Promise.all(
      product.metadata.recommendedAddOns.map((id: string) =>
        ctx.db.get(id as any)
      )
    );

    return recommendations.filter((r: any) => r && r.isVisible);
  },
});
