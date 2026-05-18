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
 * GET /api/admin/invoice-calculator/group-pdf?groupId=...&period=YYYY-MM|live
 *
 * Streams a single-page, group-facing PDF invoice computed from the Invoice
 * Calculator's per-period gross. Shows total cost only — no per-member or
 * dependent breakdown.
 *
 * Auth: Clerk-authenticated admin (verified via Convex isAdmin).
 */
export async function GET(req: NextRequest) {
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

  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get("groupId");
  const periodParam = searchParams.get("period");
  if (!groupId) {
    return NextResponse.json({ error: "groupId is required" }, { status: 400 });
  }

  // ── Resolve period (default = current calendar month) ────────────────────
  const now = new Date();
  const livePeriod = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const period =
    !periodParam || periodParam === "live" ? livePeriod : periodParam;

  // ── Fetch invoice data from the calculator ───────────────────────────────
  let inv: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    inv = await convex.query(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      api.admin.invoiceCalculator.getGroupInvoice as any,
      { groupId: groupId as Id<"groups">, period },
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to load group invoice" },
      { status: 404 },
    );
  }
  if (!inv) {
    return NextResponse.json({ error: "Group invoice not found" }, { status: 404 });
  }

  // ── Try to enrich with billing contact from the group's account ──────────
  let billingContactName: string | null = null;
  let billingContactEmail: string | null = null;
  let listBillPaymentMethod: "check" | "ach" | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const group: any = await convex.query(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      api.admin.hierarchy.getGroupById as any,
      { groupId: groupId as Id<"groups"> },
    ).catch(() => null);
    if (group?.listBill?.employerContactEmail) {
      billingContactEmail = group.listBill.employerContactEmail;
    }
    if (group?.listBill?.paymentMethod === "ach" || group?.listBill?.paymentMethod === "check") {
      listBillPaymentMethod = group.listBill.paymentMethod;
    }
    if (!billingContactEmail && inv.group.accountId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const account: any = await convex.query(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        api.admin.hierarchy.getAccountById as any,
        { accountId: inv.group.accountId },
      ).catch(() => null);
      const billing = account?.contacts?.find?.((c: any) => c.role === "billing");
      const primary = account?.contacts?.find?.((c: any) => c.role === "primary");
      const contact = billing ?? primary;
      if (contact) {
        billingContactName = contact.name ?? null;
        billingContactEmail = contact.email ?? null;
      }
    }
  } catch {
    // best-effort enrichment only
  }

  // ── Compute dates ────────────────────────────────────────────────────────
  const [yStr, mStr] = period.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  // Coverage starts on the 1st of the period; due Net-30 from issue date.
  const coverageStart = Date.UTC(y, m - 1, 1);
  const issueDate = Date.now();
  const dueDate = issueDate + 30 * 86_400_000;

  // ── Synthesize invoice number from group + period (stable, no DB write) ─
  const codeForNumber =
    inv.group.organizationCode ?? inv.group.groupCode ?? "INV";
  const invoiceNumberDisplay = `${codeForNumber}-${period}`;

  // ── Billable primaries (Ind + Fam). Excludes dependents and unbilled. ────
  const billablePrimaries =
    (inv.group.individualPrimaryCount ?? 0) +
    (inv.group.familyPrimaryCount ?? 0);

  const grossCents = inv.group.totals?.grossCents ?? 0;

  // ── Optional remitter info from env ──────────────────────────────────────
  const addressLines = (process.env.LIST_BILL_REMIT_ADDRESS ?? "")
    .split("|")
    .map((l) => l.trim())
    .filter(Boolean);

  const data: GroupInvoicePdfData = {
    invoiceNumberDisplay,
    groupName: inv.group.groupName,
    groupCode: inv.group.groupCode,
    organizationCode: inv.group.organizationCode ?? null,
    accountName: inv.group.accountName ?? inv.group.groupName,
    billingContactName,
    billingContactEmail,
    coveragePeriod: period,
    billingDate: issueDate,
    paymentDueDate: dueDate,
    rateLabel: "Group Membership",
    memberCount: billablePrimaries,
    subtotalCents: grossCents,
    adjustmentCents: 0,
    totalCents: grossCents,
    amountPaidCents: 0,
    balanceCents: grossCents,
    paymentMethod: listBillPaymentMethod,
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

    const safeName = inv.group.groupName.replace(/[^a-z0-9]+/gi, "_");
    const filename = `Invoice-${invoiceNumberDisplay}-${safeName}.pdf`;

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[invoice-calculator group-pdf] PDF generation failed:", err);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}
