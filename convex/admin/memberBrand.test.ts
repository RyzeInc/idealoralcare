import { expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api, internal } from "../_generated/api";

test("member materials follow the owning group/site only after explicit opt-in", async () => {
  const t = convexTest(schema);
  const ids = await t.run(async ctx => {
    const defaults = { requireGroupCode: false, requireEligibilityMatch: false, allowSelfEnrollment: true, requirePayment: true, autoActivate: true, collectAddress: true, collectPhone: true, collectEmployeeId: false };
    const ideal = await ctx.db.insert("sites", { slug: "ideal-health", name: "Ideal", type: "primary", branding: {}, allowedPlanIds: [], enrollmentDefaults: defaults, status: "active", createdAt: 0, updatedAt: 0 });
    const assure = await ctx.db.insert("sites", { slug: "assurevantage", name: "AssureVantage", domain: "www.assurevantage.com", type: "whitelabel", memberBrandingEnabled: true, branding: { logoUrl: "/brands/assurevantage/logo.png" }, allowedPlanIds: [], enrollmentDefaults: defaults, status: "active", createdAt: 0, updatedAt: 0 });
    const profiles = [];
    for (const [index, name] of ["CMG", "Wellness Patriots", "New sales"].entries()) {
      const siteId = index === 2 ? assure : ideal;
      const accountId = await ctx.db.insert("accounts", { siteId, slug: `account-${index}`, name, accountType: "employer", billingModel: "per_member", contacts: [], status: "active", createdAt: 0, updatedAt: 0 });
      const groupId = await ctx.db.insert("groups", { siteId, accountId, slug: `group-${index}`, name, groupCode: `TEST${index}`, status: "active", createdAt: 0, updatedAt: 0 });
      profiles.push(await ctx.db.insert("memberProfiles", { siteId, accountId, groupId, memberId: `TEST-10000000${index}`, barcode: `10000000${index}`, customerId: `sample-${index}`, firstName: "Sample", lastName: "Member", memberType: "active", status: "active", createdAt: 0, updatedAt: 0 }));
    }
    return { ideal, assure, profiles };
  });
  for (const [i, profileId] of ids.profiles.entries()) {
    const packet = await t.query(internal.subscriptions.queries.getPacketDataForProfileInternal, { memberProfileId: profileId });
    const card = await t.query(api.subscriptions.queries.getMemberCardDataPublic, { customerId: `sample-${i}`, serviceSecret: process.env.CONVEX_SERVICE_SECRET });
    if (i === 2) {
      expect(packet?.brand).toMatchObject({ name: "AssureVantage", portalUrl: "https://www.assurevantage.com/assurevantage/dashboard" });
      expect(card?.brand).toEqual(packet?.brand);
      expect(card?.planName).toBe("AssureVantage Savings Plan");
      expect(card?.networks.toothlens.memberUrl).toContain("?tab=oral-scan");
    } else {
      expect(packet?.brand).toBeUndefined();
      expect(card?.brand).toBeUndefined();
      expect(card?.planName).toBe("Ideal Oral Savings Plan");
    }
  }
  // Opening a different brand cannot change an existing group's membership identity.
  await t.run(ctx => ctx.db.patch(ids.profiles[0], { siteId: ids.assure }));
  expect((await t.query(internal.subscriptions.queries.getPacketDataForProfileInternal, { memberProfileId: ids.profiles[0] }))?.brand).toBeUndefined();
  await t.run(ctx => ctx.db.patch(ids.assure, { memberBrandingEnabled: false }));
  expect((await t.query(internal.subscriptions.queries.getPacketDataForProfileInternal, { memberProfileId: ids.profiles[2] }))?.brand).toBeUndefined();
});

test("oral welcome send carries the member brand, canonical scan QR and branded attachments using the existing sender", async () => {
  const t = convexTest(schema);
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "email-synthetic" }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("RESEND_API_KEY", "re_synthetic");
  try {
    await t.action(api.legal.emailFulfillment.sendFulfillmentPacketEmail, {
      serviceSecret: process.env.CONVEX_SERVICE_SECRET,
      memberName: "Sample Member", memberFirstName: "Sample", memberEmail: "sample@example.test", memberId: "100000001", groupCode: "TEST", planName: "AssureVantage Savings Plan", effectiveDate: "Nov 1, 2026",
      brand: { name: "AssureVantage", portalUrl: "https://www.assurevantage.com/assurevantage/dashboard" },
      pdfBase64: "c3ludGhldGlj", agreementPdfBase64: "c3ludGhldGlj",
    });
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.from).toBe("AssureVantage <noreply@getidealoh.com>");
    expect(payload.subject).toContain("AssureVantage");
    expect(payload.html).not.toContain("Ideal Oral Health");
    expect(payload.html).toContain('href="https://www.assurevantage.com/assurevantage/dashboard"');
    const qr = payload.html.match(/https:\/\/api\.qrserver\.com[^\"]+/)?.[0];
    expect(qr).toBeTruthy();
    expect(new URL(qr!).searchParams.get("data")).toBe("https://www.assurevantage.com/assurevantage/dashboard?tab=oral-scan");
    expect(payload.attachments.map((file: { filename: string }) => file.filename)).toEqual(["AssureVantage_Membership_Packet.pdf", "AssureVantage_Membership_Agreement.pdf"]);
  } finally { vi.unstubAllGlobals(); vi.unstubAllEnvs(); }
});
