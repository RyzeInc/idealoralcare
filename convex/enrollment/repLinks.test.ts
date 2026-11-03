import { expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";

test("public vanity resolution exposes only active attribution and its landing hint", async () => {
  const t = convexTest(schema);
  const codeId = await t.run(async ctx => {
    const agencyId = await ctx.db.insert("distributionPartners", { name: "Sample Agency", type: "agency", contactName: "Sample", contactEmail: "agency@example.com", status: "active", createdAt: 0, updatedAt: 0 });
    const brokerId = await ctx.db.insert("partnerLeaders", { partnerId: agencyId, name: "Sample Broker", email: "private@example.com", isPrimary: true, createdAt: 0, updatedAt: 0 });
    return ctx.db.insert("brokerTrackingCodes", { brokerId, agencyId, code: "100001", slug: "samplebroker01", productHint: "oralcare", usageCount: 0, status: "active", notes: "Private staff note", createdAt: 0, updatedAt: 0 });
  });
  for (const segment of ["100001", "samplebroker01", "samplebroker"]) {
    expect(await t.query(api.enrollment.agents.resolveRepLink, { segment })).toEqual({ repCode: "100001", productHint: "oralcare" });
  }
  expect(await t.query(api.enrollment.agents.resolveRepLink, { segment: "unknown" })).toBeNull();
  await t.run(ctx => ctx.db.patch(codeId, { status: "revoked" }));
  for (const segment of ["100001", "samplebroker01", "samplebroker"]) {
    expect(await t.query(api.enrollment.agents.resolveRepLink, { segment })).toBeNull();
  }
});
