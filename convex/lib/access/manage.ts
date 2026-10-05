/**
 * Shared checks for the access-management functions in convex/access/.
 *
 * Three rules keep access management from becoming a way to escalate:
 *   1. Nobody grants admin-console permissions they do not hold themselves,
 *      and only owners grant the Owner pack or change an owner's access.
 *   2. Nobody changes their own access; another admin has to.
 *   3. At least one active owner always remains.
 */

import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import {
  OWNER_PACK_KEY,
  PERMISSIONS,
  ROLE_INFO,
  isPermission,
  type PermissionInfo,
  type RoleType,
} from "./catalog";
import { requireCallerAccess, type AuthIdentity } from "../authGuards";
import { hasPermission, type ResolvedAccess } from "./resolve";
import { findPackByKey } from "./provision";
import { recordAdminAction } from "../../admin/adminAudit";

type AnyCtx = QueryCtx | MutationCtx;

export async function requireAccessManager(ctx: AnyCtx): Promise<{ identity: AuthIdentity; access: ResolvedAccess }> {
  const result = await requireCallerAccess(ctx);
  if (!hasPermission(result.access, "access.manage")) {
    throw new ConvexError(result.access.isStaff ? "Unauthorized: Manage access access required" : "Unauthorized: Admin role required");
  }
  return result;
}

/** Rule 1: you can only hand out admin permissions you already hold. */
export function assertCanGrantPacks(access: ResolvedAccess, packs: Doc<"accessPacks">[]) {
  for (const pack of packs) {
    if (pack.key === OWNER_PACK_KEY && !access.isOwner) {
      throw new Error("Only an owner can grant the Owner pack.");
    }
    assertCanGrantPermissions(access, pack.permissions, `"${pack.name}"`);
  }
}

export function assertCanGrantPermissions(access: ResolvedAccess, permissions: string[], what: string) {
  if (access.isOwner) return;
  for (const p of permissions) {
    if (!isPermission(p)) continue;
    const info: PermissionInfo = PERMISSIONS[p];
    if (info.portal === "admin" && !access.permissions.includes(p)) {
      throw new Error(`You can't grant ${what} because it includes "${info.label}", which you don't have.`);
    }
  }
}

/** Whether a person currently holds the Owner pack on an active staff role. */
export async function profileIsOwner(ctx: AnyCtx, profileId: Id<"accessProfiles">): Promise<boolean> {
  const owner = await findPackByKey(ctx, OWNER_PACK_KEY);
  if (!owner) return false;
  const roles = await ctx.db
    .query("accessRoles")
    .withIndex("by_profile", (q) => q.eq("profileId", profileId))
    .collect();
  return roles.some((r) => r.role === "staff" && r.status === "active" && r.packIds.includes(owner._id));
}

/** Rules 1 and 2 for any change to someone else's access. */
export async function assertCanChange(ctx: AnyCtx, access: ResolvedAccess, profile: Doc<"accessProfiles">) {
  if (profile.clerkUserId && profile.clerkUserId === access.clerkUserId) {
    throw new Error("You can't change your own access. Ask another admin.");
  }
  if (!access.isOwner && (await profileIsOwner(ctx, profile._id))) {
    throw new Error("Only an owner can change an owner's access.");
  }
}

export interface RoleSpec {
  role: RoleType;
  partnerId?: Id<"distributionPartners">;
  leaderId?: Id<"partnerLeaders">;
  groupId?: Id<"groups">;
  label?: string;
  title?: string;
  packIds: Id<"accessPacks">[];
}

/**
 * Check a role's links and packs before it is saved, and return the packs.
 * `existing` lists the person's other roles so the same role is not added twice.
 */
export async function validateRoleSpec(
  ctx: AnyCtx,
  spec: RoleSpec,
  profile: Pick<Doc<"accessProfiles">, "clerkUserId" | "email"> | null,
  existing: Doc<"accessRoles">[],
): Promise<Doc<"accessPacks">[]> {
  const info = ROLE_INFO[spec.role];
  if (!info) throw new Error("Unknown role.");
  if (info.link === "partner" || info.link === "agency") {
    if (!spec.partnerId) throw new Error(`Choose the ${info.link === "agency" ? "agency" : "partner"} for this ${info.label} role.`);
    const partner = await ctx.db.get(spec.partnerId);
    if (!partner) throw new Error("That partner no longer exists.");
    if (info.link === "partner" && partner.type !== spec.role) {
      throw new Error(`${partner.name} is not a ${info.label}.`);
    }
    if (spec.leaderId) {
      const leader = await ctx.db.get(spec.leaderId);
      if (!leader || leader.partnerId !== spec.partnerId) throw new Error("That person record does not belong to this partner.");
      if (leader.clerkUserId && profile?.clerkUserId !== leader.clerkUserId) {
        throw new Error("That person record is already linked to a different account.");
      }
    }
  } else if (spec.partnerId || spec.leaderId) {
    throw new Error(`A ${info.label} role is not linked to a partner.`);
  }
  if (info.link === "group") {
    if (!spec.groupId || !(await ctx.db.get(spec.groupId))) throw new Error("Choose the organization for this role.");
  } else if (spec.groupId) {
    throw new Error(`A ${info.label} role is not linked to an organization.`);
  }
  if (info.link === "label" && !spec.label?.trim()) throw new Error("Enter the carrier's name.");

  const duplicate = existing.find(
    (r) =>
      r.role === spec.role &&
      r.partnerId === spec.partnerId &&
      r.groupId === spec.groupId &&
      (spec.role !== "carrier" || r.label?.trim().toLowerCase() === spec.label?.trim().toLowerCase()),
  );
  if (duplicate) throw new Error(`This person already has that ${info.label} role.`);
  return await validatePacksForRole(ctx, spec.role, spec.packIds);
}

export async function validatePacksForRole(ctx: AnyCtx, role: RoleType, packIds: Id<"accessPacks">[]) {
  if (!packIds.length) throw new Error("Choose at least one access pack.");
  const packs: Doc<"accessPacks">[] = [];
  for (const id of new Set(packIds)) {
    const pack = await ctx.db.get(id);
    if (!pack || pack.archived) throw new Error("One of the chosen access packs no longer exists.");
    if (!pack.roles.includes(role)) {
      throw new Error(`"${pack.name}" is not meant for a ${ROLE_INFO[role].label} role.`);
    }
    packs.push(pack);
  }
  return packs;
}

/** A short description of what a role is linked to, for lists and emails. */
export async function describeRole(ctx: AnyCtx, role: Pick<Doc<"accessRoles">, "role" | "partnerId" | "leaderId" | "groupId" | "label">): Promise<string> {
  const label = ROLE_INFO[role.role].label;
  if (role.partnerId) {
    const partner = await ctx.db.get(role.partnerId);
    return partner ? `${label} — ${partner.name}` : label;
  }
  if (role.groupId) {
    const group = await ctx.db.get(role.groupId);
    return group ? `${label} — ${group.name}` : label;
  }
  if (role.label) return `${label} — ${role.label}`;
  return label;
}

export async function auditAccess(
  ctx: MutationCtx,
  identity: { clerkUserId: string },
  action: string,
  summary: string,
  target?: { type: string; id: string },
  metadata?: unknown,
) {
  await recordAdminAction(ctx, identity, {
    action: `access.${action}`,
    targetType: target?.type,
    targetId: target?.id,
    summary,
    metadata,
  });
}

/** SHA-256 hex digest, for storing invitation tokens without the token itself. */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
