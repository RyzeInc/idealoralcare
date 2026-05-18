/**
 * GET /api/admin/list-bill-invoices/preview-sample
 *
 * DEV / DEBUG ONLY — renders the list-bill invoice PDF with hardcoded fixture
 * data so you can see the layout without a real invoice in the database.
 *
 * Open in a browser tab: http://localhost:3000/api/admin/list-bill-invoices/preview-sample
 *
 * Note: no auth check — intended for local development only.
 * Do NOT expose this route in production by leaving NODE_ENV guard in place.
 */

import { NextResponse } from "next/server";
import { pdf } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { Readable } from "stream";
import { ListBillInvoicePdf, type ListBillInvoicePdfData } from "@/lib/list-bill-invoice-pdf";

export const runtime = "nodejs";

const SAMPLE: ListBillInvoicePdfData = {
  invoiceNumberDisplay: "INV-2026-0042",
  isDraft: true,
  brandName: "Ideal Health",
  groupName: "Crunch Fitness – Denver Metro",
  groupCode: "CRUNCH-DEN",
  organizationCode: "ORG-1042",
  accountName: "Crunch Fitness Holdings LLC",
  coveragePeriod: "2026-05",
  coverageStart: Date.UTC(2026, 4, 1),   // May 1 2026
  coverageEnd: Date.UTC(2026, 4, 31),    // May 31 2026
  billingDate: Date.UTC(2026, 4, 1),
  paymentDueDate: Date.UTC(2026, 4, 15),
  subtotalCents: 214500,
  adjustmentCents: -5000,
  adjustmentNotes: "Retro term credit — member 100-99201 terminated 4/28",
  totalCents: 209500,
  amountPaidCents: 0,
  balanceCents: 209500,
  memberCount: 14,
  lines: [
    { memberId: "100-10001", lastName: "Anderson",  firstName: "James",    productLabel: "MO – Individual",  rateCents: 14500 },
    { memberId: "100-10002", lastName: "Beaumont",  firstName: "Sophia",   productLabel: "MF – Family",      rateCents: 21500 },
    { memberId: "100-10003", lastName: "Chen",      firstName: "Wei",      productLabel: "MS – Member+Sp",   rateCents: 18500 },
    { memberId: "100-10004", lastName: "Davis",     firstName: "Olivia",   productLabel: "MO – Individual",  rateCents: 14500 },
    { memberId: "100-10005", lastName: "Ellison",   firstName: "Marcus",   productLabel: "MF – Family",      rateCents: 21500 },
    { memberId: "100-10006", lastName: "Fontaine",  firstName: "Claire",   productLabel: "MO – Individual",  rateCents: 14500 },
    { memberId: "100-10007", lastName: "Garcia",    firstName: "Luis",     productLabel: "MS – Member+Sp",   rateCents: 18500 },
    { memberId: "100-10008", lastName: "Hassan",    firstName: "Amira",    productLabel: "MO – Individual",  rateCents: 14500 },
    { memberId: "100-10009", lastName: "Ivanova",   firstName: "Natasha",  productLabel: "MF – Family",      rateCents: 21500 },
    { memberId: "100-10010", lastName: "Jackson",   firstName: "Derek",    productLabel: "MO – Individual",  rateCents: 14500 },
    { memberId: "100-10011", lastName: "Kim",       firstName: "Jinsoo",   productLabel: "MO – Individual",  rateCents: 14500 },
    { memberId: "100-10012", lastName: "Lopez",     firstName: "Elena",    productLabel: "MS – Member+Sp",   rateCents: 18500 },
    { memberId: "100-10013", lastName: "Martínez",  firstName: "Rodrigo",  productLabel: "MF – Family",      rateCents: 21500 },
    { memberId: "100-10014", lastName: "Nguyen",    firstName: "Thanh",    productLabel: "MO – Individual",  rateCents: 14500 },
  ],
  aging: {
    currentCents: 209500,
    upTo30Cents: 0,
    days31To60Cents: 0,
    days61To90Cents: 0,
    days91PlusCents: 0,
    totalDueCents: 209500,
  },
  remitTo: {
    payeeName: "Ideal Health",
    addressLines: [
      "123 Wellness Way, Suite 400",
      "Denver, CO 80203",
    ],
    contactPhone: "(720) 555-0199",
    contactEmail: "billing@idealhealth.com",
  },
};

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  try {
    const doc = createElement(ListBillInvoicePdf, { data: SAMPLE }) as unknown as ReactElement<DocumentProps>;
    const instance = pdf(doc);
    const stream = await instance.toBuffer();
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const nodeStream = stream as unknown as Readable;
      nodeStream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      nodeStream.on("end", () => resolve(Buffer.concat(chunks)));
      nodeStream.on("error", reject);
    });

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="sample-list-bill-invoice.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[preview-sample] PDF generation failed:", err);
    return NextResponse.json(
      { error: "PDF generation failed", detail: String(err) },
      { status: 500 },
    );
  }
}
