/**
 * AUTH FUNCTIONS
 *
 * Server-side auth logic for Convex
 * Used by mutations/queries to check user permissions
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { QueryCtx, MutationCtx } from "./_generated/server";

interface UserArgs {
  userId: string;
}

/**
 * Get current user's role from Clerk metadata
 */
export const getUserRole = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx: QueryCtx, args: UserArgs) => {
    // In production, you'd fetch from Clerk via API
    // For now, this is a placeholder - roles are managed in Clerk dashboard
    return {
      userId: args.userId,
      role: "customer" as const, // Default role
    };
  },
});

/**
 * Check if user is admin (server-side)
 */
export const isUserAdmin = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx: QueryCtx, args: UserArgs) => {
    // In production, verify against Clerk
    // This would check the publicMetadata.role field
    return false; // Default: not admin
  },
});
