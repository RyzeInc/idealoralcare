import { mutation, query } from "../_generated/server";
import { v } from "convex/values";

// Get all navigation items (for admin)
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("navigationItems").withIndex("by_order").collect();
  },
});

// Get visible navigation items (for public site)
export const getVisible = query({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db
      .query("navigationItems")
      .withIndex("by_visible", (q) => q.eq("isVisible", true))
      .collect();
    return items.sort((a, b) => a.order - b.order);
  },
});

// Create navigation item
export const create = mutation({
  args: {
    name: v.string(),
    href: v.string(),
    order: v.optional(v.number()),
    isVisible: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let order = args.order;
    if (order === undefined) {
      const allItems = await ctx.db.query("navigationItems").collect();
      order = allItems.length > 0 ? Math.max(...allItems.map((i) => i.order)) + 1 : 0;
    }

    return await ctx.db.insert("navigationItems", {
      name: args.name,
      href: args.href,
      order,
      isVisible: args.isVisible ?? true,
      updatedAt: Date.now(),
    });
  },
});

// Update navigation item
export const update = mutation({
  args: {
    id: v.id("navigationItems"),
    name: v.optional(v.string()),
    href: v.optional(v.string()),
    order: v.optional(v.number()),
    isVisible: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    const cleanUpdates: Record<string, unknown> = { updatedAt: Date.now() };
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        cleanUpdates[key] = value;
      }
    });

    await ctx.db.patch(id, cleanUpdates);
  },
});

// Delete navigation item
export const remove = mutation({
  args: { id: v.id("navigationItems") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// Toggle visibility
export const toggleVisibility = mutation({
  args: { id: v.id("navigationItems") },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (item) {
      await ctx.db.patch(args.id, {
        isVisible: !item.isVisible,
        updatedAt: Date.now(),
      });
    }
  },
});

// Reorder
export const reorder = mutation({
  args: {
    orderedIds: v.array(v.id("navigationItems")),
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

// Seed initial data
export const seedInitialData = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("navigationItems").first();
    if (existing) return;

    const items = [
      { name: "Home", href: "/", order: 0 },
      { name: "Portfolio", href: "/portfolio", order: 1 },
      { name: "Get Involved", href: "/get-involved", order: 2 },
      { name: "Team", href: "/team", order: 3 },
      { name: "Contact", href: "/contact", order: 4 },
    ];

    for (const item of items) {
      await ctx.db.insert("navigationItems", {
        ...item,
        isVisible: true,
        updatedAt: Date.now(),
      });
    }
  },
});
