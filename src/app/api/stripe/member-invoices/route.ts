import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import Stripe from "stripe";
import { api } from "@/convex/_generated/api";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY environment variable is required");
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * GET /api/stripe/member-invoices?memberProfileId=xxx
 *
 * Returns Stripe invoice history for a given member.
 * Admin-only route.
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || "");

    // Verify admin role
    const isAdmin = await convex.query(
      "admin/adminUsers:isAdmin" as any,
      { clerkUserId: userId }
    );
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 });
    }

    const memberProfileId = req.nextUrl.searchParams.get("memberProfileId");
    if (!memberProfileId) {
      return NextResponse.json({ error: "memberProfileId is required" }, { status: 400 });
    }

    const data = await convex.query(
      api.admin.customerService.getMemberWithSubscription as any,
      { memberProfileId }
    ) as any;

    if (!data?.bundle?.stripeCustomerId) {
      return NextResponse.json({ invoices: [] });
    }

    const invoiceList = await stripe.invoices.list({
      customer: data.bundle.stripeCustomerId,
      limit: 24,
    });

    const invoices = invoiceList.data.map((inv: any) => ({
      id: inv.id,
      number: inv.number ?? null,
      amountPaid: inv.amount_paid,
      amountDue: inv.amount_due,
      currency: inv.currency,
      status: inv.status,
      created: inv.created,
      periodStart: inv.period_start ?? null,
      periodEnd: inv.period_end ?? null,
      hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
      invoicePdf: inv.invoice_pdf ?? null,
      // Refund-target identifiers (admin refund UI uses these)
      chargeId: typeof inv.charge === "string" ? inv.charge : (inv.charge?.id ?? null),
      paymentIntentId:
        typeof inv.payment_intent === "string"
          ? inv.payment_intent
          : (inv.payment_intent?.id ?? null),
    }));

    return NextResponse.json({ invoices });
  } catch (error) {
    console.error("[member-invoices] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch invoices" },
      { status: 500 }
    );
  }
}
