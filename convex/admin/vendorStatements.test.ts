/**
 * VENDOR STATEMENTS — server tests
 *
 * Covers the two rules the whole module exists to enforce: statements come
 * only from a closed month, and each recipient sees only their own economics.
 * Also pins the lifecycle (issue → remit → paid, void → reissue) and the
 * "an adjustment recorded later does not move an issued document" contract.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

const ADMIN_TOKEN = "https://test.clerk.dev|admin_user_vs";

async function seedAdmin(t: ReturnType<typeof convexTest>) {
  await t.run(async (ctx) => {
    await ctx.db.insert("adminUsers", {
      clerkUserId: "admin_user_vs",
      email: "admin@vs.test",
      name: "VS Admin",
      role: "owner",
      createdAt: Date.now(),
    });
  });
}

function asAdmin(t: ReturnType<typeof convexTest>) {
  return t.withIdentity({ tokenIdentifier: ADMIN_TOKEN });
}

interface World {
  siteId: Id<"sites">;
  accountId: Id<"accounts">;
  groupId: Id<"groups">;
}

async function seedWorld(
  t: ReturnType<typeof convexTest>,
  opts: { groupCode?: string; groupName?: string } = {},
): Promise<World> {
  return t.run(async (ctx) => {
    const now = Date.now();
    const siteId = await ctx.db.insert("sites", {
      slug: `s-${Math.random().toString(36).slice(2)}`,
      name: "VS Site",
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
      slug: `a-${Math.random().toString(36).slice(2)}`,
      name: "VS Account",
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
      slug: `g-${Math.random().toString(36).slice(2)}`,
      name: opts.groupName ?? "Acme Manufacturing",
      groupCode: opts.groupCode ?? "ACMEMFG",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    return { siteId, accountId, groupId };
  });
}

async function seedPrimary(
  t: ReturnType<typeof convexTest>,
  world: World,
  opts: { customerId: string; memberId: string; totalCents: number; createdAt: number },
): Promise<Id<"memberProfiles">> {
  return t.run(async (ctx) => {
    const memberProfileId = await ctx.db.insert("memberProfiles", {
      memberId: opts.memberId,
      barcode: opts.memberId.toUpperCase().padEnd(10, "X").slice(0, 10),
      customerId: opts.customerId,
      siteId: world.siteId,
      accountId: world.accountId,
      groupId: world.groupId,
      memberRole: "primary",
      firstName: "Pat",
      lastName: opts.memberId,
      email: `${opts.customerId}@vs.test`,
      memberType: "active",
      status: "active",
      createdAt: opts.createdAt,
      updatedAt: opts.createdAt,
    });
    await ctx.db.insert("subscriptionBundles", {
      customerId: opts.customerId,
      cadence: "monthly",
      paymentMethod: "card",
      stripeCustomerId: `cus_${opts.customerId}`,
      status: "active",
      currentPeriodStart: opts.createdAt,
      currentPeriodEnd: opts.createdAt + 30 * 86_400_000,
      pricingSnapshot: {
        cadence: "monthly",
        paymentMethod: "card",
        totalCents: opts.totalCents,
        planCount: 1,
        capturedAt: opts.createdAt,
      },
      createdAt: opts.createdAt,
      updatedAt: opts.createdAt,
    });
    return memberProfileId;
  });
}

/** Previous calendar month — the newest month that can legally be closed. */
function previousMonth() {
  const now = new Date();
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const year = prev.getUTCFullYear();
  const month = prev.getUTCMonth() + 1;
  return {
    year,
    month,
    period: `${year}-${String(month).padStart(2, "0")}`,
    midMs: Date.UTC(year, month - 1, 15),
  };
}

/**
 * A rep, their agency, and (optionally) an enrollment session attributing a
 * member to them. Mirrors the Clerk-free ids the real data model uses.
 */
async function seedRep(
  t: ReturnType<typeof convexTest>,
  opts: { name: string; agencyName: string; email?: string },
) {
  return t.run(async (ctx) => {
    const now = Date.now();
    const partnerId = await ctx.db.insert("distributionPartners", {
      name: opts.agencyName,
      type: "agency",
      contactName: opts.name,
      contactEmail: opts.email ?? "rep@vs.test",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const leaderId = await ctx.db.insert("partnerLeaders", {
      partnerId,
      name: opts.name,
      email: opts.email ?? "rep@vs.test",
      isPrimary: true,
      createdAt: now,
      updatedAt: now,
    });
    return { partnerId: String(partnerId), leaderId: String(leaderId) };
  });
}

async function seedEnrollmentSession(
  t: ReturnType<typeof convexTest>,
  world: World,
  opts: {
    memberProfileId: Id<"memberProfiles">;
    brokerId: string;
    agencyId: string;
    trackingCode: string;
  },
) {
  await t.run(async (ctx) => {
    const now = Date.now();
    await ctx.db.insert("enrollmentSessions", {
      sessionId: `sess-${Math.random().toString(36).slice(2)}`,
      memberId: opts.memberProfileId,
      siteId: world.siteId,
      accountId: world.accountId,
      groupId: world.groupId,
      enrollmentType: "individual",
      currentStep: "complete",
      completedSteps: [],
      status: "completed",
      brokerId: opts.brokerId,
      agencyId: opts.agencyId,
      brokerTrackingCode: opts.trackingCode,
      createdAt: now,
      updatedAt: now,
      expiresAt: now + 86_400_000,
    });
  });
}

/** A closed month with one Individual and one Family primary. */
async function seedClosedMonth(t: ReturnType<typeof convexTest>) {
  await seedAdmin(t);
  const world = await seedWorld(t);
  const { year, month, period, midMs } = previousMonth();
  await seedPrimary(t, world, {
    customerId: "solo",
    memberId: "MEM-SOLO",
    totalCents: 1499,
    createdAt: midMs,
  });
  await seedPrimary(t, world, {
    customerId: "house",
    memberId: "MEM-HOUSE",
    totalCents: 2499,
    createdAt: midMs,
  });
  await asAdmin(t).mutation(api.admin.invoiceCalculator.closePeriodManual, {
    year,
    month,
  });
  return { world, period };
}

// ---------------------------------------------------------------------------
// History is frozen
// ---------------------------------------------------------------------------

describe("vendorStatements — source of figures", () => {
  test("refuses a month that was never closed instead of reading today's roster", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    await expect(
      asAdmin(t).query(api.admin.vendorStatements.previewStatement, {
        period: "2020-05",
        vendor: "toothlens",
      }),
    ).rejects.toThrow(/has not been closed/i);
  });

  test("refuses a coverage month that has not finished yet", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const now = new Date();
    const current = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    await expect(
      asAdmin(t).query(api.admin.vendorStatements.previewStatement, {
        period: current,
        vendor: "ryze",
      }),
    ).rejects.toThrow(/has not finished/i);
  });

  test("records the close it was drawn from", async () => {
    const t = convexTest(schema);
    const { period } = await seedClosedMonth(t);
    const { statementId } = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatement,
      { period, vendor: "toothlens" },
    );
    const statement: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId },
    );
    expect(statement.sourcePeriodIds.length).toBeGreaterThan(0);
    expect(statement.sourcePayloadHashes[0]).toMatch(/^[0-9a-f]{64}$/);
    expect(statement.memberDetailAvailable).toBe(true);
  });

  test("coverage window is printed inclusively and ends inside the month", async () => {
    const t = convexTest(schema);
    const { period } = await seedClosedMonth(t);
    const { statementId } = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatement,
      { period, vendor: "ryze" },
    );
    const statement: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId },
    );
    const end = new Date(statement.coverageEnd);
    expect(end.toISOString().slice(0, 7)).toBe(period);
    expect(end.getUTCHours()).toBe(23);
    expect(end.getUTCMinutes()).toBe(59);
  });
});

// ---------------------------------------------------------------------------
// Recipients see only their own economics
// ---------------------------------------------------------------------------

describe("vendorStatements — recipient disclosure", () => {
  test("a flat-fee recipient gets member lines with no group, tier, or retail figures", async () => {
    const t = convexTest(schema);
    const { period } = await seedClosedMonth(t);
    const { statementId } = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatement,
      { period, vendor: "toothlens" },
    );
    const statement: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId },
    );

    expect(statement.showGroups).toBe(false);
    expect(statement.showTier).toBe(false);
    expect(statement.groups).toHaveLength(0);
    expect(statement.memberLines).toHaveLength(2);
    for (const line of statement.memberLines) {
      expect(line.amountCents).toBe(100); // flat, both tiers
      expect(line.groupCode).toBeUndefined();
      expect(line.groupName).toBeUndefined();
      expect(line.rateClass).toBeUndefined();
      expect(line.grossCents).toBeUndefined();
    }

    // Nothing anywhere in the payload names the employer or the retail price.
    const serialized = JSON.stringify(statement);
    expect(serialized).not.toContain("ACMEMFG");
    expect(serialized).not.toContain("Acme Manufacturing");
    expect(serialized).not.toContain("familyPrimaryCount");
    expect(serialized).not.toContain("grossCents");
  });

  test("Ideal Health sees its own rate class, and self-pay members show as direct", async () => {
    const t = convexTest(schema);
    const { period } = await seedClosedMonth(t);
    const { statementId } = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatement,
      { period, vendor: "ideal" },
    );
    const statement: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId },
    );
    expect(statement.showTier).toBe(true);
    expect(
      statement.memberLines.map((l: any) => l.rateClass).sort(),
    ).toEqual(["Family", "Individual"]);
    // Ideal defaults to "list-bill only". The seeded group is not a list-bill
    // group, so its name is withheld and the members read as direct.
    expect(statement.disclosure.groupVisibility).toBe("listBillOnly");
    expect(JSON.stringify(statement)).not.toContain("ACMEMFG");
    expect(statement.memberLines[0].groupName).toBe("Direct enrollment");
    expect(statement.groups.map((g: any) => g.groupName)).toEqual([
      "Direct enrollment",
    ]);
  });

  test("the internal carrier statement carries the full split and the group rollup", async () => {
    const t = convexTest(schema);
    const { period } = await seedClosedMonth(t);
    const { statementId } = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatement,
      { period, vendor: "ryze" },
    );
    const statement: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId },
    );
    expect(statement.showGroups).toBe(true);
    expect(statement.groups[0].groupCode).toBe("ACMEMFG");
    expect(statement.memberLines[0].grossCents).toBeGreaterThan(0);
    expect(statement.memberLines[0].groupCode).toBe("ACMEMFG");
  });
});

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

describe("vendorStatements — generation", () => {
  test("one pass cuts every recipient's statement and re-running is a no-op", async () => {
    const t = convexTest(schema);
    const { period } = await seedClosedMonth(t);

    const first = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatementsForPeriod,
      { period },
    );
    expect(first.generated).toBe(4);
    expect(first.skipped).toBe(0);

    const second = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatementsForPeriod,
      { period },
    );
    expect(second.generated).toBe(0);
    expect(second.skipped).toBe(4);

    const rows = await asAdmin(t).query(api.admin.vendorStatements.listStatements, {
      period,
    });
    expect(rows).toHaveLength(4);
    expect(rows.map((r: any) => r.vendor).sort()).toEqual([
      "careington",
      "ideal",
      "ryze",
      "toothlens",
    ]);
    // Statement numbers are sequential and unique.
    const numbers = rows.map((r: any) => r.statementNumber).sort();
    expect(new Set(numbers).size).toBe(4);
    expect(numbers[3] - numbers[0]).toBe(3);
  });

  test("a month that was never closed burns no statement numbers", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    await expect(
      asAdmin(t).mutation(api.admin.vendorStatements.generateStatementsForPeriod, {
        period: "2020-05",
      }),
    ).rejects.toThrow(/has not been closed/i);
    await t.run(async (ctx) => {
      const counter = await ctx.db
        .query("counters")
        .withIndex("by_name", (q) => q.eq("name", "vendorStatementSeq"))
        .first();
      expect(counter).toBeNull();
    });
  });

  test("periods index reports which recipients are still missing", async () => {
    const t = convexTest(schema);
    const { period } = await seedClosedMonth(t);
    await asAdmin(t).mutation(api.admin.vendorStatements.generateStatement, {
      period,
      vendor: "toothlens",
    });
    const periods: any[] = await asAdmin(t).query(
      api.admin.vendorStatements.listStatementPeriods,
      {},
    );
    const row = periods.find((p) => p.period === period);
    expect(row.statementCount).toBe(1);
    expect(row.missingVendors.sort()).toEqual(["careington", "ideal", "ryze"]);
  });
});

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

describe("vendorStatements — lifecycle", () => {
  test("issue, part-pay, then settle", async () => {
    const t = convexTest(schema);
    const { period } = await seedClosedMonth(t);
    const { statementId } = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatement,
      { period, vendor: "toothlens" },
    );

    // Remittance before issuing is refused — a draft has not been sent.
    await expect(
      asAdmin(t).mutation(api.admin.vendorStatements.recordRemittance, {
        statementId,
        amountCents: 50,
        paymentMethod: "ach",
      }),
    ).rejects.toThrow(/issue the statement/i);

    await asAdmin(t).mutation(api.admin.vendorStatements.issueStatement, {
      statementId,
    });

    const issued: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId },
    );
    expect(issued.status).toBe("issued");
    expect(issued.totalCents).toBe(200); // two primaries × $1.00 flat

    await asAdmin(t).mutation(api.admin.vendorStatements.recordRemittance, {
      statementId,
      amountCents: 120,
      paymentMethod: "ach",
      paymentReference: "TRACE-1",
    });
    const partial: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId },
    );
    expect(partial.status).toBe("partial");
    expect(partial.balanceCents).toBe(80);

    // Overpayment is refused.
    await expect(
      asAdmin(t).mutation(api.admin.vendorStatements.recordRemittance, {
        statementId,
        amountCents: 500,
        paymentMethod: "ach",
      }),
    ).rejects.toThrow(/exceed/i);

    await asAdmin(t).mutation(api.admin.vendorStatements.recordRemittance, {
      statementId,
      amountCents: 80,
      paymentMethod: "ach",
    });
    const paid: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId },
    );
    expect(paid.status).toBe("paid");
    expect(paid.balanceCents).toBe(0);
    expect(paid.paidAt).toBeDefined();
  });

  test("reissue voids the original, links both ways, and blocks un-voiding the replaced one", async () => {
    const t = convexTest(schema);
    const { period } = await seedClosedMonth(t);
    const { statementId } = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatement,
      { period, vendor: "careington" },
    );
    await asAdmin(t).mutation(api.admin.vendorStatements.issueStatement, {
      statementId,
    });

    const { replacementId } = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateReplacementStatement,
      { statementId, reason: "Retro term for one member" },
    );

    const original: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId },
    );
    const replacement: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId: replacementId },
    );
    expect(original.status).toBe("voided");
    expect(original.supersededByNumber).toBe(replacement.statementNumberDisplay);
    expect(replacement.replacesNumber).toBe(original.statementNumberDisplay);
    expect(replacement.status).toBe("draft");

    await expect(
      asAdmin(t).mutation(api.admin.vendorStatements.unvoidStatement, {
        statementId,
      }),
    ).rejects.toThrow(/superseded/i);
  });

  test("a plain void can be undone and restores the prior status", async () => {
    const t = convexTest(schema);
    const { period } = await seedClosedMonth(t);
    const { statementId } = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatement,
      { period, vendor: "ideal" },
    );
    await asAdmin(t).mutation(api.admin.vendorStatements.issueStatement, {
      statementId,
    });
    await asAdmin(t).mutation(api.admin.vendorStatements.voidStatement, {
      statementId,
      reason: "Sent to the wrong contact",
    });
    await asAdmin(t).mutation(api.admin.vendorStatements.unvoidStatement, {
      statementId,
    });
    const restored: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId },
    );
    expect(restored.status).toBe("issued");
  });
});

// ---------------------------------------------------------------------------
// Adjustments
// ---------------------------------------------------------------------------

describe("vendorStatements — adjustments", () => {
  test("an adjustment recorded after issue does not move the document; reissue picks it up", async () => {
    const t = convexTest(schema);
    const { period } = await seedClosedMonth(t);
    const { statementId } = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatement,
      { period, vendor: "toothlens" },
    );
    await asAdmin(t).mutation(api.admin.vendorStatements.issueStatement, {
      statementId,
    });

    const periodId = await t.run(async (ctx) => {
      const row = await ctx.db
        .query("invoicePeriods")
        .withIndex("by_period", (q) => q.eq("period", period))
        .first();
      return row!._id;
    });
    await asAdmin(t).mutation(api.admin.invoiceCalculator.recordAdjustment, {
      periodId,
      reason: "retroactive_term",
      bucket: "toothlens",
      deltaCents: -100,
      notes: "Member termed mid-month",
    });

    const afterAdjustment: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId },
    );
    expect(afterAdjustment.totalCents).toBe(200); // unchanged
    expect(afterAdjustment.adjustments).toHaveLength(0);
    expect(afterAdjustment.unappliedAdjustments).toHaveLength(1);

    const { replacementId } = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateReplacementStatement,
      { statementId, reason: "Fold in the retro term" },
    );
    const replacement: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId: replacementId },
    );
    expect(replacement.adjustmentCents).toBe(-100);
    expect(replacement.totalCents).toBe(100);
    expect(replacement.unappliedAdjustments).toHaveLength(0);
  });

  test("only the recipient's own bucket lands on their statement", async () => {
    const t = convexTest(schema);
    const { period } = await seedClosedMonth(t);
    const periodId = await t.run(async (ctx) => {
      const row = await ctx.db
        .query("invoicePeriods")
        .withIndex("by_period", (q) => q.eq("period", period))
        .first();
      return row!._id;
    });
    await asAdmin(t).mutation(api.admin.invoiceCalculator.recordAdjustment, {
      periodId,
      reason: "refund",
      bucket: "careington",
      deltaCents: -50,
      notes: "Careington-only correction",
    });

    const { statementId } = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatement,
      { period, vendor: "toothlens" },
    );
    const toothlens: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId },
    );
    expect(toothlens.adjustmentCents).toBe(0);
    expect(toothlens.unappliedAdjustments).toHaveLength(0);

    const careington = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatement,
      { period, vendor: "careington" },
    );
    const careingtonStatement: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId: careington.statementId },
    );
    expect(careingtonStatement.adjustmentCents).toBe(-50);
  });
});

// ---------------------------------------------------------------------------
// Rep / broker attribution
// ---------------------------------------------------------------------------

describe("vendorStatements — rep attribution", () => {
  test("Ideal Health sees who sold each member; the flat-fee recipients do not", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const world = await seedWorld(t);
    const { year, month, period, midMs } = previousMonth();
    const rep = await seedRep(t, {
      name: "Dana Reyes",
      agencyName: "Southeast Benefits Group",
      email: "dana@agency.test",
    });
    const memberProfileId = await seedPrimary(t, world, {
      customerId: "sold-by-dana",
      memberId: "MEM-SOLD",
      totalCents: 2499,
      createdAt: midMs,
    });
    await seedEnrollmentSession(t, world, {
      memberProfileId,
      brokerId: rep.leaderId,
      agencyId: rep.partnerId,
      trackingCode: "BRK-REYES-01",
    });
    await asAdmin(t).mutation(api.admin.invoiceCalculator.closePeriodManual, {
      year,
      month,
    });

    const ideal = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatement,
      { period, vendor: "ideal" },
    );
    const idealStatement: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId: ideal.statementId },
    );
    expect(idealStatement.showBroker).toBe(true);
    expect(idealStatement.attributionBasis).toBe("frozen");
    expect(idealStatement.memberLines[0].repName).toBe("Dana Reyes");
    expect(idealStatement.memberLines[0].repCode).toBe("BRK-REYES-01");
    expect(idealStatement.memberLines[0].repEmail).toBe("dana@agency.test");
    expect(idealStatement.memberLines[0].agencyName).toBe("Southeast Benefits Group");
    // Ideal can pay the rep, but still cannot see the employer behind them.
    expect(JSON.stringify(idealStatement.memberLines)).not.toContain("ACMEMFG");

    const toothlens = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatement,
      { period, vendor: "toothlens" },
    );
    const toothlensStatement: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId: toothlens.statementId },
    );
    expect(toothlensStatement.showBroker).toBe(false);
    expect(toothlensStatement.memberLines[0].repName).toBeUndefined();
    expect(JSON.stringify(toothlensStatement)).not.toContain("Dana Reyes");
  });

  test("a member with no enrollment session falls back to the group's rep", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const world = await seedWorld(t);
    const { year, month, period, midMs } = previousMonth();
    const rep = await seedRep(t, { name: "Group Rep", agencyName: "Acme Brokers" });
    await t.run(async (ctx) => {
      await ctx.db.patch(world.groupId, {
        brokerId: rep.leaderId,
        brokerTrackingCode: "GRP-CODE-9",
      });
    });
    // No enrollment session — this is the eligibility-file / list-bill path.
    await seedPrimary(t, world, {
      customerId: "listbill-member",
      memberId: "MEM-LB",
      totalCents: 1499,
      createdAt: midMs,
    });
    await asAdmin(t).mutation(api.admin.invoiceCalculator.closePeriodManual, {
      year,
      month,
    });

    const { statementId } = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatement,
      { period, vendor: "ideal" },
    );
    const statement: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId },
    );
    expect(statement.memberLines[0].repName).toBe("Group Rep");
    expect(statement.memberLines[0].repCode).toBe("GRP-CODE-9");
  });

  test("attribution frozen at close survives a later reassignment", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const world = await seedWorld(t);
    const { year, month, period, midMs } = previousMonth();
    const original = await seedRep(t, {
      name: "Original Rep",
      agencyName: "First Agency",
    });
    const memberProfileId = await seedPrimary(t, world, {
      customerId: "reassigned",
      memberId: "MEM-REASSIGN",
      totalCents: 1499,
      createdAt: midMs,
    });
    await seedEnrollmentSession(t, world, {
      memberProfileId,
      brokerId: original.leaderId,
      agencyId: original.partnerId,
      trackingCode: "ORIG-01",
    });
    await asAdmin(t).mutation(api.admin.invoiceCalculator.closePeriodManual, {
      year,
      month,
    });

    // The book of business moves after the month was closed.
    const replacement = await seedRep(t, {
      name: "New Rep",
      agencyName: "Second Agency",
    });
    await t.run(async (ctx) => {
      const session = await ctx.db
        .query("enrollmentSessions")
        .withIndex("by_member", (q) => q.eq("memberId", memberProfileId))
        .first();
      await ctx.db.patch(session!._id, {
        brokerId: replacement.leaderId,
        agencyId: replacement.partnerId,
        brokerTrackingCode: "NEW-01",
      });
    });

    const { statementId } = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatement,
      { period, vendor: "ideal" },
    );
    const statement: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId },
    );
    // The rep who earned that month is still the rep on that month's statement.
    expect(statement.memberLines[0].repName).toBe("Original Rep");
    expect(statement.attributionBasis).toBe("frozen");
  });

  test("a close with no frozen attribution reports that it used current records", async () => {
    const t = convexTest(schema);
    const { period } = await seedClosedMonth(t);
    // Strip the frozen rep fields to imitate a close written before they existed.
    await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("invoicePeriods")
        .withIndex("by_period", (q) => q.eq("period", period))
        .collect();
      for (const row of rows) {
        await ctx.db.patch(row._id, {
          memberLines: (row.memberLines ?? []).map((line) => ({
            ...line,
            repSource: undefined,
            repId: undefined,
            repName: undefined,
            repCode: undefined,
            repEmail: undefined,
            agencyId: undefined,
            agencyName: undefined,
          })),
        });
      }
    });

    const { statementId } = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatement,
      { period, vendor: "ideal" },
    );
    const statement: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId },
    );
    expect(statement.attributionBasis).toBe("current");
  });
});

// ---------------------------------------------------------------------------
// Internal verification
// ---------------------------------------------------------------------------

describe("vendorStatements — payables verification", () => {
  test("exposes the full dispersal and passes every reconciliation check", async () => {
    const t = convexTest(schema);
    const { period } = await seedClosedMonth(t);
    const { statementId } = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatement,
      { period, vendor: "toothlens" },
    );
    const audit: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatementVerification,
      { statementId },
    );

    expect(audit.allChecksPassed).toBe(true);
    expect(audit.checks.every((c: any) => c.passed)).toBe(true);
    expect(audit.lines).toHaveLength(2);
    // Every bucket is present regardless of who the statement is for — this is
    // the admin's verification view, not the recipient's document.
    const line = audit.lines[0];
    expect(line.grossCents).toBeGreaterThan(0);
    expect(line.partnerVendorCents).toBeGreaterThan(0);
    expect(line.ryzeKeepCents).toBeGreaterThan(0);
    expect(line.splitBalances).toBe(true);
    expect(line.statementCents).toBe(100); // the Toothlens flat fee
    expect(audit.amountField).toBe("toothlensCents");
    // Individual $14.99 + Family $24.99
    expect(audit.totals.grossCents).toBe(1499 + 2499);
    expect(audit.snapshotTotals.toothlensCents).toBe(audit.statementSubtotalCents);
  });

  test("catches a statement whose subtotal no longer matches the closed books", async () => {
    const t = convexTest(schema);
    const { period } = await seedClosedMonth(t);
    const { statementId } = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatement,
      { period, vendor: "toothlens" },
    );
    await t.run(async (ctx) => {
      await ctx.db.patch(statementId, { subtotalCents: 999_99 });
    });

    const audit: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatementVerification,
      { statementId },
    );
    expect(audit.allChecksPassed).toBe(false);
    const failed = audit.checks.find((c: any) => !c.passed);
    expect(failed.label).toMatch(/subtotal matches the closed books/i);
  });

  test("verification reflects adjustments in the total check", async () => {
    const t = convexTest(schema);
    const { period } = await seedClosedMonth(t);
    const periodId = await t.run(async (ctx) => {
      const row = await ctx.db
        .query("invoicePeriods")
        .withIndex("by_period", (q) => q.eq("period", period))
        .first();
      return row!._id;
    });
    await asAdmin(t).mutation(api.admin.invoiceCalculator.recordAdjustment, {
      periodId,
      reason: "refund",
      bucket: "toothlens",
      deltaCents: -50,
      notes: "Refund for a mid-month cancellation",
    });
    const { statementId } = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatement,
      { period, vendor: "toothlens" },
    );
    const audit: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatementVerification,
      { statementId },
    );
    expect(audit.statementAdjustmentCents).toBe(-50);
    expect(audit.statementTotalCents).toBe(150);
    expect(audit.allChecksPassed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Disclosure profiles
// ---------------------------------------------------------------------------

describe("vendorStatements — disclosure profiles", () => {
  test("Ideal is shown the employer behind list-bill members", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const world = await seedWorld(t, {
      groupCode: "BIGCORP",
      groupName: "Big Corp Manufacturing",
    });
    await t.run(async (ctx) => {
      await ctx.db.patch(world.groupId, {
        listBill: { enabled: true, paymentMethod: "ach" as const },
      });
    });
    const { year, month, period, midMs } = previousMonth();
    await seedPrimary(t, world, {
      customerId: "employee",
      memberId: "MEM-EMP",
      totalCents: 1499,
      createdAt: midMs,
    });
    await asAdmin(t).mutation(api.admin.invoiceCalculator.closePeriodManual, {
      year,
      month,
    });

    const { statementId } = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatement,
      { period, vendor: "ideal" },
    );
    const statement: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId },
    );
    expect(statement.memberLines[0].groupName).toBe("Big Corp Manufacturing");
    expect(statement.memberLines[0].groupCode).toBe("BIGCORP");
    expect(statement.groups[0].groupName).toBe("Big Corp Manufacturing");

    // The flat-fee recipients are untouched by Ideal's setting.
    const toothlens = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatement,
      { period, vendor: "toothlens" },
    );
    const flat: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId: toothlens.statementId },
    );
    expect(JSON.stringify(flat)).not.toContain("Big Corp Manufacturing");
  });

  test("listing profiles reports the defaults and whether they were customised", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const before: any[] = await asAdmin(t).query(
      api.admin.vendorStatements.listDisclosureProfiles,
      {},
    );
    expect(before).toHaveLength(4);
    expect(before.every((p) => p.customised === false)).toBe(true);
    expect(before.find((p) => p.vendor === "ideal").current.groupVisibility).toBe(
      "listBillOnly",
    );

    await asAdmin(t).mutation(api.admin.vendorStatements.updateDisclosureProfile, {
      vendor: "toothlens",
      disclosure: {
        memberDetail: true,
        groupVisibility: "listBillOnly",
        rateClass: false,
        repAttribution: false,
        fullSplit: false,
        adjustmentDetail: true,
      },
      note: "They asked for employer names on the employer book",
    });

    const after: any[] = await asAdmin(t).query(
      api.admin.vendorStatements.listDisclosureProfiles,
      {},
    );
    const toothlens = after.find((p) => p.vendor === "toothlens");
    expect(toothlens.customised).toBe(true);
    expect(toothlens.current.groupVisibility).toBe("listBillOnly");
    expect(toothlens.defaults.groupVisibility).toBe("none");
    expect(toothlens.note).toMatch(/employer book/);
  });

  test("a changed profile shapes the next statement", async () => {
    const t = convexTest(schema);
    const { period } = await seedClosedMonth(t);

    await asAdmin(t).mutation(api.admin.vendorStatements.updateDisclosureProfile, {
      vendor: "toothlens",
      disclosure: {
        memberDetail: true,
        groupVisibility: "none",
        rateClass: true,
        repAttribution: false,
        fullSplit: false,
        adjustmentDetail: true,
      },
    });

    const { statementId } = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatement,
      { period, vendor: "toothlens" },
    );
    const statement: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId },
    );
    expect(statement.showTier).toBe(true);
    expect(statement.memberLines[0].rateClass).toBeDefined();
  });

  test("editing a profile never reshapes a statement already issued", async () => {
    const t = convexTest(schema);
    const { period } = await seedClosedMonth(t);
    const { statementId } = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatement,
      { period, vendor: "toothlens" },
    );
    await asAdmin(t).mutation(api.admin.vendorStatements.issueStatement, {
      statementId,
    });

    // Open the settings all the way up AFTER the document went out.
    await asAdmin(t).mutation(api.admin.vendorStatements.updateDisclosureProfile, {
      vendor: "toothlens",
      disclosure: {
        memberDetail: true,
        groupVisibility: "all",
        rateClass: true,
        repAttribution: true,
        fullSplit: false,
        adjustmentDetail: true,
      },
    });

    const statement: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId },
    );
    expect(statement.showGroups).toBe(false);
    expect(statement.showTier).toBe(false);
    expect(statement.showBroker).toBe(false);
    expect(JSON.stringify(statement)).not.toContain("ACMEMFG");
  });

  test("the full revenue split cannot be handed to an external recipient", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    for (const vendor of ["toothlens", "careington", "ideal"] as const) {
      await expect(
        asAdmin(t).mutation(api.admin.vendorStatements.updateDisclosureProfile, {
          vendor,
          disclosure: {
            memberDetail: true,
            groupVisibility: "none",
            rateClass: false,
            repAttribution: false,
            fullSplit: true,
            adjustmentDetail: true,
          },
        }),
      ).rejects.toThrow(/other partners are paid/i);
    }
  });

  test("resetting drops the override and restores the default", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    await asAdmin(t).mutation(api.admin.vendorStatements.updateDisclosureProfile, {
      vendor: "careington",
      disclosure: {
        memberDetail: false,
        groupVisibility: "all",
        rateClass: true,
        repAttribution: true,
        fullSplit: false,
        adjustmentDetail: false,
      },
    });
    const reset = await asAdmin(t).mutation(
      api.admin.vendorStatements.resetDisclosureProfile,
      { vendor: "careington" },
    );
    expect(reset.reset).toBe(true);

    const profiles: any[] = await asAdmin(t).query(
      api.admin.vendorStatements.listDisclosureProfiles,
      {},
    );
    const careington = profiles.find((p) => p.vendor === "careington");
    expect(careington.customised).toBe(false);
    expect(careington.current.groupVisibility).toBe("none");
  });

  test("turning off member detail yields a totals-only statement that still balances", async () => {
    const t = convexTest(schema);
    const { period } = await seedClosedMonth(t);
    await asAdmin(t).mutation(api.admin.vendorStatements.updateDisclosureProfile, {
      vendor: "toothlens",
      disclosure: {
        memberDetail: false,
        groupVisibility: "none",
        rateClass: false,
        repAttribution: false,
        fullSplit: false,
        adjustmentDetail: true,
      },
    });
    const { statementId } = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatement,
      { period, vendor: "toothlens" },
    );
    const statement: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId },
    );
    expect(statement.memberLines).toHaveLength(0);
    expect(statement.primaryCount).toBe(2);
    expect(statement.totalCents).toBe(200);

    // The admin verification view still sees everything.
    const audit: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatementVerification,
      { statementId },
    );
    expect(audit.lines).toHaveLength(2);
    expect(audit.allChecksPassed).toBe(true);
  });
});
