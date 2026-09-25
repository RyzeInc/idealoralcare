/**
 * Non-throwing CRM access check, for gates that run before we know whether a
 * Clerk JWT has landed yet (the server layout, client components that mount
 * before auth is ready). Mirrors admin/adminUsers.ts:getMyAdminProfile.
 *
 * Use this to decide whether to SHOW the CRM section (layout gate, sidebar
 * filter). It is not a permission check on its own — every CRM function still
 * calls requireCrmUser / requireCrmManager independently, because a Convex
 * function is callable directly over the wire regardless of what the UI hid.
 */

import { internalQuery, query } from "../_generated/server";
import { v } from "convex/values";

export const isCrmStaff = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;
    const clerkUserId = identity.tokenIdentifier.split("|").pop() ?? "";
    const admin = await ctx.db
      .query("adminUsers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", clerkUserId))
      .first();
    return !!admin;
  },
});

/**
 * Internal-only, takes an explicit clerkUserId rather than reading
 * ctx.auth — actions can't touch ctx.db, so this is what
 * requireCrmUserAction/requireCrmManagerAction (convex/crm/guards.ts) call
 * via ctx.runQuery, mirroring the existing requireAdminAction pattern in
 * convex/lib/authGuards.ts.
 */
export const checkCrmAccessById = internalQuery({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    const admin = await ctx.db.query("adminUsers").withIndex("by_clerk_id", (q) => q.eq("clerkUserId", args.clerkUserId)).first();
    if (!admin) return { isStaff: false, isManager: false };
    return { isStaff: true, isManager: admin.role === "owner" || !!admin.departments?.includes("executive") };
  },
});
