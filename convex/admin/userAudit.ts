import { query, action } from "../_generated/server";
import { api } from "../_generated/api";
import { v } from "convex/values";
import { requireAdmin, requireAdminAction } from "../lib/authGuards";

/**
 * All toothlens user records — for cross-system user investigation dashboard.
 * Returns clerkUserId, toothlensUid, company, scanCount (approximate via index).
 */
export const getAllToothlensUserRecords = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const records = await ctx.db.query("toothlensUsers").collect();
    // Also get per-user scan counts
    const result = await Promise.all(
      records.map(async (r) => {
        const scans = await ctx.db
          .query("toothlensScans")
          .withIndex("by_uid", (q) => q.eq("toothlensUid", r.toothlensUid))
          .collect();
        return {
          _id: r._id,
          clerkUserId: r.clerkUserId,
          memberProfileId: r.memberProfileId,
          toothlensUid: r.toothlensUid,
          company: r.company,
          createdAt: r.createdAt,
          scanCount: scans.length,
          lastScanAt: scans.sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0))[0]?.startedAt ?? null,
        };
      })
    );
    return result;
  },
});

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

/**
 * Full cross-system member inspector: given a memberProfiles _id, returns
 * all known data from IdealOH (Convex), ready to display alongside Clerk
 * and Toothlens data fetched client-side.
 *
 * Includes:
 * - Full memberProfile (personal info, address, vendor IDs, status)
 * - Dependents with their own vendor IDs
 * - Subscription bundle + all entitlements with product names
 * - Toothlens user record + scan history from Convex
 * - Recent member notes and activities
 * - Census Template required-field validation summary
 * - Group/Account/Site names for context
 */
export const getMemberInspectorData = query({
  args: { memberProfileId: v.id("memberProfiles") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const member = await ctx.db.get(args.memberProfileId);
    if (!member) return null;

    // Hierarchy context
    const [group, account, site] = await Promise.all([
      ctx.db.get(member.groupId),
      ctx.db.get(member.accountId),
      ctx.db.get(member.siteId),
    ]);

    // Subscription
    const bundle = member.customerId
      ? await ctx.db
          .query("subscriptionBundles")
          .withIndex("by_customer", (q) => q.eq("customerId", member.customerId!))
          .first()
      : null;

    // All entitlements with product names
    const rawEntitlements = member.customerId
      ? await ctx.db
          .query("entitlements")
          .withIndex("by_customer", (q) => q.eq("customerId", member.customerId!))
          .order("desc")
          .collect()
      : [];
    const entitlements = await Promise.all(
      rawEntitlements.map(async (ent) => {
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

    // Toothlens user record (by clerkUserId OR toothlensMemberId)
    const toothlensUser = member.customerId
      ? await ctx.db
          .query("toothlensUsers")
          .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", member.customerId!))
          .first()
      : null;

    // Toothlens scans
    const toothlensScans = toothlensUser
      ? await ctx.db
          .query("toothlensScans")
          .withIndex("by_uid", (q) => q.eq("toothlensUid", toothlensUser.toothlensUid))
          .order("desc")
          .take(20)
      : [];

    // Recent notes
    const notes = await ctx.db
      .query("memberNotes")
      .filter((q) => q.eq(q.field("memberProfileId"), args.memberProfileId))
      .order("desc")
      .take(20);

    // Recent activity
    const activities = await ctx.db
      .query("memberActivities")
      .filter((q) => q.eq(q.field("memberProfileId"), args.memberProfileId))
      .order("desc")
      .take(30);

    // Census Template required-field validation
    const missingFields: string[] = [];
    if (!member.firstName) missingFields.push("First Name");
    if (!member.lastName) missingFields.push("Last Name");
    if (!member.careingtonUniqueId) missingFields.push("Unique ID");
    if (!member.careingtonSeqNum) missingFields.push("Sequence Number");
    if (!member.address?.line1) missingFields.push("Address Line 1");
    if (!member.address?.city) missingFields.push("City");
    if (!member.address?.state) missingFields.push("State");
    if (!member.address?.postalCode) missingFields.push("Zip");
    if (!member.email) missingFields.push("Email Address");
    if (!member.dateOfBirth) missingFields.push("Date of Birth");
    if (!member.effectiveDate) missingFields.push("Effective Date");

    return {
      member: {
        _id: member._id,
        memberId: member.memberId,
        subscriberId: member.subscriberId,
        barcode: member.barcode,
        customerId: member.customerId,
        // Personal
        title: member.title,
        firstName: member.firstName,
        middleName: member.middleName,
        lastName: member.lastName,
        suffix: member.suffix,
        email: member.email,
        phone: member.phone,
        workPhone: member.workPhone,
        dateOfBirth: member.dateOfBirth,
        effectiveDate: member.effectiveDate,
        gender: member.gender,
        // Address
        address: member.address,
        // Status
        memberType: member.memberType,
        status: member.status,
        memberRole: member.memberRole,
        relationship: member.relationship,
        employeeType: member.employeeType,
        // Vendor IDs
        careingtonUniqueId: member.careingtonUniqueId,
        careingtonSeqNum: member.careingtonSeqNum,
        toothlensMemberId: member.toothlensMemberId,
        // Enrollment
        enrolledAt: member.enrolledAt,
        enrolledBundleId: member.enrolledBundleId,
        createdAt: member.createdAt,
        updatedAt: member.updatedAt,
        lastActivityAt: member.lastActivityAt,
        signupSource: member.signupSource,
        eligibilityFileId: member.eligibilityFileId,
      },
      dependents: (member.dependents ?? []).map((d) => ({
        firstName: d.firstName,
        lastName: d.lastName,
        dateOfBirth: d.dateOfBirth,
        relationship: d.relationship,
        seqNum: d.seqNum,
        toothlensMemberId: d.toothlensMemberId,
      })),
      hierarchy: {
        groupName: group?.name ?? "Unknown Group",
        groupCode: (group as any)?.groupCode ?? null,
        organizationCode: (group as any)?.organizationCode ?? null,
        accountName: account?.name ?? "Unknown Account",
        siteName: site?.name ?? "Unknown Site",
      },
      subscription: bundle
        ? {
            _id: bundle._id,
            status: bundle.status,
            cadence: bundle.cadence,
            paymentMethod: bundle.paymentMethod,
            currentPeriodEnd: bundle.currentPeriodEnd,
            currentPeriodStart: bundle.currentPeriodStart,
            stripeCustomerId: bundle.stripeCustomerId,
            stripeSubscriptionId: bundle.stripeSubscriptionId,
            totalCents: bundle.pricingSnapshot.totalCents,
            createdAt: bundle.createdAt,
            activatedAt: bundle.activatedAt,
            cancelledAt: bundle.cancelledAt,
            pendingDowngrade: (bundle as any).pendingDowngrade ?? null,
          }
        : null,
      entitlements,
      toothlens: toothlensUser
        ? {
            toothlensUid: toothlensUser.toothlensUid,
            company: toothlensUser.company,
            name: toothlensUser.name,
            email: toothlensUser.email,
            createdAt: toothlensUser.createdAt,
            scanCount: toothlensScans.length,
            lastScanAt: toothlensScans[0]?.startedAt ?? null,
            scans: toothlensScans.map((s) => ({
              sessionId: s.sessionId,
              status: s.status,
              startedAt: s.startedAt,
              completedAt: s.completedAt,
              reportUrl: s.reportUrl,
            })),
          }
        : null,
      notes: notes.map((n) => ({
        _id: n._id,
        content: (n as any).content ?? (n as any).text ?? "",
        noteType: (n as any).noteType ?? "general",
        createdAt: n.createdAt,
        createdByName: (n as any).createdByName ?? "Admin",
      })),
      activities: activities.map((a) => ({
        _id: a._id,
        activityType: a.activityType,
        title: a.title,
        description: a.description,
        createdAt: a.createdAt,
      })),
      validation: {
        missingFields,
        isComplete: missingFields.length === 0,
      },
    };
  },
});
