import React from "react";
import fs from "fs";
import path from "path";
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import {
  formatCoverageRange,
  formatStatementDate,
  formatStatementMoney as money,
  type VendorStatementDocument,
} from "./vendor-statement-document";

/**
 * Branded vendor remittance statement.
 *
 * Deliberately shares the visual language of the list-bill invoice
 * (src/lib/list-bill-invoice-pdf.tsx) — same logo treatment, palette, rules,
 * and remit block — so both sides of the ledger look like they came from the
 * same company.
 *
 * What a recipient may see is decided upstream by VENDOR_POLICY; this
 * component renders whatever it is handed and never re-derives disclosure.
 * There is intentionally no "field withheld" language anywhere: absent data is
 * simply absent.
 */

// ─── Brand / palette (matched to the list-bill invoice) ───────────────────────
const DARK = "#111111";
const TEXT = "#222222";
const MUTED = "#5B6470";
const RULE = "#000000";
const CELL_BORDER = "#444444";
const HEADER_BG = "#E5E7EB";
const FOOTER_BG = "#D1D5DB";

let LOGO_DATA_URI: string | null = null;
try {
  const logoPath = path.join(process.cwd(), "public", "ideal-oral-health-logo.png");
  if (fs.existsSync(logoPath)) {
    LOGO_DATA_URI = `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`;
  }
} catch {
  LOGO_DATA_URI = null;
}

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: TEXT,
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 48,
  },
  // A busy table needs the margins back before it needs landscape.
  pageWide: { paddingHorizontal: 28 },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  brandName: { fontSize: 22, fontFamily: "Helvetica-Bold", color: DARK },
  logo: { width: 130, marginBottom: 6 },
  documentTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: DARK,
    textAlign: "right",
  },
  recipientLine: { fontSize: 11, textAlign: "right", marginTop: 4, color: TEXT },
  metaBlock: { marginTop: 6 },
  metaLine: { fontSize: 10, color: TEXT, marginBottom: 1 },
  rule: { borderBottomWidth: 1, borderBottomColor: RULE, marginVertical: 8 },
  sectionH: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: DARK,
    marginTop: 10,
    marginBottom: 5,
  },
  kvRow: { flexDirection: "row", marginBottom: 3 },
  kvLabel: { width: 150, fontSize: 10, color: TEXT },
  kvValue: { flex: 1, fontSize: 10, color: TEXT },
  kvValueBold: { flex: 1, fontSize: 10, color: DARK, fontFamily: "Helvetica-Bold" },

  table: { marginTop: 4, borderWidth: 1, borderColor: CELL_BORDER },
  // Border-less wrapper so the table can break across pages without leaving
  // an empty bordered strip behind.
  tableFlow: { marginTop: 4 },
  rowRule: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: CELL_BORDER,
  },
  tHeader: {
    flexDirection: "row",
    backgroundColor: HEADER_BG,
    borderTopWidth: 1,
    borderTopColor: CELL_BORDER,
  },
  tRow: { flexDirection: "row" },
  tFooter: { flexDirection: "row", backgroundColor: FOOTER_BG },
  cell: {
    paddingVertical: 5,
    paddingHorizontal: 6,
    fontSize: 9,
    color: TEXT,
    borderRightWidth: 1,
    borderRightColor: CELL_BORDER,
  },
  cellLast: { paddingVertical: 5, paddingHorizontal: 6, fontSize: 9, color: TEXT },
  headerText: { fontFamily: "Helvetica-Bold", fontSize: 9, color: DARK },
  boldText: { fontFamily: "Helvetica-Bold" },

  colId: { width: "24%" },
  colName: { width: "26%" },
  colGroup: { flex: 1 },
  colClass: { width: "16%" },
  colAmount: { width: "18%", textAlign: "right" },
  // Narrower member columns when the rep columns share the row.
  colIdWithRep: { width: "17%" },
  colNameWithRep: { width: "20%" },
  colClassWithRep: { width: "12%" },
  colRep: { flex: 1 },
  colRepCode: { width: "13%" },
  colAmountWithRep: { width: "15%", textAlign: "right" },

  colGroupCode: { width: "18%" },
  colGroupName: { flex: 1 },
  colCount: { width: "22%", textAlign: "right" },

  colDate: { width: "16%" },
  colReason: { width: "22%" },
  colNotes: { flex: 1 },

  totalsBox: { alignSelf: "flex-end", width: 260, marginTop: 14 },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: CELL_BORDER,
  },
  totalsGrand: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: RULE,
    marginTop: 2,
  },
  totalsLabel: { fontSize: 10, color: TEXT },
  totalsGrandLabel: { fontSize: 12, fontFamily: "Helvetica-Bold", color: DARK },
  totalsGrandValue: { fontSize: 12, fontFamily: "Helvetica-Bold", color: DARK },

  remitBlock: { marginTop: 14 },
  remitLabel: { fontSize: 10, fontFamily: "Helvetica-Bold", color: TEXT, marginBottom: 2 },
  remitLine: { fontSize: 10, color: TEXT, marginBottom: 1, marginLeft: 14 },
  note: { fontSize: 9, color: MUTED, marginTop: 8, lineHeight: 1.4 },

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
  watermark: {
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function Header({ doc, compact = false }: { doc: VendorStatementDocument; compact?: boolean }) {
  return (
    <View style={s.topRow}>
      <View>
        {LOGO_DATA_URI ? (
          <Image src={LOGO_DATA_URI} style={s.logo} />
        ) : (
          <Text style={s.brandName}>{doc.brandName}</Text>
        )}
        <View style={s.metaBlock}>
          <Text style={s.metaLine}>Statement #: {doc.statementNumberDisplay}</Text>
          <Text style={s.metaLine}>Coverage Month: {doc.period}</Text>
          {!compact && (
            <Text style={s.metaLine}>
              Statement Date: {formatStatementDate(doc.statementDate)}
            </Text>
          )}
        </View>
      </View>
      <View>
        <Text style={s.documentTitle}>Remittance Statement</Text>
        <Text style={s.recipientLine}>{doc.vendorName}</Text>
      </View>
    </View>
  );
}

function StatementSummary({ doc }: { doc: VendorStatementDocument }) {
  return (
    <View>
      <Text style={s.sectionH}>Statement Summary</Text>
      <View style={s.kvRow}>
        <Text style={s.kvLabel}>Coverage Window:</Text>
        <Text style={s.kvValue}>{formatCoverageRange(doc)}</Text>
      </View>
      <View style={s.kvRow}>
        <Text style={s.kvLabel}>Basis of Payment:</Text>
        <Text style={s.kvValue}>{doc.basis}</Text>
      </View>
      <View style={s.kvRow}>
        <Text style={s.kvLabel}>Covered Primaries:</Text>
        <Text style={s.kvValueBold}>{doc.primaryCount}</Text>
      </View>
      <View style={s.kvRow}>
        <Text style={s.kvLabel}>Individual / Family:</Text>
        <Text style={s.kvValue}>
          {doc.individualCount} / {doc.familyCount}
        </Text>
      </View>
      <View style={s.kvRow}>
        <Text style={s.kvLabel}>Remittance Due:</Text>
        <Text style={s.kvValue}>{formatStatementDate(doc.paymentDueDate)}</Text>
      </View>
      {doc.amountPaidCents > 0 && (
        <View style={s.kvRow}>
          <Text style={s.kvLabel}>Remitted to Date:</Text>
          <Text style={s.kvValue}>{money(doc.amountPaidCents)}</Text>
        </View>
      )}
    </View>
  );
}

function GroupTable({ doc }: { doc: VendorStatementDocument }) {
  if (!doc.showGroups || doc.groups.length === 0) return null;
  return (
    <View>
      <Text style={s.sectionH}>Group Summary</Text>
      <View style={s.tableFlow}>
        <View style={[s.tHeader, s.rowRule]}>
          <Text style={[s.cell, s.colGroupName, s.headerText]}>Organization</Text>
          {doc.showBroker && (
            <Text style={[s.cell, s.colGroupCode, s.headerText]}>Rep / Agency</Text>
          )}
          <Text style={[s.cell, s.colCount, s.headerText]}>Ind / Fam</Text>
          <Text style={[s.cell, s.colCount, s.headerText]}>Primaries</Text>
          <Text style={[s.cellLast, s.colAmount, s.headerText]}>Amount</Text>
        </View>
        {doc.groups.map((row, index) => (
          <View
            key={`${row.groupCode}-${row.groupName}-${index}`}
            style={[s.tRow, s.rowRule]}
            wrap={false}
          >
            <Text style={[s.cell, s.colGroupName]}>
              {row.groupName}
              {row.organizationCode ? ` (${row.organizationCode})` : ""}
              {doc.groupCodeVaries ? ` · ${row.groupCode}` : ""}
            </Text>
            {doc.showBroker && (
              <Text style={[s.cell, s.colGroupCode]}>
                {row.repName ?? "—"}
                {row.agencyName ? `\n${row.agencyName}` : ""}
              </Text>
            )}
            <Text style={[s.cell, s.colCount]}>
              {row.individualCount} / {row.familyCount}
            </Text>
            <Text style={[s.cell, s.colCount]}>{row.primaryCount}</Text>
            <Text style={[s.cellLast, s.colAmount]}>{money(row.amountCents)}</Text>
          </View>
        ))}
        <View style={[s.tFooter, s.rowRule]} wrap={false}>
          <Text style={[s.cell, s.colGroupName, s.boldText]}>Total</Text>
          {doc.showBroker && <Text style={[s.cell, s.colGroupCode]}> </Text>}
          <Text style={[s.cell, s.colCount, s.boldText]}>
            {doc.individualCount} / {doc.familyCount}
          </Text>
          <Text style={[s.cell, s.colCount, s.boldText]}>{doc.primaryCount}</Text>
          <Text style={[s.cellLast, s.colAmount, s.boldText]}>
            {money(doc.subtotalCents)}
          </Text>
        </View>
      </View>
    </View>
  );
}

function NotItemizedNote({ doc }: { doc: VendorStatementDocument }) {
  if (doc.memberDetailComplete || doc.missingDetailGroups.length === 0) return null;
  const total = doc.missingDetailGroups.reduce((n, g) => n + g.primaryCount, 0);
  return (
    <Text style={s.note}>
      {total} covered {total === 1 ? "primary is" : "primaries are"} included in the
      totals above but not itemized below:{" "}
      {doc.missingDetailGroups
        .map((g) => `${g.groupName} (${g.primaryCount})`)
        .join(", ")}
      .
    </Text>
  );
}

/**
 * Relative widths. Columns are laid out by weight and then normalised to
 * exactly 100%, so adding a column narrows the others instead of pushing the
 * row off the page. Fixed percentages were what produced the clipped IDs and
 * names running into the next cell.
 */
const COLUMN_WEIGHT: Record<string, number> = {
  memberId: 15,
  memberName: 20,
  firstName: 11,
  lastName: 11,
  memberEmail: 20,
  phone: 11,
  dob: 9,
  ssn: 10,
  gender: 6,
  memberRole: 8,
  relationship: 10,
  primaryMember: 16,
  dependentCount: 7,
  memberType: 9,
  effectiveDate: 10,
  createdAt: 9,
  censusMissing: 18,
  rateClass: 9,
  addressLine1: 18,
  city: 10,
  state: 5,
  postalCode: 7,
  organization: 14,
  orgCode: 9,
  groupCode: 9,
  employeeType: 8,
  location: 10,
  department: 11,
  groupMemberId: 9,
  listBillStatus: 9,
  repName: 14,
  repCode: 10,
  repEmail: 18,
  agencyName: 14,
  careingtonId: 13,
  careingtonSeq: 6,
  toothlensId: 13,
  clerkId: 16,
  systemPresence: 9,
  subscriptionStatus: 9,
  entitlementCount: 7,
  barcode: 12,
  subscriberId: 12,
  amount: 10,
  grossCents: 9,
  toothlensCents: 9,
  careingtonCents: 9,
  processingCents: 9,
  partnerVendorCents: 9,
  ryzeKeepCents: 9,
};

/** Shorter headers so a label never stacks four lines deep. */
const COLUMN_SHORT_LABEL: Record<string, string> = {
  rateClass: "Rate Class",
  censusMissing: "Missing Census",
  organization: "Organization",
  subscriptionStatus: "Subscription",
  entitlementCount: "Entitlements",
  systemPresence: "Presence",
  grossCents: "Gross",
  toothlensCents: "Toothlens",
  careingtonCents: "Careington",
  processingCents: "Processing",
  partnerVendorCents: "Ideal",
  ryzeKeepCents: "Ryze",
  dependentCount: "Deps",
  addressLine1: "Address",
  groupMemberId: "Employee #",
  listBillStatus: "List Bill",
  careingtonId: "Careington ID",
  careingtonSeq: "Seq #",
  toothlensId: "Toothlens ID",
};

const RIGHT_ALIGNED = new Set([
  "amount",
  "grossCents",
  "toothlensCents",
  "careingtonCents",
  "processingCents",
  "partnerVendorCents",
  "ryzeKeepCents",
  "dependentCount",
  "entitlementCount",
]);

function columnLayout(columns: Array<{ key: string; label: string }>) {
  const weights = columns.map((c) => COLUMN_WEIGHT[c.key] ?? 11);
  const total = weights.reduce((n, w) => n + w, 0) || 1;
  // A tighter type size once the row gets busy, so cells stop wrapping.
  const fontSize = columns.length <= 6 ? 9 : columns.length <= 9 ? 7.5 : 6.5;
  return columns.map((column, index) => ({
    ...column,
    header: COLUMN_SHORT_LABEL[column.key] ?? column.label,
    // Percent strings keep react-pdf from rounding a row past 100%.
    width: `${((weights[index] / total) * 100).toFixed(4)}%`,
    align: (RIGHT_ALIGNED.has(column.key) ? "right" : "left") as "right" | "left",
    fontSize,
  }));
}

function memberCellText(
  line: VendorStatementDocument["memberLines"][number],
  key: string,
): string {
  const money2 = (c?: number) => money(c ?? 0);
  switch (key) {
    case "memberId": return line.memberId;
    case "memberName": return `${line.lastName}, ${line.firstName}`;
    case "rateClass": return line.rateClass ?? "";
    case "organization": return line.groupName ?? "";
    case "orgCode": return line.organizationCode ?? "";
    case "groupCode": return line.groupCode ?? "";
    case "repName": return line.repName ?? "Unattributed";
    case "repCode": return line.repCode ?? "";
    case "repEmail": return line.repEmail ?? "";
    case "agencyName": return line.agencyName ?? "";
    case "amount": return money(line.amountCents);
    case "grossCents": return money2(line.grossCents);
    case "toothlensCents": return money2(line.toothlensCents);
    case "careingtonCents": return money2(line.careingtonCents);
    case "processingCents": return money2(line.processingCents);
    case "partnerVendorCents": return money2(line.partnerVendorCents);
    case "ryzeKeepCents": return money2(line.ryzeKeepCents);
    default: return String(line.extra?.[key] ?? "");
  }
}

function MemberTable({ doc }: { doc: VendorStatementDocument }) {
  if (!doc.memberDetailAvailable) {
    return (
      <View>
        <Text style={s.sectionH}>Covered Primary Detail</Text>
        <Text style={s.note}>
          This coverage month was closed before per-primary lines were frozen. The
          totals on this statement are authoritative and were taken from that close.
        </Text>
      </View>
    );
  }
  if (doc.memberLines.length === 0) return null;

  const raw = doc.columns ?? [];
  if (raw.length === 0) return null;
  const columns = columnLayout(raw);
  const showsRep = raw.some((c) => c.key.startsWith("rep") || c.key === "agencyName");

  const cellStyle = (
    col: ReturnType<typeof columnLayout>[number],
    last: boolean,
  ) => [
    last ? s.cellLast : s.cell,
    {
      width: col.width,
      textAlign: col.align,
      fontSize: col.fontSize,
      // Without an explicit basis a long value stretches its own column and
      // squeezes the neighbour, which is what clipped the Careington IDs.
      flexGrow: 0,
      flexShrink: 0,
    },
  ];

  return (
    <View>
      <Text style={s.sectionH}>Covered Primary Detail</Text>
      <NotItemizedNote doc={doc} />
      {showsRep && (
        <Text style={s.note}>
          {doc.attributionBasis === "current"
            ? "Rep and agency shown are the current attribution of record; this coverage month was closed before attribution was captured."
            : doc.attributionBasis === "mixed"
              ? "Rep and agency were captured at close for most members; the remainder show the current attribution of record."
              : "Rep and agency were captured when this coverage month was closed."}
        </Text>
      )}
      {/*
        No border on the wrapper: a bordered container that spans a page break
        leaves an empty boxed strip at the foot of the page. Each row carries
        its own rules instead, so the table can flow across pages cleanly.
      */}
      <View style={s.tableFlow}>
        <View style={[s.tHeader, s.rowRule]} fixed>
          {columns.map((column, index) => (
            <Text
              key={column.key}
              style={[
                ...cellStyle(column, index === columns.length - 1),
                s.headerText,
                { fontSize: column.fontSize },
              ]}
            >
              {column.header}
            </Text>
          ))}
        </View>
        {doc.memberLines.map((line, rowIndex) => (
          <View
            key={`${line.memberId}-${rowIndex}`}
            style={[s.tRow, s.rowRule]}
            wrap={false}
          >
            {columns.map((column, index) => (
              <Text
                key={column.key}
                style={cellStyle(column, index === columns.length - 1)}
              >
                {memberCellText(line, column.key)}
              </Text>
            ))}
          </View>
        ))}
        <View style={[s.tFooter, s.rowRule]} wrap={false}>
          {columns.map((column, index) => (
            <Text
              key={column.key}
              style={[
                ...cellStyle(column, index === columns.length - 1),
                s.boldText,
              ]}
            >
              {index === 0
                ? `${doc.memberLines.length} lines`
                : column.key === "amount"
                  ? money(doc.itemizedCents)
                  : " "}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

function AdjustmentTable({ doc }: { doc: VendorStatementDocument }) {
  // When itemization is off the net figure still appears in the totals block.
  if (!doc.showAdjustmentDetail || doc.adjustments.length === 0) return null;
  return (
    <View>
      <Text style={s.sectionH}>Adjustments</Text>
      <View style={s.tableFlow}>
        <View style={[s.tHeader, s.rowRule]}>
          <Text style={[s.cell, s.colDate, s.headerText]}>Recorded</Text>
          <Text style={[s.cell, s.colReason, s.headerText]}>Reason</Text>
          <Text style={[s.cell, s.colNotes, s.headerText]}>Notes</Text>
          <Text style={[s.cellLast, s.colAmount, s.headerText]}>Amount</Text>
        </View>
        {doc.adjustments.map((row, index) => (
          <View key={index} style={[s.tRow, s.rowRule]} wrap={false}>
            <Text style={[s.cell, s.colDate]}>
              {new Date(row.createdAt).toISOString().slice(0, 10)}
            </Text>
            <Text style={[s.cell, s.colReason]}>{row.reason}</Text>
            <Text style={[s.cell, s.colNotes]}>{row.notes}</Text>
            <Text style={[s.cellLast, s.colAmount]}>{money(row.deltaCents)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Totals({ doc }: { doc: VendorStatementDocument }) {
  return (
    <View style={s.totalsBox}>
      <View style={s.totalsRow}>
        <Text style={s.totalsLabel}>Subtotal</Text>
        <Text style={s.totalsLabel}>{money(doc.subtotalCents)}</Text>
      </View>
      {(doc.adjustments.length > 0 || doc.adjustmentCents !== 0) && (
        <View style={s.totalsRow}>
          <Text style={s.totalsLabel}>Adjustments</Text>
          <Text style={s.totalsLabel}>{money(doc.adjustmentCents)}</Text>
        </View>
      )}
      <View style={s.totalsGrand}>
        <Text style={s.totalsGrandLabel}>Statement Total</Text>
        <Text style={s.totalsGrandValue}>{money(doc.totalCents)}</Text>
      </View>
      {doc.amountPaidCents > 0 && (
        <>
          <View style={s.totalsRow}>
            <Text style={s.totalsLabel}>Remitted</Text>
            <Text style={s.totalsLabel}>{money(doc.amountPaidCents)}</Text>
          </View>
          <View style={s.totalsRow}>
            <Text style={[s.totalsLabel, s.boldText]}>Balance</Text>
            <Text style={[s.totalsLabel, s.boldText]}>{money(doc.balanceCents)}</Text>
          </View>
        </>
      )}
    </View>
  );
}

function RemitBlock({ doc }: { doc: VendorStatementDocument }) {
  const remit = doc.remitFrom;
  return (
    <View style={s.remitBlock}>
      <Text style={s.remitLabel}>Remitted by:</Text>
      <Text style={s.remitLine}>{remit.payeeName}</Text>
      {remit.addressLines.map((line, i) => (
        <Text key={i} style={s.remitLine}>{line}</Text>
      ))}
      {remit.contactEmail && <Text style={s.remitLine}>{remit.contactEmail}</Text>}
      {remit.contactPhone && <Text style={s.remitLine}>{remit.contactPhone}</Text>}
    </View>
  );
}

function StatementBody({ doc }: { doc: VendorStatementDocument }) {
  return (
    <>
      {doc.status === "draft" && <Text style={s.watermark} fixed>DRAFT</Text>}
      {doc.status === "voided" && <Text style={s.watermark} fixed>VOID</Text>}
      <Header doc={doc} />
      <View style={s.rule} />
      <StatementSummary doc={doc} />
      <GroupTable doc={doc} />
      <MemberTable doc={doc} />
      <AdjustmentTable doc={doc} />
      <Totals doc={doc} />
      <RemitBlock doc={doc} />
      <Text style={s.footer} fixed>
        {doc.vendorName} · Coverage month {doc.period} · Statement{" "}
        {doc.statementNumberDisplay} · Figures taken from the{" "}
        {formatStatementDate(doc.sourceClosedAt)} close of {doc.period} and do not
        change.
      </Text>
    </>
  );
}

// ─── Documents ────────────────────────────────────────────────────────────────

/**
 * How much page a statement needs. Narrow margins first, then landscape —
 * a wide column selection should stay readable rather than clip.
 */
function pageLayout(doc: VendorStatementDocument) {
  const count = doc.memberDetailAvailable ? (doc.columns ?? []).length : 0;
  return {
    style: count > 7 ? [s.page, s.pageWide] : s.page,
    orientation: (count > 11 ? "landscape" : "portrait") as
      | "landscape"
      | "portrait",
  };
}

export function VendorStatementPdf({ doc }: { doc: VendorStatementDocument }) {
  return (
    <Document
      title={`${doc.vendorName} Remittance Statement ${doc.period} (${doc.statementNumberDisplay})`}
      author={doc.brandName}
      subject={`Vendor remittance statement for coverage month ${doc.period}`}
    >
      <Page
        size="LETTER"
        orientation={pageLayout(doc).orientation}
        style={pageLayout(doc).style}
      >
        <StatementBody doc={doc} />
      </Page>
    </Document>
  );
}

/**
 * Every recipient for one coverage month in a single file — each statement
 * starts on its own page, so the bundle can be split or printed as-is.
 */
export function VendorStatementBundlePdf({
  docs,
  period,
}: {
  docs: VendorStatementDocument[];
  period: string;
}) {
  return (
    <Document
      title={`Vendor Remittance Statements ${period}`}
      author={docs[0]?.brandName ?? "Ryze LLC"}
      subject={`All vendor remittance statements for coverage month ${period}`}
    >
      {docs.map((doc) => (
        <Page
          key={doc.statementNumberDisplay}
          size="LETTER"
          orientation={pageLayout(doc).orientation}
          style={pageLayout(doc).style}
        >
          <StatementBody doc={doc} />
        </Page>
      ))}
    </Document>
  );
}

export type { VendorStatementDocument };
