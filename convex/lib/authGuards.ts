/**
 * AUTH GUARDS
 *
 * Centralized authentication and authorization helpers for Convex functions.
 * Every sensitive query/mutation should call one of these at the top of its handler.
 *
 * Pattern:
 *   const identity = await requireAuth(ctx);       // Any logged-in user
 *   const identity = await requireAdmin(ctx);      // Must be in adminUsers table
 *   await requireSelf(ctx, customerId);            // Must match the authenticated user
 */

import type { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";

type AnyCtx = QueryCtx | MutationCtx;

export interface AuthIdentity {
  /** Clerk token identifier (e.g., "https://clerk.your-domain.com|user_xxx") */
  tokenIdentifier: string;
  /** Clerk user ID extracted from tokenIdentifier (e.g., "user_xxx") */
  clerkUserId: string;
  /** User's email from Clerk */
  email?: string;
  /** User's name from Clerk */
  name?: string;
}

/**
 * Extract Clerk user ID from the tokenIdentifier
 * tokenIdentifier format: "https://domain.clerk.accounts.dev|user_xxxxx"
 */
function extractClerkUserId(tokenIdentifier: string): string {
  const parts = tokenIdentifier.split("|");
  return parts[parts.length - 1];
}

/**
 * Require authentication — throws if user is not logged in.
 * Returns the user's identity with Clerk user ID extracted.
 */
export async function requireAuth(ctx: AnyCtx): Promise<AuthIdentity> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthorized: Authentication required");
  }

  return {
    tokenIdentifier: identity.tokenIdentifier,
    clerkUserId: extractClerkUserId(identity.tokenIdentifier),
    email: identity.email ?? undefined,
    name: identity.name ?? undefined,
  };
}

/**
 * Require admin role — throws if user is not in the adminUsers table.
 * First checks authentication, then verifies admin status.
 * Returns the admin's identity.
 */
export async function requireAdmin(ctx: AnyCtx): Promise<AuthIdentity> {
  const identity = await requireAuth(ctx);

  const admin = await (ctx as QueryCtx).db
    .query("adminUsers")
    .withIndex("by_clerk_id", (q: any) => q.eq("clerkUserId", identity.clerkUserId))
    .first();

  if (!admin) {
    throw new Error("Unauthorized: Admin role required");
  }

  return identity;
}

/**
 * Require that the authenticated user matches the given customerId.
 * Used to prevent IDOR — users can only access their own data.
 * Admins bypass this check.
 */
export async function requireSelf(ctx: AnyCtx, customerId: string): Promise<AuthIdentity> {
  const identity = await requireAuth(ctx);

  if (identity.clerkUserId !== customerId) {
    // Check if admin — admins can access any user's data
    const admin = await (ctx as QueryCtx).db
      .query("adminUsers")
      .withIndex("by_clerk_id", (q: any) => q.eq("clerkUserId", identity.clerkUserId))
      .first();

    if (!admin) {
      throw new Error("Unauthorized: You can only access your own data");
    }
  }

  return identity;
}

/**
 * Get the authenticated user's Clerk ID, or null if not authenticated.
 * Non-throwing version for optional auth contexts.
 */
export async function getAuthenticatedUserId(ctx: AnyCtx): Promise<string | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return extractClerkUserId(identity.tokenIdentifier);
}

/**
 * Require authentication for Convex actions (different context type).
 * Actions use ctx.auth differently but the pattern is the same.
 */
export async function requireAuthAction(ctx: ActionCtx): Promise<AuthIdentity> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthorized: Authentication required");
  }

  return {
    tokenIdentifier: identity.tokenIdentifier,
    clerkUserId: extractClerkUserId(identity.tokenIdentifier),
    email: identity.email ?? undefined,
    name: identity.name ?? undefined,
  };
}

/**
 * Require admin for Convex actions.
 * Actions can't directly query the DB, so this checks via ctx.runQuery.
 * The caller must pass in the isAdmin query reference.
 */
export async function requireAdminAction(
  ctx: ActionCtx,
  isAdminQuery: unknown
): Promise<AuthIdentity> {
  const identity = await requireAuthAction(ctx);

  const isAdmin = (await ctx.runQuery(isAdminQuery as any, {
    clerkUserId: identity.clerkUserId,
  })) as boolean;

  if (!isAdmin) {
    throw new Error("Unauthorized: Admin role required");
  }

  return identity;
}
