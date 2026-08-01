/**
 * Server-side plumbing shared by the vendor statement document routes.
 *
 * Keeps auth, payload assembly, and the three renderers in one place so the
 * single-statement and whole-month routes cannot drift apart in what they
 * disclose or how they brand the output.
 */

import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { pdf, type DocumentProps } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { Readable } from "stream";
import type { ReactElement } from "react";
import { api } from "@/convex/_generated/api";
import {
  memberDetailTable,
  groupTable,
  summaryTable,
  adjustmentTable,
  periodSummaryTable,
  verificationChecksTable,
  verificationDetailTable,
  verificationTotalsTable,
  type Table,
  type VendorStatementDocument,
  type VerificationDocument,
} from "./vendor-statement-document";

export type DocumentFormat = "pdf" | "csv" | "xlsx";
/**
 * "recipient" is the document a partner receives. "verification" is the
 * internal payables audit — full dispersal across every bucket plus the
 * reconciliation checks. It is spreadsheet-only on purpose: it is a working
 * file for finance, not something that should look like a sendable statement.
 */
export type DocumentVariant = "recipient" | "verification";

export function parseFormat(value: string | null): DocumentFormat | null {
  if (value === null || value === "") return "pdf";
  return value === "pdf" || value === "csv" || value === "xlsx" ? value : null;
}

export function parseVariant(value: string | null): DocumentVariant | null {
  if (value === null || value === "") return "recipient";
  return value === "recipient" || value === "verification" ? value : null;
}

/**
 * Authenticate the caller as an admin and return an authed Convex client.
 * Returns a ready-to-send error response instead of throwing so routes stay
 * flat.
 */
export async function adminConvexClient(): Promise<
  { convex: ConvexHttpClient; userId: string } | { error: NextResponse }
> {
  const { userId, getToken } = await auth();
  if (!userId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return {
      error: NextResponse.json({ error: "Convex is not configured" }, { status: 500 }),
    };
  }
  const convex = new ConvexHttpClient(convexUrl);
  const token = await getToken({ template: "convex" });
  if (token) convex.setAuth(token);

  const isAdmin = await convex.query(api.admin.adminUsers.isAdmin, {
    clerkUserId: userId,
  });
  if (!isAdmin) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { convex, userId };
}

function remitFrom() {
  const addressEnv =
    process.env.VENDOR_STATEMENT_REMIT_ADDRESS ?? process.env.LIST_BILL_REMIT_ADDRESS ?? "";
  const addressLines = addressEnv
    .split("|")
    .map((line) => line.trim())
    .filter(Boolean);
  return {
    payeeName:
      process.env.VENDOR_STATEMENT_REMIT_PAYEE ??
      process.env.LIST_BILL_REMIT_PAYEE ??
      "Ryze LLC",
    addressLines:
      addressLines.length > 0
        ? addressLines
        : ["1846 Fernando Ln", "Tallahassee, FL 32303 US"],
    contactPhone:
      process.env.VENDOR_STATEMENT_REMIT_PHONE ?? process.env.LIST_BILL_REMIT_PHONE ?? undefined,
    contactEmail:
      process.env.VENDOR_STATEMENT_REMIT_EMAIL ?? "info@ryzenexus.com",
  };
}

/**
 * Convert the hydrated `getStatement` result into the format-agnostic document
 * shape. The Convex query has already applied the statement's frozen
 * disclosure, so this only maps fields — it must never add any.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function assembleDocument(row: any): VendorStatementDocument {
  const brand =
    process.env.VENDOR_STATEMENT_REMIT_PAYEE ??
    process.env.LIST_BILL_REMIT_PAYEE ??
    "Ryze LLC";
  return {
    statementNumberDisplay: row.statementNumberDisplay,
    status: row.status,
    vendor: row.vendor,
    vendorName: row.vendorName,
    basis: row.basis,
    period: row.period,
    coverageStart: row.coverageStart,
    coverageEnd: row.coverageEnd,
    statementDate: row.statementDate,
    paymentDueDate: row.paymentDueDate,
    sourceClosedAt: row.sourceClosedAt,
    showMemberDetail: row.showMemberDetail ?? true,
    showGroups: row.showGroups,
    showTier: row.showTier,
    showBroker: row.showBroker,
    showFullSplit: row.showFullSplit ?? false,
    showAdjustmentDetail: row.showAdjustmentDetail ?? true,
    columns: row.columns ?? [],
    memberDetailAvailable: row.memberDetailAvailable,
    memberDetailComplete: row.memberDetailComplete ?? true,
    missingDetailGroups: row.missingDetailGroups ?? [],
    itemizedCents: row.itemizedCents ?? 0,
    closedSubtotalCents: row.closedSubtotalCents ?? row.subtotalCents,
    attributionBasis: row.attributionBasis ?? "none",
    primaryCount: row.primaryCount,
    individualCount: row.individualCount ?? 0,
    familyCount: row.familyCount ?? 0,
    groupCodeVaries: row.groupCodeVaries ?? false,
    memberLines: row.memberLines ?? [],
    groups: row.groups ?? [],
    adjustments: row.adjustments ?? [],
    subtotalCents: row.subtotalCents,
    adjustmentCents: row.adjustmentCents,
    totalCents: row.totalCents,
    amountPaidCents: row.amountPaidCents,
    balanceCents: row.balanceCents,
    brandName: brand,
    remitFrom: remitFrom(),
  };
}

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

export async function pdfBuffer(element: ReactElement<DocumentProps>): Promise<Buffer> {
  const stream = await pdf(element).toBuffer();
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const nodeStream = stream as unknown as Readable;
    nodeStream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    nodeStream.on("end", () => resolve(Buffer.concat(chunks)));
    nodeStream.on("error", reject);
  });
}

/** Sheet names are capped at 31 chars by the format itself. */
function safeSheetName(name: string): string {
  return name.replace(/[\\/?*[\]:]/g, "-").slice(0, 31);
}

export async function xlsxBuffer(
  sheets: Array<{ name: string; tables: Array<{ title?: string; table: Table }> }>,
): Promise<Buffer> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const aoa: (string | number)[][] = [];
    for (const [index, block] of sheet.tables.entries()) {
      if (index > 0) aoa.push([]);
      if (block.title) aoa.push([block.title]);
      aoa.push(block.table.header);
      for (const row of block.table.rows) aoa.push(row);
    }
    const worksheet = XLSX.utils.aoa_to_sheet(aoa);
    worksheet["!cols"] = (aoa[1] ?? aoa[0] ?? []).map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName(sheet.name));
  }
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/** The workbook layout for one statement: cover sheet + detail sheet. */
export function statementSheets(doc: VendorStatementDocument) {
  const sheets: Array<{ name: string; tables: Array<{ title?: string; table: Table }> }> = [
    {
      name: "Statement",
      tables: [
        { title: `${doc.vendorName} — Remittance Statement`, table: summaryTable(doc) },
        ...(doc.showAdjustmentDetail && doc.adjustments.length > 0
          ? [{ title: "Adjustments", table: adjustmentTable(doc) }]
          : []),
        ...(doc.groups.length > 0
          ? [{ title: "Group Summary", table: groupTable(doc) }]
          : []),
      ],
    },
  ];
  if (doc.memberDetailAvailable && doc.memberLines.length > 0) {
    sheets.push({
      name: "Covered Primaries",
      tables: [{ table: memberDetailTable(doc) }],
    });
  }
  return sheets;
}

/**
 * The internal verification workbook. The checks sheet leads so a reviewer
 * sees PASS/FAIL before any numbers.
 */
export function verificationSheets(doc: VerificationDocument) {
  const sheets: Array<{ name: string; tables: Array<{ title?: string; table: Table }> }> = [
    {
      name: "Checks",
      tables: [
        {
          title: `INTERNAL VERIFICATION — ${doc.vendorName} ${doc.period} (${doc.statementNumberDisplay}) — NOT FOR DISTRIBUTION`,
          table: verificationChecksTable(doc),
        },
        { title: "Bucket Totals", table: verificationTotalsTable(doc) },
      ],
    },
  ];
  if (doc.memberDetailAvailable && doc.lines.length > 0) {
    sheets.push({
      name: "Full Dispersal",
      tables: [{ table: verificationDetailTable(doc) }],
    });
  }
  return sheets;
}

/** The workbook layout for a whole coverage month: rollup + one sheet each. */
export function periodSheets(docs: VendorStatementDocument[], period: string) {
  const sheets: Array<{ name: string; tables: Array<{ title?: string; table: Table }> }> = [
    {
      name: "All Recipients",
      tables: [
        { title: `Vendor Remittance Statements — ${period}`, table: periodSummaryTable(docs) },
      ],
    },
  ];
  for (const doc of docs) {
    const tables: Array<{ title?: string; table: Table }> = [
      { title: `${doc.vendorName} — ${doc.statementNumberDisplay}`, table: summaryTable(doc) },
    ];
    if (doc.groups.length > 0) {
      tables.push({ title: "Group Summary", table: groupTable(doc) });
    }
    if (doc.memberDetailAvailable && doc.memberLines.length > 0) {
      tables.push({ title: "Covered Primary Detail", table: memberDetailTable(doc) });
    }
    if (doc.showAdjustmentDetail && doc.adjustments.length > 0) {
      tables.push({ title: "Adjustments", table: adjustmentTable(doc) });
    }
    sheets.push({ name: doc.vendorName, tables });
  }
  return sheets;
}

export function fileResponse(
  body: Buffer | string,
  format: DocumentFormat,
  filename: string,
): NextResponse {
  const contentType =
    format === "pdf"
      ? "application/pdf"
      : format === "csv"
        ? "text/csv; charset=utf-8"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  // PDFs preview in-tab; spreadsheets are always a download.
  const disposition = format === "pdf" ? "inline" : "attachment";
  return new NextResponse(body as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
