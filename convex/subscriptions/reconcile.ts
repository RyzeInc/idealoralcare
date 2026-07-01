"use node";

/**
 * STRIPE SUBSCRIPTION RECONCILIATION
 *
 * Convex only learns about payment failures/cancellations via Stripe
 * webhooks. If a webhook is missed (endpoint downtime, misconfiguration,
 * a subscription created out-of-band via the /api/stripe/sync backfill
 * tool, etc.) a bundle can be stuck showing "active" in Convex long after
 * Stripe has actually cancelled it — meaning the member stopped paying but
 * the admin system never noticed.
 *
 * This action re-checks every "live" bundle directly against the Stripe
 * API and corrects any drift. It's meant to run on a schedule (see
 * convex/crons.ts) as a self-healing backstop to the webhook flow, not a
 * replacement for it.
 */

import Stripe from "stripe";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

export const reconcileStripeSubscriptions = internalAction({
  args: {},
  handler: async (ctx) => {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured for this Convex deployment");
    }
    const stripe = new Stripe(secretKey);

    const bundles = await ctx.runQuery(
      internal.subscriptions.webhookActions.listReconcilableBundles,
      {}
    );

    const results: Array<{
      bundleId: string;
      stripeSubscriptionId: string;
      action: string;
      error?: string;
    }> = [];

    for (const bundle of bundles) {
      const stripeSubscriptionId = bundle.stripeSubscriptionId as string;
      try {
        const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
        const item = subscription.items?.data?.[0] as any;
        const currentPeriodStart =
          (subscription as any).current_period_start ?? item?.current_period_start ?? 0;
        const currentPeriodEnd =
          (subscription as any).current_period_end ?? item?.current_period_end ?? 0;

        const outcome = await ctx.runMutation(
          internal.subscriptions.webhookActions.applyReconciliationOutcome,
          {
            bundleId: bundle._id,
            stripeStatus: subscription.status,
            currentPeriodStart: currentPeriodStart * 1000,
            currentPeriodEnd: currentPeriodEnd * 1000,
          }
        );

        results.push({ bundleId: bundle._id, stripeSubscriptionId, action: outcome.action });
      } catch (error: any) {
        // A missing/deleted Stripe subscription (404) is itself a strong
        // signal the bundle should be considered dead.
        if (error?.statusCode === 404 || error?.code === "resource_missing") {
          const outcome = await ctx.runMutation(
            internal.subscriptions.webhookActions.applyReconciliationOutcome,
            {
              bundleId: bundle._id,
              stripeStatus: "canceled",
              currentPeriodStart: 0,
              currentPeriodEnd: 0,
            }
          );
          results.push({ bundleId: bundle._id, stripeSubscriptionId, action: outcome.action });
          continue;
        }

        results.push({
          bundleId: bundle._id,
          stripeSubscriptionId,
          action: "error",
          error: error?.message ?? String(error),
        });
      }
    }

    const corrected = results.filter((r) => r.action !== "none" && r.action !== "error");
    const errored = results.filter((r) => r.action === "error");

    return {
      totalChecked: results.length,
      totalCorrected: corrected.length,
      totalErrored: errored.length,
      results,
    };
  },
});
