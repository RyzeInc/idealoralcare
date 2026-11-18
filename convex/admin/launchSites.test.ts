import { describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { balanceForLifeProduct } from "../lib/bflCatalog";
import { api, internal } from "../_generated/api";

async function setup() {
  const t = convexTest(schema);
  const ids = await t.run(async ctx => {
    const primary = await ctx.db.insert("sites", { slug: "ideal-health", name: "Ideal", type: "primary", branding: { primaryColor: "#123456" }, allowedPlanIds: [], enrollmentDefaults: { requireGroupCode: false, requireEligibilityMatch: false, allowSelfEnrollment: true, requirePayment: true, autoActivate: true, collectAddress: true, collectPhone: true, collectEmployeeId: false, supportEmail: "support@getidealoh.com" }, status: "active", createdAt: 0, updatedAt: 0 });
    const account = await ctx.db.insert("accounts", { siteId: primary, slug: "cmg", name: "CMG", accountType: "employer", billingModel: "per_member", contacts: [], status: "active", createdAt: 0, updatedAt: 0 });
    const group = await ctx.db.insert("groups", { siteId: primary, accountId: account, slug: "cmg", name: "CMG", groupCode: "IDEALDO", status: "active", createdAt: 0, updatedAt: 0 });
    const product = await ctx.db.insert("catalogProducts", { slug: "oral-family", name: "Ideal Family", category: "dental", description: "Oral care", inclusions: [], exclusions: [], eligibilityRules: { requiresVerification: false, disclosureText: "" }, activationBehavior: "immediate", pricing: { monthlyCardCents: 2000, monthlyACHCents: 2000, annualCardCents: 20000, annualACHCents: 20000 }, isVisible: true, isFeatured: false, order: 0, createdAt: 0, updatedAt: 0 });
    const bfl = await ctx.db.insert("catalogProducts", { ...balanceForLifeProduct(0, 106), stripeProducts: { monthlyCardId: "prod_testBfl", monthlyACHId: "prod_testBfl" } });
    return { primary, account, group, product, bfl };
  });
  return { t, ids };
}

describe("AssureVantage launch setup", () => {
  test("creates a missing BFL product with explicit Stripe mapping and adds it to the existing site", async () => {
    const { t, ids } = await setup();
    const created = await t.mutation(internal.admin.launchSites.configureAssureVantage, { activate: true });
    await t.run(async ctx => {
      await ctx.db.patch(created.siteId, { allowedPlanIds: [ids.product] });
      await ctx.db.delete(ids.bfl);
    });
    const before = await t.run(async ctx => ({
      products: await ctx.db.query("catalogProducts").collect(),
      legacy: await ctx.db.get(ids.primary),
      groups: await ctx.db.query("groups").collect(),
    }));
    await expect(t.mutation(internal.admin.launchSites.configureAssureVantage, {}))
      .rejects.toThrow("Balance for Life is missing from the catalog");
    await t.mutation(internal.admin.launchSites.configureAssureVantage, { bflStripeProductId: "prod_testBfl" });
    const bfl = await t.query(api.catalog.queries.getBySlug, { slug: "bfl-individual" });
    expect(bfl).toMatchObject({ isVisible: true, pricing: { monthlyCardCents: 1995, monthlyACHCents: 1995 }, stripeProducts: { monthlyCardId: "prod_testBfl", monthlyACHId: "prod_testBfl" } });
    expect((await t.run(ctx => ctx.db.get(created.siteId)))?.allowedPlanIds).toEqual([ids.product, bfl!._id]);
    for (const product of before.products) expect(await t.run(ctx => ctx.db.get(product._id))).toEqual(product);
    expect(await t.run(ctx => ctx.db.get(ids.primary))).toEqual(before.legacy);
    expect(await t.run(ctx => ctx.db.query("groups").collect())).toEqual(before.groups);
    await t.mutation(internal.admin.launchSites.configureAssureVantage, {});
    expect(await t.query(api.catalog.queries.getBySlug, { slug: "bfl-individual" })).toEqual(bfl);
  });

  test.each(["hidden", "unmapped"])("rejects a %s BFL product without overwriting existing configuration", async (state) => {
    const { t, ids } = await setup();
    await t.run(ctx => ctx.db.patch(ids.bfl, state === "hidden" ? { isVisible: false } : { stripeProducts: {} }));
    const before = await t.run(ctx => ctx.db.get(ids.bfl));
    await expect(t.mutation(internal.admin.launchSites.configureAssureVantage, {}))
      .rejects.toThrow(state === "hidden" ? "hidden in the catalog" : "Stripe product mappings");
    expect(await t.run(ctx => ctx.db.get(ids.bfl))).toEqual(before);
  });

  test("preserves existing BFL prices and Stripe mappings", async () => {
    const { t, ids } = await setup();
    await t.run(ctx => ctx.db.patch(ids.bfl, { pricing: { monthlyCardCents: 2100, monthlyACHCents: 2000, annualCardCents: 25200, annualACHCents: 24000 } }));
    const before = await t.run(ctx => ctx.db.get(ids.bfl));
    await t.mutation(internal.admin.launchSites.configureAssureVantage, { activate: true, bflStripeProductId: "prod_ignored" });
    expect(await t.run(ctx => ctx.db.get(ids.bfl))).toEqual(before);
  });

  test("uses the oldest active Ideal template when historical imports repeat its slug", async () => {
    const { t, ids } = await setup();
    const before = await t.run(async ctx => {
      const primary = await ctx.db.get(ids.primary);
      await ctx.db.patch(ids.primary, { status: "suspended" });
      const { _id, _creationTime, ...fields } = primary!;
      void _id; void _creationTime;
      await ctx.db.insert("sites", { ...fields, defaultCadence: "annual", defaultPaymentMethod: "ach" });
      await ctx.db.insert("sites", { ...fields, defaultCadence: "monthly", defaultPaymentMethod: "card" });
      return {
        sites: await ctx.db.query("sites").collect(),
        account: await ctx.db.get(ids.account),
        group: await ctx.db.get(ids.group),
        product: await ctx.db.get(ids.product),
      };
    });
    const created = await t.mutation(internal.admin.launchSites.configureAssureVantage, { activate: true, promoteToPrimary: true });
    expect(await t.run(ctx => ctx.db.get(created.siteId))).toMatchObject({
      status: "active", defaultCadence: "annual", defaultPaymentMethod: "ach",
    });
    expect(await t.query(api.hierarchy.resolveSiteBySlug, { slug: "assurevantage" })).toMatchObject({ _id: created.siteId, status: "active" });
    for (const site of before.sites) {
      expect(await t.run(ctx => ctx.db.get(site._id))).toEqual(site);
    }
    expect(await t.run(ctx => ctx.db.get(ids.account))).toEqual(before.account);
    expect(await t.run(ctx => ctx.db.get(ids.group))).toEqual(before.group);
    expect(await t.run(ctx => ctx.db.get(ids.product))).toEqual(before.product);
    const repeated = await t.mutation(internal.admin.launchSites.configureAssureVantage, { activate: true, promoteToPrimary: true });
    expect(repeated).toMatchObject({ siteId: created.siteId, created: false });
  });

  test("requires an active Ideal template even when its slug is duplicated", async () => {
    const { t, ids } = await setup();
    await t.run(async ctx => {
      await ctx.db.patch(ids.primary, { status: "suspended" });
      const { _id, _creationTime, ...fields } = (await ctx.db.get(ids.primary))!;
      void _id; void _creationTime;
      await ctx.db.insert("sites", fields);
    });
    await expect(t.mutation(internal.admin.launchSites.configureAssureVantage, { activate: true }))
      .rejects.toThrow("An active Ideal site is required");
    expect(await t.run(ctx => ctx.db.query("sites").withIndex("by_slug", q => q.eq("slug", "assurevantage")).collect())).toEqual([]);
  });

  test("promotes the existing site to the primary brand and includes existing membership programs without moving legacy groups", async () => {
    const { t, ids } = await setup();
    const created = await t.mutation(internal.admin.launchSites.configureAssureVantage, {});
    const bflId = ids.bfl;
    await t.run(ctx => ctx.db.patch(created.siteId, { type: "whitelabel", allowedPlanIds: [ids.product] }));
    const before = await t.run(ctx => ctx.db.get(ids.group));
    await t.mutation(internal.admin.launchSites.configureAssureVantage, { promoteToPrimary: true });
    const site = await t.run(ctx => ctx.db.get(created.siteId));
    expect(site?.type).toBe("primary");
    expect(site?.allowedPlanIds).toEqual([ids.product, bflId]);
    expect(await t.run(ctx => ctx.db.get(ids.group))).toEqual(before);
  });
  test("creates a separate brand from the oral catalog without moving legacy groups or changing prices", async () => {
    const { t, ids } = await setup();
    const before = await t.run(async ctx => ({ primary: await ctx.db.get(ids.primary), group: await ctx.db.get(ids.group), product: await ctx.db.get(ids.product) }));
    const created = await t.mutation(internal.admin.launchSites.configureAssureVantage, {});
    expect(created).toMatchObject({ created: true, status: "onboarding" });
    const site = await t.run(ctx => ctx.db.get(created.siteId));
    expect(site).toMatchObject({ slug: "assurevantage", domain: "www.assurevantage.com", name: "AssureVantage", allowedPlanIds: [ids.product, ids.bfl], enrollmentDefaults: { supportEmail: "support@getidealoh.com" }, branding: { informationEmail: "info@assurevantage.com" } });
    expect(site?.type).toBe("primary");
    expect(await t.query(api.enrollment.sessions.getDTCHierarchy, { siteSlug: "assurevantage" })).toBeNull();
    await t.mutation(internal.admin.launchSites.configureAssureVantage, { activate: true, enableMemberBranding: true });
    expect(await t.query(api.enrollment.sessions.getDTCHierarchy, { siteSlug: "assurevantage" })).toEqual({ siteId: created.siteId, accountId: created.accountId, groupId: created.groupId });
    expect(await t.run(async ctx => ({ primary: await ctx.db.get(ids.primary), group: await ctx.db.get(ids.group), product: await ctx.db.get(ids.product) }))).toEqual(before);
  });
  test("is idempotent, preserves manual edits and requires explicit activation", async () => {
    const { t } = await setup();
    const created = await t.mutation(internal.admin.launchSites.configureAssureVantage, {});
    await t.run(ctx => ctx.db.patch(created.siteId, { branding: { primaryColor: "#abcdef" } }));
    await t.mutation(internal.admin.launchSites.configureAssureVantage, { activate: true });
    const repeated = await t.mutation(internal.admin.launchSites.configureAssureVantage, {});
    expect(repeated).toMatchObject({ siteId: created.siteId, created: false, status: "active" });
    expect((await t.run(ctx => ctx.db.get(created.siteId)))?.branding.primaryColor).toBe("#abcdef");
    expect(await t.run(ctx => ctx.db.query("sites").collect())).toHaveLength(2);
    expect(await t.run(ctx => ctx.db.query("accounts").collect())).toHaveLength(2);
    expect(await t.run(ctx => ctx.db.query("groups").collect())).toHaveLength(2);
    await t.run(ctx => ctx.db.patch(created.siteId, { status: "suspended" }));
    await expect(t.mutation(internal.admin.launchSites.configureAssureVantage, { activate: true })).rejects.toThrow(/suspended/);
  });
});
