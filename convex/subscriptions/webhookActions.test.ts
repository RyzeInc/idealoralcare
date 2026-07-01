/**
 * WEBHOOK ACTIONS — processTierChange tests
 *
 * Focuses on the bundleTierHistory write added 2026-07-01 (see
 * convex/schema.ts `bundleTierHistory` doc comment and
 * convex/admin/invoiceCalculator.ts `resolveBundleTierTotalCentsAsOf`) —
 * without this, closing/reconstructing a past Invoice Calculator period
 * after a mid-cycle upgrade/downgrade would use the CURRENT (wrong) tier
 * instead of whatever was in effect during that period.
 */
import { describe, test, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";

const processTierChange = api.subscriptions.webhookActions.processTierChange;

async function seedProduct(
  t: ReturnType<typeof convexTest>,
  opts: { slug: string; monthlyCardCents: number },
) {
  return t.run(async (ctx) => {
    const now = Date.now();
    return ctx.db.insert("catalogProducts", {
      slug: opts.slug,
      name: opts.slug,
      category: "dental",
      description: "test",
      inclusions: [],
      exclusions: [],
      eligibilityRules: { requiresVerification: false, disclosureText: "" },
      activationBehavior: "immediate",
      pricing: {
        monthlyCardCents: opts.monthlyCardCents,
        monthlyACHCents: opts.monthlyCardCents,
        annualCardCents: opts.monthlyCardCents * 12,
        annualACHCents: opts.monthlyCardCents * 12,
      },
      isVisible: true,
      isFeatured: false,
      order: 0,
      createdAt: now,
      updatedAt: now,
    });
  });
}

async function seedBundle(
  t: ReturnType<typeof convexTest>,
  opts: { customerId: string; totalCents: number; createdAt: number },
) {
  return t.run(async (ctx) => {
    return ctx.db.insert("subscriptionBundles", {
      customerId: opts.customerId,
      cadence: "monthly",
      paymentMethod: "card",
      stripeCustomerId: `cus_${opts.customerId}`,
      status: "active",
      currentPeriodStart: opts.createdAt,
      currentPeriodEnd: opts.createdAt + 30 * 24 * 60 * 60 * 1000,
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
  });
}

describe("processTierChange — bundleTierHistory", () => {
  test("records the superseded tier segment before overwriting pricingSnapshot", async () => {
    const t = convexTest(schema);
    const individualId = await seedProduct(t, { slug: "individual", monthlyCardCents: 1499 });
    const familyId = await seedProduct(t, { slug: "family", monthlyCardCents: 2499 });

    const createdAt = Date.UTC(2026, 0, 1);
    const bundleId = await seedBundle(t, {
      customerId: "cust1",
      totalCents: 1499,
      createdAt,
    });

    const upgradeAt = Date.UTC(2026, 0, 15);
    await t.run(async (ctx) => {
      // convex-test doesn't let us fake Date.now() easily, so we just
      // verify relative ordering (effectiveFrom === bundle's original
      // capturedAt) rather than the exact "now" timestamp.
      await ctx.db.get(bundleId); // sanity read
    });

    await t.mutation(processTierChange, {
      bundleId,
      customerId: "cust1",
      oldProductId: individualId,
      newProductId: familyId,
      newTotalCents: 2499,
      direction: "upgrade",
    });

    const history = await t.run(async (ctx) =>
      ctx.db
        .query("bundleTierHistory")
        .withIndex("by_bundle", (q) => q.eq("bundleId", bundleId))
        .collect(),
    );
    expect(history.length).toBe(1);
    expect(history[0].totalCents).toBe(1499);
    expect(history[0].effectiveFrom).toBe(createdAt);
    expect(history[0].reason).toBe("upgrade");
    expect(history[0].effectiveTo).toBeGreaterThanOrEqual(createdAt);

    const bundle = await t.run(async (ctx) => ctx.db.get(bundleId));
    expect(bundle?.pricingSnapshot.totalCents).toBe(2499);
    // The new segment's start should match the history row's end.
    expect(bundle?.pricingSnapshot.capturedAt).toBe(history[0].effectiveTo);
  });

  test("a second tier change records a second history row, chaining segments", async () => {
    const t = convexTest(schema);
    const individualId = await seedProduct(t, { slug: "individual2", monthlyCardCents: 1499 });
    const familyId = await seedProduct(t, { slug: "family2", monthlyCardCents: 2499 });

    const createdAt = Date.UTC(2026, 0, 1);
    const bundleId = await seedBundle(t, {
      customerId: "cust2",
      totalCents: 1499,
      createdAt,
    });

    await t.mutation(processTierChange, {
      bundleId,
      customerId: "cust2",
      oldProductId: individualId,
      newProductId: familyId,
      newTotalCents: 2499,
      direction: "upgrade",
    });

    await t.mutation(processTierChange, {
      bundleId,
      customerId: "cust2",
      oldProductId: familyId,
      newProductId: individualId,
      newTotalCents: 1499,
      direction: "downgrade",
    });

    const history = await t.run(async (ctx) =>
      ctx.db
        .query("bundleTierHistory")
        .withIndex("by_bundle", (q) => q.eq("bundleId", bundleId))
        .collect(),
    );
    expect(history.length).toBe(2);
    // Segments should chain: first segment's effectiveTo === second segment's effectiveFrom.
    const sorted = [...history].sort((a, b) => a.effectiveFrom - b.effectiveFrom);
    expect(sorted[0].totalCents).toBe(1499);
    expect(sorted[1].totalCents).toBe(2499);
    expect(sorted[0].effectiveTo).toBe(sorted[1].effectiveFrom);

    const bundle = await t.run(async (ctx) => ctx.db.get(bundleId));
    expect(bundle?.pricingSnapshot.totalCents).toBe(1499);
  });
});
