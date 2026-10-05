/**
 * AUTH GUARDS
 *
 * Centralized authentication and authorization helpers for Convex functions.
 * Every sensitive query/mutation should call one of these at the top of its handler.
 *
 * Pattern:
 *   const identity = await requireAuth(ctx);                    // Any logged-in user
 *   const identity = await requireAccess(ctx, "members.view");  // Staff holding a permission
 *   await requireSelf(ctx, customerId);                         // Must match the authenticated user
 *
 * Permissions come from access packs (convex/lib/access). Prefer
 * `requireAccess` with the narrowest permission over `requireStaffAdmin`.
 */

import { ConvexError } from "convex/values";
import type { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { PERMISSIONS, type Permission } from "./access/catalog";
import { hasAnyPortalPermission, hasPermission, resolveAccess, type ResolvedAccess } from "./access/resolve";

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

/** The caller's identity and resolved access. */
export async function requireCallerAccess(ctx: AnyCtx): Promise<{ identity: AuthIdentity; access: ResolvedAccess }> {
  const identity = await requireAuth(ctx);
  return { identity, access: await resolveAccess(ctx, identity.clerkUserId) };
}

/**
 * Why a check failed. Someone who is not staff at all is told the admin role
 * is required, as before access packs; staff missing one permission are told
 * which.
 */
function deniedMessage(access: Pick<ResolvedAccess, "isStaff">, needed: Permission | Permission[]): string {
  const list = Array.isArray(needed) ? needed : [needed];
  const adminOnly = list.every((p) => PERMISSIONS[p].portal === "admin");
  if (adminOnly && !access.isStaff) return "Unauthorized: Admin role required";
  return `Unauthorized: ${list.map((p) => PERMISSIONS[p].label).join(" or ")} access required`;
}

/**
 * Require a permission from the caller's access packs (any one of a list).
 *
 * Admin-console permissions only ever arrive through a staff role, so this
 * also implies "internal staff" for every admin permission.
 */
export async function requireAccess(ctx: AnyCtx, needed: Permission | Permission[]): Promise<AuthIdentity> {
  const { identity, access } = await requireCallerAccess(ctx);
  if (!hasPermission(access, needed)) {
    throw new ConvexError(deniedMessage(access, needed));
  }
  return identity;
}

/**
 * Require INTERNAL STAFF — an active staff role (or, before import, a row in
 * `adminUsers`). Distribution partners do not pass.
 *
 * Use only where any staff member may act regardless of their packs, such as
 * the staff directory. Everything else should use `requireAccess`.
 */
export async function requireStaffAdmin(ctx: AnyCtx): Promise<AuthIdentity> {
  const { identity, access } = await requireCallerAccess(ctx);
  if (!access.isStaff) {
    throw new ConvexError("Unauthorized: Admin role required");
  }
  return identity;
}

/** Require an owner: a staff role carrying the Owner pack. */
export async function requireOwner(ctx: AnyCtx): Promise<AuthIdentity> {
  const { identity, access } = await requireCallerAccess(ctx);
  if (!access.isOwner) {
    throw new Error("Unauthorized: Owner role required");
  }
  return identity;
}

/**
 * Require staff, or someone holding any partner-portal permission.
 *
 * Passing this only establishes that the caller may reach the surface at all.
 * It says NOTHING about which rows they may see — any query returning
 * member, revenue, or commission data must additionally resolve a
 * `ViewerScope` and filter by it.
 */
export async function requirePartnerOrAdmin(ctx: AnyCtx): Promise<AuthIdentity> {
  const { identity, access } = await requireCallerAccess(ctx);
  if (access.isStaff || hasAnyPortalPermission(access, "partner")) return identity;
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
 * Staff holding `staffPermission` bypass this check; partners never do.
 */
export async function requireSelf(
  ctx: AnyCtx,
  customerId: string,
  staffPermission: Permission = "members.edit",
): Promise<AuthIdentity> {
  const { identity, access } = await requireCallerAccess(ctx);
  if (identity.clerkUserId !== customerId && !hasPermission(access, staffPermission)) {
    throw new ConvexError("Unauthorized: You can only access your own data");
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
 * Require a permission from an action. Actions can't read the database, so
 * the check runs through an internal query.
 */
export async function requireAccessAction(ctx: ActionCtx, needed: Permission | Permission[]): Promise<AuthIdentity> {
  const identity = await requireAuthAction(ctx);
  const access: { isStaff: boolean; permissions: Permission[] } = await ctx.runQuery(internal.access.checks.accessById, {
    clerkUserId: identity.clerkUserId,
  });
  if (!hasPermission(access, needed)) {
    throw new ConvexError(deniedMessage(access, needed));
  }
  return identity;
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
