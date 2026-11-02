import { describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";

async function setup() {
  const t = convexTest(schema);
  await t.run(async ctx => {
    await ctx.db.insert("adminUsers", {
      clerkUserId: "marketing_owner", email: "owner@example.test", name: "Owner",
      role: "owner", createdAt: Date.now(),
    });
  });
  return { t, admin: t.withIdentity({ tokenIdentifier: "https://test.clerk.dev|marketing_owner" }) };
}

describe("per-site marketing settings", () => {
  test("saves and exposes settings for one brand without changing another", async () => {
    const { t, admin } = await setup();
    const ideal = await admin.mutation(api.admin.hierarchy.createSite, { slug: "ideal-health", name: "Ideal", type: "primary" });
    const assure = await admin.mutation(api.admin.hierarchy.createSite, {
      slug: "assurevantage", name: "AssureVantage", type: "whitelabel",
      marketing: { oralScan: false }, shopEnabled: false,
    });
    await admin.mutation(api.admin.hierarchy.updateSite, {
      siteId: assure!._id, marketing: { oralScan: false, blog: false }, shopEnabled: true,
    });
    const site = await t.query(api.hierarchy.resolveSiteBySlug, { slug: "assurevantage" });
    expect(site).toMatchObject({ marketing: { oralScan: false, blog: false }, shopEnabled: true, allowedPlanIds: [] });
    const original = await t.run(ctx => ctx.db.get(ideal!._id));
    expect(original?.marketing).toBeUndefined();
    expect(original?.name).toBe("Ideal");
    expect(await t.query(api.shop.queries.isEnabledForSite, { siteSlug: "assurevantage" })).toBe(true);
    expect(await t.query(api.shop.queries.isEnabledForSite, { siteSlug: "ideal-health" })).toBe(false);
    // Resetting visibility doesn't silently change the brand's separate shop opt-in.
    await admin.mutation(api.admin.hierarchy.updateSite, { siteId: assure!._id, marketing: {} });
    expect(await t.query(api.hierarchy.resolveSiteBySlug, { slug: "assurevantage" })).toMatchObject({ marketing: {}, shopEnabled: true });
  });

  test("public visitors cannot change marketing settings", async () => {
    const { t, admin } = await setup();
    const site = await admin.mutation(api.admin.hierarchy.createSite, { slug: "brand", name: "Brand", type: "whitelabel" });
    await expect(t.mutation(api.admin.hierarchy.updateSite, { siteId: site!._id, marketing: { oralScan: false } })).rejects.toThrow(/Unauthorized/);
  });
});
