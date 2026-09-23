/**
 * SHARED PDF THEME
 *
 * Brand colours, the page StyleSheet and the small layout helpers used by every
 * @react-pdf document (fulfillment packet, Essentials packet, membership
 * agreements). Kept in one module so the two programs' packets stay visually
 * identical and a spacing or colour fix lands everywhere at once.
 *
 * Page-specific content lives in the document modules, not here.
 */

import React from "react";
import { Text, View, Image, StyleSheet } from "@react-pdf/renderer";

// ─── Brand colours ────────────────────────────────────────────────────────────
export const BLUE = "#1E88E5";
export const GREEN = "#35C48A";
export const ORANGE = "#F9A825";
export const DARK = "#222222";
export const GRAY = "#666666";
export const LIGHT_BLUE = "#EAF4FD";
export const LIGHT_GREEN = "#EAFBF4";
export const NOTICE_BG = "#FFF8E1";
export const DISCLOSURE_BG = "#F5F5F5";
export const META_BG = "#F4F8FB";
export const ROW_ALT = "#FAFAFA";

// ─── Styles ───────────────────────────────────────────────────────────────────
export const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: DARK,
    paddingTop: 52,
    paddingBottom: 36,
    paddingHorizontal: 40,
  },
  // Header / Footer
  logo: { width: 130, marginBottom: 10 },
  footer: {
    position: "absolute",
    bottom: 14,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 8,
    color: GRAY,
  },
  // Typography
  h1: { fontSize: 20, fontFamily: "Helvetica-Bold", color: BLUE, marginBottom: 2 },
  h2: { fontSize: 16, fontFamily: "Helvetica-Bold", color: BLUE, marginBottom: 6 },
  h3: { fontSize: 12, fontFamily: "Helvetica-Bold", color: BLUE, marginBottom: 4 },
  h4: { fontSize: 11, fontFamily: "Helvetica-Bold", color: BLUE, marginBottom: 3 },
  sectionHeadingGreen: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: GREEN,
    marginTop: 8,
    marginBottom: 2,
  },
  body: { fontSize: 10, lineHeight: 1.5, marginBottom: 6 },
  bodySmall: { fontSize: 9, lineHeight: 1.4, marginBottom: 4 },
  italic: { fontFamily: "Helvetica-Oblique", fontSize: 10, color: GRAY, marginBottom: 6 },
  // Layout
  row: { flexDirection: "row" },
  spacer: { marginBottom: 8 },
  // Meta table
  metaBox: {
    backgroundColor: META_BG,
    padding: 8,
    marginBottom: 4,
    width: "100%",
  },
  metaLabel: { fontSize: 9, fontFamily: "Helvetica-Bold", color: BLUE, marginBottom: 1 },
  metaValue: { fontSize: 9, color: DARK },
  // Notice box
  noticeBox: {
    backgroundColor: NOTICE_BG,
    borderLeftWidth: 3,
    borderLeftColor: ORANGE,
    padding: 10,
    marginBottom: 10,
  },
  // Member summary table
  summaryLabelCell: {
    backgroundColor: LIGHT_BLUE,
    padding: "5 8",
    width: "20%",
  },
  summaryValueCell: {
    padding: "5 8",
    width: "30%",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  summaryLabelText: { fontSize: 9, fontFamily: "Helvetica-Bold", color: BLUE },
  summaryValueText: { fontSize: 9, color: DARK },
  // Two-column highlights
  highlightLeft: {
    backgroundColor: LIGHT_GREEN,
    padding: 10,
    width: "45%",
    marginRight: 8,
  },
  highlightRight: {
    backgroundColor: LIGHT_BLUE,
    padding: 10,
    width: "55%",
  },
  // Disclosure box
  disclosureBox: {
    backgroundColor: DISCLOSURE_BG,
    padding: 10,
    marginTop: 6,
  },
  // Agreement fields
  fieldLabelCell: {
    backgroundColor: LIGHT_BLUE,
    padding: "5 8",
    width: "32%",
  },
  fieldValueCell: {
    padding: "5 8",
    width: "68%",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  // Schedule table
  schedBandRow: {
    backgroundColor: "#666666",
    padding: "5 8",
    marginTop: 6,
  },
  schedHeaderRow: {
    backgroundColor: LIGHT_BLUE,
    flexDirection: "row",
    padding: "4 0",
  },
  schedDataRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#E8E8E8" },
  schedCodeCell: { width: "13%", padding: "4 6", fontSize: 8.5 },
  schedDescCell: { width: "72%", padding: "4 6", fontSize: 8.5 },
  schedAmtCell: { width: "15%", padding: "4 6", fontSize: 8.5, textAlign: "right" },
  // Bullet / numbered list
  bulletRow: { flexDirection: "row", marginBottom: 3 },
  bulletDot: { width: 14, marginTop: 1, fontSize: 10 },
  bulletNum: { width: 18, marginTop: 1, fontSize: 10 },
  bulletText: { flex: 1, fontSize: 10, lineHeight: 1.4 },
  bulletTextSmall: { flex: 1, fontSize: 9, lineHeight: 1.4 },
  contactCell: {
    backgroundColor: DISCLOSURE_BG,
    padding: "6 8",
    width: "33.33%",
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function Bullet({ text, small = false }: { text: string; small?: boolean }) {
  return (
    <View style={s.bulletRow}>
      <Text style={s.bulletDot}>•</Text>
      <Text style={small ? s.bulletTextSmall : s.bulletText}>{text}</Text>
    </View>
  );
}

export function Numbered({ n, text }: { n: number; text: string }) {
  return (
    <View style={s.bulletRow}>
      <Text style={s.bulletNum}>{n}.</Text>
      <Text style={s.bulletText}>{text}</Text>
    </View>
  );
}

export function SectionHeadingGreen({ text }: { text: string }) {
  return <Text style={s.sectionHeadingGreen}>{text}</Text>;
}

// ─── Page logo/footer wrapper ─────────────────────────────────────────────────
export function PageHeader({
  logoDataUri,
  fallbackLabel = "IDEAL ORAL HEALTH",
}: {
  logoDataUri?: string;
  fallbackLabel?: string;
}) {
  // Deliberately NOT `fixed`: marking the header fixed reflows every document
  // that uses it and pushed the oral-care packet onto an extra page. Sections
  // that need more than one page declare a second <Page> instead.
  if (!logoDataUri) {
    return (
      <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: BLUE, marginBottom: 8 }}>
        {fallbackLabel}
      </Text>
    );
  }
  return <Image style={s.logo} src={logoDataUri} />;
}


/**
 * Member ID card geometry, shared by every program's card pages.
 * The card is printed at exact CR80 size (3.375in x 2.125in) with a
 * 0.125in bleed, centered on a LETTER page.
 */
export const cardStyles = StyleSheet.create({
  // Title Page
  titlePage: {
    fontFamily: "Helvetica",
    fontSize: 12,
    color: DARK,
    padding: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  titleContainer: {
    textAlign: "center",
  },
  titleLogo: {
    width: 100,
    height: 100,
    marginBottom: 20,
    marginLeft: "auto",
    marginRight: "auto",
  },
  titleMain: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: BLUE,
    marginBottom: 10,
  },
  titleSub: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: DARK,
    marginBottom: 30,
  },
  titleField: {
    marginBottom: 20,
  },
  titleLabel: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: GRAY,
    marginBottom: 5,
  },
  titleValue: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: BLUE,
  },
  // Card pages — centered on 8.5×11, card printed at exact CR80 size (3.375" × 2.125")
  cardPage: {
    padding: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  // Outer bleed area matches CR80 + 0.125" bleed on each edge
  bleedContainer: {
    width: "3.625in",
    height: "2.375in",
    backgroundColor: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0.125in",
  },
  // Inner card is exactly 3.375" × 2.125" (standard CR80 credit/ID card)
  cardContainer: {
    width: "100%",
    height: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    padding: 11,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    overflow: "hidden",
    position: "relative",
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "#0066CC",
  },
  cardWatermark: {
    position: "absolute",
    width: 44,
    height: 14,
    right: 11,
    bottom: 11,
    opacity: 0.22,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  headerLeft: {
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    flex: 1,
  },
  logo: {
    width: 28,
    height: 28,
  },
  headerText: {
    flex: 1,
  },
  brandName: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 1,
  },
  cardType: {
    fontSize: 6,
    color: "#64748b",
  },
  headerRight: {
    fontSize: 5.5,
    color: "#94a3b8",
    textAlign: "right",
  },
  headerRightLine: {
    marginBottom: 1,
  },
  fieldsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 0,
    flex: 1,
  },
  field: {
    width: "50%",
    marginBottom: 5,
    paddingRight: 5,
  },
  fieldLabel: {
    fontSize: 5,
    fontWeight: "bold",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 1,
  },
  fieldValue: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: "#0f172a",
  },
  memberId: {
    fontFamily: "Courier",
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 4,
    marginTop: 2,
    textAlign: "center",
  },
  footerMain: {
    fontSize: 6,
    fontWeight: "bold",
    color: "#0f172a",
    letterSpacing: 0.3,
  },
  footerSub: {
    fontSize: 5,
    color: "#94a3b8",
    marginTop: 1,
  },
  // Back side
  backContent: {
    flex: 1,
    justifyContent: "flex-start",
  },
  backSection: {
    marginBottom: 8,
  },
  backSectionTitle: {
    fontSize: 7,
    fontWeight: "bold",
    color: BLUE,
    marginBottom: 3,
    textTransform: "uppercase",
  },
  backText: {
    fontSize: 6.5,
    color: DARK,
    lineHeight: 1.3,
    marginBottom: 2,
  },
});

