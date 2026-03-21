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

    // Map cadence + paymentMethod to Stripe product ID (individual plan defaults)
    const defaultProductIdMap: Record<string, string> = {
      "monthly_card": "prod_U3no15TNX9iTj1",  // Oral Health Plan Monthly Card
      "monthly_ach": "prod_U3nrt0liKgXRmq",   // Oral Health Plan Monthly ACH
      "annual_card": "prod_U3nsR7DN8AVcL9",   // Oral Health Plan Annual Card
      "annual_ach": "prod_U3ns1IYNVgNwGM",    // Oral Health Plan Annual ACH
    };

    // Fetch product details from Convex — pricing comes from DB
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || "");
    let productName = "Oral Health Plan";
    let amount: number | undefined;
    let stripeProductId: string | undefined;

    try {
      // @ts-ignore - Avoid deep type instantiation issue with api.catalog.queries
      const product = await convex.query(api.catalog.queries.getById, { id: planId });
      if (product) {
        productName = product.name;
        const pricing = product.pricing;
        // Resolve amount from DB pricing based on cadence (card/ach same price)
        if (cadence === "monthly") {
          amount = paymentMethod === "ach" ? pricing.monthlyACHCents : pricing.monthlyCardCents;
        } else {
          amount = paymentMethod === "ach" ? pricing.annualACHCents : pricing.annualCardCents;
        }
        // Use Stripe product IDs from DB if available
        const sp = product.stripeProducts;
        const spKey = `${cadence === "monthly" ? "monthly" : "annual"}${paymentMethod === "ach" ? "ACH" : "Card"}Id` as keyof typeof sp;
        if (sp && sp[spKey]) {
          stripeProductId = sp[spKey];
        }
      }
    } catch (error) {
      // Fall back to hardcoded individual pricing
    }

    // Fallback to hardcoded individual pricing if DB fetch failed
    const priceKey = `${cadence}_${paymentMethod}`;
    if (!amount) {
      const fallbackPricingMap: Record<string, number> = {
        "monthly_card": 1499, "monthly_ach": 1499,
        "annual_card": 16499, "annual_ach": 16499,
      };
      amount = fallbackPricingMap[priceKey];
    }
    if (!stripeProductId) {
      stripeProductId = defaultProductIdMap[priceKey];
    }
    
    if (!stripeProductId || !amount) {
      return NextResponse.json({ error: "Invalid pricing configuration" }, { status: 500 });
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
      // Per-dependent add-on pricing (legacy flow — family plan is now flat-rate)
      const dependentAmount = cadence === "monthly" ? 999 : 9999;
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
