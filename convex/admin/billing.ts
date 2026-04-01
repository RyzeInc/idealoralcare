import { query, action, mutation } from "../_generated/server";
import { v } from "convex/values";
// @ts-ignore - Type instantiation too deep
import { api as apiOriginal } from "../_generated/api";
import { requireAdmin, requireAdminAction } from "../lib/authGuards";

const getApi = () => {
  // @ts-ignore - Type instantiation too deep
  return apiOriginal as any;
};

/**
 * LIST-BILL DATA BRIDGE
 *
 * Generate billing summaries for E123 import.
 * No invoice payment collection — just the data feed E123 needs.
 */

/**
 * Get billing summaries for all groups
 * Cross-references subscriptionBundles to distinguish paid vs free members
 */
export const getAllGroupBillingSummaries = query({
  handler: async (ctx) => {
    const groups = await ctx.db.query("groups").collect();
    const allBundles = await ctx.db.query("subscriptionBundles").collect();

    // Build a set of customerIds with paid active subscriptions (totalCents > 0)
    const paidCustomerIds = new Set<string>();
    for (const bundle of allBundles) {
      if (
        bundle.status === "active" &&
        bundle.pricingSnapshot?.totalCents > 0
      ) {
        paidCustomerIds.add(bundle.customerId);
      }
    }

    const summaries = [];
    const DEFAULT_RATE = 15.0;

    for (const group of groups) {
      // Look up billing rate: account.billingDetails.perMemberRateCents, else default
      const account = await ctx.db.get(group.accountId);
      const rateFromAccount = (account as any)?.billingDetails?.perMemberRateCents;
      const PAID_RATE = rateFromAccount ? rateFromAccount / 100 : DEFAULT_RATE;

      const members = await ctx.db
        .query("memberProfiles")
        .filter(
          (q) =>
            q.and(
              q.eq(q.field("groupId"), group._id),
              q.eq(q.field("memberType"), "active")
            )
        )
        .collect();

      let paidCount = 0;
      let freeCount = 0;

      for (const member of members) {
        if (member.customerId && paidCustomerIds.has(member.customerId)) {
          paidCount++;
        } else {
          freeCount++;
        }
      }

      const totalAmount = paidCount * PAID_RATE;

      summaries.push({
        groupId: group._id,
        accountId: group.accountId,
        groupName: (group as any).name ?? group.slug,
        groupCode: group.groupCode,
        memberCount: members.length,
        paidCount,
        freeCount,
        ratePerMember: PAID_RATE,
        totalAmount,
      });
    }

    return summaries;
  },
});

/**
 * Get members for a specific group with their billing status (paid/free)
 */
export const getGroupMembersWithBillingStatus = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const members = await ctx.db
      .query("memberProfiles")
      .filter(
        (q) =>
          q.and(
            q.eq(q.field("groupId"), args.groupId),
            q.eq(q.field("memberType"), "active")
          )
      )
      .collect();

    const result = [];
    for (const member of members) {
      let billingType: "paid" | "free" = "free";
      let bundleInfo: any = null;

      if (member.customerId) {
        const bundle = (await ctx.db.query("subscriptionBundles").collect()).find(
          (b) =>
            b.customerId === member.customerId &&
            b.status === "active"
        );
        if (bundle && bundle.pricingSnapshot?.totalCents > 0) {
          billingType = "paid";
          bundleInfo = {
            cadence: bundle.cadence,
            totalCents: bundle.pricingSnapshot.totalCents,
            currentPeriodEnd: bundle.currentPeriodEnd,
            stripeSubscriptionId: bundle.stripeSubscriptionId,
          };
        }
      }

      result.push({
        _id: member._id,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
        memberId: member.memberId,
        memberType: member.memberType,
        enrolledAt: member.enrolledAt,
        billingType,
        bundleInfo,
      });
    }

    return result;
  },
});

/**
 * Get billing summary for a single group
 */
export const getGroupBillingSummary = query({
  args: {
    groupId: v.id("groups"),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group) throw new Error("Group not found");

    // Get all active members
    const members = await ctx.db
      .query("memberProfiles")
      .filter(
        (q) =>
          q.and(
            q.eq(q.field("groupId"), args.groupId),
            q.eq(q.field("memberType"), "active")
          )
      )
      .collect();

    // Assume standard plan price of $15/month (or get from plan pricing)
    const memberPrice = 15.0; // Default; could look up actual plan price
    const totalAmount = members.length * memberPrice;

    const currentDate = new Date();
    const billingPeriodStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const billingPeriodEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    return {
      groupId: args.groupId,
      groupName: group.slug,
      groupCode: group.groupCode,
      memberCount: members.length,
      ratePerMember: memberPrice,
      totalAmount,
      billingPeriodStart: billingPeriodStart.toISOString().split("T")[0],
      billingPeriodEnd: billingPeriodEnd.toISOString().split("T")[0],
      currency: "USD",
    };
  },
});

/**
 * Get billing summary for entire account
 */
export const getAccountBillingSummary = query({
  args: {
    accountId: v.id("accounts"),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account) throw new Error("Account not found");

    // Get all groups for this account
    const groups = await ctx.db
      .query("groups")
      .filter((q) => q.eq(q.field("accountId"), args.accountId))
      .collect();

    const groupSummaries = [];
    let totalMembers = 0;
    let totalAmount = 0;

    for (const group of groups) {
      const members = await ctx.db
        .query("memberProfiles")
        .filter(
          (q) =>
            q.and(
              q.eq(q.field("groupId"), group._id),
              q.eq(q.field("memberType"), "active")
            )
        )
        .collect();

      const memberPrice = 15.0;
      const groupAmount = members.length * memberPrice;

      groupSummaries.push({
        groupId: group._id,
        groupName: group.slug,
        groupCode: group.groupCode,
        memberCount: members.length,
        ratePerMember: memberPrice,
        totalAmount: groupAmount,
      });

      totalMembers += members.length;
      totalAmount += groupAmount;
    }

    const currentDate = new Date();
    const billingPeriodStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const billingPeriodEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    return {
      accountId: args.accountId,
      accountName: account.slug,
      groupCount: groups.length,
      totalMembers,
      totalAmount,
      billingPeriodStart: billingPeriodStart.toISOString().split("T")[0],
      billingPeriodEnd: billingPeriodEnd.toISOString().split("T")[0],
      currency: "USD",
      groupSummaries,
    };
  },
});

/**
 * Generate billing CSV for E123 import
 * Columns: group_code, group_name, member_count, rate_per_member, total_amount, period_start, period_end
 */
export const generateBillingCsv: any = action({
  args: {
    accountId: v.id("accounts"),
  },
  handler: async (ctx, args) => {
    const api = getApi();
    // @ts-ignore - Avoid deep type instantiation issue with api.admin.adminUsers.isAdmin
    await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);
    const summary = await ctx.runQuery(api.admin.billing.getAccountBillingSummary, { accountId: args.accountId });

    let csv =
      "group_code,group_name,member_count,rate_per_member,total_amount,period_start,period_end\n";

    for (const group of summary.groupSummaries) {
      csv += `"${group.groupCode}","${group.groupName}",${group.memberCount},${group.ratePerMember},${group.totalAmount},"${summary.billingPeriodStart}","${summary.billingPeriodEnd}"\n`;
    }

    const filename = `billing_${summary.accountName}_${summary.billingPeriodStart}.csv`;

    return {
      filename,
      content: csv,
      accountCode: summary.accountName,
      billingPeriod: `${summary.billingPeriodStart} to ${summary.billingPeriodEnd}`,
      groupCount: summary.groupCount,
      totalMembers: summary.totalMembers,
      totalAmount: summary.totalAmount,
      generatedAt: Date.now(),
    };
  },
});

/**
 * Get site billing summary (all accounts and groups)
 */
export const getSiteBillingSummary = query({
  args: {
    siteId: v.id("sites"),
  },
  handler: async (ctx, args) => {
    const site = await ctx.db.get(args.siteId);
    if (!site) throw new Error("Site not found");

    // Get all accounts and groups
    const accounts = await ctx.db
      .query("accounts")
      .filter((q) => q.eq(q.field("siteId"), args.siteId))
      .collect();

    let totalMembers = 0;
    let totalAmount = 0;
    const accountSummaries = [];

    for (const account of accounts) {
      const groups = await ctx.db
        .query("groups")
        .filter((q) => q.eq(q.field("accountId"), account._id))
        .collect();

      let accountMembers = 0;
      let accountAmount = 0;

      for (const group of groups) {
        const members = await ctx.db
          .query("memberProfiles")
          .filter(
            (q) =>
              q.and(
                q.eq(q.field("groupId"), group._id),
                q.eq(q.field("memberType"), "active")
              )
          )
          .collect();

        const memberPrice = 15.0;
        accountMembers += members.length;
        accountAmount += members.length * memberPrice;
      }

      accountSummaries.push({
        accountId: account._id,
        accountName: account.slug,
        accountType: account.accountType,
        groupCount: groups.length,
        memberCount: accountMembers,
        totalAmount: accountAmount,
      });

      totalMembers += accountMembers;
      totalAmount += accountAmount;
    }

    return {
      siteId: args.siteId,
      siteName: site.slug,
      accountCount: accounts.length,
      totalMembers,
      totalAmount,
      accountSummaries,
    };
  },
});

/**
 * Get upcoming billing dates for admin calendar
 */
export const getUpcomingBillingDates = query({
  handler: async (ctx) => {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    // Assuming monthly billing on the 1st
    const dates = [];

    // Current month
    const currentMonthEnd = new Date(currentYear, currentMonth + 1, 0);
    if (currentDate.getDate() <= currentMonthEnd.getDate()) {
      dates.push({
        month: currentMonth + 1,
        year: currentYear,
        dueDate: new Date(currentYear, currentMonth + 1, 1).toISOString().split("T")[0],
        status: "upcoming",
      });
    }

    // Next 3 months
    for (let i = 1; i <= 3; i++) {
      const nextMonth = currentMonth + i;
      const nextYear = nextMonth > 11 ? currentYear + 1 : currentYear;
      const adjustedMonth = nextMonth % 12;

      dates.push({
        month: adjustedMonth + 1,
        year: nextYear,
        dueDate: new Date(nextYear, adjustedMonth + 1, 1).toISOString().split("T")[0],
        status: "scheduled",
      });
    }

    return {
      billingCycle: "monthly",
      billingDay: 1,
      upcomingDates: dates,
    };
  },
});

// ============================================================
// LIST-BILL FUNCTIONS (FT/payroll-deduction employer groups)
// ============================================================

/**
 * Get all groups configured for list-bill (payroll deduction).
 */
export const getListBillGroups = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const groups = await ctx.db.query("groups").collect();
    return groups.filter((g: any) => g.listBill?.enabled === true);
  },
});

/**
 * Get a monthly list-bill summary for all list-bill groups.
 * Returns member count, rate, total, and payment status for a given billing period.
 */
export const getListBillMonthlySummary = query({
  args: {
    billingPeriod: v.string(), // "YYYY-MM"
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const groups = await ctx.db.query("groups").collect();
    const listBillGroups = groups.filter((g: any) => g.listBill?.enabled === true);

    const DEFAULT_RATE_CENTS = 1500; // $15.00
    const results = [];

    for (const group of listBillGroups) {
      const account = await ctx.db.get(group.accountId);
      const ratePerMemberCents =
        (account as any)?.billingDetails?.perMemberRateCents ?? DEFAULT_RATE_CENTS;

      // Count active list-bill (FT) members in the group
      const members = await ctx.db
        .query("memberProfiles")
        .withIndex("by_group", (q: any) => q.eq("groupId", group._id))
        .filter((q) =>
          q.and(
            q.eq(q.field("memberType"), "active"),
            q.eq(q.field("employeeType"), "full_time")
          )
        )
        .collect();

      const memberCount = members.length;
      const totalCents = memberCount * ratePerMemberCents;

      // Check if a payment record already exists for this period
      const existingPayment = await ctx.db
        .query("listBillPayments")
        .withIndex("by_group_period", (q: any) =>
          q.eq("groupId", group._id).eq("billingPeriod", args.billingPeriod)
        )
        .first();

      results.push({
        groupId: group._id,
        accountId: group.accountId,
        groupName: (group as any).name ?? group.slug,
        groupCode: group.groupCode,
        listBillConfig: (group as any).listBill,
        memberCount,
        ratePerMemberCents,
        totalCents,
        billingPeriod: args.billingPeriod,
        payment: existingPayment ?? null,
      });
    }

    return results;
  },
});

/**
 * Create or update a list-bill payment record for a group/period.
 */
export const recordListBillPayment = mutation({
  args: {
    groupId: v.id("groups"),
    billingPeriod: v.string(), // "YYYY-MM"
    paymentMethod: v.union(v.literal("check"), v.literal("ach")),
    paymentStatus: v.union(
      v.literal("pending"),
      v.literal("paid"),
      v.literal("partial"),
      v.literal("overdue")
    ),
    memberCount: v.number(),
    ratePerMemberCents: v.number(),
    totalCents: v.number(),
    checkNumber: v.optional(v.string()),
    checkDate: v.optional(v.string()),
    achConfirmationNumber: v.optional(v.string()),
    amountReceivedCents: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const group = await ctx.db.get(args.groupId);
    if (!group) throw new Error("Group not found");

    const now = Date.now();

    // Derive period start/end from "YYYY-MM"
    const [year, month] = args.billingPeriod.split("-").map(Number);
    const periodStart = new Date(year, month - 1, 1).getTime();
    const periodEnd = new Date(year, month, 0, 23, 59, 59, 999).getTime();

    const remainingCents =
      args.amountReceivedCents !== undefined
        ? Math.max(0, args.totalCents - args.amountReceivedCents)
        : undefined;

    const existing = await ctx.db
      .query("listBillPayments")
      .withIndex("by_group_period", (q: any) =>
        q.eq("groupId", args.groupId).eq("billingPeriod", args.billingPeriod)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        paymentMethod: args.paymentMethod,
        paymentStatus: args.paymentStatus,
        memberCount: args.memberCount,
        ratePerMemberCents: args.ratePerMemberCents,
        totalCents: args.totalCents,
        checkNumber: args.checkNumber,
        checkDate: args.checkDate,
        achConfirmationNumber: args.achConfirmationNumber,
        amountReceivedCents: args.amountReceivedCents,
        remainingCents,
        notes: args.notes,
        updatedAt: now,
        paidAt: args.paymentStatus === "paid" ? now : existing.paidAt,
      });
      return existing._id;
    }

    return await ctx.db.insert("listBillPayments", {
      groupId: args.groupId,
      accountId: group.accountId,
      siteId: group.siteId,
      billingPeriod: args.billingPeriod,
      periodStart,
      periodEnd,
      memberCount: args.memberCount,
      ratePerMemberCents: args.ratePerMemberCents,
      totalCents: args.totalCents,
      paymentMethod: args.paymentMethod,
      paymentStatus: args.paymentStatus,
      checkNumber: args.checkNumber,
      checkDate: args.checkDate,
      achConfirmationNumber: args.achConfirmationNumber,
      amountReceivedCents: args.amountReceivedCents,
      remainingCents,
      notes: args.notes,
      createdAt: now,
      updatedAt: now,
      paidAt: args.paymentStatus === "paid" ? now : undefined,
    });
  },
});

/**
 * Get payment history for a list-bill group.
 */
export const getListBillPaymentHistory = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("listBillPayments")
      .withIndex("by_group", (q: any) => q.eq("groupId", args.groupId))
      .order("desc")
      .collect();
  },
});

/**
 * Generate a list-bill invoice CSV for a given billing period.
 */
export const generateListBillInvoiceCsv: any = action({
  args: {
    billingPeriod: v.string(), // "YYYY-MM"
  },
  handler: async (ctx, args) => {
    const api = getApi();
    // @ts-ignore
    await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);

    const summaries = await ctx.runQuery(
      api.admin.billing.getListBillMonthlySummary,
      { billingPeriod: args.billingPeriod }
    );

    let csv =
      "group_code,group_name,billing_period,member_count,rate_per_member,total_amount,payment_method,payment_status\n";

    for (const s of summaries) {
      const rate = (s.ratePerMemberCents / 100).toFixed(2);
      const total = (s.totalCents / 100).toFixed(2);
      const payMethod = s.listBillConfig?.paymentMethod ?? "check";
      const payStatus = s.payment?.paymentStatus ?? "pending";
      csv += `"${s.groupCode}","${s.groupName}","${args.billingPeriod}",${s.memberCount},${rate},${total},"${payMethod}","${payStatus}"\n`;
    }

    return {
      filename: `list_bill_invoice_${args.billingPeriod}.csv`,
      content: csv,
      billingPeriod: args.billingPeriod,
      groupCount: summaries.length,
      generatedAt: Date.now(),
    };
  },
});
