import { describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";

const PRIMARY = "|John|A|Sample||100000001|00||123 Main St|Apt 4|Dallas|TX|75034||2145550101||MF|123GRPS||11012026|05141985||||M|john.sample@example.com||0";
const DEPENDENT = "|Jane||Sample||100000001|01||123 Main St|Apt 4|Dallas|TX|75034||||MF|123GRPS||11012026|08221987|S|N||F|||0";

async function setup(content: string) {
  const t = convexTest(schema);
  const storageId = await t.run(async ctx => {
    await ctx.db.insert("adminUsers", { clerkUserId: "pipe_owner", name: "Owner", email: "owner@example.test", role: "owner", createdAt: 0 });
    return ctx.storage.store(new Blob([content]));
  });
  return { t, admin: t.withIdentity({ tokenIdentifier: "https://test.clerk.dev|pipe_owner" }), storageId };
}

describe("pipe-delimited CSV intake", () => {
  test("preview reads the first member as data, not a CSV header, without creating members", async () => {
    const { t, admin, storageId } = await setup(`${PRIMARY}\n${DEPENDENT}`);
    const result = await admin.action(api.admin.eligibility.previewEligibilityFile, { storageId, fileType: "csv", fileName: "test.csv" });
    expect(result).toMatchObject({ primaryCount: 1, dependentCount: 1, validationErrorCount: 0 });
    expect(result.sampleRecords[0]).toMatchObject({ firstName: "John", dateOfBirth: "1985-05-14" });
    expect(await t.run(ctx => ctx.db.query("memberProfiles").collect())).toHaveLength(0);
  });

  test("the same preflight rejects malformed pipe CSV before scheduling member changes", async () => {
    const cells = PRIMARY.split("|"); cells[8] = "";
    const { t, admin, storageId } = await setup(cells.join("|"));
    const fileId = await t.run(async ctx => {
      const siteId = await ctx.db.insert("sites", { slug: "pipe", name: "Pipe", type: "primary", branding: {}, allowedPlanIds: [], enrollmentDefaults: { requireGroupCode: false, requireEligibilityMatch: false, allowSelfEnrollment: false, requirePayment: false, autoActivate: false, collectAddress: true, collectPhone: false, collectEmployeeId: false }, status: "active", createdAt: 0, updatedAt: 0 });
      const accountId = await ctx.db.insert("accounts", { siteId, slug: "pipe-account", name: "Pipe Account", accountType: "employer", billingModel: "per_member", contacts: [], status: "active", createdAt: 0, updatedAt: 0 });
      const groupId = await ctx.db.insert("groups", { siteId, accountId, slug: "pipe-group", name: "Pipe Group", groupCode: "123GRPS", organizationCode: "PIPE", status: "active", createdAt: 0, updatedAt: 0 });
      return ctx.db.insert("eligibilityFiles", { siteId, accountId, groupId, storageId, fileName: "test.csv", fileType: "csv", fileAction: "delta", status: "uploaded", totalRecords: 0, processedRecords: 0, errorRecords: 0, newMembers: 0, updatedMembers: 0, terminatedMembers: 0, uploadedAt: 0 });
    });
    await expect(admin.action(api.admin.eligibility.processEligibilityFile, { fileId })).rejects.toThrow(/address is required/);
    expect(await t.run(ctx => ctx.db.query("memberProfiles").collect())).toHaveLength(0);
    const failed = await t.run(ctx => ctx.db.get(fileId));
    expect(failed?.status).toBe("failed");
    expect(failed?.errors?.some(issue => issue.message.includes("address is required"))).toBe(true);
  });
});
