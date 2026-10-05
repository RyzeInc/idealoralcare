/**
 * ACCESS RESOLUTION — what a signed-in person may do.
 *
 * A person with an active access profile gets the union of the packs on
 * their active roles, counting each permission only when it arrived through
 * a role allowed to hold it (see PERMISSION_ROLES in ./catalog).
 *
 * People not yet imported into access profiles keep their pre-pack access:
 * owners get the whole console, editors the legacy staff set, and active
 * partners and reps every partner-portal page. "Sync existing accounts" in
 * /admin/access turns those into profiles so packs can narrow them.
 */

import type { QueryCtx, MutationCtx } from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import {
  ADMIN_PERMISSIONS,
  LEGACY_PARTNER_PERMISSIONS,
  OWNER_PACK_KEY,
  PARTNER_ROLES,
  PERMISSIONS,
  expandPermissions,
  legacyEditorPermissions,
  roleCanHold,
  isPermission,
  type Permission,
  type RoleType,
} from "./catalog";

type AnyCtx = QueryCtx | MutationCtx;

export interface ResolvedRole {
  roleId: Id<"accessRoles">;
  role: RoleType;
  partnerId?: Id<"distributionPartners">;
  leaderId?: Id<"partnerLeaders">;
  groupId?: Id<"groups">;
  label?: string;
  packKeys: string[];
  permissions: Permission[];
}

export interface ResolvedAccess {
  clerkUserId: string;
  source: "profile" | "legacy" | "none";
  profileId: Id<"accessProfiles"> | null;
  suspended: boolean;
  isStaff: boolean;
  isOwner: boolean;
  permissions: Permission[];
  roles: ResolvedRole[];
  activePartnerRoleId: Id<"accessRoles"> | null;
}

export interface RoleWithPacks {
  role: RoleType;
  status: "active" | "suspended";
  packs: Array<Pick<Doc<"accessPacks">, "key" | "permissions" | "archived">>;
}

/**
 * Effective permissions for a set of roles. Pure, so the admin preview shows
 * exactly what the guards would enforce.
 */
export function computeRolePermissions(role: RoleWithPacks): { permissions: Permission[]; isOwner: boolean } {
  if (role.status !== "active") return { permissions: [], isOwner: false };
  const packs = role.packs.filter((pack) => !pack.archived);
  const isOwner = role.role === "staff" && packs.some((pack) => pack.key === OWNER_PACK_KEY);
  const granted = isOwner ? [...ADMIN_PERMISSIONS] : packs.flatMap((pack) => pack.permissions);
  const permissions = expandPermissions(granted).filter((p) => roleCanHold(role.role, p));
  return { permissions, isOwner };
}

export function computeAccess(roles: RoleWithPacks[]): { permissions: Permission[]; isOwner: boolean; isStaff: boolean } {
  const all = new Set<Permission>();
  let isOwner = false;
  for (const role of roles) {
    const result = computeRolePermissions(role);
    result.permissions.forEach((p) => all.add(p));
    isOwner ||= result.isOwner;
  }
  const isStaff = roles.some((role) => role.role === "staff" && role.status === "active");
  return { permissions: expandPermissions(all), isOwner, isStaff };
}

export async function loadPacks(ctx: AnyCtx, ids: Id<"accessPacks">[]): Promise<Map<string, Doc<"accessPacks">>> {
  const packs = new Map<string, Doc<"accessPacks">>();
  for (const id of new Set(ids)) {
    const pack = await ctx.db.get(id);
    if (pack) packs.set(String(id), pack);
  }
  return packs;
}

export async function findProfileByClerkId(ctx: AnyCtx, clerkUserId: string) {
  return await ctx.db
    .query("accessProfiles")
    .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", clerkUserId))
    .first();
}

async function resolveProfileAccess(ctx: AnyCtx, clerkUserId: string, profile: Doc<"accessProfiles">): Promise<ResolvedAccess> {
  const base = {
    clerkUserId,
    source: "profile" as const,
    profileId: profile._id,
    activePartnerRoleId: profile.activePartnerRoleId ?? null,
  };
  if (profile.status === "suspended") {
    return { ...base, suspended: true, isStaff: false, isOwner: false, permissions: [], roles: [] };
  }
  const roleRows = (
    await ctx.db
      .query("accessRoles")
      .withIndex("by_profile", (q) => q.eq("profileId", profile._id))
      .collect()
  ).filter((role) => role.status === "active");
  const packs = await loadPacks(ctx, roleRows.flatMap((role) => role.packIds));
  const roles: ResolvedRole[] = [];
  const withPacks: RoleWithPacks[] = [];
  for (const row of roleRows) {
    const rolePacks = row.packIds.map((id) => packs.get(String(id))).filter((pack): pack is Doc<"accessPacks"> => !!pack);
    const entry: RoleWithPacks = { role: row.role, status: row.status, packs: rolePacks };
    withPacks.push(entry);
    roles.push({
      roleId: row._id,
      role: row.role,
      partnerId: row.partnerId,
      leaderId: row.leaderId,
      groupId: row.groupId,
      label: row.label,
      packKeys: rolePacks.filter((pack) => !pack.archived).map((pack) => pack.key),
      permissions: computeRolePermissions(entry).permissions,
    });
  }
  const { permissions, isOwner, isStaff } = computeAccess(withPacks);
  return { ...base, suspended: false, isStaff, isOwner, permissions, roles };
}

async function resolveLegacyAccess(ctx: AnyCtx, clerkUserId: string): Promise<ResolvedAccess> {
  const permissions = new Set<Permission>();
  const admin = await ctx.db
    .query("adminUsers")
    .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", clerkUserId))
    .first();
  const isOwner = admin?.role === "owner";
  if (admin) {
    const staff = isOwner ? ADMIN_PERMISSIONS : legacyEditorPermissions(!!admin.departments?.includes("executive"));
    staff.forEach((p) => permissions.add(p));
  }
  if (await hasLegacyPartnerAccess(ctx, clerkUserId)) {
    LEGACY_PARTNER_PERMISSIONS.forEach((p) => permissions.add(p));
  }
  return {
    clerkUserId,
    source: permissions.size || admin ? "legacy" : "none",
    profileId: null,
    suspended: false,
    isStaff: !!admin,
    isOwner,
    permissions: expandPermissions(permissions),
    roles: [],
    activePartnerRoleId: null,
  };
}

/** The partner-portal check used before access profiles (see insights/scope.ts). */
async function hasLegacyPartnerAccess(ctx: AnyCtx, clerkUserId: string): Promise<boolean> {
  const partner = await ctx.db
    .query("distributionPartners")
    .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", clerkUserId))
    .first();
  if (partner?.status === "active") return true;
  const leader = await ctx.db
    .query("partnerLeaders")
    .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", clerkUserId))
    .first();
  if (!leader || leader.portalAccess === false) return false;
  const owner = await ctx.db.get(leader.partnerId);
  return owner?.status === "active";
}

export async function resolveAccess(ctx: AnyCtx, clerkUserId: string): Promise<ResolvedAccess> {
  const profile = await findProfileByClerkId(ctx, clerkUserId);
  // An invitation nobody has claimed yet grants nothing on its own.
  if (profile && profile.status !== "invited") return await resolveProfileAccess(ctx, clerkUserId, profile);
  return await resolveLegacyAccess(ctx, clerkUserId);
}

export function hasPermission(access: Pick<ResolvedAccess, "permissions">, needed: Permission | Permission[]): boolean {
  const list = Array.isArray(needed) ? needed : [needed];
  return list.some((p) => access.permissions.includes(p));
}

export function hasAnyPortalPermission(access: Pick<ResolvedAccess, "permissions">, portal: "admin" | "partner" | "employer"): boolean {
  return access.permissions.some((p) => isPermission(p) && PERMISSIONS[p].portal === portal);
}

/**
 * The partner role a person is viewing the portal as: their chosen one if it
 * is still active and linked, otherwise the highest-ranked linked role.
 */
export function activePartnerRole(access: ResolvedAccess): ResolvedRole | null {
  // A leading role can stand on its partner alone (an imported partner
  // contact); brokers and reps need their own person record for a book.
  const candidates = access.roles.filter(
    (role) =>
      PARTNER_ROLES.includes(role.role) &&
      (role.leaderId || (role.partnerId && ["program_manager", "fmo", "agency"].includes(role.role))),
  );
  const chosen = candidates.find((role) => role.roleId === access.activePartnerRoleId);
  if (chosen) return chosen;
  return candidates.sort((a, b) => PARTNER_ROLES.indexOf(a.role) - PARTNER_ROLES.indexOf(b.role))[0] ?? null;
}
