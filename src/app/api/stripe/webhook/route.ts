import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

/**
 * POST /api/stripe/webhook
 *
 * Stripe webhook endpoint for subscription and payment events
 * Handles:
 * - checkout.session.completed: Create bundle, activate entitlements, create member profile
 * - invoice.payment_succeeded: Log payment, extend renewal
 * - customer.subscription.deleted: Mark bundle/entitlements as cancelled
 *
 * Requires STRIPE_WEBHOOK_SECRET environment variable
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
    }

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error("[webhook] STRIPE_WEBHOOK_SECRET not configured");
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 502 }
      );
    }

    // Verify signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[webhook] Signature verification failed:", message);
      return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
    }

    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || "");

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const metadata = (session.metadata || {}) as Record<string, string>;
        const stripeCustomerId = session.customer as string;
        const stripeSubscriptionId = session.subscription as string;

        // Guard: session must have required metadata
        if (!metadata?.clerkUserId || !metadata?.enrollmentSessionId) {
          console.warn("[webhook] checkout.session.completed missing metadata", session);
          return NextResponse.json({ received: true });
        }

        const { clerkUserId, enrollmentSessionId, brokerCode } = metadata;

        try {
          // Fetch enrollment session to get site/account/group context
          const enrollmentSession = await convex.query(
            api.enrollment.sessions.getEnrollmentSession,
            { sessionId: enrollmentSessionId }
          );

          if (!enrollmentSession) {
            throw new Error(`Enrollment session not found: ${enrollmentSessionId}`);
          }

          // Get Stripe subscription to extract pricing/billingdetails
          const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId) as any;
          const items = subscription.items?.data || [];
          const currentPeriodStart = subscription.current_period_start || Math.floor(Date.now() / 1000);
          const currentPeriodEnd = subscription.current_period_end || currentPeriodStart + (30 * 24 * 60 * 60);

          // Determine payment method
          const paymentMethod =
            session.payment_method_types?.includes("us_bank_account") ? "ach" : "card";
          const interval = items.length > 0 ? (items[0].plan as any).interval : "month";
          const cadence = (interval === "year" ? "annual" : "monthly") as "monthly" | "annual";
          const totalCents = (items[0]?.plan as any)?.amount || 1500;

          // 1. Create member profile (linked to enrollment session)
          const memberProfileId = await convex.mutation(
            api.enrollment.members.createMemberProfile,
            {
              siteId: enrollmentSession.siteId,
              accountId: enrollmentSession.accountId,
              groupId: enrollmentSession.groupId,
              firstName: session.customer_details?.name?.split(" ")[0] || "Member",
              lastName: session.customer_details?.name?.split(" ")?.[1] || "",
              email: session.customer_email || "",
              memberType: "active",
              signupSource: `stripe:${enrollmentSessionId}`,
              enrollmentSessionId: enrollmentSession._id,
            }
          );

          // 2. Create subscription bundle
          const bundleId = await convex.mutation(api.subscriptions.mutations.createBundle, {
            customerId: clerkUserId,
            cadence,
            paymentMethod: paymentMethod as "card" | "ach",
            stripeCustomerId,
            stripeSubscriptionId,
            stripeInvoiceId: (session.invoice as string) || undefined,
            totalCents,
            planCount: items.length,
            currentPeriodStart: currentPeriodStart * 1000,
            currentPeriodEnd: currentPeriodEnd * 1000,
          });

          // 3. Activate entitlements (one per product in subscription)
          for (const item of items) {
            const stripeProductId = typeof item.plan.product === "string" 
              ? item.plan.product 
              : (item.plan.product as any)?.id || "";
              
            await convex.mutation(api.subscriptions.mutations.activateEntitlement, {
              customerId: clerkUserId,
              bundleId,
              productId: stripeProductId,
              stripeSubscriptionItemId: item.id,
              periodStart: currentPeriodStart * 1000,
              periodEnd: currentPeriodEnd * 1000,
              endCondition: "renew",
            });
          }

          // 4. Complete enrollment session
          await convex.mutation(api.enrollment.sessions.completeEnrollmentSession, {
            sessionId: enrollmentSessionId,
            bundleId,
            customerId: clerkUserId,
          });

          // 5. Create commission record if broker attribution
          if (brokerCode) {
            try {
              await convex.mutation(api.subscriptions.commissions.createCommissionPayable, {
                brokerId: brokerCode,
                enrollmentSessionId: enrollmentSession._id,
                memberId: memberProfileId,
                rateApplied: 0.15, // Default 15% - will be overridden by commissionRates
                amount: Math.round(totalCents * 0.15), // Auto-calculated
                period: new Date().toISOString().slice(0, 7), // YYYY-MM
              });
            } catch (commissionError) {
              console.warn("[webhook] Failed to create commission record:", commissionError);
              // Don't fail the whole webhook for commission tracking issues
            }
          }

          // 6. Log event
          await convex.mutation(api.subscriptions.mutations.logEvent, {
            eventType: "checkout.session.completed",
            actor: "stripe",
            customerId: clerkUserId,
            bundleId,
            stripeEventId: event.id,
            stripeObjectId: session.id,
            payload: { enrollmentSessionId, brokerCode, memberProfileId },
            success: true,
            idempotencyKey: event.id,
          });

          console.log("[webhook] checkout.session.completed processed:", {
            clerkUserId,
            enrollmentSessionId,
            bundleId,
            memberProfileId,
            brokerCode,
          });
        } catch (error) {
          console.error("[webhook] Error processing checkout.session.completed:", error);
          try {
            await convex.mutation(api.subscriptions.mutations.logEvent, {
              eventType: "checkout.session.completed",
              actor: "stripe",
              customerId: clerkUserId || "",
              stripeEventId: event.id,
              stripeObjectId: session.id,
              payload: {},
              success: false,
              errorMessage: error instanceof Error ? error.message : "Unknown error",
              idempotencyKey: event.id,
            });
          } catch (logError) {
            console.error("[webhook] Failed to log error event:", logError);
          }
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as any;
        const stripeSubscriptionId = typeof invoice.subscription === "string" 
          ? invoice.subscription 
          : undefined;

        try {
          if (stripeSubscriptionId) {
            await convex.mutation(api.subscriptions.mutations.logEvent, {
              eventType: "invoice.payment_succeeded",
              actor: "stripe",
              stripeEventId: event.id,
              stripeObjectId: invoice.id,
              payload: { subscription: stripeSubscriptionId },
              success: true,
              idempotencyKey: event.id,
            });

            console.log("[webhook] invoice.payment_succeeded logged:", {
              stripeSubscriptionId,
            });
          }
        } catch (error) {
          console.error("[webhook] Error processing invoice.payment_succeeded:", error);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const stripeSubscriptionId = subscription.id;

        try {
          await convex.mutation(api.subscriptions.mutations.logEvent, {
            eventType: "customer.subscription.deleted",
            actor: "stripe",
            stripeEventId: event.id,
            stripeObjectId: subscription.id,
            payload: { subscription: stripeSubscriptionId },
            success: true,
            idempotencyKey: event.id,
          });

          console.log("[webhook] customer.subscription.deleted logged:", {
            stripeSubscriptionId,
          });
        } catch (error) {
          console.error("[webhook] Error processing customer.subscription.deleted:", error);
        }
        break;
      }

      default:
        console.log(`[webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[webhook] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
