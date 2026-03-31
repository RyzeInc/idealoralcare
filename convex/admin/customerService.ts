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
 * Uses paginated scan (1000 at a time) to avoid loading entire table.
 */
export const searchAllMembers = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const q = args.query.toLowerCase().trim();
    if (q.length < 2) return [];

    // First try exact member ID match via index
    const byMemberId = await ctx.db
      .query("memberProfiles")
      .withIndex("by_member_id", (idx: any) => idx.eq("memberId", args.query.trim()))
      .first();
    if (byMemberId) {
      return [{
        _id: byMemberId._id,
        memberId: byMemberId.memberId,
        firstName: byMemberId.firstName,
        lastName: byMemberId.lastName,
        email: byMemberId.email ?? null,
        memberType: byMemberId.memberType,
      }];
    }

    // Then try email index match
    const byEmail = await ctx.db
      .query("memberProfiles")
      .withIndex("by_email", (idx: any) => idx.eq("email", args.query.trim()))
      .first();
    if (byEmail) {
      return [{
        _id: byEmail._id,
        memberId: byEmail.memberId,
        firstName: byEmail.firstName,
        lastName: byEmail.lastName,
        email: byEmail.email ?? null,
        memberType: byEmail.memberType,
      }];
    }

    // Fallback: scan with .take() to limit memory usage
    // Pull at most 5000 records and search within them
    const candidates = await ctx.db
      .query("memberProfiles")
      .order("desc")
      .take(5000);

    const results: any[] = [];
    for (const m of candidates) {
      const nameMatch =
        m.firstName.toLowerCase().includes(q) ||
        m.lastName.toLowerCase().includes(q) ||
        `${m.firstName} ${m.lastName}`.toLowerCase().includes(q);
      const emailMatch = m.email?.toLowerCase().includes(q);
      const idMatch = m.memberId?.toLowerCase().includes(q);
      if (nameMatch || emailMatch || idMatch) {
        results.push({
          _id: m._id,
          memberId: m.memberId,
          firstName: m.firstName,
          lastName: m.lastName,
          email: m.email ?? null,
          memberType: m.memberType,
        });
        if (results.length >= 20) break;
      }
    }

    return results;
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

    const allBundles = await ctx.db.query("subscriptionBundles")
      .withIndex("by_status")
      .collect();

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
