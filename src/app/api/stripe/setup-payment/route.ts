import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import Stripe from "stripe";
import { api } from "@/convex/_generated/api";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

/**
 * POST /api/stripe/setup-payment
 *
 * Creates a Stripe subscription with payment_behavior: 'default_incomplete'
 * Returns a clientSecret to power the inline Stripe PaymentElement.
 *
 * No redirect — user pays entirely within the website.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await currentUser();
    if (!user?.emailAddresses[0]) {
      return NextResponse.json({ error: "User email not found" }, { status: 400 });
    }
    const userEmail = user.emailAddresses[0].emailAddress;
    const userName = [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined;

    const body = await req.json();
    const { planId, cadence, paymentMethod } = body;

    if (!planId || !cadence || !paymentMethod) {
      return NextResponse.json(
        { error: "Missing required fields: planId, cadence, paymentMethod" },
        { status: 400 }
      );
    }

    // Pricing map (cents)
    const pricingMap: Record<string, number> = {
      "monthly_card": 1499,
      "monthly_ach":  1299,
      "annual_card":  14999,
      "annual_ach":   12999,
    };
    const productIdMap: Record<string, string> = {
      "monthly_card": "prod_U3no15TNX9iTj1",
      "monthly_ach":  "prod_U3nrt0liKgXRmq",
      "annual_card":  "prod_U3nsR7DN8AVcL9",
      "annual_ach":   "prod_U3ns1IYNVgNwGM",
    };

    const priceKey = `${cadence}_${paymentMethod}`;
    const amount = pricingMap[priceKey];
    const stripeProductId = productIdMap[priceKey];

    if (!amount || !stripeProductId) {
      return NextResponse.json({ error: "Invalid pricing configuration" }, { status: 400 });
    }

    // Fetch product name from Convex
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || "");
    let productName = "Ideal Oral Health Plan";
    try {
      const product = await convex.query(api.catalog.queries.getById, { id: planId });
      if (product?.name) productName = product.name;
    } catch { /* use default */ }

    // Create or retrieve Stripe customer
    let stripeCustomerId: string;
    const existing = await stripe.customers.list({ email: userEmail, limit: 1 });
    if (existing.data.length > 0) {
      stripeCustomerId = existing.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email: userEmail,
        name: userName,
        metadata: { clerkUserId: userId },
      });
      stripeCustomerId = customer.id;
    }

    // Create the subscription in an incomplete state so we can collect payment inline.
    // Stripe SDK v18+ (basil API) removed `payment_intent` from Invoice and replaced
    // it with `confirmation_secret` — a client_secret you pass directly to Elements.
    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      collection_method: "charge_automatically",
      items: [
        {
          price_data: {
            currency: "usd",
            product: stripeProductId,
            unit_amount: amount,
            recurring: {
              interval: cadence === "monthly" ? "month" : "year",
              interval_count: 1,
            },
          },
        },
      ],
      payment_behavior: "default_incomplete",
      payment_settings: {
        save_default_payment_method: "on_subscription",
      },
      expand: ["latest_invoice.confirmation_secret"],
      metadata: {
        clerkUserId: userId,
        planId,
        cadence,
        paymentMethod,
      },
    });

    const invoice = subscription.latest_invoice as any;
    // In basil+ API versions, use confirmation_secret instead of payment_intent.client_secret
    const clientSecret: string | undefined =
      invoice?.confirmation_secret?.client_secret ??
      invoice?.confirmation_secret ??
      undefined;

    console.log("[setup-payment] subscription.status:", subscription.status);
    console.log("[setup-payment] invoice.status:", invoice?.status);
    console.log("[setup-payment] invoice.confirmation_secret:", JSON.stringify(invoice?.confirmation_secret));
    console.log("[setup-payment] has client_secret:", !!clientSecret);

    if (!clientSecret) {
      console.error("[setup-payment] Missing client_secret. Subscription:", {
        id: subscription.id,
        status: subscription.status,
        invoiceId: typeof invoice === "string" ? invoice : invoice?.id,
        invoiceStatus: invoice?.status,
        confirmationSecret: invoice?.confirmation_secret,
        invoiceKeys: invoice ? Object.keys(invoice) : [],
      });
      await stripe.subscriptions.cancel(subscription.id);
      return NextResponse.json(
        { error: "Could not initialize payment. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      clientSecret,
      subscriptionId: subscription.id,
      productName,
    });
  } catch (error) {
    console.error("[setup-payment] Error:", error);

    if (error instanceof Stripe.errors.StripeInvalidRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
