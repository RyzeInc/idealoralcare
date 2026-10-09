/**
 * AUTH FUNCTIONS
 *
 * Server-side auth functions for Convex.
 * These are exported as Convex queries that can be called from the client
 * or from other Convex functions via ctx.runQuery.
 *
 * For internal use in mutation/query handlers, use convex/lib/authGuards.ts instead.
 */

import { query, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import type { QueryCtx } from "./_generated/server";
import { resolveAccess } from "./lib/access/resolve";

/**
 * Temporary debug query — call from browser console to verify auth:
 *   convex.query("auth:debugAuth", {})
 * Safe to leave in (returns nothing sensitive).
 */
export const debugAuth = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    return {
      isAuthenticated: !!identity,
      tokenIdentifier: identity?.tokenIdentifier ?? null,
      issuer: identity?.tokenIdentifier?.split("|")[0] ?? null,
    };
  },
});

/**
 * Get current user's role from their access (staff roles and packs)
 */
export const getUserRole = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx: QueryCtx, args: { userId: string }) => {
    const access = await resolveAccess(ctx, args.userId);

    return {
      userId: args.userId,
      role: access.isStaff ? (access.isOwner ? "admin" : "editor") : "customer",
    };
  },
});

/**
 * Check if user is internal staff
 */
export const isUserAdmin = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx: QueryCtx, args: { userId: string }) => {
    return (await resolveAccess(ctx, args.userId)).isStaff;
  },
});
