/* eslint-disable @typescript-eslint/no-explicit-any */
import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "../lib/authGuards";

/**
 * ADMIN CUSTOMER SERVICE QUERIES
 *
 * Data access for the Customer Service admin panel.
 * Surfaces subscription, billing, and financial details
 * needed for cancellation handling and financial reporting.
 */

/**
 * Global member search across all groups.
 * Matches on name, email, or member ID — returns up to 20 results.
 */
export const searchAllMembers = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const q = args.query.toLowerCase().trim();
    if (q.length < 2) return [];

    const all = await ctx.db.query("memberProfiles").order("desc").collect();

    return all
      .filter((m) => {
        const nameMatch =
          m.firstName.toLowerCase().includes(q) ||
          m.lastName.toLowerCase().includes(q) ||
          `${m.firstName} ${m.lastName}`.toLowerCase().includes(q);
        const emailMatch = m.email?.toLowerCase().includes(q);
        const idMatch = m.memberId?.toLowerCase().includes(q);
        return nameMatch || emailMatch || idMatch;
      })
      .slice(0, 20)
      .map((m) => ({
        _id: m._id,
        memberId: m.memberId,
        firstName: m.firstName,
        lastName: m.lastName,
        email: m.email ?? null,
        memberType: m.memberType,
      }));
  },
});

/**
 * Get a member's full profile + active subscription bundle details.
 * Powers the CS member detail view and is called by the admin-cancel API route.
 */
export const getMemberWithSubscription = query({
  args: { memberProfileId: v.id("memberProfiles") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const member = await ctx.db.get(args.memberProfileId);
    if (!member) return null;

    let bundle: any = null;
    if (member.customerId) {
      // Get most recent bundle for this customer
      bundle = await ctx.db
        .query("subscriptionBundles")
        .filter((q) => q.eq(q.field("customerId"), member.customerId))
        .order("desc")
        .first();
    }

    // Get the group + account names for context
    const group = await ctx.db.get(member.groupId);
    const account = await ctx.db.get(member.accountId);

    return {
      member: {
        _id: member._id,
        memberId: member.memberId,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email ?? null,
        phone: member.phone ?? null,
        memberType: member.memberType,
        enrolledAt: member.enrolledAt ?? null,
        customerId: member.customerId ?? null,
      },
      bundle: bundle
        ? {
            _id: bundle._id,
            status: bundle.status,
            cadence: bundle.cadence,
            paymentMethod: bundle.paymentMethod,
            stripeCustomerId: bundle.stripeCustomerId,
            stripeSubscriptionId: bundle.stripeSubscriptionId,
            totalCents: bundle.pricingSnapshot?.totalCents ?? 0,
            currentPeriodStart: bundle.currentPeriodStart ?? null,
            currentPeriodEnd: bundle.currentPeriodEnd ?? null,
            cancelledAt: bundle.cancelledAt ?? null,
            pastDueAt: bundle.pastDueAt ?? null,
            createdAt: bundle.createdAt ?? null,
          }
        : null,
      groupName: (group as any)?.name ?? (group as any)?.slug ?? null,
      groupCode: (group as any)?.groupCode ?? null,
      accountName: (account as any)?.name ?? null,
    };
  },
});

/**
 * Get financial summary metrics for the CS dashboard header.
 * Returns active member count, MRR, past-due count, and
 * cancellations in the current calendar month.
 */
export const getFinancialSummary = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const allBundles = await ctx.db.query("subscriptionBundles").collect();

    const now = Date.now();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthStartMs = monthStart.getTime();

    let activePaidCount = 0;
    let totalMrrCents = 0;
    let pastDueCount = 0;
    let cancelledThisMonthCount = 0;
    let cancelAtPeriodEndCount = 0;

    for (const bundle of allBundles) {
      if (bundle.status === "active" && (bundle.pricingSnapshot?.totalCents ?? 0) > 0) {
        activePaidCount++;
        // Normalise to monthly
        const cents = bundle.pricingSnapshot?.totalCents ?? 0;
        const cadence = bundle.cadence ?? "monthly";
        totalMrrCents += cadence === "annual" ? Math.round(cents / 12) : cents;
      }
      if (bundle.status === "past_due") {
        pastDueCount++;
      }
      if (bundle.status === "cancel_at_period_end") {
        cancelAtPeriodEndCount++;
      }
      if (
        bundle.status === "cancelled" &&
        (bundle as any).cancelledAt &&
        (bundle as any).cancelledAt >= monthStartMs
      ) {
        cancelledThisMonthCount++;
      }
    }

    return {
      activePaidCount,
      totalMrrCents,
      pastDueCount,
      cancelledThisMonthCount,
      cancelAtPeriodEndCount,
    };
  },
});
