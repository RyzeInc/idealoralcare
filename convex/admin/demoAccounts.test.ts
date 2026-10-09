/**
 * DEMO ACCOUNTS — a demo member has a working login but must never reach a
 * vendor roster, an invoice/statement close, or a commission.
 */

import { describe, test, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

const ADMIN = { tokenIdentifier: "https://test.clerk.dev|demo_admin", subject: "demo_admin" };

async function seed(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const now = Date.now();
    await ctx.db.insert("adminUsers", {
      clerkUserId: "demo_admin", email: "a@t.dev", name: "Admin", role: "owner", createdAt: now,
    });
    const siteId = await ctx.db.insert("sites", {
      slug: "ideal-health", name: "Ideal Health", type: "primary", branding: {}, allowedPlanIds: [],
      enrollmentDefaults: {
        requireGroupCode: false, requireEligibilityMatch: false, allowSelfEnrollment: true,
        requirePayment: true, autoActivate: true, collectAddress: false, collectPhone: false,
        collectEmployeeId: false,
      },
      status: "active", createdAt: now, updatedAt: now,
    });
    const accountId = await ctx.db.insert("accounts", {
      siteId, slug: "individual", name: "Individual", accountType: "individual",
      billingModel: "direct", contacts: [], status: "active", createdAt: now, updatedAt: now,
    });
    const groupId = await ctx.db.insert("groups", {
      siteId, accountId, slug: "default", name: "Individual Enrollment", groupCode: "IDEALDO",
      status: "active", createdAt: now, updatedAt: now,
    });
    const productId = await ctx.db.insert("catalogProducts", {
      slug: "oral-health-individual", name: "Ideal Oral Savings Plan", category: "dental",
      description: "test", inclusions: [], exclusions: [],
      eligibilityRules: { requiresVerification: false, disclosureText: "" },
      activationBehavior: "immediate",
      pricing: { monthlyCardCents: 1499, monthlyACHCents: 1499, annualCardCents: 17988, annualACHCents: 17988 },
      isVisible: true, isFeatured: false, order: 0, createdAt: now, updatedAt: now,
    });
    const member = async (customerId: string, extra: Record<string, unknown> = {}) =>
      ctx.db.insert("memberProfiles", {
        memberId: customerId.toUpperCase(), barcode: customerId, customerId,
        siteId, accountId, groupId, firstName: customerId, lastName: "Test",
        memberType: "active", memberRole: "primary", status: "active",
        createdAt: now, updatedAt: now, ...extra,
      });
    for (const customerId of ["real_1", "demo_1"]) {
      await ctx.db.insert("subscriptionBundles", {
        customerId, cadence: "monthly", paymentMethod: "card", stripeCustomerId: `cus_${customerId}`,
        status: "active", currentPeriodStart: now, currentPeriodEnd: now + 30 * 86400000,
        pricingSnapshot: { cadence: "monthly", paymentMethod: "card", totalCents: 1499, planCount: 1, capturedAt: now },
        createdAt: now, updatedAt: now,
      });
    }
    const realId = await member("real_1");
    const demoId = await member("demo_1", { isDemo: true });
    return { groupId, productId, realId, demoId };
  });
}

describe("demo accounts", () => {
  test("are left off the vendor roster", async () => {
    const t = convexTest(schema);
    const { groupId } = await seed(t);
    const roster = await t.withIdentity(ADMIN).query(api.admin.members.getActiveMembersByGroup, { groupId });
    expect(roster.map((m) => m.customerId)).toEqual(["real_1"]);
  });

  test("are left out of the invoice breakdown that period closes and statements are built from", async () => {
    const t = convexTest(schema);
    await seed(t);
    const r = await t.withIdentity(ADMIN).query(api.admin.invoiceCalculator.getInvoiceBreakdown, {});
    expect(r.grand.individualPrimaryCount).toBe(1);
    expect(r.grand.totals.grossCents).toBe(1499);
  });

  test("never record a commission", async () => {
    const t = convexTest(schema);
    const { demoId } = await seed(t);
    const result = await t.mutation(api.subscriptions.commissions.recordCommissionForCheckout, { serviceSecret: process.env.CONVEX_SERVICE_SECRET,
      brokerValue: "any-rep", memberId: demoId, totalCents: 1499,
    });
    expect(result).toMatchObject({ recorded: false, reason: "demo_member" });
  });

  test("marking a primary flags the household; a dependent can't be flagged alone", async () => {
    const t = convexTest(schema);
    const { realId } = await seed(t);
    const depId = await t.run(async (ctx) => {
      const primary = (await ctx.db.get(realId))!;
      return ctx.db.insert("memberProfiles", {
        memberId: "DEP_1", barcode: "dep1", siteId: primary.siteId, accountId: primary.accountId,
        groupId: primary.groupId, firstName: "Dep", lastName: "Test", memberType: "active",
        memberRole: "dependent", primaryMemberId: realId, status: "active",
        createdAt: Date.now(), updatedAt: Date.now(),
      });
    });
    const admin = t.withIdentity(ADMIN);
    await expect(
      admin.mutation(api.admin.grantFreeAccess.setDemoAccount, { memberProfileId: depId as Id<"memberProfiles">, isDemo: true }),
    ).rejects.toThrow(/primary member/);

    await admin.mutation(api.admin.grantFreeAccess.setDemoAccount, { memberProfileId: realId, isDemo: true });
    const flagged = await t.run(async (ctx) => [await ctx.db.get(realId), await ctx.db.get(depId)]);
    expect(flagged.map((m) => m?.isDemo)).toEqual([true, true]);

    await admin.mutation(api.admin.grantFreeAccess.setDemoAccount, { memberProfileId: realId, isDemo: false });
    const cleared = await t.run(async (ctx) => [await ctx.db.get(realId), await ctx.db.get(depId)]);
    expect(cleared.map((m) => m?.isDemo)).toEqual([undefined, undefined]);
  });

  test("Grant Free Access with the demo box creates a flagged member with an active plan", async () => {
    const t = convexTest(schema);
    const { groupId, productId } = await seed(t);
    const res = await t.withIdentity(ADMIN).mutation(api.admin.grantFreeAccess.grantFreeAccessAndEnroll, {
      clerkUserId: "user_demo_new", email: "demo@getidealoh.com", firstName: "Demo", lastName: "Member",
      groupId, productId, isDemo: true,
    });
    const profile = await t.run(async (ctx) => ctx.db.get(res.memberProfileId));
    expect(profile?.isDemo).toBe(true);
    const bundle = await t.query(api.subscriptions.queries.getCustomerBundlePublic, { serviceSecret: process.env.CONVEX_SERVICE_SECRET, customerId: "user_demo_new" });
    expect(bundle?.status).toBe("active");
    const roster = await t.withIdentity(ADMIN).query(api.admin.members.getActiveMembersByGroup, { groupId });
    expect(roster.map((m) => m.customerId)).not.toContain("user_demo_new");
  });
});
