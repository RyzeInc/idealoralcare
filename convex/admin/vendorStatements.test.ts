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

/** Build a disclosure payload with the named columns switched on. */
function disclosure(opts: {
  memberDetail?: boolean;
  groupVisibility?: "none" | "listBillOnly" | "all";
  adjustmentDetail?: boolean;
  on?: string[];
}) {
  const keys = [
    "memberId", "memberName", "rateClass", "organization", "orgCode",
    "groupCode", "repName", "repCode", "repEmail", "agencyName", "amount",
    "grossCents", "toothlensCents", "careingtonCents", "processingCents",
    "partnerVendorCents", "ryzeKeepCents",
    "firstName", "lastName", "memberEmail", "phone", "dob", "ssn", "gender",
    "memberRole", "relationship", "primaryMember", "dependentCount",
    "memberType", "effectiveDate", "createdAt", "censusMissing",
    "addressLine1", "city", "state", "postalCode",
    "employeeType", "location", "department", "groupMemberId", "listBillStatus",
    "careingtonId", "careingtonSeq", "toothlensId", "clerkId",
    "systemPresence", "subscriptionStatus", "entitlementCount",
    "barcode", "subscriberId",
  ];
  const on = new Set([...(opts.on ?? []), "memberId", "memberName", "amount"]);
  return {
    memberDetail: opts.memberDetail ?? true,
    groupVisibility: opts.groupVisibility ?? "none",
    adjustmentDetail: opts.adjustmentDetail ?? true,
    columns: keys.map((key) => ({ key, enabled: on.has(key) })),
  };
}

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

/**
 * Remove member records so a rebuild finds nothing left to name — the only
 * situation where names genuinely cannot be produced.
 */
async function eraseMembers(
  t: ReturnType<typeof convexTest>,
  customerIds: string[],
) {
  await t.run(async (ctx) => {
    const members = await ctx.db.query("memberProfiles").collect();
    for (const member of members) {
      if (customerIds.includes(member.customerId ?? "")) {
        await ctx.db.delete(member._id);
      }
    }
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

    // Nothing the recipient would see names the employer or the retail price.
    const lines = JSON.stringify(statement.memberLines);
    expect(lines).not.toContain("ACMEMFG");
    expect(lines).not.toContain("Acme Manufacturing");
    expect(lines).not.toContain("grossCents");
    expect(lines).not.toContain("2499");
    // …and no gross/other-vendor column is offered on the document either.
    const printed = statement.columns.map((c: any) => c.key);
    expect(printed).not.toContain("grossCents");
    expect(printed).not.toContain("careingtonCents");
    expect(printed).not.toContain("organization");
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
    expect(failed.label).toMatch(/unchanged since it was generated/i);
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
      disclosure: disclosure({ memberDetail: true, groupVisibility: "listBillOnly", adjustmentDetail: true, on: ["organization"] }),
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

  test("a changed profile shapes the statements generated after it", async () => {
    const t = convexTest(schema);
    const { period } = await seedClosedMonth(t);

    await asAdmin(t).mutation(api.admin.vendorStatements.updateDisclosureProfile, {
      vendor: "toothlens",
      disclosure: disclosure({ memberDetail: true, groupVisibility: "none", adjustmentDetail: true, on: ["rateClass"] }),
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

  test("a settings change reshapes an existing statement and reports the drift", async () => {
    const t = convexTest(schema);
    const { period } = await seedClosedMonth(t);
    const { statementId } = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatement,
      { period, vendor: "toothlens" },
    );
    await asAdmin(t).mutation(api.admin.vendorStatements.issueStatement, {
      statementId,
    });

    const before: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId },
    );
    expect(before.showGroups).toBe(false);
    expect(before.disclosureDrift).toEqual([]);

    // Open the settings up AFTER the document went out.
    await asAdmin(t).mutation(api.admin.vendorStatements.updateDisclosureProfile, {
      vendor: "toothlens",
      disclosure: disclosure({ memberDetail: true, groupVisibility: "all", adjustmentDetail: true, on: ["rateClass", "repName", "repCode", "agencyName", "organization"] }),
    });

    const after: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId },
    );
    // The document now follows the current settings — no reissue needed.
    expect(after.showGroups).toBe(true);
    expect(after.showTier).toBe(true);
    expect(after.showBroker).toBe(true);
    expect(after.memberLines[0].groupName).toBe("Acme Manufacturing");

    // Every figure is untouched: disclosure is presentation only.
    expect(after.subtotalCents).toBe(before.subtotalCents);
    expect(after.totalCents).toBe(before.totalCents);
    expect(after.primaryCount).toBe(before.primaryCount);
    expect(after.memberLines).toHaveLength(before.memberLines.length);
    expect(after.memberLines.map((l: any) => l.amountCents)).toEqual(
      before.memberLines.map((l: any) => l.amountCents),
    );

    // And the change from what was originally sent is reported, not hidden.
    expect(after.generatedUnderDisclosure.groupVisibility).toBe("none");
    expect(after.disclosureDrift.length).toBeGreaterThan(0);
    expect(after.disclosureDrift.join(" ")).toMatch(/Employer group/);
  });

  test("the full revenue split cannot be handed to an external recipient", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    for (const vendor of ["toothlens", "careington", "ideal"] as const) {
      await expect(
        asAdmin(t).mutation(api.admin.vendorStatements.updateDisclosureProfile, {
          vendor,
          disclosure: disclosure({ memberDetail: true, groupVisibility: "none", adjustmentDetail: true, on: ["grossCents", "toothlensCents", "careingtonCents", "processingCents", "partnerVendorCents", "ryzeKeepCents"] }),
        }),
      ).rejects.toThrow(/other partners are paid/i);
    }
  });

  test("resetting drops the override and restores the default", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    await asAdmin(t).mutation(api.admin.vendorStatements.updateDisclosureProfile, {
      vendor: "careington",
      disclosure: disclosure({ memberDetail: false, groupVisibility: "all", adjustmentDetail: false, on: ["rateClass", "repName", "repCode", "agencyName", "organization"] }),
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
      disclosure: disclosure({ memberDetail: false, groupVisibility: "none", adjustmentDetail: true, on: [] }),
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

// ---------------------------------------------------------------------------
// Group rollup
// ---------------------------------------------------------------------------

describe("vendorStatements — organization rollup", () => {
  test("organizations sharing a provider group code stay separate rows", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const { year, month, period, midMs } = previousMonth();

    // Two DIFFERENT organizations, both on the "IDEALDO" provider code — the
    // real shape of the data. Keying a rollup on the code alone would silently
    // merge them into one line.
    const apricus = await seedWorld(t, {
      groupCode: "IDEALDO",
      groupName: "Apricus",
    });
    const northwind = await seedWorld(t, {
      groupCode: "IDEALDO",
      groupName: "Northwind Traders",
    });
    for (const world of [apricus, northwind]) {
      await t.run(async (ctx) => {
        await ctx.db.patch(world.groupId, {
          listBill: { enabled: true, paymentMethod: "ach" as const },
        });
      });
    }
    await seedPrimary(t, apricus, {
      customerId: "apricus-1",
      memberId: "MEM-AP1",
      totalCents: 1499,
      createdAt: midMs,
    });
    await seedPrimary(t, apricus, {
      customerId: "apricus-2",
      memberId: "MEM-AP2",
      totalCents: 1499,
      createdAt: midMs,
    });
    await seedPrimary(t, northwind, {
      customerId: "northwind-1",
      memberId: "MEM-NW1",
      totalCents: 2499,
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

    expect(statement.groups).toHaveLength(2);
    const byName = Object.fromEntries(
      statement.groups.map((g: any) => [g.groupName, g]),
    );
    expect(byName["Apricus"].primaryCount).toBe(2);
    expect(byName["Northwind Traders"].primaryCount).toBe(1);
    // Both still report the shared provider code they belong to.
    expect(byName["Apricus"].groupCode).toBe("IDEALDO");
    expect(byName["Northwind Traders"].groupCode).toBe("IDEALDO");
    // Counts and money add back up to the statement.
    const summed = statement.groups.reduce(
      (sum: number, g: any) => sum + g.amountCents,
      0,
    );
    expect(summed).toBe(statement.subtotalCents);

    // Member lines name the organization, not just the shared code.
    const orgs = new Set(statement.memberLines.map((l: any) => l.groupName));
    expect(orgs).toEqual(new Set(["Apricus", "Northwind Traders"]));
  });

  test("direct enrollments collapse into a single row and sort last", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const { year, month, period, midMs } = previousMonth();

    const employer = await seedWorld(t, {
      groupCode: "IDEALDO",
      groupName: "Zenith Industries",
    });
    await t.run(async (ctx) => {
      await ctx.db.patch(employer.groupId, {
        listBill: { enabled: true, paymentMethod: "ach" as const },
      });
    });
    // Two separate self-pay groups — neither should be named.
    const selfPayA = await seedWorld(t, { groupCode: "DTC-A", groupName: "DTC A" });
    const selfPayB = await seedWorld(t, { groupCode: "DTC-B", groupName: "DTC B" });

    await seedPrimary(t, employer, {
      customerId: "emp-1",
      memberId: "MEM-E1",
      totalCents: 1499,
      createdAt: midMs,
    });
    await seedPrimary(t, selfPayA, {
      customerId: "self-a",
      memberId: "MEM-SA",
      totalCents: 1499,
      createdAt: midMs,
    });
    await seedPrimary(t, selfPayB, {
      customerId: "self-b",
      memberId: "MEM-SB",
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

    expect(statement.groups.map((g: any) => g.groupName)).toEqual([
      "Zenith Industries",
      "Direct enrollment",
    ]);
    expect(statement.groups[1].primaryCount).toBe(2);
    expect(JSON.stringify(statement)).not.toContain("DTC A");
    expect(JSON.stringify(statement)).not.toContain("DTC B");
  });
});

// ---------------------------------------------------------------------------
// Member-detail backfill
// ---------------------------------------------------------------------------

describe("invoiceCalculator — member line backfill", () => {
  /** Strip member lines to imitate a close written before they existed. */
  async function stripMemberLines(
    t: ReturnType<typeof convexTest>,
    period: string,
  ) {
    await t.run(async (ctx) => {
      // Filtered in JS rather than by index: this helper takes a loosely typed
      // `t`, so the schema's named indexes aren't visible here.
      const rows = await ctx.db.query("invoicePeriods").collect();
      for (const row of rows) {
        if (row.period !== period) continue;
        await ctx.db.patch(row._id, { memberLines: undefined });
      }
    });
  }

  test("fills member detail where the rebuild reproduces the closed totals", async () => {
    const t = convexTest(schema);
    const { period } = await seedClosedMonth(t);
    await stripMemberLines(t, period);

    const before: any = await asAdmin(t).query(
      api.admin.invoiceCalculator.previewMemberLineBackfill,
      { period },
    );
    expect(before.fillable).toBeGreaterThan(0);
    expect(before.blocked).toBe(0);

    const result = await asAdmin(t).mutation(
      api.admin.invoiceCalculator.backfillMemberLines,
      { period },
    );
    expect(result.filled).toBe(before.fillable);
    expect(result.skipped).toBe(0);

    // The statement now carries member detail.
    const { statementId } = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatement,
      { period, vendor: "ideal" },
    );
    const statement: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId },
    );
    expect(statement.memberDetailAvailable).toBe(true);
    expect(statement.memberLines).toHaveLength(2);
  });

  test("names members even when the roster no longer matches the close", async () => {
    const t = convexTest(schema);
    const { period } = await seedClosedMonth(t);
    await stripMemberLines(t, period);

    // Tamper with the frozen totals so the rebuild cannot reconcile.
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("invoicePeriods")
        .withIndex("by_period", (q) => q.eq("period", period))
        .first();
      await ctx.db.patch(row!._id, { grossCents: row!.grossCents + 500 });
    });

    const preview: any = await asAdmin(t).query(
      api.admin.invoiceCalculator.previewMemberLineBackfill,
      { period },
    );
    // Nothing is blocked — a shifted roster is still nameable.
    expect(preview.blocked).toBe(0);
    expect(preview.mismatched).toBe(1);

    const before = await t.run(async (ctx) => {
      const rows = await ctx.db.query("invoicePeriods").collect();
      return rows
        .filter((r) => r.period === period)
        .reduce((n, r) => n + r.grossCents, 0);
    });

    const result = await asAdmin(t).mutation(
      api.admin.invoiceCalculator.backfillMemberLines,
      { period },
    );
    expect(result.mismatched).toBe(1);
    expect(result.exact).toBe(0);

    // Named, stamped as a mismatch, and the money left exactly as closed.
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("invoicePeriods").collect();
      const after = rows
        .filter((r) => r.period === period)
        .reduce((n, r) => n + r.grossCents, 0);
      expect(after).toBe(before);
      for (const row of rows) {
        if (row.period === period) {
          expect(row.memberLines?.length).toBeGreaterThan(0);
          expect(row.memberLinesRebuilt).toBe("forced");
        }
      }
    });
  });

  test("never rewrites totals, only the absent detail", async () => {
    const t = convexTest(schema);
    const { period } = await seedClosedMonth(t);
    const frozen = await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("invoicePeriods")
        .withIndex("by_period", (q) => q.eq("period", period))
        .collect();
      return rows.map((r) => ({
        id: r._id,
        grossCents: r.grossCents,
        payloadHash: r.payloadHash,
        closedAt: r.closedAt,
      }));
    });
    await stripMemberLines(t, period);
    await asAdmin(t).mutation(api.admin.invoiceCalculator.backfillMemberLines, {
      period,
    });

    await t.run(async (ctx) => {
      for (const snap of frozen) {
        const row = await ctx.db.get(snap.id);
        expect(row!.grossCents).toBe(snap.grossCents);
        expect(row!.payloadHash).toBe(snap.payloadHash);
        expect(row!.closedAt).toBe(snap.closedAt);
      }
    });
  });

  test("leaves a close that already has detail alone", async () => {
    const t = convexTest(schema);
    const { period } = await seedClosedMonth(t);
    const preview: any = await asAdmin(t).query(
      api.admin.invoiceCalculator.previewMemberLineBackfill,
      { period },
    );
    expect(preview.fillable).toBe(0);
    expect(preview.untouched).toBeGreaterThan(0);

    const result = await asAdmin(t).mutation(
      api.admin.invoiceCalculator.backfillMemberLines,
      { period },
    );
    expect(result.filled).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Activity trail
// ---------------------------------------------------------------------------

describe("vendorStatements — activity trail", () => {
  test("records who changed a recipient's contents, and to what", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    await asAdmin(t).mutation(api.admin.vendorStatements.updateDisclosureProfile, {
      vendor: "toothlens",
      disclosure: disclosure({ memberDetail: true, groupVisibility: "listBillOnly", adjustmentDetail: true, on: ["rateClass", "organization"] }),
      note: "They asked for employer names",
    });

    const trail: any[] = await asAdmin(t).query(
      api.admin.vendorStatements.listStatementActivity,
      { kind: "contents" },
    );
    expect(trail).toHaveLength(1);
    const entry = trail[0];
    expect(entry.label).toBe("Contents changed");
    expect(entry.vendor).toBe("toothlens");
    expect(entry.vendorName).toBe("Toothlens");
    // The actor is named, not a raw Clerk id.
    expect(entry.actorName).toBe("VS Admin");
    expect(entry.actorRole).toBe("owner");
    // Field-by-field, before → after.
    expect(entry.changes.join(" ")).toMatch(/Employer group: none → listBillOnly/);
    expect(entry.changes.join(" ")).toMatch(/Rate Class.*: added/i);
  });

  test("covers the statement lifecycle, remittances, and adjustments", async () => {
    const t = convexTest(schema);
    const { period } = await seedClosedMonth(t);
    const { statementId } = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatement,
      { period, vendor: "toothlens" },
    );
    await asAdmin(t).mutation(api.admin.vendorStatements.issueStatement, {
      statementId,
    });
    await asAdmin(t).mutation(api.admin.vendorStatements.recordRemittance, {
      statementId,
      amountCents: 200,
      paymentMethod: "ach",
      paymentReference: "TRACE-9",
    });

    const trail: any[] = await asAdmin(t).query(
      api.admin.vendorStatements.listStatementActivity,
      {},
    );
    const actions = trail.map((e) => e.action);
    expect(actions).toContain("vendor_statement.generate");
    expect(actions).toContain("vendor_statement.issue");
    expect(actions).toContain("vendor_statement.remittance");
    expect(actions).toContain("invoice.closePeriod");

    // Statement-scoped entries resolve back to their recipient and number.
    const issued = trail.find((e) => e.action === "vendor_statement.issue");
    expect(issued.vendorName).toBe("Toothlens");
    expect(issued.statementNumber).toMatch(/^VS-\d+$/);
    expect(issued.statementId).toBe(statementId);

    // Newest first.
    for (let i = 1; i < trail.length; i++) {
      expect(trail[i - 1].createdAt).toBeGreaterThanOrEqual(trail[i].createdAt);
    }
  });

  test("filters down to one recipient", async () => {
    const t = convexTest(schema);
    const { period } = await seedClosedMonth(t);
    await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatementsForPeriod,
      { period },
    );

    const ideal: any[] = await asAdmin(t).query(
      api.admin.vendorStatements.listStatementActivity,
      { vendor: "ideal" },
    );
    expect(ideal.length).toBeGreaterThan(0);
    expect(ideal.every((e) => e.vendor === "ideal")).toBe(true);
    expect(JSON.stringify(ideal)).not.toContain("Careington");
  });

  test("a void and a reissue both leave a trace with their reason", async () => {
    const t = convexTest(schema);
    const { period } = await seedClosedMonth(t);
    const { statementId } = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatement,
      { period, vendor: "careington" },
    );
    await asAdmin(t).mutation(api.admin.vendorStatements.issueStatement, {
      statementId,
    });
    await asAdmin(t).mutation(
      api.admin.vendorStatements.generateReplacementStatement,
      { statementId, reason: "Retro term for one member" },
    );

    const trail: any[] = await asAdmin(t).query(
      api.admin.vendorStatements.listStatementActivity,
      { vendor: "careington" },
    );
    const reissue = trail.find((e) => e.action === "vendor_statement.reissue");
    expect(reissue).toBeDefined();
    expect(reissue.summary).toMatch(/Retro term for one member/);
  });
});

// ---------------------------------------------------------------------------
// Readability of the rollup
// ---------------------------------------------------------------------------

describe("vendorStatements — statement readability", () => {
  test("reports the Individual/Family mix even with no member detail", async () => {
    const t = convexTest(schema);
    const { period } = await seedClosedMonth(t);
    // Strip member lines and erase the member records, so there is genuinely
    // nothing left to name. The mix must still be reportable from the close.
    await eraseMembers(t, ["solo", "house"]);
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("invoicePeriods").collect();
      for (const row of rows) {
        if (row.period === period) {
          await ctx.db.patch(row._id, { memberLines: undefined });
        }
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
    expect(statement.memberDetailAvailable).toBe(false);
    expect(statement.memberLines).toHaveLength(0);
    // Seeded one $14.99 and one $24.99 primary.
    expect(statement.individualCount).toBe(1);
    expect(statement.familyCount).toBe(1);
    expect(statement.primaryCount).toBe(2);
    expect(statement.groups[0].individualCount).toBe(1);
    expect(statement.groups[0].familyCount).toBe(1);
  });

  test("suppresses the provider code when every organization shares one", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const { year, month, period, midMs } = previousMonth();
    for (const name of ["Apricus", "Soars"]) {
      const world = await seedWorld(t, { groupCode: "IDEALDO", groupName: name });
      await t.run(async (ctx) => {
        await ctx.db.patch(world.groupId, {
          listBill: { enabled: true, paymentMethod: "ach" as const },
        });
      });
      await seedPrimary(t, world, {
        customerId: `c-${name}`,
        memberId: `MEM-${name}`,
        totalCents: 1499,
        createdAt: midMs,
      });
    }
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
    // Two organizations, one provider code — the code column earns nothing.
    expect(statement.groups).toHaveLength(2);
    expect(statement.groupCodeVaries).toBe(false);
  });

  test("keeps the provider code when it actually distinguishes rows", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const { year, month, period, midMs } = previousMonth();
    for (const [code, name] of [
      ["IDEALDO", "Apricus"],
      ["NEWIDEAL", "Northwind"],
    ]) {
      const world = await seedWorld(t, { groupCode: code, groupName: name });
      await t.run(async (ctx) => {
        await ctx.db.patch(world.groupId, {
          listBill: { enabled: true, paymentMethod: "ach" as const },
        });
      });
      await seedPrimary(t, world, {
        customerId: `c-${name}`,
        memberId: `MEM-${name}`,
        totalCents: 1499,
        createdAt: midMs,
      });
    }
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
    expect(statement.groupCodeVaries).toBe(true);
  });

  test("names the rep on each organization for a recipient that pays them", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const { year, month, period, midMs } = previousMonth();
    const rep = await seedRep(t, {
      name: "Dana Reyes",
      agencyName: "Southeast Benefits Group",
    });
    const world = await seedWorld(t, {
      groupCode: "IDEALDO",
      groupName: "Apricus",
    });
    await t.run(async (ctx) => {
      await ctx.db.patch(world.groupId, {
        listBill: { enabled: true, paymentMethod: "ach" as const },
        brokerId: rep.leaderId,
        brokerTrackingCode: "BRK-REYES-01",
      });
    });
    await seedPrimary(t, world, {
      customerId: "c1",
      memberId: "MEM-1",
      totalCents: 1499,
      createdAt: midMs,
    });
    await asAdmin(t).mutation(api.admin.invoiceCalculator.closePeriodManual, {
      year,
      month,
    });

    const ideal = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatement,
      { period, vendor: "ideal" },
    );
    const statement: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId: ideal.statementId },
    );
    expect(statement.groups[0].repName).toBe("Dana Reyes");
    expect(statement.groups[0].agencyName).toBe("Southeast Benefits Group");

    // A recipient that does not pay reps is never told who they are.
    const toothlens = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatement,
      { period, vendor: "toothlens" },
    );
    const flat: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId: toothlens.statementId },
    );
    expect(JSON.stringify(flat)).not.toContain("Dana Reyes");
  });

  test("backfilling a close makes an existing statement show member detail", async () => {
    const t = convexTest(schema);
    const { period } = await seedClosedMonth(t);
    const { statementId } = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatement,
      { period, vendor: "ideal" },
    );
    // Strip the detail after the fact, imitating a statement cut against a
    // close that had none.
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("invoicePeriods").collect();
      for (const row of rows) {
        if (row.period === period) {
          await ctx.db.patch(row._id, { memberLines: undefined });
        }
      }
    });
    const before: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId },
    );
    expect(before.memberDetailAvailable).toBe(false);
    expect(before.memberLines).toHaveLength(0);

    await asAdmin(t).mutation(api.admin.invoiceCalculator.backfillMemberLines, {
      period,
    });

    // The SAME statement — not regenerated — now carries the detail.
    const after: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId },
    );
    expect(after.memberDetailAvailable).toBe(true);
    expect(after.memberLines).toHaveLength(2);
    expect(after.totalCents).toBe(before.totalCents);

    // And the verification view follows without regeneration too.
    const audit: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatementVerification,
      { statementId },
    );
    expect(audit.memberDetailAvailable).toBe(true);
    expect(audit.lines).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Partial member detail + per-primary exclusions
// ---------------------------------------------------------------------------

describe("vendorStatements — naming the primaries", () => {
  /** Two organizations; only one of them has per-member rows. */
  async function seedPartialMonth(t: ReturnType<typeof convexTest>) {
    await seedAdmin(t);
    const { year, month, period, midMs } = previousMonth();
    const named = await seedWorld(t, { groupCode: "IDEALDO", groupName: "Apricus" });
    const unnamed = await seedWorld(t, { groupCode: "IDEALDO", groupName: "Soars" });
    for (const world of [named, unnamed]) {
      await t.run(async (ctx) => {
        await ctx.db.patch(world.groupId, {
          listBill: { enabled: true, paymentMethod: "ach" as const },
        });
      });
    }
    await seedPrimary(t, named, {
      customerId: "ap-1",
      memberId: "MEM-AP1",
      totalCents: 1499,
      createdAt: midMs,
    });
    await seedPrimary(t, named, {
      customerId: "ap-2",
      memberId: "MEM-AP2",
      totalCents: 2499,
      createdAt: midMs,
    });
    await seedPrimary(t, unnamed, {
      customerId: "so-1",
      memberId: "MEM-SO1",
      totalCents: 1499,
      createdAt: midMs,
    });
    await asAdmin(t).mutation(api.admin.invoiceCalculator.closePeriodManual, {
      year,
      month,
    });
    // Strip Soars' detail and erase its member record, so it genuinely
    // cannot be named while Apricus still can.
    await eraseMembers(t, ["so-1"]);
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("invoicePeriods").collect();
      for (const row of rows) {
        if (row.period === period && row.groupName === "Soars") {
          await ctx.db.patch(row._id, { memberLines: undefined });
        }
      }
    });
    return { period };
  }

  test("one organization missing detail does not hide the other's names", async () => {
    const t = convexTest(schema);
    const { period } = await seedPartialMonth(t);
    const { statementId } = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatement,
      { period, vendor: "ideal" },
    );
    const statement: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId },
    );

    // The names that exist are shown.
    expect(statement.memberDetailAvailable).toBe(true);
    expect(statement.memberLines).toHaveLength(2);
    expect(statement.memberLines.map((l: any) => l.memberId).sort()).toEqual([
      "MEM-AP1",
      "MEM-AP2",
    ]);
    // And the gap is reported, never passed off as a complete list.
    expect(statement.memberDetailComplete).toBe(false);
    expect(statement.missingDetailGroups).toEqual([
      { groupName: "Soars", primaryCount: 1 },
    ]);
    // Totals still cover everyone, including the un-itemized primary.
    expect(statement.primaryCount).toBe(3);
    expect(statement.itemizedCents).toBeLessThan(statement.subtotalCents);
  });

  test("excluding a primary drops the line, the count, and the money", async () => {
    const t = convexTest(schema);
    const { period } = await seedClosedMonth(t);
    const { statementId } = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatement,
      { period, vendor: "ideal" },
    );
    const before: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId },
    );
    expect(before.memberLines).toHaveLength(2);
    const victim = before.memberLines[0];

    await asAdmin(t).mutation(
      api.admin.vendorStatements.excludeMemberFromStatement,
      {
        statementId,
        memberId: victim.memberId,
        reason: "Duplicate enrollment",
      },
    );

    const after: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId },
    );
    expect(after.memberLines).toHaveLength(1);
    expect(after.memberLines[0].memberId).not.toBe(victim.memberId);
    expect(after.primaryCount).toBe(before.primaryCount - 1);
    expect(after.subtotalCents).toBe(before.subtotalCents - victim.amountCents);
    expect(after.totalCents).toBe(before.totalCents - victim.amountCents);
    expect(after.excludedMembers).toHaveLength(1);
    expect(after.excludedMembers[0].reason).toBe("Duplicate enrollment");
    expect(after.excludedCents).toBe(victim.amountCents);

    // Restoring is lossless.
    await asAdmin(t).mutation(
      api.admin.vendorStatements.restoreMemberToStatement,
      { statementId, memberId: victim.memberId },
    );
    const restored: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId },
    );
    expect(restored.memberLines).toHaveLength(2);
    expect(restored.subtotalCents).toBe(before.subtotalCents);
    expect(restored.excludedMembers).toHaveLength(0);
  });

  test("a reason is required, and the same primary cannot be excluded twice", async () => {
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
    const memberId = statement.memberLines[0].memberId;

    await expect(
      asAdmin(t).mutation(api.admin.vendorStatements.excludeMemberFromStatement, {
        statementId,
        memberId,
        reason: "   ",
      }),
    ).rejects.toThrow(/reason is required/i);

    await asAdmin(t).mutation(
      api.admin.vendorStatements.excludeMemberFromStatement,
      { statementId, memberId, reason: "Billed in error" },
    );
    await expect(
      asAdmin(t).mutation(api.admin.vendorStatements.excludeMemberFromStatement, {
        statementId,
        memberId,
        reason: "again",
      }),
    ).rejects.toThrow(/already excluded/i);
  });

  test("someone who is not on the statement cannot be excluded", async () => {
    const t = convexTest(schema);
    const { period } = await seedClosedMonth(t);
    const { statementId } = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatement,
      { period, vendor: "ideal" },
    );
    await expect(
      asAdmin(t).mutation(api.admin.vendorStatements.excludeMemberFromStatement, {
        statementId,
        memberId: "NOT-A-MEMBER",
        reason: "typo",
      }),
    ).rejects.toThrow(/not a covered primary/i);
  });

  test("an issued statement's included set can still be changed", async () => {
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
    const memberId = statement.memberLines[0].memberId;
    await asAdmin(t).mutation(api.admin.vendorStatements.issueStatement, {
      statementId,
    });

    // The owner is not blocked — the change lands and the total moves.
    await asAdmin(t).mutation(
      api.admin.vendorStatements.excludeMemberFromStatement,
      { statementId, memberId, reason: "Termed after issue" },
    );
    const after: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId },
    );
    expect(after.excludedMembers).toHaveLength(1);
    expect(after.totalCents).toBeLessThan(statement.totalCents);

    // A voided statement is the one thing that stays put.
    await asAdmin(t).mutation(api.admin.vendorStatements.voidStatement, {
      statementId,
      reason: "superseded",
    });
    await expect(
      asAdmin(t).mutation(api.admin.vendorStatements.excludeMemberFromStatement, {
        statementId,
        memberId: after.memberLines[0].memberId,
        reason: "nope",
      }),
    ).rejects.toThrow(/voided/i);
  });

  test("an exclusion is written to the activity trail with its reason", async () => {
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
    await asAdmin(t).mutation(
      api.admin.vendorStatements.excludeMemberFromStatement,
      {
        statementId,
        memberId: statement.memberLines[0].memberId,
        reason: "Retro term effective the 1st",
      },
    );

    const trail: any[] = await asAdmin(t).query(
      api.admin.vendorStatements.listStatementActivity,
      { vendor: "ideal" },
    );
    const entry = trail.find(
      (e) => e.action === "vendor_statement.exclude_member",
    );
    expect(entry).toBeDefined();
    expect(entry.label).toBe("Primary excluded");
    expect(entry.summary).toMatch(/Retro term effective the 1st/);
  });
});

// ---------------------------------------------------------------------------
// Point-in-time fidelity of a rebuild
// ---------------------------------------------------------------------------

describe("invoiceCalculator — rebuilding a month people have since left", () => {
  test("a member who cancelled AFTER the month is still rebuilt into it", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const world = await seedWorld(t, {
      groupCode: "IDEALDO",
      groupName: "Individual Enrollment",
    });
    const { year, month, period, midMs } = previousMonth();
    const periodEndMs = Date.UTC(year, month, 1);

    // Three self-pay primaries during the month.
    for (const n of [1, 2, 3]) {
      await seedPrimary(t, world, {
        customerId: `self-${n}`,
        memberId: `MEM-SELF-${n}`,
        totalCents: 1499,
        createdAt: midMs,
      });
    }
    await asAdmin(t).mutation(api.admin.invoiceCalculator.closePeriodManual, {
      year,
      month,
    });

    const closedGross = await t.run(async (ctx) => {
      const rows = await ctx.db.query("invoicePeriods").collect();
      return rows
        .filter((r) => r.period === period)
        .reduce((n, r) => n + r.grossCents, 0);
    });
    expect(closedGross).toBe(3 * 1499);

    // Two of them cancel a month later. Their profiles stay on the roster,
    // which is the ordinary case — cancelling a subscription does not by
    // itself terminate the member record.
    await t.run(async (ctx) => {
      const bundles = await ctx.db.query("subscriptionBundles").collect();
      for (const bundle of bundles) {
        if (bundle.customerId === "self-2" || bundle.customerId === "self-3") {
          await ctx.db.patch(bundle._id, {
            status: "cancelled",
            cancelledAt: periodEndMs + 20 * 86_400_000,
          });
        }
      }
    });

    // Strip the detail, as a close written before member lines existed.
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("invoicePeriods").collect();
      for (const row of rows) {
        if (row.period === period) {
          await ctx.db.patch(row._id, { memberLines: undefined });
        }
      }
    });

    // The rebuild reproduces the month as it actually was, cancellations and
    // terminations notwithstanding.
    const preview: any = await asAdmin(t).query(
      api.admin.invoiceCalculator.previewMemberLineBackfill,
      { period },
    );
    expect(preview.blocked).toBe(0);
    expect(preview.fillable).toBe(1);

    await asAdmin(t).mutation(api.admin.invoiceCalculator.backfillMemberLines, {
      period,
    });

    const { statementId } = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatement,
      { period, vendor: "ideal" },
    );
    const statement: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId },
    );
    expect(statement.memberDetailComplete).toBe(true);
    expect(statement.memberLines).toHaveLength(3);
    expect(statement.memberLines.map((l: any) => l.memberId).sort()).toEqual([
      "MEM-SELF-1",
      "MEM-SELF-2",
      "MEM-SELF-3",
    ]);
  });

  test("a terminated profile still gets named, with the mismatch recorded", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const world = await seedWorld(t, { groupName: "Individual Enrollment" });
    const { year, month, period, midMs } = previousMonth();

    for (const n of [1, 2]) {
      await seedPrimary(t, world, {
        customerId: `p-${n}`,
        memberId: `MEM-P${n}`,
        totalCents: 1499,
        createdAt: midMs,
      });
    }
    await asAdmin(t).mutation(api.admin.invoiceCalculator.closePeriodManual, {
      year,
      month,
    });

    // One profile is terminated afterwards. `memberProfiles` records no
    // termination date, so a rebuild cannot tell "left in July" from "left in
    // April" and deliberately leaves them out — which makes the totals differ.
    await t.run(async (ctx) => {
      const members = await ctx.db.query("memberProfiles").collect();
      for (const member of members) {
        if (member.customerId === "p-2") {
          await ctx.db.patch(member._id, { memberType: "terminated" });
        }
      }
      const rows = await ctx.db.query("invoicePeriods").collect();
      for (const row of rows) {
        if (row.period === period) {
          await ctx.db.patch(row._id, { memberLines: undefined });
        }
      }
    });

    const preview: any = await asAdmin(t).query(
      api.admin.invoiceCalculator.previewMemberLineBackfill,
      { period },
    );
    expect(preview.blocked).toBe(0);
    expect(preview.rows[0].detail).toMatch(/roster has changed/i);

    const result = await asAdmin(t).mutation(
      api.admin.invoiceCalculator.backfillMemberLines,
      { period },
    );
    expect(result.mismatched).toBe(1);

    const { statementId } = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatement,
      { period, vendor: "ideal" },
    );
    const statement: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId },
    );
    expect(statement.memberLines).toHaveLength(1);
    expect(statement.memberLines[0].memberId).toBe("MEM-P1");
    // The statement now bills the one member it can account for, and reports
    // what the month originally closed at so the gap stays visible.
    expect(statement.primaryCount).toBe(1);
    expect(statement.itemizedCents).toBe(statement.subtotalCents);
    expect(statement.closedSubtotalCents).toBeGreaterThan(
      statement.subtotalCents,
    );
  });

  test("a member who cancelled DURING the month is not resurrected into it", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const world = await seedWorld(t, { groupName: "Individual Enrollment" });
    const { year, month, period, midMs } = previousMonth();

    await seedPrimary(t, world, {
      customerId: "stayer",
      memberId: "MEM-STAY",
      totalCents: 1499,
      createdAt: midMs,
    });
    await seedPrimary(t, world, {
      customerId: "leaver",
      memberId: "MEM-LEAVE",
      totalCents: 1499,
      createdAt: midMs,
    });
    // Cancelled before the month ended — never part of that close.
    await t.run(async (ctx) => {
      const bundles = await ctx.db.query("subscriptionBundles").collect();
      for (const bundle of bundles) {
        if (bundle.customerId === "leaver") {
          await ctx.db.patch(bundle._id, {
            status: "cancelled",
            cancelledAt: Date.UTC(year, month - 1, 20),
          });
        }
      }
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
    expect(statement.memberLines).toHaveLength(1);
    expect(statement.memberLines[0].memberId).toBe("MEM-STAY");
  });
});

// ---------------------------------------------------------------------------
// Owner overrides
// ---------------------------------------------------------------------------

describe("vendorStatements — owner overrides", () => {
  test("a mismatched rebuild names the members without moving the money", async () => {
    const t = convexTest(schema);
    const { period } = await seedClosedMonth(t);
    const closedGross = await t.run(async (ctx) => {
      const rows = await ctx.db.query("invoicePeriods").collect();
      return rows
        .filter((r) => r.period === period)
        .reduce((n, r) => n + r.grossCents, 0);
    });

    // Strip detail AND make the rebuild disagree with the close.
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("invoicePeriods").collect();
      for (const row of rows) {
        if (row.period === period) {
          await ctx.db.patch(row._id, {
            memberLines: undefined,
            grossCents: row.grossCents + 1499,
          });
        }
      }
    });

    const result = await asAdmin(t).mutation(
      api.admin.invoiceCalculator.backfillMemberLines,
      { period },
    );
    expect(result.mismatched).toBe(1);

    const { statementId } = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatement,
      { period, vendor: "ideal" },
    );
    const statement: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId },
    );
    expect(statement.memberLines).toHaveLength(2);

    // Totals were left exactly as closed — forcing adds names, not money.
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("invoicePeriods").collect();
      const gross = rows
        .filter((r) => r.period === period)
        .reduce((n, r) => n + r.grossCents, 0);
      expect(gross).toBe(closedGross + 1499);
      for (const row of rows) {
        if (row.period === period) {
          expect(row.memberLinesRebuilt).toBe("forced");
        }
      }
    });
  });

  test("statements can be deleted and regenerated from the same close", async () => {
    const t = convexTest(schema);
    const { period } = await seedClosedMonth(t);
    const first = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatementsForPeriod,
      { period },
    );
    expect(first.generated).toBe(4);

    const before: any[] = await asAdmin(t).query(
      api.admin.vendorStatements.listStatements,
      {},
    );
    const result = await asAdmin(t).mutation(
      api.admin.vendorStatements.deleteStatements,
      { statementIds: before.map((r) => r._id) },
    );
    expect(result.deleted).toBe(4);

    const after: any[] = await asAdmin(t).query(
      api.admin.vendorStatements.listStatements,
      {},
    );
    expect(after).toHaveLength(0);

    // The close is untouched, so the same month regenerates cleanly.
    const again = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatementsForPeriod,
      { period },
    );
    expect(again.generated).toBe(4);

    // Numbers keep climbing — a number already sent is never reissued.
    const fresh: any[] = await asAdmin(t).query(
      api.admin.vendorStatements.listStatements,
      {},
    );
    const lowestNew = Math.min(...fresh.map((r) => r.statementNumber));
    const highestOld = Math.max(...before.map((r) => r.statementNumber));
    expect(lowestNew).toBeGreaterThan(highestOld);
  });

  test("deleting a replacement leaves no dangling pointer on the original", async () => {
    const t = convexTest(schema);
    const { period } = await seedClosedMonth(t);
    const { statementId } = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatement,
      { period, vendor: "ideal" },
    );
    await asAdmin(t).mutation(api.admin.vendorStatements.issueStatement, {
      statementId,
    });
    const { replacementId } = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateReplacementStatement,
      { statementId, reason: "correction" },
    );

    await asAdmin(t).mutation(api.admin.vendorStatements.deleteStatements, {
      statementIds: [replacementId],
    });

    const original: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId },
    );
    expect(original.supersededById).toBeUndefined();
    expect(original.supersededByNumber).toBeNull();
    // And it can be un-voided again now that nothing supersedes it.
    await asAdmin(t).mutation(api.admin.vendorStatements.unvoidStatement, {
      statementId,
    });
  });

  test("bulk deletion by scope needs an explicit confirmation", async () => {
    const t = convexTest(schema);
    const { period } = await seedClosedMonth(t);
    await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatementsForPeriod,
      { period },
    );
    await expect(
      asAdmin(t).mutation(api.admin.vendorStatements.deleteStatements, { period }),
    ).rejects.toThrow(/confirmAll/i);

    const ok = await asAdmin(t).mutation(
      api.admin.vendorStatements.deleteStatements,
      { period, confirmAll: true },
    );
    expect(ok.deleted).toBe(4);
  });
});

describe("vendorStatements — members appear without being asked for", () => {
  test("generating a statement fills in any member list it can rebuild exactly", async () => {
    const t = convexTest(schema);
    const { period } = await seedClosedMonth(t);
    // A close with totals but no member list, as written before member lines
    // existed.
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("invoicePeriods").collect();
      for (const row of rows) {
        if (row.period === period) {
          await ctx.db.patch(row._id, { memberLines: undefined });
        }
      }
    });

    // No manual rebuild step — just generate.
    const { statementId } = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatement,
      { period, vendor: "ideal" },
    );
    const statement: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId },
    );
    expect(statement.memberDetailAvailable).toBe(true);
    expect(statement.memberDetailComplete).toBe(true);
    expect(statement.memberLines).toHaveLength(2);
    expect(statement.missingDetailGroups).toHaveLength(0);
  });

  test("an organization with no members left on file stays unnamed", async () => {
    const t = convexTest(schema);
    const { period } = await seedClosedMonth(t);
    await eraseMembers(t, ["solo", "house"]);
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("invoicePeriods").collect();
      for (const row of rows) {
        if (row.period === period) {
          await ctx.db.patch(row._id, { memberLines: undefined });
        }
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
    // Left for the owner to decide on, with the totals untouched.
    expect(statement.memberDetailComplete).toBe(false);
    expect(statement.missingDetailGroups.length).toBeGreaterThan(0);
  });
});

describe("vendorStatements — an exclusion foots everywhere", () => {
  test("an excluded primary comes out of the group rollup, not just the total", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const { year, month, period, midMs } = previousMonth();

    const employer = await seedWorld(t, {
      groupCode: "IDEALDO",
      groupName: "Apricus",
    });
    await t.run(async (ctx) => {
      await ctx.db.patch(employer.groupId, {
        listBill: { enabled: true, paymentMethod: "ach" as const },
      });
    });
    const direct = await seedWorld(t, {
      groupCode: "IDEALDO",
      groupName: "Individual Enrollment",
    });

    await seedPrimary(t, employer, {
      customerId: "emp-1",
      memberId: "MEM-EMP1",
      totalCents: 1499,
      createdAt: midMs,
    });
    await seedPrimary(t, employer, {
      customerId: "emp-2",
      memberId: "MEM-EMP2",
      totalCents: 2499,
      createdAt: midMs,
    });
    await seedPrimary(t, direct, {
      customerId: "comp",
      memberId: "MEM-COMP",
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
    const before: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId },
    );
    // The rollup foots before the exclusion.
    expect(
      before.groups.reduce((n: number, g: any) => n + g.amountCents, 0),
    ).toBe(before.subtotalCents);
    expect(
      before.groups.reduce((n: number, g: any) => n + g.primaryCount, 0),
    ).toBe(before.primaryCount);

    await asAdmin(t).mutation(
      api.admin.vendorStatements.excludeMemberFromStatement,
      { statementId, memberId: "MEM-COMP", reason: "Comp membership" },
    );

    const after: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId },
    );

    // …and still foots afterwards. This is the regression: the rollup used to
    // keep the excluded member while the total dropped, so the $6 looked as
    // though it had come off twice.
    expect(
      after.groups.reduce((n: number, g: any) => n + g.amountCents, 0),
    ).toBe(after.subtotalCents);
    expect(
      after.groups.reduce((n: number, g: any) => n + g.primaryCount, 0),
    ).toBe(after.primaryCount);
    expect(
      after.groups.reduce((n: number, g: any) => n + g.individualCount, 0),
    ).toBe(after.individualCount);
    expect(
      after.groups.reduce((n: number, g: any) => n + g.familyCount, 0),
    ).toBe(after.familyCount);

    // Exactly one $6 came off, once.
    expect(after.subtotalCents).toBe(before.subtotalCents - 600);
    expect(after.primaryCount).toBe(before.primaryCount - 1);

    // The organization that held only that member drops off the rollup.
    expect(
      after.groups.some((g: any) => g.groupName === "Direct enrollment"),
    ).toBe(false);
    expect(before.groups.some((g: any) => g.groupName === "Direct enrollment")).toBe(
      true,
    );

    // Restoring puts it back, still footing.
    await asAdmin(t).mutation(
      api.admin.vendorStatements.restoreMemberToStatement,
      { statementId, memberId: "MEM-COMP" },
    );
    const restored: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId },
    );
    expect(
      restored.groups.reduce((n: number, g: any) => n + g.amountCents, 0),
    ).toBe(restored.subtotalCents);
    expect(restored.subtotalCents).toBe(before.subtotalCents);
  });

  test("excluding from one organization leaves the others untouched", async () => {
    const t = convexTest(schema);
    const { period } = await seedClosedMonth(t);
    const { statementId } = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatement,
      { period, vendor: "ideal" },
    );
    const before: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId },
    );
    const victim = before.memberLines[0];

    await asAdmin(t).mutation(
      api.admin.vendorStatements.excludeMemberFromStatement,
      { statementId, memberId: victim.memberId, reason: "Billed in error" },
    );
    const after: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId },
    );
    expect(
      after.groups.reduce((n: number, g: any) => n + g.amountCents, 0),
    ).toBe(after.subtotalCents);
    expect(after.subtotalCents).toBe(before.subtotalCents - victim.amountCents);
  });
});

// ---------------------------------------------------------------------------
// Column picker
// ---------------------------------------------------------------------------

describe("vendorStatements — column selection", () => {
  test("only the chosen columns reach the generated file", async () => {
    const t = convexTest(schema);
    const { period } = await seedClosedMonth(t);

    await asAdmin(t).mutation(api.admin.vendorStatements.updateDisclosureProfile, {
      vendor: "toothlens",
      disclosure: disclosure({ on: ["rateClass"] }),
    });

    const { statementId } = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatement,
      { period, vendor: "toothlens" },
    );
    const statement: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId },
    );
    expect(statement.columns.map((c: any) => c.key)).toEqual([
      "memberId",
      "memberName",
      "rateClass",
      "amount",
    ]);
  });

  test("member, name, and amount cannot be switched off", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    await asAdmin(t).mutation(api.admin.vendorStatements.updateDisclosureProfile, {
      vendor: "careington",
      disclosure: {
        memberDetail: true,
        groupVisibility: "none",
        adjustmentDetail: true,
        // Deliberately try to drop the fixed columns.
        columns: [
          { key: "memberId", enabled: false },
          { key: "memberName", enabled: false },
          { key: "amount", enabled: false },
        ],
      },
    });
    const profiles: any[] = await asAdmin(t).query(
      api.admin.vendorStatements.listDisclosureProfiles,
      {},
    );
    const careington = profiles.find((p) => p.vendor === "careington");
    for (const key of ["memberId", "memberName", "amount"]) {
      expect(
        careington.current.columns.find((c: any) => c.key === key).enabled,
      ).toBe(true);
    }
  });

  test("a column that would expose another partner's pay is refused", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    for (const vendor of ["toothlens", "careington", "ideal"] as const) {
      await expect(
        asAdmin(t).mutation(api.admin.vendorStatements.updateDisclosureProfile, {
          vendor,
          disclosure: disclosure({ on: ["ryzeKeepCents"] }),
        }),
      ).rejects.toThrow(/other partners are paid/i);
    }
    // The internal statement may have them.
    await asAdmin(t).mutation(api.admin.vendorStatements.updateDisclosureProfile, {
      vendor: "ryze",
      disclosure: disclosure({ on: ["ryzeKeepCents", "grossCents"] }),
    });
  });

  test("a new registry column shows up disabled on an older saved profile", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    await asAdmin(t).mutation(api.admin.vendorStatements.updateDisclosureProfile, {
      vendor: "ideal",
      // A profile saved when only these columns existed.
      disclosure: {
        memberDetail: true,
        groupVisibility: "listBillOnly",
        adjustmentDetail: true,
        columns: [
          { key: "memberId", enabled: true },
          { key: "memberName", enabled: true },
          { key: "amount", enabled: true },
        ],
      },
    });
    const profiles: any[] = await asAdmin(t).query(
      api.admin.vendorStatements.listDisclosureProfiles,
      {},
    );
    const ideal = profiles.find((p) => p.vendor === "ideal");
    // Every registry column is represented; the unknown ones default off.
    expect(ideal.current.columns.length).toBeGreaterThan(3);
    expect(
      ideal.current.columns.find((c: any) => c.key === "repName").enabled,
    ).toBe(false);
  });

  test("organization columns drop out when the employer is not disclosed", async () => {
    const t = convexTest(schema);
    const { period } = await seedClosedMonth(t);
    await asAdmin(t).mutation(api.admin.vendorStatements.updateDisclosureProfile, {
      vendor: "ideal",
      // Organization column requested, but employer visibility turned off.
      disclosure: disclosure({ groupVisibility: "none", on: ["organization", "orgCode"] }),
    });
    const { statementId } = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatement,
      { period, vendor: "ideal" },
    );
    const statement: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId },
    );
    const keys = statement.columns.map((c: any) => c.key);
    expect(keys).not.toContain("organization");
    expect(keys).not.toContain("orgCode");
  });
});

// ---------------------------------------------------------------------------
// The rollup and the member list always describe the same people
// ---------------------------------------------------------------------------

describe("vendorStatements — the Group Summary matches the member list", () => {
  test("a member added after the close is counted in BOTH, not just the list", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const { year, month, period, midMs } = previousMonth();
    const soars = await seedWorld(t, {
      groupCode: "IDEALDO",
      groupName: "Soars",
    });
    await t.run(async (ctx) => {
      await ctx.db.patch(soars.groupId, {
        listBill: { enabled: true, paymentMethod: "ach" as const },
      });
    });

    for (const n of [1, 2] as const) {
      await seedPrimary(t, soars, {
        customerId: `soars-${n}`,
        memberId: `MBR-SOARS-${n}`,
        totalCents: 1499,
        createdAt: midMs,
      });
    }
    await asAdmin(t).mutation(api.admin.invoiceCalculator.closePeriodManual, {
      year,
      month,
    });

    // A third Soars primary turns up afterwards, backdated into the month —
    // exactly the "eligible member whose record landed late" case.
    await seedPrimary(t, soars, {
      customerId: "soars-3",
      memberId: "MBR-SOARS-3",
      totalCents: 1499,
      createdAt: midMs,
    });
    // Clear the frozen detail so the statement rebuilds from today's roster.
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("invoicePeriods").collect();
      for (const row of rows) {
        if (row.period === period) {
          await ctx.db.patch(row._id, { memberLines: undefined });
        }
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

    // Three members listed…
    expect(statement.memberLines).toHaveLength(3);
    // …and the rollup says three, not the two the month closed with.
    const soarsRow = statement.groups.find((g: any) => g.groupName === "Soars");
    expect(soarsRow.primaryCount).toBe(3);
    expect(soarsRow.individualCount).toBe(3);

    // Everything foots against everything else.
    expect(
      statement.groups.reduce((n: number, g: any) => n + g.primaryCount, 0),
    ).toBe(statement.memberLines.length);
    expect(
      statement.groups.reduce((n: number, g: any) => n + g.amountCents, 0),
    ).toBe(statement.subtotalCents);
    expect(statement.itemizedCents).toBe(statement.subtotalCents);
    expect(statement.individualCount + statement.familyCount).toBe(
      statement.primaryCount,
    );

    // And the month's original figure is still reported, so the drift is
    // visible rather than quietly absorbed.
    expect(statement.closedSubtotalCents).toBeLessThan(statement.subtotalCents);

    const audit: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatementVerification,
      { statementId },
    );
    const closeCheck = audit.checks.find((c: any) =>
      /matches what the month closed at/i.test(c.label),
    );
    expect(closeCheck.passed).toBe(false);
    expect(closeCheck.detail).toMatch(/roster has moved/i);
  });

  test("a clean close needs no reconciling — every figure agrees", async () => {
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
    expect(
      statement.groups.reduce((n: number, g: any) => n + g.primaryCount, 0),
    ).toBe(statement.memberLines.length);
    expect(statement.subtotalCents).toBe(statement.closedSubtotalCents);

    const audit: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatementVerification,
      { statementId },
    );
    expect(audit.allChecksPassed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Making the member list the record for a month
// ---------------------------------------------------------------------------

describe("invoiceCalculator — syncing a close to its member list", () => {
  async function seedDriftedMonth(t: ReturnType<typeof convexTest>) {
    await seedAdmin(t);
    const { year, month, period, midMs } = previousMonth();
    const world = await seedWorld(t, { groupCode: "IDEALDO", groupName: "Soars" });
    await t.run(async (ctx) => {
      await ctx.db.patch(world.groupId, {
        listBill: { enabled: true, paymentMethod: "ach" as const },
      });
    });
    for (const n of [1, 2] as const) {
      await seedPrimary(t, world, {
        customerId: `s-${n}`,
        memberId: `MBR-S${n}`,
        totalCents: 1499,
        createdAt: midMs,
      });
    }
    await asAdmin(t).mutation(api.admin.invoiceCalculator.closePeriodManual, {
      year,
      month,
    });
    // A third turns up afterwards, backdated into the month.
    await seedPrimary(t, world, {
      customerId: "s-3",
      memberId: "MBR-S3",
      totalCents: 1499,
      createdAt: midMs,
    });
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("invoicePeriods").collect();
      for (const row of rows) {
        if (row.period === period) {
          await ctx.db.patch(row._id, { memberLines: undefined });
        }
      }
    });
    return { period };
  }

  test("the close is rewritten to the member list, and the original is kept", async () => {
    const t = convexTest(schema);
    const { period } = await seedDriftedMonth(t);

    // Generating rebuilds the member list but leaves the close at two.
    await asAdmin(t).mutation(api.admin.vendorStatements.generateStatement, {
      period,
      vendor: "ideal",
    });
    const before = await t.run(async (ctx) => {
      const rows = await ctx.db.query("invoicePeriods").collect();
      const row = rows.find((r) => r.period === period)!;
      return {
        primaries: row.individualPrimaryCount + row.familyPrimaryCount,
        gross: row.grossCents,
        hash: row.payloadHash,
        closedAt: row.closedAt,
      };
    });
    expect(before.primaries).toBe(2);
    expect(before.gross).toBe(2 * 1499);

    const result = await asAdmin(t).mutation(
      api.admin.invoiceCalculator.syncClosedTotalsToMemberLines,
      { period },
    );
    expect(result.updated).toBe(1);
    expect(result.changes[0]).toMatch(/2 → 3 primaries/);

    await t.run(async (ctx) => {
      const rows = await ctx.db.query("invoicePeriods").collect();
      const row = rows.find((r) => r.period === period)!;
      // The close now describes the three people actually on it.
      expect(row.individualPrimaryCount + row.familyPrimaryCount).toBe(3);
      expect(row.grossCents).toBe(3 * 1499);
      // Nothing was destroyed — the original figures and hash are preserved.
      expect(row.supersededFigures!.grossCents).toBe(before.gross);
      expect(row.supersededFigures!.payloadHash).toBe(before.hash);
      expect(row.supersededFigures!.closedAt).toBe(before.closedAt);
      // And the row's own hash was recomputed for its new figures.
      expect(row.payloadHash).not.toBe(before.hash);
    });
  });

  test("after syncing, the statement reconciles cleanly", async () => {
    const t = convexTest(schema);
    const { period } = await seedDriftedMonth(t);
    await asAdmin(t).mutation(api.admin.vendorStatements.generateStatement, {
      period,
      vendor: "ideal",
    });
    await asAdmin(t).mutation(
      api.admin.invoiceCalculator.syncClosedTotalsToMemberLines,
      { period },
    );

    const fresh = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatement,
      { period, vendor: "ryze" },
    );
    const audit: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatementVerification,
      { statementId: fresh.statementId },
    );
    expect(audit.allChecksPassed).toBe(true);

    const statement: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId: fresh.statementId },
    );
    expect(statement.subtotalCents).toBe(statement.closedSubtotalCents);
    expect(statement.memberLines).toHaveLength(3);
  });

  test("syncing twice keeps the first original, not the second", async () => {
    const t = convexTest(schema);
    const { period } = await seedDriftedMonth(t);
    await asAdmin(t).mutation(api.admin.vendorStatements.generateStatement, {
      period,
      vendor: "ideal",
    });
    await asAdmin(t).mutation(
      api.admin.invoiceCalculator.syncClosedTotalsToMemberLines,
      { period },
    );
    const first = await t.run(async (ctx) => {
      const rows = await ctx.db.query("invoicePeriods").collect();
      return rows.find((r) => r.period === period)!.supersededFigures!;
    });

    const second = await asAdmin(t).mutation(
      api.admin.invoiceCalculator.syncClosedTotalsToMemberLines,
      { period },
    );
    expect(second.updated).toBe(0);
    expect(second.unchanged).toBe(1);

    await t.run(async (ctx) => {
      const rows = await ctx.db.query("invoicePeriods").collect();
      const row = rows.find((r) => r.period === period)!;
      expect(row.supersededFigures!.grossCents).toBe(first.grossCents);
    });
  });

  test("a month already in agreement is left completely alone", async () => {
    const t = convexTest(schema);
    const { period } = await seedClosedMonth(t);
    const result = await asAdmin(t).mutation(
      api.admin.invoiceCalculator.syncClosedTotalsToMemberLines,
      { period },
    );
    expect(result.updated).toBe(0);
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("invoicePeriods").collect();
      for (const row of rows) {
        if (row.period === period) {
          expect(row.supersededFigures).toBeUndefined();
        }
      }
    });
  });

  test("the sync is written to the activity trail with what moved", async () => {
    const t = convexTest(schema);
    const { period } = await seedDriftedMonth(t);
    await asAdmin(t).mutation(api.admin.vendorStatements.generateStatement, {
      period,
      vendor: "ideal",
    });
    await asAdmin(t).mutation(
      api.admin.invoiceCalculator.syncClosedTotalsToMemberLines,
      { period },
    );
    const trail: any[] = await asAdmin(t).query(
      api.admin.vendorStatements.listStatementActivity,
      {},
    );
    const entry = trail.find((e) => e.action === "invoice.syncClosedTotals");
    expect(entry).toBeDefined();
    expect(entry.kind).toBe("money");
    expect(entry.summary).toMatch(/1 organization\(s\) updated/);
  });
});

describe("vendorStatements — live member columns", () => {
  test("member-record fields can be put on a statement and are read live", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const world = await seedWorld(t, { groupName: "Apricus" });
    const { year, month, period, midMs } = previousMonth();
    const memberProfileId = await seedPrimary(t, world, {
      customerId: "cust-live",
      memberId: "MBR-LIVE",
      totalCents: 1499,
      createdAt: midMs,
    });
    await t.run(async (ctx) => {
      await ctx.db.patch(memberProfileId, {
        dateOfBirth: "1985-04-02",
        department: "Operations",
        location: "Tampa",
        careingtonUniqueId: "CAR-99",
        address: {
          line1: "1 Main St",
          city: "Tampa",
          state: "FL",
          postalCode: "33601",
          country: "US",
        },
      });
    });
    await asAdmin(t).mutation(api.admin.invoiceCalculator.closePeriodManual, {
      year,
      month,
    });

    await asAdmin(t).mutation(api.admin.vendorStatements.updateDisclosureProfile, {
      vendor: "ideal",
      disclosure: disclosure({
        on: ["memberEmail", "dob", "department", "city", "state", "careingtonId", "censusMissing"],
      }),
    });

    const { statementId } = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatement,
      { period, vendor: "ideal" },
    );
    const statement: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId },
    );

    const labels = statement.columns.map((c: any) => c.label);
    expect(labels).toContain("Member Email");
    expect(labels).toContain("DOB");
    expect(labels).toContain("Careington ID");

    const line = statement.memberLines[0];
    expect(line.extra.dob).toBe("1985-04-02");
    expect(line.extra.department).toBe("Operations");
    expect(line.extra.city).toBe("Tampa");
    expect(line.extra.state).toBe("FL");
    expect(line.extra.careingtonId).toBe("CAR-99");
    expect(line.extra.memberEmail).toBe("cust-live@vs.test");

    // Descriptive fields are read live, so correcting a record shows up
    // without regenerating — no figure moves.
    await t.run(async (ctx) => {
      await ctx.db.patch(memberProfileId, { department: "Finance" });
    });
    const after: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId },
    );
    expect(after.memberLines[0].extra.department).toBe("Finance");
    expect(after.subtotalCents).toBe(statement.subtotalCents);
  });

  test("nothing is hydrated when no live column is switched on", async () => {
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
    expect(statement.memberLines[0].extra).toBeUndefined();
  });

  test("missing census fields are reported per member", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const world = await seedWorld(t);
    const { year, month, period, midMs } = previousMonth();
    const memberProfileId = await seedPrimary(t, world, {
      customerId: "sparse",
      memberId: "MBR-SPARSE",
      totalCents: 1499,
      createdAt: midMs,
    });
    // Strip the email — the exact gap flagged in the User Audit.
    await t.run(async (ctx) => {
      await ctx.db.patch(memberProfileId, { email: undefined });
    });
    await asAdmin(t).mutation(api.admin.invoiceCalculator.closePeriodManual, {
      year,
      month,
    });
    await asAdmin(t).mutation(api.admin.vendorStatements.updateDisclosureProfile, {
      vendor: "ryze",
      disclosure: disclosure({ groupVisibility: "all", on: ["censusMissing"] }),
    });
    const { statementId } = await asAdmin(t).mutation(
      api.admin.vendorStatements.generateStatement,
      { period, vendor: "ryze" },
    );
    const statement: any = await asAdmin(t).query(
      api.admin.vendorStatements.getStatement,
      { statementId },
    );
    expect(statement.memberLines[0].extra.censusMissing).toContain("Email");
    // …and the member is still billed regardless.
    expect(statement.memberLines[0].amountCents).toBeGreaterThan(0);
  });
});
