/**
 * ACCESS PROVISIONING — keeps the records each portal already checks in step
 * with access roles.
 *
 * The admin console, partner portal and employer portal predate access
 * packs and still read their own tables: `adminUsers` for staff,
 * `partnerLeaders` for partner people, `eligibilityIntakeAccess` for
 * organization uploads. Granting, suspending or removing a role updates the
 * matching row here, so a suspended person loses access everywhere even
 * where a check reads those tables directly.
 */

import type { MutationCtx, QueryCtx } from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import {
  BUILT_IN_PACKS,
  CRM_MANAGER_PACK_KEY,
  OWNER_PACK_KEY,
  ORGANIZATION_UPLOADS_PACK_KEY,
  PARTNER_LEGACY_PACK_KEY,
  STAFF_LEGACY_PACK_KEY,
  type RoleType,
} from "./catalog";
import { computeRolePermissions, loadPacks } from "./resolve";
import { setOrganizationUploadAccess } from "../../eligibilityIntake";
import { autoGrantFreeAccess } from "../../admin/grantFreeAccess";

type AnyCtx = QueryCtx | MutationCtx;

export function normalizeAccessEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }
  return email;
}

/** Insert any built-in pack that is missing. Edited built-ins are left alone. */
export async function ensureBuiltInPacks(ctx: MutationCtx): Promise<Map<string, Id<"accessPacks">>> {
  const ids = new Map<string, Id<"accessPacks">>();
  for (const def of BUILT_IN_PACKS) {
    const existing = await ctx.db
      .query("accessPacks")
      .withIndex("by_key", (q) => q.eq("key", def.key))
      .first();
    if (existing) {
      ids.set(def.key, existing._id);
      continue;
    }
    const now = Date.now();
    ids.set(
      def.key,
      await ctx.db.insert("accessPacks", {
        key: def.key,
        name: def.name,
        description: def.description,
        roles: def.roles,
        permissions: def.permissions,
        builtIn: true,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }
  return ids;
}

export async function findPackByKey(ctx: AnyCtx, key: string) {
  return await ctx.db
    .query("accessPacks")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();
}

export async function findProfileByEmail(ctx: AnyCtx, email: string) {
  return await ctx.db
    .query("accessProfiles")
    .withIndex("by_email", (q) => q.eq("email", email))
    .first();
}

/** Find or create a person by email, filling in a Clerk id we learn later. */
export async function upsertProfile(
  ctx: MutationCtx,
  args: { email: string; name: string; phone?: string; clerkUserId?: string; status: "invited" | "active"; actor?: string },
): Promise<Id<"accessProfiles">> {
  const email = normalizeAccessEmail(args.email);
  const now = Date.now();
  const existing = await findProfileByEmail(ctx, email);
  if (existing) {
    const patch: Partial<Doc<"accessProfiles">> = {};
    if (args.clerkUserId && !existing.clerkUserId) patch.clerkUserId = args.clerkUserId;
    if (args.status === "active" && existing.status === "invited" && (existing.clerkUserId || args.clerkUserId)) patch.status = "active";
    if (Object.keys(patch).length) await ctx.db.patch(existing._id, { ...patch, updatedAt: now });
    return existing._id;
  }
  if (args.clerkUserId) {
    const linked = await ctx.db
      .query("accessProfiles")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();
    if (linked) return linked._id;
  }
  return await ctx.db.insert("accessProfiles", {
    email,
    name: args.name.trim() || email,
    phone: args.phone,
    clerkUserId: args.clerkUserId,
    status: args.status,
    invitedBy: args.actor,
    createdAt: now,
    updatedAt: now,
  });
}

/** A leader's role: partner people with a wider report scope lead; the rest are reps. */
export function leaderRoleType(
  leader: Pick<Doc<"partnerLeaders">, "reportScope">,
  partner: Pick<Doc<"distributionPartners">, "type"> | null,
): RoleType {
  if (partner && (leader.reportScope === "agency" || leader.reportScope === "downline")) return partner.type;
  return "rep";
}

async function insertRole(
  ctx: MutationCtx,
  profileId: Id<"accessProfiles">,
  role: Omit<Doc<"accessRoles">, "_id" | "_creationTime" | "profileId" | "createdAt" | "updatedAt">,
) {
  const now = Date.now();
  return await ctx.db.insert("accessRoles", { ...role, profileId, createdAt: now, updatedAt: now });
}

/**
 * Record, as roles, the access a person already has in the older tables:
 * a staff row, partner person rows, a claimed partner contact, and employer
 * upload grants. Existing staff keep what they had (owner, or the legacy
 * console pack); partners keep every portal page. Idempotent.
 */
export async function importLegacyForProfile(ctx: MutationCtx, profileId: Id<"accessProfiles">): Promise<number> {
  const profile = await ctx.db.get(profileId);
  if (!profile) return 0;
  const packs = await ensureBuiltInPacks(ctx);
  const roles = await ctx.db
    .query("accessRoles")
    .withIndex("by_profile", (q) => q.eq("profileId", profileId))
    .collect();
  let added = 0;
  const clerkUserId = profile.clerkUserId;

  const admin = clerkUserId
    ? await ctx.db
        .query("adminUsers")
        .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", clerkUserId))
        .first()
    : (await ctx.db.query("adminUsers").collect()).find((a) => a.email.trim().toLowerCase() === profile.email);
  if (admin && !roles.some((r) => r.role === "staff")) {
    const packKeys =
      admin.role === "owner"
        ? [OWNER_PACK_KEY]
        : admin.departments?.includes("executive")
          ? [STAFF_LEGACY_PACK_KEY, CRM_MANAGER_PACK_KEY]
          : [STAFF_LEGACY_PACK_KEY];
    await insertRole(ctx, profileId, {
      role: "staff",
      packIds: packKeys.map((key) => packs.get(key)!),
      status: "active",
      staffDepartments: admin.departments,
      staffCommissionRate: admin.commissionRate,
      createdBy: "import",
    });
    added++;
  }

  if (clerkUserId) {
    const leaders = await ctx.db
      .query("partnerLeaders")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", clerkUserId))
      .collect();
    for (const leader of leaders) {
      if (roles.some((r) => r.leaderId === leader._id)) continue;
      const partner = await ctx.db.get(leader.partnerId);
      await insertRole(ctx, profileId, {
        role: leaderRoleType(leader, partner),
        partnerId: leader.partnerId,
        leaderId: leader._id,
        title: leader.title,
        packIds: [packs.get(PARTNER_LEGACY_PACK_KEY)!],
        status: leader.portalAccess !== false && partner?.status === "active" ? "active" : "suspended",
        createdBy: "import",
      });
      added++;
    }
    const contacts = await ctx.db
      .query("distributionPartners")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", clerkUserId))
      .collect();
    for (const partner of contacts) {
      if (roles.some((r) => r.partnerId === partner._id && !r.leaderId)) continue;
      await insertRole(ctx, profileId, {
        role: partner.type,
        partnerId: partner._id,
        packIds: [packs.get(PARTNER_LEGACY_PACK_KEY)!],
        status: partner.status === "active" ? "active" : "suspended",
        createdBy: "import",
      });
      added++;
    }
  }

  const grants = await ctx.db
    .query("eligibilityIntakeAccess")
    .withIndex("by_email", (q) => q.eq("email", profile.email))
    .collect();
  for (const grant of grants) {
    if (roles.some((r) => r.role === "organization" && r.groupId === grant.groupId)) continue;
    await insertRole(ctx, profileId, {
      role: "organization",
      groupId: grant.groupId,
      packIds: [packs.get(ORGANIZATION_UPLOADS_PACK_KEY)!],
      status: grant.active ? "active" : "suspended",
      createdBy: "import",
    });
    added++;
  }
  return added;
}

const LEADER_SCOPE: Partial<Record<RoleType, "own" | "agency" | "downline">> = {
  program_manager: "downline",
  fmo: "downline",
  agency: "agency",
  broker: "own",
  rep: "own",
};

/**
 * Bring the older tables in line with one role's current state. Call after
 * any change to the role, its packs, or its person.
 */
export async function provisionRole(ctx: MutationCtx, roleId: Id<"accessRoles">, actor: string): Promise<string | null> {
  const role = await ctx.db.get(roleId);
  if (!role) return null;
  const profile = await ctx.db.get(role.profileId);
  if (!profile) return null;
  const live = role.status === "active" && profile.status === "active";
  const packs = await loadPacks(ctx, role.packIds);
  const { permissions, isOwner } = computeRolePermissions({
    role: role.role,
    status: role.status,
    packs: role.packIds.map((id) => packs.get(String(id))).filter((p): p is Doc<"accessPacks"> => !!p),
  });
  const now = Date.now();

  if (role.role === "staff") {
    const clerkUserId = profile.clerkUserId;
    if (!clerkUserId) return null;
    const admin = await ctx.db
      .query("adminUsers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", clerkUserId))
      .first();
    if (live) {
      const adminRole = isOwner ? "owner" : "editor";
      if (admin) {
        await ctx.db.patch(admin._id, { role: adminRole, name: profile.name, email: profile.email });
      } else {
        await ctx.db.insert("adminUsers", {
          clerkUserId,
          email: profile.email,
          name: profile.name,
          phone: profile.phone,
          role: adminRole,
          departments: (role.staffDepartments as Doc<"adminUsers">["departments"]) ?? ["admin"],
          commissionRate: role.staffCommissionRate,
          createdAt: now,
        });
        await autoGrantFreeAccess(ctx, clerkUserId, "Auto-granted on staff access");
      }
    } else if (admin) {
      await ctx.db.patch(role._id, {
        staffDepartments: admin.departments,
        staffCommissionRate: admin.commissionRate,
        updatedAt: now,
      });
      await ctx.db.delete(admin._id);
    }
    return null;
  }

  if (role.role === "organization") {
    if (!role.groupId) return null;
    const ok = await setOrganizationUploadAccess(ctx, {
      groupId: role.groupId,
      email: profile.email,
      active: live && permissions.includes("employer.upload"),
      actor,
    });
    return ok ? null : "That organization is not accepting submissions, so upload access was not turned on.";
  }

  const scope = LEADER_SCOPE[role.role];
  if (!scope) return null;
  if (role.leaderId) {
    const leader = await ctx.db.get(role.leaderId);
    if (leader) {
      await ctx.db.patch(leader._id, {
        portalAccess: live,
        ...(profile.clerkUserId && !leader.clerkUserId ? { clerkUserId: profile.clerkUserId, inviteStatus: "claimed" as const } : {}),
        updatedAt: now,
      });
    }
    return null;
  }
  // A person at a partner gets their own partner-person record once they can
  // sign in, which is what carries their book, rep codes and report scope.
  if (role.partnerId && live && profile.clerkUserId) {
    const existing = (
      await ctx.db
        .query("partnerLeaders")
        .withIndex("by_partner", (q) => q.eq("partnerId", role.partnerId!))
        .collect()
    ).find((l) => l.email.trim().toLowerCase() === profile.email && (!l.clerkUserId || l.clerkUserId === profile.clerkUserId));
    const leaderId =
      existing?._id ??
      (await ctx.db.insert("partnerLeaders", {
        partnerId: role.partnerId,
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        title: role.title,
        isPrimary: false,
        portalAccess: true,
        reportScope: scope,
        clerkUserId: profile.clerkUserId,
        inviteStatus: "claimed",
        createdAt: now,
        updatedAt: now,
      }));
    if (existing) {
      await ctx.db.patch(existing._id, { clerkUserId: profile.clerkUserId, portalAccess: true, inviteStatus: "claimed", updatedAt: now });
    }
    await ctx.db.patch(role._id, { leaderId, updatedAt: now });
  }
  return null;
}

export async function provisionProfile(ctx: MutationCtx, profileId: Id<"accessProfiles">, actor: string): Promise<string[]> {
  const roles = await ctx.db
    .query("accessRoles")
    .withIndex("by_profile", (q) => q.eq("profileId", profileId))
    .collect();
  const warnings: string[] = [];
  for (const role of roles) {
    const warning = await provisionRole(ctx, role._id, actor);
    if (warning) warnings.push(warning);
  }
  return warnings;
}

/** Profiles whose active staff role carries the Owner pack, plus owners not yet imported. */
export async function activeOwnerProfileIds(ctx: AnyCtx): Promise<{ profileIds: Set<string>; legacyOwners: number }> {
  const ownerPack = await findPackByKey(ctx, OWNER_PACK_KEY);
  const profileIds = new Set<string>();
  if (ownerPack) {
    const staffRoles = await ctx.db
      .query("accessRoles")
      .withIndex("by_role", (q) => q.eq("role", "staff"))
      .collect();
    for (const role of staffRoles) {
      if (role.status !== "active" || !role.packIds.includes(ownerPack._id)) continue;
      const profile = await ctx.db.get(role.profileId);
      if (profile?.status === "active") profileIds.add(String(profile._id));
    }
  }
  let legacyOwners = 0;
  for (const admin of await ctx.db.query("adminUsers").collect()) {
    if (admin.role !== "owner") continue;
    const profile = await ctx.db
      .query("accessProfiles")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", admin.clerkUserId))
      .first();
    if (!profile || profile.status === "invited") legacyOwners++;
  }
  return { profileIds, legacyOwners };
}

/**
 * After a change made through the older staff screens (adminUsers), bring
 * the person's access profile in line: add a staff role if they have none,
 * match its Owner pack to their owner/editor role, or drop the staff role
 * when the staff row is gone. No-op for people without a profile.
 */
export async function reconcileStaffFromAdmin(ctx: MutationCtx, clerkUserId: string): Promise<void> {
  const profile = await ctx.db
    .query("accessProfiles")
    .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", clerkUserId))
    .first();
  if (!profile) return;
  const admin = await ctx.db
    .query("adminUsers")
    .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", clerkUserId))
    .first();
  const staffRoles = (
    await ctx.db
      .query("accessRoles")
      .withIndex("by_profile", (q) => q.eq("profileId", profile._id))
      .collect()
  ).filter((r) => r.role === "staff");
  if (!admin) {
    for (const role of staffRoles) await ctx.db.delete(role._id);
    return;
  }
  if (!staffRoles.length) {
    await importLegacyForProfile(ctx, profile._id);
    return;
  }
  const packs = await ensureBuiltInPacks(ctx);
  const owner = packs.get(OWNER_PACK_KEY)!;
  for (const role of staffRoles) {
    const hasOwner = role.packIds.includes(owner);
    if (admin.role === "owner" && !hasOwner) {
      await ctx.db.patch(role._id, { packIds: [...role.packIds, owner], status: "active", updatedAt: Date.now() });
    } else if (admin.role === "editor" && hasOwner) {
      const rest = role.packIds.filter((id) => id !== owner);
      await ctx.db.patch(role._id, { packIds: rest.length ? rest : [packs.get(STAFF_LEGACY_PACK_KEY)!], updatedAt: Date.now() });
    }
  }
}

/** Refuse a change that would leave no active owner. */
export async function assertOwnersRemain(ctx: MutationCtx, losingProfileId: Id<"accessProfiles"> | null, losingLegacyOwner = false) {
  const { profileIds, legacyOwners } = await activeOwnerProfileIds(ctx);
  if (losingProfileId) profileIds.delete(String(losingProfileId));
  const remaining = profileIds.size + legacyOwners - (losingLegacyOwner ? 1 : 0);
  if (remaining < 1) throw new Error("At least one active owner must remain.");
}

/**
 * After someone claims an invitation through an older flow (partner or
 * admin invites), record the new access on their profile if they have one.
 * People without a profile keep resolving through the older tables.
 */
export async function importLegacyForClerkUser(ctx: MutationCtx, clerkUserId: string): Promise<void> {
  const profile = await ctx.db
    .query("accessProfiles")
    .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", clerkUserId))
    .first();
  if (profile && profile.status !== "invited") await importLegacyForProfile(ctx, profile._id);
}
