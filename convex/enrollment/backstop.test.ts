/**
 * DTC BACKSTOP + ATTRIBUTION STAMP
 *
 * A direct-to-consumer checkout never runs the enrollment wizard, so it used
 * to leave no `enrollmentSessions` row — losing both the funnel record and the
 * rep who sold it. These tests cover the replacement: that the backstop row is
 * created, that a webhook replay reuses it rather than duplicating, and that a
 * member created against it ends up stamped with the right rep.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";
import { createMemberProfile } from "../lib/memberCreation";

async function seedHierarchy(t: ReturnType<typeof convexTest>, opts: { groupBrokerId?: string } = {}) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const siteId = await ctx.db.insert("sites", {
      slug: "nexus", name: "Ideal", type: "primary", branding: {}, allowedPlanIds: [],
      enrollmentDefaults: {
        requireGroupCode: false, requireEligibilityMatch: false, allowSelfEnrollment: true,
        requirePayment: true, autoActivate: true, collectAddress: false,
        collectPhone: false, collectEmployeeId: false,
      },
      status: "active", createdAt: now, updatedAt: now,
    });
    const accountId = await ctx.db.insert("accounts", {
      siteId, slug: "dtc", name: "DTC", accountType: "individual",
      billingModel: "direct", contacts: [], status: "active", createdAt: now, updatedAt: now,
    });
    const groupId = await ctx.db.insert("groups", {
      siteId, accountId, slug: "dtc-group", name: "DTC Group", groupCode: "IDEALDO",
      brokerId: opts.groupBrokerId, status: "active", createdAt: now, updatedAt: now,
    });
    return { siteId, accountId, groupId };
  });
}

async function seedRep(t: ReturnType<typeof convexTest>, code: string) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const agencyId = await ctx.db.insert("distributionPartners", {
      name: "Coastal", type: "agency", contactName: "C", contactEmail: "c@t.dev",
      status: "active", createdAt: now, updatedAt: now,
    });
    const leaderId = await ctx.db.insert("partnerLeaders", {
      partnerId: agencyId, name: "Rep One", email: "r@t.dev", isPrimary: true,
      createdAt: now, updatedAt: now,
    });
    await ctx.db.insert("brokerTrackingCodes", {
      brokerId: String(leaderId), agencyId: String(agencyId), code,
      usageCount: 0, status: "active", createdAt: now, updatedAt: now,
    });
    return { agencyId, leaderId };
  });
}

describe("webhookEnsureEnrollmentSession", () => {
  test("creates a session keyed on the Stripe checkout id, resolving the rep code", async () => {
    const t = convexTest(schema);
    const { siteId, accountId, groupId } = await seedHierarchy(t);
    const { agencyId, leaderId } = await seedRep(t, "100001");

    const res: any = await t.mutation(api.enrollment.sessions.webhookEnsureEnrollmentSession, {
      stripeCheckoutSessionId: "cs_test_123",
      siteId, accountId, groupId, brokerValue: "100001",
    });

    expect(res.created).toBe(true);
    expect(res.sessionId).toBe("stripe:cs_test_123");

    const row: any = await t.run(async (ctx) => await ctx.db.get(res._id));
    expect(row.brokerId).toBe(String(leaderId));
    expect(row.agencyId).toBe(String(agencyId));
    expect(row.brokerTrackingCode).toBe("100001");
  });

  test("a webhook replay reuses the row instead of duplicating", async () => {
    const t = convexTest(schema);
    const { siteId, accountId, groupId } = await seedHierarchy(t);

    const first: any = await t.mutation(api.enrollment.sessions.webhookEnsureEnrollmentSession, {
      stripeCheckoutSessionId: "cs_replay", siteId, accountId, groupId,
    });
    const second: any = await t.mutation(api.enrollment.sessions.webhookEnsureEnrollmentSession, {
      stripeCheckoutSessionId: "cs_replay", siteId, accountId, groupId,
    });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(String(second._id)).toBe(String(first._id));

    const all = await t.run(async (ctx) => await ctx.db.query("enrollmentSessions").collect());
    expect(all).toHaveLength(1);
  });

  test("an unresolvable code is preserved rather than discarded", async () => {
    const t = convexTest(schema);
    const { siteId, accountId, groupId } = await seedHierarchy(t);

    const res: any = await t.mutation(api.enrollment.sessions.webhookEnsureEnrollmentSession, {
      stripeCheckoutSessionId: "cs_unknown", siteId, accountId, groupId,
      brokerValue: "MYSTERY-CODE",
    });

    const row: any = await t.run(async (ctx) => await ctx.db.get(res._id));
    expect(row.brokerId).toBeUndefined();
    // Kept so a later backfill can still resolve it.
    expect(row.brokerTrackingCode).toBe("MYSTERY-CODE");
  });
});

describe("attribution stamp on member creation", () => {
  test("Scenario A: the enrollment session's rep wins", async () => {
    const t = convexTest(schema);
    const { siteId, accountId, groupId } = await seedHierarchy(t);
    const { agencyId, leaderId } = await seedRep(t, "100001");

    const session: any = await t.mutation(
      api.enrollment.sessions.webhookEnsureEnrollmentSession,
      { stripeCheckoutSessionId: "cs_a", siteId, accountId, groupId, brokerValue: "100001" },
    );

    const memberId = await t.run(async (ctx) => {
      const r = await createMemberProfile(ctx as any, {
        groupId, firstName: "Ada", lastName: "L",
        enrollmentSessionId: session._id, memberType: "active",
      });
      return r._id;
    });

    const member: any = await t.run(async (ctx) => await ctx.db.get(memberId));
    expect(member.attributedRepId).toBe(String(leaderId));
    expect(member.attributedAgencyId).toBe(String(agencyId));
    expect(member.attributionSource).toBe("enrollment");
    expect(member.attributionUpdatedAt).toBeTypeOf("number");
  });

  test("Scenario B: with no session, the group's broker deal attributes the member", async () => {
    const t = convexTest(schema);
    const { agencyId, leaderId } = await seedRep(t, "100002");
    const { groupId } = await seedHierarchy(t, { groupBrokerId: String(leaderId) });

    const memberId = await t.run(async (ctx) => {
      const r = await createMemberProfile(ctx as any, {
        groupId, firstName: "Grace", lastName: "H", memberType: "active",
      });
      return r._id;
    });

    const member: any = await t.run(async (ctx) => await ctx.db.get(memberId));
    expect(member.attributedRepId).toBe(String(leaderId));
    expect(member.attributedAgencyId).toBe(String(agencyId));
    expect(member.attributionSource).toBe("group");
  });

  test("with neither, the member is explicitly unattributed", async () => {
    const t = convexTest(schema);
    const { groupId } = await seedHierarchy(t);

    const memberId = await t.run(async (ctx) => {
      const r = await createMemberProfile(ctx as any, {
        groupId, firstName: "No", lastName: "Rep", memberType: "active",
      });
      return r._id;
    });

    const member: any = await t.run(async (ctx) => await ctx.db.get(memberId));
    expect(member.attributedRepId).toBeUndefined();
    expect(member.attributionSource).toBe("none");
  });

  test("a legacy Clerk-style broker id does not crash the resolver", async () => {
    // db.get throws on a malformed id; pre-migration rows still hold Clerk ids.
    const t = convexTest(schema);
    const { groupId } = await seedHierarchy(t, { groupBrokerId: "user_2abcLEGACY" });

    const memberId = await t.run(async (ctx) => {
      const r = await createMemberProfile(ctx as any, {
        groupId, firstName: "Legacy", lastName: "Row", memberType: "active",
      });
      return r._id;
    });

    const member: any = await t.run(async (ctx) => await ctx.db.get(memberId));
    // Attribution is recorded as group-sourced with the raw value retained,
    // rather than the write blowing up.
    expect(member.attributionSource).toBe("group");
    expect(member.attributedRepId).toBe("user_2abcLEGACY");
  });
});
