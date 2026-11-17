/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";
import { ensureBuiltInPacks } from "../lib/access/provision";

const who = (id: string, email: string) => ({ tokenIdentifier: `https://clerk.test|${id}`, email, emailVerified: true });

async function setup() {
  const t = convexTest(schema);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    await ctx.db.insert("adminUsers", { clerkUserId: "owner", email: "owner@ideal.test", name: "Owner", role: "owner", createdAt: now });
    const packs = await ensureBuiltInPacks(ctx);
    const agency = await ctx.db.insert("distributionPartners", {
      name: "Harbor Agency", type: "agency", contactName: "Hal", contactEmail: "hal@harbor.test", overrideRate: 7, agencyCode: "1000", status: "active", createdAt: now, updatedAt: now,
    });
    const leader = await ctx.db.insert("partnerLeaders", { partnerId: agency, name: "Allen Jackson", email: "allen@harbor.test", isPrimary: true, clerkUserId: "user_allen", createdAt: now, updatedAt: now });
    await ctx.db.insert("brokerTrackingCodes", { brokerId: leader, agencyId: agency, code: "100001", slug: "allenjackson01", agencySeqNo: 1, usageCount: 3, status: "active", createdAt: now, updatedAt: now });
    return { agency, leader, linkPack: packs.get("staff_link_manager")! };
  });
  const owner = t.withIdentity(who("owner", "owner@ideal.test"));
  const invited = await owner.action(api.access.invites.invitePerson, {
    email: "mike@ideal.test", name: "Mike", roles: [{ role: "staff", packIds: [ids.linkPack] }], sendEmail: false,
  } as any);
  const mike = t.withIdentity(who("mike", "mike@ideal.test"));
  await mike.action(api.access.invites.claimInvitation, { token: new URL(invited.claimUrl!).searchParams.get("token")! });
  return { t, ...ids, owner, mike };
}

describe("broker links", () => {
  test("the Broker links pack opens only the links screen", async () => {
    const { mike } = await setup();
    const rows = await mike.query(api.admin.partnerLinks.list, {});
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Allen Jackson", ending: "allenjackson01", code: "100001", linkVisits: 3, activeMembers: 0, endedMembers: 0, active: true });
    // Nothing internal rides along: no rates, account ids or record ids of people.
    expect(JSON.stringify(rows)).not.toMatch(/user_allen|overrideRate|commission|brokerId|agencyId/);

    await expect(mike.query(api.admin.repCodes.getAllWithRates, {})).rejects.toThrow(/Unauthorized/);
    await expect(mike.query(api.admin.distributionPartners.getAllWithStats, {})).rejects.toThrow(/Unauthorized/);
    await expect(mike.query(api.admin.members.getDashboardStats, {})).rejects.toThrow(/Unauthorized/);
  });

  test("adding someone on their own issues a working link", async () => {
    const { t, mike } = await setup();
    const added = await mike.mutation(api.admin.partnerLinks.add, { holderType: "broker", name: "Dana O'Neil", email: "Dana@Example.com" });
    expect(added.ending).toBe("danaoneil");
    expect(await t.query(api.enrollment.agents.resolveRepLink, { segment: "danaoneil" })).toEqual({ repCode: added.code, productHint: null });
    expect(await t.query(api.enrollment.agents.resolveRepLink, { segment: added.code })).toMatchObject({ repCode: added.code });

    const leader: any = await t.run(async (ctx) => (await ctx.db.query("partnerLeaders").collect()).find((l) => l.email === "dana@example.com"));
    expect(leader).toMatchObject({ name: "Dana O'Neil", isPrimary: true, portalAccess: false });
    expect(leader.inviteToken).toBeUndefined();
  });

  test("a person added under an organization continues its numbering", async () => {
    const { mike, agency } = await setup();
    const added = await mike.mutation(api.admin.partnerLinks.add, { holderType: "rep", name: "Rae Kim", email: "rae@harbor.test", organizationId: agency, landing: "essentials" });
    expect(added.code).toBe("100002");
    const row = (await mike.query(api.admin.partnerLinks.list, {})).find((r) => r.code === "100002")!;
    expect(row).toMatchObject({ name: "Rae Kim", detail: "Harbor Agency", holderType: "rep", landing: "essentials" });
  });

  test("an organization is listed under its own name", async () => {
    const { mike } = await setup();
    const added = await mike.mutation(api.admin.partnerLinks.add, { holderType: "organization", name: "Lakeside Chamber", contactName: "Pat Lee", email: "pat@lakeside.test" });
    expect(added.ending).toBe("lakesidechamber");
    const row = (await mike.query(api.admin.partnerLinks.list, {})).find((r) => r.ending === "lakesidechamber")!;
    expect(row).toMatchObject({ name: "Lakeside Chamber", detail: "Pat Lee" });
  });

  test("endings never collide with pages, codes or each other", async () => {
    const { mike } = await setup();
    await expect(mike.mutation(api.admin.partnerLinks.add, { holderType: "broker", name: "A", email: "a@x.test", ending: "plans" })).rejects.toThrow(/page on the website/);
    await expect(mike.mutation(api.admin.partnerLinks.add, { holderType: "broker", name: "A", email: "a@x.test", ending: "allenjackson01" })).rejects.toThrow(/already someone's link/);
    await expect(mike.mutation(api.admin.partnerLinks.add, { holderType: "broker", name: "A", email: "a@x.test", ending: "100001" })).rejects.toThrow(/already someone's link/);
    const first = await mike.mutation(api.admin.partnerLinks.add, { holderType: "broker", name: "Sam Lee", email: "sam1@x.test" });
    const second = await mike.mutation(api.admin.partnerLinks.add, { holderType: "broker", name: "Sam Lee", email: "sam2@x.test" });
    expect([first.ending, second.ending]).toEqual(["samlee", "samlee2"]);
    await expect(mike.mutation(api.admin.partnerLinks.add, { holderType: "broker", name: "Sam Lee", email: "SAM1@x.test" })).rejects.toThrow(/already has a link/);
  });

  test("turning a link off stops it resolving and turning it on restores it", async () => {
    const { t, mike } = await setup();
    const [row] = await mike.query(api.admin.partnerLinks.list, {});
    await mike.mutation(api.admin.partnerLinks.setActive, { id: row.id, active: false });
    expect(await t.query(api.enrollment.agents.resolveRepLink, { segment: "allenjackson01" })).toBeNull();
    expect(await t.query(api.enrollment.agents.getAgentByRepCode, { code: "100001" })).toBeNull();
    await expect(mike.mutation(api.admin.partnerLinks.add, { holderType: "broker", name: "Allen Jackson", email: "allen@harbor.test" })).rejects.toThrow(/turned off/);
    await mike.mutation(api.admin.partnerLinks.setActive, { id: row.id, active: true });
    expect(await t.query(api.enrollment.agents.resolveRepLink, { segment: "allenjackson01" })).toMatchObject({ repCode: "100001" });
    const audit = await t.run(async (ctx) => (await ctx.db.query("adminAuditLog").collect()).map((a) => a.action));
    expect(audit).toEqual(expect.arrayContaining(["link.turned_off", "link.turned_on"]));
  });

  test("partner-portal users cannot reach the links screen", async () => {
    const { t } = await setup();
    await expect(t.withIdentity(who("user_allen", "allen@harbor.test")).query(api.admin.partnerLinks.list, {})).rejects.toThrow(/Unauthorized/);
    await expect(t.query(api.admin.partnerLinks.list, {})).rejects.toThrow(/Unauthorized/);
  });

  test("active members count memberships on the book, not link visits", async () => {
    const { t, mike, leader } = await setup();
    await t.run(async (ctx) => {
      const now = Date.now();
      const siteId = await ctx.db.insert("sites", {
        slug: "assurevantage", name: "AssureVantage", type: "primary", branding: {}, allowedPlanIds: [],
        enrollmentDefaults: { requireGroupCode: false, requireEligibilityMatch: false, allowSelfEnrollment: true, requirePayment: true, autoActivate: true, collectAddress: false, collectPhone: false, collectEmployeeId: false },
        status: "active", createdAt: now, updatedAt: now,
      } as any);
      const accountId = await ctx.db.insert("accounts", { siteId, slug: "individual", name: "Individual", accountType: "individual", billingModel: "direct", contacts: [], status: "active", createdAt: now, updatedAt: now } as any);
      const groupId = await ctx.db.insert("groups", { siteId, accountId, slug: "default", name: "Individual", groupCode: "AV", status: "active", createdAt: now, updatedAt: now } as any);
      let n = 0;
      const member = (memberType: string, extra: Record<string, unknown> = {}) =>
        ctx.db.insert("memberProfiles", {
          memberId: `M${++n}`, barcode: `b${n}`, siteId, accountId, groupId, firstName: "M", lastName: String(n),
          memberType, memberRole: "primary", status: "active", attributedRepId: String(leader), attributedCode: "100001",
          createdAt: now, updatedAt: now, ...extra,
        } as any);
      const primary = await member("active");
      await member("active", { memberRole: "dependent", primaryMemberId: primary }); // rides on the primary
      await member("eligible");                                                      // employer file: covered
      await member("active", { isDemo: true });                                      // not real business
      await member("terminated");
      await member("inactive");
      await member("lead");                                                          // never covered
      await member("declined");
      await member("active", { attributedCode: undefined });                         // credited by group to the rep
      await member("active", { attributedRepId: "someone_else", attributedCode: "OTHER" });
    });
    const [row] = await mike.query(api.admin.partnerLinks.list, {});
    expect(row).toMatchObject({ activeMembers: 3, endedMembers: 2, linkVisits: 3 });
  });

  test("a requested code like M1 is kept and works as a link", async () => {
    const { t, mike } = await setup();
    const added = await mike.mutation(api.admin.partnerLinks.add, { holderType: "organization", name: "Match One Staffing", contactName: "Gregg Seidner", email: "gregg@matchone.test", code: "m1" });
    expect(added).toMatchObject({ code: "M1", ending: "matchonestaffing" });
    expect(await t.query(api.enrollment.agents.resolveRepLink, { segment: "M1" })).toMatchObject({ repCode: "M1" });
    expect(await t.query(api.enrollment.agents.resolveRepLink, { segment: "matchonestaffing" })).toMatchObject({ repCode: "M1" });
    await expect(mike.mutation(api.admin.partnerLinks.add, { holderType: "broker", name: "B", email: "b@x.test", code: "M1" })).rejects.toThrow(/already in use/);
    await expect(mike.mutation(api.admin.partnerLinks.add, { holderType: "broker", name: "B", email: "b@x.test", code: "allenjackson01" })).rejects.toThrow(/already in use/);
    await expect(mike.mutation(api.admin.partnerLinks.add, { holderType: "broker", name: "B", email: "b@x.test", code: "PLANS" })).rejects.toThrow(/page on the website/);
    await expect(mike.mutation(api.admin.partnerLinks.add, { holderType: "broker", name: "B", email: "b@x.test", code: "X" })).rejects.toThrow(/2 to 20/);
  });
});
