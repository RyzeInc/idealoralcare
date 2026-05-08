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

// ─── Brand colours ────────────────────────────────────────────────────────────
const BLUE = "#1E88E5";
const DARK = "#222222";
const GRAY = "#666666";
const LIGHT_GRAY = "#E5E7EB";
const ROW_BG = "#F8FAFC";

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

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: DARK,
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 48,
  },
  // Header
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  logo: { width: 140 },
  wordmark: { fontSize: 18, fontFamily: "Helvetica-Bold", color: BLUE },
  invoiceTitle: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: DARK,
    letterSpacing: 2,
    textAlign: "right",
  },
  invoiceNumber: { fontSize: 11, color: GRAY, textAlign: "right", marginTop: 4 },
  // Parties block
  partiesRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 28 },
  partyBlock: { width: "48%" },
  partyLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: BLUE,
    letterSpacing: 1,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  partyName: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  partyLine: { fontSize: 10, color: DARK, marginBottom: 1 },
  partyMuted: { fontSize: 9, color: GRAY, marginBottom: 1 },
  // Meta box
  metaTable: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: LIGHT_GRAY,
    borderBottomWidth: 1,
    borderBottomColor: LIGHT_GRAY,
    marginBottom: 24,
  },
  metaCell: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: LIGHT_GRAY,
  },
  metaCellLast: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  metaLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: GRAY,
    letterSpacing: 1,
    marginBottom: 3,
    textTransform: "uppercase",
  },
  metaValue: { fontSize: 10, fontFamily: "Helvetica-Bold", color: DARK },
  // Line items table
  table: { marginBottom: 16 },
  thead: {
    flexDirection: "row",
    backgroundColor: BLUE,
    color: "#FFFFFF",
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  th: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#FFFFFF" },
  thDesc: { flex: 4 },
  thQty: { flex: 1, textAlign: "right" },
  thAmount: { flex: 1.4, textAlign: "right" },
  tr: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: ROW_BG,
    borderBottomWidth: 1,
    borderBottomColor: LIGHT_GRAY,
  },
  td: { fontSize: 10, color: DARK },
  tdDesc: { flex: 4 },
  tdSubDesc: { fontSize: 8, color: GRAY, marginTop: 3 },
  tdQty: { flex: 1, textAlign: "right" },
  tdAmount: { flex: 1.4, textAlign: "right", fontFamily: "Helvetica-Bold" },
  // Totals
  totalsRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 8 },
  totalsBox: { width: "45%" },
  totalLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  totalLabel: { fontSize: 10, color: DARK },
  totalValue: { fontSize: 10, color: DARK },
  totalDivider: { borderTopWidth: 1, borderTopColor: LIGHT_GRAY, marginVertical: 4 },
  grandTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: BLUE,
    marginTop: 4,
  },
  grandTotalLabel: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#FFFFFF" },
  grandTotalValue: { fontSize: 14, fontFamily: "Helvetica-Bold", color: "#FFFFFF" },
  balanceLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginTop: 4,
  },
  balanceLabel: { fontSize: 11, fontFamily: "Helvetica-Bold", color: DARK },
  balanceValue: { fontSize: 11, fontFamily: "Helvetica-Bold", color: DARK },
  // Payment instructions
  instructionsBox: {
    marginTop: 28,
    padding: 14,
    borderWidth: 1,
    borderColor: LIGHT_GRAY,
  },
  instructionsHeading: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: BLUE,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  instructionsBody: { fontSize: 9.5, color: DARK, lineHeight: 1.5, marginBottom: 4 },
  // Footer
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    textAlign: "center",
    fontSize: 8,
    color: GRAY,
    borderTopWidth: 1,
    borderTopColor: LIGHT_GRAY,
    paddingTop: 8,
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMoney(cents: number): string {
  const amt = (cents / 100).toFixed(2);
  const [whole, frac] = amt.split(".");
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${withCommas}.${frac}`;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatPeriod(period: string): string {
  // "YYYY-MM" → "Month YYYY"
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", timeZone: "UTC" });
}

// ─── Data shape ───────────────────────────────────────────────────────────────

export interface GroupInvoicePdfData {
  invoiceNumberDisplay: string;
  groupName: string;
  groupCode: string;
  organizationCode?: string | null;
  accountName: string;
  billingContactName?: string | null;
  billingContactEmail?: string | null;
  coveragePeriod: string;            // "YYYY-MM"
  billingDate: number;
  paymentDueDate: number;
  rateLabel: string;
  memberCount: number;
  subtotalCents: number;
  adjustmentCents: number;
  adjustmentNotes?: string | null;
  totalCents: number;
  amountPaidCents: number;
  balanceCents: number;
  paymentMethod?: "check" | "ach" | "wire" | null; // group's preferred remit method
  // Optional remitter info (sourced from env when generating)
  remitTo?: {
    payeeName?: string;
    addressLines?: string[];
    achInstructions?: string;
  };
}

// ─── PDF Component ────────────────────────────────────────────────────────────

export function GroupInvoicePdf({ data }: { data: GroupInvoicePdfData }) {
  const periodLabel = formatPeriod(data.coveragePeriod);
  const remit = data.remitTo ?? {};
  const payee = remit.payeeName ?? "Ideal Oral Health";
  const addressLines = remit.addressLines ?? [];
  const memoRef = `Invoice #${data.invoiceNumberDisplay} — ${data.groupName} (${periodLabel})`;

  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        {/* Header */}
        <View style={s.headerRow}>
          <View>
            {LOGO_DATA_URI ? (
              <Image src={LOGO_DATA_URI} style={s.logo} />
            ) : (
              <Text style={s.wordmark}>Ideal Oral Health</Text>
            )}
          </View>
          <View>
            <Text style={s.invoiceTitle}>INVOICE</Text>
            <Text style={s.invoiceNumber}>#{data.invoiceNumberDisplay}</Text>
          </View>
        </View>

        {/* Parties */}
        <View style={s.partiesRow}>
          <View style={s.partyBlock}>
            <Text style={s.partyLabel}>From</Text>
            <Text style={s.partyName}>{payee}</Text>
            {addressLines.map((line, i) => (
              <Text key={i} style={s.partyLine}>{line}</Text>
            ))}
          </View>
          <View style={s.partyBlock}>
            <Text style={s.partyLabel}>Bill To</Text>
            <Text style={s.partyName}>{data.groupName}</Text>
            <Text style={s.partyMuted}>{data.accountName}</Text>
            {data.billingContactName ? (
              <Text style={s.partyLine}>Attn: {data.billingContactName}</Text>
            ) : null}
            {data.billingContactEmail ? (
              <Text style={s.partyLine}>{data.billingContactEmail}</Text>
            ) : null}
            <Text style={s.partyMuted}>
              {data.organizationCode
                ? `Org Code: ${data.organizationCode}`
                : `Group Code: ${data.groupCode}`}
            </Text>
          </View>
        </View>

        {/* Meta strip */}
        <View style={s.metaTable}>
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>Issue Date</Text>
            <Text style={s.metaValue}>{formatDate(data.billingDate)}</Text>
          </View>
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>Due Date</Text>
            <Text style={s.metaValue}>{formatDate(data.paymentDueDate)}</Text>
          </View>
          <View style={s.metaCellLast}>
            <Text style={s.metaLabel}>Coverage Period</Text>
            <Text style={s.metaValue}>{periodLabel}</Text>
          </View>
        </View>

        {/* Single-line item — no per-member breakdown */}
        <View style={s.table}>
          <View style={s.thead}>
            <Text style={[s.th, s.thDesc]}>Description</Text>
            <Text style={[s.th, s.thQty]}>Members</Text>
            <Text style={[s.th, s.thAmount]}>Amount</Text>
          </View>
          <View style={s.tr}>
            <View style={s.tdDesc}>
              <Text style={s.td}>{data.rateLabel}</Text>
              <Text style={s.tdSubDesc}>
                Group membership for {periodLabel}
              </Text>
            </View>
            <Text style={[s.td, s.tdQty]}>{data.memberCount}</Text>
            <Text style={[s.td, s.tdAmount]}>{formatMoney(data.subtotalCents)}</Text>
          </View>
        </View>

        {/* Totals */}
        <View style={s.totalsRow}>
          <View style={s.totalsBox}>
            <View style={s.totalLine}>
              <Text style={s.totalLabel}>Subtotal</Text>
              <Text style={s.totalValue}>{formatMoney(data.subtotalCents)}</Text>
            </View>
            {data.adjustmentCents !== 0 && (
              <View style={s.totalLine}>
                <Text style={s.totalLabel}>
                  Adjustment{data.adjustmentNotes ? ` (${data.adjustmentNotes})` : ""}
                </Text>
                <Text style={s.totalValue}>
                  {data.adjustmentCents > 0 ? "+" : "-"}
                  {formatMoney(Math.abs(data.adjustmentCents))}
                </Text>
              </View>
            )}
            <View style={s.totalDivider} />
            <View style={s.grandTotal}>
              <Text style={s.grandTotalLabel}>TOTAL DUE</Text>
              <Text style={s.grandTotalValue}>{formatMoney(data.totalCents)}</Text>
            </View>
            {data.amountPaidCents > 0 && (
              <>
                <View style={s.totalLine}>
                  <Text style={s.totalLabel}>Amount Paid</Text>
                  <Text style={s.totalValue}>−{formatMoney(data.amountPaidCents)}</Text>
                </View>
                <View style={s.balanceLine}>
                  <Text style={s.balanceLabel}>Balance Remaining</Text>
                  <Text style={s.balanceValue}>{formatMoney(data.balanceCents)}</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Payment Instructions */}
        <View style={s.instructionsBox}>
          <Text style={s.instructionsHeading}>Payment Instructions</Text>
          <Text style={s.instructionsBody}>
            Please remit payment in full by {formatDate(data.paymentDueDate)}.
          </Text>
          {data.paymentMethod === "ach" || (!data.paymentMethod && remit.achInstructions) ? (
            <Text style={s.instructionsBody}>
              {remit.achInstructions ?? "Remit by ACH using the bank instructions provided separately by your account manager."}
            </Text>
          ) : (
            <Text style={s.instructionsBody}>
              Make checks payable to <Text style={{ fontFamily: "Helvetica-Bold" }}>{payee}</Text>
              {addressLines.length > 0 ? ` and mail to ${addressLines.join(", ")}.` : "."}
            </Text>
          )}
          <Text style={s.instructionsBody}>
            Include the following on your check memo or ACH reference:{" "}
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{memoRef}</Text>
          </Text>
        </View>

        {/* Footer */}
        <Text style={s.footer} fixed>
          Questions about this invoice? Contact billing@idealoralhealth.com · Invoice #{data.invoiceNumberDisplay}
        </Text>
      </Page>
    </Document>
  );
}
