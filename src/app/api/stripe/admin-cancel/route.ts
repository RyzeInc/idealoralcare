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
 * POST /api/stripe/admin-cancel
 *
 * Admin-initiated cancellation of a member's Stripe subscription.
 * Requires admin role in Convex.
 *
 * Body:
 *   memberProfileId: string   — Convex memberProfiles _id
 *   cancelImmediately: boolean — true = cancel now, false = cancel at period end (default)
 */
export async function POST(req: NextRequest) {
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

    const { memberProfileId, cancelImmediately = false } = await req.json();
    if (!memberProfileId) {
      return NextResponse.json({ error: "memberProfileId is required" }, { status: 400 });
    }

    // Get member + bundle details from Convex
    const data = await convex.query(
      api.admin.customerService.getMemberWithSubscription as any,
      { memberProfileId }
    ) as any;

    if (!data) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (!data.bundle?.stripeSubscriptionId) {
      return NextResponse.json(
        { error: "No active Stripe subscription found for this member" },
        { status: 404 }
      );
    }

    const { member, bundle } = data;

    let cancelAtPeriodEnd = false;
    let currentPeriodEnd: string | null = null;

    if (cancelImmediately) {
      // Immediate cancellation — terminates now
      await stripe.subscriptions.cancel(bundle.stripeSubscriptionId);
      // The webhook (customer.subscription.deleted) will handle Convex state and email
    } else {
      // Schedule cancellation at period end — member keeps access until then
      const subscription: any = await stripe.subscriptions.update(
        bundle.stripeSubscriptionId,
        { cancel_at_period_end: true }
      );
      cancelAtPeriodEnd = subscription.cancel_at_period_end;
      currentPeriodEnd = subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null;

      // Update Convex bundle to reflect cancel_at_period_end
      await convex.mutation(api.subscriptions.webhookActions.markCancelAtPeriodEnd, {
        bundleId: bundle._id,
        cancelAtPeriodEnd: true,
      });

      // Send cancellation email immediately (don't wait for webhook at period end)
      try {
        await convex.action(
          (api as any)["legal/emailFulfillment"].sendMembershipCancelledEmail,
          {
            memberName: `${member.firstName} ${member.lastName}`,
            memberEmail: member.email,
            memberId: member.memberId,
          }
        );
      } catch (emailError) {
        console.error("[admin-cancel] Cancellation email failed:", emailError);
      }
    }

    return NextResponse.json({
      success: true,
      cancelImmediately,
      cancelAtPeriodEnd,
      currentPeriodEnd,
      memberName: `${member.firstName} ${member.lastName}`,
    });
  } catch (error) {
    console.error("[admin-cancel] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to cancel subscription" },
      { status: 500 }
    );
  }
}
