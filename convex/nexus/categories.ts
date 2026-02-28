import { mutation, query } from "../_generated/server";
import { v } from "convex/values";

// Get all categories (for admin)
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("nexusCategories").withIndex("by_order").collect();
  },
});

// Get visible categories (for portal)
export const getVisible = query({
  args: {},
  handler: async (ctx) => {
    const categories = await ctx.db
      .query("nexusCategories")
      .withIndex("by_visible", (q) => q.eq("isVisible", true))
      .collect();
    return categories.sort((a, b) => a.order - b.order);
  },
});

// Get category by slug
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("nexusCategories")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

// Get category by ID
export const getById = query({
  args: { id: v.id("nexusCategories") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Create category
export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    order: v.number(),
    isVisible: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("nexusCategories", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update category
export const update = mutation({
  args: {
    id: v.id("nexusCategories"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    order: v.optional(v.number()),
    isVisible: v.optional(v.boolean()),
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

// Delete category
export const remove = mutation({
  args: { id: v.id("nexusCategories") },
  handler: async (ctx, args) => {
    // Also delete all products in this category
    const products = await ctx.db
      .query("nexusProducts")
      .withIndex("by_category", (q) => q.eq("categoryId", args.id))
      .collect();
    
    for (const product of products) {
      await ctx.db.delete(product._id);
    }
    
    await ctx.db.delete(args.id);
  },
});

// Reorder categories
export const reorder = mutation({
  args: {
    orderedIds: v.array(v.id("nexusCategories")),
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
