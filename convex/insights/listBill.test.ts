/**
 * LIST-BILL TIE-OUT — the test this whole project exists to pass.
 *
 * The dashboard's revenue for an employer group must equal what that employer
 * is actually invoiced. Everything else here guards the two populations that
 * were previously invisible: the member with no Stripe record at all, and the
 * member carrying the decoy $0 bundle that portal provisioning creates.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";

const tok = (id: string) => ({ tokenIdentifier: `https://test.clerk.dev|${id}` });

const RATES = { moCents: 5795, msCents: 8900, mfCents: 12100, rateLabel: "Financial Shield" };

async function seedStaff(t: ReturnType<typeof convexTest>) {
  await t.run(async (ctx) => {
    await ctx.db.insert("adminUsers", {
      clerkUserId: "staff_lb", email: "s@t.dev", name: "Staff",
      role: "owner", createdAt: Date.now(),
    });
  });
}

/**
 * An employer group on payroll deduction, with a mix of household shapes and
 * both provisioning states.
 */
async function seedListBillGroup(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const siteId = await ctx.db.insert("sites", {
      slug: "lb", name: "LB", type: "primary", branding: {}, allowedPlanIds: [],
      enrollmentDefaults: {
        requireGroupCode: false, requireEligibilityMatch: false, allowSelfEnrollment: true,
        requirePayment: true, autoActivate: true, collectAddress: false,
        collectPhone: false, collectEmployeeId: false,
      },
      status: "active", createdAt: now, updatedAt: now,
    });
    const accountId = await ctx.db.insert("accounts", {
      siteId, slug: "soar", name: "Soar Corp", accountType: "employer",
      billingModel: "per_member", contacts: [], status: "active",
      createdAt: now, updatedAt: now,
    });
    const groupId = await ctx.db.insert("groups", {
      siteId, accountId, slug: "soar-g", name: "Soar Group", groupCode: "SOARDO",
      status: "active",
      listBill: { enabled: true, paymentMethod: "check" as const, rates: RATES },
      createdAt: now, updatedAt: now,
    });

    const mk = async (over: Record<string, unknown>) =>
      await ctx.db.insert("memberProfiles", {
        barcode: `BC${Math.random()}`, siteId, accountId, groupId,
        memberRole: "primary", status: "active",
        enrolledAt: now - 86400000, createdAt: now - 86400000, updatedAt: now,
        ...over,
      } as any);

    // 1. Never provisioned — no Clerk account, no bundle. memberType
    //    "eligible", which is exactly what the eligibility pipeline writes.
    const noStripe = await mk({
      memberId: "LB-1", firstName: "Ann", lastName: "Alpha", memberType: "eligible",
    });

    // 2. Provisioned — carries the decoy $0 employer bundle.
    await ctx.db.insert("subscriptionBundles", {
      customerId: "user_lb2", cadence: "monthly", paymentMethod: "ach",
      stripeCustomerId: `employer_listbill_${groupId}`,
      status: "active", currentPeriodStart: now, currentPeriodEnd: now + 30 * 86400000,
      pricingSnapshot: {
        cadence: "monthly", paymentMethod: "ach",
        totalCents: 0, planCount: 1, capturedAt: now,
      },
      createdAt: now, updatedAt: now,
    } as any);
    const provisioned = await mk({
      memberId: "LB-2", firstName: "Bob", lastName: "Beta", memberType: "active",
      customerId: "user_lb2",
    });

    // 3. Per-member premium override — Soar's "Approved EE Cost".
    const overridden = await mk({
      memberId: "LB-3", firstName: "Cal", lastName: "Gamma", memberType: "eligible",
      monthlyPremiumCents: 4250,
    });

    // 4. Household with a spouse -> MS tier.
    const withSpouse = await mk({
      memberId: "LB-4", firstName: "Dee", lastName: "Delta", memberType: "active",
    });
    await mk({
      memberId: "LB-4D", firstName: "Kid", lastName: "Delta", memberType: "active",
      memberRole: "dependent", primaryMemberId: withSpouse, relationship: "spouse",
    });

    return { siteId, accountId, groupId, noStripe, provisioned, overridden, withSpouse };
  });
}

describe("list-bill revenue tie-out", () => {
  test("dashboard revenue equals the employer invoice subtotal", async () => {
    const t = convexTest(schema);
    await seedStaff(t);
    const { groupId } = await seedListBillGroup(t);

    // Generate the real invoice through the production code path.
    const period = new Date().toISOString().slice(0, 7);
    const { invoiceId }: any = await t
      .withIdentity(tok("staff_lb"))
      .mutation(api.admin.listBillInvoices.generateInvoice, {
        groupId, coveragePeriod: period,
      });
    const invoice: any = await t.run(async (ctx) => await ctx.db.get(invoiceId));

    const book: any = await t
      .withIdentity(tok("staff_lb"))
      .query(api.insights.watchlist.getGroupBook, {});
    const row = book.rows.find((r: any) => String(r.groupId) === String(groupId));

    expect(row).toBeDefined();
    // THE assertion: what we show equals what we bill.
    expect(row.mrrCents).toBe(invoice.subtotalCents);
    expect(row.mrrCents).toBeGreaterThan(0);
  });

  test("every covered member appears on the invoice and in the dashboard", async () => {
    const t = convexTest(schema);
    await seedStaff(t);
    const { groupId } = await seedListBillGroup(t);

    const period = new Date().toISOString().slice(0, 7);
    const { invoiceId }: any = await t
      .withIdentity(tok("staff_lb"))
      .mutation(api.admin.listBillInvoices.generateInvoice, {
        groupId, coveragePeriod: period,
      });
    const invoice: any = await t.run(async (ctx) => await ctx.db.get(invoiceId));

    const book: any = await t
      .withIdentity(tok("staff_lb"))
      .query(api.insights.watchlist.getGroupBook, {});
    const row = book.rows.find((r: any) => String(r.groupId) === String(groupId));

    // 4 primaries, all covered. Counting only "active" would have found 2.
    expect(invoice.lines).toHaveLength(4);
    expect(row.activeMembers).toBe(4);
  });

  test("the decoy $0 bundle does not zero a provisioned member", async () => {
    const t = convexTest(schema);
    await seedStaff(t);
    await seedListBillGroup(t);

    const roster: any = await t
      .withIdentity(tok("staff_lb"))
      .query(api.insights.roster.getRoster, {});

    const bob = roster.rows.find((r: any) => r.memberId === "LB-2");
    expect(bob.billingSource).toBe("list_bill");
    expect(bob.mrrCents).toBe(RATES.moCents); // not 0
    expect(bob.employerPays).toBe(true);
  });

  test("a member with no Stripe record at all is priced and visible", async () => {
    const t = convexTest(schema);
    await seedStaff(t);
    await seedListBillGroup(t);

    const roster: any = await t
      .withIdentity(tok("staff_lb"))
      .query(api.insights.roster.getRoster, {});

    const ann = roster.rows.find((r: any) => r.memberId === "LB-1");
    expect(ann).toBeDefined();
    expect(ann.billingSource).toBe("list_bill");
    expect(ann.mrrCents).toBe(RATES.moCents);
  });

  test("per-member premium overrides the group tier rate", async () => {
    const t = convexTest(schema);
    await seedStaff(t);
    await seedListBillGroup(t);

    const roster: any = await t
      .withIdentity(tok("staff_lb"))
      .query(api.insights.roster.getRoster, {});
    const cal = roster.rows.find((r: any) => r.memberId === "LB-3");
    expect(cal.mrrCents).toBe(4250);
  });

  test("tier follows the household", async () => {
    const t = convexTest(schema);
    await seedStaff(t);
    await seedListBillGroup(t);

    const roster: any = await t
      .withIdentity(tok("staff_lb"))
      .query(api.insights.roster.getRoster, {});
    const dee = roster.rows.find((r: any) => r.memberId === "LB-4");
    expect(dee.tier).toBe("MS");
    expect(dee.mrrCents).toBe(RATES.msCents);
  });
});

describe("combined revenue and the mix", () => {
  test("overview MRR sums direct + list-bill, and reports the split", async () => {
    const t = convexTest(schema);
    await seedStaff(t);
    const { siteId, accountId } = await seedListBillGroup(t);

    // Add one self-pay member in a separate, non-list-bill group.
    await t.run(async (ctx) => {
      const now = Date.now();
      const dtcGroup = await ctx.db.insert("groups", {
        siteId, accountId, slug: "dtc", name: "DTC", groupCode: "DTCDO",
        status: "active", createdAt: now, updatedAt: now,
      });
      await ctx.db.insert("subscriptionBundles", {
        customerId: "user_dtc", cadence: "monthly", paymentMethod: "card",
        stripeCustomerId: "cus_real", status: "active",
        currentPeriodStart: now, currentPeriodEnd: now + 30 * 86400000,
        pricingSnapshot: {
          cadence: "monthly", paymentMethod: "card",
          totalCents: 1499, planCount: 1, capturedAt: now,
        },
        createdAt: now, updatedAt: now,
      } as any);
      await ctx.db.insert("memberProfiles", {
        memberId: "DTC-1", barcode: "BCD", siteId, accountId, groupId: dtcGroup,
        firstName: "Eve", lastName: "Epsilon", memberType: "active",
        memberRole: "primary", status: "active", customerId: "user_dtc",
        enrolledAt: now, createdAt: now, updatedAt: now,
      } as any);
    });

    const overview: any = await t
      .withIdentity(tok("staff_lb"))
      .query(api.insights.metrics.getOverview, { days: 30 });

    const listBillExpected = RATES.moCents * 2 + 4250 + RATES.msCents;
    expect(overview.kpis.mrrCents.current).toBe(listBillExpected + 1499);

    // The mix must be visible, not collapsed into the total.
    expect(overview.bySource.list_bill.mrrCents).toBe(listBillExpected);
    expect(overview.bySource.direct.mrrCents).toBe(1499);
    expect(overview.bySource.list_bill.members).toBe(4);
    expect(overview.bySource.direct.members).toBe(1);
  });

  test("a comped member is 'comp', not list-bill, and not counted as paying", async () => {
    const t = convexTest(schema);
    await seedStaff(t);
    const { siteId, accountId } = await seedListBillGroup(t);

    await t.run(async (ctx) => {
      const now = Date.now();
      const g = await ctx.db.insert("groups", {
        siteId, accountId, slug: "comp", name: "Comp", groupCode: "COMPDO",
        status: "active", createdAt: now, updatedAt: now,
      });
      await ctx.db.insert("subscriptionBundles", {
        customerId: "user_comp", cadence: "monthly", paymentMethod: "card",
        stripeCustomerId: "cus_comp", status: "active",
        currentPeriodStart: now, currentPeriodEnd: now + 30 * 86400000,
        pricingSnapshot: {
          cadence: "monthly", paymentMethod: "card",
          totalCents: 0, planCount: 1, capturedAt: now,
        },
        createdAt: now, updatedAt: now,
      } as any);
      await ctx.db.insert("memberProfiles", {
        memberId: "CMP-1", barcode: "BCC", siteId, accountId, groupId: g,
        firstName: "Fay", lastName: "Zeta", memberType: "active",
        memberRole: "primary", status: "active", customerId: "user_comp",
        enrolledAt: now, createdAt: now, updatedAt: now,
      } as any);
    });

    const overview: any = await t
      .withIdentity(tok("staff_lb"))
      .query(api.insights.metrics.getOverview, { days: 30 });

    expect(overview.bySource.comp.members).toBe(1);
    expect(overview.bySource.comp.mrrCents).toBe(0);
    expect(overview.bySource.list_bill.members).toBe(4);
  });
});

describe("rollups match the live path", () => {
  test("a rollup's MRR equals the live overview, with the split recorded", async () => {
    const t = convexTest(schema);
    await seedStaff(t);
    await seedListBillGroup(t);

    const today = new Date().toISOString().slice(0, 10);
    await t.withIdentity(tok("staff_lb")).mutation(api.insights.rollups.rollupDay, { date: today });

    const overview: any = await t
      .withIdentity(tok("staff_lb"))
      .query(api.insights.metrics.getOverview, { days: 30 });

    const row: any = await t.run(async (ctx) =>
      await ctx.db
        .query("insightsDaily")
        .withIndex("by_scope_date", (q) =>
          q.eq("scopeKind", "global").eq("scopeId", "").eq("date", today))
        .first(),
    );

    // Rollup and live must agree, or the trend chart shows a cliff where the
    // two meet.
    expect(row.mrrCents).toBe(overview.kpis.mrrCents.current);
    expect(row.mrrCentsListBill).toBe(RATES.moCents * 2 + 4250 + RATES.msCents);
    expect(row.mrrCentsDirect).toBe(0);
    expect(row.billableMembers).toBe(4);
  });
});

describe("projection safety", () => {
  test("employer cost-file PII does not reach a broker payload", async () => {
    const t = convexTest(schema);
    await seedStaff(t);
    const { groupId } = await seedListBillGroup(t);

    // Attach an agency to the group and give the members employer-file PII.
    await t.run(async (ctx) => {
      const now = Date.now();
      const agencyId = await ctx.db.insert("distributionPartners", {
        name: "Broker Co", type: "agency", contactName: "B", contactEmail: "b@t.dev",
        clerkUserId: "broker_lb", status: "active", createdAt: now, updatedAt: now,
      });
      const leaderId = await ctx.db.insert("partnerLeaders", {
        partnerId: agencyId, name: "Rep", email: "r@t.dev", isPrimary: true,
        createdAt: now, updatedAt: now,
      });
      for (const m of await ctx.db
        .query("memberProfiles")
        .withIndex("by_group", (q) => q.eq("groupId", groupId))
        .collect()) {
        await ctx.db.patch(m._id, {
          attributedRepId: String(leaderId),
          attributedAgencyId: String(agencyId),
          attributionSource: "group",
          // Fields sourced from the employer's census file.
          ssn: "999-11-2222",
          dateOfBirth: "1984-02-02",
          address: { line1: "9 Payroll Way", city: "T", state: "CA", postalCode: "90001", country: "US" },
        } as any);
      }
    });

    const roster: any = await t
      .withIdentity(tok("broker_lb"))
      .query(api.insights.roster.getRoster, {});

    expect(roster.rows.length).toBeGreaterThan(0);
    const wire = JSON.stringify(roster);
    // Asserted on the raw payload, not rendered output.
    expect(wire).not.toContain("999-11-2222");
    expect(wire).not.toContain("1984-02-02");
    expect(wire).not.toContain("Payroll Way");
    // The raw employer cost field is never projected either — the broker sees
    // the resolved monthly rate, which is what their book is worth, not the
    // underlying census column.
    expect(wire).not.toContain("monthlyPremiumCents");
    for (const row of roster.rows) {
      expect(row).not.toHaveProperty("ssn");
      expect(row).not.toHaveProperty("monthlyPremiumCents");
      // ...but they DO get the revenue their book generates.
      expect(row.billingSource).toBe("list_bill");
      expect(row.mrrCents).toBeGreaterThan(0);
    }
  });

  test("a broker sees only their own agency's employer group", async () => {
    const t = convexTest(schema);
    await seedStaff(t);
    const { groupId } = await seedListBillGroup(t);

    await t.run(async (ctx) => {
      const now = Date.now();
      // Agency A owns the group's members.
      const agencyA = await ctx.db.insert("distributionPartners", {
        name: "A Co", type: "agency", contactName: "A", contactEmail: "a@t.dev",
        clerkUserId: "broker_a", status: "active", createdAt: now, updatedAt: now,
      });
      const leaderA = await ctx.db.insert("partnerLeaders", {
        partnerId: agencyA, name: "RepA", email: "ra@t.dev", isPrimary: true,
        createdAt: now, updatedAt: now,
      });
      for (const m of await ctx.db
        .query("memberProfiles")
        .withIndex("by_group", (q) => q.eq("groupId", groupId))
        .collect()) {
        await ctx.db.patch(m._id, {
          attributedRepId: String(leaderA),
          attributedAgencyId: String(agencyA),
        } as any);
      }
      // Agency B is unrelated.
      await ctx.db.insert("distributionPartners", {
        name: "B Co", type: "agency", contactName: "B", contactEmail: "bb@t.dev",
        clerkUserId: "broker_b", status: "active", createdAt: now, updatedAt: now,
      });
    });

    const aRoster: any = await t
      .withIdentity(tok("broker_a")).query(api.insights.roster.getRoster, {});
    const bRoster: any = await t
      .withIdentity(tok("broker_b")).query(api.insights.roster.getRoster, {});
    const bBook: any = await t
      .withIdentity(tok("broker_b")).query(api.insights.watchlist.getGroupBook, {});

    expect(aRoster.total).toBe(4);
    // The employer-billed members must not become visible to an unrelated
    // agency just because they are group-attributed.
    expect(bRoster.total).toBe(0);
    expect(bBook.rows).toHaveLength(0);
  });
});
