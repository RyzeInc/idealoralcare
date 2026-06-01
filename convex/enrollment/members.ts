import { mutation, query, internalMutation } from "../_generated/server";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, requireAdmin, requireSelf } from "../lib/authGuards";
import { createMemberProfile as createMemberProfileShared } from "../lib/memberCreation";

/**
 * Member Profile Management
 * Create, read, and update member profiles
 */

/**
 * Generate a unique 9-digit member ID
 * Format: {9-digit numeric}
 * Example: 100000001, 100000002, etc.
 * Note: In production with nanoid, can use custom numeric alphabet for shorter IDs
 */
function generateMemberId(sequence: number): string {
  const memberId = String(100000000 + sequence).slice(0, 9);
  return memberId;
}

/**
 * Generate a unique barcode
 * Format: {SITE_PREFIX}{YEAR}{RANDOM}
 */
function generateBarcode(siteSlug: string): string {
  const year = String(new Date().getFullYear()).slice(2);
  const sitePrefix = siteSlug.slice(0, 3).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${sitePrefix}${year}${random}`;
}

/**
 * Create a new member profile
 * Called during personal info step of enrollment
 */
export const createMemberProfile = mutation({
  args: {
    siteId: v.id("sites"),
    accountId: v.id("accounts"),
    groupId: v.id("groups"),
    firstName: v.string(),
    lastName: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    gender: v.optional(
      v.union(
        v.literal("male"),
        v.literal("female"),
        v.literal("non_binary"),
        v.literal("prefer_not_to_say"),
        v.literal("other")
      )
    ),
    address: v.optional(
      v.object({
        line1: v.string(),
        line2: v.optional(v.string()),
        city: v.string(),
        state: v.string(),
        postalCode: v.string(),
        country: v.string(),
      })
    ),
    dependents: v.optional(
      v.array(
        v.object({
          firstName: v.string(),
          lastName: v.string(),
          dateOfBirth: v.optional(v.string()),
          relationship: v.union(
            v.literal("spouse"),
            v.literal("child"),
            v.literal("domestic_partner"),
            v.literal("other")
          ),
        })
      )
    ),
    memberType: v.union(
      v.literal("lead"),
      v.literal("eligible"),
      v.literal("enrolling"),
      v.literal("active")
    ),
    leadType: v.optional(
      v.union(
        v.literal("walk_in"),
        v.literal("referral"),
        v.literal("group_eligible"),
        v.literal("campaign"),
        v.literal("inbound"),
        v.literal("outbound"),
        v.literal("partner")
      )
    ),
    signupSource: v.optional(v.string()),
    enrollmentSessionId: v.optional(v.id("enrollmentSessions")),
    groupMemberId: v.optional(v.string()),
    externalMemberId: v.optional(v.string()),
  },
  handler: async (ctx: MutationCtx, args: any) => {
    // Authenticated users can create member profiles
    const identity = await requireAuth(ctx);

    const now = Date.now();

    const { _id: profile } = await createMemberProfileShared(ctx, {
      groupId: args.groupId,
      customerId: identity.clerkUserId,
      firstName: args.firstName,
      lastName: args.lastName,
      email: args.email,
      phone: args.phone,
      dateOfBirth: args.dateOfBirth,
      gender: args.gender,
      address: args.address,
      dependents: args.dependents,
      memberType: args.memberType,
      leadType: args.leadType,
      signupSource: args.signupSource,
      enrollmentSessionId: args.enrollmentSessionId,
      groupMemberId: args.groupMemberId,
      externalMemberId: args.externalMemberId,
    });

    // Log activity
    await ctx.db.insert("memberActivities", {
      memberProfileId: profile,
      siteId: args.siteId,
      groupId: args.groupId,
      activityType: "lead_created",
      title: "Lead created",
      description: `New ${args.memberType} added to system`,
      actorType: "system",
      createdAt: now,
    });

    return profile;
  },
});

/**
 * Internal mutation: Create a new member profile (for webhooks, background jobs)
 * Called during enrollment without requiring authentication
 */
export const internalCreateMemberProfile = internalMutation({
  args: {
    siteId: v.id("sites"),
    accountId: v.id("accounts"),
    groupId: v.id("groups"),
    firstName: v.string(),
    lastName: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    gender: v.optional(
      v.union(
        v.literal("male"),
        v.literal("female"),
        v.literal("non_binary"),
        v.literal("prefer_not_to_say"),
        v.literal("other")
      )
    ),
    address: v.optional(v.any()),
    dependents: v.optional(v.any()),
    memberType: v.union(
      v.literal("lead"),
      v.literal("eligible"),
      v.literal("enrolling"),
      v.literal("active")
    ),
    leadType: v.optional(v.string()),
    signupSource: v.optional(v.string()),
    enrollmentSessionId: v.optional(v.id("enrollmentSessions")),
    groupMemberId: v.optional(v.string()),
    externalMemberId: v.optional(v.string()),
    customerId: v.optional(v.string()), // Optional Clerk user ID
  },
  handler: async (ctx: MutationCtx, args: any) => {
    const now = Date.now();

    const { _id: profile } = await createMemberProfileShared(ctx, {
      groupId: args.groupId,
      customerId: args.customerId,
      firstName: args.firstName,
      lastName: args.lastName,
      email: args.email,
      phone: args.phone,
      dateOfBirth: args.dateOfBirth,
      gender: args.gender,
      address: args.address,
      dependents: args.dependents,
      memberType: args.memberType,
      leadType: args.leadType as any,
      signupSource: args.signupSource,
      enrollmentSessionId: args.enrollmentSessionId,
      groupMemberId: args.groupMemberId,
      externalMemberId: args.externalMemberId,
    });

    // Log activity
    await ctx.db.insert("memberActivities", {
      memberProfileId: profile,
      siteId: args.siteId,
      groupId: args.groupId,
      activityType: "lead_created",
      title: "Lead created",
      description: `New ${args.memberType} added to system`,
      actorType: "system",
      createdAt: now,
    });

    return profile;
  },
});

/**
 * Webhook wrapper: Create member profile from webhook
 * Public mutation that implements internalCreateMemberProfile logic without auth
 */
export const webhookCreateMemberProfile = mutation({
  args: {
    siteId: v.id("sites"),
    accountId: v.id("accounts"),
    groupId: v.id("groups"),
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    customerId: v.optional(v.string()), // Clerk user ID to link the profile
    memberType: v.union(
      v.literal("lead"),
      v.literal("eligible"),
      v.literal("enrolling"),
      v.literal("active"),
      v.literal("inactive"),
      v.literal("terminated"),
      v.literal("declined")
    ),
    signupSource: v.optional(v.string()),
    groupMemberId: v.optional(v.string()),
    externalMemberId: v.optional(v.string()),
    enrollmentSessionId: v.optional(v.id("enrollmentSessions")),
    // Profile fields collected during account creation
    phone: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    gender: v.optional(v.union(
      v.literal("male"),
      v.literal("female"),
      v.literal("non_binary"),
      v.literal("prefer_not_to_say"),
      v.literal("other"),
    )),
    address: v.optional(v.object({
      line1: v.string(),
      line2: v.optional(v.string()),
      city: v.string(),
      state: v.string(),
      postalCode: v.string(),
      country: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const { _id: profile } = await createMemberProfileShared(ctx, {
      groupId: args.groupId,
      customerId: args.customerId,
      firstName: args.firstName,
      lastName: args.lastName,
      email: args.email,
      memberType: args.memberType,
      signupSource: args.signupSource,
      groupMemberId: args.groupMemberId,
      externalMemberId: args.externalMemberId,
      enrollmentSessionId: args.enrollmentSessionId,
      phone: args.phone,
      dateOfBirth: args.dateOfBirth,
      gender: args.gender,
      address: args.address,
    });

    // Log activity
    await ctx.db.insert("memberActivities", {
      memberProfileId: profile,
      siteId: args.siteId,
      groupId: args.groupId,
      activityType: "lead_created",
      title: "Lead created",
      description: `New ${args.memberType} added to system`,
      actorType: "system",
      createdAt: now,
    });

    return profile;
  },
});

/**
 * Update member profile
 */
export const updateMemberProfile = mutation({
  args: {
    memberId: v.id("memberProfiles"),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    address: v.optional(v.any()),
    dependents: v.optional(v.any()),
    memberType: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("inactive"),
        v.literal("suspended"),
        v.literal("terminated")
      )
    ),
    customerId: v.optional(v.string()),
    assignedStaffId: v.optional(v.id("adminUsers")),
    assignedStaffName: v.optional(v.string()),
  },
  handler: async (ctx: MutationCtx, args: any) => {
    const profile = await ctx.db.get(args.memberId);
    if (!profile) {
      throw new Error("Member profile not found");
    }

    // User can update their own profile or admins can update any
    const identity = await requireAuth(ctx);
    
    // Check if user owns this profile (by Clerk ID match)
    const isOwner = (profile as any).clerkUserId === identity.clerkUserId;
    
    if (!isOwner) {
      // If not owner, must be admin
      await requireAdmin(ctx);
    }

    const updates: any = { updatedAt: Date.now() };

    if (args.firstName !== undefined) updates.firstName = args.firstName;
    if (args.lastName !== undefined) updates.lastName = args.lastName;
    if (args.email !== undefined) updates.email = args.email;
    if (args.phone !== undefined) updates.phone = args.phone;
    if (args.dateOfBirth !== undefined) updates.dateOfBirth = args.dateOfBirth;
    if (args.address !== undefined) updates.address = args.address;
    if (args.dependents !== undefined) updates.dependents = args.dependents;
    if (args.memberType !== undefined) updates.memberType = args.memberType;
    if (args.status !== undefined) updates.status = args.status;
    if (args.customerId !== undefined) updates.customerId = args.customerId;
    if (args.assignedStaffId !== undefined)
      updates.assignedStaffId = args.assignedStaffId;
    if (args.assignedStaffName !== undefined)
      updates.assignedStaffName = args.assignedStaffName;

    await ctx.db.patch(args.memberId, updates);

    // Log activity
    await ctx.db.insert("memberActivities", {
      memberProfileId: args.memberId,
      siteId: (profile as any).siteId,
      groupId: (profile as any).groupId,
      activityType: "profile_updated",
      title: "Profile updated",
      actorType: "system",
      createdAt: Date.now(),
    });

    return { ...profile, ...updates };
  },
});

/**
 * Link member to Clerk customer
 */
export const linkMemberToClerk = mutation({
  args: {
    memberId: v.id("memberProfiles"),
    customerId: v.string(), // Clerk user ID
  },
  handler: async (ctx: MutationCtx, args: any) => {
    const profile = await ctx.db.get(args.memberId);
    if (!profile) {
      throw new Error("Member profile not found");
    }

    await ctx.db.patch(args.memberId, {
      customerId: args.customerId,
      updatedAt: Date.now(),
    });

    return { ...profile, customerId: args.customerId };
  },
});

/**
 * Get member profile by ID
 */
export const getMemberProfile = query({
  args: { memberId: v.id("memberProfiles") },
  handler: async (ctx: QueryCtx, args: any) => {
    // Authenticated users can view member profiles
    await requireAuth(ctx);
    
    return await ctx.db.get(args.memberId);
  },
});

/**
 * Get member profile by member ID string
 */
export const getMemberByMemberId = query({
  args: { memberId: v.string() },
  handler: async (ctx: QueryCtx, args: any) => {
    // Authenticated users can view member profiles
    await requireAuth(ctx);
    
    return await ctx.db
      .query("memberProfiles")
      .withIndex("by_member_id", (q: any) => q.eq("memberId", args.memberId))
      .first();
  },
});

/**
 * Get member profiles by group
 */
export const getMembersByGroup = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx: QueryCtx, args: any) => {
    return await ctx.db
      .query("memberProfiles")
      .withIndex("by_group", (q: any) => q.eq("groupId", args.groupId))
      .collect();
  },
});

/**
 * Get member profiles by status
 */
export const getMembersByStatus = query({
  args: {
    siteId: v.id("sites"),
    status: v.union(
      v.literal("active"),
      v.literal("inactive"),
      v.literal("suspended"),
      v.literal("terminated")
    ),
  },
  handler: async (ctx: QueryCtx, args: any) => {
    return await ctx.db
      .query("memberProfiles")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .collect();
  },
});

/**
 * Get member profile by Clerk user ID
 */
export const getMemberByClerkId = query({
  args: { clerkUserId: v.string() },
  handler: async (ctx: QueryCtx, args: any) => {
    // Authenticated users can view member profiles
    await requireAuth(ctx);
    
    return await ctx.db
      .query("memberProfiles")
      .withIndex("by_customer", (q: any) => q.eq("customerId", args.clerkUserId))
      .first();
  },
});

/**
 * Add member activity entry
 */
export const addMemberActivity = mutation({
  args: {
    memberProfileId: v.id("memberProfiles"),
    siteId: v.id("sites"),
    groupId: v.id("groups"),
    activityType: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    metadata: v.optional(v.any()),
    actorType: v.union(
      v.literal("system"),
      v.literal("member"),
      v.literal("staff"),
      v.literal("admin")
    ),
    actorId: v.optional(v.string()),
    actorName: v.optional(v.string()),
  },
  handler: async (ctx: MutationCtx, args: any) => {
    return await ctx.db.insert("memberActivities", {
      memberProfileId: args.memberProfileId,
      siteId: args.siteId,
      groupId: args.groupId,
      activityType: args.activityType as any,
      title: args.title,
      description: args.description,
      metadata: args.metadata,
      actorType: args.actorType,
      actorId: args.actorId,
      actorName: args.actorName,
      createdAt: Date.now(),
    });
  },
});

/**
 * Get member activities
 */
export const getMemberActivities = query({
  args: {
    memberProfileId: v.id("memberProfiles"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx: QueryCtx, args: any) => {
    const activities = await ctx.db
      .query("memberActivities")
      .withIndex("by_member", (q) => q.eq("memberProfileId", args.memberProfileId))
      .order("desc")
      .take(args.limit || 50);

    return activities;
  },
});

/**
 * Create a lead from admin enrollment launcher
 * Called when a salesperson/broker starts enrolling a new client
 * Sets assignedStaffId to link the lead to the enrolling broker
 */
export const createLeadFromAdmin = mutation({
  args: {
    siteId: v.id("sites"),
    accountId: v.id("accounts"),
    groupId: v.id("groups"),
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    phone: v.string(),
    assignedStaffClerkId: v.string(), // Clerk user ID of the enrolling agent
    assignedStaffName: v.string(), // Display name of the enrolling agent
    enrollmentType: v.optional(
      v.union(
        v.literal("individual"),
        v.literal("group_member"),
        v.literal("group_employer")
      )
    ),
  },
  handler: async (ctx: MutationCtx, args: any) => {
    const now = Date.now();

    // Look up the admin user by their Clerk ID to get their Convex ID
    const adminUser = await ctx.db
      .query("adminUsers")
      .withIndex("by_clerk_id", (q: any) => q.eq("clerkUserId", args.assignedStaffClerkId))
      .first();

    if (!adminUser) {
      throw new Error("Admin user not found");
    }

    const { _id: profile, memberId } = await createMemberProfileShared(ctx, {
      groupId: args.groupId,
      firstName: args.firstName,
      lastName: args.lastName,
      email: args.email,
      phone: args.phone,
      memberType: "lead",
      leadType: "partner",
      signupSource: "admin_enrollment",
      assignedStaffId: adminUser._id,
      assignedStaffName: args.assignedStaffName,
    });

    // Log activity
    await ctx.db.insert("memberActivities", {
      memberProfileId: profile,
      siteId: args.siteId,
      groupId: args.groupId,
      activityType: "lead_created",
      title: "Lead created by staff",
      description: `Lead created by ${args.assignedStaffName} via admin enrollment`,
      actorType: "staff",
      actorId: args.assignedStaffClerkId,
      actorName: args.assignedStaffName,
      createdAt: now,
    });

    // Return both the Convex record ID and the human-readable member ID
    return {
      _id: profile,
      memberId,
    };
  },
});

/**
 * Get lead by member ID string
 * Used to fetch pre-filled lead data when enrollment page opens with ?lead= param
 */
export const getLeadByMemberId = query({
  args: { memberId: v.string() },
  handler: async (ctx: QueryCtx, args: any) => {
    const lead = await ctx.db
      .query("memberProfiles")
      .withIndex("by_member_id", (q: any) => q.eq("memberId", args.memberId))
      .first();

    if (!lead) {
      return null;
    }

    // Return only the fields needed for pre-population in the PersonalInfoStep
    return {
      _id: lead._id,
      memberId: lead.memberId,
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      phone: lead.phone,
      assignedStaffName: lead.assignedStaffName,
    };
  },
});

/**
 * Add member note
 */
export const addMemberNote = mutation({
  args: {
    memberProfileId: v.id("memberProfiles"),
    siteId: v.id("sites"),
    content: v.string(),
    noteType: v.union(
      v.literal("general"),
      v.literal("enrollment"),
      v.literal("billing"),
      v.literal("support"),
      v.literal("compliance"),
      v.literal("follow_up"),
      v.literal("internal")
    ),
    authorId: v.string(), // Clerk user ID
    authorName: v.string(),
    isPinned: v.optional(v.boolean()),
  },
  handler: async (ctx: MutationCtx, args: any) => {
    const noteId = await ctx.db.insert("memberNotes", {
      memberProfileId: args.memberProfileId,
      siteId: args.siteId,
      content: args.content,
      noteType: args.noteType,
      authorId: args.authorId,
      authorName: args.authorName,
      isPinned: args.isPinned ?? false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Log activity
    await ctx.db.insert("memberActivities", {
      memberProfileId: args.memberProfileId,
      siteId: args.siteId,
      groupId: ((await ctx.db.get(args.memberProfileId)) as any)?.groupId!,
      activityType: "note_added",
      title: "Note added",
      actorType: "staff",
      actorId: args.authorId,
      actorName: args.authorName,
      createdAt: Date.now(),
    });

    return noteId;
  },
});

/**
 * Look up a member profile by Clerk customerId.
 * Used by Stripe sync to check if a member already exists.
 */
export const getMemberByCustomerId = query({
  args: { customerId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("memberProfiles")
      .withIndex("by_customer", (q: any) => q.eq("customerId", args.customerId))
      .first();
  },
});
