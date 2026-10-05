/**
 * ACCESS — roles, packs and permissions.
 *
 * These cover the ways access could widen by mistake: a permission arriving
 * through the wrong kind of role, an admin granting more than they hold, a
 * suspended person keeping a staff row, an invitation claimed by the wrong
 * account. Happy paths are here mostly to prove the guards are not stricter
 * than the old all-or-nothing staff check for people who were already in.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  ADMIN_PERMISSIONS,
  BUILT_IN_PACKS,
  PAGES,
  PERMISSIONS,
  PERMISSION_KEYS,
  expandPermissions,
  roleCanHold,
} from "../lib/access/catalog";
import { computeAccess, resolveAccess } from "../lib/access/resolve";
import { ensureBuiltInPacks } from "../lib/access/provision";
import { resolveViewerScope } from "../insights/scope";

const who = (id: string, email?: string) => ({
  tokenIdentifier: `https://clerk.test|${id}`,
  ...(email ? { email, emailVerified: true } : {}),
});

async function setup() {
  const t = convexTest(schema);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    await ctx.db.insert("adminUsers", { clerkUserId: "owner", email: "owner@ideal.test", name: "Owner", role: "owner", createdAt: now });
    const packs = await ensureBuiltInPacks(ctx);
    const pm = await ctx.db.insert("distributionPartners", {
      name: "Summit PM", type: "program_manager", contactName: "PM", contactEmail: "pm@summit.test", status: "active", createdAt: now, updatedAt: now,
    });
    const agency = await ctx.db.insert("distributionPartners", {
      name: "Harbor Agency", type: "agency", parentId: pm, contactName: "Agency", contactEmail: "agency@harbor.test", status: "active", createdAt: now, updatedAt: now,
    });
    return { packs: Object.fromEntries(packs) as Record<string, Id<"accessPacks">>, pm, agency };
  });
  return { t, ...ids, owner: t.withIdentity(who("owner", "owner@ideal.test")) };
}

/** Invite and claim in one go; returns the new person's profile id. */
async function inviteAndClaim(
  s: Awaited<ReturnType<typeof setup>>,
  person: { id: string; email: string; name?: string },
  roles: any[],
  by = s.owner,
) {
  const invited = await by.action(api.access.invites.invitePerson, {
    email: person.email, name: person.name ?? person.id, roles, sendEmail: false,
  });
  const token = new URL(invited.claimUrl!).searchParams.get("token")!;
  await s.t.withIdentity(who(person.id, person.email)).action(api.access.invites.claimInvitation, { token });
  return invited.profileId;
}

describe("catalog", () => {
  test("every built-in pack only lists permissions its roles can hold", () => {
    for (const pack of BUILT_IN_PACKS) {
      for (const p of pack.permissions) {
        expect(pack.roles.some((r) => roleCanHold(r, p)), `${pack.key}: ${p}`).toBe(true);
      }
    }
  });

  test("implied permissions and page permissions all exist", () => {
    for (const key of PERMISSION_KEYS) {
      const info: { implies?: readonly string[] } = PERMISSIONS[key];
      for (const implied of info.implies ?? []) expect(PERMISSION_KEYS).toContain(implied);
    }
    for (const page of PAGES) for (const p of page.anyOf) expect(PERMISSION_KEYS).toContain(p);
  });

  test("manage implies view", () => {
    expect(expandPermissions(["billing.manage"])).toEqual(["billing.view", "billing.manage"]);
  });

  test("admin permissions never arrive through a partner role, even in a custom pack", () => {
    const result = computeAccess([
      { role: "broker", status: "active", packs: [{ key: "custom", permissions: ["billing.manage", "partner.book"], archived: false }] },
    ]);
    expect(result.permissions).toEqual(["partner.book"]);
    expect(result.isStaff).toBe(false);
  });

  test("the Owner pack grants the whole console only on a staff role", () => {
    expect(computeAccess([{ role: "staff", status: "active", packs: [{ key: "owner", permissions: [], archived: false }] }]).permissions).toEqual(
      expandPermissions(ADMIN_PERMISSIONS),
    );
    expect(computeAccess([{ role: "rep", status: "active", packs: [{ key: "owner", permissions: [], archived: false }] }]).isOwner).toBe(false);
  });
});

describe("people without a profile keep their old access", () => {
  test("owner gets everything; editors lose access management, dev tools and CRM management", async () => {
    const s = await setup();
    await s.t.run(async (ctx) => {
      await ctx.db.insert("adminUsers", { clerkUserId: "ed", email: "ed@ideal.test", name: "Ed", role: "editor", createdAt: 1 });
      await ctx.db.insert("adminUsers", { clerkUserId: "exec", email: "exec@ideal.test", name: "Exec", role: "editor", departments: ["executive"], createdAt: 1 });
    });
    const owner = await s.t.run((ctx) => resolveAccess(ctx, "owner"));
    const editor = await s.t.run((ctx) => resolveAccess(ctx, "ed"));
    const exec = await s.t.run((ctx) => resolveAccess(ctx, "exec"));
    expect(owner.isOwner).toBe(true);
    expect(owner.permissions).toContain("access.manage");
    expect(editor.permissions).toContain("billing.manage");
    expect(editor.permissions).not.toContain("access.manage");
    expect(editor.permissions).not.toContain("system.manage");
    expect(editor.permissions).not.toContain("crm.manage");
    expect(exec.permissions).toContain("crm.manage");
  });

  test("an editor can no longer promote themselves to owner", async () => {
    const s = await setup();
    const adminId = await s.t.run((ctx) => ctx.db.insert("adminUsers", { clerkUserId: "ed", email: "ed@ideal.test", name: "Ed", role: "editor", createdAt: 1 }));
    await expect(s.t.withIdentity(who("ed")).mutation(api.admin.adminUsers.updateRole, { id: adminId, role: "owner" })).rejects.toThrow(/Manage access/);
  });
});

describe("staff packs are enforced on the server", () => {
  test("a support pack reads members but cannot reach billing", async () => {
    const s = await setup();
    await inviteAndClaim(s, { id: "sup", email: "sup@ideal.test" }, [{ role: "staff", packIds: [s.packs.staff_support] }]);
    const support = s.t.withIdentity(who("sup", "sup@ideal.test"));
    const access = await s.t.run((ctx) => resolveAccess(ctx, "sup"));
    expect(access.permissions).toEqual(["members.view", "support.use"]);
    await expect(support.query(api.admin.billing.getAllGroupBillingSummaries, {})).rejects.toThrow(/View billing access required/);
    // Their staff row exists, so older staff-only checks still recognize them.
    expect(await s.t.query(api.admin.adminUsers.isAdmin, { clerkUserId: "sup" })).toBe(true);
  });

  test("suspending a person removes their staff row and every permission", async () => {
    const s = await setup();
    const profileId = await inviteAndClaim(s, { id: "sup", email: "sup@ideal.test" }, [{ role: "staff", packIds: [s.packs.staff_support] }]);
    await s.owner.mutation(api.access.people.setPersonStatus, { profileId, status: "suspended" });
    expect(await s.t.query(api.admin.adminUsers.isAdmin, { clerkUserId: "sup" })).toBe(false);
    expect(await s.t.run((ctx) => ctx.db.query("adminUsers").withIndex("by_clerk_id", (q) => q.eq("clerkUserId", "sup")).first())).toBeNull();
    expect((await s.t.run((ctx) => resolveAccess(ctx, "sup"))).permissions).toEqual([]);
  });
});

describe("granting access cannot escalate", () => {
  test("an access manager cannot hand out permissions they do not hold, or the Owner pack", async () => {
    const s = await setup();
    const manager = await s.owner.mutation(api.access.packs.createPack, {
      name: "Access desk", description: "", roles: ["staff"], permissions: ["access.manage", "members.view"],
    });
    await inviteAndClaim(s, { id: "mgr", email: "mgr@ideal.test" }, [{ role: "staff", packIds: [manager] }]);
    const mgr = s.t.withIdentity(who("mgr", "mgr@ideal.test"));
    await expect(
      mgr.action(api.access.invites.invitePerson, { email: "fin@ideal.test", name: "Fin", roles: [{ role: "staff", packIds: [s.packs.staff_finance] }], sendEmail: false }),
    ).rejects.toThrow(/don't have/);
    await expect(
      mgr.action(api.access.invites.invitePerson, { email: "o2@ideal.test", name: "O2", roles: [{ role: "staff", packIds: [s.packs.owner] }], sendEmail: false }),
    ).rejects.toThrow(/Only an owner/);
    await expect(
      mgr.mutation(api.access.packs.createPack, { name: "Sneaky", description: "", roles: ["staff"], permissions: ["billing.manage"] }),
    ).rejects.toThrow(/don't have/);
    // Partner packs carry no admin permissions, so they can be granted.
    await mgr.action(api.access.invites.invitePerson, {
      email: "rep@harbor.test", name: "Rep", roles: [{ role: "rep", partnerId: s.agency, packIds: [s.packs.partner_agent] }], sendEmail: false,
    });
  });

  test("nobody changes their own access; only owners change owners", async () => {
    const s = await setup();
    await s.owner.mutation(api.access.sync.importBatch, { source: "staff", cursor: null });
    const me = await s.t.run((ctx) => ctx.db.query("accessProfiles").withIndex("by_clerk_id", (q) => q.eq("clerkUserId", "owner")).first());
    await expect(s.owner.mutation(api.access.people.setPersonStatus, { profileId: me!._id, status: "suspended" })).rejects.toThrow(/your own access/);

    const otherId = await inviteAndClaim(s, { id: "o2", email: "o2@ideal.test" }, [{ role: "staff", packIds: [s.packs.owner] }]);
    const other = s.t.withIdentity(who("o2", "o2@ideal.test"));
    await expect(other.mutation(api.access.people.setPersonStatus, { profileId: otherId, status: "suspended" })).rejects.toThrow(/your own access/);
    await other.mutation(api.access.people.setPersonStatus, { profileId: me!._id, status: "suspended" });
    expect((await s.t.run((ctx) => resolveAccess(ctx, "owner"))).permissions).toEqual([]);

    const managerPack = await other.mutation(api.access.packs.createPack, {
      name: "Access desk", description: "", roles: ["staff"], permissions: ["access.manage"],
    });
    await inviteAndClaim(s, { id: "mgr", email: "mgr@ideal.test" }, [{ role: "staff", packIds: [managerPack] }], other);
    await expect(
      s.t.withIdentity(who("mgr")).mutation(api.access.people.setPersonStatus, { profileId: otherId, status: "suspended" }),
    ).rejects.toThrow(/Only an owner/);
  });
});

describe("invitations", () => {
  test("a claim must come from the invited, verified email", async () => {
    const s = await setup();
    const invited = await s.owner.action(api.access.invites.invitePerson, {
      email: "rep@harbor.test", name: "Rep", roles: [{ role: "rep", partnerId: s.agency, packIds: [s.packs.partner_agent] }], sendEmail: false,
    });
    const token = new URL(invited.claimUrl!).searchParams.get("token")!;
    expect((await s.t.query(api.access.invites.getInvitation, { token })).state).toBe("valid");
    await expect(s.t.withIdentity(who("intruder", "intruder@evil.test")).action(api.access.invites.claimInvitation, { token })).rejects.toThrow(/Sign in with/);
    await expect(
      s.t.withIdentity({ ...who("unverified"), email: "rep@harbor.test", emailVerified: false }).action(api.access.invites.claimInvitation, { token }),
    ).rejects.toThrow(/Sign in with/);
    const claimed = await s.t.withIdentity(who("rep", "rep@harbor.test")).action(api.access.invites.claimInvitation, { token });
    expect(claimed.home).toBe("/partner");
    // The link is single-use.
    expect((await s.t.query(api.access.invites.getInvitation, { token })).state).toBe("invalid");
  });

  test("claiming a rep role creates their partner person record and an own-book scope", async () => {
    const s = await setup();
    await inviteAndClaim(s, { id: "rep", email: "rep@harbor.test" }, [{ role: "rep", partnerId: s.agency, packIds: [s.packs.partner_agent] }]);
    const leader = await s.t.run((ctx) => ctx.db.query("partnerLeaders").withIndex("by_clerk_id", (q) => q.eq("clerkUserId", "rep")).first());
    expect(leader).toMatchObject({ partnerId: s.agency, reportScope: "own", portalAccess: true });
    const scope = await s.t.withIdentity(who("rep")).run((ctx) => resolveViewerScope(ctx as any));
    expect(scope.kind).toBe("rep");
    // No downline permission in this pack.
    await expect(s.t.withIdentity(who("rep")).query(api.insights.downline.getDownline, {})).rejects.toThrow(/no insights scope/);
  });
});

describe("one person, several roles", () => {
  test("a broker who is also a rep and runs a Program Manager can switch which role the portal shows", async () => {
    const s = await setup();
    await inviteAndClaim(s, { id: "multi", email: "multi@summit.test" }, [
      { role: "program_manager", partnerId: s.pm, packIds: [s.packs.partner_leadership] },
      { role: "rep", partnerId: s.agency, packIds: [s.packs.partner_agent] },
      { role: "broker", partnerId: s.agency, packIds: [s.packs.partner_agent] },
    ]);
    const multi = s.t.withIdentity(who("multi"));
    const first = await multi.run((ctx) => resolveViewerScope(ctx as any));
    expect(first).toMatchObject({ kind: "partner", partnerId: s.pm });
    expect((first as any).descendantPartnerIds).toEqual([s.agency]);

    const mine = await multi.query(api.access.me.getMyAccess, {});
    const rep = mine!.roles.find((r) => r.role === "rep")!;
    await multi.mutation(api.access.me.setActivePartnerRole, { roleId: rep.roleId });
    expect((await multi.run((ctx) => resolveViewerScope(ctx as any))).kind).toBe("rep");
  });
});

describe("packs", () => {
  test("editing a pack changes what its holders can do at once", async () => {
    const s = await setup();
    await inviteAndClaim(s, { id: "sup", email: "sup@ideal.test" }, [{ role: "staff", packIds: [s.packs.staff_support] }]);
    const pack = await s.t.run((ctx) => ctx.db.get(s.packs.staff_support));
    await s.owner.mutation(api.access.packs.updatePack, {
      packId: s.packs.staff_support, name: pack!.name, description: pack!.description, roles: pack!.roles, permissions: ["members.view", "support.use", "billing.view"],
    });
    expect((await s.t.run((ctx) => resolveAccess(ctx, "sup"))).permissions).toContain("billing.view");
    await s.owner.mutation(api.access.packs.resetPack, { packId: s.packs.staff_support });
    expect((await s.t.run((ctx) => resolveAccess(ctx, "sup"))).permissions).not.toContain("billing.view");
  });

  test("the Owner pack cannot be narrowed", async () => {
    const s = await setup();
    const pack = await s.t.run((ctx) => ctx.db.get(s.packs.owner));
    await expect(
      s.owner.mutation(api.access.packs.updatePack, { packId: s.packs.owner, name: "Owner", description: pack!.description, roles: ["staff"], permissions: ["members.view"] }),
    ).rejects.toThrow(/whole console/);
  });
});

describe("importing existing accounts", () => {
  test("nobody's access changes on import", async () => {
    const s = await setup();
    await s.t.run(async (ctx) => {
      await ctx.db.insert("adminUsers", { clerkUserId: "ed", email: "ed@ideal.test", name: "Ed", role: "editor", createdAt: 1 });
      await ctx.db.insert("partnerLeaders", {
        partnerId: s.agency, name: "Old Rep", email: "old@harbor.test", isPrimary: false, clerkUserId: "oldrep", createdAt: 1, updatedAt: 1,
      });
    });
    const before = await s.t.run(async (ctx) => ({
      owner: await resolveAccess(ctx, "owner"), ed: await resolveAccess(ctx, "ed"), rep: await resolveAccess(ctx, "oldrep"),
    }));
    let step: any = { source: "staff", cursor: null, done: false };
    while (!step.done) step = await s.owner.mutation(api.access.sync.importBatch, { source: step.source, cursor: step.cursor });
    const after = await s.t.run(async (ctx) => ({
      owner: await resolveAccess(ctx, "owner"), ed: await resolveAccess(ctx, "ed"), rep: await resolveAccess(ctx, "oldrep"),
    }));
    for (const key of ["owner", "ed", "rep"] as const) {
      expect(after[key].source).toBe("profile");
      expect(after[key].permissions).toEqual(before[key].permissions);
    }
    expect((await s.owner.query(api.access.sync.syncStatus, {})).notImported).toEqual({ staff: 0, leaders: 0, contacts: 0, grants: 0 });
  });
});

describe("organizations", () => {
  test("an organization role with the uploads pack turns employer upload access on and off", async () => {
    const s = await setup();
    const groupId = await s.t.run(async (ctx) => {
      const now = Date.now();
      const siteId = await ctx.db.insert("sites", {
        slug: "s", name: "S", type: "primary", branding: {}, allowedPlanIds: [],
        enrollmentDefaults: { requireGroupCode: false, requireEligibilityMatch: false, allowSelfEnrollment: true, requirePayment: true, autoActivate: true, collectAddress: false, collectPhone: false, collectEmployeeId: false },
        status: "active", createdAt: now, updatedAt: now,
      });
      const accountId = await ctx.db.insert("accounts", {
        siteId, slug: "a", name: "A", accountType: "employer", billingModel: "per_member", contacts: [], status: "active", createdAt: now, updatedAt: now,
      });
      return await ctx.db.insert("groups", { siteId, accountId, slug: "g", name: "Acme", groupCode: "ACME", status: "active", createdAt: now, updatedAt: now });
    });
    const profileId = await inviteAndClaim(s, { id: "hr", email: "hr@acme.test" }, [{ role: "organization", groupId, packIds: [s.packs.organization_uploads] }]);
    const grant = () => s.t.run((ctx) => ctx.db.query("eligibilityIntakeAccess").withIndex("by_email", (q) => q.eq("email", "hr@acme.test")).first());
    expect(await grant()).toMatchObject({ groupId, active: true, browserEnabled: true });
    await s.owner.mutation(api.access.people.setPersonStatus, { profileId, status: "suspended" });
    expect((await grant())!.active).toBe(false);
  });
});

