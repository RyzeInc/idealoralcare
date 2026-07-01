/**
 * LIST-BILL INVOICE GENERATOR — server tests
 *
 * Covers spec §17 test fixtures T1–T18.
 * Key reference: T8 = 18 MO × 5795 cents = 104310 cents ($1,043.10)
 *
 * NOTE: convex-test t.run() context types against SystemIndexes only.
 * Do NOT use .withIndex() inside t.run(); use .collect().find() instead.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

const ADMIN_TOKEN = "https://test.clerk.dev|admin_user_lbi";

async function seedAdmin(t: ReturnType<typeof convexTest>) {
  await t.run(async (ctx) => {
    await ctx.db.insert("adminUsers", {
      clerkUserId: "admin_user_lbi",
      email: "admin@lbi.test",
      name: "LBI Admin",
      role: "owner",
      createdAt: Date.now(),
    });
  });
}

function asAdmin(t: ReturnType<typeof convexTest>) {
  return t.withIdentity({ tokenIdentifier: ADMIN_TOKEN });
}

// ---------------------------------------------------------------------------
// World types + seeding
// ---------------------------------------------------------------------------

interface World {
  siteId: Id<"sites">;
  accountId: Id<"accounts">;
  groupId: Id<"groups">;
}

interface LBWorld extends World {
  groupId: Id<"groups">; // list-bill enabled
}

async function seedBaseWorld(
  t: ReturnType<typeof convexTest>,
  opts: {
    listBillEnabled?: boolean;
    paymentDueDayOfMonth?: number;
    customRates?: { moCents: number; msCents: number; mfCents: number };
    groupCode?: string;
  } = {},
): Promise<LBWorld> {
  return t.run(async (ctx) => {
    const now = Date.now();
    const siteId = await ctx.db.insert("sites", {
      slug: `s-${Math.random().toString(36).slice(2)}`,
      name: "LBI Site",
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
      name: "LBI Account",
      accountType: "employer",
      billingModel: "per_member",
      contacts: [],
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    const listBillConfig = opts.listBillEnabled !== false
      ? {
          listBill: {
            enabled: true as const,
            paymentMethod: "ach" as const,
            ...(opts.paymentDueDayOfMonth !== undefined
              ? { paymentDueDayOfMonth: opts.paymentDueDayOfMonth }
              : {}),
            ...(opts.customRates
              ? {
                  rates: {
                    moCents: opts.customRates.moCents,
                    msCents: opts.customRates.msCents,
                    mfCents: opts.customRates.mfCents,
                    rateLabel: "Custom Rate",
                  },
                }
              : {}),
          },
        }
      : {};

    const groupId = await ctx.db.insert("groups", {
      siteId,
      accountId,
      slug: `g-${Math.random().toString(36).slice(2)}`,
      name: "LBI Group",
      groupCode: opts.groupCode ?? "LBITEST",
      status: "active",
      ...listBillConfig,
      createdAt: now,
      updatedAt: now,
    });

    return { siteId, accountId, groupId };
  });
}

async function seedPrimary(
  t: ReturnType<typeof convexTest>,
  world: World,
  opts: {
    firstName?: string;
    lastName?: string;
    memberType?: "active" | "enrolling" | "eligible" | "terminated";
    relationship?: "spouse" | "child" | "domestic_partner" | "other";
    noEmail?: boolean;
    noCustomerId?: boolean;
    effectiveDate?: string;
    createdAt?: number;
  } = {},
): Promise<Id<"memberProfiles">> {
  return t.run(async (ctx) => {
    return ctx.db.insert("memberProfiles", {
      memberId: `M${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      barcode: Math.random().toString(36).slice(2, 14).toUpperCase(),
      customerId: opts.noCustomerId ? undefined : `cust_${Math.random().toString(36).slice(2)}`,
      siteId: world.siteId,
      accountId: world.accountId,
      groupId: world.groupId,
      memberRole: "primary",
      firstName: opts.firstName ?? "Alice",
      lastName: opts.lastName ?? "Doe",
      email: opts.noEmail ? undefined : `${Math.random().toString(36).slice(2)}@test.lbi`,
      memberType: opts.memberType ?? "active",
      status: "active",
      effectiveDate: opts.effectiveDate,
      // Default to a fixed long-past date (not Date.now()) so tests that seed
      // a member for an arbitrary historical coveragePeriod (e.g. "2025-07")
      // aren't tripped up by the existedByPeriodEnd gate unless a test is
      // specifically exercising it (via an explicit `createdAt` override).
      createdAt: opts.createdAt ?? Date.UTC(2000, 0, 1),
      updatedAt: Date.now(),
    });
  });
}

async function seedDependent(
  t: ReturnType<typeof convexTest>,
  world: World,
  primaryId: Id<"memberProfiles">,
  opts: {
    relationship?: "spouse" | "child" | "domestic_partner" | "other";
    memberType?: "active" | "enrolling" | "terminated";
    effectiveDate?: string;
    createdAt?: number;
  } = {},
): Promise<Id<"memberProfiles">> {
  return t.run(async (ctx) => {
    return ctx.db.insert("memberProfiles", {
      memberId: `D${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      barcode: Math.random().toString(36).slice(2, 14).toUpperCase(),
      customerId: `cust_${Math.random().toString(36).slice(2)}`,
      siteId: world.siteId,
      accountId: world.accountId,
      groupId: world.groupId,
      memberRole: "dependent",
      primaryMemberId: primaryId,
      relationship: opts.relationship,
      firstName: "Bob",
      lastName: "Dep",
      email: `${Math.random().toString(36).slice(2)}@dep.lbi`,
      memberType: opts.memberType ?? "active",
      status: "active",
      effectiveDate: opts.effectiveDate,
      createdAt: opts.createdAt ?? Date.UTC(2000, 0, 1),
      updatedAt: Date.now(),
    });
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const generate = api.admin.listBillInvoices.generateInvoice;
const issueInv = api.admin.listBillInvoices.issueInvoice;
const getInvoice = api.admin.listBillInvoices.getInvoice;
const listInvoices = api.admin.listBillInvoices.listInvoices;
const previewInvoice = api.admin.listBillInvoices.previewInvoice;
const recordPayment = api.admin.listBillInvoices.recordPayment;
const applyAdjustment = api.admin.listBillInvoices.applyAdjustment;
const voidInvoice = api.admin.listBillInvoices.voidInvoice;
const unvoidInvoice = api.admin.listBillInvoices.unvoidInvoice;
const genReplacement = api.admin.listBillInvoices.generateReplacementInvoice;
const getHistory = api.admin.listBillInvoices.getGroupInvoiceHistory;
const getAging = api.admin.listBillInvoices.getGroupAgingSummary;
const markOverdue = internal.admin.listBillInvoices.markOverdueInvoices;
const generateMonthly = internal.admin.listBillInvoices.generateMonthlyInvoices;

// ---------------------------------------------------------------------------
// T1 — generateInvoice: creates draft with correct tier/rate/subtotal
// ---------------------------------------------------------------------------
describe("T1 — generateInvoice creates draft invoice", () => {
  test("MO member uses MO rate, subtotalCents = rateCents", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const world = await seedBaseWorld(t, {
      customRates: { moCents: 1499, msCents: 2499, mfCents: 2499 },
    });
    await seedPrimary(t, world); // 1 MO

    const { invoiceId } = await asAdmin(t).mutation(generate, {
      groupId: world.groupId,
      coveragePeriod: "2025-07",
    });

    const inv = await asAdmin(t).query(getInvoice, { invoiceId });
    expect(inv).not.toBeNull();
    expect(inv!.status).toBe("draft");
    expect(inv!.memberCount).toBe(1);
    expect(inv!.moCount).toBe(1);
    expect(inv!.msCount).toBe(0);
    expect(inv!.mfCount).toBe(0);
    expect(inv!.subtotalCents).toBe(1499);
    expect(inv!.totalCents).toBe(1499);
    expect(inv!.balanceCents).toBe(1499);
    expect(inv!.adjustmentCents).toBe(0);
    expect(inv!.amountPaidCents).toBe(0);
    expect(inv!.lines).toHaveLength(1);
    expect(inv!.lines[0].tier).toBe("MO");
  });

  test("eligibility-imported member with no email (memberType='eligible', unprovisioned) is still billed", async () => {
    // Regression test: members loaded from an employer eligibility file with no
    // email address can never be Clerk-provisioned (see eligibilityProvisioning.ts,
    // which requires an email) and so stay in memberType="eligible" forever. They
    // must still appear on the list-bill invoice — the employer owes for them
    // regardless of whether the member has ever signed into the portal.
    const t = convexTest(schema);
    await seedAdmin(t);
    const world = await seedBaseWorld(t, {
      customRates: { moCents: 1499, msCents: 2499, mfCents: 2499 },
    });
    await seedPrimary(t, world, {
      firstName: "Harlie",
      lastName: "Waters",
      memberType: "eligible",
      noEmail: true,
      noCustomerId: true,
    });

    const { invoiceId } = await asAdmin(t).mutation(generate, {
      groupId: world.groupId,
      coveragePeriod: "2025-07",
    });

    const inv = await asAdmin(t).query(getInvoice, { invoiceId });
    expect(inv!.memberCount).toBe(1);
    expect(inv!.lines).toHaveLength(1);
    expect(inv!.lines[0].lastName).toBe("Waters");
    expect(inv!.subtotalCents).toBe(1499);
  });
});

// ---------------------------------------------------------------------------
// T1b — Effective-date gating: don't bill for coverage that hasn't started
// ---------------------------------------------------------------------------
describe("T1b — generateInvoice respects member effectiveDate", () => {
  test("primary with effectiveDate after the coverage period is excluded", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const world = await seedBaseWorld(t, {
      customRates: { moCents: 1499, msCents: 2499, mfCents: 2499 },
    });
    // Group is billing 2026-07, but this member's coverage doesn't start until 2026-08.
    await seedPrimary(t, world, { firstName: "Future", lastName: "Member", effectiveDate: "2026-08-01" });

    const { invoiceId } = await asAdmin(t).mutation(generate, {
      groupId: world.groupId,
      coveragePeriod: "2026-07",
    });

    const inv = await asAdmin(t).query(getInvoice, { invoiceId });
    expect(inv!.memberCount).toBe(0);
    expect(inv!.lines).toHaveLength(0);
    expect(inv!.subtotalCents).toBe(0);
  });

  test("primary with effectiveDate within/before the coverage period is included", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const world = await seedBaseWorld(t, {
      customRates: { moCents: 1499, msCents: 2499, mfCents: 2499 },
    });
    await seedPrimary(t, world, { firstName: "Current", lastName: "Member", effectiveDate: "2026-07-15" });

    const { invoiceId } = await asAdmin(t).mutation(generate, {
      groupId: world.groupId,
      coveragePeriod: "2026-07",
    });

    const inv = await asAdmin(t).query(getInvoice, { invoiceId });
    expect(inv!.memberCount).toBe(1);
    expect(inv!.lines[0].lastName).toBe("Member");
  });

  test("member with no effectiveDate set is still billed (fail-open for legacy records)", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const world = await seedBaseWorld(t, {
      customRates: { moCents: 1499, msCents: 2499, mfCents: 2499 },
    });
    await seedPrimary(t, world, { firstName: "NoDate", lastName: "Member" });

    const { invoiceId } = await asAdmin(t).mutation(generate, {
      groupId: world.groupId,
      coveragePeriod: "2026-07",
    });

    const inv = await asAdmin(t).query(getInvoice, { invoiceId });
    expect(inv!.memberCount).toBe(1);
  });

  test("dependent with a future effectiveDate doesn't count toward tier/dependentCount", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const world = await seedBaseWorld(t, {
      customRates: { moCents: 1499, msCents: 2499, mfCents: 2499 },
    });
    const pid = await seedPrimary(t, world, { firstName: "Parent", lastName: "Member" });
    await seedDependent(t, world, pid, { effectiveDate: "2026-09-01" }); // future, should not count

    const { invoiceId } = await asAdmin(t).mutation(generate, {
      groupId: world.groupId,
      coveragePeriod: "2026-07",
    });

    const inv = await asAdmin(t).query(getInvoice, { invoiceId });
    expect(inv!.memberCount).toBe(1);
    expect(inv!.lines[0].tier).toBe("MO"); // dependent excluded, so still member-only
    expect(inv!.lines[0].dependentCount).toBe(0);
  });

  test("preview also respects effectiveDate gating", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const world = await seedBaseWorld(t, {
      customRates: { moCents: 1499, msCents: 2499, mfCents: 2499 },
    });
    await seedPrimary(t, world, { effectiveDate: "2026-08-01" });

    const preview = await asAdmin(t).query(previewInvoice, {
      groupId: world.groupId,
      coveragePeriod: "2026-07",
    });
    expect(preview!.memberCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// T1c — System-entry gating: don't retroactively bill a past period for
//   members Ideal didn't know about yet (added via a later eligibility file),
//   even if their effectiveDate predates the period being generated.
// ---------------------------------------------------------------------------
describe("T1c — generateInvoice respects when a member was added to the system", () => {
  test("member created after the coverage period end is excluded, even with an earlier effectiveDate", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const world = await seedBaseWorld(t, {
      customRates: { moCents: 1499, msCents: 2499, mfCents: 2499 },
    });
    // Real-world hire date is well before May, but this member wasn't added to
    // Ideal's system (via eligibility file) until a June upload.
    await seedPrimary(t, world, {
      firstName: "LateAdd",
      lastName: "Member",
      effectiveDate: "2026-01-15",
      createdAt: Date.UTC(2026, 5, 20), // 2026-06-20
    });

    const { invoiceId } = await asAdmin(t).mutation(generate, {
      groupId: world.groupId,
      coveragePeriod: "2026-05",
    });

    const inv = await asAdmin(t).query(getInvoice, { invoiceId });
    expect(inv!.memberCount).toBe(0);
    expect(inv!.lines).toHaveLength(0);
  });

  test("same member is included once billing reaches a period on/after their system-entry date", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const world = await seedBaseWorld(t, {
      customRates: { moCents: 1499, msCents: 2499, mfCents: 2499 },
    });
    await seedPrimary(t, world, {
      firstName: "LateAdd",
      lastName: "Member",
      effectiveDate: "2026-01-15",
      createdAt: Date.UTC(2026, 5, 20), // 2026-06-20
    });

    const { invoiceId } = await asAdmin(t).mutation(generate, {
      groupId: world.groupId,
      coveragePeriod: "2026-06",
    });

    const inv = await asAdmin(t).query(getInvoice, { invoiceId });
    expect(inv!.memberCount).toBe(1);
    expect(inv!.lines[0].lastName).toBe("Member");
  });

  test("dependent created after the coverage period end doesn't count toward tier/dependentCount", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const world = await seedBaseWorld(t, {
      customRates: { moCents: 1499, msCents: 2499, mfCents: 2499 },
    });
    const pid = await seedPrimary(t, world, { firstName: "Parent", lastName: "Member" });
    await seedDependent(t, world, pid, {
      relationship: "spouse",
      effectiveDate: "2026-01-01",
      createdAt: Date.UTC(2026, 5, 20), // added June, after the May period
    });

    const { invoiceId } = await asAdmin(t).mutation(generate, {
      groupId: world.groupId,
      coveragePeriod: "2026-05",
    });

    const inv = await asAdmin(t).query(getInvoice, { invoiceId });
    expect(inv!.memberCount).toBe(1);
    expect(inv!.lines[0].tier).toBe("MO");
    expect(inv!.lines[0].dependentCount).toBe(0);
  });

  test("preview also respects system-entry gating", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const world = await seedBaseWorld(t, {
      customRates: { moCents: 1499, msCents: 2499, mfCents: 2499 },
    });
    await seedPrimary(t, world, {
      effectiveDate: "2026-01-01",
      createdAt: Date.UTC(2026, 5, 20),
    });

    const preview = await asAdmin(t).query(previewInvoice, {
      groupId: world.groupId,
      coveragePeriod: "2026-05",
    });
    expect(preview!.memberCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// T2 — Idempotency: second generateInvoice returns existing
// ---------------------------------------------------------------------------
describe("T2 — generateInvoice idempotency", () => {
  test("returns existing invoice on duplicate call", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const world = await seedBaseWorld(t, {
      customRates: { moCents: 1499, msCents: 2499, mfCents: 2499 },
    });
    await seedPrimary(t, world);

    const r1 = await asAdmin(t).mutation(generate, {
      groupId: world.groupId,
      coveragePeriod: "2025-07",
    });
    const r2 = await asAdmin(t).mutation(generate, {
      groupId: world.groupId,
      coveragePeriod: "2025-07",
    });

    expect(r2.created).toBe(false);
    expect(r2.invoiceId).toBe(r1.invoiceId);

    // Only 1 invoice in DB
    const rows = await asAdmin(t).query(listInvoices, {
      groupId: world.groupId,
      period: "2025-07",
    });
    expect(rows).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// T3 — Tier classification: 1 spouse dep → MS
// ---------------------------------------------------------------------------
describe("T3 — tier classification spouse → MS", () => {
  test("one spouse dep yields MS", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const world = await seedBaseWorld(t, {
      customRates: { moCents: 1499, msCents: 2199, mfCents: 2499 },
    });
    const pid = await seedPrimary(t, world);
    await seedDependent(t, world, pid, { relationship: "spouse" });

    const { invoiceId } = await asAdmin(t).mutation(generate, {
      groupId: world.groupId,
      coveragePeriod: "2025-07",
    });

    const inv = await asAdmin(t).query(getInvoice, { invoiceId });
    expect(inv!.lines[0].tier).toBe("MS");
    expect(inv!.lines[0].rateCents).toBe(2199);
    expect(inv!.msCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// T4 — Tier classification: 1 child dep → MF
// ---------------------------------------------------------------------------
describe("T4 — tier classification child → MF", () => {
  test("one child dep yields MF", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const world = await seedBaseWorld(t, {
      customRates: { moCents: 1499, msCents: 2199, mfCents: 2499 },
    });
    const pid = await seedPrimary(t, world);
    await seedDependent(t, world, pid, { relationship: "child" });

    const { invoiceId } = await asAdmin(t).mutation(generate, {
      groupId: world.groupId,
      coveragePeriod: "2025-07",
    });

    const inv = await asAdmin(t).query(getInvoice, { invoiceId });
    expect(inv!.lines[0].tier).toBe("MF");
    expect(inv!.mfCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// T5 — Tier classification: 2 deps → MF regardless of relationship
// ---------------------------------------------------------------------------
describe("T5 — tier classification two deps → MF", () => {
  test("two deps yield MF", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const world = await seedBaseWorld(t, {
      customRates: { moCents: 1499, msCents: 2199, mfCents: 2499 },
    });
    const pid = await seedPrimary(t, world);
    await seedDependent(t, world, pid, { relationship: "spouse" });
    await seedDependent(t, world, pid, { relationship: "spouse" }); // 2nd forces MF

    const { invoiceId } = await asAdmin(t).mutation(generate, {
      groupId: world.groupId,
      coveragePeriod: "2025-07",
    });

    const inv = await asAdmin(t).query(getInvoice, { invoiceId });
    expect(inv!.lines[0].tier).toBe("MF");
    expect(inv!.lines[0].dependentCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// T6 — issueInvoice: draft → issued
// ---------------------------------------------------------------------------
describe("T6 — issueInvoice transitions status", () => {
  test("draft becomes issued", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const world = await seedBaseWorld(t);
    await seedPrimary(t, world);

    const { invoiceId } = await asAdmin(t).mutation(generate, {
      groupId: world.groupId,
      coveragePeriod: "2025-07",
    });
    await asAdmin(t).mutation(issueInv, { invoiceId });

    const inv = await asAdmin(t).query(getInvoice, { invoiceId });
    expect(inv!.status).toBe("issued");
    expect(inv!.issuedAt).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// T7 — recordPayment: full payment → paid, balance = 0
// ---------------------------------------------------------------------------
describe("T7 — recordPayment full", () => {
  test("full payment sets status=paid, balance=0", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const world = await seedBaseWorld(t, {
      customRates: { moCents: 1499, msCents: 2499, mfCents: 2499 },
    });
    await seedPrimary(t, world);

    const { invoiceId } = await asAdmin(t).mutation(generate, {
      groupId: world.groupId,
      coveragePeriod: "2025-07",
    });
    await asAdmin(t).mutation(issueInv, { invoiceId });
    await asAdmin(t).mutation(recordPayment, {
      invoiceId,
      amountCents: 1499,
      paymentMethod: "check",
      checkNumber: "4421",
    });

    const inv = await asAdmin(t).query(getInvoice, { invoiceId });
    expect(inv!.status).toBe("paid");
    expect(inv!.balanceCents).toBe(0);
    expect(inv!.amountPaidCents).toBe(1499);
  });
});

// ---------------------------------------------------------------------------
// T8 — Key reference: 18 MO × $57.95 = $1,043.10
// ---------------------------------------------------------------------------
describe("T8 — reference case: 18 MO × 5795 = 104310 cents", () => {
  test("subtotal = 104310 cents", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const world = await seedBaseWorld(t, {
      customRates: { moCents: 5795, msCents: 7995, mfCents: 9995 },
    });
    for (let i = 0; i < 18; i++) {
      await seedPrimary(t, world, { firstName: `P${i}`, lastName: "Ref" });
    }

    const { invoiceId } = await asAdmin(t).mutation(generate, {
      groupId: world.groupId,
      coveragePeriod: "2025-08",
    });

    const inv = await asAdmin(t).query(getInvoice, { invoiceId });
    expect(inv!.memberCount).toBe(18);
    expect(inv!.moCount).toBe(18);
    expect(inv!.subtotalCents).toBe(104310);
    expect(inv!.totalCents).toBe(104310);
    // LBI-01: every line.rateCents sums to subtotal
    const lineSum = inv!.lines.reduce((s: number, l: any) => s + l.rateCents, 0);
    expect(lineSum).toBe(inv!.subtotalCents);
  });
});

// ---------------------------------------------------------------------------
// T9 — applyAdjustment credit
// ---------------------------------------------------------------------------
describe("T9 — applyAdjustment credit", () => {
  test("negative adjustment reduces totalCents and balanceCents", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const world = await seedBaseWorld(t, {
      customRates: { moCents: 1499, msCents: 2499, mfCents: 2499 },
    });
    await seedPrimary(t, world);

    const { invoiceId } = await asAdmin(t).mutation(generate, {
      groupId: world.groupId,
      coveragePeriod: "2025-07",
    });

    await asAdmin(t).mutation(applyAdjustment, {
      invoiceId,
      adjustmentCents: -200,
      notes: "Courtesy credit",
    });

    const inv = await asAdmin(t).query(getInvoice, { invoiceId });
    expect(inv!.adjustmentCents).toBe(-200);
    expect(inv!.totalCents).toBe(1299); // 1499 - 200
    expect(inv!.balanceCents).toBe(1299);
  });
});

// ---------------------------------------------------------------------------
// T10 — voidInvoice: invoice becomes voided, no further payment allowed
// ---------------------------------------------------------------------------
describe("T10 — voidInvoice", () => {
  test("voided invoice cannot receive payment", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const world = await seedBaseWorld(t);
    await seedPrimary(t, world);

    const { invoiceId } = await asAdmin(t).mutation(generate, {
      groupId: world.groupId,
      coveragePeriod: "2025-07",
    });
    await asAdmin(t).mutation(issueInv, { invoiceId });
    await asAdmin(t).mutation(voidInvoice, {
      invoiceId,
      reason: "Test void",
    });

    const inv = await asAdmin(t).query(getInvoice, { invoiceId });
    expect(inv!.status).toBe("voided");

    await expect(
      asAdmin(t).mutation(recordPayment, {
        invoiceId,
        amountCents: 100,
        paymentMethod: "check",
      }),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// T10b — unvoidInvoice: restores prior status and re-allows mutation
// ---------------------------------------------------------------------------
describe("T10b — unvoidInvoice", () => {
  test("restores an issued invoice to issued and allows payment again", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const world = await seedBaseWorld(t);
    await seedPrimary(t, world);

    const { invoiceId } = await asAdmin(t).mutation(generate, {
      groupId: world.groupId,
      coveragePeriod: "2025-07",
    });
    await asAdmin(t).mutation(issueInv, { invoiceId });
    await asAdmin(t).mutation(voidInvoice, { invoiceId, reason: "Oops" });

    let inv = await asAdmin(t).query(getInvoice, { invoiceId });
    expect(inv!.status).toBe("voided");

    await asAdmin(t).mutation(unvoidInvoice, { invoiceId });

    inv = await asAdmin(t).query(getInvoice, { invoiceId });
    expect(inv!.status).toBe("issued");
    expect(inv!.previousStatus).toBeUndefined();
    expect(inv!.unvoidedAt).toBeDefined();

    // Payment should work again post-unvoid
    await asAdmin(t).mutation(recordPayment, {
      invoiceId,
      amountCents: inv!.totalCents,
      paymentMethod: "check",
    });
    inv = await asAdmin(t).query(getInvoice, { invoiceId });
    expect(inv!.status).toBe("paid");
  });

  test("refuses to unvoid an invoice already superseded by a replacement", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const world = await seedBaseWorld(t);
    await seedPrimary(t, world);

    const { invoiceId: origId } = await asAdmin(t).mutation(generate, {
      groupId: world.groupId,
      coveragePeriod: "2025-07",
    });
    await asAdmin(t).mutation(voidInvoice, { invoiceId: origId, reason: "Error" });
    await asAdmin(t).mutation(genReplacement, { voidedInvoiceId: origId });

    await expect(
      asAdmin(t).mutation(unvoidInvoice, { invoiceId: origId }),
    ).rejects.toThrow(/superseded/);
  });

  test("throws when invoice is not voided", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const world = await seedBaseWorld(t);
    await seedPrimary(t, world);

    const { invoiceId } = await asAdmin(t).mutation(generate, {
      groupId: world.groupId,
      coveragePeriod: "2025-07",
    });

    await expect(
      asAdmin(t).mutation(unvoidInvoice, { invoiceId }),
    ).rejects.toThrow(/not voided/);
  });
});

// ---------------------------------------------------------------------------
// T11 — generateReplacementInvoice
// ---------------------------------------------------------------------------
describe("T11 — generateReplacementInvoice", () => {
  test("creates new draft, links supersededById on voided invoice", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const world = await seedBaseWorld(t);
    await seedPrimary(t, world);

    const { invoiceId: origId } = await asAdmin(t).mutation(generate, {
      groupId: world.groupId,
      coveragePeriod: "2025-07",
    });
    await asAdmin(t).mutation(voidInvoice, { invoiceId: origId, reason: "Error" });

    const { invoiceId: replId } = await asAdmin(t).mutation(genReplacement, {
      voidedInvoiceId: origId,
    });

    const orig = await asAdmin(t).query(getInvoice, { invoiceId: origId });
    const repl = await asAdmin(t).query(getInvoice, { invoiceId: replId });

    expect(orig!.supersededById).toBe(replId);
    expect(repl!.status).toBe("draft");
  });
});

// ---------------------------------------------------------------------------
// T12 — previewInvoice: non-persisted calculation
// ---------------------------------------------------------------------------
describe("T12 — previewInvoice", () => {
  test("returns preview without creating a DB row", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const world = await seedBaseWorld(t, {
      customRates: { moCents: 1499, msCents: 2499, mfCents: 2499 },
    });
    await seedPrimary(t, world);
    await seedPrimary(t, world); // 2 MO

    const preview = await asAdmin(t).query(previewInvoice, {
      groupId: world.groupId,
      coveragePeriod: "2025-09",
    });

    expect(preview).not.toBeNull();
    expect(preview!.source).toBe("preview");
    expect(preview!.memberCount).toBe(2);
    expect(preview!.subtotalCents).toBe(2998); // 2 × 1499

    // No invoice created in DB
    const rows = await asAdmin(t).query(listInvoices, {
      groupId: world.groupId,
      period: "2025-09",
    });
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// T13 — Terminated members excluded
// ---------------------------------------------------------------------------
describe("T13 — terminated members excluded", () => {
  test("only active/enrolling primaries appear in lines", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const world = await seedBaseWorld(t, {
      customRates: { moCents: 1499, msCents: 2499, mfCents: 2499 },
    });
    await seedPrimary(t, world, { memberType: "active" });
    await seedPrimary(t, world, { memberType: "terminated" }); // should be excluded

    const { invoiceId } = await asAdmin(t).mutation(generate, {
      groupId: world.groupId,
      coveragePeriod: "2025-07",
    });

    const inv = await asAdmin(t).query(getInvoice, { invoiceId });
    expect(inv!.memberCount).toBe(1);
    expect(inv!.lines).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// T14 — partial payment → partial status
// ---------------------------------------------------------------------------
describe("T14 — partial payment", () => {
  test("partial payment sets status=partial, balance=remainder", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const world = await seedBaseWorld(t, {
      customRates: { moCents: 5000, msCents: 7000, mfCents: 9000 },
    });
    await seedPrimary(t, world);
    await seedPrimary(t, world); // total = 10000

    const { invoiceId } = await asAdmin(t).mutation(generate, {
      groupId: world.groupId,
      coveragePeriod: "2025-07",
    });
    await asAdmin(t).mutation(issueInv, { invoiceId });
    await asAdmin(t).mutation(recordPayment, {
      invoiceId,
      amountCents: 4000,
      paymentMethod: "ach",
    });

    const inv = await asAdmin(t).query(getInvoice, { invoiceId });
    expect(inv!.status).toBe("partial");
    expect(inv!.amountPaidCents).toBe(4000);
    expect(inv!.balanceCents).toBe(6000);
  });
});

// ---------------------------------------------------------------------------
// T15 — getGroupInvoiceHistory returns most recent first
// ---------------------------------------------------------------------------
describe("T15 — getGroupInvoiceHistory ordering", () => {
  test("invoices returned newest first", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const world = await seedBaseWorld(t);
    await seedPrimary(t, world);

    await asAdmin(t).mutation(generate, {
      groupId: world.groupId,
      coveragePeriod: "2025-05",
    });
    await asAdmin(t).mutation(generate, {
      groupId: world.groupId,
      coveragePeriod: "2025-06",
    });

    const history = await asAdmin(t).query(getHistory, {
      groupId: world.groupId,
    });

    expect(history.length).toBeGreaterThanOrEqual(2);
    // most recent invoiceNumber should be first (by _id desc ordering)
    expect(history[0].coveragePeriod >= history[1].coveragePeriod).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T16 — getGroupAgingSummary: overdue balance appears in correct bucket
// ---------------------------------------------------------------------------
describe("T16 — getGroupAgingSummary aging buckets", () => {
  test("overdue invoice balance shows in days91Plus", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const world = await seedBaseWorld(t, {
      customRates: { moCents: 5000, msCents: 7000, mfCents: 9000 },
    });
    await seedPrimary(t, world);

    // Create an invoice with a due date 100 days in the past
    const pastDue = Date.now() - 100 * 86_400_000;
    const { invoiceId } = await asAdmin(t).mutation(generate, {
      groupId: world.groupId,
      coveragePeriod: "2025-01",
      billingDate: pastDue,
    });
    await asAdmin(t).mutation(issueInv, { invoiceId });

    // Manually patch the paymentDueDate to past
    await t.run(async (ctx) => {
      await ctx.db.patch(invoiceId, { paymentDueDate: pastDue });
    });

    const aging = await asAdmin(t).query(getAging, { groupId: world.groupId });
    expect(aging.totalDue).toBe(5000);
    expect(aging.days91Plus).toBe(5000);
  });
});

// ---------------------------------------------------------------------------
// T16b — getGroupAgingSummary asOfDate: a historical invoice's embedded
// aging table must not leak in invoices billed after it. This is the fix for
// a regenerated May invoice's PDF showing July's invoice too when reprinted
// in July.
// ---------------------------------------------------------------------------
describe("T16b — getGroupAgingSummary asOfDate scoping", () => {
  test("asOfDate excludes invoices billed after that date", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const world = await seedBaseWorld(t, {
      customRates: { moCents: 5000, msCents: 7000, mfCents: 9000 },
    });
    await seedPrimary(t, world);

    const mayBillingDate = Date.UTC(2026, 4, 25); // May 25, 2026
    const { invoiceId: mayInvoiceId } = await asAdmin(t).mutation(generate, {
      groupId: world.groupId,
      coveragePeriod: "2026-05",
      billingDate: mayBillingDate,
    });
    await asAdmin(t).mutation(issueInv, { invoiceId: mayInvoiceId });

    const julyBillingDate = Date.UTC(2026, 6, 25); // July 25, 2026 — after May
    const { invoiceId: julyInvoiceId } = await asAdmin(t).mutation(generate, {
      groupId: world.groupId,
      coveragePeriod: "2026-07",
      billingDate: julyBillingDate,
    });
    await asAdmin(t).mutation(issueInv, { invoiceId: julyInvoiceId });

    // Reprinting the May invoice's PDF "as of" its own billing date must only
    // ever show May's own balance — never July's, no matter when it's regenerated.
    const asOfMay = await asAdmin(t).query(getAging, {
      groupId: world.groupId,
      asOfDate: mayBillingDate,
    });
    expect(asOfMay.totalDue).toBe(5000);

    // The live/dashboard view (no asOfDate) sees everything, including July.
    const live = await asAdmin(t).query(getAging, { groupId: world.groupId });
    expect(live.totalDue).toBe(10000);
  });
});

// ---------------------------------------------------------------------------
// T17 — markOverdueInvoices: flips past-due issued invoices
// ---------------------------------------------------------------------------
describe("T17 — markOverdueInvoices cron", () => {
  test("past-due issued invoice becomes overdue", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const world = await seedBaseWorld(t);
    await seedPrimary(t, world);

    const { invoiceId } = await asAdmin(t).mutation(generate, {
      groupId: world.groupId,
      coveragePeriod: "2025-01",
    });
    await asAdmin(t).mutation(issueInv, { invoiceId });

    // Patch due date to the past
    await t.run(async (ctx) => {
      await ctx.db.patch(invoiceId, {
        paymentDueDate: Date.now() - 86_400_000,
      });
    });

    await t.run(async (ctx) => {
      await ctx.runMutation(markOverdue, {});
    });

    const inv = await asAdmin(t).query(getInvoice, { invoiceId });
    expect(inv!.status).toBe("overdue");
  });
});

// ---------------------------------------------------------------------------
// T18 — generateMonthlyInvoices: creates drafts for enabled groups, skips disabled
// ---------------------------------------------------------------------------
describe("T18 — generateMonthlyInvoices cron", () => {
  test("creates drafts for list-bill groups, skips non-list-bill groups", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);

    const lbWorld = await seedBaseWorld(t, { listBillEnabled: true, groupCode: "LBTEST" });
    await seedPrimary(t, lbWorld);

    const nonLbWorld = await seedBaseWorld(t, {
      listBillEnabled: false,
      groupCode: "NLBTEST",
    });
    // Mark group as non-list-bill by removing the flag
    await t.run(async (ctx) => {
      // Find the group we just created using collect().find() (t.run only has SystemIndexes)
      const groups = await ctx.db.query("groups").collect();
      const g = groups.find((g) => g._id === nonLbWorld.groupId);
      if (g) await ctx.db.patch(g._id, { listBill: undefined });
    });
    await seedPrimary(t, nonLbWorld);

    await t.run(async (ctx) => {
      await ctx.runMutation(generateMonthly, {});
    });

    const lbInvoices = await asAdmin(t).query(listInvoices, {
      groupId: lbWorld.groupId,
    });
    const nonLbInvoices = await asAdmin(t).query(listInvoices, {
      groupId: nonLbWorld.groupId,
    });

    expect(lbInvoices.length).toBe(1);
    expect(lbInvoices[0].status).toBe("draft");
    expect(nonLbInvoices.length).toBe(0);
  });
});
