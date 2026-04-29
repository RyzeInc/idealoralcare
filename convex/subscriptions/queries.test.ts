/**
 * SUBSCRIPTION QUERIES — Convex Tests
 *
 * Tests focus on the dependent-aware helpers added to queries.ts:
 * - getMyBundle returns null for dependents (prevents billing UI)
 * - getMyDashboard surfaces role info for dependents
 */
import { describe, test, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";

const getMyBundle = api.subscriptions.queries.getMyBundle;

// ---------------------------------------------------------------------------
// Seed helpers (mirrored from dependents.test.ts)
// ---------------------------------------------------------------------------

async function seedBase(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const now = Date.now();

    const siteId = await ctx.db.insert("sites", {
      slug: "test-site-q",
      name: "Test Site Q",
      type: "primary",
      branding: {},
      allowedPlanIds: [],
      enrollmentDefaults: {
        requireGroupCode: false,
        requireEligibilityMatch: false,
        allowSelfEnrollment: true,
        requirePayment: true,
        autoActivate: true,
        collectAddress: false,
        collectPhone: false,
        collectEmployeeId: false,
      },
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    const accountId = await ctx.db.insert("accounts", {
      siteId,
      slug: "test-account-q",
      name: "Test Account Q",
      accountType: "individual",
      billingModel: "direct",
      contacts: [],
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    const groupId = await ctx.db.insert("groups", {
      siteId,
      accountId,
      slug: "test-group-q",
      name: "Test Group Q",
      groupCode: "IDEALDO",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    return { siteId, accountId, groupId };
  });
}

async function seedPrimary(
  t: ReturnType<typeof convexTest>,
  base: Awaited<ReturnType<typeof seedBase>>,
  clerkUserId: string
) {
  return t.run(async (ctx) => {
    return ctx.db.insert("memberProfiles", {
      memberId: "200000001",
      barcode: "QRY24ABCDE",
      customerId: clerkUserId,
      siteId: base.siteId,
      accountId: base.accountId,
      groupId: base.groupId,
      firstName: "Primary",
      lastName: "User",
      email: "primary@example.com",
      memberType: "active",
      status: "active",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });
}

async function seedDependent(
  t: ReturnType<typeof convexTest>,
  base: Awaited<ReturnType<typeof seedBase>>,
  primaryId: string,
  clerkUserId: string
) {
  return t.run(async (ctx) => {
    return ctx.db.insert("memberProfiles", {
      memberId: "200000002",
      barcode: "QRY24FGHIJ",
      customerId: clerkUserId,
      siteId: base.siteId,
      accountId: base.accountId,
      groupId: base.groupId,
      primaryMemberId: primaryId as any,
      memberRole: "dependent",
      firstName: "Dep",
      lastName: "User",
      email: "dep@example.com",
      memberType: "active",
      status: "active",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("subscriptions/queries", () => {
  let t: ReturnType<typeof convexTest>;

  // -------------------------------------------------------------------------
  // getMyBundle — dependents must NOT get a bundle (billing suppression)
  // -------------------------------------------------------------------------

  describe("getMyBundle", () => {
    test("returns null for a dependent (they don't own subscription bundles)", async () => {
      t = convexTest(schema);
      const base = await seedBase(t);
      const primaryId = await seedPrimary(t, base, "user_primary_q");
      await seedDependent(t, base, primaryId as string, "user_dep_q");

      // Dependents should get null from getMyBundle so billing UI is hidden
      const result = await t
        .withIdentity({ tokenIdentifier: "https://test.clerk.dev|user_dep_q" })
        .query(getMyBundle, {});

      expect(result).toBeNull();
    });

    test("returns null for a primary with no active bundle", async () => {
      t = convexTest(schema);
      const base = await seedBase(t);
      await seedPrimary(t, base, "user_primary_q_nobundle");

      // Primary with no bundle in subscriptionBundles table → null
      const result = await t
        .withIdentity({ tokenIdentifier: "https://test.clerk.dev|user_primary_q_nobundle" })
        .query(getMyBundle, {});

      expect(result).toBeNull();
    });
  });
});
