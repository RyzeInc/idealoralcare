/**
 * WEBHOOK ACTION MUTATIONS
 *
 * Mutations specifically designed for Stripe webhook handlers.
 * These are callable via ConvexHttpClient (no auth context).
 *
 * Security note: These mutations perform critical state changes.
 * In a future iteration, consider using Convex internalMutation
 * with httpAction for webhook handling to restrict access.
 * For now, these validate Stripe event context via bundleId lookup.
 */

import { mutation, query, internalQuery, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { internal, api } from "../_generated/api";

/**
 * Look up a subscription bundle by Stripe subscription ID
 * Used by webhook to find the Convex bundle for a Stripe event
 */
export const getBundleByStripeSubscription = query({
  args: {
    stripeSubscriptionId: v.string(),
  },
  handler: async (ctx, args) => {
    // Use index if available, otherwise filter
    const bundle = await ctx.db
      .query("subscriptionBundles")
      .filter((q) =>
        q.eq(q.field("stripeSubscriptionId"), args.stripeSubscriptionId)
      )
      .first();

    return bundle;
  },
});

/**
 * Cancel a bundle from a Stripe webhook event.
 * Sets bundle status to "cancelled" and records the reason.
 */
export const cancelBundleFromWebhook = mutation({
  args: {
    bundleId: v.id("subscriptionBundles"),
    reason: v.string(),
    stripeEventId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const bundle = await ctx.db.get(args.bundleId);
    if (!bundle) {
      throw new Error(`Bundle not found: ${args.bundleId}`);
    }

    // Idempotency: if already cancelled, skip
    if (bundle.status === "cancelled") {
      return bundle._id;
    }

    await ctx.db.patch(args.bundleId, {
      status: "cancelled",
      updatedAt: Date.now(),
      cancelledAt: Date.now(),
      cancellationReason: args.reason,
    });

    return bundle._id;
  },
});

/**
 * Revoke all entitlements for a bundle (subscription deleted/cancelled).
 * Sets all active entitlements to "revoked" status.
 */
export const revokeEntitlementsByBundle = mutation({
  args: {
    bundleId: v.id("subscriptionBundles"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const entitlements = await ctx.db
      .query("entitlements")
      .withIndex("by_bundle", (q) => q.eq("bundleId", args.bundleId))
      .collect();

    let revokedCount = 0;
    for (const entitlement of entitlements) {
      if (entitlement.status === "active" || entitlement.status === "cancel_at_period_end") {
        await ctx.db.patch(entitlement._id, {
          status: "revoked",
          revokedAt: Date.now(),
          endCondition: "expire",
          notes: args.reason,
        });
        revokedCount++;
      }
    }

    return { revokedCount, totalEntitlements: entitlements.length };
  },
});

/**
 * Suspend a bundle and its entitlements (payment failed).
 * Sets bundle to "past_due" and entitlements to "suspended".
 * Access can be restored when payment succeeds.
 */
export const suspendBundleFromWebhook = mutation({
  args: {
    bundleId: v.id("subscriptionBundles"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const bundle = await ctx.db.get(args.bundleId);
    if (!bundle) {
      throw new Error(`Bundle not found: ${args.bundleId}`);
    }

    // Don't suspend if already cancelled
    if (bundle.status === "cancelled") {
      return { suspended: false, reason: "Bundle already cancelled" };
    }

    // Update bundle status to past_due
    // Set pastDueAt only on first transition to past_due (for 3-day grace period logic)
    const now = Date.now();
    const pastDueAt =
      bundle.status === "past_due" ? bundle.pastDueAt : now;
    
    await ctx.db.patch(args.bundleId, {
      status: "past_due",
      updatedAt: now,
      pastDueAt,
    });

    // Suspend all active entitlements
    const entitlements = await ctx.db
      .query("entitlements")
      .withIndex("by_bundle", (q) => q.eq("bundleId", args.bundleId))
      .collect();

    let suspendedCount = 0;
    for (const entitlement of entitlements) {
      if (entitlement.status === "active") {
        await ctx.db.patch(entitlement._id, {
          status: "suspended",
          suspendedAt: Date.now(),
          notes: args.reason,
        });
        suspendedCount++;
      }
    }

    return { suspended: true, suspendedCount };
  },
});

/**
 * Reactivate a bundle from past_due to active (payment succeeded after failure)
 * Clears pastDueAt and reactivates suspended entitlements
 */
export const reactivateBundleFromWebhook = mutation({
  args: {
    bundleId: v.id("subscriptionBundles"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const bundle = await ctx.db.get(args.bundleId);
    if (!bundle) {
      throw new Error(`Bundle not found: ${args.bundleId}`);
    }

    // Only reactivate if currently past_due
    if (bundle.status !== "past_due") {
      return { reactivated: false, reason: `Bundle status is ${bundle.status}, not past_due` };
    }

    // Update bundle status back to active and clear pastDueAt
    await ctx.db.patch(args.bundleId, {
      status: "active",
      updatedAt: Date.now(),
      pastDueAt: undefined,
    });

    // Reactivate all suspended entitlements
    const entitlements = await ctx.db
      .query("entitlements")
      .withIndex("by_bundle", (q) => q.eq("bundleId", args.bundleId))
      .collect();

    let reactivatedCount = 0;
    for (const entitlement of entitlements) {
      if (entitlement.status === "suspended") {
        await ctx.db.patch(entitlement._id, {
          status: "active",
          notes: args.reason,
        });
        reactivatedCount++;
      }
    }

    return { reactivated: true, reactivatedCount };
  },
});

/**
 * Create dependent member profiles after a successful checkout that included
 * family members. Called by the Stripe webhook handler.
 *
 * Accepts the primary member's profile ID and a JSON-encoded array of
 * dependent data (as stored in Stripe session metadata).
 */
export const webhookCreateDependentProfiles = mutation({
  args: {
    primaryMemberProfileId: v.id("memberProfiles"),
    dependentsJson: v.string(), // JSON array of dependent objects
  },
  handler: async (ctx, args) => {
    let dependents: Array<{
      firstName: string;
      lastName: string;
      email: string;
      dateOfBirth?: string;
      relationship: "spouse" | "child" | "domestic_partner" | "other";
    }>;

    try {
      dependents = JSON.parse(args.dependentsJson);
    } catch {
      throw new Error("Invalid dependentsJson: must be valid JSON");
    }

    if (!Array.isArray(dependents) || dependents.length === 0) return { created: 0 };

    const results: Array<{ dependentId: string; inviteToken: string }> = [];

    for (const dep of dependents) {
      if (!dep.firstName || !dep.lastName || !dep.email) continue;

      const result = await ctx.runMutation(
        internal.enrollment.dependents.internalAddDependent,
        {
          primaryMemberProfileId: args.primaryMemberProfileId,
          firstName: dep.firstName,
          lastName: dep.lastName,
          email: dep.email,
          dateOfBirth: dep.dateOfBirth,
          relationship: dep.relationship ?? "other",
        }
      );
      results.push({ dependentId: result.dependentId.toString(), inviteToken: result.inviteToken });
    }

    return { created: results.length, results };
  },
});

/**
 * Mark a bundle as cancel_at_period_end (user requested cancellation).
 * Access continues through the current billing period.
 * When Stripe fires customer.subscription.deleted, the webhook handler
 * will flip status to "cancelled" and revoke entitlements.
 */
export const markCancelAtPeriodEnd = mutation({
  args: {
    bundleId: v.id("subscriptionBundles"),
    cancelAtPeriodEnd: v.boolean(),
  },
  handler: async (ctx, args) => {
    const bundle = await ctx.db.get(args.bundleId);
    if (!bundle) {
      throw new Error(`Bundle not found: ${args.bundleId}`);
    }

    if (args.cancelAtPeriodEnd) {
      await ctx.db.patch(args.bundleId, {
        status: "cancel_at_period_end",
        updatedAt: Date.now(),
      });
    } else {
      // Re-enable: undo cancel_at_period_end
      await ctx.db.patch(args.bundleId, {
        status: "active",
        updatedAt: Date.now(),
      });
    }

    return bundle._id;
  },
});

/**
 * Process an immediate tier change (upgrade).
 * Expires the old entitlement, creates a new one for the target product,
 * and updates the bundle's pricing snapshot.
 */
export const processTierChange = mutation({
  args: {
    bundleId: v.id("subscriptionBundles"),
    customerId: v.string(),
    oldProductId: v.id("catalogProducts"),
    newProductId: v.id("catalogProducts"),
    newTotalCents: v.number(),
    direction: v.union(v.literal("upgrade"), v.literal("downgrade")),
    stripeSubscriptionItemId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const bundle = await ctx.db.get(args.bundleId);
    if (!bundle) throw new Error(`Bundle not found: ${args.bundleId}`);

    // 1. Expire old entitlements for the old product
    const oldEntitlements = await ctx.db
      .query("entitlements")
      .withIndex("by_bundle", (q) => q.eq("bundleId", args.bundleId))
      .collect();

    for (const ent of oldEntitlements) {
      if (
        ent.productId === args.oldProductId &&
        (ent.status === "active" || ent.status === "cancel_at_period_end")
      ) {
        await ctx.db.patch(ent._id, {
          status: "expired",
          revokedAt: now,
          notes: `Tier ${args.direction}: replaced by new plan`,
        });
      }
    }

    // 2. Create new entitlement for the target product
    await ctx.db.insert("entitlements", {
      customerId: args.customerId,
      bundleId: args.bundleId,
      productId: args.newProductId,
      periodStart: bundle.currentPeriodStart,
      periodEnd: bundle.currentPeriodEnd,
      status: "active",
      endCondition: "renew",
      stripeSubscriptionItemId: args.stripeSubscriptionItemId,
      createdAt: now,
      activatedAt: now,
      expiresAt: bundle.currentPeriodEnd,
      createdVia: "plan_addition",
      notes: `Tier ${args.direction} from previous plan`,
    });

    // 3. Update bundle pricing snapshot
    await ctx.db.patch(args.bundleId, {
      updatedAt: now,
      pricingSnapshot: {
        cadence: bundle.cadence,
        paymentMethod: bundle.paymentMethod,
        totalCents: args.newTotalCents,
        planCount: bundle.pricingSnapshot.planCount,
        capturedAt: now,
      },
    });

    return { success: true, direction: args.direction };
  },
});

/**
 * Schedule a tier downgrade to take effect at period end.
 * Records the pending downgrade on the bundle so the UI can show it.
 * The actual swap happens when Stripe fires subscription.updated at renewal.
 */
export const scheduleTierDowngrade = mutation({
  args: {
    bundleId: v.id("subscriptionBundles"),
    customerId: v.string(),
    targetProductId: v.id("catalogProducts"),
    targetTotalCents: v.number(),
    effectiveDate: v.number(), // Unix ms
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const bundle = await ctx.db.get(args.bundleId);
    if (!bundle) throw new Error(`Bundle not found: ${args.bundleId}`);

    // Store pending downgrade info on the bundle
    await ctx.db.patch(args.bundleId, {
      updatedAt: now,
      pendingDowngrade: {
        targetProductId: args.targetProductId,
        targetTotalCents: args.targetTotalCents,
        effectiveDate: args.effectiveDate,
        scheduledAt: now,
      },
    });

    return { success: true, effectiveDate: args.effectiveDate };
  },
});

/**
 * Clear the pendingDowngrade field after a scheduled downgrade has been applied.
 */
export const clearPendingDowngrade = mutation({
  args: {
    bundleId: v.id("subscriptionBundles"),
  },
  handler: async (ctx, args) => {
    const bundle = await ctx.db.get(args.bundleId);
    if (!bundle) throw new Error(`Bundle not found: ${args.bundleId}`);

    await ctx.db.patch(args.bundleId, {
      updatedAt: Date.now(),
      pendingDowngrade: undefined,
    });

    return { success: true };
  },
});

/**
 * Look up minimal member info by Clerk customerId for webhook-driven emails.
 * Returns only the fields needed to send a cancellation email.
 * Called without auth context from the Stripe webhook handler.
 */
export const getMemberForCancellation = query({
  args: { customerId: v.string() },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("memberProfiles")
      .withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
      .first();

    if (!profile) return null;
    // Return the member-facing ID (matches what we send to Careington/DialCare),
    // not the raw internal memberId, so cancellation emails show the correct ID.
    const memberFacingId: string =
      (profile as any).careingtonUniqueId ??
      profile.memberId.replace(/[^0-9]/g, "").slice(0, 12);
    return {
      memberId: memberFacingId,
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email ?? null,
    };
  },
});

// ---------------------------------------------------------------------------
// STRIPE ↔ CONVEX RECONCILIATION
//
// Webhooks are the primary way bundle/entitlement state is kept in sync with
// Stripe, but webhook delivery is not guaranteed (endpoint downtime, missed
// events, one-off manual fixes, etc.). This reconciliation pass is a safety
// net: it re-checks every bundle Convex still considers "live" against the
// actual Stripe subscription status and self-heals any drift, so a member
// who has stopped paying (or whose subscription Stripe already cancelled)
// doesn't stay marked active indefinitely.
// ---------------------------------------------------------------------------

/**
 * List every bundle that Convex currently considers "live" (i.e. we still
 * expect Stripe to be billing it) and that has a Stripe subscription to
 * check against. Used by the reconciliation action.
 */
export const listReconcilableBundles = internalQuery({
  args: {},
  handler: async (ctx) => {
    const liveStatuses = ["active", "past_due", "cancel_at_period_end"] as const;
    const bundles = [];
    for (const status of liveStatuses) {
      const rows = await ctx.db
        .query("subscriptionBundles")
        .withIndex("by_status", (q) => q.eq("status", status))
        .collect();
      bundles.push(...rows);
    }
    // Only real Stripe subscriptions can be checked against the Stripe API.
    // Comp/free-access bundles (grantFreeAccess.ts) use a synthetic
    // "free_<timestamp>" stripeSubscriptionId and must never be sent to
    // Stripe — they'd come back "not found" and be wrongly cancelled.
    return bundles.filter((b) => b.stripeSubscriptionId?.startsWith("sub_"));
  },
});

/**
 * Apply the outcome of comparing one bundle's Convex status against its
 * real Stripe subscription status. Reuses the exact same status-transition
 * semantics as the live webhook handlers (suspend/cancel/reactivate), so a
 * reconciliation correction is indistinguishable from one driven by a
 * (delayed) webhook.
 */
export const applyReconciliationOutcome = internalMutation({
  args: {
    bundleId: v.id("subscriptionBundles"),
    stripeStatus: v.string(),
    currentPeriodStart: v.number(), // Unix ms; 0 if Stripe didn't report one
    currentPeriodEnd: v.number(), // Unix ms; 0 if Stripe didn't report one
  },
  handler: async (ctx, args) => {
    const bundle = await ctx.db.get(args.bundleId);
    if (!bundle) return { action: "none", reason: "bundle_not_found" };

    const now = Date.now();
    const previousStatus = bundle.status;
    const stripeIsDead = ["canceled", "unpaid", "incomplete_expired"].includes(args.stripeStatus);
    const stripeIsPastDue = args.stripeStatus === "past_due";
    const stripeIsLive = ["active", "trialing"].includes(args.stripeStatus);

    const logCorrection = async (action: string, extra?: Record<string, unknown>) => {
      await ctx.runMutation(api.subscriptions.mutations.webhookLogEvent, {
        eventType: "stripe_reconcile.corrected",
        actor: "system",
        customerId: bundle.customerId,
        bundleId: bundle._id,
        stripeObjectId: bundle.stripeSubscriptionId,
        payload: { action, previousStatus, stripeStatus: args.stripeStatus, ...extra },
        success: true,
        idempotencyKey: `reconcile_${bundle._id}_${now}`,
      });
    };

    // 1. Stripe considers the subscription dead, but Convex still thinks
    //    it's live — the case where a member stopped paying and no webhook
    //    (or a failed one) ever cancelled the bundle on our side.
    if (stripeIsDead && previousStatus !== "cancelled") {
      await ctx.db.patch(bundle._id, {
        status: "cancelled",
        updatedAt: now,
        cancelledAt: now,
        cancellationReason: `Reconciliation: Stripe subscription status is "${args.stripeStatus}"`,
      });

      const entitlements = await ctx.db
        .query("entitlements")
        .withIndex("by_bundle", (q) => q.eq("bundleId", bundle._id))
        .collect();

      let revokedCount = 0;
      for (const entitlement of entitlements) {
        if (["active", "cancel_at_period_end", "suspended"].includes(entitlement.status)) {
          await ctx.db.patch(entitlement._id, {
            status: "revoked",
            revokedAt: now,
            endCondition: "expire",
            notes: `Reconciliation: Stripe subscription ${args.stripeStatus}`,
          });
          revokedCount++;
        }
      }

      await logCorrection("cancelled", { revokedCount });
      return { action: "cancelled", previousStatus, revokedCount };
    }

    // 2. Stripe says payment is failing (past_due) but Convex still shows
    //    active — suspend the bundle and its entitlements, mirroring
    //    invoice.payment_failed.
    if (stripeIsPastDue && previousStatus === "active") {
      await ctx.db.patch(bundle._id, {
        status: "past_due",
        updatedAt: now,
        pastDueAt: bundle.pastDueAt ?? now,
      });

      const entitlements = await ctx.db
        .query("entitlements")
        .withIndex("by_bundle", (q) => q.eq("bundleId", bundle._id))
        .collect();

      let suspendedCount = 0;
      for (const entitlement of entitlements) {
        if (entitlement.status === "active") {
          await ctx.db.patch(entitlement._id, {
            status: "suspended",
            suspendedAt: now,
            notes: "Reconciliation: Stripe subscription past_due",
          });
          suspendedCount++;
        }
      }

      await logCorrection("suspended", { suspendedCount });
      return { action: "suspended", previousStatus, suspendedCount };
    }

    // 3. Stripe says the subscription recovered (active/trialing) but Convex
    //    still shows past_due — reactivate, mirroring invoice.payment_succeeded.
    if (stripeIsLive && previousStatus === "past_due") {
      await ctx.db.patch(bundle._id, {
        status: "active",
        updatedAt: now,
        pastDueAt: undefined,
      });

      const entitlements = await ctx.db
        .query("entitlements")
        .withIndex("by_bundle", (q) => q.eq("bundleId", bundle._id))
        .collect();

      let reactivatedCount = 0;
      for (const entitlement of entitlements) {
        if (entitlement.status === "suspended") {
          await ctx.db.patch(entitlement._id, {
            status: "active",
            notes: "Reconciliation: Stripe subscription recovered",
          });
          reactivatedCount++;
        }
      }

      await logCorrection("reactivated", { reactivatedCount });
      return { action: "reactivated", previousStatus, reactivatedCount };
    }

    // 4. Status already agrees — just keep the renewal-date bookkeeping
    //    fresh so the admin UI doesn't show a stale period forever.
    if (
      stripeIsLive &&
      previousStatus === "active" &&
      args.currentPeriodEnd > 0 &&
      (bundle.currentPeriodStart !== args.currentPeriodStart ||
        bundle.currentPeriodEnd !== args.currentPeriodEnd)
    ) {
      await ctx.db.patch(bundle._id, {
        currentPeriodStart: args.currentPeriodStart,
        currentPeriodEnd: args.currentPeriodEnd,
        updatedAt: now,
      });
      return { action: "period_synced", previousStatus };
    }

    return { action: "none", previousStatus };
  },
});
