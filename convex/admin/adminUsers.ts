import { mutation, query } from "../_generated/server";
import { v } from "convex/values";

// Check if user is admin
export const isAdmin = query({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    const admin = await ctx.db
      .query("adminUsers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();
    return !!admin;
  },
});

// Get admin user
export const getByClerkId = query({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("adminUsers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();
  },
});

// Get all admin users
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("adminUsers").collect();
  },
});

// Add admin user
export const add = mutation({
  args: {
    clerkUserId: v.string(),
    email: v.string(),
    name: v.string(),
    role: v.union(v.literal("owner"), v.literal("editor")),
  },
  handler: async (ctx, args) => {
    // Check if already exists
    const existing = await ctx.db
      .query("adminUsers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("adminUsers", {
      clerkUserId: args.clerkUserId,
      email: args.email,
      name: args.name,
      role: args.role,
      createdAt: Date.now(),
    });
  },
});

// Update admin role
export const updateRole = mutation({
  args: {
    id: v.id("adminUsers"),
    role: v.union(v.literal("owner"), v.literal("editor")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { role: args.role });
  },
});

// Remove admin user
export const remove = mutation({
  args: { id: v.id("adminUsers") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// Initialize first admin (call this after first Clerk signup)
export const initializeFirstAdmin = mutation({
  args: {
    clerkUserId: v.string(),
    email: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if any admins exist
    const existingAdmins = await ctx.db.query("adminUsers").first();
    if (existingAdmins) {
      // If admins exist, this should be called through add() instead
      return null;
    }

    // First user becomes owner
    return await ctx.db.insert("adminUsers", {
      clerkUserId: args.clerkUserId,
      email: args.email,
      name: args.name,
      role: "owner",
      createdAt: Date.now(),
    });
  },
});
