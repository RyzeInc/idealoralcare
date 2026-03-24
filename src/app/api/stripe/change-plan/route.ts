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
 * POST /api/stripe/change-plan
 *
 * Handles plan tier changes (Individual ↔ Family).
 *
 * UPGRADE (Individual → Family):
 *   - $10 one-time upgrade fee charged as an invoice item
 *   - Stripe subscription item swapped to the Family price immediately
 *   - No proration — flat fee model
 *   - Family access starts immediately
 *
 * DOWNGRADE (Family → Individual):
 *   - Free, no charge
 *   - Takes effect at end of current billing period
 *   - User retains Family access until period end
 *
 * Requires Clerk authentication.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { targetTier } = body;

    if (!targetTier || !["individual", "family"].includes(targetTier)) {
      return NextResponse.json(
        { error: "Invalid targetTier. Must be 'individual' or 'family'." },
        { status: 400 }
      );
    }

    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || "");

    // 1. Fetch user's active bundle with Stripe IDs
    // @ts-ignore - avoid deep type instantiation issue
    const bundleResult = await convex.query(api.subscriptions.queries.getCustomerBundleWithStripeIds, {
      customerId: userId,
    });
    const bundle = bundleResult as any;

    if (!bundle || !bundle.stripeSubscriptionId || !bundle.stripeCustomerId) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 404 }
      );
    }

    // 2. Look up current entitlements to determine current tier
    // @ts-ignore - avoid deep type instantiation issue
    const entitlements = await convex.query(api.subscriptions.queries.getEntitlementsByBundle, {
      bundleId: bundle._id,
    });

    if (!entitlements || entitlements.length === 0) {
      return NextResponse.json(
        { error: "No active entitlements found" },
        { status: 404 }
      );
    }

    // Determine current tier from product slug
    const currentProduct = entitlements[0]?.product;
    if (!currentProduct) {
      return NextResponse.json(
        { error: "Could not determine current plan" },
        { status: 400 }
      );
    }

    const currentTier = currentProduct.slug?.includes("family") ? "family" : "individual";

    if (currentTier === targetTier) {
      return NextResponse.json(
        { error: `You are already on the ${targetTier} plan` },
        { status: 400 }
      );
    }

    const isUpgrade = targetTier === "family";

    // 3. Resolve target product from catalog
    const targetSlug = isUpgrade ? "oral-health-family" : "oral-health-individual";
    // @ts-ignore - avoid deep type instantiation issue
    const targetProduct = await convex.query(api.catalog.queries.getBySlug, {
      slug: targetSlug,
    });

    if (!targetProduct) {
      return NextResponse.json(
        { error: "Target plan not found in catalog" },
        { status: 500 }
      );
    }

    // 4. Get the Stripe subscription to find the current item
    const stripeSubscription = await stripe.subscriptions.retrieve(bundle.stripeSubscriptionId) as any;
    const currentItem = stripeSubscription.items?.data?.[0];

    if (!currentItem) {
      return NextResponse.json(
        { error: "Could not find subscription item in Stripe" },
        { status: 500 }
      );
    }

    // 5. Determine cadence and payment method from current subscription
    const currentInterval = currentItem.plan?.interval;
    const cadence: "monthly" | "annual" = currentInterval === "year" ? "annual" : "monthly";

    // Determine payment method from bundle or default to card
    const fullBundle = await convex.query(api.subscriptions.queries.getCustomerBundlePublic, {
      customerId: userId,
    }) as any;
    const paymentMethod = fullBundle?.pricingSnapshot?.paymentMethod || "card";

    // Get the target Stripe product ID based on cadence + payment method
    const sp = targetProduct.stripeProducts;
    const spKey = `${cadence === "annual" ? "annual" : "monthly"}${paymentMethod === "ach" ? "ACH" : "Card"}Id` as keyof typeof sp;
    const targetStripeProductId = sp?.[spKey];

    if (!targetStripeProductId) {
      return NextResponse.json(
        { error: "Could not resolve target Stripe product" },
        { status: 500 }
      );
    }

    // 6. Resolve the target Stripe Price ID
    // We need to find or create a price for this product.
    // Look up existing prices on the target product.
    const targetPricing = targetProduct.pricing;
    const targetAmountCents = cadence === "annual"
      ? (paymentMethod === "ach" ? targetPricing.annualACHCents : targetPricing.annualCardCents)
      : (paymentMethod === "ach" ? targetPricing.monthlyACHCents : targetPricing.monthlyCardCents);

    // List existing prices on the Stripe product
    const prices = await stripe.prices.list({
      product: targetStripeProductId,
      active: true,
      limit: 10,
    });

    let targetPriceId: string | undefined;
    const targetInterval = cadence === "annual" ? "year" : "month";

    for (const price of prices.data) {
      if (
        price.unit_amount === targetAmountCents &&
        price.recurring?.interval === targetInterval &&
        price.currency === "usd"
      ) {
        targetPriceId = price.id;
        break;
      }
    }

    // If no matching price exists, create one
    if (!targetPriceId) {
      const newPrice = await stripe.prices.create({
        product: targetStripeProductId,
        unit_amount: targetAmountCents,
        currency: "usd",
        recurring: { interval: targetInterval },
      });
      targetPriceId = newPrice.id;
    }

    if (isUpgrade) {
      // ── UPGRADE: $10 fee + immediate plan swap ──────────

      // 6a. Add $10 one-time upgrade fee to next invoice
      await stripe.invoiceItems.create({
        customer: bundle.stripeCustomerId,
        amount: 1000, // $10.00
        currency: "usd",
        description: "Plan Upgrade Fee — Individual to Family",
      });

      // 6b. Swap the subscription item to the Family price (no proration)
      await stripe.subscriptions.update(bundle.stripeSubscriptionId, {
        items: [
          {
            id: currentItem.id,
            price: targetPriceId,
          },
        ],
        proration_behavior: "none",
        metadata: {
          tierChange: "upgrade",
          previousTier: "individual",
          newTier: "family",
        },
      });

      // 6c. Update Convex: swap entitlements + update bundle pricing
      await convex.mutation(api.subscriptions.webhookActions.processTierChange, {
        bundleId: bundle._id,
        customerId: userId,
        oldProductId: currentProduct._id,
        newProductId: targetProduct._id,
        newTotalCents: targetAmountCents,
        direction: "upgrade",
        stripeSubscriptionItemId: currentItem.id,
      });

      // 6d. Log the upgrade event
      await convex.mutation(api.subscriptions.mutations.webhookLogEvent, {
        eventType: "plan.upgraded",
        actor: "user",
        customerId: userId,
        bundleId: bundle._id,
        payload: {
          from: "individual",
          to: "family",
          upgradeFee: 1000,
          cadence,
        },
        success: true,
        idempotencyKey: `upgrade_${bundle._id}_${Date.now()}`,
      });

      return NextResponse.json({
        success: true,
        direction: "upgrade",
        newTier: "family",
        upgradeFee: "$10.00",
        effective: "immediate",
      });

    } else {
      // ── DOWNGRADE: free, effective at period end ────────

      // Schedule the plan swap for period end by using Stripe's subscription schedule
      // or by setting metadata and handling at renewal.
      // Simplest approach: update the subscription with the new price, but set it to
      // take effect at the next billing cycle using a schedule.

      // Use Stripe subscription schedule for deferred downgrade
      let schedule: any;

      // Check if subscription already has a schedule
      if (stripeSubscription.schedule) {
        schedule = await stripe.subscriptionSchedules.retrieve(stripeSubscription.schedule as string);
      } else {
        // Create a schedule from the existing subscription
        schedule = await stripe.subscriptionSchedules.create({
          from_subscription: bundle.stripeSubscriptionId,
        });
      }

      // Update the schedule: current phase keeps Family, next phase switches to Individual
      const currentPhaseEnd = stripeSubscription.current_period_end;

      await stripe.subscriptionSchedules.update(schedule.id, {
        phases: [
          {
            items: [{ price: currentItem.price.id || currentItem.plan.id, quantity: 1 }],
            start_date: stripeSubscription.current_period_start,
            end_date: currentPhaseEnd,
          },
          {
            items: [{ price: targetPriceId, quantity: 1 }],
            start_date: currentPhaseEnd,
          },
        ],
        end_behavior: "release",
      });

      // Update Convex: mark the pending downgrade
      await convex.mutation(api.subscriptions.webhookActions.scheduleTierDowngrade, {
        bundleId: bundle._id,
        customerId: userId,
        targetProductId: targetProduct._id,
        targetTotalCents: targetAmountCents,
        effectiveDate: currentPhaseEnd * 1000, // Convert to ms
      });

      // Log the downgrade event
      await convex.mutation(api.subscriptions.mutations.webhookLogEvent, {
        eventType: "plan.downgrade_scheduled",
        actor: "user",
        customerId: userId,
        bundleId: bundle._id,
        payload: {
          from: "family",
          to: "individual",
          effectiveDate: new Date(currentPhaseEnd * 1000).toISOString(),
          cadence,
        },
        success: true,
        idempotencyKey: `downgrade_${bundle._id}_${Date.now()}`,
      });

      return NextResponse.json({
        success: true,
        direction: "downgrade",
        newTier: "individual",
        upgradeFee: null,
        effective: "period_end",
        effectiveDate: new Date(currentPhaseEnd * 1000).toISOString(),
      });
    }
  } catch (error) {
    console.error("[change-plan] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to change plan" },
      { status: 500 }
    );
  }
}
