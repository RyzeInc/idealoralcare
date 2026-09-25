/**
 * STOREFRONT KILL SWITCH
 *
 * The switch is only worth anything if it gates the data, not just the route.
 * These cover the two ways it could quietly fail: reading "off" when nobody has
 * ever touched it (which would take down a live shop on deploy), and leaving a
 * public query serving products after it has been switched off.
 */

import { describe, test, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { resolveShopEnabled } from "./queries";

const tok = (id: string) => ({ tokenIdentifier: `https://test.clerk.dev|${id}` });

/** One visible category holding one visible product. */
async function seedStorefront(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const now = Date.now();

    await ctx.db.insert("adminUsers", {
      clerkUserId: "staff_shop",
      email: "staff@test.dev",
      name: "Staff",
      role: "owner",
      createdAt: now,
    });

    const categoryId: Id<"shopCategories"> = await ctx.db.insert("shopCategories", {
      name: "Daily Care",
      slug: "daily-care",
      order: 0,
      isVisible: true,
      createdAt: now,
      updatedAt: now,
    });

    const productId: Id<"shopProducts"> = await ctx.db.insert("shopProducts", {
      categoryId,
      name: "Ela Mint Toothpaste",
      slug: "boka-ela-mint",
      brand: "Boka",
      shortDescription: "Fluoride-free toothpaste with nano-hydroxyapatite.",
      affiliateUrl: "https://boka.com/ela-mint?tag=x",
      merchant: "Boka",
      network: "direct" as const,
      order: 0,
      isVisible: true,
      isFeatured: false,
      clickCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("sites", {
      slug: "flourish",
      name: "Flourish XV",
      type: "whitelabel" as const,
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
      status: "active" as const,
      shopEnabled: true,
      createdAt: now,
      updatedAt: now,
    });

    return { categoryId, productId };
  });
}

describe("resolveShopEnabled", () => {
  test("a missing settings row means on, so shipping the switch can't take a live shop down", () => {
    expect(resolveShopEnabled(null)).toBe(true);
  });

  test("only an explicit false turns it off", () => {
    const row = { isEnabled: false } as Parameters<typeof resolveShopEnabled>[0];
    expect(resolveShopEnabled(row)).toBe(false);
  });
});

describe("storefront switch", () => {
  test("defaults on, and public reads serve products", async () => {
    const t = convexTest(schema);
    await seedStorefront(t);

    expect(await t.query(api.shop.queries.isEnabled, {})).toBe(true);
    expect(await t.query(api.shop.queries.listProducts, {})).toHaveLength(1);
    expect(await t.query(api.shop.queries.listStorefront, {})).toHaveLength(1);
  });

  test("off means every public read comes up empty", async () => {
    const t = convexTest(schema);
    await seedStorefront(t);

    await t
      .withIdentity(tok("staff_shop"))
      .mutation(api.shop.admin.setEnabled, { isEnabled: false });

    expect(await t.query(api.shop.queries.isEnabled, {})).toBe(false);
    expect(await t.query(api.shop.queries.listCategories, {})).toEqual([]);
    expect(await t.query(api.shop.queries.listProducts, {})).toEqual([]);
    expect(await t.query(api.shop.queries.listStorefront, {})).toEqual([]);
    expect(
      await t.query(api.shop.queries.getProductBySlug, { slug: "boka-ela-mint" }),
    ).toBeNull();
  });

  test("off overrides a partner site that opted in", async () => {
    const t = convexTest(schema);
    await seedStorefront(t);

    expect(
      await t.query(api.shop.queries.isEnabledForSite, { siteSlug: "flourish" }),
    ).toBe(true);

    await t
      .withIdentity(tok("staff_shop"))
      .mutation(api.shop.admin.setEnabled, { isEnabled: false });

    expect(
      await t.query(api.shop.queries.isEnabledForSite, { siteSlug: "flourish" }),
    ).toBe(false);
  });

  test("switching back on restores the storefront untouched", async () => {
    const t = convexTest(schema);
    await seedStorefront(t);
    const asAdmin = t.withIdentity(tok("staff_shop"));

    await asAdmin.mutation(api.shop.admin.setEnabled, { isEnabled: false });
    await asAdmin.mutation(api.shop.admin.setEnabled, { isEnabled: true });

    expect(await t.query(api.shop.queries.listStorefront, {})).toHaveLength(1);
    expect(await t.query(api.shop.queries.listProducts, {})).toHaveLength(1);
  });

  test("keeps one settings row across repeated flips", async () => {
    const t = convexTest(schema);
    await seedStorefront(t);
    const asAdmin = t.withIdentity(tok("staff_shop"));

    await asAdmin.mutation(api.shop.admin.setEnabled, { isEnabled: false });
    await asAdmin.mutation(api.shop.admin.setEnabled, { isEnabled: true });
    await asAdmin.mutation(api.shop.admin.setEnabled, { isEnabled: false });

    const rows = await t.run(async (ctx) => await ctx.db.query("shopSettings").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].isEnabled).toBe(false);
  });

  test("a non-admin cannot flip it", async () => {
    const t = convexTest(schema);
    await seedStorefront(t);

    await expect(
      t.withIdentity(tok("random_visitor")).mutation(api.shop.admin.setEnabled, {
        isEnabled: false,
      }),
    ).rejects.toThrow(/admin/i);

    expect(await t.query(api.shop.queries.isEnabled, {})).toBe(true);
  });

  test("audits who took it down", async () => {
    const t = convexTest(schema);
    await seedStorefront(t);

    await t
      .withIdentity(tok("staff_shop"))
      .mutation(api.shop.admin.setEnabled, { isEnabled: false });

    const entries = await t.run(
      async (ctx) => await ctx.db.query("adminAuditLog").collect(),
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].action).toBe("shop.storefront.disable");
    expect(entries[0].actorClerkUserId).toBe("staff_shop");
  });
});
