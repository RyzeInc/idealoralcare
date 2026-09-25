/**
 * CRM ACCESS CONTROL — the CRM must stay internal-staff-only even though its
 * base guard (requireStaffAdmin) already excludes distribution partners as of
 * the broker-insights migration. These tests pin CRM's OWN boundary
 * independently, so a future change to requireStaffAdmin's semantics (or a
 * call site accidentally using requireAdmin/requirePartnerOrAdmin instead of
 * requireCrmUser) gets caught here rather than assumed from another module's
 * tests.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { requireCrmUser, requireCrmManager } from "./guards";

const tok = (id: string) => ({ tokenIdentifier: `https://test.clerk.dev|${id}` });

describe("requireCrmUser", () => {
  test("an unauthenticated caller is rejected", async () => {
    const t = convexTest(schema);
    await expect(
      t.run(async (ctx) => await requireCrmUser(ctx as any)),
    ).rejects.toThrow(/Authentication required/);
  });

  test("an active distribution partner is rejected, even with a clerkUserId on the row", async () => {
    const t = convexTest(schema);
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("distributionPartners", {
        name: "Agency", type: "agency", contactName: "C", contactEmail: "c@t.dev",
        clerkUserId: "partner_crm", status: "active", createdAt: now, updatedAt: now,
      });
    });

    await expect(
      t.withIdentity(tok("partner_crm")).run(async (ctx) => await requireCrmUser(ctx as any)),
    ).rejects.toThrow(/Admin role required/);
  });

  test("a partnerLeaders row alone (no adminUsers row) is rejected", async () => {
    const t = convexTest(schema);
    await t.run(async (ctx) => {
      const now = Date.now();
      const partnerId = await ctx.db.insert("distributionPartners", {
        name: "Agency", type: "agency", contactName: "C", contactEmail: "c@t.dev",
        status: "active", createdAt: now, updatedAt: now,
      });
      await ctx.db.insert("partnerLeaders", {
        partnerId, name: "Rep", email: "rep@t.dev", isPrimary: true,
        clerkUserId: "leader_crm", createdAt: now, updatedAt: now,
      });
    });

    await expect(
      t.withIdentity(tok("leader_crm")).run(async (ctx) => await requireCrmUser(ctx as any)),
    ).rejects.toThrow(/Admin role required/);
  });

  test("internal staff (editor) pass and are not managers", async () => {
    const t = convexTest(schema);
    await t.run(async (ctx) => {
      await ctx.db.insert("adminUsers", {
        clerkUserId: "staff_editor", email: "e@t.dev", name: "Editor",
        role: "editor", createdAt: Date.now(),
      });
    });

    const identity = await t
      .withIdentity(tok("staff_editor"))
      .run(async (ctx) => await requireCrmUser(ctx as any));

    expect(identity.isManager).toBe(false);
  });

  test("owner passes and is a manager", async () => {
    const t = convexTest(schema);
    await t.run(async (ctx) => {
      await ctx.db.insert("adminUsers", {
        clerkUserId: "staff_owner", email: "o@t.dev", name: "Owner",
        role: "owner", createdAt: Date.now(),
      });
    });

    const identity = await t
      .withIdentity(tok("staff_owner"))
      .run(async (ctx) => await requireCrmUser(ctx as any));

    expect(identity.isManager).toBe(true);
  });

  test("editor with departments including executive is a manager", async () => {
    const t = convexTest(schema);
    await t.run(async (ctx) => {
      await ctx.db.insert("adminUsers", {
        clerkUserId: "staff_exec", email: "x@t.dev", name: "Exec",
        role: "editor", departments: ["executive"], createdAt: Date.now(),
      });
    });

    const identity = await t
      .withIdentity(tok("staff_exec"))
      .run(async (ctx) => await requireCrmUser(ctx as any));

    expect(identity.isManager).toBe(true);
  });

  test("editor with departments NOT including executive stays a non-manager", async () => {
    const t = convexTest(schema);
    await t.run(async (ctx) => {
      await ctx.db.insert("adminUsers", {
        clerkUserId: "staff_sales", email: "s@t.dev", name: "Sales",
        role: "editor", departments: ["sales"], createdAt: Date.now(),
      });
    });

    const identity = await t
      .withIdentity(tok("staff_sales"))
      .run(async (ctx) => await requireCrmUser(ctx as any));

    expect(identity.isManager).toBe(false);
  });
});

describe("requireCrmManager", () => {
  test("rejects a non-manager staff member", async () => {
    const t = convexTest(schema);
    await t.run(async (ctx) => {
      await ctx.db.insert("adminUsers", {
        clerkUserId: "staff_nonmgr", email: "n@t.dev", name: "Non-manager",
        role: "editor", createdAt: Date.now(),
      });
    });

    await expect(
      t.withIdentity(tok("staff_nonmgr")).run(async (ctx) => await requireCrmManager(ctx as any)),
    ).rejects.toThrow(/CRM manager role required/);
  });

  test("rejects an active distribution partner even before the manager check runs", async () => {
    const t = convexTest(schema);
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("distributionPartners", {
        name: "Agency", type: "agency", contactName: "C", contactEmail: "c@t.dev",
        clerkUserId: "partner_mgr", status: "active", createdAt: now, updatedAt: now,
      });
    });

    await expect(
      t.withIdentity(tok("partner_mgr")).run(async (ctx) => await requireCrmManager(ctx as any)),
    ).rejects.toThrow(/Admin role required/);
  });

  test("allows an owner", async () => {
    const t = convexTest(schema);
    await t.run(async (ctx) => {
      await ctx.db.insert("adminUsers", {
        clerkUserId: "staff_owner2", email: "o2@t.dev", name: "Owner",
        role: "owner", createdAt: Date.now(),
      });
    });

    await expect(
      t.withIdentity(tok("staff_owner2")).run(async (ctx) => await requireCrmManager(ctx as any)),
    ).resolves.toBeDefined();
  });
});
