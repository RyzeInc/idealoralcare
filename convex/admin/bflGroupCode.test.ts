import { expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";

test("assigned BFL code flows from organization settings to both protected packet queries", async () => {
  const t = convexTest(schema);
  const { groupId, memberId } = await t.run(async ctx => {
    await ctx.db.insert("adminUsers", { clerkUserId: "bfl_code_owner", name: "Owner", email: "owner@example.test", role: "owner", createdAt: 0 });
    const siteId = await ctx.db.insert("sites", { slug: "bfl-code-test", name: "Ideal", type: "primary", branding: {}, allowedPlanIds: [], enrollmentDefaults: { requireGroupCode: false, requireEligibilityMatch: false, allowSelfEnrollment: false, requirePayment: false, autoActivate: false, collectAddress: true, collectPhone: false, collectEmployeeId: false }, status: "active", createdAt: 0, updatedAt: 0 });
    const accountId = await ctx.db.insert("accounts", { siteId, slug: "bfl-code-account", name: "Account", accountType: "employer", billingModel: "per_member", contacts: [], status: "active", createdAt: 0, updatedAt: 0 });
    const groupId = await ctx.db.insert("groups", { siteId, accountId, slug: "bfl-code-group", name: "CMG", groupCode: "IDEALDO", status: "active", createdAt: 0, updatedAt: 0 });
    const memberId = await ctx.db.insert("memberProfiles", { siteId, accountId, groupId, memberId: "MBR-100000001", barcode: "100000001", customerId: "sample_bfl_member", firstName: "Sample", lastName: "Member", memberType: "active", status: "active", createdAt: 0, updatedAt: 0 });
    return { groupId, memberId };
  });
  const admin = t.withIdentity({ tokenIdentifier: "https://test.clerk.dev|bfl_code_owner" });
  const read = () => t.query(api.subscriptions.queries.getMemberCardDataPublic, { customerId: "sample_bfl_member", serviceSecret: process.env.CONVEX_SERVICE_SECRET });
  // A group name by itself must not silently assign a vendor access code.
  expect((await read())?.bflMemberCode).toBe("IDEAL");
  await admin.mutation(api.admin.hierarchy.updateGroup, { groupId, bflMemberCode: "CMG" });
  expect((await read())?.bflMemberCode).toBe("CMG");
  expect((await admin.query(api.subscriptions.queries.getPacketDataForProfile, { memberProfileId: memberId }))?.bflMemberCode).toBe("CMG");
  await admin.mutation(api.admin.hierarchy.updateGroup, { groupId, bflMemberCode: null });
  expect((await read())?.bflMemberCode).toBe("IDEAL");
});
