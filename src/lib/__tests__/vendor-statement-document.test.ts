/**
 * Export builders — the last mile where a disclosure mistake would actually
 * reach a partner. These assert on the emitted bytes, not on the policy that
 * produced them, so a regression in either layer shows up here.
 */

import { describe, test, expect } from "vitest";
import {
  memberDetailTable,
  periodStatementsToCsv,
  statementToCsv,
  summaryTable,
  type VendorStatementDocument,
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
  showGroups: false,
  showTier: false,
  internal: false,
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
  showGroups: true,
  showTier: true,
  internal: true,
  primaryCount: 1,
  memberLines: [
    {
      memberId: "M-1",
      firstName: "Ada",
      lastName: "Lovelace",
      groupCode: "ACMEMFG",
      groupName: "Acme Manufacturing",
      rateClass: "Family",
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

  test("the internal statement's columns carry the whole split", () => {
    const table = memberDetailTable(internal);
    expect(table.header).toEqual([
      "Member ID",
      "Last Name",
      "First Name",
      "Group Code",
      "Group",
      "Rate Class",
      "Amount",
      "Gross",
      "Toothlens",
      "Careington",
      "Processing",
      "Ideal Health",
      "Ryze Keep",
    ]);
    expect(table.rows[0]).toContain("Acme Manufacturing");
  });

  test("amounts export as numbers in dollars so a spreadsheet can total them", () => {
    const row = memberDetailTable(internal).rows[0];
    expect(row[row.length - 1]).toBe(12); // ryzeKeepCents 1200 → 12
    expect(typeof row[6]).toBe("number");
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
    // Group Code + Rate Class columns are empty for the flat-fee recipient.
    expect(toothlensRow.split(",").slice(7, 9)).toEqual(["", ""]);
    expect(ryzeRow.split(",").slice(7, 9)).toEqual(["ACMEMFG", "Family"]);
  });
});
