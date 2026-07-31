/**
 * Export builders — the last mile where a disclosure mistake would actually
 * reach a partner. These assert on the emitted bytes, not on the policy that
 * produced them, so a regression in either layer shows up here.
 */

import { describe, test, expect } from "vitest";
import {
  memberDetailTable,
  periodBundleFileBase,
  periodStatementsToCsv,
  statementFileBase,
  statementToCsv,
  summaryTable,
  verificationToCsv,
  type VendorStatementDocument,
  type VerificationDocument,
} from "../vendor-statement-document";

const BASE = {
  period: "2026-05",
  // May 1 00:00:00.000 UTC → May 31 23:59:59.999 UTC
  coverageStart: Date.UTC(2026, 4, 1),
  coverageEnd: Date.UTC(2026, 5, 1) - 1,
  statementDate: Date.UTC(2026, 5, 2),
  paymentDueDate: Date.UTC(2026, 6, 2),
  sourceClosedAt: Date.UTC(2026, 5, 1, 0, 5),
  memberDetailAvailable: true,
  adjustments: [],
  adjustmentCents: 0,
  amountPaidCents: 0,
  brandName: "Ryze LLC",
  remitFrom: { payeeName: "Ryze LLC", addressLines: ["1846 Fernando Ln"] },
} as const;

const flatFee: VendorStatementDocument = {
  ...BASE,
  statementNumberDisplay: "VS-10001",
  status: "issued",
  vendor: "toothlens",
  vendorName: "Toothlens",
  basis: "Flat service fee per covered primary",
  showMemberDetail: true,
  showGroups: false,
  showTier: false,
  showBroker: false,
  showFullSplit: false,
  showAdjustmentDetail: true,
  attributionBasis: "none",
  primaryCount: 2,
  memberLines: [
    { memberId: "M-1", firstName: "Ada", lastName: "Lovelace", amountCents: 100 },
    { memberId: "M-2", firstName: "Alan", lastName: "Turing", amountCents: 100 },
  ],
  groups: [],
  subtotalCents: 200,
  totalCents: 200,
  balanceCents: 200,
};

const internal: VendorStatementDocument = {
  ...BASE,
  statementNumberDisplay: "VS-10004",
  status: "issued",
  vendor: "ryze",
  vendorName: "Ryze",
  basis: "Carrier residual after vendor and processing dispersal",
  showMemberDetail: true,
  showGroups: true,
  showTier: true,
  showBroker: true,
  showFullSplit: true,
  showAdjustmentDetail: true,
  attributionBasis: "frozen",
  primaryCount: 1,
  memberLines: [
    {
      memberId: "M-1",
      firstName: "Ada",
      lastName: "Lovelace",
      groupCode: "ACMEMFG",
      groupName: "Acme Manufacturing",
      rateClass: "Family",
      repName: "Dana Reyes",
      repCode: "BRK-REYES-01",
      repEmail: "dana@agency.test",
      agencyName: "Southeast Benefits Group",
      amountCents: 1200,
      grossCents: 2499,
      toothlensCents: 100,
      careingtonCents: 400,
      processingCents: 99,
      partnerVendorCents: 700,
      ryzeKeepCents: 1200,
    },
  ],
  groups: [
    {
      groupCode: "ACMEMFG",
      groupName: "Acme Manufacturing",
      primaryCount: 1,
      amountCents: 1200,
    },
  ],
  subtotalCents: 1200,
  totalCents: 1200,
  balanceCents: 1200,
};

describe("vendor statement exports", () => {
  test("a flat-fee recipient's columns carry no group, tier, or retail figures", () => {
    const table = memberDetailTable(flatFee);
    expect(table.header).toEqual(["Member ID", "Last Name", "First Name", "Amount"]);
    expect(table.rows[0]).toEqual(["M-1", "Lovelace", "Ada", 1]);
  });

  test("the internal statement's columns carry the whole split and the rep", () => {
    const table = memberDetailTable(internal);
    expect(table.header).toEqual([
      "Member ID",
      "Last Name",
      "First Name",
      "Group Code",
      "Group",
      "Rate Class",
      "Rep / Broker",
      "Rep Code",
      "Rep Email",
      "Agency",
      "Amount",
      "Gross",
      "Toothlens",
      "Careington",
      "Processing",
      "Ideal Health",
      "Ryze Keep",
    ]);
    expect(table.rows[0]).toContain("Acme Manufacturing");
    expect(table.rows[0]).toContain("Dana Reyes");
    expect(table.rows[0]).toContain("Southeast Benefits Group");
  });

  test("amounts export as numbers in dollars so a spreadsheet can total them", () => {
    const table = memberDetailTable(internal);
    const row = table.rows[0];
    expect(row[row.length - 1]).toBe(12); // ryzeKeepCents 1200 → 12
    expect(typeof row[table.header.indexOf("Amount")]).toBe("number");
  });

  test("a recipient with no payout obligation gets no rep columns at all", () => {
    const table = memberDetailTable(flatFee);
    expect(table.header).not.toContain("Rep / Broker");
    expect(table.header).not.toContain("Agency");
    expect(statementToCsv(flatFee)).not.toContain("Dana Reyes");
  });

  test("a flat-fee CSV names neither the employer nor the retail premium", () => {
    const csv = statementToCsv(flatFee);
    expect(csv).toContain("VS-10001");
    expect(csv).toContain("Covered Primary Detail");
    expect(csv).toContain("TOTAL");
    expect(csv).not.toContain("ACMEMFG");
    expect(csv).not.toContain("Acme Manufacturing");
    expect(csv).not.toContain("Rate Class");
    expect(csv).not.toContain("Group");
    expect(csv).not.toMatch(/24\.99|14\.99/);
  });

  test("the printed coverage window ends inside the month, not on the 1st of the next", () => {
    const rows = summaryTable(flatFee).rows;
    const window = rows.find((row) => row[0] === "Coverage Window")![1] as string;
    expect(window).toBe("May 1, 2026 – May 31, 2026");
  });

  test("a legacy aggregate-only close says so instead of printing an empty table", () => {
    const csv = statementToCsv({
      ...flatFee,
      memberDetailAvailable: false,
      memberLines: [],
    });
    expect(csv).toContain("closed before per-primary lines were frozen");
  });

  test("the whole-month CSV leaves recipient-restricted columns blank per row", () => {
    const csv = periodStatementsToCsv([flatFee, internal]);
    const lines = csv.split("\r\n");
    const toothlensRow = lines.find((line) => line.startsWith("VS-10001"))!;
    const ryzeRow = lines.find((line) => line.startsWith("VS-10004"))!;
    // Group Code / Rate Class / Rep / Rep Code / Agency are all blank for the
    // flat-fee recipient and populated for the internal one.
    expect(toothlensRow.split(",").slice(7, 12)).toEqual(["", "", "", "", ""]);
    expect(ryzeRow.split(",").slice(7, 12)).toEqual([
      "ACMEMFG",
      "Family",
      "Dana Reyes",
      "BRK-REYES-01",
      "Southeast Benefits Group",
    ]);
  });
});

// ---------------------------------------------------------------------------
// File naming
// ---------------------------------------------------------------------------

describe("vendor statement file names", () => {
  const generatedAt = Date.UTC(2026, 6, 30);

  test("names a recipient document by who, what, why, and when", () => {
    expect(statementFileBase(flatFee, { generatedAt })).toBe(
      "Toothlens_Remittance-Statement_Coverage-2026-05_VS-10001_ISSUED_generated-2026-07-30",
    );
  });

  test("a draft or void copy is never mistakable for the live document", () => {
    expect(statementFileBase({ ...flatFee, status: "draft" }, { generatedAt })).toContain(
      "_DRAFT_",
    );
    expect(statementFileBase({ ...flatFee, status: "voided" }, { generatedAt })).toContain(
      "_VOIDED_",
    );
  });

  test("the coverage month and the generation date are both named and distinct", () => {
    const name = statementFileBase(flatFee, { generatedAt });
    expect(name).toContain("Coverage-2026-05");
    expect(name).toContain("generated-2026-07-30");
  });

  test("the verification export is marked internal-only in its own name", () => {
    const name = statementFileBase(flatFee, {
      variant: "verification",
      generatedAt,
    });
    expect(name).toContain("Statement-Verification");
    expect(name).toContain("INTERNAL-ONLY");
    expect(name).not.toContain("Remittance-Statement");
  });

  test("the whole-month bundle names the payer, scope, and recipient count", () => {
    expect(periodBundleFileBase([flatFee, internal], "2026-05", { generatedAt })).toBe(
      "Ryze-LLC_All-Vendor-Remittance-Statements_Coverage-2026-05_2-recipients_INTERNAL-RECONCILIATION_generated-2026-07-30",
    );
  });

  test("punctuation in a recipient name cannot break the file name", () => {
    const name = statementFileBase(
      { ...flatFee, vendorName: "Ideal Health, Inc. / Dental" },
      { generatedAt },
    );
    expect(name.startsWith("Ideal-Health-Inc-Dental_")).toBe(true);
    expect(name).not.toMatch(/[/,]/);
  });
});

// ---------------------------------------------------------------------------
// Internal verification export
// ---------------------------------------------------------------------------

describe("verification export", () => {
  const audit: VerificationDocument = {
    statementNumberDisplay: "VS-10001",
    vendorName: "Toothlens",
    period: "2026-05",
    status: "issued",
    amountField: "toothlensCents",
    memberDetailAvailable: true,
    lines: [
      {
        memberId: "M-1",
        memberName: "Lovelace, Ada",
        groupCode: "ACMEMFG",
        rateClass: "Family",
        grossCents: 2499,
        toothlensCents: 100,
        careingtonCents: 400,
        processingCents: 99,
        partnerVendorCents: 700,
        ryzeKeepCents: 1200,
        statementCents: 100,
        splitBalances: true,
        repName: "Dana Reyes",
        repCode: "BRK-REYES-01",
        agencyName: "Southeast Benefits Group",
        repSource: "enrollment",
      },
    ],
    totals: {
      grossCents: 2499,
      toothlensCents: 100,
      careingtonCents: 400,
      processingCents: 99,
      partnerVendorCents: 700,
      ryzeKeepCents: 1200,
    },
    statementSubtotalCents: 100,
    statementAdjustmentCents: 0,
    statementTotalCents: 100,
    checks: [
      { label: "Statement subtotal matches the closed books", passed: true, detail: "$1.00 on both sides" },
    ],
    allChecksPassed: true,
  };

  test("carries every bucket so an admin can verify the split, and says it is internal", () => {
    const csv = verificationToCsv(audit);
    expect(csv).toContain("INTERNAL VERIFICATION — NOT FOR DISTRIBUTION");
    expect(csv).toContain("Reconciliation Checks");
    expect(csv).toContain("Full Member Dispersal");
    for (const bucket of ["Toothlens", "Careington", "Processing", "Ideal Health", "Ryze Keep"]) {
      expect(csv).toContain(bucket);
    }
    expect(csv).toContain("Dana Reyes");
  });

  test("an out-of-balance member line is flagged for investigation", () => {
    const broken = {
      ...audit,
      lines: [{ ...audit.lines[0], splitBalances: false }],
    };
    expect(verificationToCsv(broken)).toContain("NO — INVESTIGATE");
  });
});
