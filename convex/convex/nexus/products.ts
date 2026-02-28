import { mutation, query } from "../_generated/server";
import { v } from "convex/values";

// Get all products (for admin)
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("nexusProducts").withIndex("by_order").collect();
  },
});

// Get visible products (for portal)
export const getVisible = query({
  args: {},
  handler: async (ctx) => {
    const products = await ctx.db
      .query("nexusProducts")
      .withIndex("by_visible", (q) => q.eq("isVisible", true))
      .collect();
    return products.sort((a, b) => a.order - b.order);
  },
});

// Get products by category
export const getByCategory = query({
  args: { categoryId: v.id("nexusCategories") },
  handler: async (ctx, args) => {
    const products = await ctx.db
      .query("nexusProducts")
      .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
      .collect();
    return products
      .filter((p) => p.isVisible)
      .sort((a, b) => a.order - b.order);
  },
});

// Get featured products
export const getFeatured = query({
  args: {},
  handler: async (ctx) => {
    const products = await ctx.db
      .query("nexusProducts")
      .withIndex("by_featured", (q) => q.eq("isFeatured", true))
      .collect();
    return products
      .filter((p) => p.isVisible)
      .sort((a, b) => a.order - b.order);
  },
});

// Get product by slug
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("nexusProducts")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

// Get product by ID
export const getById = query({
  args: { id: v.id("nexusProducts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Get products with category info (for portal display)
export const getWithCategories = query({
  args: {},
  handler: async (ctx) => {
    const products = await ctx.db
      .query("nexusProducts")
      .withIndex("by_visible", (q) => q.eq("isVisible", true))
      .collect();
    
    const categories = await ctx.db
      .query("nexusCategories")
      .withIndex("by_visible", (q) => q.eq("isVisible", true))
      .collect();
    
    const categoryMap = new Map(categories.map((c) => [c._id, c]));
    
    return products
      .map((product) => ({
        ...product,
        category: categoryMap.get(product.categoryId),
      }))
      .sort((a, b) => a.order - b.order);
  },
});

// Create product
export const create = mutation({
  args: {
    categoryId: v.id("nexusCategories"),
    name: v.string(),
    slug: v.string(),
    provider: v.optional(v.string()),
    description: v.optional(v.string()),
    shortDescription: v.optional(v.string()),
    icon: v.optional(v.string()),
    flyerUrl: v.optional(v.string()),
    flyerStorageId: v.optional(v.id("_storage")),
    externalLink: v.optional(v.string()),
    features: v.optional(v.array(v.string())),
    order: v.number(),
    isVisible: v.boolean(),
    isFeatured: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("nexusProducts", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update product
export const update = mutation({
  args: {
    id: v.id("nexusProducts"),
    categoryId: v.optional(v.id("nexusCategories")),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    provider: v.optional(v.string()),
    description: v.optional(v.string()),
    shortDescription: v.optional(v.string()),
    icon: v.optional(v.string()),
    flyerUrl: v.optional(v.string()),
    flyerStorageId: v.optional(v.id("_storage")),
    externalLink: v.optional(v.string()),
    features: v.optional(v.array(v.string())),
    order: v.optional(v.number()),
    isVisible: v.optional(v.boolean()),
    isFeatured: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );
    await ctx.db.patch(id, {
      ...filteredUpdates,
      updatedAt: Date.now(),
    });
  },
});

// Delete product
export const remove = mutation({
  args: { id: v.id("nexusProducts") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// Reorder products
export const reorder = mutation({
  args: {
    orderedIds: v.array(v.id("nexusProducts")),
  },
  handler: async (ctx, args) => {
    for (let i = 0; i < args.orderedIds.length; i++) {
      await ctx.db.patch(args.orderedIds[i], {
        order: i,
        updatedAt: Date.now(),
      });
    }
  },
});

// Toggle visibility
export const toggleVisibility = mutation({
  args: { id: v.id("nexusProducts") },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.id);
    if (product) {
      await ctx.db.patch(args.id, {
        isVisible: !product.isVisible,
        updatedAt: Date.now(),
      });
    }
  },
});

// Toggle featured
export const toggleFeatured = mutation({
  args: { id: v.id("nexusProducts") },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.id);
    if (product) {
      await ctx.db.patch(args.id, {
        isFeatured: !product.isFeatured,
        updatedAt: Date.now(),
      });
    }
  },
});
