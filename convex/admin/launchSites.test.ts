import { describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api, internal } from "../_generated/api";

async function setup() {
  const t = convexTest(schema);
  const ids = await t.run(async ctx => {
    const primary = await ctx.db.insert("sites", { slug: "ideal-health", name: "Ideal", type: "primary", branding: { primaryColor: "#123456" }, allowedPlanIds: [], enrollmentDefaults: { requireGroupCode: false, requireEligibilityMatch: false, allowSelfEnrollment: true, requirePayment: true, autoActivate: true, collectAddress: true, collectPhone: true, collectEmployeeId: false, supportEmail: "support@getidealoh.com" }, status: "active", createdAt: 0, updatedAt: 0 });
    const account = await ctx.db.insert("accounts", { siteId: primary, slug: "cmg", name: "CMG", accountType: "employer", billingModel: "per_member", contacts: [], status: "active", createdAt: 0, updatedAt: 0 });
    const group = await ctx.db.insert("groups", { siteId: primary, accountId: account, slug: "cmg", name: "CMG", groupCode: "IDEALDO", status: "active", createdAt: 0, updatedAt: 0 });
    const product = await ctx.db.insert("catalogProducts", { slug: "oral-family", name: "Ideal Family", category: "dental", description: "Oral care", inclusions: [], exclusions: [], eligibilityRules: { requiresVerification: false, disclosureText: "" }, activationBehavior: "immediate", pricing: { monthlyCardCents: 2000, monthlyACHCents: 2000, annualCardCents: 20000, annualACHCents: 20000 }, isVisible: true, isFeatured: false, order: 0, createdAt: 0, updatedAt: 0 });
    return { primary, account, group, product };
  });
  return { t, ids };
}

describe("AssureVantage launch setup", () => {
  test("creates a separate brand from the oral catalog without moving legacy groups or changing prices", async () => {
    const { t, ids } = await setup();
    const before = await t.run(async ctx => ({ primary: await ctx.db.get(ids.primary), group: await ctx.db.get(ids.group), product: await ctx.db.get(ids.product) }));
    const created = await t.mutation(internal.admin.launchSites.configureAssureVantage, {});
    expect(created).toMatchObject({ created: true, status: "onboarding" });
    const site = await t.run(ctx => ctx.db.get(created.siteId));
    expect(site).toMatchObject({ slug: "assurevantage", domain: "www.assurevantage.com", name: "AssureVantage", allowedPlanIds: [ids.product], enrollmentDefaults: { supportEmail: "support@getidealoh.com" }, branding: { informationEmail: "info@assurevantage.com" } });
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
