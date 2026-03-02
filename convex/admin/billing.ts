import { query, action } from "../_generated/server";
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
 */
export const getAllGroupBillingSummaries = query({
  handler: async (ctx) => {
    const groups = await ctx.db.query("groups").collect();
    const summaries = [];

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
      const totalAmount = members.length * memberPrice;

      summaries.push({
        groupId: group._id,
        groupName: group.slug,
        groupCode: group.groupCode,
        memberCount: members.length,
        ratePerMember: memberPrice,
        totalAmount,
      });
    }

    return summaries;
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
