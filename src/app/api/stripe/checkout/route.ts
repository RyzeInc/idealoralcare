import { NextRequest, NextResponse } from "next/server";
import {
  hasConflictingPrograms,
  isBflSlug,
  isMembershipProgramSlug,
} from "@/convex/lib/productSlugs";
import { auth, currentUser } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import Stripe from "stripe";
import { api } from "@/convex/_generated/api";
import {
  normalizeCheckoutProfile,
  checkoutAddress,
} from "@/lib/checkout-profile";
import { checkoutReturnUrls } from "@/lib/checkout-urls";
import { domainSite } from "@/lib/site-domains";
import { formatPrice } from "@/lib/health-plans/types";
import { getBaseUrl } from "@/lib/env";
import { getCatalogStripePrice } from "@/lib/stripe-price";

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
    const { userId, getToken } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await currentUser();
    if (!user?.emailAddresses[0]) {
      return NextResponse.json(
        { error: "User email not found" },
        { status: 400 },
      );
    }
    const userEmail = user.emailAddresses[0].emailAddress;

    const body = await req.json();
    const {
      planId,
      cadence,
      paymentMethod,
      enrollmentSessionId,
      brokerCode,
      groupId,
      dependents,
      referralCode,
      additionalPlanIds,
      agreementIds,
    } = body;
    const hostSite = domainSite(req.nextUrl.hostname);
    if (hostSite && body.siteSlug && body.siteSlug !== hostSite.slug)
      return NextResponse.json(
        { error: "Checkout does not belong to this site." },
        { status: 400 },
      );
    const siteSlug = hostSite?.slug || body.siteSlug;
    const memberProfile = normalizeCheckoutProfile(body.memberProfile);

    // Validate required fields
    if (!planId || !cadence || !paymentMethod) {
      return NextResponse.json(
        { error: "Missing required fields: planId, cadence, paymentMethod" },
        { status: 400 },
      );
    }

    if (!["monthly", "annual"].includes(cadence)) {
      return NextResponse.json({ error: "Invalid cadence" }, { status: 400 });
    }

    if (!["card", "ach"].includes(paymentMethod)) {
      return NextResponse.json(
        { error: "Invalid paymentMethod" },
        { status: 400 },
      );
    }

    // Validate dependents array if provided
    const dependentList: Array<{
      firstName: string;
      lastName: string;
      email: string;
      dateOfBirth?: string;
      relationship: string;
    }> = Array.isArray(dependents) ? dependents : [];

    // Fetch product details from Convex — pricing and Stripe product IDs come from DB
    const convex = new ConvexHttpClient(
      process.env.NEXT_PUBLIC_CONVEX_URL || "",
    );
    // A branded checkout must have a provisionable member hierarchy before payment.
    if (siteSlug) {
      const hierarchy = await convex.query(
        api.enrollment.sessions.getDTCHierarchy,
        { siteSlug },
      );
      if (!hierarchy)
        return NextResponse.json(
          { error: "Enrollment is not available for this site yet." },
          { status: 400 },
        );
    }
    const additionalIds: string[] = Array.isArray(additionalPlanIds)
      ? additionalPlanIds
      : [];
    if (
      additionalIds.some((id) => typeof id !== "string" || id === planId) ||
      new Set(additionalIds).size !== additionalIds.length
    ) {
      return NextResponse.json(
        { error: "Invalid cart items" },
        { status: 400 },
      );
    }
    const products = await Promise.all(
      [planId, ...additionalIds].map((id) =>
        convex.query(api.catalog.queries.getById, { id }),
      ),
    );
    if (products.some((product) => !product))
      return NextResponse.json(
        {
          error:
            "A plan in your cart is no longer available. Please refresh your cart.",
        },
        { status: 400 },
      );
    const orderSlugs = products.map((product) => product!.slug);
    if (hasConflictingPrograms(orderSlugs))
      return NextResponse.json(
        {
          error:
            "Balance for Life is already included in the Essentials Plan. Remove one of them to continue.",
        },
        { status: 400 },
      );
    if (cadence === "annual" && orderSlugs.some(isMembershipProgramSlug))
      return NextResponse.json(
        {
          error:
            "Essentials and Balance for Life are available with monthly billing only.",
        },
        { status: 400 },
      );
    const priced = products.map((product) => {
      const pricing = product!.pricing;
      const amount =
        cadence === "monthly"
          ? paymentMethod === "ach"
            ? pricing.monthlyACHCents
            : pricing.monthlyCardCents
          : paymentMethod === "ach"
            ? pricing.annualACHCents
            : pricing.annualCardCents;
      const key =
        `${cadence === "monthly" ? "monthly" : "annual"}${paymentMethod === "ach" ? "ACH" : "Card"}Id` as
          | "monthlyCardId"
          | "monthlyACHId"
          | "annualCardId"
          | "annualACHId";
      return {
        product: product!,
        amount,
        stripeProductId: product!.stripeProducts?.[key],
      };
    });
    if (priced.some((item) => !item.amount || !item.stripeProductId))
      return NextResponse.json(
        {
          error:
            "Could not resolve plan pricing. Please try again or contact support.",
        },
        { status: 400 },
      );

    // The group enrollment wizard has its own intake and agreement steps. DTC
    // checkouts must confirm census details and save every signed document first.
    if (
      siteSlug === "assurevantage" ||
      body.checkoutVersion === "confirmed-v1"
    ) {
      if (!memberProfile)
        return NextResponse.json(
          { error: "Complete and confirm your member details before payment." },
          { status: 400 },
        );
      if (
        !Array.isArray(agreementIds) ||
        agreementIds.length !== priced.length ||
        agreementIds.some((id) => typeof id !== "string")
      )
        return NextResponse.json(
          { error: "Sign the agreements for every membership before payment." },
          { status: 400 },
        );
      const token = await getToken({ template: "convex" });
      if (!token)
        return NextResponse.json(
          { error: "Your account is still connecting. Please try again." },
          { status: 401 },
        );
      convex.setAuth(token);
      const signed = await convex.query(
        api.legal.membershipAgreements.validateCheckoutAgreements,
        {
          agreementIds,
          plans: priced.map((item) => ({
            productId: item.product._id,
            periodicCharge: formatPrice(item.amount),
          })),
          term: cadence === "monthly" ? "Monthly" : "Annual",
          paymentMode: paymentMethod === "ach" ? "Bank Draft" : "Credit Card",
          memberAddress: checkoutAddress(memberProfile),
        },
      );
      if (!signed.valid)
        return NextResponse.json(
          {
            error:
              "Your signed agreements do not match this cart. Review and sign the current agreements.",
          },
          { status: 400 },
        );
    }

    let stripeCustomerId: string;
    const existingCustomers = await stripe.customers.list({
      email: userEmail,
      limit: 1,
    });
    if (existingCustomers.data.length > 0)
      stripeCustomerId = existingCustomers.data[0].id;
    else {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { clerkUserId: userId },
      });
      stripeCustomerId = customer.id;
    }
    let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];
    try {
      lineItems = await Promise.all(
        priced.map(async (item) => ({
          price: await getCatalogStripePrice(
            stripe,
            item.stripeProductId!,
            item.amount,
            cadence,
          ),
          quantity: 1,
        })),
      );
    } catch (error) {
      console.error("[checkout] Saved Stripe Price missing:", error);
      return NextResponse.json(
        {
          error: "Checkout pricing is not configured. Please contact support.",
        },
        { status: 503 },
      );
    }
    const returnUrls = checkoutReturnUrls(
      req.url,
      getBaseUrl(),
      siteSlug,
      orderSlugs.some(isBflSlug),
    );

    // Family plan is flat-rate. Dependents are collected post-enrollment.

    // Encode dependent data for webhook processing (max 500 chars per Stripe metadata value)
    const dependentsMeta =
      dependentList.length > 0 ? JSON.stringify(dependentList) : "";

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types:
        paymentMethod === "ach" ? ["us_bank_account"] : ["card", "link"],
      ...(paymentMethod === "ach"
        ? {
            payment_method_options: {
              us_bank_account: {
                financial_connections: { permissions: ["payment_method"] },
              },
            },
          }
        : {}),
      mode: "subscription",
      line_items: lineItems,
      metadata: {
        clerkUserId: userId,
        enrollmentSessionId: enrollmentSessionId || "", // Optional — may be empty from /health/checkout
        brokerCode: brokerCode || referralCode || "",
        groupId: groupId || "",
        referralCode: referralCode || "",
        // White-label site the shopper checked out under (e.g. "flourishxv"),
        // read from the [siteSlug] route param. Empty on the primary /health/checkout path.
        siteSlug: siteSlug || "",
        dependentCount: String(dependentList.length),
        // Truncate to 500 chars if needed (Stripe metadata limit per value)
        dependents: dependentsMeta.slice(0, 500),
        // Member profile fields collected during account creation — passed through for member record creation
        memberFirstName: memberProfile?.firstName || "",
        memberLastName: memberProfile?.lastName || "",
        memberDOB: memberProfile?.dateOfBirth || "",
        memberGender: memberProfile?.gender || "",
        memberPhone: memberProfile?.phone || "",
        memberAddress1: memberProfile?.address?.line1 || "",
        memberAddress2: memberProfile?.address?.line2 || "",
        memberCity: memberProfile?.address?.city || "",
        memberState: memberProfile?.address?.state || "",
        memberZip: memberProfile?.address?.postalCode || "",
      },
      success_url: returnUrls.success,
      cancel_url: returnUrls.cancel,
      automatic_tax: { enabled: false },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[checkout] Error:", error);

    if (error instanceof Stripe.errors.StripeInvalidRequestError) {
      return NextResponse.json(
        { error: `Stripe error: ${error.message}` },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
