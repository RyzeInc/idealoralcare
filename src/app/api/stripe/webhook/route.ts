import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { essentialsCoverageLabel, isEssentialsSlug } from "@/lib/essentials-packet-pdf";
import { PROVIDER_GROUP_CODE } from "@/lib/constants";

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
    let processingFailed = false;

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const metadata = (session.metadata || {}) as Record<string, string>;
        const stripeCustomerId = session.customer as string;
        const stripeSubscriptionId = session.subscription as string;

        // Guard: session must have required metadata
        if (!metadata?.clerkUserId) {
          console.error("[webhook] Missing clerkUserId in checkout session metadata");
          return NextResponse.json({ received: true });
        }

        const { clerkUserId, enrollmentSessionId, brokerCode, referralCode, siteSlug } = metadata;

        try {
          // Fetch enrollment session to get site/account/group context
          // Fall back to DTC hierarchy if enrollment session is missing (cross-environment, missed webhook, etc.)
          let siteId: string;
          let accountId: string;
          let groupId: string;
          let enrollmentSessionDocId: string | undefined;
          // Census fields collected by a wizard flow (e.g. /health/enroll)
          // before the user had an account, synced onto the session's
          // stepData in the review step. Stripe Checkout itself only ever
          // collects name/email.
          let sessionPersonalInfo: any;
          let sessionAddress: any;

          if (enrollmentSessionId) {
            try {
              const enrollmentSession = await convex.query(
                api.enrollment.sessions.getEnrollmentSession,
                { sessionId: enrollmentSessionId }
              );
              siteId = enrollmentSession.siteId;
              accountId = enrollmentSession.accountId;
              groupId = enrollmentSession.groupId;
              enrollmentSessionDocId = enrollmentSession._id;
              sessionPersonalInfo = (enrollmentSession as any).stepData?.personalInfo;
              sessionAddress = (enrollmentSession as any).stepData?.address;
            } catch {
              console.warn(`[webhook] Enrollment session not found: ${enrollmentSessionId}. Falling back to DTC hierarchy.`);
              const hierarchy = await convex.query(api.enrollment.sessions.getDTCHierarchy, siteSlug ? { siteSlug } : {});
              if (!hierarchy) {
                throw new Error("No DTC hierarchy found and enrollment session missing — cannot create member");
              }
              siteId = hierarchy.siteId;
              accountId = hierarchy.accountId;
              groupId = hierarchy.groupId;
            }
          } else {
            const hierarchy = await convex.query(api.enrollment.sessions.getDTCHierarchy, siteSlug ? { siteSlug } : {});
            if (!hierarchy) {
              throw new Error("No DTC hierarchy found and no enrollmentSessionId — cannot create member");
            }
            siteId = hierarchy.siteId;
            accountId = hierarchy.accountId;
            groupId = hierarchy.groupId;
          }

          // Backstop: a DTC checkout never ran the enrollment wizard, so no
          // enrollmentSessions row exists. Create one now — before the member
          // — so their attribution stamp resolves through the enrollment path
          // and the production funnel sees the sale. Idempotent on the Stripe
          // Checkout session id, so a replay reuses the same row.
          const brokerValueForAttribution = brokerCode || referralCode;
          let effectiveSessionKey: string | undefined = enrollmentSessionId;
          if (!enrollmentSessionDocId) {
            try {
              const backstop = await convex.mutation(
                api.enrollment.sessions.webhookEnsureEnrollmentSession,
                {
                  stripeCheckoutSessionId: session.id,
                  siteId: siteId as any,
                  accountId: accountId as any,
                  groupId: groupId as any,
                  brokerValue: brokerValueForAttribution || undefined,
                  signupSource: brokerValueForAttribution
                    ? `referral:${brokerValueForAttribution}`
                    : `stripe:${session.id}`,
                }
              );
              enrollmentSessionDocId = backstop._id;
              effectiveSessionKey = backstop.sessionId;
            } catch (backstopErr) {
              // Non-fatal: the member is still created, just without a session.
              console.error("[webhook] Could not create backstop enrollment session:", backstopErr);
            }
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

          // Normalize gender: checkout stores "M"/"F"; schema expects "male"/"female"
          const rawGender = metadata.memberGender || "";
          const normalizedGender: "male" | "female" | undefined =
            rawGender === "M" || rawGender === "male" ? "male" :
            rawGender === "F" || rawGender === "female" ? "female" :
            undefined;

          // Normalize DOB: checkout stores "MM/DD/YYYY"; schema expects "YYYY-MM-DD"
          let normalizedDOB: string | undefined;
          const rawDOB = metadata.memberDOB || "";
          if (rawDOB) {
            const parts = rawDOB.split("/");
            if (parts.length === 3) {
              // MM/DD/YYYY → YYYY-MM-DD
              normalizedDOB = `${parts[2]}-${parts[0].padStart(2, "0")}-${parts[1].padStart(2, "0")}`;
            } else {
              // Already ISO or unknown — store as-is
              normalizedDOB = rawDOB;
            }
          }

          const memberResult = await convex.mutation(
            api.enrollment.members.webhookCreateMemberProfile,
            {
              siteId: siteId as any,
              accountId: accountId as any,
              groupId: groupId as any,
              firstName: session.customer_details?.name?.split(" ")[0] || "Member",
              lastName: session.customer_details?.name?.split(" ")?.[1] || "",
              email: session.customer_email || "",
              customerId: clerkUserId, // Link to the Clerk user who completed checkout
              memberType: "active",
              signupSource: referralCode
                ? `referral:${referralCode}`
                : `stripe:${enrollmentSessionId || session.id}`,
              enrollmentSessionId: enrollmentSessionDocId as any,
              // Profile fields collected during account creation, falling back
              // to census data a wizard flow (e.g. /health/enroll) synced onto
              // the enrollment session — Stripe Checkout only collects name/email.
              phone: metadata.memberPhone || sessionPersonalInfo?.phone || undefined,
              dateOfBirth: normalizedDOB || sessionPersonalInfo?.dateOfBirth || undefined,
              gender: normalizedGender,
              address: metadata.memberAddress1 ? {
                line1: metadata.memberAddress1,
                line2: metadata.memberAddress2 || undefined,
                city: metadata.memberCity,
                state: metadata.memberState,
                postalCode: metadata.memberZip,
                country: "US",
              } : sessionAddress || undefined,
            }
          );
          // Support both old (plain ID string) and new ({ profileId, memberId, subscriberId }) return shapes
          const memberProfileId: any = (memberResult as any)?.profileId ?? memberResult;
          const createdMemberId: string = (memberResult as any)?.memberId ?? "";

          // Close the session -> member link. RepAttributionResolver indexes
          // sessions BY member, so an unlinked session is invisible to it and
          // the member would silently fall back to group attribution.
          if (enrollmentSessionDocId && memberProfileId) {
            try {
              await convex.mutation(api.enrollment.sessions.webhookLinkSessionMember, {
                enrollmentSessionId: enrollmentSessionDocId as any,
                memberId: memberProfileId,
              });
            } catch (linkSessionErr) {
              console.error("[webhook] Could not link member to enrollment session:", linkSessionErr);
            }
          }

          // Link the signed membership agreement (captured at checkout with a
          // placeholder memberId) to the real Careington member ID now that it exists.
          if (createdMemberId) {
            try {
              await convex.mutation(api.legal.membershipAgreements.linkAgreementToMember, {
                userId: clerkUserId,
                memberId: createdMemberId,
              });
            } catch (linkErr) {
              console.error("[webhook] Failed to link membership agreement to member:", linkErr);
            }
          }

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

          // Resolve the rep tracking code → Clerk-free Convex IDs.
          // effectiveBrokerCode is the rep code STRING (e.g. "100001"), never a Clerk ID.
          const effectiveBrokerCode = brokerValueForAttribution;
          let attributedRepLeaderId: string | undefined; // partnerLeaders._id
          let attributedAgencyId: string | undefined;    // distributionPartners._id
          if (effectiveBrokerCode) {
            try {
              const agent = await convex.query(api.enrollment.agents.getAgentByRepCode, {
                code: effectiveBrokerCode,
              });
              if (agent) {
                attributedRepLeaderId = agent.id;
                attributedAgencyId = agent.groupId ?? undefined;
              } else {
                console.warn(`[webhook] Rep code ${effectiveBrokerCode} did not resolve to an agent.`);
              }
            } catch (resolveError) {
              console.warn("[webhook] Could not resolve rep code to agent:", resolveError);
            }
          }

          // 4. Complete the enrollment session — the wizard's, or the backstop
          //    created above for a DTC checkout. Persist rep attribution on the
          //    sale record (canonical source of truth).
          if (effectiveSessionKey) {
            try {
              await convex.mutation(api.enrollment.sessions.completeEnrollmentSession, {
                sessionId: effectiveSessionKey,
                bundleId,
                customerId: clerkUserId,
                brokerId: attributedRepLeaderId,
                agencyId: attributedAgencyId,
                brokerTrackingCode: effectiveBrokerCode || undefined,
              });
            } catch (sessionError) {
              console.warn("[webhook] Could not complete enrollment session:", sessionError);
            }
          }

          // 5. Record the commission.
          //
          // This previously inserted a payable at a hardcoded 15%. The mutation
          // now resolves the code to a real rep id and reads the contracted rate
          // from commissionRates — and where it cannot determine both, it
          // records nothing and says why rather than inventing a figure.
          if (effectiveBrokerCode) {
            try {
              const commissionResult = await convex.mutation(
                api.subscriptions.commissions.recordCommissionForCheckout,
                {
                  brokerValue: effectiveBrokerCode,
                  enrollmentSessionId: enrollmentSessionDocId as any,
                  memberId: memberProfileId,
                  groupId: groupId as any,
                  siteId: siteId as any,
                  totalCents,
                }
              );
              if (!commissionResult.recorded) {
                console.warn(
                  `[webhook] No commission recorded for "${effectiveBrokerCode}": ${commissionResult.reason}`
                );
              }
            } catch (commissionError) {
              // Don't fail the whole webhook for commission tracking issues
              console.error("[webhook] Commission recording failed:", commissionError);
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

          // 7. Eager Toothlens registration (safety net — usually already
          // provisioned by the Clerk user.created webhook, but DTC users
          // may complete checkout before that webhook lands).
          try {
            await convex.action(api.healthplans.toothlens.provisionForClerkUser, {
              clerkUserId,
              email: session.customer_email || undefined,
              name: session.customer_details?.name || undefined,
            });
          } catch (toothlensErr) {
            console.error("[webhook] Toothlens provisioning failed (non-fatal):", toothlensErr);
          }

          // 8. Email the member their fulfillment packet.
          //    Which packet depends on the product they bought. We read the
          //    member card data rather than rebuilding it here so the email,
          //    the portal download and the vendor eligibility files all quote
          //    the same identifiers.
          try {
            const memberEmail =
              session.customer_email || session.customer_details?.email || undefined;
            // @ts-ignore - avoid deep type instantiation
            const cardData: any = await convex.query(
              api.subscriptions.queries.getMemberCardDataPublic as any,
              { customerId: clerkUserId },
            );

            if (!cardData || !memberEmail) {
              console.warn(
                `[webhook] Skipping packet email — ${!memberEmail ? "no email on session" : "no member card data"} for ${clerkUserId}`,
              );
            } else {
              const memberFirstName =
                (session.customer_details?.name || cardData.memberName || "Member").split(" ")[0];

              // The PDFs are rendered here, in-process, and handed to the Convex
              // action. Letting the action fetch /api/generate-*-pdf instead is
              // a Convex→Next request that Vercel Deployment Protection blocks.
              // If in-process rendering fails, the action falls back to that fetch.
              if (isEssentialsSlug(cardData.productSlug)) {
                const packet = {
                  memberName: cardData.memberName,
                  memberFirstName,
                  memberEmail,
                  essentialsMemberNumber: cardData.essentialsMemberNumber,
                  essentialsGroupNumber: cardData.essentialsGroupNumber,
                  planName: cardData.planName,
                  coverageType: essentialsCoverageLabel(cardData.productSlug),
                  effectiveDate: cardData.effectiveDate,
                };
                let rendered: { pdfBase64?: string; agreementPdfBase64?: string } = {};
                try {
                  const { generateEssentialsPdfs } = await import("@/lib/generate-essentials-pdf");
                  const pdfs = await generateEssentialsPdfs({ ...packet });
                  rendered = { pdfBase64: pdfs.pdf, agreementPdfBase64: pdfs.agreementPdf };
                } catch (renderErr) {
                  console.error("[webhook] In-process Essentials PDF render failed; action will fetch:", renderErr);
                }
                await convex.action(
                  (api as any)["legal/emailFulfillment"].sendEssentialsPacketEmail,
                  { ...packet, ...rendered },
                );
              } else {
                const packet = {
                  memberName: cardData.memberName,
                  memberFirstName,
                  memberEmail,
                  memberId: cardData.memberId,
                  subscriberId: cardData.subscriberId,
                  groupCode: PROVIDER_GROUP_CODE,
                  planName: cardData.planName,
                  effectiveDate: cardData.effectiveDate,
                  networks: cardData.networks,
                };
                let rendered: { pdfBase64?: string; agreementPdfBase64?: string } = {};
                try {
                  const { generateFulfillmentPdfs } = await import("@/lib/generate-fulfillment-pdf");
                  const pdfs = await generateFulfillmentPdfs({ ...packet });
                  rendered = { pdfBase64: pdfs.pdf, agreementPdfBase64: pdfs.agreementPdf };
                } catch (renderErr) {
                  console.error("[webhook] In-process PDF render failed; action will fetch:", renderErr);
                }
                await convex.action(
                  (api as any)["legal/emailFulfillment"].sendFulfillmentPacketEmail,
                  { ...packet, ...rendered },
                );
              }
            }
          } catch (packetErr) {
            // Never fail the webhook over an email — Stripe would retry the
            // whole handler and we would double-create records.
            console.error("[webhook] Fulfillment packet email failed (non-fatal):", packetErr);
          }
        } catch (error) {
          console.error("[webhook] Error processing checkout.session.completed:", error);
          processingFailed = true;
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
          processingFailed = true;
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
          processingFailed = true;
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
          processingFailed = true;
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
          processingFailed = true;

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

    if (processingFailed) {
      // Non-2xx so Stripe retries delivery and surfaces this in its dashboard —
      // this only affects webhook retry/alerting, not the underlying charge/subscription.
      return NextResponse.json({ received: true, error: "Processing failed, see events log" }, { status: 500 });
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
