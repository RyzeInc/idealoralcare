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
 * POST /api/stripe/cancel
 *
 * Cancels a member's Stripe subscription at end of billing period.
 * The member retains access until their current period ends.
 * Stripe will fire `customer.subscription.deleted` when the period ends,
 * which the webhook handler processes to update Convex.
 *
 * Requires Clerk authentication.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || "");

    // Fetch the user's active bundle (with Stripe IDs) from Convex
    // @ts-ignore - avoid deep type instantiation issue
    const bundleResult = await convex.query(api.subscriptions.queries.getCustomerBundleWithStripeIds, {
      customerId: userId,
    });
    const bundle = bundleResult as any;

    if (!bundle) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 404 }
      );
    }

    if (!bundle.stripeSubscriptionId) {
      return NextResponse.json(
        { error: "Subscription missing Stripe reference" },
        { status: 400 }
      );
    }

    // Cancel at period end — user keeps access until billing cycle ends
    const subscription: any = await stripe.subscriptions.update(bundle.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    // Update bundle status in Convex to reflect pending cancellation
    await convex.mutation(api.subscriptions.webhookActions.markCancelAtPeriodEnd, {
      bundleId: bundle._id,
      cancelAtPeriodEnd: true,
    });

    return NextResponse.json({
      success: true,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null,
    });
  } catch (error) {
    console.error("[cancel] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to cancel subscription" },
      { status: 500 }
    );
  }
}
