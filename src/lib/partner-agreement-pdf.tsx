import React from "react";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";

/**
 * THE EXECUTED PARTNER AGREEMENT, for partners who signed online.
 *
 * The upload path already produces a signed PDF. The online path does not — it
 * stores field values plus a signature image, drawn as an overlay on page 8 of
 * the Partner Kit at /register. So the executed document has to be composed
 * back from those parts.
 *
 * WHAT MAKES THIS FAITHFUL RATHER THAN INVENTED: the pages here are the same
 * Partner Kit images the signer reviewed, and the overlay geometry below is
 * copied from `src/app/register/page.client.tsx` verbatim. Nothing is
 * paraphrased and no terms are restated — the record reproduces the instrument
 * as displayed. If those coordinates are ever re-measured, change them in both
 * places or the executed copy stops matching what the partner saw.
 */

// US Letter, in points. The kit renders at 1500x1940 (ratio 0.773) — Letter is
// 0.7727, so a full-bleed page is effectively exact.
const PAGE_W = 612;
const PAGE_H = 792;

/** The agreement page within the kit (page 8, zero-indexed). */
export const AGREEMENT_PAGE_INDEX = 7;

// ── Overlay geometry — mirrors page.client.tsx ──────────────────────────
const LINE_H = 2.7; // input box height, % of doc height

type Line = { y: number; x0: number; x1: number };

const INFO_FIELDS: { key: keyof ExecutedAgreementFields; line: Line }[] = [
  { key: "partnerAgencyName", line: { y: 24.81, x0: 30.6, x1: 91.0 } },
  { key: "dba", line: { y: 27.9, x0: 30.6, x1: 91.0 } },
  { key: "primaryContactName", line: { y: 31.06, x0: 30.6, x1: 91.0 } },
  { key: "email", line: { y: 34.17, x0: 30.6, x1: 91.0 } },
  { key: "phone", line: { y: 37.41, x0: 30.6, x1: 91.0 } },
  { key: "npnLicenseInfo", line: { y: 40.67, x0: 30.6, x1: 91.0 } },
  { key: "effectiveDate", line: { y: 43.83, x0: 30.6, x1: 91.0 } },
];
const SIG_DATE: Line = { y: 79.53, x0: 64.82, x1: 91.74 };
const PRINTED_NAME: Line = { y: 82.4, x0: 18.67, x1: 55.12 };
const TITLE: Line = { y: 82.4, x0: 65.99, x1: 91.64 };
const SIG_AREA = { yBottom: 79.53, yTop: 73.6, x0: 28.92, x1: 55.12 };

/** Percentage geometry → absolute points, so nothing depends on % support. */
function lineBox(line: Line) {
  return {
    position: "absolute" as const,
    left: (line.x0 / 100) * PAGE_W,
    width: ((line.x1 - line.x0) / 100) * PAGE_W,
    top: ((line.y - LINE_H) / 100) * PAGE_H,
    height: (LINE_H / 100) * PAGE_H,
  };
}

export interface ExecutedAgreementFields {
  partnerAgencyName: string;
  dba?: string;
  primaryContactName: string;
  email: string;
  phone?: string;
  npnLicenseInfo?: string;
  effectiveDate?: string;
}

export interface ExecutedPartnerAgreementData extends ExecutedAgreementFields {
  /** Data URI of the drawn signature. */
  signatureDataUrl: string;
  printedName?: string;
  title?: string;
  /** The date the signer typed on the agreement line. */
  signedDate?: string;
  /** Server timestamp of submission — the authoritative execution time. */
  submittedAt: number;
  submittedFromIp?: string;
  /**
   * The Partner Kit pages, in order, as data URIs or absolute file paths.
   * Supplied by the caller so this component stays pure.
   */
  kitPages: string[];
}

const s = StyleSheet.create({
  page: { position: "relative", backgroundColor: "#ffffff" },
  kitImage: { position: "absolute", top: 0, left: 0, width: PAGE_W, height: PAGE_H },
  // 1.55cqw of the page width on the web form — the same size in points here.
  field: {
    fontFamily: "Helvetica",
    fontSize: (1.55 / 100) * PAGE_W,
    color: "#0f172a",
    paddingLeft: (0.4 / 100) * PAGE_W,
  },
  signatureBox: {
    position: "absolute",
    left: (SIG_AREA.x0 / 100) * PAGE_W,
    width: ((SIG_AREA.x1 - SIG_AREA.x0) / 100) * PAGE_W,
    top: (SIG_AREA.yTop / 100) * PAGE_H,
    height: ((SIG_AREA.yBottom - SIG_AREA.yTop) / 100) * PAGE_H,
  },
  // Bottom-anchored, matching `object-contain object-bottom` on the web form —
  // a signature sits on its line, not floating in the middle of the box.
  signatureImg: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    objectPositionY: "100%",
  },

  // ── Execution record page ──
  recordPage: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#222222",
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 56,
  },
  h1: { fontSize: 15, fontFamily: "Helvetica-Bold", color: "#123c7a", marginBottom: 2 },
  sub: { fontSize: 9, fontFamily: "Helvetica-Oblique", color: "#666666", marginBottom: 18 },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
    paddingVertical: 6,
  },
  label: { width: "38%", fontSize: 9, fontFamily: "Helvetica-Bold", color: "#666666" },
  value: { width: "62%", fontSize: 10 },
  sigCaption: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#666666", marginTop: 20 },
  sigRecord: { width: 220, height: 55, marginTop: 6, objectFit: "contain" },
  note: { fontSize: 8, color: "#666666", marginTop: 24, lineHeight: 1.5 },
});

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/New_York",
  });
}

function Field({ line, value }: { line: Line; value?: string }) {
  if (!value) return null;
  return (
    <View style={lineBox(line)}>
      <Text style={s.field}>{value}</Text>
    </View>
  );
}

export function ExecutedPartnerAgreementPdf({ data }: { data: ExecutedPartnerAgreementData }) {
  return (
    <Document
      title={`Partner Agreement — ${data.partnerAgencyName}`}
      author="Ideal Oral Health"
      subject="Executed Partner Agreement & Acknowledgment"
    >
      {data.kitPages.map((src, idx) => (
        <Page key={idx} size={[PAGE_W, PAGE_H]} style={s.page}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={src} style={s.kitImage} />

          {idx === AGREEMENT_PAGE_INDEX && (
            <>
              {INFO_FIELDS.map((f) => (
                <Field key={f.key} line={f.line} value={data[f.key]} />
              ))}
              <Field line={SIG_DATE} value={data.signedDate} />
              <Field line={PRINTED_NAME} value={data.printedName} />
              <Field line={TITLE} value={data.title} />
              <View style={s.signatureBox}>
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image src={data.signatureDataUrl} style={s.signatureImg} />
              </View>
            </>
          )}
        </Page>
      ))}

      {/* The audit trail the drawn signature alone does not carry. */}
      <Page size={[PAGE_W, PAGE_H]} style={s.recordPage}>
        <Text style={s.h1}>Execution Record</Text>
        <Text style={s.sub}>
          Ideal Oral Health Partner Agreement &amp; Acknowledgment — signed electronically
        </Text>

        <View style={s.row}>
          <Text style={s.label}>Partner / Agency</Text>
          <Text style={s.value}>{data.partnerAgencyName}</Text>
        </View>
        {data.dba ? (
          <View style={s.row}>
            <Text style={s.label}>DBA</Text>
            <Text style={s.value}>{data.dba}</Text>
          </View>
        ) : null}
        <View style={s.row}>
          <Text style={s.label}>Signed by</Text>
          <Text style={s.value}>{data.printedName || data.primaryContactName}</Text>
        </View>
        {data.title ? (
          <View style={s.row}>
            <Text style={s.label}>Title</Text>
            <Text style={s.value}>{data.title}</Text>
          </View>
        ) : null}
        <View style={s.row}>
          <Text style={s.label}>Contact email</Text>
          <Text style={s.value}>{data.email}</Text>
        </View>
        {data.npnLicenseInfo ? (
          <View style={s.row}>
            <Text style={s.label}>NPN / License</Text>
            <Text style={s.value}>{data.npnLicenseInfo}</Text>
          </View>
        ) : null}
        {data.effectiveDate ? (
          <View style={s.row}>
            <Text style={s.label}>Effective date</Text>
            <Text style={s.value}>{data.effectiveDate}</Text>
          </View>
        ) : null}
        {data.signedDate ? (
          <View style={s.row}>
            <Text style={s.label}>Date on signature line</Text>
            <Text style={s.value}>{data.signedDate}</Text>
          </View>
        ) : null}
        <View style={s.row}>
          <Text style={s.label}>Submitted (ET)</Text>
          <Text style={s.value}>{formatTimestamp(data.submittedAt)}</Text>
        </View>
        {data.submittedFromIp ? (
          <View style={s.row}>
            <Text style={s.label}>Submitted from IP</Text>
            <Text style={s.value}>{data.submittedFromIp}</Text>
          </View>
        ) : null}
        <View style={s.row}>
          <Text style={s.label}>Acknowledgment</Text>
          <Text style={s.value}>
            Confirmed the information above is accurate, acknowledged receipt of the Partner
            Kit, and agreed to follow Ideal Oral Health program and branding requirements.
          </Text>
        </View>

        <Text style={s.sigCaption}>AUTHORIZED SIGNATURE</Text>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={data.signatureDataUrl} style={s.sigRecord} />

        <Text style={s.note}>
          This record was generated from the Partner Agreement submitted at getidealoh.com.
          The preceding pages reproduce the Partner Kit as presented to the signer, with the
          submitted values and signature placed on the agreement page.
        </Text>
      </Page>
    </Document>
  );
}
