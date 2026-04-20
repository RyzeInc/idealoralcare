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

/**
 * Detailed lookup for a single user: returns everything we know about them
 * across all tables (admin, subscription, entitlements, member profile, toothlens).
 */
export const getUserDetail = query({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    const { clerkUserId } = args;

    // Admin record
    const admin = await ctx.db
      .query("adminUsers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", clerkUserId))
      .first();

    // Subscription bundle
    const bundle = await ctx.db
      .query("subscriptionBundles")
      .withIndex("by_customer", (q) => q.eq("customerId", clerkUserId))
      .first();

    // ALL entitlements (not just active)
    const entitlements = await ctx.db
      .query("entitlements")
      .withIndex("by_customer", (q) => q.eq("customerId", clerkUserId))
      .collect();

    // Resolve product names for each entitlement
    const entitlementsWithProducts = await Promise.all(
      entitlements.map(async (ent) => {
        const product = await ctx.db.get(ent.productId);
        return {
          _id: ent._id,
          status: ent.status,
          endCondition: ent.endCondition,
          createdVia: ent.createdVia,
          periodStart: ent.periodStart,
          periodEnd: ent.periodEnd,
          createdAt: ent.createdAt,
          notes: ent.notes,
          productName: product?.name ?? "Unknown Product",
          productSlug: product?.slug ?? "unknown",
          productCategory: product?.category ?? "unknown",
        };
      })
    );

    // Member profile(s) — could have primary and dependent entries
    const memberProfiles = await ctx.db
      .query("memberProfiles")
      .withIndex("by_customer", (q) => q.eq("customerId", clerkUserId))
      .collect();

    // Toothlens user
    const toothlensUser = await ctx.db
      .query("toothlensUsers")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", clerkUserId))
      .first();

    // Distribution partner
    const distPartner = await ctx.db
      .query("distributionPartners")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", clerkUserId))
      .first();

    return {
      admin: admin
        ? {
            role: admin.role,
            departments: admin.departments,
            email: admin.email,
            name: admin.name,
            createdAt: admin.createdAt,
          }
        : null,
      bundle: bundle
        ? {
            _id: bundle._id,
            status: bundle.status,
            cadence: bundle.cadence,
            paymentMethod: bundle.paymentMethod,
            currentPeriodStart: bundle.currentPeriodStart,
            currentPeriodEnd: bundle.currentPeriodEnd,
            stripeCustomerId: bundle.stripeCustomerId,
            stripeSubscriptionId: bundle.stripeSubscriptionId,
            pricingSnapshot: bundle.pricingSnapshot,
            createdAt: bundle.createdAt,
            activatedAt: bundle.activatedAt,
            cancelledAt: bundle.cancelledAt,
            cancellationReason: bundle.cancellationReason,
          }
        : null,
      entitlements: entitlementsWithProducts,
      memberProfiles: memberProfiles.map((mp) => ({
        _id: mp._id,
        memberId: mp.memberId,
        firstName: mp.firstName,
        lastName: mp.lastName,
        email: mp.email,
        memberType: mp.memberType,
        memberRole: mp.memberRole,
        status: mp.status,
        createdAt: mp.createdAt,
        enrolledAt: mp.enrolledAt,
      })),
      toothlens: toothlensUser
        ? {
            toothlensUid: toothlensUser.toothlensUid,
            company: toothlensUser.company,
            createdAt: toothlensUser.createdAt,
          }
        : null,
      distributionPartner: distPartner
        ? {
            type: distPartner.type,
            status: distPartner.status,
            name: distPartner.name,
          }
        : null,
    };
  },
});
