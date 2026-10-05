/**
 * PEOPLE — everyone with an access profile, their roles, and changes to them.
 *
 * Inviting someone new lives in ./invites.ts (it sends email, so it is an
 * action). Every change here re-provisions the affected roles so the older
 * per-portal tables follow along (see convex/lib/access/provision.ts).
 */

import { mutation, query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { v } from "convex/values";
import { roleTypeValidator } from "../lib/access/validators";
import { OWNER_PACK_KEY, PAGES, canSee } from "../lib/access/catalog";
import { computeAccess, loadPacks } from "../lib/access/resolve";
import { assertOwnersRemain, provisionProfile, provisionRole } from "../lib/access/provision";
import {
  assertCanChange,
  assertCanGrantPacks,
  auditAccess,
  describeRole,
  profileIsOwner,
  requireAccessManager,
  validatePacksForRole,
  validateRoleSpec,
} from "../lib/access/manage";

export const roleSpecValidator = v.object({
  role: roleTypeValidator,
  partnerId: v.optional(v.id("distributionPartners")),
  leaderId: v.optional(v.id("partnerLeaders")),
  groupId: v.optional(v.id("groups")),
  label: v.optional(v.string()),
  title: v.optional(v.string()),
  packIds: v.array(v.id("accessPacks")),
});

async function rolesOf(ctx: QueryCtx, profileId: Id<"accessProfiles">) {
  return await ctx.db
    .query("accessRoles")
    .withIndex("by_profile", (q) => q.eq("profileId", profileId))
    .collect();
}

async function roleRows(ctx: QueryCtx, roles: Doc<"accessRoles">[], packs: Map<string, Doc<"accessPacks">>) {
  return await Promise.all(
    roles.map(async (role) => ({
      _id: role._id,
      role: role.role,
      status: role.status,
      partnerId: role.partnerId ?? null,
      leaderId: role.leaderId ?? null,
      groupId: role.groupId ?? null,
      label: role.label ?? null,
      title: role.title ?? null,
      description: await describeRole(ctx, role),
      packs: role.packIds
        .map((id) => packs.get(String(id)))
        .filter((p): p is Doc<"accessPacks"> => !!p)
        .map((p) => ({ _id: p._id, key: p.key, name: p.name, archived: !!p.archived })),
    })),
  );
}

function inviteState(profile: Doc<"accessProfiles">) {
  if (profile.status !== "invited") return null;
  if (!profile.inviteTokenHash) return "not_sent" as const;
  return profile.inviteExpiry && profile.inviteExpiry < Date.now() ? ("expired" as const) : ("pending" as const);
}

export const listPeople = query({
  args: {},
  handler: async (ctx) => {
    await requireAccessManager(ctx);
    const profiles = await ctx.db.query("accessProfiles").collect();
    const roles = await ctx.db.query("accessRoles").collect();
    const packs = await loadPacks(ctx, roles.flatMap((r) => r.packIds));
    const byProfile = new Map<string, Doc<"accessRoles">[]>();
    for (const role of roles) {
      const list = byProfile.get(String(role.profileId)) ?? [];
      list.push(role);
      byProfile.set(String(role.profileId), list);
    }
    const ownerPack = [...packs.values()].find((p) => p.key === OWNER_PACK_KEY);
    const rows = await Promise.all(
      profiles.map(async (profile) => {
        const mine = byProfile.get(String(profile._id)) ?? [];
        return {
          _id: profile._id,
          name: profile.name,
          email: profile.email,
          status: profile.status,
          signedIn: !!profile.clerkUserId,
          invite: inviteState(profile),
          isOwner: !!ownerPack && mine.some((r) => r.role === "staff" && r.status === "active" && r.packIds.includes(ownerPack._id)),
          roles: await roleRows(ctx, mine, packs),
          updatedAt: profile.updatedAt,
        };
      }),
    );
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const getPerson = query({
  args: { profileId: v.id("accessProfiles") },
  handler: async (ctx, args) => {
    const { access } = await requireAccessManager(ctx);
    const profile = await ctx.db.get(args.profileId);
    if (!profile) return null;
    const roles = await rolesOf(ctx, profile._id);
    const packs = await loadPacks(ctx, roles.flatMap((r) => r.packIds));
    const effective = computeAccess(
      roles.map((r) => ({
        role: r.role,
        status: profile.status === "suspended" ? ("suspended" as const) : r.status,
        packs: r.packIds.map((id) => packs.get(String(id))).filter((p): p is Doc<"accessPacks"> => !!p),
      })),
    );
    return {
      profile: {
        _id: profile._id,
        name: profile.name,
        email: profile.email,
        phone: profile.phone ?? null,
        notes: profile.notes ?? null,
        status: profile.status,
        signedIn: !!profile.clerkUserId,
        invite: inviteState(profile),
        inviteExpiry: profile.inviteExpiry ?? null,
        invitedAt: profile.invitedAt ?? null,
        claimedAt: profile.claimedAt ?? null,
      },
      roles: await roleRows(ctx, roles, packs),
      permissions: effective.permissions,
      isOwner: effective.isOwner,
      isStaff: effective.isStaff,
      pages: PAGES.map((page) => ({ ...page, allowed: canSee(effective.permissions, page.href) })),
      isSelf: !!profile.clerkUserId && profile.clerkUserId === access.clerkUserId,
    };
  },
});

/** Partners, groups and partner people to link roles to. */
export const linkTargets = query({
  args: {},
  handler: async (ctx) => {
    await requireAccessManager(ctx);
    const partners = await ctx.db.query("distributionPartners").collect();
    const groups = await ctx.db.query("groups").collect();
    return {
      partners: partners
        .map((p) => ({ _id: p._id, name: p.name, type: p.type, status: p.status }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      groups: groups
        .map((g) => ({ _id: g._id, name: g.name, status: g.status }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  },
});

export const partnerPeople = query({
  args: { partnerId: v.id("distributionPartners") },
  handler: async (ctx, args) => {
    await requireAccessManager(ctx);
    const leaders = await ctx.db
      .query("partnerLeaders")
      .withIndex("by_partner", (q) => q.eq("partnerId", args.partnerId))
      .collect();
    return leaders.map((l) => ({ _id: l._id, name: l.name, email: l.email, linked: !!l.clerkUserId }));
  },
});

export const updateProfile = mutation({
  args: {
    profileId: v.id("accessProfiles"),
    name: v.string(),
    phone: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { identity, access } = await requireAccessManager(ctx);
    const profile = await ctx.db.get(args.profileId);
    if (!profile) throw new Error("Person not found");
    if (!access.isOwner && (await profileIsOwner(ctx, profile._id))) throw new Error("Only an owner can change an owner's details.");
    const name = args.name.trim();
    if (!name) throw new Error("Enter a name.");
    await ctx.db.patch(profile._id, {
      name,
      phone: args.phone?.trim() || undefined,
      notes: args.notes?.trim().slice(0, 2000) || undefined,
      updatedAt: Date.now(),
    });
    await auditAccess(ctx, identity, "person.update", `Updated details for ${name}`, { type: "accessProfiles", id: String(profile._id) });
    return null;
  },
});

export const addRole = mutation({
  args: { profileId: v.id("accessProfiles"), role: roleSpecValidator },
  handler: async (ctx, args) => {
    const { identity, access } = await requireAccessManager(ctx);
    const profile = await ctx.db.get(args.profileId);
    if (!profile) throw new Error("Person not found");
    await assertCanChange(ctx, access, profile);
    const packs = await validateRoleSpec(ctx, args.role, profile, await rolesOf(ctx, profile._id));
    assertCanGrantPacks(access, packs);
    const now = Date.now();
    const roleId = await ctx.db.insert("accessRoles", {
      profileId: profile._id,
      role: args.role.role,
      partnerId: args.role.partnerId,
      leaderId: args.role.leaderId,
      groupId: args.role.groupId,
      label: args.role.label?.trim() || undefined,
      title: args.role.title?.trim() || undefined,
      packIds: packs.map((p) => p._id),
      status: "active",
      createdBy: identity.clerkUserId,
      createdAt: now,
      updatedAt: now,
    });
    const warning = await provisionRole(ctx, roleId, identity.clerkUserId);
    const role = await ctx.db.get(roleId);
    await auditAccess(ctx, identity, "role.add", `Gave ${profile.name} the ${await describeRole(ctx, role!)} role (${packs.map((p) => p.name).join(", ")})`, { type: "accessProfiles", id: String(profile._id) });
    return { roleId, warning };
  },
});

export const updateRole = mutation({
  args: {
    roleId: v.id("accessRoles"),
    packIds: v.array(v.id("accessPacks")),
    title: v.optional(v.string()),
    label: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("suspended")),
  },
  handler: async (ctx, args) => {
    const { identity, access } = await requireAccessManager(ctx);
    const role = await ctx.db.get(args.roleId);
    if (!role) throw new Error("Role not found");
    const profile = (await ctx.db.get(role.profileId))!;
    await assertCanChange(ctx, access, profile);
    const packs = await validatePacksForRole(ctx, role.role, args.packIds);
    assertCanGrantPacks(access, packs.filter((p) => !role.packIds.includes(p._id)));
    if (role.role === "carrier" && !args.label?.trim()) throw new Error("Enter the carrier's name.");

    const wasOwner = await profileIsOwner(ctx, profile._id);
    await ctx.db.patch(role._id, {
      packIds: packs.map((p) => p._id),
      title: args.title?.trim() || undefined,
      label: args.label?.trim() || undefined,
      status: args.status,
      updatedAt: Date.now(),
    });
    if (wasOwner && !(await profileIsOwner(ctx, profile._id))) await assertOwnersRemain(ctx, profile._id);
    const warning = await provisionRole(ctx, role._id, identity.clerkUserId);
    await auditAccess(ctx, identity, "role.update", `Changed ${profile.name}'s ${await describeRole(ctx, role)} role: ${args.status}, ${packs.map((p) => p.name).join(", ")}`, { type: "accessProfiles", id: String(profile._id) }, {
      before: { status: role.status, packIds: role.packIds },
      after: { status: args.status, packIds: packs.map((p) => p._id) },
    });
    return { warning };
  },
});

export const removeRole = mutation({
  args: { roleId: v.id("accessRoles") },
  handler: async (ctx, args) => {
    const { identity, access } = await requireAccessManager(ctx);
    const role = await ctx.db.get(args.roleId);
    if (!role) throw new Error("Role not found");
    const profile = (await ctx.db.get(role.profileId))!;
    await assertCanChange(ctx, access, profile);
    const description = await describeRole(ctx, role);
    const wasOwner = await profileIsOwner(ctx, profile._id);
    // Turn the role off everywhere before it disappears.
    await ctx.db.patch(role._id, { status: "suspended", updatedAt: Date.now() });
    if (wasOwner && !(await profileIsOwner(ctx, profile._id))) await assertOwnersRemain(ctx, profile._id);
    await provisionRole(ctx, role._id, identity.clerkUserId);
    await ctx.db.delete(role._id);
    if (profile.activePartnerRoleId === role._id) await ctx.db.patch(profile._id, { activePartnerRoleId: undefined });
    await auditAccess(ctx, identity, "role.remove", `Removed ${profile.name}'s ${description} role`, { type: "accessProfiles", id: String(profile._id) });
    return null;
  },
});

/** Suspend or reactivate a person everywhere at once. */
export const setPersonStatus = mutation({
  args: { profileId: v.id("accessProfiles"), status: v.union(v.literal("active"), v.literal("suspended")) },
  handler: async (ctx, args) => {
    const { identity, access } = await requireAccessManager(ctx);
    const profile = await ctx.db.get(args.profileId);
    if (!profile) throw new Error("Person not found");
    await assertCanChange(ctx, access, profile);
    if (args.status === "active" && !profile.clerkUserId) throw new Error("This person hasn't accepted their invitation yet.");
    if (args.status === "suspended" && (await profileIsOwner(ctx, profile._id))) await assertOwnersRemain(ctx, profile._id);
    await ctx.db.patch(profile._id, { status: args.status, updatedAt: Date.now() });
    const warnings = await provisionProfile(ctx, profile._id, identity.clerkUserId);
    await auditAccess(ctx, identity, args.status === "suspended" ? "person.suspend" : "person.reactivate", `${args.status === "suspended" ? "Suspended" : "Reactivated"} ${profile.name}`, { type: "accessProfiles", id: String(profile._id) });
    return { warnings };
  },
});

/** Withdraw an unaccepted invitation and forget the person. */
export const deleteInvitation = mutation({
  args: { profileId: v.id("accessProfiles") },
  handler: async (ctx, args) => {
    const { identity, access } = await requireAccessManager(ctx);
    const profile = await ctx.db.get(args.profileId);
    if (!profile) throw new Error("Person not found");
    if (profile.status !== "invited" || profile.clerkUserId) throw new Error("Only unaccepted invitations can be deleted. Suspend people who have signed in.");
    await assertCanChange(ctx, access, profile);
    for (const role of await rolesOf(ctx, profile._id)) {
      await ctx.db.patch(role._id, { status: "suspended" });
      await provisionRole(ctx, role._id, identity.clerkUserId);
      await ctx.db.delete(role._id);
    }
    await ctx.db.delete(profile._id);
    await auditAccess(ctx, identity, "invite.delete", `Withdrew the invitation for ${profile.email}`, { type: "accessProfiles", id: String(profile._id) });
    return null;
  },
});

