/**
 * The signed-in person's own access: what they hold, which portals they can
 * open, and which partner role they are viewing the partner portal as.
 */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { PARTNER_ROLES, ROLE_INFO } from "../lib/access/catalog";
import { activePartnerRole, hasAnyPortalPermission, resolveAccess } from "../lib/access/resolve";
import { describeRole } from "../lib/access/manage";
import { requireAuth } from "../lib/authGuards";

export const getMyAccess = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const clerkUserId = identity.tokenIdentifier.split("|").pop() ?? "";
    const access = await resolveAccess(ctx, clerkUserId);
    const active = activePartnerRole(access);
    return {
      source: access.source,
      suspended: access.suspended,
      isStaff: access.isStaff,
      isOwner: access.isOwner,
      permissions: access.permissions,
      portals: {
        admin: access.isStaff && hasAnyPortalPermission(access, "admin"),
        partner: hasAnyPortalPermission(access, "partner"),
        employer: hasAnyPortalPermission(access, "employer"),
      },
      roles: await Promise.all(
        access.roles.map(async (role) => ({
          roleId: role.roleId,
          role: role.role,
          roleLabel: ROLE_INFO[role.role].label,
          description: await describeRole(ctx, role),
          partnerPortal: PARTNER_ROLES.includes(role.role) && (!!role.leaderId || !!role.partnerId),
          permissions: role.permissions,
        })),
      ),
      activePartnerRoleId: active?.roleId ?? null,
    };
  },
});

/** Choose which partner role the partner portal shows. */
export const setActivePartnerRole = mutation({
  args: { roleId: v.id("accessRoles") },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const profile = await ctx.db
      .query("accessProfiles")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.clerkUserId))
      .first();
    const role = await ctx.db.get(args.roleId);
    if (!profile || !role || role.profileId !== profile._id || role.status !== "active" || !PARTNER_ROLES.includes(role.role)) {
      throw new Error("That role isn't available.");
    }
    await ctx.db.patch(profile._id, { activePartnerRoleId: role._id, updatedAt: Date.now() });
    return null;
  },
});
