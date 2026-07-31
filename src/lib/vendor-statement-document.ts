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
  rateClass?: string;
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
  primaryCount: number;
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

  // Disclosure flags resolved server-side from VENDOR_POLICY.
  showGroups: boolean;
  showTier: boolean;
  internal: boolean;
  memberDetailAvailable: boolean;

  // Content
  primaryCount: number;
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

export function statementFileBase(doc: VendorStatementDocument): string {
  const safeVendor = doc.vendorName.replace(/[^a-z0-9]+/gi, "-");
  return `${safeVendor}-Statement-${doc.period}-${doc.statementNumberDisplay}`;
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
  if (doc.showGroups) header.push("Group Code", "Group");
  if (doc.showTier) header.push("Rate Class");
  header.push("Amount");
  if (doc.internal) {
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
    if (doc.showGroups) row.push(line.groupCode ?? "", line.groupName ?? "");
    if (doc.showTier) row.push(line.rateClass ?? "");
    row.push(line.amountCents / 100);
    if (doc.internal) {
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
  return {
    header: ["Group Code", "Group", "Covered Primaries", "Amount"],
    rows: doc.groups.map((g) => [
      g.groupCode,
      g.groupName,
      g.primaryCount,
      g.amountCents / 100,
    ]),
  };
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
    ["Subtotal", doc.subtotalCents / 100],
  ];
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

  if (doc.adjustments.length > 0) {
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
    "Group Code",
    "Rate Class",
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
        doc.showGroups ? (line.groupCode ?? "") : "",
        doc.showTier ? (line.rateClass ?? "") : "",
        line.amountCents / 100,
      ]);
    }
  }
  return tableToCsv({ header, rows });
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
