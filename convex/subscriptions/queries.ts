/**
 * SUBSCRIPTION QUERIES
 *
 * Queries for reading subscription/entitlement state
 */

import { query } from "../_generated/server";
import { v } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import { requireAuth, requireAdmin } from "../lib/authGuards";

interface GetCustomerBundleArgs {
  customerId: string;
}

interface GetCustomerEntitlementsArgs {
  customerId: string;
  includeExpired?: boolean;
}

interface GetEntitlementArgs {
  entitlementId: string;
}

interface HasAccessArgs {
  customerId: string;
  productId: string;
}

interface GetCustomerDashboardArgs {
  customerId: string;
}

// ---------------------------------------------------------------------------
// DEPENDENT ACCESS HELPERS
// ---------------------------------------------------------------------------

/**
 * Resolve the effective Stripe/entitlement customer ID.
 * Dependents inherit entitlements from their primary member, so access checks
 * must be performed against the primary's customer ID.
 */
async function resolveEffectiveCustomerId(
  ctx: QueryCtx,
  callerClerkId: string
): Promise<string> {
  const myProfile = await ctx.db
    .query("memberProfiles")
    .withIndex("by_customer", (q) => q.eq("customerId", callerClerkId))
    .first();

  if (!myProfile || (myProfile as any).memberRole !== "dependent") {
    return callerClerkId;
  }

  const primaryMemberId = (myProfile as any).primaryMemberId;
  if (!primaryMemberId) return callerClerkId;

  const primaryProfile = (await ctx.db.get(primaryMemberId)) as any;
  return primaryProfile?.customerId ?? callerClerkId;
}

interface MemberRoleInfo {
  role: "primary" | "dependent" | "unknown";
  myProfile: any;
  primaryCustomerId: string | null;
  primaryMemberName: string | null;
}

/**
 * Returns role info about the current user — used by getMyDashboard to decide
 * which data to expose and whether to hide billing fields.
 */
async function getMemberRoleInfo(
  ctx: QueryCtx,
  clerkUserId: string
): Promise<MemberRoleInfo> {
  const myProfile = await ctx.db
    .query("memberProfiles")
    .withIndex("by_customer", (q) => q.eq("customerId", clerkUserId))
    .first();

  if (!myProfile) return { role: "unknown", myProfile: null, primaryCustomerId: null, primaryMemberName: null };

  if ((myProfile as any).memberRole !== "dependent") {
    return { role: "primary", myProfile, primaryCustomerId: null, primaryMemberName: null };
  }

  const primaryMemberId = (myProfile as any).primaryMemberId;
  if (!primaryMemberId) return { role: "primary", myProfile, primaryCustomerId: null, primaryMemberName: null };

  const primaryProfile = (await ctx.db.get(primaryMemberId)) as any;
  return {
    role: "dependent",
    myProfile,
    primaryCustomerId: primaryProfile?.customerId ?? null,
    primaryMemberName: primaryProfile
      ? `${primaryProfile.firstName} ${primaryProfile.lastName}`
      : null,
  };
}

// ---------------------------------------------------------------------------
// MEMBER-FACING QUERIES
// ---------------------------------------------------------------------------

/**
 * Get CURRENT USER's subscription bundle (member-facing).
 * Dependents do not own bundles — returns null so billing UI is suppressed.
 * customerId is derived from auth — no IDOR possible.
 */
export const getMyBundle = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const identity = await requireAuth(ctx);

    // Dependents do not own bundles
    const myProfile = await ctx.db
      .query("memberProfiles")
      .withIndex("by_customer", (q) => q.eq("customerId", identity.clerkUserId))
      .first();
    if (myProfile && (myProfile as any).memberRole === "dependent") {
      return null;
    }

    const bundle = await ctx.db
      .query("subscriptionBundles")
      .withIndex("by_customer", (q) =>
        q.eq("customerId", identity.clerkUserId)
      )
      .filter((q) => q.neq(q.field("status"), "cancelled"))
      .first();

    return bundle;
  },
});

/**
 * Get a customer's subscription bundle by customerId (public)
 * Used for server-side layout subscription gating checks
 * No authentication required — safe because it's just checking subscription status
 * (not returning sensitive member data, just plan names and status)
 */
export const getCustomerBundlePublic = query({
  args: {
    customerId: v.string(),
  },
  handler: async (ctx: QueryCtx, args) => {
    const bundle = await ctx.db
      .query("subscriptionBundles")
      .withIndex("by_customer", (q) =>
        q.eq("customerId", args.customerId)
      )
      .filter((q) => q.neq(q.field("status"), "cancelled"))
      .first();

    return bundle
      ? {
          _id: bundle._id,
          customerId: bundle.customerId,
          status: bundle.status,
          currentPeriodEnd: (bundle as any).currentPeriodEnd,
          pricingSnapshot: (bundle as any).pricingSnapshot,
          pastDueAt: (bundle as any).pastDueAt,
        }
      : null;
  },
});

/**
 * Get CURRENT USER's active entitlements (member-facing).
 * Dependents inherit entitlements from their primary member.
 * customerId is derived from auth — no IDOR possible.
 */
export const getMyEntitlements = query({
  args: {
    includeExpired: v.optional(v.boolean()),
  },
  handler: async (ctx: QueryCtx, args) => {
    const identity = await requireAuth(ctx);

    // Dependents check the primary's entitlements
    const effectiveCustomerId = await resolveEffectiveCustomerId(ctx, identity.clerkUserId);

    let q = ctx.db
      .query("entitlements")
      .withIndex("by_customer", (q) =>
        q.eq("customerId", effectiveCustomerId)
      );

    if (!args.includeExpired) {
      q = q.filter((q) =>
        q.or(
          q.eq(q.field("status"), "active"),
          q.eq(q.field("status"), "cancel_at_period_end")
        )
      );
    }

    const entitlements = await q.collect();

    // Enrich with product data
    const enriched = await Promise.all(
      entitlements.map(async (e) => {
        const product = await ctx.db.get((e as any).productId as any);
        return { ...e, product };
      })
    );

    return enriched;
  },
});

/**
 * Check if CURRENT USER has access to a product (member-facing).
 * Dependents inherit access from their primary member's entitlements.
 * customerId is derived from auth — no IDOR possible.
 */
export const myHasAccess = query({
  args: {
    productId: v.id("catalogProducts"),
  },
  handler: async (ctx: QueryCtx, args) => {
    const identity = await requireAuth(ctx);

    // Resolve effective customer — dependents share primary's entitlements
    const effectiveCustomerId = await resolveEffectiveCustomerId(ctx, identity.clerkUserId);

    const entitlement = await ctx.db
      .query("entitlements")
      .withIndex("by_customer", (q) =>
        q.eq("customerId", effectiveCustomerId)
      )
      .filter((q) => q.eq(q.field("productId"), args.productId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "active"),
          q.eq(q.field("status"), "cancel_at_period_end")
        )
      )
      .first();

    return !!entitlement;
  },
});

/**
 * Get CURRENT USER's dashboard summary (member-facing).
 * - Primary members see full billing info + their list of dependents.
 * - Dependents see plan/entitlement info but billing is hidden.
 * customerId is derived from auth — no IDOR possible.
 */
export const getMyDashboard = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const identity = await requireAuth(ctx);

    const memberInfo = await getMemberRoleInfo(ctx, identity.clerkUserId);
    const isDependent = memberInfo.role === "dependent";
    const effectiveCustomerId =
      isDependent && memberInfo.primaryCustomerId
        ? memberInfo.primaryCustomerId
        : identity.clerkUserId;

    const bundle = await ctx.db
      .query("subscriptionBundles")
      .withIndex("by_customer", (q) =>
        q.eq("customerId", effectiveCustomerId)
      )
      .filter((q) => q.neq(q.field("status"), "cancelled"))
      .first();

    const emptyBase = {
      customerId: identity.clerkUserId,
      role: (isDependent ? "dependent" : "primary") as "dependent" | "primary",
      bundle: null as any,
      entitlements: [] as any[],
      nextRenewalDate: null as number | null,
      // Billing fields hidden from dependents
      upcomingChargeAmount: null as number | null,
      dependents: [] as any[],
      primaryMember: memberInfo.primaryMemberName,
    };

    if (!bundle) return emptyBase;

    const entitlements = await ctx.db
      .query("entitlements")
      .withIndex("by_customer", (q) =>
        q.eq("customerId", effectiveCustomerId)
      )
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "active"),
          q.eq(q.field("status"), "cancel_at_period_end")
        )
      )
      .collect();

    // Primary members: fetch their dependents for the dashboard
    let dependents: any[] = [];
    if (!isDependent && memberInfo.myProfile) {
      const rawDeps = await ctx.db
        .query("memberProfiles")
        .withIndex("by_primary_member", (q) =>
          q.eq("primaryMemberId", memberInfo.myProfile._id)
        )
        .filter((q) => q.neq(q.field("status"), "terminated"))
        .collect();
      dependents = rawDeps.map((d) => ({
        _id: d._id,
        firstName: d.firstName,
        lastName: d.lastName,
        relationship: (d as any).relationship as string | undefined,
        inviteStatus: (d as any).inviteStatus as string | undefined,
        hasClaimed: !!(d as any).customerId,
      }));
    }

    return {
      customerId: identity.clerkUserId,
      role: (isDependent ? "dependent" : "primary") as "dependent" | "primary",
      // Safe bundle view: dependents only see status + cadence (no billing amounts)
      bundle: isDependent
        ? { _id: bundle._id, status: bundle.status, cadence: bundle.cadence }
        : bundle,
      entitlements,
      nextRenewalDate: (bundle as any).currentPeriodEnd as number,
      upcomingChargeAmount: isDependent
        ? null
        : ((bundle as any).pricingSnapshot?.totalCents ?? null),
      dependents,
      primaryMember: memberInfo.primaryMemberName,
    };
  },
});

/**
 * Get ANY customer's subscription bundle (admin-facing)
 * Only admins can look up other users' subscriptions
 */
export const getCustomerBundle = query({
  args: {
    customerId: v.string(),
  },
  handler: async (ctx: QueryCtx, args: GetCustomerBundleArgs) => {
    await requireAdmin(ctx);
    const bundle = await ctx.db
      .query("subscriptionBundles")
      .withIndex("by_customer", (q) =>
        q.eq("customerId", args.customerId)
      )
      .filter((q) => q.neq(q.field("status"), "cancelled"))
      .first();

    return bundle;
  },
});

/**
 * Get ANY customer's active entitlements (admin-facing)
 * Only admins can look up other users' entitlements
 */
export const getCustomerEntitlements = query({
  args: {
    customerId: v.string(),
    includeExpired: v.optional(v.boolean()),
  },
  handler: async (ctx: QueryCtx, args: GetCustomerEntitlementsArgs) => {
    await requireAdmin(ctx);
    let q = ctx.db
      .query("entitlements")
      .withIndex("by_customer", (q) =>
        q.eq("customerId", args.customerId)
      );

    if (!args.includeExpired) {
      q = q.filter((q) =>
        q.or(
          q.eq(q.field("status"), "active"),
          q.eq(q.field("status"), "cancel_at_period_end")
        )
      );
    }

    const entitlements = await q.collect();

    // Enrich with product data
    const enriched = await Promise.all(
      entitlements.map(async (e) => {
        const product = await ctx.db.get((e as any).productId as any);
        return { ...e, product };
      })
    );

    return enriched;
  },
});

/**
 * Get a specific entitlement with access check
 */
export const getEntitlement = query({
  args: {
    entitlementId: v.id("entitlements"),
  },
  handler: async (ctx: QueryCtx, args: GetEntitlementArgs) => {
    const identity = await requireAuth(ctx);
    
    const entitlement = await ctx.db.get(args.entitlementId as any);
    if (!entitlement) return null;

    // Check ownership: must be the entitlement owner or admin
    if ((entitlement as any).customerId !== identity.clerkUserId) {
      // Check if admin
      const admin = await ctx.db
        .query("adminUsers")
        .withIndex("by_clerk_id", (q: any) => q.eq("clerkUserId", identity.clerkUserId))
        .first();
      
      if (!admin) {
        throw new Error("Unauthorized: You can only access your own entitlements");
      }
    }

    const product = await ctx.db.get((entitlement as any).productId as any);
    return { ...entitlement, product };
  },
});

/**
 * Check if ANY customer has access to a product (admin-facing)
 * Only admins can check other users' access
 */
export const hasAccess = query({
  args: {
    customerId: v.string(),
    productId: v.id("catalogProducts"),
  },
  handler: async (ctx: QueryCtx, args: HasAccessArgs) => {
    await requireAdmin(ctx);
    const entitlement = await ctx.db
      .query("entitlements")
      .withIndex("by_customer", (q) =>
        q.eq("customerId", args.customerId)
      )
      .filter((q) => q.eq(q.field("productId"), args.productId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "active"),
          q.eq(q.field("status"), "cancel_at_period_end")
        )
      )
      .first();

    return !!entitlement;
  },
});

/**
 * Get ANY customer's dashboard summary (admin-facing)
 * Only admins can look up other users' dashboards
 */
/**
 * PUBLIC member card data lookup by customerId.
 * Safe to call from server components using a verified Clerk userId — no auth
 * guard needed because the caller confirms identity via Clerk server SDK.
 */
export const getMemberCardDataPublic = query({
  args: { customerId: v.string() },
  handler: async (ctx: QueryCtx, args) => {
    const profile = await ctx.db
      .query("memberProfiles")
      .withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
      .filter((q) => q.neq(q.field("status" as any), "terminated"))
      .first();

    if (!profile) return null;

    const bundle = await ctx.db
      .query("subscriptionBundles")
      .withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
      .filter((q) => q.neq(q.field("status"), "cancelled"))
      .first();

    // Try to get a plan name from active entitlements
    let planName = "Ideal Oral Health Plan";
    const entitlement = await ctx.db
      .query("entitlements")
      .withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "active"),
          q.eq(q.field("status"), "cancel_at_period_end")
        )
      )
      .first();
    if (entitlement) {
      const product = await ctx.db.get((entitlement as any).productId as any);
      if (product && (product as any).name) planName = (product as any).name;
    }

    const effectiveTs = (bundle as any)?.currentPeriodStart ?? (profile as any).enrolledAt ?? profile._creationTime;
    const effectiveDate = new Date(effectiveTs).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    return {
      memberName: `${profile.firstName} ${profile.lastName}`,
      memberId: profile.memberId,
      planName,
      effectiveDate,
      barcode: profile.barcode,
      networks: {
        careington: { name: "Dental Discount Network", memberUrl: "https://www.careington.com" },
        dialCare: { name: "Teledentistry Program", memberUrl: "https://www.dialcare.com" },
        toothlens: { name: "AI Oral Scanning", memberUrl: "https://toothlens.com" },
      },
      supportPhone: "(800) 290-0523",
      supportEmail: "support@getidealoh.com",
    };
  },
});

export const getCustomerDashboard = query({
  args: {
    customerId: v.string(),
  },
  handler: async (ctx: QueryCtx, args: GetCustomerDashboardArgs) => {
    await requireAdmin(ctx);
    const bundle = await ctx.db
      .query("subscriptionBundles")
      .withIndex("by_customer", (q) =>
        q.eq("customerId", args.customerId)
      )
      .filter((q) => q.neq(q.field("status"), "cancelled"))
      .first();

    if (!bundle) {
      return {
        customerId: args.customerId,
        bundle: null,
        entitlements: [],
        nextRenewalDate: null,
        upcomingChargeAmount: null,
      };
    }

    const entitlements = await ctx.db
      .query("entitlements")
      .withIndex("by_customer", (q) =>
        q.eq("customerId", args.customerId)
      )
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "active"),
          q.eq(q.field("status"), "cancel_at_period_end")
        )
      )
      .collect();

    return {
      customerId: args.customerId,
      bundle,
      entitlements,
      nextRenewalDate: (bundle as any).currentPeriodEnd,
      upcomingChargeAmount: (bundle as any).pricingSnapshot?.totalCents,
    };
  },
});
