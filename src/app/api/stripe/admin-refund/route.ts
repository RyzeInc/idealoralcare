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
 * POST /api/stripe/admin-refund
 *
 * Admin-initiated refund of a Stripe charge.
 * Requires admin role in Convex.
 *
 * Body:
 *   memberProfileId: string   — Convex memberProfiles _id (used for audit)
 *   chargeId?: string         — explicit Stripe charge id (preferred)
 *   paymentIntentId?: string  — fallback: refund latest charge on this PI
 *   amountCents?: number      — partial refund amount; omit for full refund
 *   reason?: string           — duplicate | fraudulent | requested_by_customer
 *   note?: string             — internal note recorded in Stripe metadata
 *
 * Notes:
 *   - We pass either `charge` or `payment_intent` to Stripe.
 *   - The webhook (charge.refunded) will sync Convex bundle/payment state.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || "");

    const isAdmin = await convex.query(
      "admin/adminUsers:isAdmin" as any,
      { clerkUserId: userId }
    );
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 });
    }

    const {
      memberProfileId,
      chargeId,
      paymentIntentId,
      amountCents,
      reason,
      note,
    } = await req.json();

    if (!chargeId && !paymentIntentId) {
      return NextResponse.json(
        { error: "Provide either chargeId or paymentIntentId" },
        { status: 400 }
      );
    }

    if (amountCents !== undefined && (typeof amountCents !== "number" || amountCents <= 0)) {
      return NextResponse.json(
        { error: "amountCents must be a positive number when provided" },
        { status: 400 }
      );
    }

    const validReasons = ["duplicate", "fraudulent", "requested_by_customer"];
    const refundReason: Stripe.RefundCreateParams["reason"] | undefined =
      reason && validReasons.includes(reason)
        ? (reason as Stripe.RefundCreateParams["reason"])
        : undefined;

    const params: Stripe.RefundCreateParams = {
      ...(chargeId ? { charge: chargeId } : { payment_intent: paymentIntentId }),
      ...(amountCents ? { amount: amountCents } : {}),
      ...(refundReason ? { reason: refundReason } : {}),
      metadata: {
        admin_clerk_user_id: userId,
        ...(memberProfileId ? { member_profile_id: String(memberProfileId) } : {}),
        ...(note ? { admin_note: String(note).slice(0, 480) } : {}),
      },
    };

    const refund = await stripe.refunds.create(params);

    // Audit log (best-effort — do not fail the refund if logging fails)
    try {
      await convex.mutation(
        "admin/adminAudit:logAdminActionAsActor" as any,
        {
          actorClerkUserId: userId,
          action: "stripe.refund",
          targetType: "memberProfile",
          targetId: memberProfileId ? String(memberProfileId) : undefined,
          summary: `Refund ${refund.amount ? `$${(refund.amount / 100).toFixed(2)}` : '(full)'} ${reason ? `(${reason})` : ''} on ${chargeId ?? paymentIntentId}`,
          metadata: {
            refundId: refund.id,
            status: refund.status,
            amountCents: refund.amount,
            currency: refund.currency,
            chargeId: refund.charge,
            paymentIntentId: refund.payment_intent,
            reason: reason ?? null,
            note: note ?? null,
          },
        }
      );
    } catch (logErr) {
      console.error("[admin-refund] audit log write failed:", logErr);
    }

    return NextResponse.json({
      success: true,
      refundId: refund.id,
      status: refund.status,
      amount: refund.amount,
      currency: refund.currency,
      chargeId: refund.charge,
      paymentIntentId: refund.payment_intent,
    });
  } catch (err: any) {
    console.error("[admin-refund] failed:", err);
    return NextResponse.json(
      { error: err?.message ?? "Refund failed" },
      { status: 500 }
    );
  }
}
