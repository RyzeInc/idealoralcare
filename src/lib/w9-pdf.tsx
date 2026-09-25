import React from "react";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";

const BLUE = "#1E88E5";
const DARK = "#222222";
const GRAY = "#666666";
const BORDER = "#cbd5e1";

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: DARK,
    paddingTop: 40,
    paddingBottom: 36,
    paddingHorizontal: 40,
  },
  h1: { fontSize: 16, fontFamily: "Helvetica-Bold", color: BLUE, marginBottom: 2 },
  h2: { fontSize: 11, fontFamily: "Helvetica-Bold", color: BLUE, marginTop: 14, marginBottom: 6 },
  italic: { fontFamily: "Helvetica-Oblique", fontSize: 9, color: GRAY, marginBottom: 10 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BORDER, paddingVertical: 6 },
  label: { width: "35%", fontSize: 9, fontFamily: "Helvetica-Bold", color: GRAY },
  value: { width: "65%", fontSize: 10, color: DARK },
  body: { fontSize: 9, lineHeight: 1.5, marginBottom: 6 },
  certBox: { borderWidth: 1, borderColor: BORDER, padding: 10, marginTop: 6, marginBottom: 14 },
  signatureBlock: { marginTop: 10, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 10 },
  signatureImg: { width: 220, height: 55, marginTop: 4, marginBottom: 4 },
  footer: {
    position: "absolute",
    bottom: 14,
    left: 40,
    right: 40,
    fontSize: 7.5,
    color: GRAY,
  },
});

const CLASSIFICATION_LABEL: Record<string, string> = {
  individual: "Individual / Sole proprietor or single-member LLC",
  c_corp: "C Corporation",
  s_corp: "S Corporation",
  partnership: "Partnership",
  trust_estate: "Trust/estate",
  llc: "Limited liability company",
  other: "Other",
};

export interface SubstituteW9Data {
  legalName: string;
  businessName?: string;
  taxClassification: string;
  llcTaxClassification?: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  tinType: "ssn" | "ein";
  tin: string; // full, unmasked — only ever handled server-side
  signatureDataUrl: string;
  signedAt: number;
  signerIp?: string;
}

function formatTin(tinType: "ssn" | "ein", tin: string): string {
  const digits = tin.replace(/\D/g, "");
  if (tinType === "ssn") return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

export function SubstituteW9Pdf({ data }: { data: SubstituteW9Data }) {
  const classificationLabel =
    data.taxClassification === "llc" && data.llcTaxClassification
      ? `Limited liability company — Tax classification: ${data.llcTaxClassification}`
      : CLASSIFICATION_LABEL[data.taxClassification] ?? data.taxClassification;

  const signedDate = new Date(data.signedAt).toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
  });

  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        <Text style={s.h1}>Substitute Form W-9</Text>
        <Text style={s.italic}>
          Request for Taxpayer Identification Number and Certification — electronically
          signed substitute, collected per IRS Publication 1281 / Form W-9 instructions.
        </Text>

        <Text style={s.h2}>Part I — Taxpayer Information</Text>
        <View>
          <View style={s.row}>
            <Text style={s.label}>Name</Text>
            <Text style={s.value}>{data.legalName}</Text>
          </View>
          {data.businessName ? (
            <View style={s.row}>
              <Text style={s.label}>Business name / disregarded entity name</Text>
              <Text style={s.value}>{data.businessName}</Text>
            </View>
          ) : null}
          <View style={s.row}>
            <Text style={s.label}>Federal tax classification</Text>
            <Text style={s.value}>{classificationLabel}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Address</Text>
            <Text style={s.value}>{data.address}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>City, State, ZIP</Text>
            <Text style={s.value}>{data.city}, {data.state} {data.zip}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>{data.tinType === "ssn" ? "Social Security Number" : "Employer Identification Number"}</Text>
            <Text style={s.value}>{formatTin(data.tinType, data.tin)}</Text>
          </View>
        </View>

        <Text style={s.h2}>Part II — Certification</Text>
        <View style={s.certBox}>
          <Text style={s.body}>Under penalties of perjury, I certify that:</Text>
          <Text style={s.body}>
            1. The number shown on this form is my correct taxpayer identification number (or I
            am waiting for a number to be issued to me); and
          </Text>
          <Text style={s.body}>
            2. I am not subject to backup withholding because (a) I am exempt from backup
            withholding, or (b) I have not been notified by the Internal Revenue Service (IRS)
            that I am subject to backup withholding as a result of a failure to report all
            interest or dividends, or (c) the IRS has notified me that I am no longer subject to
            backup withholding; and
          </Text>
          <Text style={s.body}>3. I am a U.S. citizen or other U.S. person; and</Text>
          <Text style={s.body}>
            4. The FATCA code(s) entered on this form (if any) indicating that I am exempt from
            FATCA reporting is correct.
          </Text>
          <Text style={s.body}>
            Certification instructions: You must cross out item 2 above if you have been notified
            by the IRS that you are currently subject to backup withholding because you have
            failed to report all interest and dividends on your tax return.
          </Text>
        </View>

        <View style={s.signatureBlock}>
          <Text style={s.label}>Signature</Text>
          {data.signatureDataUrl ? (
            <Image src={data.signatureDataUrl} style={s.signatureImg} />
          ) : null}
          <Text style={s.body}>Signed: {signedDate}</Text>
          {data.signerIp ? <Text style={s.italic}>Signed from IP: {data.signerIp}</Text> : null}
        </View>

        <Text style={s.footer}>
          This is a substitute Form W-9 collected electronically for Ideal Oral Health
          distribution partner onboarding. It captures the same required data and certification
          language as the IRS Form W-9 (irs.gov/w9).
        </Text>
      </Page>
    </Document>
  );
}
