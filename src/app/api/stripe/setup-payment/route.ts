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

    // Create the subscription in an incomplete state so we can collect payment inline
    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
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
        payment_method_types: paymentMethod === "ach" ? ["us_bank_account"] : ["card"],
        save_default_payment_method: "on_subscription",
      },
      expand: ["latest_invoice.payment_intent"],
      metadata: {
        clerkUserId: userId,
        planId,
        cadence,
        paymentMethod,
      },
    });

    const invoice = subscription.latest_invoice as any;
    const paymentIntent = invoice?.payment_intent as any;

    if (!paymentIntent?.client_secret) {
      // Cancel the incomplete subscription and return error
      await stripe.subscriptions.cancel(subscription.id);
      return NextResponse.json(
        { error: "Could not initialize payment. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
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
