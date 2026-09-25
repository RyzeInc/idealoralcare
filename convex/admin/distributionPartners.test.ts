/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";

const admin = { tokenIdentifier: "https://test.clerk.dev|admin_1", email: "admin@test.dev" };

async function setup() {
  const t = convexTest(schema);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    await ctx.db.insert("adminUsers", {
      clerkUserId: "admin_1",
      email: "admin@test.dev",
      name: "Admin",
      role: "owner",
      createdAt: now,
    });
    const partnerId = await ctx.db.insert("distributionPartners", {
      name: "Coastal",
      type: "agency",
      contactName: "Jane",
      contactEmail: "jane@coastal.dev",
      contactPhone: "555",
      notes: "old notes",
      overrideRate: 5,
      effectiveDate: "2026-01-01",
      inviteToken: "legacy-secret",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const leaderId = await ctx.db.insert("partnerLeaders", {
      partnerId,
      name: "Jane",
      email: "jane@coastal.dev",
      isPrimary: true,
      inviteToken: "leader-secret",
      inviteStatus: "pending",
      inviteExpiry: now + 86_400_000,
      createdAt: now,
      updatedAt: now,
    });
    return { partnerId, leaderId };
  });
  return { t, ...ids, asAdmin: t.withIdentity(admin) };
}

describe("distributionPartners.update", () => {
  test("blank and null values clear fields, and the audit entry holds only what changed", async () => {
    const { t, partnerId, asAdmin } = await setup();
    await asAdmin.mutation(api.admin.distributionPartners.update, {
      id: partnerId,
      notes: "",
      contactPhone: "",
      overrideRate: null,
      terminationDate: "2026-12-31",
    });
    const partner: any = await t.run(async (ctx) => await ctx.db.get(partnerId));
    expect(partner.notes).toBeUndefined();
    expect(partner.contactPhone).toBeUndefined();
    expect(partner.overrideRate).toBeUndefined();
    expect(partner.terminationDate).toBe("2026-12-31");

    const [entry]: any[] = await t.run(async (ctx) => await ctx.db.query("adminAuditLog").collect());
    expect(entry.action).toBe("partner.updated");
    expect(entry.metadata.before).toEqual({ notes: "old notes", contactPhone: "555", overrideRate: 5, terminationDate: null });
    expect(JSON.stringify(entry.metadata)).not.toContain("legacy-secret");
  });

  test("a termination date before the effective date is refused", async () => {
    const { partnerId, asAdmin } = await setup();
    await expect(
      asAdmin.mutation(api.admin.distributionPartners.update, { id: partnerId, terminationDate: "2025-06-01" }),
    ).rejects.toThrow(/cannot be before/);
  });

  test("a partner with downline cannot be deleted", async () => {
    const { t, partnerId, asAdmin } = await setup();
    await t.run(async (ctx) => {
      await ctx.db.insert("distributionPartners", {
        name: "Harbor", type: "agency", parentId: partnerId, contactName: "H", contactEmail: "h@h.dev",
        status: "active", createdAt: 0, updatedAt: 0,
      });
    });
    await expect(asAdmin.mutation(api.admin.distributionPartners.remove, { id: partnerId })).rejects.toThrow(/downline/);
  });
});

describe("team access", () => {
  test("updateLeader stores the access role and audits the previous one", async () => {
    const { t, leaderId, asAdmin } = await setup();
    await asAdmin.mutation(api.admin.distributionPartners.updateLeader, { leaderId, reportScope: "downline", portalAccess: true, phone: "" });
    const leader: any = await t.run(async (ctx) => await ctx.db.get(leaderId));
    expect(leader.reportScope).toBe("downline");
    expect(leader.phone).toBeUndefined();
    const [entry]: any[] = await t.run(async (ctx) => await ctx.db.query("adminAuditLog").collect());
    expect(entry.metadata.before).toEqual({ portalAccess: true, reportScope: "own" });
  });

  test("the workspace never returns invite tokens", async () => {
    const { partnerId, asAdmin } = await setup();
    const ws: any = await asAdmin.query(api.admin.distributionPartners.getWorkspace, { partnerId });
    expect(JSON.stringify(ws)).not.toContain("secret");
    expect(ws.leaders[0].hasOpenInvite).toBe(true);
  });

  test("the workspace is staff only", async () => {
    const { t, partnerId } = await setup();
    await expect(
      t.withIdentity({ tokenIdentifier: "https://test.clerk.dev|stranger" }).query(api.admin.distributionPartners.getWorkspace, { partnerId }),
    ).rejects.toThrow(/Admin role required/);
  });
});

describe("partner invites", () => {
  test("a team member's invite resolves on the public preview without contact details", async () => {
    const { t } = await setup();
    const preview = await t.query(api.admin.distributionPartners.getByInviteToken, { token: "leader-secret" });
    expect(preview).toEqual({ name: "Coastal", inviteStatus: "pending" });
  });

  test("an invite for someone whose portal access was turned off does not resolve or claim", async () => {
    const { t, leaderId } = await setup();
    await t.run(async (ctx) => await ctx.db.patch(leaderId, { portalAccess: false }));
    expect(await t.query(api.admin.distributionPartners.getByInviteToken, { token: "leader-secret" })).toBeNull();
    await expect(
      t.withIdentity({ tokenIdentifier: "https://test.clerk.dev|jane", email: "jane@coastal.dev" })
        .mutation(api.admin.distributionPartners.claimInvite, { token: "leader-secret" }),
    ).rejects.toThrow(/disabled/);
  });

  test("an invite cannot be claimed by an account with a different email", async () => {
    const { t } = await setup();
    await expect(
      t.withIdentity({ tokenIdentifier: "https://test.clerk.dev|mallory", email: "mallory@evil.dev" })
        .mutation(api.admin.distributionPartners.claimInvite, { token: "leader-secret" }),
    ).rejects.toThrow(/email address this invitation was sent to/);
  });
});
