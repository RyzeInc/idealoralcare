import { internalMutation, mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin, requireAuth } from "../lib/authGuards";
import { autoGrantFreeAccess } from "./grantFreeAccess";

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
    // Public query - access control at page level (/admin layout verifies admin role)
    return await ctx.db
      .query("adminUsers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();
  },
});

// Get all admin users
// Get all admin users (public query - access control at page level)
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    // Public - the /admin layout already verifies admin role
    // This prevents auth dependency issues on client-side component mount
    return await ctx.db.query("adminUsers").collect();
  },
});

// Get current authenticated admin's profile
export const getMyAdminProfile = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireAuth(ctx);
    const admin = await ctx.db
      .query("adminUsers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.clerkUserId))
      .first();
    return admin || null;
  },
});

// Get all brokers (adminUsers with "broker" department)
export const getBrokersByDepartment = query({
  args: {},
  handler: async (ctx) => {
    // Public query - fetch all users with broker department
    const allAdmins = await ctx.db.query("adminUsers").collect();
    return allAdmins.filter((admin) =>
      admin.departments?.includes("broker") ?? false
    );
  },
});

// Add admin user
export const add = mutation({
  args: {
    clerkUserId: v.string(),
    email: v.string(),
    name: v.string(),
    phone: v.optional(v.string()),
    role: v.union(v.literal("owner"), v.literal("editor")),
    departments: v.array(
      v.union(
        v.literal("broker"),
        v.literal("sales"),
        v.literal("hr"),
        v.literal("executive"),
        v.literal("admin")
      )
    ),
    commissionRate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    // Check if already exists
    const existing = await ctx.db
      .query("adminUsers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();

    if (existing) {
      return existing._id;
    }

    const id = await ctx.db.insert("adminUsers", {
      clerkUserId: args.clerkUserId,
      email: args.email,
      name: args.name,
      phone: args.phone,
      role: args.role,
      departments: args.departments,
      commissionRate: args.commissionRate,
      createdAt: Date.now(),
    });

    // Automatically grant free platform access to all new team members
    await autoGrantFreeAccess(
      ctx,
      args.clerkUserId,
      `Auto-granted on team member addition (${args.departments.join(", ")})`
    );

    return id;
  },
});

// Update admin role
export const updateRole = mutation({
  args: {
    id: v.id("adminUsers"),
    role: v.union(v.literal("owner"), v.literal("editor")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.id, { role: args.role });
  },
});

// Update admin user (name, email, phone, departments, commission rate)
export const updateAdmin = mutation({
  args: {
    id: v.id("adminUsers"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    departments: v.optional(
      v.array(
        v.union(
          v.literal("broker"),
          v.literal("sales"),
          v.literal("hr"),
          v.literal("executive"),
          v.literal("admin")
        )
      )
    ),
    commissionRate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

// Remove admin user
export const remove = mutation({
  args: { id: v.id("adminUsers") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
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
    await requireAuth(ctx);
    // Check if any admins exist
    const existingAdmins = await ctx.db.query("adminUsers").first();
    if (existingAdmins) {
      // If admins exist, this should be called through add() instead
      return null;
    }

    // First user becomes owner with admin department
    return await ctx.db.insert("adminUsers", {
      clerkUserId: args.clerkUserId,
      email: args.email,
      name: args.name,
      role: "owner",
      departments: ["admin"],
      createdAt: Date.now(),
    });
  },
});

// Bootstrap first admin without auth (CLI/one-time use only)
// Safe: only runs when zero admins exist in the database
export const bootstrapFirstAdmin = internalMutation({
  args: {
    clerkUserId: v.string(),
    email: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const existingAdmins = await ctx.db.query("adminUsers").first();
    if (existingAdmins) {
      return { status: "already_exists" };
    }
    const id = await ctx.db.insert("adminUsers", {
      clerkUserId: args.clerkUserId,
      email: args.email,
      name: args.name,
      role: "owner",
      departments: ["admin"],
      createdAt: Date.now(),
    });
    return { status: "created", id };
  },
});