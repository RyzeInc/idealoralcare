import { mutation, query } from "../_generated/server";
import { v } from "convex/values";

/**
 * ADMIN MEMBER MANAGEMENT
 * 
 * Queries and mutations for viewing, searching, and managing member profiles.
 * Leverages existing functions from convex/enrollment/members.ts
 */

/**
 * Get member roster for a group (paginated)
 */
export const getMemberRoster = query({
  args: {
    groupId: v.id("groups"),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 25;
    const offset = args.offset ?? 0;

    // Get total count
    const all = await ctx.db
      .query("memberProfiles")
      .filter((q) => q.eq(q.field("groupId"), args.groupId))
      .collect();

    const members = all.slice(offset, offset + limit);

    return {
      groupId: args.groupId,
      total: all.length,
      limit,
      offset,
      members,
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
