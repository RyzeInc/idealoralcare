import React from "react";
import fs from "fs";
import path from "path";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";

// ─── Brand / palette ──────────────────────────────────────────────────────────
const DARK = "#111111";
const TEXT = "#222222";
const MUTED = "#5B6470";
const RULE = "#000000";        // images 2/3 use thin black rules
const CELL_BORDER = "#444444"; // bordered tables
const HEADER_BG = "#E5E7EB";   // light gray header rows
const FOOTER_BG = "#D1D5DB";   // total row gray

// Try to embed the logo (optional — falls back to text wordmark if missing)
let LOGO_DATA_URI: string | null = null;
try {
  const logoPath = path.join(process.cwd(), "public", "ideal-oral-health-logo.png");
  if (fs.existsSync(logoPath)) {
    LOGO_DATA_URI = `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`;
  }
} catch {
  LOGO_DATA_URI = null;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: TEXT,
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 48,
  },
  // Header band
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  brandName: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: DARK,
  },
  logo: { width: 130, marginBottom: 6 },
  documentTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: DARK,
    textAlign: "right",
  },
  metaBlock: { marginTop: 6 },
  metaLine: { fontSize: 10, color: TEXT, marginBottom: 1 },
  rule: {
    borderBottomWidth: 1,
    borderBottomColor: RULE,
    marginVertical: 12,
  },
  groupNameLine: { fontSize: 10, color: TEXT, marginTop: 6, marginBottom: 2 },
  // Section headings
  sectionH: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: DARK,
    marginTop: 10,
    marginBottom: 6,
  },
  // Key / value rows in Invoice Summary + Payment Information
  kvRow: { flexDirection: "row", marginBottom: 3 },
  kvLabel: { width: 130, fontSize: 10, color: TEXT },
  kvValue: { fontSize: 10, color: TEXT },
  kvLine: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: RULE,
    height: 12,
  },
  // Aging table (Invoice History)
  agingTable: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: CELL_BORDER,
    marginTop: 4,
  },
  agingCell: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRightWidth: 1,
    borderRightColor: CELL_BORDER,
    alignItems: "center",
  },
  agingCellLast: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignItems: "center",
  },
  agingLabel: { fontSize: 9, color: TEXT, marginBottom: 4, textAlign: "center" },
  agingValue: { fontSize: 10, color: TEXT, textAlign: "center" },
  // Return to / contact
  returnBlock: { marginTop: 12 },
  returnLabel: { fontSize: 10, fontFamily: "Helvetica-Bold", color: TEXT, marginBottom: 2 },
  returnLine: { fontSize: 10, color: TEXT, marginBottom: 1, marginLeft: 14 },
  contactLine: { fontSize: 10, color: TEXT, marginTop: 10 },
  // Member products table
  mpTable: { marginTop: 4, borderWidth: 1, borderColor: CELL_BORDER },
  mpHeader: {
    flexDirection: "row",
    backgroundColor: HEADER_BG,
    borderBottomWidth: 1,
    borderBottomColor: CELL_BORDER,
  },
  mpRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: CELL_BORDER,
  },
  mpFooter: {
    flexDirection: "row",
    backgroundColor: FOOTER_BG,
  },
  mpCell: {
    paddingVertical: 5,
    paddingHorizontal: 6,
    fontSize: 9,
    color: TEXT,
    borderRightWidth: 1,
    borderRightColor: CELL_BORDER,
  },
  mpCellLast: {
    paddingVertical: 5,
    paddingHorizontal: 6,
    fontSize: 9,
    color: TEXT,
  },
  mpHeaderText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: DARK,
  },
  // Column widths for member products table
  colLast: { width: "16%" },
  colFirst: { width: "16%" },
  colId: { width: "14%" },
  colProduct: { flex: 1 },
  colAmount: { width: "14%", textAlign: "right" },
  // Product summary table
  psTable: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: CELL_BORDER,
    width: "55%",
  },
  psHeader: {
    flexDirection: "row",
    backgroundColor: HEADER_BG,
    borderBottomWidth: 1,
    borderBottomColor: CELL_BORDER,
  },
  psRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: CELL_BORDER,
  },
  psFooter: {
    flexDirection: "row",
    backgroundColor: FOOTER_BG,
  },
  psColProduct: { flex: 1 },
  psColCount: { width: "20%", textAlign: "right" },
  psColAmount: { width: "30%", textAlign: "right" },
  // Detail-page top header (smaller)
  detailHeaderMeta: { marginTop: 8 },
  detailMetaLine: { fontSize: 10, color: TEXT, marginBottom: 1 },
  detailReturnBlock: { marginTop: 4 },
  // Footer
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    textAlign: "center",
    fontSize: 8,
    color: MUTED,
    borderTopWidth: 1,
    borderTopColor: RULE,
    paddingTop: 6,
  },
  // Watermark for drafts
  draftWatermark: {
    position: "absolute",
    top: 320,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 80,
    color: "#F1F1F1",
    fontFamily: "Helvetica-Bold",
    transform: "rotate(-25deg)",
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMoney(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const amt = (abs / 100).toFixed(2);
  const [whole, frac] = amt.split(".");
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}$${withCommas}.${frac}`;
}

function formatMoneyOrZero(cents: number): string {
  return cents === 0 ? "$0" : formatMoney(cents);
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatCoverageRange(start: number, end: number): string {
  return `${formatDate(start)} to ${formatDate(end)}`;
}

// ─── Data shape ───────────────────────────────────────────────────────────────

export interface ListBillInvoiceLine {
  memberId: string;
  lastName: string;
  firstName: string;
  productLabel: string;
  rateCents: number;
}

export interface ListBillInvoicePdfData {
  // Document identity
  invoiceNumberDisplay: string;
  isDraft?: boolean;
  // Brand / payee
  brandName: string;            // e.g. "Ideal Health"
  // Group / account
  groupName: string;
  groupCode: string;
  organizationCode?: string | null;
  accountName: string;
  // Period & dates
  coveragePeriod: string;       // "YYYY-MM"
  coverageStart: number;        // ms
  coverageEnd: number;          // ms
  billingDate: number;          // ms (issue date)
  paymentDueDate: number;       // ms
  // Financials (integer cents)
  subtotalCents: number;
  adjustmentCents: number;
  adjustmentNotes?: string | null;
  totalCents: number;
  amountPaidCents: number;
  balanceCents: number;
  // Counts
  memberCount: number;
  // Line items (primary members only)
  lines: ListBillInvoiceLine[];
  // Aging snapshot
  aging: {
    currentCents: number;
    upTo30Cents: number;
    days31To60Cents: number;
    days61To90Cents: number;
    days91PlusCents: number;
    totalDueCents: number;
  };
  // Remit-to
  remitTo: {
    payeeName: string;
    addressLines: string[];
    contactPhone?: string;
    contactEmail?: string;
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PageHeader({ data, compact = false }: { data: ListBillInvoicePdfData; compact?: boolean }) {
  return (
    <View style={s.topRow}>
      <View>
        {LOGO_DATA_URI ? (
          <Image src={LOGO_DATA_URI} style={s.logo} />
        ) : (
          <Text style={s.brandName}>{data.brandName}</Text>
        )}
        <View style={compact ? s.detailHeaderMeta : s.metaBlock}>
          <Text style={compact ? s.detailMetaLine : s.metaLine}>
            Invoice #: {data.invoiceNumberDisplay}
          </Text>
          <Text style={compact ? s.detailMetaLine : s.metaLine}>
            Group: {data.groupName}
            {data.organizationCode ? ` (${data.organizationCode})` : data.groupCode ? ` (${data.groupCode})` : ""}
          </Text>
          {!compact && (
            <Text style={s.metaLine}>Billing Date: {formatDate(data.billingDate)}</Text>
          )}
          {compact && (
            <>
              <Text style={s.detailMetaLine}>
                Coverage Period: {formatCoverageRange(data.coverageStart, data.coverageEnd)}
              </Text>
              <Text style={s.detailMetaLine}>
                Payment Due Date: {formatDate(data.paymentDueDate)}
              </Text>
            </>
          )}
        </View>
      </View>
      <View>
        <Text style={s.documentTitle}>List Bill Invoice</Text>
        {compact && <RemitToBlock data={data} alignRight />}
      </View>
    </View>
  );
}

function RemitToBlock({
  data,
  alignRight = false,
}: {
  data: ListBillInvoicePdfData;
  alignRight?: boolean;
}) {
  const remit = data.remitTo;
  return (
    <View style={[s.returnBlock, alignRight ? { alignItems: "flex-start", marginTop: 12 } : {}]}>
      <Text style={s.returnLabel}>Return this invoice to:</Text>
      <Text style={s.returnLine}>{remit.payeeName}</Text>
      {remit.addressLines.length === 0 ? (
        <Text style={s.returnLine}> </Text>
      ) : (
        remit.addressLines.map((line, i) => (
          <Text key={i} style={s.returnLine}>{line}</Text>
        ))
      )}
    </View>
  );
}

function InvoiceSummary({ data }: { data: ListBillInvoicePdfData }) {
  const productCount = new Set(data.lines.map((l) => l.productLabel)).size || data.memberCount;
  return (
    <View>
      <Text style={s.sectionH}>Invoice Summary</Text>
      <View style={s.kvRow}>
        <Text style={s.kvLabel}># of Members:</Text>
        <Text style={s.kvValue}>{data.memberCount}</Text>
      </View>
      <View style={s.kvRow}>
        <Text style={s.kvLabel}># of Products:</Text>
        <Text style={s.kvValue}>{data.lines.length}</Text>
      </View>
      <View style={s.kvRow}>
        <Text style={s.kvLabel}>Coverage Period:</Text>
        <Text style={s.kvValue}>{formatCoverageRange(data.coverageStart, data.coverageEnd)}</Text>
      </View>
      <View style={s.kvRow}>
        <Text style={s.kvLabel}>Adjustments:</Text>
        <Text style={s.kvValue}>
          {formatMoney(data.adjustmentCents)}
          {data.adjustmentCents !== 0 && data.adjustmentNotes ? ` (${data.adjustmentNotes})` : ""}
        </Text>
      </View>
      <View style={s.kvRow}>
        <Text style={s.kvLabel}>Invoice Amount:</Text>
        <Text style={s.kvValue}>{formatMoney(data.totalCents)}</Text>
      </View>
      {/* productCount kept around for future use; reference to satisfy linter */}
      <Text style={{ display: "none" }}>{productCount}</Text>
    </View>
  );
}

function AgingTable({ data }: { data: ListBillInvoicePdfData }) {
  const a = data.aging;
  return (
    <View>
      <Text style={s.sectionH}>Invoice History</Text>
      <View style={s.agingTable}>
        <View style={s.agingCell}>
          <Text style={s.agingLabel}>Current</Text>
          <Text style={s.agingValue}>{formatMoneyOrZero(a.currentCents)}</Text>
        </View>
        <View style={s.agingCell}>
          <Text style={s.agingLabel}>Up to 30 Days</Text>
          <Text style={s.agingValue}>{formatMoneyOrZero(a.upTo30Cents)}</Text>
        </View>
        <View style={s.agingCell}>
          <Text style={s.agingLabel}>31 to 60 Days</Text>
          <Text style={s.agingValue}>{formatMoneyOrZero(a.days31To60Cents)}</Text>
        </View>
        <View style={s.agingCell}>
          <Text style={s.agingLabel}>61 to 90 Days</Text>
          <Text style={s.agingValue}>{formatMoneyOrZero(a.days61To90Cents)}</Text>
        </View>
        <View style={s.agingCell}>
          <Text style={s.agingLabel}>91+ Days</Text>
          <Text style={s.agingValue}>{formatMoneyOrZero(a.days91PlusCents)}</Text>
        </View>
        <View style={s.agingCellLast}>
          <Text style={s.agingLabel}>Total Due</Text>
          <Text style={s.agingValue}>{formatMoney(a.totalDueCents)}</Text>
        </View>
      </View>
    </View>
  );
}

function PaymentInformation({ data }: { data: ListBillInvoicePdfData }) {
  return (
    <View>
      <Text style={s.sectionH}>Payment Information</Text>
      <View style={s.kvRow}>
        <Text style={s.kvLabel}>Payment Due Date:</Text>
        <Text style={s.kvValue}>{formatDate(data.paymentDueDate)}</Text>
      </View>
      <View style={s.kvRow}>
        <Text style={s.kvLabel}>Amount Paid:</Text>
        {data.amountPaidCents > 0 ? (
          <Text style={s.kvValue}>{formatMoney(data.amountPaidCents)}</Text>
        ) : (
          <View style={s.kvLine} />
        )}
      </View>
      <View style={s.kvRow}>
        <Text style={s.kvLabel}>Check Number:</Text>
        <View style={s.kvLine} />
      </View>
    </View>
  );
}

function MemberProductsTable({ lines, totalCents }: { lines: ListBillInvoiceLine[]; totalCents: number }) {
  return (
    <View style={s.mpTable}>
      <View style={s.mpHeader}>
        <Text style={[s.mpCell, s.mpHeaderText, s.colLast]}>LAST NAME</Text>
        <Text style={[s.mpCell, s.mpHeaderText, s.colFirst]}>FIRST NAME</Text>
        <Text style={[s.mpCell, s.mpHeaderText, s.colId]}>ID</Text>
        <Text style={[s.mpCell, s.mpHeaderText, s.colProduct]}>PRODUCT</Text>
        <Text style={[s.mpCellLast, s.mpHeaderText, s.colAmount]}>AMOUNT</Text>
      </View>
      {lines.map((l, i) => (
        <View key={`${l.memberId}-${i}`} style={s.mpRow} wrap={false}>
          <Text style={[s.mpCell, s.colLast]}>{l.lastName}</Text>
          <Text style={[s.mpCell, s.colFirst]}>{l.firstName}</Text>
          <Text style={[s.mpCell, s.colId]}>{l.memberId}</Text>
          <Text style={[s.mpCell, s.colProduct]}>{l.productLabel}</Text>
          <Text style={[s.mpCellLast, s.colAmount]}>{formatMoney(l.rateCents)}</Text>
        </View>
      ))}
      <View style={s.mpFooter}>
        <Text style={[s.mpCell, s.colLast]}> </Text>
        <Text style={[s.mpCell, s.colFirst]}> </Text>
        <Text style={[s.mpCell, s.colId]}> </Text>
        <Text style={[s.mpCell, s.colProduct, { fontFamily: "Helvetica-Bold", textAlign: "right" }]}>Total</Text>
        <Text style={[s.mpCellLast, s.colAmount, { fontFamily: "Helvetica-Bold" }]}>
          {formatMoney(totalCents)}
        </Text>
      </View>
    </View>
  );
}

function ProductSummaryTable({ lines }: { lines: ListBillInvoiceLine[] }) {
  // Aggregate by productLabel
  const agg = new Map<string, { count: number; cents: number }>();
  for (const l of lines) {
    const cur = agg.get(l.productLabel) ?? { count: 0, cents: 0 };
    cur.count += 1;
    cur.cents += l.rateCents;
    agg.set(l.productLabel, cur);
  }
  const rows = [...agg.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const totalCount = rows.reduce((s, [, v]) => s + v.count, 0);
  const totalCents = rows.reduce((s, [, v]) => s + v.cents, 0);
  return (
    <View>
      <Text style={s.sectionH}>Product Summary</Text>
      <View style={s.psTable}>
        <View style={s.psHeader}>
          <Text style={[s.mpCell, s.mpHeaderText, s.psColProduct]}>PRODUCT</Text>
          <Text style={[s.mpCell, s.mpHeaderText, s.psColCount]}>COUNT</Text>
          <Text style={[s.mpCellLast, s.mpHeaderText, s.psColAmount]}>AMOUNT</Text>
        </View>
        {rows.map(([label, v], i) => (
          <View key={`${label}-${i}`} style={s.psRow} wrap={false}>
            <Text style={[s.mpCell, s.psColProduct]}>{label}</Text>
            <Text style={[s.mpCell, s.psColCount]}>{v.count}</Text>
            <Text style={[s.mpCellLast, s.psColAmount]}>{formatMoney(v.cents)}</Text>
          </View>
        ))}
        <View style={s.psFooter}>
          <Text style={[s.mpCell, s.psColProduct, { fontFamily: "Helvetica-Bold", textAlign: "right" }]}>Total</Text>
          <Text style={[s.mpCell, s.psColCount, { fontFamily: "Helvetica-Bold" }]}>{totalCount}</Text>
          <Text style={[s.mpCellLast, s.psColAmount, { fontFamily: "Helvetica-Bold" }]}>{formatMoney(totalCents)}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Document ─────────────────────────────────────────────────────────────────

export function ListBillInvoicePdf({ data }: { data: ListBillInvoicePdfData }) {
  const contact = data.remitTo.contactPhone
    ? `If you have any questions, please contact at ${data.remitTo.contactPhone}`
    : data.remitTo.contactEmail
    ? `If you have any questions, please contact ${data.remitTo.contactEmail}`
    : null;

  return (
    <Document>
      {/* Page 1: Summary */}
      <Page size="LETTER" style={s.page}>
        {data.isDraft && <Text style={s.draftWatermark}>DRAFT</Text>}

        <PageHeader data={data} />
        <Text style={s.groupNameLine}>{data.accountName || data.groupName}</Text>

        <View style={s.rule} />

        <InvoiceSummary data={data} />
        <AgingTable data={data} />
        <PaymentInformation data={data} />
        <RemitToBlock data={data} />
        {contact && <Text style={s.contactLine}>{contact}</Text>}

        <View style={s.rule} />

        <Text style={s.footer} fixed>
          Invoice #{data.invoiceNumberDisplay} · {data.groupName} · {formatDate(data.billingDate)}
        </Text>
      </Page>

      {/* Page 2+: Member Products */}
      <Page size="LETTER" style={s.page}>
        {data.isDraft && <Text style={s.draftWatermark}>DRAFT</Text>}

        <PageHeader data={data} compact />

        <Text style={s.sectionH}>Member Products</Text>
        <MemberProductsTable lines={data.lines} totalCents={data.subtotalCents} />

        <View style={{ marginTop: 18 }}>
          <ProductSummaryTable lines={data.lines} />
        </View>

        <Text style={s.footer} fixed>
          Invoice #{data.invoiceNumberDisplay} · {data.groupName} · {formatDate(data.billingDate)}
        </Text>
      </Page>
    </Document>
  );
}
