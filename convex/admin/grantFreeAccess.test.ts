/**
 * The bootstrap paths must not be a way for an ordinary signed-in user to
 * become an admin once the deployment already has one.
 */

import { describe, test, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";

const tok = (id: string) => ({ subject: id, tokenIdentifier: `https://test.clerk.dev|${id}` });

describe("bootstrapFirstAdmin", () => {
  test("a member cannot make themselves admin once an admin exists", async () => {
    const t = convexTest(schema);
    await t.run(async (ctx) => {
      await ctx.db.insert("adminUsers", {
        clerkUserId: "owner_1", email: "o@t.dev", name: "Owner", role: "owner", createdAt: Date.now(),
      });
    });
    await expect(
      t.withIdentity(tok("member_1")).mutation(api.admin.grantFreeAccess.bootstrapFirstAdmin, {}),
    ).rejects.toThrow(/already set up/);
    const admins = await t.run(async (ctx) => ctx.db.query("adminUsers").collect());
    expect(admins.map((a) => a.clerkUserId)).toEqual(["owner_1"]);
  });

  test("the first signed-in user on an empty deployment still becomes owner", async () => {
    const t = convexTest(schema);
    await t.withIdentity(tok("first_user")).mutation(api.admin.grantFreeAccess.bootstrapFirstAdmin, {});
    const admins = await t.run(async (ctx) => ctx.db.query("adminUsers").collect());
    expect(admins).toHaveLength(1);
    expect(admins[0]).toMatchObject({ clerkUserId: "first_user", role: "owner" });
  });
});

describe("grantMeFullAccess", () => {
  test("repairs an existing free grant with a member profile and stays idempotent", async () => {
    const t = convexTest(schema);
    const now = Date.now();
    await t.run(async (ctx) => {
      await ctx.db.insert("adminUsers", {
        clerkUserId: "owner_1", email: "owner@test.dev", name: "Test Owner",
        role: "owner", createdAt: now,
      });
      const siteId = await ctx.db.insert("sites", {
        slug: "ideal-health", name: "Ideal Health", type: "primary", branding: {},
        allowedPlanIds: [], enrollmentDefaults: {
          requireGroupCode: false, requireEligibilityMatch: false, allowSelfEnrollment: true,
          requirePayment: true, autoActivate: true, collectAddress: false,
          collectPhone: false, collectEmployeeId: false,
        },
        status: "active", createdAt: now, updatedAt: now,
      });
      const accountId = await ctx.db.insert("accounts", {
        siteId, slug: "individual", name: "Individual", accountType: "individual",
        billingModel: "direct", contacts: [], status: "active", createdAt: now, updatedAt: now,
      });
      await ctx.db.insert("groups", {
        siteId, accountId, slug: "default", name: "Individual Enrollment",
        groupCode: "IDEALDO", status: "active", createdAt: now, updatedAt: now,
      });
      await ctx.db.insert("catalogProducts", {
        slug: "oral-health-individual", name: "Ideal Oral Savings Plan", category: "dental",
        description: "test", inclusions: [], exclusions: [],
        eligibilityRules: { requiresVerification: false, disclosureText: "" },
        activationBehavior: "immediate", pricing: {
          monthlyCardCents: 1499, monthlyACHCents: 1499,
          annualCardCents: 17988, annualACHCents: 17988,
        },
        isVisible: true, isFeatured: false, order: 0, createdAt: now, updatedAt: now,
      });
      await ctx.db.insert("subscriptionBundles", {
        customerId: "owner_1", cadence: "annual", paymentMethod: "card",
        stripeCustomerId: "free_local_owner_1", status: "active",
        currentPeriodStart: now, currentPeriodEnd: now + 365 * 86400000,
        pricingSnapshot: { cadence: "annual", paymentMethod: "card", totalCents: 0,
          planCount: 1, capturedAt: now },
        createdAt: now, updatedAt: now,
      });
    });

    const owner = t.withIdentity(tok("owner_1"));
    const first = await owner.mutation(api.admin.grantFreeAccess.grantMeFullAccess, {});
    const second = await owner.mutation(api.admin.grantFreeAccess.grantMeFullAccess, {});
    expect(second.bundleId).toBe(first.bundleId);
    expect(second.memberProfileId).toBe(first.memberProfileId);
    expect(second.entitlements).toBe(0);
    const state = await t.run(async (ctx) => ({
      bundles: await ctx.db.query("subscriptionBundles").collect(),
      profiles: await ctx.db.query("memberProfiles").collect(),
      entitlements: await ctx.db.query("entitlements").collect(),
    }));
    expect(state.bundles).toHaveLength(1);
    expect(state.profiles).toHaveLength(1);
    expect(state.profiles[0]).toMatchObject({ customerId: "owner_1", isDemo: true });
    expect(state.entitlements).toHaveLength(1);
    const card = await t.query(api.subscriptions.queries.getMemberCardDataPublic, {
      serviceSecret: process.env.CONVEX_SERVICE_SECRET, customerId: "owner_1",
    });
    expect(card?.memberId).toBeTruthy();
    expect(card?.memberName).toBe("Test Owner");
  });
});
