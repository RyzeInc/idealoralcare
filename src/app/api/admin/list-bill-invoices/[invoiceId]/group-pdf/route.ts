import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { pdf } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { Readable } from "stream";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { GroupInvoicePdf, type GroupInvoicePdfData } from "@/lib/list-bill-invoice-pdf";

export const runtime = "nodejs";

/**
 * GET /api/admin/list-bill-invoices/[invoiceId]/group-pdf
 *
 * Streams a single-page, group-facing PDF invoice to the browser.
 * Shows total cost only — no per-member or dependent breakdown.
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

  // Optional remitter info from env (so finance can configure without code changes).
  const addressEnv = process.env.LIST_BILL_REMIT_ADDRESS ?? "";
  const addressLines = addressEnv
    .split("|")
    .map((l) => l.trim())
    .filter(Boolean);

  const data: GroupInvoicePdfData = {
    invoiceNumberDisplay: inv.invoiceNumberDisplay,
    groupName: inv.groupName,
    groupCode: inv.groupCode,
    organizationCode: inv.organizationCode ?? null,
    accountName: inv.accountName,
    billingContactName: inv.billingContactName ?? null,
    billingContactEmail: inv.billingContactEmail ?? null,
    coveragePeriod: inv.coveragePeriod,
    billingDate: inv.billingDate,
    paymentDueDate: inv.paymentDueDate,
    rateLabel: inv.rateLabel,
    memberCount: inv.memberCount,
    subtotalCents: inv.subtotalCents,
    adjustmentCents: inv.adjustmentCents,
    adjustmentNotes: inv.adjustmentNotes ?? null,
    totalCents: inv.totalCents,
    amountPaidCents: inv.amountPaidCents,
    balanceCents: inv.balanceCents,
    paymentMethod: inv.paymentMethod ?? null,
    remitTo: {
      payeeName: process.env.LIST_BILL_REMIT_PAYEE ?? "Ideal Oral Health",
      addressLines,
      achInstructions: process.env.LIST_BILL_REMIT_ACH ?? undefined,
    },
  };

  try {
    const doc = createElement(GroupInvoicePdf, { data }) as unknown as ReactElement<DocumentProps>;
    const instance = pdf(doc);
    const stream = await instance.toBuffer();
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const nodeStream = stream as unknown as Readable;
      nodeStream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      nodeStream.on("end", () => resolve(Buffer.concat(chunks)));
      nodeStream.on("error", reject);
    });

    const filename = `Invoice-${inv.invoiceNumberDisplay}-${inv.groupName.replace(/[^a-z0-9]+/gi, "_")}-${inv.coveragePeriod}.pdf`;

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[group-pdf] PDF generation failed:", err);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}
