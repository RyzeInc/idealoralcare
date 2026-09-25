/**
 * COMMISSION LEDGER REPAIR — tests for the write path.
 *
 * The old path wrote a raw tracking-code string into `brokerId` at a hardcoded
 * 15%, producing rows that join to nothing and are worth the wrong amount.
 * These tests pin the three properties that matter now: the broker is resolved
 * by lookup, the rate comes from `commissionRates`, and nothing is written when
 * either is unknown.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";

async function seedRepWithCode(t: ReturnType<typeof convexTest>, code: string) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const agencyId = await ctx.db.insert("distributionPartners", {
      name: "Coastal Agency",
      type: "agency",
      contactName: "C",
      contactEmail: "c@test.dev",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const leaderId = await ctx.db.insert("partnerLeaders", {
      partnerId: agencyId,
      name: "Rep One",
      email: "rep@test.dev",
      isPrimary: true,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("brokerTrackingCodes", {
      brokerId: String(leaderId),
      agencyId: String(agencyId),
      code,
      usageCount: 0,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    return { agencyId, leaderId };
  });
}

async function seedRate(
  t: ReturnType<typeof convexTest>,
  brokerId: string,
  ratePercentage: number,
  extra: Record<string, any> = {},
) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    return await ctx.db.insert("commissionRates", {
      brokerId,
      ratePercentage,
      effectiveFrom: now - 10_000,
      status: "active",
      createdAt: now,
      updatedAt: now,
      ...extra,
    });
  });
}

describe("recordCommissionForCheckout", () => {
  test("resolves a tracking code to a rep id and uses the contracted rate", async () => {
    const t = convexTest(schema);
    const { agencyId, leaderId } = await seedRepWithCode(t, "100001");
    await seedRate(t, String(leaderId), 0.25);

    const result: any = await t.mutation(
      api.subscriptions.commissions.recordCommissionForCheckout,
      { brokerValue: "100001", totalCents: 2000 },
    );

    expect(result.recorded).toBe(true);
    expect(result.brokerId).toBe(String(leaderId));
    expect(result.agencyId).toBe(String(agencyId));
    expect(result.resolvedVia).toBe("tracking_code");

    const row: any = await t.run(async (ctx) => await ctx.db.get(result.payableId));
    // 25% of $20.00 — not the old hardcoded 15%.
    expect(row.amount).toBe(500);
    expect(row.rateApplied).toBe(0.25);
    expect(row.keySpace).toBe("leader_id");
    expect(row.brokerId).toBe(String(leaderId));
  });

  test("a group-specific rate beats the broker's global rate", async () => {
    const t = convexTest(schema);
    const { leaderId } = await seedRepWithCode(t, "100002");
    await seedRate(t, String(leaderId), 0.1);

    const groupId = await t.run(async (ctx) => {
      const now = Date.now();
      const siteId = await ctx.db.insert("sites", {
        slug: "s", name: "S", type: "primary", branding: {}, allowedPlanIds: [],
        enrollmentDefaults: {
          requireGroupCode: false, requireEligibilityMatch: false,
          allowSelfEnrollment: true, requirePayment: true, autoActivate: true,
          collectAddress: false, collectPhone: false, collectEmployeeId: false,
        },
        status: "active", createdAt: now, updatedAt: now,
      });
      const accountId = await ctx.db.insert("accounts", {
        siteId, slug: "a", name: "A", accountType: "employer", billingModel: "direct",
        contacts: [], status: "active", createdAt: now, updatedAt: now,
      });
      return await ctx.db.insert("groups", {
        siteId, accountId, slug: "g", name: "G", groupCode: "GGG",
        status: "active", createdAt: now, updatedAt: now,
      });
    });
    await seedRate(t, String(leaderId), 0.4, { groupId });

    const result: any = await t.mutation(
      api.subscriptions.commissions.recordCommissionForCheckout,
      { brokerValue: "100002", totalCents: 1000, groupId },
    );

    expect(result.rateApplied).toBe(0.4);
  });

  test("an unresolvable broker writes nothing", async () => {
    const t = convexTest(schema);
    const result: any = await t.mutation(
      api.subscriptions.commissions.recordCommissionForCheckout,
      { brokerValue: "WHO-IS-THIS", totalCents: 1499 },
    );

    expect(result.recorded).toBe(false);
    expect(result.reason).toBe("broker_unresolvable");

    const rows = await t.run(async (ctx) => await ctx.db.query("commissionPayables").collect());
    expect(rows).toHaveLength(0);
  });

  test("a rep with no configured rate writes nothing rather than guessing", async () => {
    const t = convexTest(schema);
    await seedRepWithCode(t, "100003");

    const result: any = await t.mutation(
      api.subscriptions.commissions.recordCommissionForCheckout,
      { brokerValue: "100003", totalCents: 1499 },
    );

    expect(result.recorded).toBe(false);
    expect(result.reason).toBe("no_rate_configured");
    const rows = await t.run(async (ctx) => await ctx.db.query("commissionPayables").collect());
    expect(rows).toHaveLength(0);
  });

  test("an expired rate does not apply", async () => {
    const t = convexTest(schema);
    const { leaderId } = await seedRepWithCode(t, "100004");
    await seedRate(t, String(leaderId), 0.3, { effectiveTo: Date.now() - 1000 });

    const result: any = await t.mutation(
      api.subscriptions.commissions.recordCommissionForCheckout,
      { brokerValue: "100004", totalCents: 1499 },
    );
    expect(result.recorded).toBe(false);
    expect(result.reason).toBe("no_rate_configured");
  });

  test("replaying the same checkout does not pay twice", async () => {
    const t = convexTest(schema);
    const { leaderId } = await seedRepWithCode(t, "100005");
    await seedRate(t, String(leaderId), 0.2);

    const enrollmentSessionId = await t.run(async (ctx) => {
      const now = Date.now();
      const siteId = await ctx.db.insert("sites", {
        slug: "s2", name: "S2", type: "primary", branding: {}, allowedPlanIds: [],
        enrollmentDefaults: {
          requireGroupCode: false, requireEligibilityMatch: false,
          allowSelfEnrollment: true, requirePayment: true, autoActivate: true,
          collectAddress: false, collectPhone: false, collectEmployeeId: false,
        },
        status: "active", createdAt: now, updatedAt: now,
      });
      const accountId = await ctx.db.insert("accounts", {
        siteId, slug: "a2", name: "A2", accountType: "individual",
        billingModel: "direct", contacts: [], status: "active",
        createdAt: now, updatedAt: now,
      });
      const groupId = await ctx.db.insert("groups", {
        siteId, accountId, slug: "g2", name: "G2", groupCode: "GGG2",
        status: "active", createdAt: now, updatedAt: now,
      });
      return await ctx.db.insert("enrollmentSessions", {
        sessionId: "stripe:cs_test_replay", siteId, accountId, groupId,
        enrollmentType: "individual", currentStep: "confirmation", completedSteps: [],
        status: "completed", createdAt: now, updatedAt: now, expiresAt: now + 1000,
      });
    });

    const first: any = await t.mutation(
      api.subscriptions.commissions.recordCommissionForCheckout,
      { brokerValue: "100005", totalCents: 1000, enrollmentSessionId },
    );
    const second: any = await t.mutation(
      api.subscriptions.commissions.recordCommissionForCheckout,
      { brokerValue: "100005", totalCents: 1000, enrollmentSessionId },
    );

    expect(first.recorded).toBe(true);
    expect(second.recorded).toBe(false);
    expect(second.reason).toBe("already_recorded");

    const rows = await t.run(async (ctx) => await ctx.db.query("commissionPayables").collect());
    expect(rows).toHaveLength(1);
  });
});
