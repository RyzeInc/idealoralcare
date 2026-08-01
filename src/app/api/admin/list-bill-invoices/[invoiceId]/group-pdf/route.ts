import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { pdf } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { Readable } from "stream";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  ListBillInvoicePdf,
  type ListBillInvoicePdfData,
  type ListBillInvoiceLine,
} from "@/lib/list-bill-invoice-pdf";

export const runtime = "nodejs";

/**
 * GET /api/admin/list-bill-invoices/[invoiceId]/group-pdf
 *
 * Streams an itemized list-bill invoice PDF (summary page + member-products
 * page) for the group billed by this invoice. Primaries only.
 *
 * Auth: Clerk-authenticated admin (verified via Convex isAdmin query).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || "");
  const token = await getToken({ template: "convex" });
  if (token) convex.setAuth(token);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isAdmin = await convex.query(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    api.admin.adminUsers.isAdmin as any,
    { clerkUserId: userId },
  );
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 });
  }

  const { invoiceId } = await params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inv: any = await convex.query(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    api.admin.listBillInvoices.getInvoice as any,
    { invoiceId: invoiceId as Id<"listBillInvoices"> },
  );
  if (!inv) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // Aging summary across this group (best-effort; falls back to single-invoice view).
  let aging = {
    currentCents: inv.balanceCents,
    upTo30Cents: 0,
    days31To60Cents: 0,
    days61To90Cents: 0,
    days91PlusCents: 0,
    totalDueCents: inv.balanceCents,
  };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const summary: any = await convex.query(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      api.admin.listBillInvoices.getGroupAgingSummary as any,
      // "As of" this invoice's own billing date — a PDF is a historical
      // statement, not a live view, so reprinting an old invoice later
      // (e.g. a May invoice regenerated in July) must not leak in
      // invoices/balances from periods that didn't exist yet at billing time.
      { groupId: inv.groupId, asOfDate: inv.billingDate },
    );
    if (summary) {
      aging = {
        currentCents: summary.current,
        upTo30Cents: summary.upTo30Days,
        days31To60Cents: summary.days31To60,
        days61To90Cents: summary.days61To90,
        days91PlusCents: summary.days91Plus,
        totalDueCents: summary.totalDue,
      };
    }
  } catch {
    // fall back to single-invoice "current = balance" view
  }

  const addressEnv = process.env.LIST_BILL_REMIT_ADDRESS ?? "";
  const addressLines = addressEnv
    .split("|")
    .map((l) => l.trim())
    .filter(Boolean);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lines: ListBillInvoiceLine[] = (inv.lines ?? []).map((l: any) => ({
    memberId: l.memberId,
    lastName: l.lastName,
    firstName: l.firstName,
    productLabel: l.productLabel,
    rateCents: l.rateCents,
  }));

  const data: ListBillInvoicePdfData = {
    invoiceNumberDisplay: inv.invoiceNumberDisplay,
    isDraft: inv.status === "draft",
    brandName: process.env.LIST_BILL_REMIT_PAYEE ?? "Ryze LLC",
    groupName: inv.groupName,
    groupCode: inv.groupCode,
    organizationCode: inv.organizationCode ?? null,
    accountName: inv.accountName,
    coveragePeriod: inv.coveragePeriod,
    coverageStart: inv.coverageStart,
    coverageEnd: inv.coverageEnd,
    billingDate: inv.billingDate,
    paymentDueDate: inv.paymentDueDate,
    subtotalCents: inv.subtotalCents,
    adjustmentCents: inv.adjustmentCents,
    adjustmentNotes: inv.adjustmentNotes ?? null,
    totalCents: inv.totalCents,
    amountPaidCents: inv.amountPaidCents,
    balanceCents: inv.balanceCents,
    memberCount: inv.memberCount,
    lines,
    aging,
    remitTo: {
      payeeName: process.env.LIST_BILL_REMIT_PAYEE ?? "Ryze LLC",
      addressLines: addressLines.length > 0 ? addressLines : ["1846 Fernando Ln", "Tallahassee, FL 32303 US"],
      contactPhone: process.env.LIST_BILL_REMIT_PHONE ?? undefined,
      contactEmail: process.env.LIST_BILL_REMIT_EMAIL ?? "info@ryzenexus.com",
    },
  };

  try {
    const doc = createElement(ListBillInvoicePdf, { data }) as unknown as ReactElement<DocumentProps>;
    const instance = pdf(doc);
    const stream = await instance.toBuffer();
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const nodeStream = stream as unknown as Readable;
      nodeStream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      nodeStream.on("end", () => resolve(Buffer.concat(chunks)));
      nodeStream.on("error", reject);
    });

    const safeName = inv.groupName.replace(/[^a-z0-9]+/gi, "_");
    const filename = `Invoice-${inv.invoiceNumberDisplay}-${safeName}-${inv.coveragePeriod}.pdf`;

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[list-bill group-pdf] PDF generation failed:", err);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}
