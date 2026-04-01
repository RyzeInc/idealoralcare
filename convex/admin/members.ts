import { mutation, query, action } from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin, requireAdminAction } from "../lib/authGuards";
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
    return await ctx.db.query("memberProfiles").order("asc").take(limit);
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

    return {
      member,
      activities,
      notes,
      entitlements,
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
    await requireAdmin(ctx);
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

    return allMembers.filter((m) => ["active", "enrolling"].includes(m.memberType));
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
    await requireAdmin(ctx);
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

    return {
      total: args.memberIds.length,
      succeeded: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
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
    await requireAdmin(ctx);
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
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const group = await ctx.db.get(args.groupId);
    if (!group) throw new Error("Group not found");

    const allMembers = await ctx.db.query("memberProfiles").collect();
    const seq = String(allMembers.length + 1).padStart(5, "0");
    const memberId = `MBR-${new Date().getFullYear()}-${seq}`;
    const barcode = memberId.replace(/-/g, "");

    // Infer list-bill status for FT members in a list-bill group
    const isListBillGroup = (group as any).listBill?.enabled === true;
    const isFT = args.employeeType === "full_time";

    const id = await ctx.db.insert("memberProfiles", {
      memberId,
      barcode,
      siteId: group.siteId,
      accountId: group.accountId,
      groupId: args.groupId,
      firstName: args.firstName,
      lastName: args.lastName,
      email: args.email,
      phone: args.phone,
      dateOfBirth: args.dateOfBirth,
      groupMemberId: args.groupMemberId,
      employeeType: args.employeeType,
      listBillStatus: isListBillGroup && isFT ? "active" : undefined,
      memberType: args.memberType ?? "eligible",
      memberRole: "primary",
      status: "active",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as any);

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
