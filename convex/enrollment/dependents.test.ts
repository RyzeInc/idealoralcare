/**
 * DEPENDENT MANAGEMENT — Convex Function Tests
 *
 * Uses convex-test to run mutations/queries against an in-memory database
 * seeded with the real schema. Each test gets a fresh database instance.
 */
import { describe, test, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";

// Aliases so the test bodies read naturally
const getMyDependents = api.enrollment.dependents.getMyDependents;
const getMyPrimaryMember = api.enrollment.dependents.getMyPrimaryMember;
const getProfileByInviteToken = api.enrollment.dependents.getProfileByInviteToken;
const addDependent = api.enrollment.dependents.addDependent;
const removeDependent = api.enrollment.dependents.removeDependent;
const claimDependentProfile = api.enrollment.dependents.claimDependentProfile;
const resendDependentInvite = api.enrollment.dependents.resendDependentInvite;

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

async function seedBase(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const now = Date.now();

    const siteId = await ctx.db.insert("sites", {
      slug: "test-site",
      name: "Test Site",
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
      slug: "test-account",
      name: "Test Account",
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
      slug: "test-group",
      name: "Test Group",
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
  clerkUserId = "user_primary123"
) {
  return t.run(async (ctx) => {
    const now = Date.now();
    return ctx.db.insert("memberProfiles", {
      memberId: "100000001",
      barcode: "TST24ABCDE",
      customerId: clerkUserId,
      siteId: base.siteId,
      accountId: base.accountId,
      groupId: base.groupId,
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      memberType: "active",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("enrollment/dependents", () => {
  let t: ReturnType<typeof convexTest>;

  // -------------------------------------------------------------------------
  // getMyDependents
  // -------------------------------------------------------------------------

  describe("getMyDependents", () => {
    test("returns empty array for a primary member with no dependents", async () => {
      t = convexTest(schema);
      const base = await seedBase(t);
      await seedPrimary(t, base, "user_primary123");

      const result = await t
        .withIdentity({ tokenIdentifier: "https://test.clerk.dev|user_primary123" })
        .query(getMyDependents, {});

      expect(result).toEqual([]);
    });

    test("returns dependents after addDependent is called", async () => {
      t = convexTest(schema);
      const base = await seedBase(t);
      await seedPrimary(t, base, "user_primary123");

      await t
        .withIdentity({ tokenIdentifier: "https://test.clerk.dev|user_primary123" })
        .mutation(addDependent, {
          firstName: "Kid",
          lastName: "Doe",
          email: "kid@example.com",
          relationship: "child",
        });

      const result = await t
        .withIdentity({ tokenIdentifier: "https://test.clerk.dev|user_primary123" })
        .query(getMyDependents, {});

      expect(result).toHaveLength(1);
      expect(result[0].firstName).toBe("Kid");
      expect(result[0].lastName).toBe("Doe");
      expect(result[0].memberRole).toBe("dependent");
      expect(result[0].inviteStatus).toBe("pending");
      expect(result[0].hasClaimed).toBe(false);
    });

    test("returns empty array when caller is a dependent (not primary)", async () => {
      t = convexTest(schema);
      const base = await seedBase(t);
      const primaryId = await seedPrimary(t, base, "user_primary123");

      // Create a dependent profile directly
      await t.run(async (ctx) => {
        await ctx.db.insert("memberProfiles", {
          memberId: "100000002",
          barcode: "TST24DEFGH",
          customerId: "user_dependent456",
          siteId: base.siteId,
          accountId: base.accountId,
          groupId: base.groupId,
          primaryMemberId: primaryId,
          memberRole: "dependent",
          firstName: "Dep",
          lastName: "Doe",
          email: "dep@example.com",
          memberType: "active",
          status: "active",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const result = await t
        .withIdentity({ tokenIdentifier: "https://test.clerk.dev|user_dependent456" })
        .query(getMyDependents, {});

      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // getMyPrimaryMember
  // -------------------------------------------------------------------------

  describe("getMyPrimaryMember", () => {
    test("returns null when caller is a primary member", async () => {
      t = convexTest(schema);
      const base = await seedBase(t);
      await seedPrimary(t, base, "user_primary123");

      const result = await t
        .withIdentity({ tokenIdentifier: "https://test.clerk.dev|user_primary123" })
        .query(getMyPrimaryMember, {});

      expect(result).toBeNull();
    });

    test("returns primary member info when caller is a dependent", async () => {
      t = convexTest(schema);
      const base = await seedBase(t);
      const primaryId = await seedPrimary(t, base, "user_primary123");

      await t.run(async (ctx) => {
        await ctx.db.insert("memberProfiles", {
          memberId: "100000002",
          barcode: "TST24DEFGH",
          customerId: "user_dependent456",
          siteId: base.siteId,
          accountId: base.accountId,
          groupId: base.groupId,
          primaryMemberId: primaryId,
          memberRole: "dependent",
          firstName: "Kid",
          lastName: "Doe",
          email: "kid@example.com",
          memberType: "active",
          status: "active",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const result = await t
        .withIdentity({ tokenIdentifier: "https://test.clerk.dev|user_dependent456" })
        .query(getMyPrimaryMember, {});

      expect(result).not.toBeNull();
      expect(result?.firstName).toBe("Jane");
      expect(result?.lastName).toBe("Doe");
    });
  });

  // -------------------------------------------------------------------------
  // getProfileByInviteToken
  // -------------------------------------------------------------------------

  describe("getProfileByInviteToken", () => {
    test("returns null for a token that does not exist", async () => {
      t = convexTest(schema);
      await seedBase(t);

      const result = await t.query(getProfileByInviteToken, {
        token: "invalid-token-00000000-0000-0000-0000-000000000000",
      });

      expect(result).toBeNull();
    });

    test("returns safe profile data for a valid pending invite token", async () => {
      t = convexTest(schema);
      const base = await seedBase(t);
      const primaryId = await seedPrimary(t, base, "user_primary123");

      const inviteToken = "test-invite-token-abc123";

      await t.run(async (ctx) => {
        await ctx.db.insert("memberProfiles", {
          memberId: "100000002",
          barcode: "TST24DEFGH",
          siteId: base.siteId,
          accountId: base.accountId,
          groupId: base.groupId,
          primaryMemberId: primaryId,
          memberRole: "dependent",
          inviteToken,
          inviteStatus: "pending",
          invitedEmail: "kid@example.com",
          firstName: "Kid",
          lastName: "Doe",
          email: "kid@example.com",
          relationship: "child",
          memberType: "active",
          status: "active",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const result = await t.query(getProfileByInviteToken, { token: inviteToken });

      expect(result).not.toBeNull();
      expect(result?.firstName).toBe("Kid");
      expect(result?.lastName).toBe("Doe");
      expect(result?.inviteStatus).toBe("pending");
      expect(result?.primaryMemberName).toBe("Jane Doe");
      // Must NOT expose sensitive fields like customerId
      expect((result as any)?.customerId).toBeUndefined();
    });

    test("returns null for an already-claimed invite token", async () => {
      t = convexTest(schema);
      const base = await seedBase(t);
      const primaryId = await seedPrimary(t, base, "user_primary123");

      const inviteToken = "test-invite-token-xyz789";

      await t.run(async (ctx) => {
        await ctx.db.insert("memberProfiles", {
          memberId: "100000002",
          barcode: "TST24DEFGH",
          siteId: base.siteId,
          accountId: base.accountId,
          groupId: base.groupId,
          primaryMemberId: primaryId,
          memberRole: "dependent",
          inviteToken,
          inviteStatus: "claimed",  // Already claimed
          invitedEmail: "kid@example.com",
          firstName: "Kid",
          lastName: "Doe",
          memberType: "active",
          status: "active",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const result = await t.query(getProfileByInviteToken, { token: inviteToken });
      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // addDependent
  // -------------------------------------------------------------------------

  describe("addDependent", () => {
    test("creates a dependent profile with the correct role and fields", async () => {
      t = convexTest(schema);
      const base = await seedBase(t);
      const primaryId = await seedPrimary(t, base, "user_primary123");

      const result = await t
        .withIdentity({ tokenIdentifier: "https://test.clerk.dev|user_primary123" })
        .mutation(addDependent, {
          firstName: "Spouse",
          lastName: "Doe",
          email: "spouse@example.com",
          relationship: "spouse",
        });

      expect(result).toHaveProperty("dependentId");
      expect(result).toHaveProperty("inviteToken");

      // Verify the created profile
      const profile = await t.run(async (ctx) => ctx.db.get(result.dependentId));

      expect(profile?.firstName).toBe("Spouse");
      expect(profile?.lastName).toBe("Doe");
      expect((profile as any).memberRole).toBe("dependent");
      expect((profile as any).primaryMemberId).toBe(primaryId);
      expect((profile as any).inviteStatus).toBe("pending");
      expect((profile as any).inviteToken).toBe(result.inviteToken);
      // Dependent must NOT have a customerId at creation (not yet claimed)
      expect((profile as any).customerId).toBeUndefined();
    });

    test("creates an activity record for the primary member", async () => {
      t = convexTest(schema);
      const base = await seedBase(t);
      const primaryId = await seedPrimary(t, base, "user_primary123");

      await t
        .withIdentity({ tokenIdentifier: "https://test.clerk.dev|user_primary123" })
        .mutation(addDependent, {
          firstName: "Child",
          lastName: "Doe",
          email: "child@example.com",
          relationship: "child",
        });

      const activities = await t.run(async (ctx) => {
        return (ctx.db as any)
          .query("memberActivities")
          .withIndex("by_member", (q: any) => q.eq("memberProfileId", primaryId))
          .collect();
      });

      expect(activities.length).toBeGreaterThan(0);
      const dependentActivity = activities.find(
        (a: any) => a.activityType === "dependent_added"
      );
      expect(dependentActivity).toBeDefined();
    });

    test("throws when the caller has no active member profile", async () => {
      t = convexTest(schema);
      await seedBase(t);
      // No member profile seeded for this user

      await expect(
        t
          .withIdentity({ tokenIdentifier: "https://test.clerk.dev|user_no_profile" })
          .mutation(addDependent, {
            firstName: "Kid",
            lastName: "Doe",
            email: "kid@example.com",
            relationship: "child",
          })
      ).rejects.toThrow("No active member profile");
    });

    test("throws when a dependent tries to add their own dependents", async () => {
      t = convexTest(schema);
      const base = await seedBase(t);
      const primaryId = await seedPrimary(t, base, "user_primary123");

      // Create a dependent with a Clerk ID
      await t.run(async (ctx) => {
        await ctx.db.insert("memberProfiles", {
          memberId: "100000002",
          barcode: "TST24DEFGH",
          customerId: "user_dependent456",
          siteId: base.siteId,
          accountId: base.accountId,
          groupId: base.groupId,
          primaryMemberId: primaryId,
          memberRole: "dependent",
          firstName: "Kid",
          lastName: "Doe",
          email: "kid@example.com",
          memberType: "active",
          status: "active",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await expect(
        t
          .withIdentity({ tokenIdentifier: "https://test.clerk.dev|user_dependent456" })
          .mutation(addDependent, {
            firstName: "Grandkid",
            lastName: "Doe",
            email: "grandkid@example.com",
            relationship: "child",
          })
      ).rejects.toThrow("Dependents cannot add their own dependents");
    });
  });

  // -------------------------------------------------------------------------
  // removeDependent
  // -------------------------------------------------------------------------

  describe("removeDependent", () => {
    async function setupPrimaryWithDependent(base: Awaited<ReturnType<typeof seedBase>>) {
      const primaryId = await seedPrimary(t, base, "user_primary123");

      const dependentId = await t.run(async (ctx) => {
        return ctx.db.insert("memberProfiles", {
          memberId: "100000002",
          barcode: "TST24DEFGH",
          siteId: base.siteId,
          accountId: base.accountId,
          groupId: base.groupId,
          primaryMemberId: primaryId,
          memberRole: "dependent",
          inviteToken: "test-token",
          inviteStatus: "pending",
          invitedEmail: "kid@example.com",
          firstName: "Kid",
          lastName: "Doe",
          email: "kid@example.com",
          memberType: "active",
          status: "active",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      return { primaryId, dependentId };
    }

    test("terminates the dependent profile (soft delete)", async () => {
      t = convexTest(schema);
      const base = await seedBase(t);
      const { dependentId } = await setupPrimaryWithDependent(base);

      await t
        .withIdentity({ tokenIdentifier: "https://test.clerk.dev|user_primary123" })
        .mutation(removeDependent, { dependentProfileId: dependentId });

      const profile = await t.run(async (ctx) => ctx.db.get(dependentId));
      expect(profile?.status).toBe("terminated");
    });

    test("records a dependent_removed activity", async () => {
      t = convexTest(schema);
      const base = await seedBase(t);
      const { primaryId, dependentId } = await setupPrimaryWithDependent(base);

      await t
        .withIdentity({ tokenIdentifier: "https://test.clerk.dev|user_primary123" })
        .mutation(removeDependent, { dependentProfileId: dependentId });

      const activities = await t.run(async (ctx) => {
        return (ctx.db as any)
          .query("memberActivities")
          .withIndex("by_member", (q: any) => q.eq("memberProfileId", primaryId))
          .collect();
      });

      const removeActivity = activities.find(
        (a: any) => a.activityType === "dependent_removed"
      );
      expect(removeActivity).toBeDefined();
    });

    test("throws when a different user tries to remove the dependent", async () => {
      t = convexTest(schema);
      const base = await seedBase(t);
      const { dependentId } = await setupPrimaryWithDependent(base);

      await expect(
        t
          .withIdentity({ tokenIdentifier: "https://test.clerk.dev|user_intruder" })
          .mutation(removeDependent, { dependentProfileId: dependentId })
      ).rejects.toThrow("Unauthorized");
    });
  });

  // -------------------------------------------------------------------------
  // claimDependentProfile
  // -------------------------------------------------------------------------

  describe("claimDependentProfile", () => {
    const INVITE_TOKEN = "claim-test-invite-token-abc";

    async function setupDependentWithToken(base: Awaited<ReturnType<typeof seedBase>>) {
      const primaryId = await seedPrimary(t, base, "user_primary123");

      const dependentId = await t.run(async (ctx) => {
        return ctx.db.insert("memberProfiles", {
          memberId: "100000002",
          barcode: "TST24DEFGH",
          siteId: base.siteId,
          accountId: base.accountId,
          groupId: base.groupId,
          primaryMemberId: primaryId,
          memberRole: "dependent",
          inviteToken: INVITE_TOKEN,
          inviteStatus: "pending",
          invitedEmail: "kid@example.com",
          firstName: "Kid",
          lastName: "Doe",
          memberType: "active",
          status: "active",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      return { primaryId, dependentId };
    }

    test("links the Clerk user ID to the profile and marks it as claimed", async () => {
      t = convexTest(schema);
      const base = await seedBase(t);
      const { dependentId } = await setupDependentWithToken(base);

      await t
        .withIdentity({ tokenIdentifier: "https://test.clerk.dev|user_new_dependent" })
        .mutation(claimDependentProfile, { inviteToken: INVITE_TOKEN });

      const profile = await t.run(async (ctx) => ctx.db.get(dependentId));

      expect((profile as any).customerId).toBe("user_new_dependent");
      expect((profile as any).inviteStatus).toBe("claimed");
      // Token should be cleared after claim
      expect((profile as any).inviteToken).toBeUndefined();
    });

    test("throws when using an invalid token", async () => {
      t = convexTest(schema);
      await seedBase(t);

      await expect(
        t
          .withIdentity({ tokenIdentifier: "https://test.clerk.dev|user_new_dependent" })
          .mutation(claimDependentProfile, { inviteToken: "wrong-token-12345" })
      ).rejects.toThrow("Invalid invite token");
    });

    test("throws when the invite has already been claimed", async () => {
      t = convexTest(schema);
      const base = await seedBase(t);
      await setupDependentWithToken(base);

      // First claim succeeds
      await t
        .withIdentity({ tokenIdentifier: "https://test.clerk.dev|user_new_dependent" })
        .mutation(claimDependentProfile, { inviteToken: INVITE_TOKEN });

      // Second claim should throw (token consumed)
      await expect(
        t
          .withIdentity({ tokenIdentifier: "https://test.clerk.dev|user_another" })
          .mutation(claimDependentProfile, { inviteToken: INVITE_TOKEN })
      ).rejects.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // resendDependentInvite
  // -------------------------------------------------------------------------

  describe("resendDependentInvite", () => {
    async function setupPendingDependent(base: Awaited<ReturnType<typeof seedBase>>) {
      const primaryId = await seedPrimary(t, base, "user_primary123");

      const dependentId = await t.run(async (ctx) => {
        return ctx.db.insert("memberProfiles", {
          memberId: "100000002",
          barcode: "TST24DEFGH",
          siteId: base.siteId,
          accountId: base.accountId,
          groupId: base.groupId,
          primaryMemberId: primaryId,
          memberRole: "dependent",
          inviteToken: "old-token-xyz",
          inviteStatus: "pending",
          invitedEmail: "kid@example.com",
          firstName: "Kid",
          lastName: "Doe",
          memberType: "active",
          status: "active",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      return { primaryId, dependentId };
    }

    test("generates a new invite token (invalidating the old one)", async () => {
      t = convexTest(schema);
      const base = await seedBase(t);
      const { dependentId } = await setupPendingDependent(base);

      const profileBefore = await t.run(async (ctx) => ctx.db.get(dependentId));
      const oldToken = (profileBefore as any).inviteToken;

      const result = await t
        .withIdentity({ tokenIdentifier: "https://test.clerk.dev|user_primary123" })
        .mutation(resendDependentInvite, { dependentProfileId: dependentId });

      expect(result).toHaveProperty("newToken");
      expect(result.newToken).not.toBe(oldToken);

      const profileAfter = await t.run(async (ctx) => ctx.db.get(dependentId));
      expect((profileAfter as any).inviteToken).toBe(result.newToken);
      expect((profileAfter as any).inviteStatus).toBe("pending");
    });

    test("throws when trying to resend an invite for a claimed dependent", async () => {
      t = convexTest(schema);
      const base = await seedBase(t);
      const primaryId = await seedPrimary(t, base, "user_primary123");

      const claimedDependentId = await t.run(async (ctx) => {
        return ctx.db.insert("memberProfiles", {
          memberId: "100000002",
          barcode: "TST24DEFGH",
          customerId: "user_already_claimed",
          siteId: base.siteId,
          accountId: base.accountId,
          groupId: base.groupId,
          primaryMemberId: primaryId,
          memberRole: "dependent",
          inviteStatus: "claimed",
          invitedEmail: "kid@example.com",
          firstName: "Kid",
          lastName: "Doe",
          memberType: "active",
          status: "active",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await expect(
        t
          .withIdentity({ tokenIdentifier: "https://test.clerk.dev|user_primary123" })
          .mutation(resendDependentInvite, {
            dependentProfileId: claimedDependentId,
          })
      ).rejects.toThrow("already claimed");
    });

    test("throws when an unauthorized user tries to resend", async () => {
      t = convexTest(schema);
      const base = await seedBase(t);
      const { dependentId } = await setupPendingDependent(base);

      await expect(
        t
          .withIdentity({ tokenIdentifier: "https://test.clerk.dev|user_intruder" })
          .mutation(resendDependentInvite, { dependentProfileId: dependentId })
      ).rejects.toThrow("Unauthorized");
    });
  });
});
