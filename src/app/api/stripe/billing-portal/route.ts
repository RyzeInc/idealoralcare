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
 * POST /api/stripe/billing-portal
 *
 * Creates a Stripe billing portal session for the authenticated user.
 * Allows members to manage payment methods and view billing history.
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

    // Fetch the user's active bundle (with Stripe IDs) to get Stripe customer ID
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

    if (!bundle.stripeCustomerId) {
      return NextResponse.json(
        { error: "No Stripe customer found for this account" },
        { status: 400 }
      );
    }

    // Determine return URL from request origin
    const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "";
    const returnUrl = `${origin}/health/manage-plans`;

    // Create Stripe billing portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: bundle.stripeCustomerId,
      return_url: returnUrl,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    console.error("[billing-portal] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create billing portal session" },
      { status: 500 }
    );
  }
}
