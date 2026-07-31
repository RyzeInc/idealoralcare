/**
 * VENDOR STATEMENT — shared document shape and tabular exports.
 *
 * One assembled `VendorStatementDocument` feeds every output format (PDF, CSV,
 * XLSX) so a recipient's statement reads identically whichever file they open,
 * and so the disclosure rules only have to hold in one place. Columns that a
 * recipient may not see are absent from this structure entirely — the export
 * builders below can only emit what the server chose to send.
 */

export interface VendorStatementMemberLine {
  memberId: string;
  firstName: string;
  lastName: string;
  amountCents: number;
  groupCode?: string;
  groupName?: string;
  organizationCode?: string;
  rateClass?: string;
  repName?: string;
  repCode?: string;
  repEmail?: string;
  agencyName?: string;
  grossCents?: number;
  toothlensCents?: number;
  careingtonCents?: number;
  processingCents?: number;
  partnerVendorCents?: number;
  ryzeKeepCents?: number;
}

export interface VendorStatementGroupRow {
  groupCode: string;
  groupName: string;
  organizationCode?: string | null;
  primaryCount: number;
  individualCount: number;
  familyCount: number;
  repName?: string;
  repCode?: string;
  agencyName?: string;
  amountCents: number;
}

export interface VendorStatementAdjustmentRow {
  reason: string;
  notes: string;
  deltaCents: number;
  createdAt: number;
}

export interface VendorStatementDocument {
  // Identity
  statementNumberDisplay: string;
  status: "draft" | "issued" | "partial" | "paid" | "voided";
  vendor: "toothlens" | "careington" | "ideal" | "ryze";
  vendorName: string;
  basis: string;

  // Coverage — coverageEnd is the last representable instant of the month.
  period: string;
  coverageStart: number;
  coverageEnd: number;
  statementDate: number;
  paymentDueDate: number;
  sourceClosedAt: number;

  // Disclosure flags resolved server-side from the recipient's profile.
  showMemberDetail: boolean;
  showGroups: boolean;
  showTier: boolean;
  showBroker: boolean;
  showFullSplit: boolean;
  showAdjustmentDetail: boolean;
  memberDetailAvailable: boolean;
  memberDetailComplete: boolean;
  missingDetailGroups: Array<{ groupName: string; primaryCount: number }>;
  itemizedCents: number;
  /** Whether rep names were frozen at close or resolved from today's records. */
  attributionBasis: "frozen" | "current" | "mixed" | "none";

  // Content
  primaryCount: number;
  individualCount: number;
  familyCount: number;
  /** False when every organization shares one provider code (the usual case). */
  groupCodeVaries: boolean;
  memberLines: VendorStatementMemberLine[];
  groups: VendorStatementGroupRow[];
  adjustments: VendorStatementAdjustmentRow[];

  // Money (integer cents)
  subtotalCents: number;
  adjustmentCents: number;
  totalCents: number;
  amountPaidCents: number;
  balanceCents: number;

  // Payer identity
  brandName: string;
  remitFrom: {
    payeeName: string;
    addressLines: string[];
    contactPhone?: string;
    contactEmail?: string;
  };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatStatementMoney(cents: number): string {
  const negative = cents < 0;
  const amt = (Math.abs(cents) / 100).toFixed(2);
  const [whole, frac] = amt.split(".");
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}$${withCommas}.${frac}`;
}

export function formatStatementDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** "May 1, 2026 – May 31, 2026" — inclusive, as printed. */
export function formatCoverageRange(doc: VendorStatementDocument): string {
  return `${formatStatementDate(doc.coverageStart)} – ${formatStatementDate(doc.coverageEnd)}`;
}

// ---------------------------------------------------------------------------
// File naming
// ---------------------------------------------------------------------------

/**
 * File names answer who / what / why / when without opening the file:
 *
 *   Toothlens_Remittance-Statement_Coverage-2026-05_VS-10001_ISSUED_generated-2026-07-30.pdf
 *   └ who     └ what                 └ why (period + status)          └ when
 *
 * `Coverage-YYYY-MM` is the month being paid for; `generated-YYYY-MM-DD` is
 * when the file was produced. Those two dates differ on every reprint, and
 * confusing them is exactly the mistake the names are built to prevent.
 * Status is included because a DRAFT or VOID copy in someone's downloads
 * folder must never be mistaken for the live document.
 */
function fileToken(value: string): string {
  return value
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function generatedStamp(ms: number = Date.now()): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function statementFileBase(
  doc: VendorStatementDocument,
  opts: { variant?: "recipient" | "verification"; generatedAt?: number } = {},
): string {
  const parts = [
    fileToken(doc.vendorName),
    opts.variant === "verification"
      ? "Statement-Verification"
      : "Remittance-Statement",
    `Coverage-${doc.period}`,
    fileToken(doc.statementNumberDisplay),
    doc.status.toUpperCase(),
  ];
  if (opts.variant === "verification") parts.push("INTERNAL-ONLY");
  parts.push(`generated-${generatedStamp(opts.generatedAt)}`);
  return parts.join("_");
}

/** Whole-month bundle: names the payer, the scope, and the recipient count. */
export function periodBundleFileBase(
  docs: VendorStatementDocument[],
  period: string,
  opts: { generatedAt?: number } = {},
): string {
  const payer = fileToken(docs[0]?.brandName ?? "Ryze-LLC");
  return [
    payer,
    "All-Vendor-Remittance-Statements",
    `Coverage-${period}`,
    `${docs.length}-recipients`,
    "INTERNAL-RECONCILIATION",
    `generated-${generatedStamp(opts.generatedAt)}`,
  ].join("_");
}

// ---------------------------------------------------------------------------
// Tabular builders (shared by CSV and XLSX)
// ---------------------------------------------------------------------------

export type Row = (string | number)[];
export interface Table {
  header: string[];
  rows: Row[];
}

/**
 * Per-primary detail. Amounts are emitted as numbers in dollars so a
 * spreadsheet can sum them without a parse step.
 */
export function memberDetailTable(doc: VendorStatementDocument): Table {
  const header = ["Member ID", "Last Name", "First Name"];
  if (doc.showGroups) {
    header.push("Organization", "Org Code");
    if (doc.groupCodeVaries) header.push("Group Code");
  }
  if (doc.showTier) header.push("Rate Class");
  // Placed before Amount so a payout run reads member → who sold them → what
  // was earned, left to right.
  if (doc.showBroker) {
    header.push("Rep / Broker", "Rep Code", "Rep Email", "Agency");
  }
  header.push("Amount");
  if (doc.showFullSplit) {
    header.push(
      "Gross",
      "Toothlens",
      "Careington",
      "Processing",
      "Ideal Health",
      "Ryze Keep",
    );
  }

  const rows: Row[] = doc.memberLines.map((line) => {
    const row: Row = [line.memberId, line.lastName, line.firstName];
    if (doc.showGroups) {
      row.push(line.groupName ?? "", line.organizationCode ?? "");
      if (doc.groupCodeVaries) row.push(line.groupCode ?? "");
    }
    if (doc.showTier) row.push(line.rateClass ?? "");
    if (doc.showBroker) {
      row.push(
        line.repName ?? "",
        line.repCode ?? "",
        line.repEmail ?? "",
        line.agencyName ?? "",
      );
    }
    row.push(line.amountCents / 100);
    if (doc.showFullSplit) {
      row.push(
        (line.grossCents ?? 0) / 100,
        (line.toothlensCents ?? 0) / 100,
        (line.careingtonCents ?? 0) / 100,
        (line.processingCents ?? 0) / 100,
        (line.partnerVendorCents ?? 0) / 100,
        (line.ryzeKeepCents ?? 0) / 100,
      );
    }
    return row;
  });

  return { header, rows };
}

/** Group rollup — only ever populated for the internal carrier statement. */
export function groupTable(doc: VendorStatementDocument): Table {
  const header = ["Organization", "Org Code"];
  if (doc.groupCodeVaries) header.push("Group Code");
  if (doc.showBroker) header.push("Rep / Broker", "Agency");
  header.push("Individual", "Family", "Covered Primaries", "Amount");

  const rows: Row[] = doc.groups.map((g) => {
    const row: Row = [g.groupName, g.organizationCode ?? ""];
    if (doc.groupCodeVaries) row.push(g.groupCode);
    if (doc.showBroker) row.push(g.repName ?? "", g.agencyName ?? "");
    row.push(g.individualCount, g.familyCount, g.primaryCount, g.amountCents / 100);
    return row;
  });

  // A total row so the rollup foots on its own.
  const total: Row = ["Total", ""];
  if (doc.groupCodeVaries) total.push("");
  if (doc.showBroker) total.push("", "");
  total.push(
    doc.individualCount,
    doc.familyCount,
    doc.primaryCount,
    doc.subtotalCents / 100,
  );
  rows.push(total);

  return { header, rows };
}

/** Cover-sheet facts: what this document is and what it settles. */
export function summaryTable(doc: VendorStatementDocument): Table {
  const rows: Row[] = [
    ["Statement Number", doc.statementNumberDisplay],
    ["Recipient", doc.vendorName],
    ["Status", doc.status.toUpperCase()],
    ["Coverage Month", doc.period],
    ["Coverage Window", formatCoverageRange(doc)],
    ["Statement Date", formatStatementDate(doc.statementDate)],
    ["Remittance Due", formatStatementDate(doc.paymentDueDate)],
    ["Basis of Payment", doc.basis],
    ["Covered Primaries", doc.primaryCount],
    ...(doc.memberDetailAvailable && !doc.memberDetailComplete
      ? ([["Itemized Below", doc.memberLines.length]] as Row[])
      : []),
    ["Individual Rate", doc.individualCount],
    ["Family Rate", doc.familyCount],
    ["Subtotal", doc.subtotalCents / 100],
  ];
  if (doc.showBroker && doc.attributionBasis !== "none") {
    rows.splice(8, 0, [
      "Rep Attribution",
      doc.attributionBasis === "frozen"
        ? "Recorded at close of this coverage month"
        : doc.attributionBasis === "current"
          ? "Current attribution — this close predates recorded attribution"
          : "Mixed — some rows recorded at close, some current",
    ]);
  }
  if (doc.adjustments.length > 0 || doc.adjustmentCents !== 0) {
    rows.push(["Adjustments", doc.adjustmentCents / 100]);
  }
  rows.push(["Statement Total", doc.totalCents / 100]);
  if (doc.amountPaidCents > 0) {
    rows.push(["Remitted to Date", doc.amountPaidCents / 100]);
    rows.push(["Balance", doc.balanceCents / 100]);
  }
  return { header: ["Field", "Value"], rows };
}

export function adjustmentTable(doc: VendorStatementDocument): Table {
  return {
    header: ["Recorded", "Reason", "Notes", "Amount"],
    rows: doc.adjustments.map((a) => [
      new Date(a.createdAt).toISOString().slice(0, 10),
      a.reason,
      a.notes,
      a.deltaCents / 100,
    ]),
  };
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function tableToCsv(table: Table): string {
  return [table.header, ...table.rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}

/**
 * A single statement as CSV: a short identification block, then the per-member
 * detail with a total row. Blank-line separated so it opens cleanly in Excel
 * while still being greppable.
 */
export function statementToCsv(doc: VendorStatementDocument): string {
  const blocks: string[] = [tableToCsv(summaryTable(doc))];

  if (doc.groups.length > 0) {
    blocks.push(`\r\nGroup Summary\r\n${tableToCsv(groupTable(doc))}`);
  }

  if (doc.memberDetailAvailable && doc.memberLines.length > 0) {
    const detail = memberDetailTable(doc);
    const totalRow: Row = detail.header.map((_, i) =>
      i === 0 ? "TOTAL" : i === detail.header.indexOf("Amount") ? doc.subtotalCents / 100 : "",
    );
    blocks.push(
      `\r\nCovered Primary Detail\r\n${tableToCsv({
        header: detail.header,
        rows: [...detail.rows, totalRow],
      })}`,
    );
  } else if (!doc.memberDetailAvailable) {
    blocks.push(
      `\r\nCovered Primary Detail\r\nThis coverage month was closed before per-primary lines were frozen. Totals above are authoritative; detail is not reconstructed from current data.`,
    );
  }

  if (doc.memberDetailAvailable && !doc.memberDetailComplete) {
    const notItemized = doc.missingDetailGroups.reduce(
      (n, g) => n + g.primaryCount,
      0,
    );
    blocks.push(
      `\r\nNot Itemized\r\n${tableToCsv({
        header: ["Organization", "Primaries Not Itemized"],
        rows: [
          ...doc.missingDetailGroups.map((g) => [g.groupName, g.primaryCount]),
          ["TOTAL", notItemized],
        ],
      })}`,
    );
  }

  if (doc.showAdjustmentDetail && doc.adjustments.length > 0) {
    blocks.push(`\r\nAdjustments\r\n${tableToCsv(adjustmentTable(doc))}`);
  }

  return blocks.join("\r\n");
}

/**
 * Every recipient for one coverage month as a single flat, machine-readable
 * CSV — one row per statement line, keyed by recipient. Recipient-specific
 * columns (group, rate class) are only filled where that recipient is entitled
 * to them, so the union header leaks nothing.
 */
export function periodStatementsToCsv(docs: VendorStatementDocument[]): string {
  const header = [
    "Statement Number",
    "Recipient",
    "Coverage Month",
    "Status",
    "Member ID",
    "Last Name",
    "First Name",
    "Organization",
    "Group Code",
    "Rate Class",
    "Rep / Broker",
    "Rep Code",
    "Agency",
    "Amount",
  ];
  const rows: Row[] = [];
  for (const doc of docs) {
    if (doc.memberLines.length === 0) {
      rows.push([
        doc.statementNumberDisplay,
        doc.vendorName,
        doc.period,
        doc.status,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        doc.subtotalCents / 100,
      ]);
      continue;
    }
    for (const line of doc.memberLines) {
      rows.push([
        doc.statementNumberDisplay,
        doc.vendorName,
        doc.period,
        doc.status,
        line.memberId,
        line.lastName,
        line.firstName,
        doc.showGroups ? (line.groupName ?? "") : "",
        doc.showGroups ? (line.groupCode ?? "") : "",
        doc.showTier ? (line.rateClass ?? "") : "",
        doc.showBroker ? (line.repName ?? "") : "",
        doc.showBroker ? (line.repCode ?? "") : "",
        doc.showBroker ? (line.agencyName ?? "") : "",
        line.amountCents / 100,
      ]);
    }
  }
  return tableToCsv({ header, rows });
}

// ---------------------------------------------------------------------------
// Internal verification (never sent to a recipient)
// ---------------------------------------------------------------------------

export interface VerificationDocument {
  statementNumberDisplay: string;
  vendorName: string;
  period: string;
  status: string;
  amountField: string;
  memberDetailAvailable: boolean;
  lines: Array<{
    memberId: string;
    memberName: string;
    groupCode: string;
    rateClass: string;
    grossCents: number;
    toothlensCents: number;
    careingtonCents: number;
    processingCents: number;
    partnerVendorCents: number;
    ryzeKeepCents: number;
    statementCents: number;
    splitBalances: boolean;
    repName: string | null;
    repCode: string | null;
    agencyName: string | null;
    repSource: string;
  }>;
  totals: {
    grossCents: number;
    toothlensCents: number;
    careingtonCents: number;
    processingCents: number;
    partnerVendorCents: number;
    ryzeKeepCents: number;
  };
  statementSubtotalCents: number;
  statementAdjustmentCents: number;
  statementTotalCents: number;
  checks: Array<{ label: string; passed: boolean; detail: string }>;
  allChecksPassed: boolean;
}

/** Every member's full dispersal, with the paid bucket called out. */
export function verificationDetailTable(doc: VerificationDocument): Table {
  return {
    header: [
      "Member ID",
      "Member",
      "Group Code",
      "Rate Class",
      "Gross",
      "Toothlens",
      "Careington",
      "Processing",
      "Ideal Health",
      "Ryze Keep",
      "On This Statement",
      "Split Balances",
      "Rep / Broker",
      "Rep Code",
      "Agency",
      "Attribution Source",
    ],
    rows: doc.lines.map((line) => [
      line.memberId,
      line.memberName,
      line.groupCode,
      line.rateClass,
      line.grossCents / 100,
      line.toothlensCents / 100,
      line.careingtonCents / 100,
      line.processingCents / 100,
      line.partnerVendorCents / 100,
      line.ryzeKeepCents / 100,
      line.statementCents / 100,
      line.splitBalances ? "YES" : "NO — INVESTIGATE",
      line.repName ?? "",
      line.repCode ?? "",
      line.agencyName ?? "",
      line.repSource,
    ]),
  };
}

export function verificationChecksTable(doc: VerificationDocument): Table {
  return {
    header: ["Check", "Result", "Detail"],
    rows: doc.checks.map((check) => [
      check.label,
      check.passed ? "PASS" : "FAIL",
      check.detail,
    ]),
  };
}

export function verificationTotalsTable(doc: VerificationDocument): Table {
  return {
    header: ["Bucket", "Total"],
    rows: [
      ["Gross", doc.totals.grossCents / 100],
      ["Toothlens", doc.totals.toothlensCents / 100],
      ["Careington", doc.totals.careingtonCents / 100],
      ["Processing", doc.totals.processingCents / 100],
      ["Ideal Health", doc.totals.partnerVendorCents / 100],
      ["Ryze Keep", doc.totals.ryzeKeepCents / 100],
      ["— Statement subtotal", doc.statementSubtotalCents / 100],
      ["— Statement adjustments", doc.statementAdjustmentCents / 100],
      ["— Statement total", doc.statementTotalCents / 100],
    ],
  };
}

export function verificationToCsv(doc: VerificationDocument): string {
  const header = tableToCsv({
    header: ["Field", "Value"],
    rows: [
      ["Document", "INTERNAL VERIFICATION — NOT FOR DISTRIBUTION"],
      ["Statement", doc.statementNumberDisplay],
      ["Recipient", doc.vendorName],
      ["Coverage Month", doc.period],
      ["Status", doc.status.toUpperCase()],
      ["Paid From Bucket", doc.amountField],
      ["All Checks Passed", doc.allChecksPassed ? "YES" : "NO"],
    ],
  });
  const blocks = [
    header,
    `\r\nReconciliation Checks\r\n${tableToCsv(verificationChecksTable(doc))}`,
    `\r\nBucket Totals\r\n${tableToCsv(verificationTotalsTable(doc))}`,
  ];
  if (doc.memberDetailAvailable && doc.lines.length > 0) {
    blocks.push(
      `\r\nFull Member Dispersal\r\n${tableToCsv(verificationDetailTable(doc))}`,
    );
  }
  return blocks.join("\r\n");
}

/** Recipient-level rollup used as the cover sheet of a bulk export. */
export function periodSummaryTable(docs: VendorStatementDocument[]): Table {
  return {
    header: [
      "Statement Number",
      "Recipient",
      "Coverage Month",
      "Status",
      "Covered Primaries",
      "Subtotal",
      "Adjustments",
      "Total",
      "Balance",
    ],
    rows: docs.map((doc) => [
      doc.statementNumberDisplay,
      doc.vendorName,
      doc.period,
      doc.status,
      doc.primaryCount,
      doc.subtotalCents / 100,
      doc.adjustmentCents / 100,
      doc.totalCents / 100,
      doc.balanceCents / 100,
    ]),
  };
}
