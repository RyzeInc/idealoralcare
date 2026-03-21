import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import Stripe from "stripe";
import { api } from "@/convex/_generated/api";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY environment variable is required");
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout Session for enrollment
 * Requires:
 * - Clerk authentication
 * - planId: Convex product ID
 * - cadence: "monthly" | "annual"
 * - paymentMethod: "card" | "ach"
 * - enrollmentSessionId: Convex enrollment session ID
 *
 * Optional:
 * - brokerCode: Broker/agent attribution code
 * - groupId: Group enrollment ID
 *
 * Returns:
 * - { url: "https://checkout.stripe.com/..." }
 */
export async function POST(req: NextRequest) {
  try {
    // Verify auth
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await currentUser();
    if (!user?.emailAddresses[0]) {
      return NextResponse.json({ error: "User email not found" }, { status: 400 });
    }
    const userEmail = user.emailAddresses[0].emailAddress;

    const body = await req.json();
    const { planId, cadence, paymentMethod, enrollmentSessionId, brokerCode, groupId, brokerClerkUserId, dependents } = body;

    // Validate required fields
    if (!planId || !cadence || !paymentMethod) {
      return NextResponse.json(
        { error: "Missing required fields: planId, cadence, paymentMethod" },
        { status: 400 }
      );
    }

    if (!["monthly", "annual"].includes(cadence)) {
      return NextResponse.json({ error: "Invalid cadence" }, { status: 400 });
    }

    if (!["card", "ach"].includes(paymentMethod)) {
      return NextResponse.json({ error: "Invalid paymentMethod" }, { status: 400 });
    }

    // Validate dependents array if provided
    const dependentList: Array<{
      firstName: string;
      lastName: string;
      email: string;
      dateOfBirth?: string;
      relationship: string;
    }> = Array.isArray(dependents) ? dependents : [];

    // Map cadence + paymentMethod to Stripe product ID
    const productIdMap: Record<string, string> = {
      "monthly_card": "prod_U3no15TNX9iTj1",  // Oral Health Plan Monthly Card
      "monthly_ach": "prod_U3nrt0liKgXRmq",   // Oral Health Plan Monthly ACH
      "annual_card": "prod_U3nsR7DN8AVcL9",   // Oral Health Plan Annual Card
      "annual_ach": "prod_U3ns1IYNVgNwGM",    // Oral Health Plan Annual ACH
    };

    // Determine pricing based on cadence + paymentMethod
    const pricingMap: Record<string, number> = {
      "monthly_card": 1499,     // $14.99/mo for card
      "monthly_ach": 1299,      // $12.99/mo for ACH
      "annual_card": 16499,     // $164.99/year for card
      "annual_ach": 14999,      // $149.99/year for ACH
    };

    // Per-dependent add-on pricing (each additional family member)
    const dependentPricingMap: Record<string, number> = {
      "monthly_card": 999,    // $9.99/mo per dependent (card)
      "monthly_ach": 899,     // $8.99/mo per dependent (ACH)
      "annual_card": 9999,    // $99.99/yr per dependent (card)
      "annual_ach": 8999,     // $89.99/yr per dependent (ACH)
    };

    const priceKey = `${cadence}_${paymentMethod}`;
    const stripeProductId = productIdMap[priceKey];
    const amount = pricingMap[priceKey];
    const dependentAmount = dependentPricingMap[priceKey];
    
    if (!stripeProductId || !amount) {
      return NextResponse.json({ error: "Invalid pricing configuration" }, { status: 500 });
    }

    // Fetch product details from Convex (optional, for display)
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || "");
    let productName = "Oral Health Plan";

    try {
      // @ts-ignore - Avoid deep type instantiation issue with api.catalog.queries
      const product = await convex.query(api.catalog.queries.getById, { id: planId });
      if (product) {
        productName = product.name;
      }
    } catch (error) {
      // Fall back to default product name
    }

    // Create or get Stripe customer
    let stripeCustomerId: string;
    const existingCustomers = await stripe.customers.list({
      email: userEmail,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      stripeCustomerId = existingCustomers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { clerkUserId: userId },
      });
      stripeCustomerId = customer.id;
    }

    // Create checkout session
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: productName,
            metadata: { planId, stripeProductId },
          },
          unit_amount: amount,
          recurring: {
            interval: cadence === "monthly" ? "month" : "year",
            interval_count: 1,
          },
        },
        quantity: 1,
      },
    ];

    // Add dependent line item if any dependents are being enrolled
    if (dependentList.length > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: `Dependent – ${productName}`,
            description: `Family plan add-on for ${dependentList.length} dependent${dependentList.length > 1 ? "s" : ""}`,
            metadata: { planId, type: "dependent" },
          },
          unit_amount: dependentAmount,
          recurring: {
            interval: cadence === "monthly" ? "month" : "year",
            interval_count: 1,
          },
        },
        quantity: dependentList.length,
      });
    }

    // Encode dependent data for webhook processing (max 500 chars per Stripe metadata value)
    const dependentsMeta =
      dependentList.length > 0 ? JSON.stringify(dependentList) : "";

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: paymentMethod === "ach" ? ["us_bank_account"] : ["card", "link"],
      ...(paymentMethod === "ach" ? { payment_method_options: { us_bank_account: { financial_connections: { permissions: ["payment_method"] } } } } : {}),
      mode: "subscription",
      line_items: lineItems,
      metadata: {
        clerkUserId: userId,
        enrollmentSessionId: enrollmentSessionId || "",  // Optional — may be empty from /health/checkout
        brokerCode: brokerCode || "",
        brokerClerkUserId: brokerClerkUserId || "",
        groupId: groupId || "",
        dependentCount: String(dependentList.length),
        // Truncate to 500 chars if needed (Stripe metadata limit per value)
        dependents: dependentsMeta.slice(0, 500),
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/health/dashboard?session_id={CHECKOUT_SESSION_ID}&status=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/health/plans`,
      automatic_tax: { enabled: false },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[checkout] Error:", error);

    if (error instanceof Stripe.errors.StripeInvalidRequestError) {
      return NextResponse.json(
        { error: `Stripe error: ${error.message}` },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
