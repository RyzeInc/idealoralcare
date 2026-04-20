import { query } from "../_generated/server";
import { v } from "convex/values";

/**
 * Bulk lookup: given an array of Clerk user IDs, return their
 * admin status and dashboard (subscription/entitlement) status.
 */
export const getUserStatuses = query({
  args: {
    clerkUserIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const results: Record<
      string,
      {
        isAdmin: boolean;
        adminRole?: string;
        hasDashboard: boolean;
        subscriptionStatus?: string;
        entitlementCount: number;
      }
    > = {};

    for (const clerkId of args.clerkUserIds) {
      // Check admin status
      const admin = await ctx.db
        .query("adminUsers")
        .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", clerkId))
        .first();

      // Check subscription bundle
      const bundle = await ctx.db
        .query("subscriptionBundles")
        .withIndex("by_customer", (q) => q.eq("customerId", clerkId))
        .first();

      // Check active entitlements
      const entitlements = await ctx.db
        .query("entitlements")
        .withIndex("by_customer", (q) => q.eq("customerId", clerkId))
        .collect();

      const activeEntitlements = entitlements.filter(
        (e) => e.status === "active" || e.status === "cancel_at_period_end"
      );

      results[clerkId] = {
        isAdmin: !!admin,
        adminRole: admin?.role,
        hasDashboard:
          activeEntitlements.length > 0 ||
          (!!bundle &&
            (bundle.status === "active" ||
              bundle.status === "cancel_at_period_end")),
        subscriptionStatus: bundle?.status,
        entitlementCount: activeEntitlements.length,
      };
    }

    return results;
  },
});
