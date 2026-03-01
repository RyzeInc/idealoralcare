/**
 * AUTH FUNCTIONS
 *
 * Server-side auth functions for Convex.
 * These are exported as Convex queries that can be called from the client
 * or from other Convex functions via ctx.runQuery.
 *
 * For internal use in mutation/query handlers, use convex/lib/authGuards.ts instead.
 */

import { query } from "./_generated/server";
import { v } from "convex/values";
import type { QueryCtx } from "./_generated/server";

/**
 * Get current user's role based on adminUsers table lookup
 */
export const getUserRole = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx: QueryCtx, args: { userId: string }) => {
    const admin = await ctx.db
      .query("adminUsers")
      .withIndex("by_clerk_id", (q: any) => q.eq("clerkUserId", args.userId))
      .first();

    return {
      userId: args.userId,
      role: admin ? (admin.role === "owner" ? "admin" : "editor") : "customer",
    };
  },
});

/**
 * Check if user is admin (has any record in adminUsers table)
 */
export const isUserAdmin = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx: QueryCtx, args: { userId: string }) => {
    const admin = await ctx.db
      .query("adminUsers")
      .withIndex("by_clerk_id", (q: any) => q.eq("clerkUserId", args.userId))
      .first();

    return !!admin;
  },
});
