import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY environment variable is required");
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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
          return NextResponse.json({ received: true });
        }

        const { clerkUserId, enrollmentSessionId, brokerCode, brokerClerkUserId, referralCode } = metadata;

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

          // 1. Create member profile (linked to enrollment session and Clerk user)
          const memberProfileId = await convex.mutation(
            api.enrollment.members.webhookCreateMemberProfile,
            {
              siteId: enrollmentSession.siteId,
              accountId: enrollmentSession.accountId,
              groupId: enrollmentSession.groupId,
              firstName: session.customer_details?.name?.split(" ")[0] || "Member",
              lastName: session.customer_details?.name?.split(" ")?.[1] || "",
              email: session.customer_email || "",
              customerId: clerkUserId, // Link to the Clerk user who completed checkout
              memberType: "active",
              signupSource: referralCode
                ? `referral:${referralCode}`
                : `stripe:${enrollmentSessionId}`,
              enrollmentSessionId: enrollmentSession._id,
            }
          );

          // 2. Create subscription bundle
          const bundleId = await convex.mutation(api.subscriptions.mutations.webhookCreateBundle, {
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

            // Resolve Stripe product ID → Convex catalogProducts._id
            // @ts-ignore - avoid deep type instantiation issue
            const catalogProduct = await convex.query(api.catalog.queries.getByStripeProductId, {
              stripeProductId,
            });

            if (!catalogProduct) {
              console.error(
                `[webhook] Could not resolve Stripe product ${stripeProductId} to a Convex catalogProduct. Skipping entitlement.`
              );
              continue;
            }

            await convex.mutation(api.subscriptions.mutations.webhookActivateEntitlement, {
              customerId: clerkUserId,
              bundleId,
              productId: catalogProduct._id,  // ✅ Convex document ID, not Stripe product ID
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
          const effectiveBrokerCode = brokerCode || referralCode;
          if (effectiveBrokerCode) {
            try {
              await convex.mutation(api.subscriptions.commissions.createCommissionPayable, {
                brokerId: effectiveBrokerCode,
                enrollmentSessionId: enrollmentSession._id,
                memberId: memberProfileId,
                rateApplied: 0.15, // Default 15% - will be overridden by commissionRates
                amount: Math.round(totalCents * 0.15), // Auto-calculated
                period: new Date().toISOString().slice(0, 7), // YYYY-MM
              });
            } catch (commissionError) {
              // Don't fail the whole webhook for commission tracking issues
            }
          }

          // 5a. Assign member to the broker/staff (use brokerClerkUserId if available, fallback to brokerCode)
          const staffClerkId = brokerClerkUserId || brokerCode;
          if (staffClerkId) {
            try {
              await convex.mutation(api.admin.members.assignMemberToStaff, {
                memberProfileId,
                staffClerkId,
              });
            } catch (assignError) {
              // Don't fail the whole webhook for staff assignment issues
            }
          }

          // 6. Log event
          await convex.mutation(api.subscriptions.mutations.webhookLogEvent, {
            eventType: "checkout.session.completed",
            actor: "stripe",
            customerId: clerkUserId,
            bundleId,
            stripeEventId: event.id,
            stripeObjectId: session.id,
            payload: { enrollmentSessionId, brokerCode: effectiveBrokerCode, referralCode, memberProfileId },
            success: true,
            idempotencyKey: event.id,
          });
        } catch (error) {
          console.error("[webhook] Error processing checkout.session.completed:", error);
          try {
            await convex.mutation(api.subscriptions.mutations.webhookLogEvent, {
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
            // Find the bundle to check if it was past_due
            const bundle = await convex.query(
              api.subscriptions.webhookActions.getBundleByStripeSubscription,
              { stripeSubscriptionId }
            );

            // If bundle was past_due, reactivate it
            if (bundle && bundle.status === "past_due") {
              await convex.mutation(
                api.subscriptions.webhookActions.reactivateBundleFromWebhook,
                {
                  bundleId: bundle._id,
                  reason: `Payment succeeded: ${invoice.id}`,
                }
              );
            }

            // Log the event
            await convex.mutation(api.subscriptions.mutations.webhookLogEvent, {
              eventType: "invoice.payment_succeeded",
              actor: "stripe",
              customerId: bundle?.customerId,
              bundleId: bundle?._id,
              stripeEventId: event.id,
              stripeObjectId: invoice.id,
              payload: { subscription: stripeSubscriptionId },
              success: true,
              idempotencyKey: event.id,
            });
          }
        } catch (error) {
          console.error("[webhook] Error processing invoice.payment_succeeded:", error);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as any;
        const stripeSubscriptionId = typeof invoice.subscription === "string"
          ? invoice.subscription
          : undefined;

        if (!stripeSubscriptionId) {
          break;
        }

        try {
          // Find the bundle by Stripe subscription ID
          const bundle = await convex.query(
            api.subscriptions.webhookActions.getBundleByStripeSubscription,
            { stripeSubscriptionId }
          );

          if (bundle) {
            // Suspend the bundle and entitlements
            await convex.mutation(api.subscriptions.webhookActions.suspendBundleFromWebhook, {
              bundleId: bundle._id,
              reason: `Payment failed: ${invoice.id}`,
            });
          }

          // Log event
          await convex.mutation(api.subscriptions.mutations.webhookLogEvent, {
            eventType: "invoice.payment_failed",
            actor: "stripe",
            customerId: bundle?.customerId,
            bundleId: bundle?._id,
            stripeEventId: event.id,
            stripeObjectId: invoice.id,
            payload: {
              subscription: stripeSubscriptionId,
              attemptCount: invoice.attempt_count,
              amountDue: invoice.amount_due,
            },
            success: true,
            idempotencyKey: event.id,
          });
        } catch (error) {
          console.error("[webhook] Error processing invoice.payment_failed:", error);
        }
        break;
      }

      case "customer.subscription.updated": {
        // Handles tier changes (upgrade/downgrade) and other subscription modifications
        const subscription = event.data.object as Stripe.Subscription;
        const stripeSubscriptionId = subscription.id;
        const previousAttributes = (event.data as any).previous_attributes || {};

        try {
          const bundle = await convex.query(
            api.subscriptions.webhookActions.getBundleByStripeSubscription,
            { stripeSubscriptionId }
          );

          if (bundle) {
            // If there was a pending downgrade and the subscription items changed,
            // the scheduled phase has taken effect — process the entitlement swap
            const pendingDowngrade = (bundle as any).pendingDowngrade;
            if (pendingDowngrade && previousAttributes.items) {
              const items = (subscription as any).items?.data || [];
              const newItem = items[0];

              if (newItem) {
                // Resolve the new Stripe product to a Convex catalog product
                const stripeProductId = typeof newItem.plan.product === "string"
                  ? newItem.plan.product
                  : (newItem.plan.product as any)?.id || "";

                // @ts-ignore - avoid deep type instantiation issue
                const newCatalogProduct = await convex.query(api.catalog.queries.getByStripeProductId, {
                  stripeProductId,
                });

                if (newCatalogProduct) {
                  // Get current active entitlements to find the old product
                  // @ts-ignore - avoid deep type instantiation issue
                  const entitlements = await convex.query(api.subscriptions.queries.getEntitlementsByBundle, {
                    bundleId: bundle._id,
                  });

                  const activeEntitlement = entitlements?.find((e: any) =>
                    e.status === "active" || e.status === "cancel_at_period_end"
                  );

                  if (activeEntitlement) {
                    await convex.mutation(api.subscriptions.webhookActions.processTierChange, {
                      bundleId: bundle._id,
                      customerId: bundle.customerId,
                      oldProductId: activeEntitlement.productId,
                      newProductId: newCatalogProduct._id,
                      newTotalCents: pendingDowngrade.targetTotalCents,
                      direction: "downgrade",
                      stripeSubscriptionItemId: newItem.id,
                    });
                  }
                }
              }

              // Clear the pending downgrade
              await convex.mutation(api.subscriptions.webhookActions.clearPendingDowngrade, {
                bundleId: bundle._id,
              });
            }

            // Log the subscription update event
            await convex.mutation(api.subscriptions.mutations.webhookLogEvent, {
              eventType: "customer.subscription.updated",
              actor: "stripe",
              customerId: bundle.customerId,
              bundleId: bundle._id,
              stripeEventId: event.id,
              stripeObjectId: subscription.id,
              payload: {
                previousAttributes: Object.keys(previousAttributes),
                hasPendingDowngrade: !!pendingDowngrade,
              },
              success: true,
              idempotencyKey: event.id,
            });
          }
        } catch (error) {
          console.error("[webhook] Error processing customer.subscription.updated:", error);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const stripeSubscriptionId = subscription.id;
        const stripeCustomerId = typeof subscription.customer === "string"
          ? subscription.customer
          : (subscription.customer as any)?.id || "";

        try {
          // 1. Find and cancel the subscription bundle in Convex
          const bundle = await convex.query(
            api.subscriptions.webhookActions.getBundleByStripeSubscription,
            { stripeSubscriptionId }
          );

          if (bundle) {
            // 2. Cancel the bundle
            await convex.mutation(api.subscriptions.webhookActions.cancelBundleFromWebhook, {
              bundleId: bundle._id,
              reason: "Stripe subscription deleted",
              stripeEventId: event.id,
            });

            // 3. Revoke all entitlements for this bundle
            await convex.mutation(api.subscriptions.webhookActions.revokeEntitlementsByBundle, {
              bundleId: bundle._id,
              reason: "Stripe subscription deleted",
            });

            // 4a. Send cancellation email to the member
            if (bundle.customerId) {
              try {
                const memberInfo = await convex.query(
                  api.subscriptions.webhookActions.getMemberForCancellation,
                  { customerId: bundle.customerId }
                );
                if (memberInfo?.email) {
                  // @ts-ignore - legal/emailFulfillment not in generated types
                  await convex.action((api as any)["legal/emailFulfillment"].sendMembershipCancelledEmail, {
                    memberName: `${memberInfo.firstName} ${memberInfo.lastName}`,
                    memberEmail: memberInfo.email,
                    memberId: memberInfo.memberId,
                  });
                }
              } catch (emailError) {
                console.error("[webhook] Failed to send cancellation email:", emailError);
              }
            }
          }

          // 4. Log the event
          await convex.mutation(api.subscriptions.mutations.webhookLogEvent, {
            eventType: "customer.subscription.deleted",
            actor: "stripe",
            customerId: bundle?.customerId,
            bundleId: bundle?._id,
            stripeEventId: event.id,
            stripeObjectId: subscription.id,
            payload: {
              subscription: stripeSubscriptionId,
              bundleCancelled: !!bundle,
            },
            success: true,
            idempotencyKey: event.id,
          });
        } catch (error) {
          console.error("[webhook] Error processing customer.subscription.deleted:", error);

          // Log failure event
          try {
            await convex.mutation(api.subscriptions.mutations.webhookLogEvent, {
              eventType: "customer.subscription.deleted",
              actor: "stripe",
              stripeEventId: event.id,
              stripeObjectId: subscription.id,
              payload: { subscription: stripeSubscriptionId },
              success: false,
              errorMessage: error instanceof Error ? error.message : "Unknown error",
              idempotencyKey: `${event.id}_error`,
            });
          } catch (logError) {
            console.error("[webhook] Failed to log error event:", logError);
          }
        }
        break;
      }

      default:
        break;
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
