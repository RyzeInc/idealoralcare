/**
 * Vendor file row-format parity tests.
 *
 * The aggregated Dental Discount Network file is produced by concatenating
 * the per-organization outputs and post-processing each row through
 * `replaceGroupCodeWithProviderCode`. This test asserts that swap behaves
 * exactly as expected so per-org and aggregated outputs stay byte-identical
 * outside of column 18 (1-indexed) — the group-code column.
 */
import { describe, it, expect } from "vitest";
import { __testOnly_replaceGroupCodeWithProviderCode } from "./vendorFiles";
import { PROVIDER_GROUP_CODE } from "../lib/constants";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";
import { readVendorFileValidation } from "../lib/vendorFileErrors";

const sampleRow =
  // 18 columns (0..17), per Careington Electronic Eligibility spec CI007
  [
    "0000000001",   // 0  Unique ID
    "00",            // 1  Sequence
    "1",             // 2  Guardian
    "MO",            // 3  Coverage
    "ACTIVE",        // 4  Status
    "01012025",      // 5  Effective Date
    "Doe",           // 6  Last Name
    "John",          // 7  First Name
    "",              // 8  Middle
    "",              // 9  Suffix
    "M",             // 10 Gender
    "01011980",      // 11 DOB
    "123 Main St",   // 12 Address
    "Apt 4",         // 13 Address 2
    "Springfield",   // 14 City
    "IL",            // 15 State
    "62701",         // 16 Zip
    "ACME-0042",     // 17 Group Code (per-org value)
  ].join("|");

describe("replaceGroupCodeWithProviderCode", () => {
  it("swaps only column 18 (group code)", () => {
    const out = __testOnly_replaceGroupCodeWithProviderCode(sampleRow);
    const inFields = sampleRow.split("|");
    const outFields = out.split("|");

    // All other columns unchanged
    for (let i = 0; i < 17; i++) {
      expect(outFields[i]).toBe(inFields[i]);
    }
    // Column 18 (index 17) is replaced with the canonical provider code
    expect(outFields[17]).toBe(PROVIDER_GROUP_CODE);
    // No extra/fewer columns introduced
    expect(outFields).toHaveLength(inFields.length);
  });

  it("returns a row with PROVIDER_GROUP_CODE regardless of input value", () => {
    const variants = ["IDC-0001", "ACME-9999", "XYZ", ""];
    for (const code of variants) {
      const fields = sampleRow.split("|");
      fields[17] = code;
      const out = __testOnly_replaceGroupCodeWithProviderCode(fields.join("|"));
      expect(out.split("|")[17]).toBe(PROVIDER_GROUP_CODE);
    }
  });

  it("leaves rows with fewer than 18 columns unchanged", () => {
    const short = "abc|def|ghi";
    expect(__testOnly_replaceGroupCodeWithProviderCode(short)).toBe(short);
  });
});

async function exportWorld() {
  const t = convexTest(schema);
  const ids = await t.run(async ctx => {
    await ctx.db.insert("adminUsers", { clerkUserId: "vendor_owner", name: "Owner", email: "owner@example.test", role: "owner", createdAt: 0 });
    const siteId = await ctx.db.insert("sites", { slug: "vendor", name: "Vendor", type: "primary", branding: {}, allowedPlanIds: [], enrollmentDefaults: { requireGroupCode: false, requireEligibilityMatch: false, allowSelfEnrollment: false, requirePayment: false, autoActivate: false, collectAddress: true, collectPhone: false, collectEmployeeId: false }, status: "active", createdAt: 0, updatedAt: 0 });
    const accountId = await ctx.db.insert("accounts", { siteId, slug: "vendor", name: "Vendor", accountType: "employer", billingModel: "per_member", contacts: [], status: "active", createdAt: 0, updatedAt: 0 });
    const groups = [];
    const members = [];
    for (let i = 1; i <= 2; i++) {
      const groupId = await ctx.db.insert("groups", { siteId, accountId, slug: `org-${i}`, name: `Organization ${i}`, groupCode: `GROUP${i}`, organizationCode: `ORG${i}`, status: "active", createdAt: 0, updatedAt: 0 });
      const memberId = await ctx.db.insert("memberProfiles", { siteId, accountId, groupId, memberId: `MBR-${i}`, barcode: `BAR${i}`, careingtonUniqueId: `10000000${i}`, firstName: "Sample", lastName: "Member", email: `member${i}@example.test`, dateOfBirth: "1990-05-14", effectiveDate: "2026-10-16", address: { line1: "123 Main St", city: "Dallas", state: "TX", postalCode: "75034", country: "US" }, memberType: "active", status: "active", memberRole: "primary", createdAt: 0, updatedAt: 0 });
      groups.push(groupId); members.push(memberId);
    }
    return { groups, members };
  });
  return { t, admin: t.withIdentity({ tokenIdentifier: "https://test.clerk.dev|vendor_owner" }), ...ids };
}

describe("vendor export validation", () => {
  it("returns all blocked organizations through nested actions without a partial file", async () => {
    const { t, admin, members } = await exportWorld();
    await t.run(async ctx => {
      await ctx.db.patch(members[0], { address: undefined });
      await ctx.db.patch(members[1], { dateOfBirth: undefined });
    });
    const error = await admin.action(api.admin.vendorFiles.generateAggregatedDentalDiscountNetworkFile, { vendor: "careington" }).catch(error => error);
    const report = readVendorFileValidation(error);
    expect(report).toMatchObject({ code: "VENDOR_FILE_VALIDATION", errorCount: 5 });
    expect(report?.organizations.map(org => org.name)).toEqual(["Organization 1", "Organization 2"]);
    expect(report?.organizations[0].issues).toContain("Row 1 (Member MBR-1): address is required");
    expect(report?.organizations[1].issues).toContain("Row 1 (Member MBR-2): dateOfBirth is required");
    expect(error).not.toHaveProperty("content");
    expect(JSON.stringify(report)).not.toContain("member1@example.test");
    expect(await t.run(ctx => ctx.db.query("memberProfiles").collect())).toHaveLength(2);
  });

  it("reports a missing DialCare email once and preserves dental export eligibility", async () => {
    const { t, admin, groups, members } = await exportWorld();
    await t.run(ctx => ctx.db.patch(members[0], { email: undefined }));
    const error = await admin.action(api.admin.vendorFiles.generateDialCareFile, { groupId: groups[0] }).catch(error => error);
    const report = readVendorFileValidation(error);
    expect(report?.errorCount).toBe(1);
    expect(report?.organizations[0].issues).toEqual(["Row 1 (Member MBR-1): Email Address is required for primary e-fulfillment"]);
    const dental = await admin.action(api.admin.vendorFiles.generateDentalDiscountNetworkFile, { groupId: groups[0] });
    expect(dental.memberCount).toBe(1);
  });

  it("keeps valid aggregate rows identical except for provider code and preserves historical dates", async () => {
    const { admin, groups } = await exportWorld();
    const single = await admin.action(api.admin.vendorFiles.generateDentalDiscountNetworkFile, { groupId: groups[0] });
    const combined = await admin.action(api.admin.vendorFiles.generateAggregatedDentalDiscountNetworkFile, { vendor: "careington" });
    expect(combined).toMatchObject({ memberCount: 2, totalRecords: 2, organizationCount: 2 });
    const rows = combined.content.trim().split("\r\n");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toBe(__testOnly_replaceGroupCodeWithProviderCode(single.content.trim()));
    expect(rows.every((row: string) => row.split("|")[17] === PROVIDER_GROUP_CODE)).toBe(true);
    expect(rows[0].split("|")[19]).toBe("10162026");
  });

  it("does not mask authorization failures as member data errors", async () => {
    const { t } = await exportWorld();
    const error = await t.action(api.admin.vendorFiles.generateAggregatedDentalDiscountNetworkFile, {}).catch(error => error);
    expect(readVendorFileValidation(error)).toBeNull();
    expect(String(error)).toContain("Authentication required");
  });

  it("reports manual exports without fabricated generation timestamps", async () => {
    const { admin } = await exportWorld();
    const configs = await admin.query(api.admin.vendorFiles.getVendorConfigurations);
    expect(configs.every(config => config.lastGenerated === null && config.status === "manual" && config.format === "Pipe-delimited TXT")).toBe(true);
  });
});
