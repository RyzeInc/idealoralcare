/**
 * ACCESS PACKS — list, create, edit, duplicate, archive and reset.
 *
 * Built-in packs come from convex/lib/access/catalog.ts and can be edited and
 * later reset to their defaults. The Owner pack is fixed: it always means the
 * whole console. Every change re-provisions the roles carrying the pack, so
 * an edit takes effect immediately everywhere.
 */

import { mutation, query } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { v } from "convex/values";
import { BUILT_IN_PACKS, OWNER_PACK_KEY, PERMISSIONS, PERMISSION_KEYS, builtInPack, isPermission, roleCanHold, ROLE_TYPES } from "../lib/access/catalog";
import { roleTypeValidator } from "../lib/access/validators";
import { ensureBuiltInPacks, provisionRole } from "../lib/access/provision";
import { assertCanGrantPermissions, auditAccess, requireAccessManager } from "../lib/access/manage";

const catalogOrder = (key: string) => {
  const index = BUILT_IN_PACKS.findIndex((pack) => pack.key === key);
  return index === -1 ? BUILT_IN_PACKS.length : index;
};

function sameSet(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((x) => b.includes(x));
}

export const listPacks = query({
  args: {},
  handler: async (ctx) => {
    await requireAccessManager(ctx);
    const packs = await ctx.db.query("accessPacks").collect();
    const usage = new Map<string, number>();
    for (const role of await ctx.db.query("accessRoles").collect()) {
      if (role.status !== "active") continue;
      for (const id of role.packIds) usage.set(String(id), (usage.get(String(id)) ?? 0) + 1);
    }
    return packs
      .map((pack) => {
        const def = pack.builtIn ? builtInPack(pack.key) : undefined;
        return {
          ...pack,
          activeRoles: usage.get(String(pack._id)) ?? 0,
          modified: !!def && (!sameSet(def.permissions, pack.permissions) || !sameSet(def.roles, pack.roles) || def.name !== pack.name || def.description !== pack.description),
          locked: pack.key === OWNER_PACK_KEY,
        };
      })
      .sort((a, b) => Number(!!a.archived) - Number(!!b.archived) || catalogOrder(a.key) - catalogOrder(b.key) || a.name.localeCompare(b.name));
  },
});

/** Insert any built-in pack that is missing. Safe to call on every visit. */
export const ensureBuiltIns = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAccessManager(ctx);
    await ensureBuiltInPacks(ctx);
    return null;
  },
});

function cleanPack(args: { name: string; description: string; roles: string[]; permissions: string[] }) {
  const name = args.name.trim();
  if (!name || name.length > 60) throw new Error("Give the pack a name of up to 60 characters.");
  const description = args.description.trim().slice(0, 300);
  const roles = [...new Set(args.roles)].filter((r): r is (typeof ROLE_TYPES)[number] => (ROLE_TYPES as readonly string[]).includes(r));
  if (!roles.length) throw new Error("Choose at least one role this pack is for.");
  const unknown = args.permissions.filter((p) => !isPermission(p));
  if (unknown.length) throw new Error(`Unknown permissions: ${unknown.join(", ")}`);
  // Keep catalog order, and drop permissions none of the pack's roles can hold.
  const permissions = PERMISSION_KEYS.filter((p) => args.permissions.includes(p) && roles.some((r) => roleCanHold(r, p)));
  return { name, description, roles, permissions };
}

async function reprovisionPackHolders(ctx: MutationCtx, packId: Id<"accessPacks">, actor: string) {
  for (const role of await ctx.db.query("accessRoles").collect()) {
    if (role.packIds.includes(packId)) await provisionRole(ctx, role._id, actor);
  }
}

const packFields = {
  name: v.string(),
  description: v.string(),
  roles: v.array(roleTypeValidator),
  permissions: v.array(v.string()),
};

export const createPack = mutation({
  args: packFields,
  handler: async (ctx, args) => {
    const { identity, access } = await requireAccessManager(ctx);
    const pack = cleanPack(args);
    assertCanGrantPermissions(access, pack.permissions, `"${pack.name}"`);
    const now = Date.now();
    const key = `custom_${pack.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 30)}_${now.toString(36)}`;
    const id = await ctx.db.insert("accessPacks", {
      key,
      ...pack,
      builtIn: false,
      createdBy: identity.clerkUserId,
      updatedBy: identity.clerkUserId,
      createdAt: now,
      updatedAt: now,
    });
    await auditAccess(ctx, identity, "pack.create", `Created access pack "${pack.name}"`, { type: "accessPacks", id: String(id) }, pack);
    return id;
  },
});

export const updatePack = mutation({
  args: { packId: v.id("accessPacks"), ...packFields },
  handler: async (ctx, args) => {
    const { identity, access } = await requireAccessManager(ctx);
    const existing = await ctx.db.get(args.packId);
    if (!existing) throw new Error("Pack not found");
    const next = cleanPack(args);
    if (existing.key === OWNER_PACK_KEY) {
      if (!sameSet(next.permissions, existing.permissions) || !sameSet(next.roles, existing.roles)) {
        throw new Error("The Owner pack always grants the whole console. Use another pack for narrower access.");
      }
    }
    const added = next.permissions.filter((p) => !existing.permissions.includes(p));
    assertCanGrantPermissions(access, added, `those permissions`);
    const beyondActor = existing.permissions.some(
      (p) => isPermission(p) && PERMISSIONS[p].portal === "admin" && !access.permissions.includes(p),
    );
    if (!access.isOwner && beyondActor) {
      throw new Error("You can't edit a pack that includes permissions you don't have.");
    }
    await ctx.db.patch(args.packId, { ...next, updatedBy: identity.clerkUserId, updatedAt: Date.now() });
    await reprovisionPackHolders(ctx, args.packId, identity.clerkUserId);
    await auditAccess(ctx, identity, "pack.update", `Edited access pack "${next.name}"`, { type: "accessPacks", id: String(args.packId) }, {
      before: { roles: existing.roles, permissions: existing.permissions },
      after: { roles: next.roles, permissions: next.permissions },
    });
    return null;
  },
});

export const duplicatePack = mutation({
  args: { packId: v.id("accessPacks"), name: v.string() },
  handler: async (ctx, args) => {
    const { identity, access } = await requireAccessManager(ctx);
    const source = await ctx.db.get(args.packId);
    if (!source) throw new Error("Pack not found");
    const pack = cleanPack({ name: args.name, description: source.description, roles: source.roles, permissions: source.key === OWNER_PACK_KEY ? [] : source.permissions });
    assertCanGrantPermissions(access, pack.permissions, `"${pack.name}"`);
    const now = Date.now();
    const id = await ctx.db.insert("accessPacks", {
      key: `custom_${pack.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 30)}_${now.toString(36)}`,
      ...pack,
      builtIn: false,
      createdBy: identity.clerkUserId,
      updatedBy: identity.clerkUserId,
      createdAt: now,
      updatedAt: now,
    });
    await auditAccess(ctx, identity, "pack.create", `Copied access pack "${source.name}" as "${pack.name}"`, { type: "accessPacks", id: String(id) });
    return id;
  },
});

/** Archive a custom pack nobody holds. Built-ins are reset instead. */
export const setPackArchived = mutation({
  args: { packId: v.id("accessPacks"), archived: v.boolean() },
  handler: async (ctx, args) => {
    const { identity } = await requireAccessManager(ctx);
    const pack = await ctx.db.get(args.packId);
    if (!pack) throw new Error("Pack not found");
    if (pack.builtIn) throw new Error("Built-in packs can't be archived. Reset or edit it instead.");
    if (args.archived) {
      const inUse = (await ctx.db.query("accessRoles").collect()).some((r) => r.packIds.includes(args.packId));
      if (inUse) throw new Error("Remove this pack from everyone who has it before archiving it.");
    }
    await ctx.db.patch(args.packId, { archived: args.archived, updatedBy: identity.clerkUserId, updatedAt: Date.now() });
    await auditAccess(ctx, identity, args.archived ? "pack.archive" : "pack.restore", `${args.archived ? "Archived" : "Restored"} access pack "${pack.name}"`, { type: "accessPacks", id: String(pack._id) });
    return null;
  },
});

/** Put a built-in pack back to its catalog definition. */
export const resetPack = mutation({
  args: { packId: v.id("accessPacks") },
  handler: async (ctx, args) => {
    const { identity, access } = await requireAccessManager(ctx);
    const pack = await ctx.db.get(args.packId);
    const def = pack?.builtIn ? builtInPack(pack.key) : undefined;
    if (!pack || !def) throw new Error("Only built-in packs can be reset.");
    assertCanGrantPermissions(access, def.permissions.filter((p) => !pack.permissions.includes(p)), `"${def.name}"`);
    await ctx.db.patch(args.packId, {
      name: def.name,
      description: def.description,
      roles: def.roles,
      permissions: def.permissions,
      updatedBy: identity.clerkUserId,
      updatedAt: Date.now(),
    });
    await reprovisionPackHolders(ctx, args.packId, identity.clerkUserId);
    await auditAccess(ctx, identity, "pack.reset", `Reset access pack "${def.name}" to its default`, { type: "accessPacks", id: String(pack._id) });
    return null;
  },
});

export type PackRow = Doc<"accessPacks"> & { activeRoles: number; modified: boolean; locked: boolean };
