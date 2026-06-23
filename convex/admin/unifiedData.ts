/**
 * UNIFIED DATA LAYER — Single source of truth for admin queries
 *
 * This module centralizes all common data access patterns used across
 * admin tabs to ensure consistency, reduce redundancy, and improve performance.
 *
 * Core principle: Every data type has ONE canonical query that all
 * admin features depend on. Derived data (summaries, counts, etc.) are
 * computed once per request.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { QueryCtx, query } from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "../lib/authGuards";
import { Doc, Id } from "../_generated/dataModel";

// ============================================================================
// TYPES
// ============================================================================

export interface HierarchyData {
  sites: Doc<"sites">[];
  accounts: Doc<"accounts">[];
  groups: Doc<"groups">[];
  /** Maps groupId → memberCount */
  memberCountsByGroup: Record<string, number>;
  /** Maps groupId → group (for fast lookups) */
  groupsById: Map<string, Doc<"groups">>;
  /** Maps accountId → account (for fast lookups) */
  accountsById: Map<string, Doc<"accounts">>;
}

export interface EnrichedMember extends Doc<"memberProfiles"> {
  _group?: Doc<"groups"> | null;
  _account?: Doc<"accounts"> | null;
  _subscription?: Doc<"subscriptionBundles"> | null;
  _enrollment?: Doc<"enrollmentSessions"> | null;
  _broker?: Doc<"partnerLeaders"> | null;
  _agency?: Doc<"distributionPartners"> | null;
  isPaid: boolean;
  isPendingDowngrade: boolean;
}

export interface BillingGroupSummary {
  groupId: Id<"groups">;
  groupCode: string;
  groupName: string;
  organizationCode: string | null;
  accountId: Id<"accounts">;
  accountName: string | null;
  isListBill: boolean;
  memberCounts: {
    total: number;
    active: number;
    paid: number;
    free: number;
    pendingDowngrade: number;
  };
  revenue: {
    paidTotal: number;
    perMemberRate: number;
  };
}

export interface BillingData {
  groupSummaries: BillingGroupSummary[];
  totals: {
    groupCount: number;
    activeMemberCount: number;
    paidMemberCount: number;
    totalRevenue: number;
  };
}

export interface AuditEntry {
  _id: Id<"adminAuditLog">;
  _creationTime: number;
  adminId: string;
  adminEmail?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  changes?: Record<string, any>;
  reason?: string;
}

export interface DashboardMetrics {
  totalMembers: number;
  activeMembers: number;
  paidMembers: number;
  totalGroups: number;
  totalRevenue: number;
  recentActivity: Array<{
    timestamp: number;
    action: string;
    memberId?: string;
    details?: string;
  }>;
  systemHealth: {
    healthy: boolean;
    warnings: string[];
  };
}

// ============================================================================
// HIERARCHY — Single source of truth
// ============================================================================

/**
 * Get complete hierarchy (sites, accounts, groups) with all derived data.
 * This is the ONLY place where hierarchy data is fetched.
 * All other queries that need hierarchy must use this.
 */
export async function getHierarchy(ctx: QueryCtx, args: any): Promise<HierarchyData> {
  // Single scan of each table
  const [sites, accounts, groups, members] = await Promise.all([
    ctx.db.query("sites").collect(),
    ctx.db.query("accounts").collect(),
    ctx.db.query("groups").collect(),
    ctx.db.query("memberProfiles").collect(),
  ]);

  // Build lookup maps for O(1) access
  const groupsById = new Map(groups.map((g) => [g._id as string, g]));
  const accountsById = new Map(accounts.map((a) => [a._id as string, a]));

  // Count members per group
  const memberCountsByGroup: Record<string, number> = {};
  for (const group of groups) {
    memberCountsByGroup[group._id as string] = members.filter(
      (m) => m.groupId === group._id
    ).length;
  }

  return {
    sites,
    accounts,
    groups,
    memberCountsByGroup,
    groupsById,
    accountsById,
  };
}

// ============================================================================
// MEMBERS — Enriched with full context
// ============================================================================

/**
 * Get all members with full enrichment (group, account, subscription, enrollment).
 * This is the ONLY place where member data should be fetched at scale.
 */
export async function getAllMembersEnriched(ctx: QueryCtx, args: { limit?: number }): Promise<EnrichedMember[]> {
  const limit = Math.min(args.limit ?? 500, 500);
  const members = await ctx.db.query("memberProfiles").order("asc").take(limit);

  // Batch load all related data
  const [allBundles, allGroups, allAccounts, allSessions, leaders, partners] = await Promise.all([
    ctx.db.query("subscriptionBundles").collect(),
    ctx.db.query("groups").collect(),
    ctx.db.query("accounts").collect(),
    ctx.db.query("enrollmentSessions").collect(),
    ctx.db.query("partnerLeaders").collect(),
    ctx.db.query("distributionPartners").collect(),
  ]);

  // Build lookup maps (single scan per table)
  const bundlesByCustomer = new Map<string, Doc<"subscriptionBundles">>();
  const paidCustomerIds = new Set<string>();
  const pendingDowngradeCustomerIds = new Set<string>();

  for (const b of allBundles) {
    if (!bundlesByCustomer.has(b.customerId) || b.status === "active") {
      bundlesByCustomer.set(b.customerId, b);
    }
    if (b.status === "active" && b.pricingSnapshot?.totalCents > 0) {
      paidCustomerIds.add(b.customerId);
    }
    if (b.pendingDowngrade) {
      pendingDowngradeCustomerIds.add(b.customerId);
    }
  }

  const groupsById = new Map(allGroups.map((g) => [g._id as string, g]));
  const accountsById = new Map(allAccounts.map((a) => [a._id as string, a]));
  const leaderById = new Map(leaders.map((l) => [l._id as string, l]));
  const partnerById = new Map(partners.map((p) => [p._id as string, p]));

  // Build attribution once
  const attributionByMember = new Map<string, Doc<"enrollmentSessions">>();
  for (const s of allSessions) {
    if (!s.memberId) continue;
    const existing = attributionByMember.get(s.memberId as string);
    const better =
      !existing ||
      (s.status === "completed" && existing.status !== "completed") ||
      (s.status === existing.status && (s.createdAt ?? 0) > (existing.createdAt ?? 0));
    if (better) attributionByMember.set(s.memberId as string, s);
  }

  // Enrich members
  return members.map((m) => {
    const subscription = m.customerId ? bundlesByCustomer.get(m.customerId) : null;
    const group = m.groupId ? groupsById.get(m.groupId as string) : null;
    const account = group ? accountsById.get(group.accountId as string) : null;
    const enrollment = attributionByMember.get(m._id as string);
    const broker = enrollment?.brokerId ? leaderById.get(enrollment.brokerId as string) : null;
    const agency = enrollment?.agencyId
      ? partnerById.get(enrollment.agencyId as string)
      : broker?.partnerId
      ? partnerById.get(broker.partnerId as string)
      : null;

    return {
      ...m,
      _group: group || undefined,
      _account: account || undefined,
      _subscription: subscription || undefined,
      _enrollment: enrollment || undefined,
      _broker: broker || undefined,
      _agency: agency || undefined,
      isPaid: !!(m.customerId && paidCustomerIds.has(m.customerId)),
      isPendingDowngrade: !!(m.customerId && pendingDowngradeCustomerIds.has(m.customerId)),
    };
  });
}

// ============================================================================
// BILLING — Unified across all billing operations
// ============================================================================

/**
 * Get billing summaries for all groups.
 * Single source of truth for all billing data.
 */
export async function getBillingData(ctx: QueryCtx, args: any): Promise<BillingData> {
  const [groups, accounts, allMembers, allBundles] = await Promise.all([
    ctx.db.query("groups").collect(),
    ctx.db.query("accounts").collect(),
    ctx.db.query("memberProfiles").collect(),
    ctx.db.query("subscriptionBundles").collect(),
  ]);

  // Build tracking sets
  const paidCustomerIds = new Set<string>();
  const pendingDowngradeCustomerIds = new Set<string>();

  for (const bundle of allBundles) {
    if (bundle.status === "active" && bundle.pricingSnapshot?.totalCents > 0) {
      paidCustomerIds.add(bundle.customerId);
    }
    if (bundle.pendingDowngrade) {
      pendingDowngradeCustomerIds.add(bundle.customerId);
    }
  }

  const accountsById = new Map(accounts.map((a) => [a._id as string, a]));

  // Build summaries
  const groupSummaries: BillingGroupSummary[] = [];
  let totalRevenue = 0;

  for (const group of groups) {
    const account = accountsById.get(group.accountId as string);
    const groupMembers = allMembers.filter((m) => m.groupId === group._id && m.memberType === "active");

    let paidCount = 0;
    let freeCount = 0;
    let pendingDowngradeCount = 0;

    for (const member of groupMembers) {
      if (member.customerId && paidCustomerIds.has(member.customerId)) {
        paidCount++;
      } else if (member.customerId && pendingDowngradeCustomerIds.has(member.customerId)) {
        pendingDowngradeCount++;
      } else {
        freeCount++;
      }
    }

    const rateFromAccount = (account as any)?.billingDetails?.perMemberRateCents ?? 1500;
    const perMemberRate = rateFromAccount / 100;
    const groupRevenue = paidCount * perMemberRate;
    totalRevenue += groupRevenue;

    groupSummaries.push({
      groupId: group._id,
      groupCode: group.groupCode || "",
      groupName: group.name,
      organizationCode: group.organizationCode || null,
      accountId: group.accountId,
      accountName: account?.name || null,
      isListBill: group.listBill?.enabled === true,
      memberCounts: {
        total: groupMembers.length,
        active: groupMembers.length,
        paid: paidCount,
        free: freeCount,
        pendingDowngrade: pendingDowngradeCount,
      },
      revenue: {
        paidTotal: groupRevenue,
        perMemberRate,
      },
    });
  }

  return {
    groupSummaries,
    totals: {
      groupCount: groups.length,
      activeMemberCount: allMembers.filter((m) => m.memberType === "active").length,
      paidMemberCount: paidCustomerIds.size,
      totalRevenue,
    },
  };
}

// ============================================================================
// AUDIT TRAIL — Unified logging
// ============================================================================

/**
 * Get recent admin audit entries.
 * Single source of truth for audit trail.
 */
export async function getRecentAuditTrail(ctx: QueryCtx, args: { limit?: number }): Promise<AuditEntry[]> {
  const limit = Math.min(args.limit ?? 100, 1000);
  const entries = await ctx.db
    .query("adminAuditLog")
    .order("desc")
    .take(limit);

  return entries.map((e) => ({
    _id: e._id,
    _creationTime: e._creationTime,
    adminId: (e as any).actorClerkUserId as string,
    adminEmail: (e as any).adminEmail,
    action: e.action,
    resourceType: (e as any).resourceType,
    resourceId: (e as any).resourceId,
    changes: (e as any).changes,
    reason: (e as any).reason,
  }));
}

// ============================================================================
// DASHBOARD — Unified metrics
// ============================================================================

/**
 * Get all dashboard metrics in one call.
 * Eliminates redundant queries in the dashboard tab.
 */
export async function getDashboardMetrics(ctx: QueryCtx, args: any): Promise<DashboardMetrics> {
  // Batch load all necessary data
  const [allMembers, allBundles, allGroups, auditEntries] = await Promise.all([
    ctx.db.query("memberProfiles").collect(),
    ctx.db.query("subscriptionBundles").collect(),
    ctx.db.query("groups").collect(),
    ctx.db.query("adminAuditLog").order("desc").take(50),
  ]);

  // Count members by status
  const activeMembers = allMembers.filter((m) => m.memberType === "active");
  const paidCustomerIds = new Set<string>();

  for (const bundle of allBundles) {
    if (bundle.status === "active" && bundle.pricingSnapshot?.totalCents > 0) {
      paidCustomerIds.add(bundle.customerId);
    }
  }

  const paidMembers = activeMembers.filter(
    (m) => m.customerId && paidCustomerIds.has(m.customerId)
  );

  // Calculate total revenue
  const DEFAULT_RATE = 15.0;
  let totalRevenue = 0;
  for (const member of paidMembers) {
    const bundle = allBundles.find((b) => b.customerId === member.customerId);
    const rate = bundle?.pricingSnapshot?.totalCents ?? DEFAULT_RATE * 100;
    totalRevenue += rate / 100;
  }

  // Extract recent activity from audit log
  const recentActivity = auditEntries.slice(0, 10).map((e) => ({
    timestamp: e._creationTime,
    action: e.action,
    memberId: (e as any).resourceId,
    details: (e as any).reason,
  }));

  return {
    totalMembers: allMembers.length,
    activeMembers: activeMembers.length,
    paidMembers: paidMembers.length,
    totalGroups: allGroups.length,
    totalRevenue,
    recentActivity,
    systemHealth: {
      healthy: true, // Add real health checks as needed
      warnings: [],
    },
  };
}

// ============================================================================
// EXPORTED QUERIES — Convex RPC wrappers for frontend consumption
// ============================================================================

/**
 * Exported query wrapper for getHierarchy.
 * Called via useQuery(api.admin.unifiedData.getHierarchyQuery)
 */
export const getHierarchyQuery = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return getHierarchy(ctx, {});
  },
});

/**
 * Exported query wrapper for getAllMembersEnriched.
 * Called via useQuery(api.admin.unifiedData.getAllMembersEnrichedQuery)
 */
export const getAllMembersEnrichedQuery = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return getAllMembersEnriched(ctx, args);
  },
});

/**
 * Exported query wrapper for getBillingData.
 * Called via useQuery(api.admin.unifiedData.getBillingDataQuery)
 */
export const getBillingDataQuery = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return getBillingData(ctx, {});
  },
});

/**
 * Exported query wrapper for getRecentAuditTrail.
 * Called via useQuery(api.admin.unifiedData.getRecentAuditTrailQuery)
 */
export const getRecentAuditTrailQuery = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return getRecentAuditTrail(ctx, args);
  },
});

/**
 * Exported query wrapper for getDashboardMetrics.
 * Called via useQuery(api.admin.unifiedData.getDashboardMetricsQuery)
 */
export const getDashboardMetricsQuery = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return getDashboardMetrics(ctx, {});
  },
});
