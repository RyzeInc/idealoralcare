/**
 * AUTH UTILITIES
 *
 * Centralized auth functions for role-based access control
 * Uses Clerk's built-in Organization Roles and Permissions system
 *
 * PUBLIC CATALOG FLOW:
 * 1. Anyone can browse /health/* without authentication
 * 2. Authentication only required at checkout (/health/checkout)
 * 3. After successful payment, user is created/authenticated
 * 4. Redirects to /health/dashboard (protected route)
 */

import { auth, currentUser } from "@clerk/nextjs/server";

export type OrgRole = "org:admin" | "org:member";

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const { userId } = await auth();
  return !!userId;
}

/**
 * Get current user ID
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId || null;
}

/**
 * Get current organization ID from session
 */
export async function getCurrentOrgId(): Promise<string | null> {
  const { orgId } = await auth();
  return orgId || null;
}

/**
 * Check if user has a specific organization role
 */
export async function hasOrgRole(role: OrgRole): Promise<boolean> {
  const { orgRole } = await auth();
  return orgRole === role;
}

/**
 * Check if user is organization admin
 */
export async function isOrgAdmin(): Promise<boolean> {
  return hasOrgRole("org:admin");
}

/**
 * Get current user with organization info
 */
export async function getCurrentUserWithOrg() {
  const { userId, orgId, orgRole } = await auth();
  const user = await currentUser();

  return {
    userId,
    email: user?.emailAddresses[0]?.emailAddress,
    name: user?.fullName,
    orgId,
    orgRole,
    isOrgAdmin: orgRole === "org:admin",
  };
}

/**
 * Verify user is organization admin before proceeding
 * Throws if user is not admin
 */
export async function requireOrgAdmin(): Promise<void> {
  const isAdmin = await isOrgAdmin();
  if (!isAdmin) {
    throw new Error("Unauthorized: Admin role required");
  }
}
