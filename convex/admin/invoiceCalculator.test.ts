/**
 * INVOICE CALCULATOR — server tests
 *
 * Covers spec §11.2 fixtures + closePeriod idempotency + recordAdjustment
 * validation + INV-01 penny-perfect invariant.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api, internal } from "../_generated/api";
import {
  addSplits,
  DISPERSAL,
  ZERO_SPLIT,
  type DispersalSplit,
} from "../lib/dispersal";
import type { Id } from "../_generated/dataModel";

// ---------------------------------------------------------------------------
// Auth identity helpers
// ---------------------------------------------------------------------------

const ADMIN_TOKEN = "https://test.clerk.dev|admin_user_inv";

async function seedAdmin(t: ReturnType<typeof convexTest>) {
  await t.run(async (ctx) => {
    await ctx.db.insert("adminUsers", {
      clerkUserId: "admin_user_inv",
      email: "admin@inv.test",
      name: "Inv Admin",
      role: "owner",
      createdAt: Date.now(),
    });
  });
}

function asAdmin(t: ReturnType<typeof convexTest>) {
  return t.withIdentity({ tokenIdentifier: ADMIN_TOKEN });
}

// ---------------------------------------------------------------------------
// World seeding
// ---------------------------------------------------------------------------

interface World {
  siteId: Id<"sites">;
  accountId: Id<"accounts">;
  groupId: Id<"groups">;
}

async function seedWorld(
  t: ReturnType<typeof convexTest>,
  opts: { listBill?: boolean; groupCode?: string } = {},
): Promise<World> {
  return t.run(async (ctx) => {
    const now = Date.now();
    const siteId = await ctx.db.insert("sites", {
      slug: `s-${Math.random().toString(36).slice(2)}`,
      name: "Inv Site",
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
      name: "Inv Account",
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
      name: "Inv Group",
      groupCode: opts.groupCode ?? "IDEALDO",
      status: "active",
      ...(opts.listBill
        ? { listBill: { enabled: true, paymentMethod: "ach" as const } }
        : {}),
      createdAt: now,
      updatedAt: now,
    });
    return { siteId, accountId, groupId };
  });
}

async function seedMember(
  t: ReturnType<typeof convexTest>,
  world: World,
  opts: {
    customerId: string;
    role: "primary" | "dependent";
    primaryMemberId?: Id<"memberProfiles">;
    memberType?: "active" | "enrolling" | "eligible" | "terminated";
    memberId?: string;
    createdAt?: number;
  },
): Promise<Id<"memberProfiles">> {
  return t.run(async (ctx) => {
    return ctx.db.insert("memberProfiles", {
      memberId: opts.memberId ?? Math.random().toString(36).slice(2, 11),
      barcode: Math.random().toString(36).slice(2, 12).toUpperCase(),
      customerId: opts.customerId,
      siteId: world.siteId,
      accountId: world.accountId,
      groupId: world.groupId,
      memberRole: opts.role,
      ...(opts.primaryMemberId ? { primaryMemberId: opts.primaryMemberId } : {}),
      firstName: opts.role === "primary" ? "Pri" : "Dep",
      lastName: "Test",
      email: `${opts.customerId}@test.inv`,
      memberType: opts.memberType ?? "active",
      status: "active",
      createdAt: opts.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    });
  });
}

async function seedBundle(
  t: ReturnType<typeof convexTest>,
  opts: {
    customerId: string;
    totalCents: number;
    status?: "active" | "cancelled";
    createdAt?: number;
  },
) {
  return t.run(async (ctx) => {
    const now = opts.createdAt ?? Date.now();
    return ctx.db.insert("subscriptionBundles", {
      customerId: opts.customerId,
      cadence: "monthly",
      paymentMethod: "card",
      stripeCustomerId: `cus_${opts.customerId}`,
      status: opts.status ?? "active",
      currentPeriodStart: now,
      currentPeriodEnd: now + 30 * 24 * 60 * 60 * 1000,
      pricingSnapshot: {
        cadence: "monthly",
        paymentMethod: "card",
        totalCents: opts.totalCents,
        planCount: 1,
        capturedAt: now,
      },
      createdAt: now,
      updatedAt: now,
    });
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const get = api.admin.invoiceCalculator.getInvoiceBreakdown;
const getForPeriod = api.admin.invoiceCalculator.getInvoiceBreakdownForPeriod;
const getGroup = api.admin.invoiceCalculator.getGroupInvoice;
const closeManual = api.admin.invoiceCalculator.closePeriodManual;
const recordAdj = api.admin.invoiceCalculator.recordAdjustment;
const listClosed = api.admin.invoiceCalculator.listClosedPeriods;
const getAdj = api.admin.invoiceCalculator.getAdjustmentsForPeriod;
const getVendor = api.admin.invoiceCalculator.getVendorPayables;

function expectInv01(splits: DispersalSplit, label = "splits") {
  const sum =
    splits.toothlensCents +
    splits.careingtonCents +
    splits.processingCents +
    splits.partnerVendorCents +
    splits.ryzeKeepCents;
  expect(sum, `INV-01 violated for ${label}`).toBe(splits.grossCents);
}

// ---------------------------------------------------------------------------
// Spec §11.2 — Invariant fixtures
// ---------------------------------------------------------------------------

describe("invoiceCalculator — spec §11.2 fixtures", () => {
  test("F1: empty database → all zero", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const r = await asAdmin(t).query(get, {});
    expect(r.grand.totals).toEqual(ZERO_SPLIT);
    expect(r.groups).toEqual([]);
  });

  test("F2: single Individual primary → gross=1499 with §2.2 splits", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const w = await seedWorld(t, { listBill: true });
    await seedMember(t, w, { customerId: "u1", role: "primary" });
    await seedBundle(t, { customerId: "u1", totalCents: 1499 });

    const r = await asAdmin(t).query(get, {});
    expect(r.grand.totals.grossCents).toBe(1499);
    expect(r.grand.totals).toEqual(DISPERSAL.individual);
    expect(r.grand.individualPrimaryCount).toBe(1);
    expectInv01(r.grand.totals, "F2");
  });

  test("F3: Family primary + 2 deps → gross=2499, deps=$0, dependentCount=2", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const w = await seedWorld(t);
    const primaryMemberId = await seedMember(t, w, {
      customerId: "u2",
      role: "primary",
    });
    await seedMember(t, w, { customerId: "u2", role: "dependent", primaryMemberId });
    await seedMember(t, w, { customerId: "u2", role: "dependent", primaryMemberId });
    await seedBundle(t, { customerId: "u2", totalCents: 2499 });

    const r = await asAdmin(t).query(get, {});
    expect(r.grand.totals.grossCents).toBe(2499);
    expect(r.grand.totals).toEqual(DISPERSAL.family);
    expect(r.grand.dependentCount).toBe(2);
    expect(r.grand.familyPrimaryCount).toBe(1);
    expectInv01(r.grand.totals, "F3");
  });

  test("F4: mixed employer-paid + self-pay → INV-04 holds", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const employerWorld = await seedWorld(t, {
      listBill: true,
      groupCode: "EMP1",
    });
    const selfWorld = await seedWorld(t, { groupCode: "SELF1" });
    await seedMember(t, employerWorld, { customerId: "u3", role: "primary" });
    await seedBundle(t, { customerId: "u3", totalCents: 1499 });
    await seedMember(t, selfWorld, { customerId: "u4", role: "primary" });
    await seedBundle(t, { customerId: "u4", totalCents: 2499 });

    const r = await asAdmin(t).query(get, {});
    // INV-04: employerPaid + selfPay = grand
    const sum = addSplits(r.employerPaid.totals, r.selfPay.totals);
    expect(sum).toEqual(r.grand.totals);
    expect(r.employerPaid.totals).toEqual(DISPERSAL.individual);
    expect(r.selfPay.totals).toEqual(DISPERSAL.family);
  });

  test("F5: active primary, no bundle → unbilledPrimaryCount=1", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const w = await seedWorld(t);
    await seedMember(t, w, { customerId: "u5", role: "primary" });

    const r = await asAdmin(t).query(get, {});
    expect(r.grand.unbilledPrimaryCount).toBe(1);
    expect(r.grand.totals).toEqual(ZERO_SPLIT);
  });

  test("F6: active primary, $0 bundle → unbilledPrimaryCount=1", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const w = await seedWorld(t);
    await seedMember(t, w, { customerId: "u6", role: "primary" });
    await seedBundle(t, { customerId: "u6", totalCents: 0 });

    const r = await asAdmin(t).query(get, {});
    expect(r.grand.unbilledPrimaryCount).toBe(1);
    expect(r.grand.totals).toEqual(ZERO_SPLIT);
  });

  test("F7: terminated member → ignored", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const w = await seedWorld(t);
    await seedMember(t, w, {
      customerId: "u7",
      role: "primary",
      memberType: "terminated",
    });
    await seedBundle(t, { customerId: "u7", totalCents: 1499 });

    const r = await asAdmin(t).query(get, {});
    expect(r.grand.activeMemberCount).toBe(0);
    expect(r.grand.totals).toEqual(ZERO_SPLIT);
  });

  test("F8: family primary + dependent in separate memberProfiles rows", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const w = await seedWorld(t);
    const primaryMemberId = await seedMember(t, w, {
      customerId: "u8",
      role: "primary",
    });
    await seedMember(t, w, {
      customerId: "u8",
      role: "dependent",
      primaryMemberId,
    });
    await seedBundle(t, { customerId: "u8", totalCents: 2499 });

    const r = await asAdmin(t).query(get, {});
    expect(r.grand.totals).toEqual(DISPERSAL.family);
    expect(r.grand.familyPrimaryCount).toBe(1);
    expect(r.grand.dependentCount).toBe(1);
    expectInv01(r.grand.totals, "F8");
  });

  test("F9: customer with two active bundles → Family wins", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const w = await seedWorld(t);
    await seedMember(t, w, { customerId: "u9", role: "primary" });
    await seedBundle(t, { customerId: "u9", totalCents: 1499 });
    await seedBundle(t, { customerId: "u9", totalCents: 2499 });

    const r = await asAdmin(t).query(get, {});
    expect(r.grand.totals).toEqual(DISPERSAL.family);
    expect(r.grand.familyPrimaryCount).toBe(1);
    expect(r.grand.individualPrimaryCount).toBe(0);
  });

  test("F11: eligible list-bill primary (no Clerk account yet) is still billed", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const w = await seedWorld(t, { listBill: true, groupCode: "ELIG1" });
    // No customerId/bundle at all — this mirrors an eligibility-file-imported
    // member who hasn't been Clerk-provisioned. List-bill primaries are
    // classified by household size, not by Stripe bundle.
    await seedMember(t, w, {
      customerId: "elig_u1",
      role: "primary",
      memberType: "eligible",
    });

    const r = await asAdmin(t).query(get, {});
    expect(r.grand.activeMemberCount).toBe(1);
    expect(r.grand.individualPrimaryCount).toBe(1);
    expect(r.grand.totals).toEqual(DISPERSAL.individual);
    expect(r.employerPaid.totals).toEqual(DISPERSAL.individual);
  });

  test("F12: eligible list-bill primary + eligible dependent → classified as family", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const w = await seedWorld(t, { listBill: true, groupCode: "ELIG2" });
    const primaryMemberId = await seedMember(t, w, {
      customerId: "elig_u2",
      role: "primary",
      memberType: "eligible",
    });
    await seedMember(t, w, {
      customerId: "elig_u2",
      role: "dependent",
      primaryMemberId,
      memberType: "eligible",
    });

    const r = await asAdmin(t).query(get, {});
    expect(r.grand.familyPrimaryCount).toBe(1);
    expect(r.grand.dependentCount).toBe(1);
    expect(r.grand.totals).toEqual(DISPERSAL.family);
  });

  test("F10: penny invariant fuzz — random rosters always satisfy INV-01", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const w = await seedWorld(t);

    // Pseudo-random but deterministic: 200 customers split between Ind/Fam/None
    for (let i = 0; i < 200; i++) {
      const cid = `fuzz_${i}`;
      await seedMember(t, w, { customerId: cid, role: "primary" });
      const r = i % 3;
      if (r === 0) await seedBundle(t, { customerId: cid, totalCents: 1499 });
      else if (r === 1) await seedBundle(t, { customerId: cid, totalCents: 2499 });
      // r === 2 → no bundle (unbilled)
    }
    const result = await asAdmin(t).query(get, {});
    expectInv01(result.grand.totals, "F10 grand");
    for (const g of result.groups) {
      expectInv01(g.totals, `F10 group ${g.groupCode}`);
    }
  });
});

// ---------------------------------------------------------------------------
// closePeriod idempotency + snapshot persistence (INV-07)
// ---------------------------------------------------------------------------

describe("invoiceCalculator — closePeriod", () => {
  test("INV-07: closing the same period twice is a no-op", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const w = await seedWorld(t, { listBill: true });

    // Close prior calendar month so it isn't the current period.
    const now = new Date();
    const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const year = prev.getUTCFullYear();
    const month = prev.getUTCMonth() + 1;
    // Member/bundle must have existed DURING the period being closed, not
    // "right now" — the asOfMs gate excludes anything created after
    // period-end.
    const midPeriod = Date.UTC(year, month - 1, 15);
    await seedMember(t, w, { customerId: "uc1", role: "primary", createdAt: midPeriod });
    await seedBundle(t, { customerId: "uc1", totalCents: 1499, createdAt: midPeriod });

    const first = await asAdmin(t).mutation(closeManual, { year, month });
    expect(first.skipped).toBeFalsy();
    expect(first.rowsWritten).toBe(1);

    const second = await asAdmin(t).mutation(closeManual, { year, month });
    expect(second.skipped).toBe(true);

    // Snapshot is queryable
    const closed = await asAdmin(t).query(listClosed, {});
    expect(closed.length).toBe(1);
    expect(closed[0].grossCents).toBe(1499);
  });

  test("getInvoiceBreakdownForPeriod returns the closed snapshot for past periods", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const w = await seedWorld(t);

    const now = new Date();
    const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const year = prev.getUTCFullYear();
    const month = prev.getUTCMonth() + 1;
    const periodKey = `${year}-${String(month).padStart(2, "0")}`;
    const midPeriod = Date.UTC(year, month - 1, 15);
    await seedMember(t, w, { customerId: "uc2", role: "primary", createdAt: midPeriod });
    await seedBundle(t, { customerId: "uc2", totalCents: 2499, createdAt: midPeriod });

    await asAdmin(t).mutation(closeManual, { year, month });

    // Mutate the live world AFTER close.
    await t.run(async (ctx) => {
      const bundle = await ctx.db
        .query("subscriptionBundles")
        .first();
      if (bundle) {
        await ctx.db.patch(bundle._id, { status: "cancelled" });
      }
    });

    const r = await asAdmin(t).query(getForPeriod, { period: periodKey });
    expect(r.source).toBe("closed");
    expect(r.grand.totals).toEqual(DISPERSAL.family);
    expect(r.groups[0].periodId).toBeDefined();
  });

  test("closePeriodManual excludes a member/bundle created after the period already ended", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const w = await seedWorld(t);

    const now = new Date();
    const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const year = prev.getUTCFullYear();
    const month = prev.getUTCMonth() + 1;
    const periodEndMs = Date.UTC(year, month, 1); // exclusive end of the closed month

    // Member existed during the period → billable.
    const midPeriod = Date.UTC(year, month - 1, 15);
    await seedMember(t, w, { customerId: "in-period", role: "primary", createdAt: midPeriod });
    await seedBundle(t, { customerId: "in-period", totalCents: 1499, createdAt: midPeriod });

    // Member created just after the period ended (e.g. cron ran a few
    // minutes late) → must NOT be counted in this closed period.
    const afterPeriod = periodEndMs + 60_000;
    await seedMember(t, w, { customerId: "late-signup", role: "primary", createdAt: afterPeriod });
    await seedBundle(t, { customerId: "late-signup", totalCents: 2499, createdAt: afterPeriod });

    const result = await asAdmin(t).mutation(closeManual, { year, month });
    expect(result.rowsWritten).toBe(1);

    const periodKey = `${year}-${String(month).padStart(2, "0")}`;
    const r = await asAdmin(t).query(getForPeriod, { period: periodKey });
    expect(r.grand.activeMemberCount).toBe(1);
    expect(r.grand.totals.grossCents).toBe(1499);
  });

  test("closePeriodManual excludes a member whose effectiveDate is after period-end", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const w = await seedWorld(t, { listBill: true });

    const now = new Date();
    const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const year = prev.getUTCFullYear();
    const month = prev.getUTCMonth() + 1;
    const midPeriod = Date.UTC(year, month - 1, 15);

    // Created well before period-end, but coverage doesn't start until the
    // month AFTER the one being closed.
    const nextMonthEffective = new Date(Date.UTC(year, month, 5)).toISOString().slice(0, 10);
    await t.run(async (ctx) => {
      await ctx.db.insert("memberProfiles", {
        memberId: "future-eff",
        barcode: "FUTUREEFF01",
        customerId: "future-eff",
        siteId: w.siteId,
        accountId: w.accountId,
        groupId: w.groupId,
        memberRole: "primary",
        firstName: "Future",
        lastName: "Eff",
        memberType: "eligible",
        status: "active",
        effectiveDate: nextMonthEffective,
        createdAt: midPeriod,
        updatedAt: midPeriod,
      });
    });

    const result = await asAdmin(t).mutation(closeManual, { year, month });
    // The (empty) group still gets a snapshot row, but with zero members —
    // the future-effective member must not be counted.
    expect(result.rowsWritten).toBe(1);

    const periodKey = `${year}-${String(month).padStart(2, "0")}`;
    const r = await asAdmin(t).query(getForPeriod, { period: periodKey });
    expect(r.grand.activeMemberCount).toBe(0);
    expect(r.grand.totals.grossCents).toBe(0);
  });

  test("the coverage month runs to its very last instant and stops there", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const w = await seedWorld(t);

    const now = new Date();
    const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const year = prev.getUTCFullYear();
    const month = prev.getUTCMonth() + 1;
    // 11:59:59.999 PM UTC on the last day of the month being closed — the
    // latest possible moment someone can buy a plan and still be that month's
    // revenue. Vendors are paid for them.
    const lastInstant = Date.UTC(year, month, 1) - 1;
    // Midnight on the 1st of the NEXT month: the first instant that belongs to
    // the following period and must not be double-counted here.
    const nextPeriodStart = Date.UTC(year, month, 1);

    await seedMember(t, w, {
      customerId: "buzzer-beater",
      role: "primary",
      createdAt: lastInstant,
    });
    await seedBundle(t, {
      customerId: "buzzer-beater",
      totalCents: 1499,
      createdAt: lastInstant,
    });
    await seedMember(t, w, {
      customerId: "next-month",
      role: "primary",
      createdAt: nextPeriodStart,
    });
    await seedBundle(t, {
      customerId: "next-month",
      totalCents: 1499,
      createdAt: nextPeriodStart,
    });

    await asAdmin(t).mutation(closeManual, { year, month });
    const periodKey = `${year}-${String(month).padStart(2, "0")}`;
    const r = await asAdmin(t).query(getForPeriod, { period: periodKey });
    expect(r.grand.activeMemberCount).toBe(1);
    expect(r.grand.totals.grossCents).toBe(1499);
  });

  test("closePeriodManual uses the tier that was in effect during the period, not a later upgrade (bundleTierHistory)", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const w = await seedWorld(t);

    const now = new Date();
    const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const year = prev.getUTCFullYear();
    const month = prev.getUTCMonth() + 1;
    const midPeriod = Date.UTC(year, month - 1, 15);
    const periodEndMs = Date.UTC(year, month, 1);

    await seedMember(t, w, { customerId: "upgrader", role: "primary", createdAt: midPeriod });
    const bundleId = await seedBundle(t, {
      customerId: "upgrader",
      totalCents: 1499, // Individual during the closed period.
      createdAt: midPeriod,
    });

    // Member upgraded to Family AFTER the period already ended, but the
    // close hasn't run yet (e.g. admin retroactively closes a stale month).
    // The bundle's CURRENT pricingSnapshot now says Family — without
    // bundleTierHistory, closePeriod would wrongly bill this as Family for
    // the already-ended period.
    const upgradeAt = periodEndMs + 5 * 24 * 60 * 60 * 1000; // 5 days into next month
    await t.run(async (ctx) => {
      const bundle = await ctx.db.get(bundleId);
      if (!bundle) throw new Error("bundle missing");
      await ctx.db.insert("bundleTierHistory", {
        bundleId,
        customerId: "upgrader",
        totalCents: 1499,
        effectiveFrom: bundle.pricingSnapshot.capturedAt,
        effectiveTo: upgradeAt,
        reason: "upgrade",
        createdAt: upgradeAt,
      });
      await ctx.db.patch(bundleId, {
        pricingSnapshot: {
          cadence: "monthly",
          paymentMethod: "card",
          totalCents: 2499,
          planCount: 1,
          capturedAt: upgradeAt,
        },
        updatedAt: upgradeAt,
      });
    });

    const result = await asAdmin(t).mutation(closeManual, { year, month });
    expect(result.rowsWritten).toBe(1);

    const periodKey = `${year}-${String(month).padStart(2, "0")}`;
    const r = await asAdmin(t).query(getForPeriod, { period: periodKey });
    // Closed period must reflect Individual ($14.99), the tier that was
    // actually in effect at period-end — NOT the post-upgrade Family tier.
    expect(r.grand.individualPrimaryCount).toBe(1);
    expect(r.grand.familyPrimaryCount).toBe(0);
    expect(r.grand.totals).toEqual(DISPERSAL.individual);

    // Meanwhile the TRUE live view (no period arg) reflects the upgrade.
    const live = await asAdmin(t).query(get, {});
    expect(live.grand.familyPrimaryCount).toBe(1);
    expect(live.grand.individualPrimaryCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// recordAdjustment validation + audit
// ---------------------------------------------------------------------------

describe("invoiceCalculator — recordAdjustment", () => {
  async function seedAndClose(t: ReturnType<typeof convexTest>) {
    await seedAdmin(t);
    const w = await seedWorld(t);
    await seedMember(t, w, { customerId: "ua1", role: "primary" });
    await seedBundle(t, { customerId: "ua1", totalCents: 1499 });
    const now = new Date();
    const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    await asAdmin(t).mutation(closeManual, {
      year: prev.getUTCFullYear(),
      month: prev.getUTCMonth() + 1,
    });
    const period = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
    const closed = await t.run(async (ctx) => {
      const rows = await ctx.db.query("invoicePeriods").collect();
      return rows.find((r) => r.period === period) ?? null;
    });
    return { period, periodId: closed!._id };
  }

  test("rejects non-integer cents", async () => {
    const t = convexTest(schema);
    const { periodId } = await seedAndClose(t);
    await expect(
      asAdmin(t).mutation(recordAdj, {
        periodId,
        reason: "refund",
        bucket: "gross",
        deltaCents: 14.5,
        notes: "test note long enough",
      }),
    ).rejects.toThrow();
  });

  test("rejects empty notes", async () => {
    const t = convexTest(schema);
    const { periodId } = await seedAndClose(t);
    await expect(
      asAdmin(t).mutation(recordAdj, {
        periodId,
        reason: "refund",
        bucket: "gross",
        deltaCents: -1499,
        notes: "",
      }),
    ).rejects.toThrow();
  });

  test("happy path — records signed cents and surfaces via getAdjustmentsForPeriod", async () => {
    const t = convexTest(schema);
    const { period, periodId } = await seedAndClose(t);
    await asAdmin(t).mutation(recordAdj, {
      periodId,
      reason: "refund",
      bucket: "gross",
      deltaCents: -1499,
      notes: "Stripe dispute refund — full month",
    });
    const adjustments = await asAdmin(t).query(getAdj, { period });
    expect(adjustments.length).toBe(1);
    expect(adjustments[0].deltaCents).toBe(-1499);
    expect(adjustments[0].reason).toBe("refund");
  });
});

// ---------------------------------------------------------------------------
// Vendor payables export
// ---------------------------------------------------------------------------

describe("invoiceCalculator — getVendorPayables", () => {
  test("partnerVendor payable matches DISPERSAL.individual.partnerVendorCents per primary", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const w = await seedWorld(t, { listBill: true });
    for (let i = 0; i < 3; i++) {
      const cid = `vp${i}`;
      await seedMember(t, w, { customerId: cid, role: "primary" });
      await seedBundle(t, { customerId: cid, totalCents: 1499 });
    }
    const r = await asAdmin(t).query(getVendor, {
      period: "live",
      vendor: "partnerVendor",
    });
    expect(r.totalCents).toBe(DISPERSAL.individual.partnerVendorCents * 3);
    expect(r.rows.length).toBe(1);
    expect(r.rows[0].individualPrimaryCount).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Drill-down — getGroupInvoice
// ---------------------------------------------------------------------------

describe("invoiceCalculator — getGroupInvoice", () => {
  test("returns member-level lines for a live group", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const w = await seedWorld(t);
    const primaryMemberId = await seedMember(t, w, {
      customerId: "ud1",
      role: "primary",
    });
    await seedMember(t, w, {
      customerId: "ud1",
      role: "dependent",
      primaryMemberId,
    });
    await seedBundle(t, { customerId: "ud1", totalCents: 2499 });

    const r = await asAdmin(t).query(getGroup, { groupId: w.groupId });
    expect(r.source).toBe("live");
    expect(r.members.length).toBe(2);
    const primary = r.members.find((m) => m.role === "primary")!;
    expect(primary.tier).toBe("family");
    expect(primary.contribution.grossCents).toBe(2499);
  });
});

// ---------------------------------------------------------------------------
// Cron entry point — closePreviousMonth wraps closePeriod for prev calendar month
// ---------------------------------------------------------------------------

describe("invoiceCalculator — closePreviousMonth", () => {
  test("internal mutation closes the prior calendar month", async () => {
    const t = convexTest(schema);
    await seedAdmin(t);
    const w = await seedWorld(t);
    await seedMember(t, w, { customerId: "uci1", role: "primary" });
    await seedBundle(t, { customerId: "uci1", totalCents: 1499 });

    const result = await t.mutation(
      internal.admin.invoiceCalculator.closePreviousMonth,
      {},
    );
    expect(result.skipped).toBeFalsy();
    expect(result.rowsWritten).toBe(1);

    const closed = await asAdmin(t).query(listClosed, {});
    expect(closed.length).toBe(1);
  });
});
