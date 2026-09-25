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

import { ConvexError } from "convex/values";
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
    // Log to help diagnose auth issues — visible in `npx convex logs`
    console.error("[requireAuth] getUserIdentity() returned null — JWT was not sent or could not be verified against auth.config.ts");
    throw new ConvexError("Unauthorized: Authentication required");
  }

  return {
    tokenIdentifier: identity.tokenIdentifier,
    clerkUserId: extractClerkUserId(identity.tokenIdentifier),
    email: identity.email ?? undefined,
    name: identity.name ?? undefined,
  };
}

/** Look up the caller's `adminUsers` row, if they have one. */
async function findAdminUser(ctx: AnyCtx, clerkUserId: string) {
  return await (ctx as QueryCtx).db
    .query("adminUsers")
    .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", clerkUserId))
    .first();
}

/** Look up the caller's ACTIVE distribution partner row, if they have one. */
async function findActivePartner(ctx: AnyCtx, clerkUserId: string) {
  const partner = await (ctx as QueryCtx).db
    .query("distributionPartners")
    .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", clerkUserId))
    .first();
  return partner && partner.status === "active" ? partner : null;
}

/**
 * Require INTERNAL STAFF — a row in `adminUsers`. Distribution partners do
 * not pass.
 *
 * This is the guard that internal-only surfaces should use: billing, vendor
 * statements, admin users, dev tools, anything whole-book. Use
 * `requirePartnerOrAdmin` for a surface a broker is meant to reach, and let
 * `convex/insights/scope.ts` narrow what they can see.
 */
export async function requireStaffAdmin(ctx: AnyCtx): Promise<AuthIdentity> {
  const identity = await requireAuth(ctx);
  const admin = await findAdminUser(ctx, identity.clerkUserId);
  if (!admin) {
    throw new ConvexError("Unauthorized: Admin role required");
  }
  return identity;
}

/**
 * Require the OWNER role.
 *
 * `owner` vs `editor` was previously enforced only in the sidebar, by hiding
 * nav items — which is a UI affordance, not a permission, since Convex
 * functions are callable directly over the wire.
 */
export async function requireOwner(ctx: AnyCtx): Promise<AuthIdentity> {
  const identity = await requireAuth(ctx);
  const admin = await findAdminUser(ctx, identity.clerkUserId);
  if (!admin || admin.role !== "owner") {
    throw new Error("Unauthorized: Owner role required");
  }
  return identity;
}

/**
 * Require staff OR an active distribution partner (PM / FMO / Agency) or rep.
 *
 * Passing this only establishes that the caller may reach the surface at all.
 * It says NOTHING about which rows they may see — any query returning
 * member, revenue, or commission data must additionally resolve a
 * `ViewerScope` and filter by it.
 */
export async function requirePartnerOrAdmin(ctx: AnyCtx): Promise<AuthIdentity> {
  const identity = await requireAuth(ctx);

  if (await findAdminUser(ctx, identity.clerkUserId)) return identity;
  if (await findActivePartner(ctx, identity.clerkUserId)) return identity;

  const leader = await (ctx as QueryCtx).db
    .query("partnerLeaders")
    .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.clerkUserId))
    .first();
  if (leader) return identity;

  throw new Error("Unauthorized: Partner or admin role required");
}

/**
 * Require admin role — internal staff only.
 *
 * This used to ALSO admit any active `distributionPartners` row, which is how
 * brokers came to have unrestricted access to `/admin` and therefore to every
 * member and every dollar in the system. That fallback is gone now that the
 * `/partner` portal exists to receive them, where `convex/insights/scope.ts`
 * narrows each partner to their own book.
 *
 * Prefer `requireStaffAdmin` in new code; this is kept as its alias so the
 * ~100 existing call sites did not all have to churn in one commit.
 */
export async function requireAdmin(ctx: AnyCtx): Promise<AuthIdentity> {
  return await requireStaffAdmin(ctx);
}

/**
 * Require that the authenticated user matches the given customerId.
 * Used to prevent IDOR — users can only access their own data.
 * Admins bypass this check.
 */
export async function requireSelf(ctx: AnyCtx, customerId: string): Promise<AuthIdentity> {
  const identity = await requireAuth(ctx);

  if (identity.clerkUserId !== customerId) {
    // Check if admin (or active distribution partner) — they can access any user's data
    const admin = await (ctx as QueryCtx).db
      .query("adminUsers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.clerkUserId))
      .first();

    if (!admin) {
      const partner = await (ctx as QueryCtx).db
        .query("distributionPartners")
        .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.clerkUserId))
        .first();
      if (!partner || partner.status !== "active") {
        throw new ConvexError("Unauthorized: You can only access your own data");
      }
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
    throw new ConvexError("Unauthorized: Authentication required");
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
    throw new ConvexError("Unauthorized: Admin role required");
  }

  return identity;
}
