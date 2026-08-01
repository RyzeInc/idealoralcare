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
  tHeader: {
    flexDirection: "row",
    backgroundColor: HEADER_BG,
    borderBottomWidth: 1,
    borderBottomColor: CELL_BORDER,
  },
  tRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: CELL_BORDER },
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
      <View style={s.table}>
        <View style={s.tHeader}>
          <Text style={[s.cell, s.colGroupName, s.headerText]}>Organization</Text>
          {doc.showBroker && (
            <Text style={[s.cell, s.colGroupCode, s.headerText]}>Rep / Agency</Text>
          )}
          <Text style={[s.cell, s.colCount, s.headerText]}>Ind / Fam</Text>
          <Text style={[s.cell, s.colCount, s.headerText]}>Primaries</Text>
          <Text style={[s.cellLast, s.colAmount, s.headerText]}>Amount</Text>
        </View>
        {doc.groups.map((row, index) => (
          <View key={`${row.groupCode}-${row.groupName}-${index}`} style={s.tRow} wrap={false}>
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
        <View style={s.tFooter} wrap={false}>
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

/** Column widths, so a wide selection still fits the page. */
function memberColumnStyle(key: string, count: number) {
  const wide = count > 6;
  switch (key) {
    case "memberId": return { width: wide ? "13%" : "22%" };
    case "memberName": return { flexGrow: 1, flexBasis: 0 };
    case "amount": return { width: wide ? "11%" : "16%", textAlign: "right" as const };
    case "grossCents":
    case "toothlensCents":
    case "careingtonCents":
    case "processingCents":
    case "partnerVendorCents":
    case "ryzeKeepCents":
      return { width: "9%", textAlign: "right" as const };
    default: return { width: wide ? "11%" : "16%" };
  }
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
    default: return "";
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

  const columns = doc.columns ?? [];
  if (columns.length === 0) return null;
  const showsRep = columns.some((c) => c.key.startsWith("rep") || c.key === "agencyName");

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
      <View style={s.table}>
        <View style={s.tHeader} fixed>
          {columns.map((column, index) => (
            <Text
              key={column.key}
              style={[
                index === columns.length - 1 ? s.cellLast : s.cell,
                memberColumnStyle(column.key, columns.length),
                s.headerText,
              ]}
            >
              {column.label}
            </Text>
          ))}
        </View>
        {doc.memberLines.map((line, rowIndex) => (
          <View key={`${line.memberId}-${rowIndex}`} style={s.tRow} wrap={false}>
            {columns.map((column, index) => (
              <Text
                key={column.key}
                style={[
                  index === columns.length - 1 ? s.cellLast : s.cell,
                  memberColumnStyle(column.key, columns.length),
                ]}
              >
                {memberCellText(line, column.key)}
              </Text>
            ))}
          </View>
        ))}
        <View style={s.tFooter} wrap={false}>
          {columns.map((column, index) => (
            <Text
              key={column.key}
              style={[
                index === columns.length - 1 ? s.cellLast : s.cell,
                memberColumnStyle(column.key, columns.length),
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
      <View style={s.table}>
        <View style={s.tHeader}>
          <Text style={[s.cell, s.colDate, s.headerText]}>Recorded</Text>
          <Text style={[s.cell, s.colReason, s.headerText]}>Reason</Text>
          <Text style={[s.cell, s.colNotes, s.headerText]}>Notes</Text>
          <Text style={[s.cellLast, s.colAmount, s.headerText]}>Amount</Text>
        </View>
        {doc.adjustments.map((row, index) => (
          <View key={index} style={s.tRow} wrap={false}>
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

export function VendorStatementPdf({ doc }: { doc: VendorStatementDocument }) {
  return (
    <Document
      title={`${doc.vendorName} Remittance Statement ${doc.period} (${doc.statementNumberDisplay})`}
      author={doc.brandName}
      subject={`Vendor remittance statement for coverage month ${doc.period}`}
    >
      <Page size="LETTER" style={s.page}>
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
        <Page key={doc.statementNumberDisplay} size="LETTER" style={s.page}>
          <StatementBody doc={doc} />
        </Page>
      ))}
    </Document>
  );
}

export type { VendorStatementDocument };
