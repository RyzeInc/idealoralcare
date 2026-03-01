import { mutation, query } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "../lib/authGuards";

// Get all core values (for admin)
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("coreValues").withIndex("by_order").collect();
  },
});

// Get visible core values (for public site)
export const getVisible = query({
  args: {},
  handler: async (ctx) => {
    const values = await ctx.db
      .query("coreValues")
      .withIndex("by_visible", (q) => q.eq("isVisible", true))
      .collect();
    return values.sort((a, b) => a.order - b.order);
  },
});

// Create core value
export const create = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    order: v.optional(v.number()),
    isVisible: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    let order = args.order;
    if (order === undefined) {
      const allValues = await ctx.db.query("coreValues").collect();
      order = allValues.length > 0 ? Math.max(...allValues.map((v) => v.order)) + 1 : 0;
    }

    return await ctx.db.insert("coreValues", {
      name: args.name,
      description: args.description,
      order,
      isVisible: args.isVisible ?? true,
      updatedAt: Date.now(),
    });
  },
});

// Update core value
export const update = mutation({
  args: {
    id: v.id("coreValues"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    order: v.optional(v.number()),
    isVisible: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
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

// Delete core value
export const remove = mutation({
  args: { id: v.id("coreValues") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});

// Toggle visibility
export const toggleVisibility = mutation({
  args: { id: v.id("coreValues") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const value = await ctx.db.get(args.id);
    if (value) {
      await ctx.db.patch(args.id, {
        isVisible: !value.isVisible,
        updatedAt: Date.now(),
      });
    }
  },
});

// Reorder
export const reorder = mutation({
  args: {
    orderedIds: v.array(v.id("coreValues")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
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
    const existing = await ctx.db.query("coreValues").first();
    if (existing) return;
    await seedCoreValuesData(ctx);
  },
});

// Resync (clear and reseed) core values data
export const resyncData = mutation({
  args: {},
  handler: async (ctx) => {
    // Delete all existing core values
    const existing = await ctx.db.query("coreValues").collect();
    for (const value of existing) {
      await ctx.db.delete(value._id);
    }
    // Then seed fresh data
    await seedCoreValuesData(ctx);
  },
});

// Shared seeding logic
async function seedCoreValuesData(ctx: MutationCtx) {
  const values = [
    {
      name: "Stewardship",
      description: "We treat every venture as if it were our own, with care and responsibility.",
      order: 0,
    },
    {
      name: "Ingenuity",
      description: "We solve complex problems with creative, practical solutions.",
      order: 1,
    },
    {
      name: "Clarity",
      description: "We communicate with precision and purpose, eliminating ambiguity.",
      order: 2,
    },
    {
      name: "Transparency",
      description: "We operate openly, building trust through honest communication.",
      order: 3,
    },
    {
      name: "Security",
      description: "We prioritize protection and reliability in everything we build.",
      order: 4,
    },
  ];

  for (const value of values) {
    await ctx.db.insert("coreValues", {
      ...value,
      isVisible: true,
      updatedAt: Date.now(),
    });
  }
}
