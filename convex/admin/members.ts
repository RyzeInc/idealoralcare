import { mutation, query, action } from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin, requireAdminAction } from "../lib/authGuards";
import { recordAdminAction } from "./adminAudit";
import { createMemberProfile } from "../lib/memberCreation";
// @ts-ignore - Type instantiation too deep
import { api as apiOriginal } from "../_generated/api";

const getApi = () => {
  // @ts-ignore
  return apiOriginal as any;
};

/**
 * ADMIN MEMBER MANAGEMENT
 * 
 * Queries and mutations for viewing, searching, and managing member profiles.
 * Leverages existing functions from convex/enrollment/members.ts
 */

/**
 * Get all members across all groups (paginated — max 500)
 */
export const getAllMembers = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 500, 500);
    const members = await ctx.db.query("memberProfiles").order("asc").take(limit);

    // Build a customerId → bundle map (single scan vs N+1 lookups)
    const allBundles = await ctx.db.query("subscriptionBundles").collect();
    const bundleByCustomer = new Map<string, any>();
    for (const b of allBundles) {
      // Prefer the active bundle for a given customer; fall back to most recent
      const existing = bundleByCustomer.get(b.customerId);
      if (!existing || b.status === "active" || (b._creationTime ?? 0) > (existing._creationTime ?? 0)) {
        bundleByCustomer.set(b.customerId, b);
      }
    }

    // Build a groupId → group map for organizationCode/name (single scan)
    const allGroups = await ctx.db.query("groups").collect();
    const groupById = new Map<string, any>();
    for (const g of allGroups) groupById.set(g._id, g);

    // Clerk-free rep attribution: derive each member's rep from their enrollment
    // session (the canonical sale record). Build memberId → attribution once.
    const allSessions = await ctx.db.query("enrollmentSessions").collect();
    const leaders = await ctx.db.query("partnerLeaders").collect();
    const leaderById = new Map<string, any>(leaders.map((l) => [l._id as string, l]));
    const partners = await ctx.db.query("distributionPartners").collect();
    const partnerById = new Map<string, any>(partners.map((p) => [p._id as string, p]));

    const attributionByMember = new Map<string, any>();
    for (const s of allSessions) {
      if (!s.memberId) continue;
      if (!s.brokerId && !s.brokerTrackingCode) continue;
      const existing = attributionByMember.get(s.memberId as string);
      // Prefer a completed session, otherwise the most recent.
      const better =
        !existing ||
        (s.status === "completed" && existing.status !== "completed") ||
        (s.status === existing.status && (s.createdAt ?? 0) > (existing.createdAt ?? 0));
      if (better) attributionByMember.set(s.memberId as string, s);
    }

    return members.map((m) => {
      const bundle = m.customerId ? bundleByCustomer.get(m.customerId) : null;
      const group = m.groupId ? groupById.get(m.groupId) : null;
      const session = attributionByMember.get(m._id as string);
      const leader = session?.brokerId ? leaderById.get(session.brokerId) : null;
      const agency = session?.agencyId
        ? partnerById.get(session.agencyId)
        : leader?.partnerId
        ? partnerById.get(leader.partnerId)
        : null;
      return {
        ...m,
        subscriptionStatus: bundle?.status ?? null,
        subscriptionCadence: bundle?.cadence ?? null,
        pendingDowngrade: bundle?.pendingDowngrade ?? null,
        organizationCode: group?.organizationCode ?? null,
        organizationName: group?.name ?? group?.slug ?? null,
        // Rep attribution (Clerk-free; null when there is no rep)
        attributedRepCode: session?.brokerTrackingCode ?? null,
        attributedRepId: session?.brokerId ?? null,
        attributedRepName: leader?.name ?? null,
        attributedAgencyId: agency?._id ?? null,
        attributedAgencyName: agency?.name ?? null,
      };
    });
  },
});

/**
 * Get member roster for a group (index-backed, limited)
 */
export const getMemberRoster = query({
  args: {
    groupId: v.id("groups"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 100, 500);

    const members = await ctx.db
      .query("memberProfiles")
      .withIndex("by_group", (q: any) => q.eq("groupId", args.groupId))
      .take(limit);

    return {
      groupId: args.groupId,
      members,
      hasMore: members.length === limit,
    };
  },
});

/**
 * Get members by status (memberType)
 */
export const getMembersByStatus = query({
  args: {
    groupId: v.id("groups"),
    memberType: v.string(), // "lead" | "eligible" | "enrolling" | "active" | "inactive" | "terminated" | "declined"
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;

    return await ctx.db
      .query("memberProfiles")
      .filter(
        (q) =>
          q.and(
            q.eq(q.field("groupId"), args.groupId),
            q.eq(q.field("memberType"), args.memberType)
          )
      )
      .order("desc")
      .take(limit);
  },
});

/**
 * Get full member detail + activities + notes
 */
export const getMemberDetail = query({
  args: { memberId: v.id("memberProfiles") },
  handler: async (ctx, args) => {
    const member = await ctx.db.get(args.memberId);
    if (!member) throw new Error("Member not found");

    // Get activities
    const activities = await ctx.db
      .query("memberActivities")
      .filter((q) => q.eq(q.field("memberProfileId"), args.memberId))
      .order("desc")
      .collect();

    // Get notes
    const notes = await ctx.db
      .query("memberNotes")
      .filter((q) => q.eq(q.field("memberProfileId"), args.memberId))
      .order("desc")
      .collect();

    // Get entitlements
    const entitlements = member.customerId
      ? await ctx.db
          .query("entitlements")
          .filter((q) => q.eq(q.field("customerId"), member.customerId))
          .collect()
      : [];

    // Get the active subscription bundle (so the UI can show pending downgrades, status, etc.)
    let subscriptionBundle: any = null;
    if (member.customerId) {
      const bundles = await ctx.db
        .query("subscriptionBundles")
        .filter((q) => q.eq(q.field("customerId"), member.customerId))
        .collect();
      subscriptionBundle =
        bundles.find((b) => b.status === "active") ??
        bundles.sort((a, b) => (b._creationTime ?? 0) - (a._creationTime ?? 0))[0] ??
        null;
    }

    // Rep attribution (Clerk-free): derive from the member's enrollment session.
    const memberSessions = await ctx.db
      .query("enrollmentSessions")
      .withIndex("by_member", (q) => q.eq("memberId", args.memberId))
      .collect();
    const attributedSession =
      memberSessions
        .filter((s) => s.brokerId || s.brokerTrackingCode)
        .sort((a, b) => {
          if ((a.status === "completed") !== (b.status === "completed")) {
            return a.status === "completed" ? -1 : 1;
          }
          return (b.createdAt ?? 0) - (a.createdAt ?? 0);
        })[0] ?? null;

    let repAttribution: any = null;
    if (attributedSession) {
      const leader = attributedSession.brokerId
        ? await ctx.db.get(attributedSession.brokerId as any)
        : null;
      const agencyId =
        attributedSession.agencyId ?? (leader as any)?.partnerId ?? null;
      const agency = agencyId ? await ctx.db.get(agencyId as any) : null;
      repAttribution = {
        repCode: attributedSession.brokerTrackingCode ?? null,
        repId: attributedSession.brokerId ?? null,
        repName: (leader as any)?.name ?? null,
        agencyId: (agency as any)?._id ?? null,
        agencyName: (agency as any)?.name ?? null,
      };
    }

    return {
      member,
      activities,
      notes,
      entitlements,
      subscriptionBundle,
      repAttribution,
    };
  },
});

/**
 * Update member status (memberType transition with activity logging)
 */
export const updateMemberStatus = mutation({
  args: {
    memberId: v.id("memberProfiles"),
    newStatus: v.union(
      v.literal("lead"),
      v.literal("eligible"),
      v.literal("enrolling"),
      v.literal("active"),
      v.literal("inactive"),
      v.literal("terminated"),
      v.literal("declined")
    ),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAdmin(ctx);
    const member = await ctx.db.get(args.memberId);
    if (!member) throw new Error("Member not found");

    const oldStatus = member.memberType;

    // Update member status
    await ctx.db.patch(args.memberId, {
      memberType: args.newStatus,
    });

    // Log activity
    await ctx.db.insert("memberActivities", {
      memberProfileId: args.memberId,
      siteId: member.siteId,
      groupId: member.groupId,
      activityType: "status_changed",
      title: `Status changed: ${oldStatus} → ${args.newStatus}`,
      description: args.reason ?? `Member status transitioned from ${oldStatus} to ${args.newStatus}`,
      metadata: {
        oldStatus,
        newStatus: args.newStatus,
        reason: args.reason,
      },
      actorType: "admin",
      createdAt: Date.now(),
    });

    // Audit trail
    await recordAdminAction(ctx, identity, {
      action: "member.status_change",
      targetType: "memberProfile",
      targetId: String(args.memberId),
      summary: `Changed ${member.firstName ?? ''} ${member.lastName ?? ''} (${member.memberId}) from ${oldStatus} → ${args.newStatus}`,
      metadata: { oldStatus, newStatus: args.newStatus, reason: args.reason ?? null },
    });

    return await ctx.db.get(args.memberId);
  },
});

/**
 * Search members by name, email, or member ID
 */
export const searchMembers = query({
  args: {
    groupId: v.id("groups"),
    query: v.string(),
  },
  handler: async (ctx, args) => {
    const lowerQuery = args.query.toLowerCase();

    const all = await ctx.db
      .query("memberProfiles")
      .filter((q) => q.eq(q.field("groupId"), args.groupId))
      .collect();

    return all.filter((member) => {
      const nameMatch =
        member.firstName.toLowerCase().includes(lowerQuery) ||
        member.lastName.toLowerCase().includes(lowerQuery);

      const emailMatch = member.email?.toLowerCase().includes(lowerQuery);
      const idMatch = member.memberId?.includes(args.query);

      return nameMatch || emailMatch || idMatch;
    });
  },
});

/**
 * Quick eligibility check (Tivity-style): search ALL members across the system
 * by email, last name, or member ID. Used by the admin dashboard widget so
 * admins can answer "is this person eligible?" without navigating to a group.
 *
 * Returns a small list (max 25) with just the fields needed for triage:
 * name, email, group, status, eligibility window.
 */
export const quickEligibilityCheck = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const q = args.query.trim().toLowerCase();
    if (q.length < 2) return [];

    // Pull all members and filter in-memory. Member counts are bounded
    // (single-org platform) so this is acceptable; for larger scale, switch
    // to a search index on `email` + `lastName`.
    const all = await ctx.db.query("memberProfiles").collect();
    const matches = all.filter((m) => {
      const email = (m.email ?? "").toLowerCase();
      const last = (m.lastName ?? "").toLowerCase();
      const first = (m.firstName ?? "").toLowerCase();
      const memId = m.memberId ?? "";
      return (
        email.includes(q) ||
        last.includes(q) ||
        first.includes(q) ||
        memId.includes(args.query.trim())
      );
    }).slice(0, 25);

    // Hydrate group names
    const groupIds = Array.from(new Set(matches.map((m) => m.groupId).filter(Boolean)));
    const groups = await Promise.all(
      groupIds.map((gid) => ctx.db.get(gid as any))
    );
    const groupMap = new Map(
      groups
        .filter((g): g is any => g !== null)
        .map((g: any) => [g._id, { groupCode: g.groupCode, name: g.name || g.slug }])
    );

    return matches.map((m) => ({
      _id: m._id,
      memberId: m.memberId,
      firstName: m.firstName,
      lastName: m.lastName,
      email: m.email,
      status: m.status,
      effectiveDate: m.effectiveDate,
      groupId: m.groupId,
      group: m.groupId ? groupMap.get(m.groupId) : null,
    }));
  },
});

/**
 * Add member note (admin action)
 */
export const addMemberNote = mutation({
  args: {
    memberId: v.id("memberProfiles"),
    content: v.string(),
    noteType: v.optional(v.union(
      v.literal("general"),
      v.literal("enrollment"),
      v.literal("billing"),
      v.literal("support"),
      v.literal("compliance"),
      v.literal("follow_up"),
      v.literal("internal")
    )),
    isPinned: v.optional(v.boolean()),
    authorId: v.optional(v.string()),
    authorName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const member = await ctx.db.get(args.memberId);
    if (!member) throw new Error("Member not found");

    const noteId = await ctx.db.insert("memberNotes", {
      memberProfileId: args.memberId,
      siteId: member.siteId,
      content: args.content,
      noteType: args.noteType ?? "general",
      isPinned: args.isPinned ?? false,
      authorId: args.authorId ?? "admin",
      authorName: args.authorName ?? "Admin",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Log activity
    await ctx.db.insert("memberActivities", {
      memberProfileId: args.memberId,
      siteId: member.siteId,
      groupId: member.groupId,
      activityType: "note_added",
      title: `Note added: ${args.noteType ?? "General"}`,
      description: args.content.slice(0, 100),
      metadata: {
        noteId,
        noteType: args.noteType,
      },
      actorType: "admin",
      createdAt: Date.now(),
    });

    return await ctx.db.get(noteId);
  },
});

/**
 * Get member activities timeline
 */
export const getMemberActivityTimeline = query({
  args: {
    memberId: v.id("memberProfiles"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("memberActivities")
      .filter((q) => q.eq(q.field("memberProfileId"), args.memberId))
      .order("desc")
      .take(args.limit ?? 50);
  },
});

/**
 * Get group member breakdown by status
 */
export const getGroupMemberBreakdown = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const members = await ctx.db
      .query("memberProfiles")
      .filter((q) => q.eq(q.field("groupId"), args.groupId))
      .collect();

    const breakdown = {
      total: members.length,
      byStatus: {
        lead: 0,
        eligible: 0,
        enrolling: 0,
        active: 0,
        inactive: 0,
        terminated: 0,
        declined: 0,
      },
      detailsByStatus: {} as any,
    };

    for (const member of members) {
      const status = member.memberType as keyof typeof breakdown.byStatus;
      if (status in breakdown.byStatus) {
        breakdown.byStatus[status]++;

        if (!breakdown.detailsByStatus[status]) {
          breakdown.detailsByStatus[status] = [];
        }
        breakdown.detailsByStatus[status].push({
          id: member._id,
          name: `${member.firstName} ${member.lastName}`,
          email: member.email,
          memberId: member.memberId,
        });
      }
    }

    return breakdown;
  },
});

/**
 * Get all active members across a site (for vendor file generation)
 */
export const getActiveMembersBySite = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, args) => {
    const allMembers = await ctx.db
      .query("memberProfiles")
      .filter((q) => q.eq(q.field("siteId"), args.siteId))
      .collect();

    // Filter for active or enrolling members
    return allMembers.filter((m) => ["active", "enrolling"].includes(m.memberType));
  },
});

/**
 * Get active members by group (for vendor file generation)
 */
export const getActiveMembersByGroup = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const allMembers = await ctx.db
      .query("memberProfiles")
      .filter((q) => q.eq(q.field("groupId"), args.groupId))
      .collect();

    // Include "eligible" so freshly-imported eligibility-file members appear
    // in vendor file generation (Careington/DialCare). They haven't activated
    // yet but are entitled to coverage and need to be on the vendor's roster.
    return allMembers.filter((m) => ["active", "enrolling", "eligible"].includes(m.memberType));
  },
});

/**
 * Get recently enrolled members (for dashboard admin view)
 */
export const getRecentlyEnrolled = query({
  args: {
    groupId: v.id("groups"),
    days: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const daysAgo = (args.days ?? 7) * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - daysAgo;

    const members = await ctx.db
      .query("memberProfiles")
      .filter((q) => q.eq(q.field("groupId"), args.groupId))
      .collect();

    return members
      .filter((m) => (m.createdAt ?? 0) >= cutoff)
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
      .slice(0, args.limit ?? 10);
  },
});

/**
 * Bulk status update for members (e.g., terminate all from a file)
 */
export const bulkUpdateMemberStatus = mutation({
  args: {
    memberIds: v.array(v.id("memberProfiles")),
    newStatus: v.union(
      v.literal("lead"),
      v.literal("eligible"),
      v.literal("enrolling"),
      v.literal("active"),
      v.literal("inactive"),
      v.literal("terminated"),
      v.literal("declined")
    ),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAdmin(ctx);
    const results = [];

    for (const memberId of args.memberIds) {
      const member = await ctx.db.get(memberId);
      if (!member) {
        results.push({ memberId, success: false, error: "Not found" });
        continue;
      }

      const oldStatus = member.memberType;

      try {
        await ctx.db.patch(memberId, {
          memberType: args.newStatus,
        });

        // Log activity
        await ctx.db.insert("memberActivities", {
          memberProfileId: memberId,
          siteId: member.siteId,
          groupId: member.groupId,
          activityType: "status_changed",
          title: `Bulk status change: ${oldStatus} → ${args.newStatus}`,
          description: args.reason ?? "Bulk operation",
          metadata: {
            oldStatus,
            newStatus: args.newStatus,
            reason: args.reason,
          },
          actorType: "admin",
          createdAt: Date.now(),
        });

        results.push({ memberId, success: true });
      } catch (error) {
        results.push({
          memberId,
          success: false,
          error: (error as any).message,
        });
      }
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    await recordAdminAction(ctx, identity, {
      action: "member.bulk_status_change",
      targetType: "memberProfile",
      summary: `Bulk status change to ${args.newStatus}: ${succeeded} succeeded, ${failed} failed (of ${args.memberIds.length})`,
      metadata: { newStatus: args.newStatus, reason: args.reason ?? null, memberIds: args.memberIds.map(String), succeeded, failed },
    });

    return {
      total: args.memberIds.length,
      succeeded,
      failed,
      results,
    };
  },
});
/**
 * Assign a member to a staff member (typically called from enrollment webhook)
 * Links member to their enrolling broker/agent via adminUsers table
 */
export const assignMemberToStaff = mutation({
  args: {
    memberProfileId: v.id("memberProfiles"),
    staffClerkId: v.string(), // Clerk user ID of the staff member
  },
  handler: async (ctx, args) => {
    const member = await ctx.db.get(args.memberProfileId);
    if (!member) {
      throw new Error("Member not found");
    }

    // Look up the admin user by their Clerk ID
    const adminUser = await ctx.db
      .query("adminUsers")
      .withIndex("by_clerk_id", (q: any) => q.eq("clerkUserId", args.staffClerkId))
      .first();

    if (!adminUser) {
      // If the staff user doesn't exist as an admin, silently return
      // This allows the webhook to complete even if the broker hasn't been onboarded as an admin
      console.warn(`[assignMemberToStaff] Admin user not found for Clerk ID: ${args.staffClerkId}`);
      return null;
    }

    const now = Date.now();

    // Update member with staff assignment
    await ctx.db.patch(args.memberProfileId, {
      assignedStaffId: adminUser._id,
      assignedStaffName: adminUser.name,
      assignedAt: now,
      updatedAt: now,
    });

    // Log activity
    await ctx.db.insert("memberActivities", {
      memberProfileId: args.memberProfileId,
      siteId: member.siteId,
      groupId: member.groupId,
      activityType: "staff_assigned",
      title: "Member assigned to staff",
      description: `Member assigned to ${adminUser.name}`,
      actorType: "system",
      actorId: args.staffClerkId,
      actorName: adminUser.name,
      createdAt: now,
    });

    return {
      memberProfileId: args.memberProfileId,
      assignedStaffId: adminUser._id,
      assignedStaffName: adminUser.name,
      assignedAt: now,
    };
  },
});

/**
 * Dashboard statistics — counts by status plus subscription data from Stripe
 */
export const getDashboardStats = query({
  handler: async (ctx) => {
    const [allMembers, eligFiles, allBundles] = await Promise.all([
      ctx.db.query("memberProfiles").collect(),
      ctx.db.query("eligibilityFiles").collect(),
      ctx.db.query("subscriptionBundles").collect(),
    ]);

    const active = allMembers.filter((m) => m.memberType === "active").length;
    const pending = allMembers.filter((m) => ["lead", "eligible", "enrolling"].includes(m.memberType)).length;

    // Paying subscribers: active bundles with totalCents > 0
    const payingBundles = allBundles.filter(
      (b) => b.status === "active" && b.pricingSnapshot?.totalCents > 0
    );
    const payingSubscribers = payingBundles.length;

    // Monthly recurring revenue from active paid bundles
    const monthlyRevenueCents = payingBundles.reduce((sum, b) => {
      const cents = b.pricingSnapshot?.totalCents ?? 0;
      // Convert annual to monthly equivalent
      return sum + (b.cadence === "annual" ? Math.round(cents / 12) : cents);
    }, 0);

    return {
      activeMembers: active,
      pendingEnrollments: pending,
      eligibilityFiles: eligFiles.length,
      totalMembers: allMembers.length,
      payingSubscribers,
      monthlyRevenueCents,
      totalBundles: allBundles.length,
    };
  },
});

/**
 * System health check — verifies key subsystems are operational
 */
export const getSystemHealth = query({
  handler: async (ctx) => {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    const [
      allBundles,
      eligFiles,
      enrollmentSessions,
      contacts,
      newsletter,
      memberActivities,
      allMembers,
    ] = await Promise.all([
      ctx.db.query("subscriptionBundles").collect(),
      ctx.db.query("eligibilityFiles").collect(),
      ctx.db.query("enrollmentSessions").collect(),
      ctx.db.query("contactSubmissions").collect(),
      ctx.db.query("newsletterSubscriptions").collect(),
      ctx.db.query("memberActivities").order("desc").take(1),
      ctx.db.query("memberProfiles").collect(),
    ]);

    // Stripe / Subscriptions health
    const activeBundles = allBundles.filter((b) => b.status === "active");
    const paidActiveBundles = activeBundles.filter(
      (b) => b.pricingSnapshot?.totalCents > 0
    );
    const failedPayments = allBundles.filter(
      (b) => b.status === "payment_failed" || b.status === "past_due"
    );

    // Eligibility processing
    const recentEligFiles = eligFiles.filter(
      (f) => (f.uploadedAt ?? 0) > sevenDaysAgo
    );
    const failedEligFiles = eligFiles.filter((f) => f.status === "failed");
    const completedEligFiles = eligFiles.filter(
      (f) => f.status === "completed" || f.status === "completed_with_errors"
    );

    // Enrollment pipeline
    const inProgressSessions = enrollmentSessions.filter(
      (s) => s.status === "in_progress" || s.status === "pending_payment"
    );
    const completedSessions = enrollmentSessions.filter(
      (s) => s.status === "completed"
    );
    const abandonedSessions = enrollmentSessions.filter(
      (s) => s.status === "abandoned" || s.status === "expired"
    );

    // Contact form
    const recentContacts = contacts.filter(
      (c) => c.createdAt > sevenDaysAgo
    );

    // Last activity timestamp
    const lastActivityAt = memberActivities.length > 0
      ? memberActivities[0].createdAt
      : null;

    // Members with vs without customerId (linked to auth)
    const linkedMembers = allMembers.filter((m) => m.customerId).length;

    return {
      stripe: {
        status: paidActiveBundles.length > 0 ? "ok" : "warning",
        activePaidSubscriptions: paidActiveBundles.length,
        totalSubscriptions: allBundles.length,
        failedPayments: failedPayments.length,
        label: paidActiveBundles.length > 0
          ? `${paidActiveBundles.length} active paid subscription${paidActiveBundles.length !== 1 ? "s" : ""}`
          : "No active paid subscriptions",
      },
      eligibility: {
        status: failedEligFiles.length === 0 ? "ok" : "warning",
        totalFiles: eligFiles.length,
        recentUploads: recentEligFiles.length,
        completedFiles: completedEligFiles.length,
        failedFiles: failedEligFiles.length,
        label: failedEligFiles.length > 0
          ? `${failedEligFiles.length} failed file${failedEligFiles.length !== 1 ? "s" : ""}`
          : `${eligFiles.length} file${eligFiles.length !== 1 ? "s" : ""} processed`,
      },
      enrollment: {
        status: inProgressSessions.length > 0 || completedSessions.length > 0 ? "ok" : "idle",
        inProgress: inProgressSessions.length,
        completed: completedSessions.length,
        abandoned: abandonedSessions.length,
        label: completedSessions.length > 0
          ? `${completedSessions.length} completed, ${inProgressSessions.length} in progress`
          : inProgressSessions.length > 0
            ? `${inProgressSessions.length} in progress`
            : "No enrollment sessions yet",
      },
      contacts: {
        status: "ok",
        totalSubmissions: contacts.length,
        recentSubmissions: recentContacts.length,
        newsletterSubscribers: newsletter.filter((n) => n.status === "active").length,
        label: `${contacts.length} total, ${recentContacts.length} this week`,
      },
      members: {
        status: "ok",
        total: allMembers.length,
        linked: linkedMembers,
        unlinked: allMembers.length - linkedMembers,
        label: `${allMembers.length} total, ${linkedMembers} linked to accounts`,
      },
      lastActivityAt,
    };
  },
});

/**
 * Get recent activity across all members (for dashboard)
 */
export const getRecentActivity = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("memberActivities")
      .order("desc")
      .take(args.limit ?? 20);
  },
});

/**
 * Remove a member profile (admin soft-delete pattern — sets status to terminated)
 */
export const removeMember = mutation({
  args: {
    memberId: v.id("memberProfiles"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAdmin(ctx);
    const member = await ctx.db.get(args.memberId);
    if (!member) throw new Error("Member not found");

    await ctx.db.patch(args.memberId, {
      memberType: "terminated",
      status: "terminated",
      updatedAt: Date.now(),
    });

    await ctx.db.insert("memberActivities", {
      memberProfileId: args.memberId,
      siteId: member.siteId,
      groupId: member.groupId,
      activityType: "status_changed",
      title: "Member terminated by admin",
      description: args.reason ?? "Removed via admin panel",
      metadata: { oldStatus: member.memberType, newStatus: "terminated", reason: args.reason },
      actorType: "admin",
      createdAt: Date.now(),
    });

    await recordAdminAction(ctx, identity, {
      action: "member.remove",
      targetType: "memberProfile",
      targetId: String(args.memberId),
      summary: `Terminated ${member.firstName ?? ''} ${member.lastName ?? ''} (${member.memberId})`,
      metadata: { reason: args.reason ?? null, previousStatus: member.memberType },
    });

    return { success: true };
  },
});

/**
 * Update member profile fields (admin action)
 */
export const updateMemberProfile = mutation({
  args: {
    memberId: v.id("memberProfiles"),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    groupMemberId: v.optional(v.string()),
    address: v.optional(v.any()),
    communicationPrefs: v.optional(v.any()),
    // Employer / payroll audit fields
    ssn: v.optional(v.string()),
    location: v.optional(v.string()),
    department: v.optional(v.string()),
    effectiveDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const member = await ctx.db.get(args.memberId);
    if (!member) throw new Error("Member not found");

    const { memberId: _id, ...rest } = args;
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [k, val] of Object.entries(rest)) {
      if (val !== undefined) updates[k] = val;
    }

    await ctx.db.patch(args.memberId, updates);

    await ctx.db.insert("memberActivities", {
      memberProfileId: args.memberId,
      siteId: member.siteId,
      groupId: member.groupId,
      activityType: "profile_updated",
      title: "Profile updated by admin",
      actorType: "admin",
      createdAt: Date.now(),
    });

    return await ctx.db.get(args.memberId);
  },
});

/**
 * Create a new member profile via admin panel (admin-assisted enrollment)
 */
export const createAdminMember = mutation({
  args: {
    groupId: v.id("groups"),
    firstName: v.string(),
    lastName: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    memberType: v.optional(v.union(
      v.literal("lead"), v.literal("eligible"), v.literal("active")
    )),
    groupMemberId: v.optional(v.string()),
    employeeType: v.optional(v.union(v.literal("full_time"), v.literal("part_time"))),
    // New: allow admin to override vendor IDs / subscriber ID when needed
    careingtonUniqueId: v.optional(v.string()),
    careingtonSeqNum: v.optional(v.string()),
    subscriberId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const group = await ctx.db.get(args.groupId);
    if (!group) throw new Error("Group not found");

    const { _id: id } = await createMemberProfile(ctx, {
      groupId: args.groupId,
      groupOverride: group,
      firstName: args.firstName,
      lastName: args.lastName,
      email: args.email,
      phone: args.phone,
      dateOfBirth: args.dateOfBirth,
      memberType: args.memberType ?? "eligible",
      memberRole: "primary",
      groupMemberId: args.groupMemberId,
      employeeType: args.employeeType,
      careingtonUniqueId: args.careingtonUniqueId,
      careingtonSeqNum: args.careingtonSeqNum,
      subscriberIdOverride: args.subscriberId,
    });

    await ctx.db.insert("memberActivities", {
      memberProfileId: id,
      siteId: group.siteId,
      groupId: args.groupId,
      activityType: "lead_created",
      title: "Member created by admin",
      actorType: "admin",
      createdAt: Date.now(),
    });

    return await ctx.db.get(id);
  },
});

/**
 * Get member count breakdown by group (for hierarchy dashboard)
 */
export const getMemberCountsByGroup = query({
  args: { groupIds: v.optional(v.array(v.id("groups"))) },
  handler: async (ctx, args) => {
    const allMembers = await ctx.db.query("memberProfiles").collect();
    const counts: Record<string, { total: number; active: number; enrolling: number }> = {};
    for (const m of allMembers) {
      const gid = m.groupId.toString();
      if (!counts[gid]) counts[gid] = { total: 0, active: 0, enrolling: 0 };
      counts[gid].total++;
      if (m.memberType === "active") counts[gid].active++;
      if (m.memberType === "enrolling") counts[gid].enrolling++;
    }
    return counts;
  },
});

/**
 * Alert-feed data for dashboard (unread contacts, stuck members, failed files)
 */
export const getAdminAlerts = query({
  handler: async (ctx) => {
    const [contacts, inquiries, failedFiles, stuckMembers] = await Promise.all([
      ctx.db.query("contactSubmissions")
        .withIndex("by_status", (q: any) => q.eq("status", "new")).collect(),
      ctx.db.query("inquiries")
        .withIndex("by_status", (q: any) => q.eq("status", "new")).collect(),
      ctx.db.query("eligibilityFiles")
        .withIndex("by_status", (q: any) => q.eq("status", "failed")).collect(),
      ctx.db.query("memberProfiles").collect(),
    ]);

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const stuck = stuckMembers.filter(
      (m) => m.memberType === "enrolling" && (m.createdAt ?? 0) < sevenDaysAgo
    );

    return {
      unreadContacts: contacts.length,
      newInquiries: inquiries.length,
      failedEligibilityFiles: failedFiles.length,
      stuckEnrollments: stuck.length,
      total: contacts.length + inquiries.length + failedFiles.length + stuck.length,
    };
  },
});

// ============================================================
// LIST-BILL MEMBER FUNCTIONS (FT/payroll-deduction groups)
// ============================================================

/**
 * Get FT members in a list-bill group (active on payroll deduction)
 */
export const getListBillActiveMembers = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("memberProfiles")
      .withIndex("by_group", (q: any) => q.eq("groupId", args.groupId))
      .filter((q) =>
        q.and(
          q.eq(q.field("memberType"), "active"),
          q.eq(q.field("employeeType"), "full_time")
        )
      )
      .collect();
  },
});

/**
 * Get termed list-bill members (FT employees who left; eligible for direct re-enrollment)
 */
export const getTermedListBillMembers = query({
  args: { groupId: v.optional(v.id("groups")) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (args.groupId) {
      return await ctx.db
        .query("memberProfiles")
        .withIndex("by_group", (q: any) => q.eq("groupId", args.groupId))
        .filter((q) =>
          q.and(
            q.eq(q.field("employeeType"), "full_time"),
            q.eq(q.field("listBillStatus"), "termed")
          )
        )
        .collect();
    }
    // All groups
    return await ctx.db
      .query("memberProfiles")
      .filter((q) =>
        q.and(
          q.eq(q.field("employeeType"), "full_time"),
          q.eq(q.field("listBillStatus"), "termed")
        )
      )
      .collect();
  },
});

/**
 * Mark a FT member as termed from the list-bill plan and generate a re-enrollment token.
 * The token is used in the re-enrollment link sent via email.
 */
export const termListBillMember = mutation({
  args: {
    memberId: v.id("memberProfiles"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const member = await ctx.db.get(args.memberId);
    if (!member) throw new Error("Member not found");

    // Generate a random token (hex)
    const tokenBytes = new Array(20)
      .fill(0)
      .map(() => Math.floor(Math.random() * 256).toString(16).padStart(2, "0"))
      .join("");

    const now = Date.now();

    await ctx.db.patch(args.memberId, {
      listBillStatus: "termed",
      listBillTermedAt: now,
      reenrollmentToken: tokenBytes,
      memberType: "inactive",
      status: "inactive",
      updatedAt: now,
    });

    // Log activity
    await ctx.db.insert("memberActivities", {
      memberProfileId: args.memberId,
      siteId: member.siteId,
      groupId: member.groupId,
      activityType: "status_changed",
      title: "Termed from list-bill plan",
      description: args.reason ?? "Employee left the payroll-deduction group plan",
      actorType: "admin",
      metadata: { previousStatus: member.memberType, listBillStatus: "termed" },
      createdAt: now,
    });

    return { reenrollmentToken: tokenBytes };
  },
});

/**
 * Send a re-enrollment link email to a termed list-bill member.
 * Dispatches sendReenrollmentLinkEmail action.
 */
export const sendReenrollmentLink: any = action({
  args: {
    memberId: v.id("memberProfiles"),
  },
  handler: async (ctx, args) => {
    const api = getApi();
    // @ts-ignore
    await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);

    const detail = await ctx.runQuery(api.admin.members.getMemberDetail, {
      memberId: args.memberId,
    });

    if (!detail) throw new Error("Member not found");
    const member = detail.member;
    if (!member.email) throw new Error("Member has no email address");
    if (member.listBillStatus !== "termed") {
      throw new Error("Member is not in termed list-bill status");
    }

    // Ensure token exists
    let token = member.reenrollmentToken;
    if (!token) {
      const result = await ctx.runMutation(api.admin.members.termListBillMember, {
        memberId: args.memberId,
      });
      token = result.reenrollmentToken;
    }

    const group = await ctx.runQuery(api.admin.hierarchy.getGroupById, {
      groupId: member.groupId,
    });

    return await ctx.runAction(api.admin.notifications.sendReenrollmentLinkEmail, {
      email: member.email,
      firstName: member.firstName,
      memberId: member.memberId,
      reenrollmentToken: token,
      groupName: group?.name ?? group?.slug ?? "your employer group",
    });
  },
});
