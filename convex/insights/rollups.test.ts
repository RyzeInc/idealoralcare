/**
 * ROLLUPS — idempotency and scope fan-out.
 *
 * The nightly cron and the manual backfill both call the same writer, so a
 * retry or a re-run must patch rather than duplicate. This is what keeps
 * `insightsDaily` a reliable trend source instead of a table that silently
 * accumulates ghost rows every time a cron is re-triggered.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";

const tok = (id: string) => ({ tokenIdentifier: `https://test.clerk.dev|${id}` });

async function seedStaff(t: ReturnType<typeof convexTest>) {
  await t.run(async (ctx) => {
    await ctx.db.insert("adminUsers", {
      clerkUserId: "staff_rollup", email: "s@t.dev", name: "Staff",
      role: "owner", createdAt: Date.now(),
    });
  });
}

async function seedOneActiveMember(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const siteId = await ctx.db.insert("sites", {
      slug: "s", name: "S", type: "primary", branding: {}, allowedPlanIds: [],
      enrollmentDefaults: {
        requireGroupCode: false, requireEligibilityMatch: false, allowSelfEnrollment: true,
        requirePayment: true, autoActivate: true, collectAddress: false,
        collectPhone: false, collectEmployeeId: false,
      },
      status: "active", createdAt: now, updatedAt: now,
    });
    const accountId = await ctx.db.insert("accounts", {
      siteId, slug: "a", name: "A", accountType: "individual",
      billingModel: "direct", contacts: [], status: "active", createdAt: now, updatedAt: now,
    });
    const groupId = await ctx.db.insert("groups", {
      siteId, accountId, slug: "g", name: "G", groupCode: "GC",
      status: "active", createdAt: now, updatedAt: now,
    });
    await ctx.db.insert("memberProfiles", {
      memberId: "MBR-1", barcode: "BC1", customerId: "cust-1",
      siteId, accountId, groupId,
      firstName: "A", lastName: "B", memberType: "active", memberRole: "primary",
      status: "active", enrolledAt: now, createdAt: now, updatedAt: now,
    } as any);
    return { siteId, accountId, groupId };
  });
}

describe("rollupDay", () => {
  test("re-running the same day patches instead of duplicating", async () => {
    const t = convexTest(schema);
    await seedStaff(t);
    await seedOneActiveMember(t);

    const dateKey = new Date().toISOString().slice(0, 10);

    const first: any = await t
      .withIdentity(tok("staff_rollup"))
      .mutation(api.insights.rollups.rollupDay, { date: dateKey });
    const second: any = await t
      .withIdentity(tok("staff_rollup"))
      .mutation(api.insights.rollups.rollupDay, { date: dateKey });

    expect(first.activeMembers).toBe(1);
    expect(second.activeMembers).toBe(1);

    const rows = await t.run(async (ctx) =>
      await ctx.db
        .query("insightsDaily")
        .withIndex("by_scope_date", (q) => q.eq("scopeKind", "global").eq("scopeId", "").eq("date", dateKey))
        .collect(),
    );
    expect(rows).toHaveLength(1);
  });

  test("rejects a malformed date rather than silently rolling up the wrong day", async () => {
    const t = convexTest(schema);
    await seedStaff(t);

    await expect(
      t.withIdentity(tok("staff_rollup")).mutation(api.insights.rollups.rollupDay, { date: "not-a-date" }),
    ).rejects.toThrow(/YYYY-MM-DD/);
  });

  test("requires staff — a partner cannot trigger a rollup", async () => {
    const t = convexTest(schema);
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("distributionPartners", {
        name: "P", type: "agency", contactName: "C", contactEmail: "c@t.dev",
        clerkUserId: "partner_x", status: "active", createdAt: now, updatedAt: now,
      });
    });

    await expect(
      t.withIdentity(tok("partner_x")).mutation(api.insights.rollups.rollupDay, {
        date: new Date().toISOString().slice(0, 10),
      }),
    ).rejects.toThrow(/Admin role required/);
  });
});
