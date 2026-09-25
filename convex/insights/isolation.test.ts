/**
 * ISOLATION — the tests that matter most.
 *
 * The entire premise of the partner portal is that two brokers looking at the
 * same deployment see different things. These tests seed two unrelated
 * agencies and then call every insights query AS agency A, asserting that
 * agency B's members, revenue, reps and groups are nowhere in the response.
 *
 * They also assert the PII projection on the RAW query result rather than on
 * rendered output — a field stripped by a component is not stripped, it is
 * merely unrendered, and the wire is what an attacker reads.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";

const tok = (id: string) => ({ tokenIdentifier: `https://test.clerk.dev|${id}` });

interface Seeded {
  agencyId: string;
  leaderId: string;
  groupId: any;
  memberIds: string[];
}

/** One agency, one rep, one group, N members — fully attributed and paying. */
async function seedAgency(
  t: ReturnType<typeof convexTest>,
  opts: { name: string; clerkUserId: string; code: string; memberCount: number; priceCents?: number },
): Promise<Seeded> {
  return await t.run(async (ctx) => {
    const now = Date.now();

    const siteId = await ctx.db.insert("sites", {
      slug: `site-${opts.name}`, name: `${opts.name} Site`, type: "primary",
      branding: {}, allowedPlanIds: [],
      enrollmentDefaults: {
        requireGroupCode: false, requireEligibilityMatch: false, allowSelfEnrollment: true,
        requirePayment: true, autoActivate: true, collectAddress: false,
        collectPhone: false, collectEmployeeId: false,
      },
      status: "active", createdAt: now, updatedAt: now,
    });
    const accountId = await ctx.db.insert("accounts", {
      siteId, slug: `acct-${opts.name}`, name: `${opts.name} Account`,
      accountType: "employer", billingModel: "direct", contacts: [],
      status: "active", createdAt: now, updatedAt: now,
    });
    const groupId = await ctx.db.insert("groups", {
      siteId, accountId, slug: `grp-${opts.name}`, name: `${opts.name} Group`,
      groupCode: `GC-${opts.name}`, status: "active", createdAt: now, updatedAt: now,
    });

    const agencyId = await ctx.db.insert("distributionPartners", {
      name: opts.name, type: "agency",
      contactName: `${opts.name} Contact`, contactEmail: `${opts.name}@t.dev`,
      clerkUserId: opts.clerkUserId, overrideRate: 5,
      status: "active", createdAt: now, updatedAt: now,
    });
    const leaderId = await ctx.db.insert("partnerLeaders", {
      partnerId: agencyId, name: `${opts.name} Rep`, email: `rep-${opts.name}@t.dev`,
      isPrimary: true, createdAt: now, updatedAt: now,
    });
    await ctx.db.insert("brokerTrackingCodes", {
      brokerId: String(leaderId), agencyId: String(agencyId), code: opts.code,
      usageCount: 0, status: "active", createdAt: now, updatedAt: now,
    });

    const memberIds: string[] = [];
    for (let i = 0; i < opts.memberCount; i++) {
      const customerId = `cust-${opts.name}-${i}`;
      await ctx.db.insert("subscriptionBundles", {
        customerId, cadence: "monthly", paymentMethod: "card",
        stripeCustomerId: `stripe-${customerId}`,
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: now + 30 * 86400000,
        pricingSnapshot: {
          cadence: "monthly", paymentMethod: "card",
          totalCents: opts.priceCents ?? 1499, planCount: 1, capturedAt: now,
        },
        createdAt: now, updatedAt: now,
      } as any);

      const id = await ctx.db.insert("memberProfiles", {
        memberId: `MBR-${opts.name}-${i}`,
        barcode: `BC${opts.name}${i}`,
        customerId,
        siteId, accountId, groupId,
        firstName: `${opts.name}First${i}`,
        lastName: `${opts.name}Last${i}`,
        email: `${opts.name.toLowerCase()}${i}@member.test`,
        phone: "555-0100",
        // The fields the projector must strip.
        ssn: `999-00-00${i}`,
        dateOfBirth: "1985-04-12",
        address: { line1: "1 Private Road", city: "Town", state: "CA", postalCode: "90001", country: "US" },
        dependents: [{ firstName: "Kid", lastName: "Dependent", dateOfBirth: "2015-01-01", relationship: "child" as const }],
        memberType: "active",
        memberRole: "primary",
        status: "active",
        enrolledAt: now - 86400000,
        attributedRepId: String(leaderId),
        attributedAgencyId: String(agencyId),
        attributedCode: opts.code,
        attributionSource: "enrollment",
        attributionUpdatedAt: now,
        createdAt: now - 86400000,
        updatedAt: now,
      } as any);
      memberIds.push(String(id));
    }

    return { agencyId: String(agencyId), leaderId: String(leaderId), groupId, memberIds };
  });
}

async function seedBoth(t: ReturnType<typeof convexTest>) {
  const a = await seedAgency(t, { name: "Alpha", clerkUserId: "alpha_owner", code: "ALPHA1", memberCount: 3 });
  const b = await seedAgency(t, { name: "Bravo", clerkUserId: "bravo_owner", code: "BRAVO1", memberCount: 5 });
  return { a, b };
}

describe("cross-agency isolation", () => {
  test("the overview counts only the viewer's own members", async () => {
    const t = convexTest(schema);
    await seedBoth(t);

    const alpha: any = await t
      .withIdentity(tok("alpha_owner"))
      .query(api.insights.metrics.getOverview, { days: 30 });
    const bravo: any = await t
      .withIdentity(tok("bravo_owner"))
      .query(api.insights.metrics.getOverview, { days: 30 });

    expect(alpha.kpis.activeMembers.current).toBe(3);
    expect(bravo.kpis.activeMembers.current).toBe(5);
    // 3 x $14.99 vs 5 x $14.99 — neither sees the other's revenue.
    expect(alpha.kpis.mrrCents.current).toBe(3 * 1499);
    expect(bravo.kpis.mrrCents.current).toBe(5 * 1499);
  });

  test("the roster never returns another agency's members", async () => {
    const t = convexTest(schema);
    await seedBoth(t);

    const roster: any = await t
      .withIdentity(tok("alpha_owner"))
      .query(api.insights.roster.getRoster, {});

    expect(roster.total).toBe(3);
    for (const row of roster.rows) {
      expect(row.lastName).toContain("Alpha");
      expect(row.lastName).not.toContain("Bravo");
    }
  });

  test("fetching another agency's member by id returns null", async () => {
    const t = convexTest(schema);
    const { b } = await seedBoth(t);

    // Alpha holds a valid id — it just isn't theirs. This is the IDOR case.
    const stolen: any = await t
      .withIdentity(tok("alpha_owner"))
      .query(api.insights.roster.getMemberDetail, { memberId: b.memberIds[0] as any });

    expect(stolen).toBeNull();
  });

  test("re-scoping to another agency's node is refused", async () => {
    const t = convexTest(schema);
    const { b } = await seedBoth(t);

    const node = await t
      .withIdentity(tok("alpha_owner"))
      .query(api.insights.downline.getScopedNode, { partnerId: b.agencyId });

    expect(node).toBeNull();
  });

  test("the leaderboard lists only the viewer's own reps", async () => {
    const t = convexTest(schema);
    await seedBoth(t);

    const board: any = await t
      .withIdentity(tok("alpha_owner"))
      .query(api.insights.downline.getLeaderboard, {});

    expect(board.rows).toHaveLength(1);
    expect(board.rows[0].name).toBe("Alpha Rep");
  });

  test("the downline tree contains no unrelated agency", async () => {
    const t = convexTest(schema);
    await seedBoth(t);

    const tree: any = await t
      .withIdentity(tok("alpha_owner"))
      .query(api.insights.downline.getDownline, {});

    expect(tree.nodes.map((n: any) => n.name)).toEqual(["Alpha"]);
  });

  test("the group book is scoped", async () => {
    const t = convexTest(schema);
    await seedBoth(t);

    const book: any = await t
      .withIdentity(tok("alpha_owner"))
      .query(api.insights.watchlist.getGroupBook, {});

    expect(book.rows).toHaveLength(1);
    expect(book.rows[0].groupName).toBe("Alpha Group");
  });

  test("an admin sees the whole book", async () => {
    const t = convexTest(schema);
    await seedBoth(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("adminUsers", {
        clerkUserId: "staff", email: "s@t.dev", name: "Staff",
        role: "owner", createdAt: Date.now(),
      });
    });

    const overview: any = await t
      .withIdentity(tok("staff"))
      .query(api.insights.metrics.getOverview, { days: 30 });

    expect(overview.scope.kind).toBe("admin");
    expect(overview.kpis.activeMembers.current).toBe(8);
  });

  test("a user with no partner identity is refused outright", async () => {
    const t = convexTest(schema);
    await seedBoth(t);

    await expect(
      t.withIdentity(tok("random_person")).query(api.insights.metrics.getOverview, { days: 30 }),
    ).rejects.toThrow(/no insights scope/i);
  });
});

describe("PII projection", () => {
  test("broker-scoped rows carry no SSN, DOB, or address", async () => {
    const t = convexTest(schema);
    await seedBoth(t);

    const roster: any = await t
      .withIdentity(tok("alpha_owner"))
      .query(api.insights.roster.getRoster, {});

    // Asserted on the raw wire payload, not on rendered output.
    const serialized = JSON.stringify(roster);
    expect(serialized).not.toContain("999-00-00");
    expect(serialized).not.toContain("1985-04-12");
    expect(serialized).not.toContain("Private Road");

    for (const row of roster.rows) {
      expect(row).not.toHaveProperty("ssn");
      expect(row).not.toHaveProperty("dateOfBirth");
      expect(row).not.toHaveProperty("address");
      expect(row).not.toHaveProperty("dependents");
      // Contact detail the broker legitimately needs is still present.
      expect(row.email).toBeTruthy();
      expect(row.phone).toBeTruthy();
      // Dependents are a count, not a roster of children.
      expect(row.dependentCount).toBe(1);
    }
  });

  test("member detail is projected too, and exposes no raw document", async () => {
    const t = convexTest(schema);
    const { a } = await seedBoth(t);

    const detail: any = await t
      .withIdentity(tok("alpha_owner"))
      .query(api.insights.roster.getMemberDetail, { memberId: a.memberIds[0] as any });

    expect(detail).not.toBeNull();
    expect(detail.raw).toBeNull(); // admins only
    const serialized = JSON.stringify(detail);
    expect(serialized).not.toContain("999-00-00");
    expect(serialized).not.toContain("Private Road");
  });

  test("the export path is projected identically to the table", async () => {
    const t = convexTest(schema);
    await seedBoth(t);

    // An export that bypassed the projector would be the obvious leak.
    const exported: any = await t
      .withIdentity(tok("alpha_owner"))
      .query(api.insights.roster.getRosterForExport, {});

    expect(exported.rows).toHaveLength(3);
    expect(JSON.stringify(exported)).not.toContain("999-00-00");
  });

  test("admins do receive the raw document", async () => {
    const t = convexTest(schema);
    const { a } = await seedBoth(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("adminUsers", {
        clerkUserId: "staff2", email: "s2@t.dev", name: "Staff",
        role: "owner", createdAt: Date.now(),
      });
    });

    const detail: any = await t
      .withIdentity(tok("staff2"))
      .query(api.insights.roster.getMemberDetail, { memberId: a.memberIds[0] as any });

    expect(detail.raw).not.toBeNull();
    expect(detail.raw.ssn).toBe("999-00-000");
  });
});

describe("revenue definitions", () => {
  test("annual plans count toward MRR but not toward the partner share", async () => {
    // The live annual-dispersal gap, pinned so it cannot regress silently in
    // either direction once a pricing decision is made.
    const t = convexTest(schema);
    await seedAgency(t, {
      name: "Annual", clerkUserId: "annual_owner", code: "ANN1",
      memberCount: 2, priceCents: 16499,
    });
    await t.run(async (ctx) => {
      for (const b of await ctx.db.query("subscriptionBundles").collect()) {
        await ctx.db.patch(b._id, { cadence: "annual" });
      }
    });

    const overview: any = await t
      .withIdentity(tok("annual_owner"))
      .query(api.insights.metrics.getOverview, { days: 30 });

    // 16499 / 12 = 1375 per member per month.
    expect(overview.kpis.mrrCents.current).toBe(2 * 1375);
    // ...but the dispersal model does not price them, so no partner share.
    expect(overview.dispersal.partnerVendorCents).toBe(0);
    expect(overview.kpis.unclassifiedPayingMembers).toBe(2);
  });
});
