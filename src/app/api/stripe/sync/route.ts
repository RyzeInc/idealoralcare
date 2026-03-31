import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY environment variable is required");
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * POST /api/stripe/sync
 *
 * Admin-only endpoint that reconciles Stripe subscriptions with Convex data.
 * For each active Stripe subscription:
 *   1. Check if a subscriptionBundle exists in Convex
 *   2. If missing, create member profile + bundle + entitlements
 *
 * This handles the case where webhooks were missed (e.g., webhook not configured
 * at time of purchase, cross-environment issues, deployment downtime).
 */
export async function POST(req: NextRequest) {
  try {
    // Require authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || "");

    // Verify the caller is an admin
    const isAdmin = await convex.query(api.admin.adminUsers.isAdmin, { clerkUserId: userId });
    if (!isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Fetch all active Stripe subscriptions
    const subscriptions: any[] = [];
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const batch = await stripe.subscriptions.list({
        status: "active",
        limit: 100,
        expand: ["data.customer"],
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      subscriptions.push(...batch.data);
      hasMore = batch.has_more;
      if (batch.data.length > 0) {
        startingAfter = batch.data[batch.data.length - 1].id;
      }
    }

    // Also check past_due subscriptions
    let hasMorePastDue = true;
    let startingAfterPD: string | undefined;
    while (hasMorePastDue) {
      const batch = await stripe.subscriptions.list({
        status: "past_due",
        limit: 100,
        expand: ["data.customer"],
        ...(startingAfterPD ? { starting_after: startingAfterPD } : {}),
      });
      subscriptions.push(...batch.data);
      hasMorePastDue = batch.has_more;
      if (batch.data.length > 0) {
        startingAfterPD = batch.data[batch.data.length - 1].id;
      }
    }

    const results = {
      total: subscriptions.length,
      alreadySynced: 0,
      created: 0,
      errors: [] as Array<{ subscriptionId: string; error: string }>,
    };

    // Get the default DTC site/account/group for orphaned subscriptions
    const hierarchy = await convex.query(api.enrollment.sessions.getDTCHierarchy);

    for (const sub of subscriptions) {
      try {
        // Check if bundle already exists in Convex
        const existingBundle = await convex.query(
          api.subscriptions.webhookActions.getBundleByStripeSubscription,
          { stripeSubscriptionId: sub.id }
        );

        if (existingBundle) {
          results.alreadySynced++;
          continue;
        }

        // Bundle is missing — reconstruct from Stripe data
        const customer = typeof sub.customer === "object"
          ? (sub.customer as Stripe.Customer)
          : null;
        const customerEmail = customer?.email || "";
        const customerName = customer?.name || customerEmail.split("@")[0] || "Member";
        const clerkUserId = customer?.metadata?.clerkUserId || "";
        const stripeCustomerId = typeof sub.customer === "string" ? sub.customer : customer?.id || "";

        const items = sub.items?.data || [];
        const firstItem = items[0];
        const interval = firstItem?.plan?.interval || "month";
        const cadence = (interval === "year" ? "annual" : "monthly") as "monthly" | "annual";
        const totalCents = firstItem?.plan?.amount || 1500;
        const paymentMethod = "card" as const; // Default — Stripe doesn't expose this cleanly

        if (!hierarchy) {
          results.errors.push({
            subscriptionId: sub.id,
            error: "No DTC hierarchy found — run enrollment initialization first",
          });
          continue;
        }

        // 1. Check if member profile already exists by email or customerId
        let memberProfileId: string | undefined;

        if (clerkUserId) {
          const existingMember = await convex.query(
            api.enrollment.members.getMemberByCustomerId,
            { customerId: clerkUserId }
          );
          if (existingMember) {
            memberProfileId = existingMember._id;
          }
        }

        // Create member profile if needed
        if (!memberProfileId) {
          const firstName = customerName.split(" ")[0] || "Member";
          const lastName = customerName.split(" ").slice(1).join(" ") || "";

          memberProfileId = await convex.mutation(
            api.enrollment.members.webhookCreateMemberProfile,
            {
              siteId: hierarchy.siteId,
              accountId: hierarchy.accountId,
              groupId: hierarchy.groupId,
              firstName,
              lastName,
              email: customerEmail,
              customerId: clerkUserId || undefined,
              memberType: "active",
              signupSource: `stripe-sync:${sub.id}`,
            }
          );
        }

        // 2. Create subscription bundle
        const bundleId = await convex.mutation(
          api.subscriptions.mutations.webhookCreateBundle,
          {
            customerId: clerkUserId || stripeCustomerId,
            cadence,
            paymentMethod,
            stripeCustomerId,
            stripeSubscriptionId: sub.id,
            totalCents,
            planCount: items.length,
            currentPeriodStart: (sub.current_period_start || 0) * 1000,
            currentPeriodEnd: (sub.current_period_end || 0) * 1000,
          }
        );

        // 3. Activate entitlements for each subscription item
        for (const item of items) {
          const stripeProductId =
            typeof item.plan?.product === "string"
              ? item.plan.product
              : (item.plan?.product as any)?.id || "";

          if (!stripeProductId) continue;

          const catalogProduct = await convex.query(
            api.catalog.queries.getByStripeProductId,
            { stripeProductId }
          );

          if (!catalogProduct) {
            console.error(`[sync] Could not resolve Stripe product ${stripeProductId}`);
            continue;
          }

          await convex.mutation(
            api.subscriptions.mutations.webhookActivateEntitlement,
            {
              customerId: clerkUserId || stripeCustomerId,
              bundleId,
              productId: catalogProduct._id,
              stripeSubscriptionItemId: item.id,
              periodStart: (sub.current_period_start || 0) * 1000,
              periodEnd: (sub.current_period_end || 0) * 1000,
              endCondition: "renew",
            }
          );
        }

        // 4. Log the sync event
        await convex.mutation(api.subscriptions.mutations.webhookLogEvent, {
          eventType: "stripe_sync.reconciled",
          actor: "admin",
          customerId: clerkUserId || stripeCustomerId,
          bundleId,
          stripeEventId: `sync_${Date.now()}`,
          stripeObjectId: sub.id,
          payload: {
            memberProfileId,
            customerEmail,
            syncedBy: userId,
          },
          success: true,
          idempotencyKey: `sync_${sub.id}_${Date.now()}`,
        });

        results.created++;
      } catch (error) {
        results.errors.push({
          subscriptionId: sub.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${results.created} new subscription(s). ${results.alreadySynced} already existed. ${results.errors.length} error(s).`,
      ...results,
    });
  } catch (error) {
    console.error("[sync] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
