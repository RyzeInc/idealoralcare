/**
 * AUTH GUARD FLIP (C11)
 *
 * requireAdmin used to also admit any active distributionPartners row — that
 * fallback is what let a broker into /admin and every whole-book query behind
 * it. It's gone now that /partner exists to receive them. These tests pin the
 * new boundary so it cannot silently widen back out.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";

const tok = (id: string) => ({ tokenIdentifier: `https://test.clerk.dev|${id}` });

describe("requireAdmin / requireStaffAdmin", () => {
  test("an active distribution partner is refused an internal-only query", async () => {
    const t = convexTest(schema);
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("distributionPartners", {
        name: "Agency", type: "agency", contactName: "C", contactEmail: "c@t.dev",
        clerkUserId: "partner_flip", status: "active", createdAt: now, updatedAt: now,
      });
    });

    await expect(
      t.withIdentity(tok("partner_flip")).query(api.admin.members.getDashboardStats, {}),
    ).rejects.toThrow(/Admin role required/);
  });

  test("internal staff still pass", async () => {
    const t = convexTest(schema);
    await t.run(async (ctx) => {
      await ctx.db.insert("adminUsers", {
        clerkUserId: "staff_flip", email: "s@t.dev", name: "Staff",
        role: "owner", createdAt: Date.now(),
      });
    });

    await expect(
      t.withIdentity(tok("staff_flip")).query(api.admin.members.getDashboardStats, {}),
    ).resolves.toBeDefined();
  });

  test("getMyPortal routes a partner to /partner, not /admin", async () => {
    const t = convexTest(schema);
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("distributionPartners", {
        name: "Agency", type: "agency", contactName: "C", contactEmail: "c@t.dev",
        clerkUserId: "partner_route", status: "active", createdAt: now, updatedAt: now,
      });
    });

    const portal: any = await t
      .withIdentity(tok("partner_route"))
      .query(api.admin.adminUsers.getMyPortal, {});
    expect(portal).toEqual({ portal: "partner", role: null });
  });

  test("isAdmin no longer admits a distribution partner", async () => {
    const t = convexTest(schema);
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("distributionPartners", {
        name: "Agency", type: "agency", contactName: "C", contactEmail: "c@t.dev",
        clerkUserId: "partner_isadmin", status: "active", createdAt: now, updatedAt: now,
      });
    });

    const isAdmin = await t.run(
      async (ctx) => await ctx.runQuery(api.admin.adminUsers.isAdmin, { clerkUserId: "partner_isadmin" }),
    );
    expect(isAdmin).toBe(false);
  });
});
