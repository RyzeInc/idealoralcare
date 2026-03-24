/**
 * DEPENDENT MANAGEMENT
 *
 * Mutations and queries for managing dependents (family sub-members) under a
 * primary account holder. Dependents get full plan access (entitlements are
 * derived from the primary's bundle) but cannot manage billing.
 *
 * Flow:
 *   1. Primary adds a dependent → new memberProfile created with memberRole="dependent"
 *   2. A one-time invite token is generated and emailed to the dependent
 *   3. Dependent follows the link, creates a Clerk account, claims the profile
 *   4. Access checks fan out to the primary's entitlements so no duplicate billing rows
 */

import { mutation, query, internalMutation, internalAction } from "../_generated/server";
import { getBaseUrl } from "../lib/env";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../lib/authGuards";
import { internal } from "../_generated/api";

// ---------------------------------------------------------------------------
// Helpers (mirrors members.ts utilities)
// ---------------------------------------------------------------------------

function generateMemberId(sequence: number): string {
  return String(100000000 + sequence).slice(0, 9);
}

function generateBarcode(siteSlug: string): string {
  const year = String(new Date().getFullYear()).slice(2);
  const sitePrefix = siteSlug.slice(0, 3).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${sitePrefix}${year}${random}`;
}

// ---------------------------------------------------------------------------
// Internal Actions
// ---------------------------------------------------------------------------

/**
 * Send a dependent invite email via Resend.
 * Scheduled from addDependent and resendDependentInvite mutations.
 */
export const sendDependentInviteEmail = internalAction({
  args: {
    dependentFirstName: v.string(),
    dependentEmail: v.string(),
    primaryMemberName: v.string(),
    planName: v.string(),
    inviteToken: v.string(),
  },
  handler: async (_ctx, args) => {
    const baseUrl = getBaseUrl();
    const claimUrl = `${baseUrl}/health/claim-invite?token=${args.inviteToken}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="background: linear-gradient(135deg, #0066CC 0%, #14b8a6 100%); color: white; padding: 24px 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">You&apos;re Invited!</h1>
          <p style="margin: 10px 0 0 0; font-size: 15px; opacity: 0.9;">Family plan access from Ideal Oral Health</p>
        </div>
        <div style="padding: 32px; background: #f9fafb; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px;">Hi ${args.dependentFirstName},</p>
          <p style="font-size: 15px; line-height: 1.6;">
            <strong>${args.primaryMemberName}</strong> has added you to their
            <strong>${args.planName}</strong> plan. As a family member on this plan, you&apos;ll get
            full access to all plan benefits &mdash; with no separate billing.
          </p>
          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; margin: 24px 0; text-align: center;">
            <p style="font-size: 15px; color: #374151; margin: 0 0 16px 0;">
              Click the button below to create your account and activate your access.
            </p>
            <a href="${claimUrl}"
              style="display: inline-block; padding: 14px 32px; background: #0066CC; color: white; font-weight: 700; font-size: 16px; text-decoration: none; border-radius: 8px;">
              Accept &amp; Get Access
            </a>
            <p style="font-size: 12px; color: #9ca3af; margin: 16px 0 0 0;">This link expires in 30 days.</p>
          </div>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="font-size: 13px; color: #6b7280; line-height: 1.5;">
            If you don&apos;t want to be added to this plan, you can simply ignore this email.
            Questions? Contact us at
            <a href="mailto:info@getidealoh.com" style="color: #0066CC;">info@getidealoh.com</a>
            or <a href="tel:801-820-0010" style="color: #0066CC;">801-820-0010</a>.
          </p>
        </div>
      </div>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Ideal Oral Health <noreply@getidealoh.com>",
        to: args.dependentEmail,
        subject: `${args.primaryMemberName} added you to their Ideal Oral Health plan`,
        html,
        tags: [{ name: "category", value: "dependent-invite" }],
      }),
    });

    const resData = await res.json();

    if (!res.ok) {
      // resData.message is the Resend error description
      throw new Error(`Resend error ${res.status}: ${resData.message ?? JSON.stringify(resData)}`);
    }

    console.log(`[dependentInvite] Email sent. Resend ID: ${resData.id} → ${args.dependentEmail}`);
  },
});

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * List all dependents linked to the current user's primary member profile.
 */
export const getMyDependents = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    try {
      const identity = await requireAuth(ctx);

      // Resolve the caller's primary member profile
      const primaryProfile = await ctx.db
        .query("memberProfiles")
        .withIndex("by_customer", (q) => q.eq("customerId", identity.clerkUserId))
        .filter((q) => q.neq(q.field("status"), "terminated"))
        .first();

      if (!primaryProfile) return [];

      // Only primary members own dependents
      if ((primaryProfile as any).memberRole === "dependent") return [];

      const dependents = await ctx.db
        .query("memberProfiles")
        .withIndex("by_primary_member", (q) =>
          q.eq("primaryMemberId", primaryProfile._id)
        )
        .filter((q) => q.neq(q.field("status"), "terminated"))
        .collect();

      return dependents.map((d) => ({
        _id: d._id,
        memberId: d.memberId,
        firstName: d.firstName,
        lastName: d.lastName,
        email: d.email || "",
        dateOfBirth: d.dateOfBirth,
        relationship: (d as any).relationship as string | undefined,
        memberRole: (d as any).memberRole as string,
        inviteStatus: (d as any).inviteStatus as string | undefined,
        invitedEmail: (d as any).invitedEmail as string | undefined,
        hasClaimed: !!(d as any).customerId,
        status: d.status,
        createdAt: d.createdAt,
      }));
    } catch (error) {
      console.error("[getMyDependents] Error:", error);
      throw error;
    }
  },
});

/**
 * If the current user is a dependent, return their primary member's profile.
 * Used by dependent dashboard to show "Managed by" info.
 */
export const getMyPrimaryMember = query({
  args: {},
  handler: async (ctx: QueryCtx) => {
    const identity = await requireAuth(ctx);

    const myProfile = await ctx.db
      .query("memberProfiles")
      .withIndex("by_customer", (q) => q.eq("customerId", identity.clerkUserId))
      .first();

    if (!myProfile) return null;
    if ((myProfile as any).memberRole !== "dependent") return null;

    const primaryMemberId = (myProfile as any).primaryMemberId;
    if (!primaryMemberId) return null;

    const primary = await ctx.db.get(primaryMemberId) as any;
    if (!primary) return null;

    return {
      _id: primary._id,
      firstName: primary.firstName,
      lastName: primary.lastName,
      email: primary.email,
    };
  },
});

/**
 * Look up a dependent profile by invite token.
 * Used on the claim-invite page to verify a token before prompting sign-up.
 */
export const getProfileByInviteToken = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx: QueryCtx, args) => {
    // Never return sensitive fields — only safe display data
    const profile = await ctx.db
      .query("memberProfiles")
      .withIndex("by_invite_token", (q) => q.eq("inviteToken", args.token))
      .first();

    if (!profile) return null;
    if ((profile as any).inviteStatus !== "pending") return null;

    // Fetch primary member's name for the welcome message
    const primaryMemberId = (profile as any).primaryMemberId;
    const primary = primaryMemberId ? await ctx.db.get(primaryMemberId) as any : null;

    return {
      _id: profile._id,
      firstName: profile.firstName,
      lastName: profile.lastName,
      invitedEmail: (profile as any).invitedEmail as string,
      inviteStatus: (profile as any).inviteStatus as string,
      relationship: (profile as any).relationship as string | undefined,
      primaryMemberName: primary
        ? `${primary.firstName} ${primary.lastName}`
        : null,
    };
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Add a dependent under the authenticated primary member.
 * Creates a full memberProfile for the dependent with:
 *   - memberRole: "dependent"
 *   - primaryMemberId pointing to the caller's profile
 *   - A one-time inviteToken for account claim
 */
export const addDependent = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    dateOfBirth: v.optional(v.string()),
    relationship: v.union(
      v.literal("spouse"),
      v.literal("child"),
      v.literal("domestic_partner"),
      v.literal("other")
    ),
  },
  handler: async (ctx: MutationCtx, args) => {
    const identity = await requireAuth(ctx);

    // Auto-resolve primary profile from the authenticated user's Clerk ID
    const primaryProfile = await ctx.db
      .query("memberProfiles")
      .withIndex("by_customer", (q) => q.eq("customerId", identity.clerkUserId))
      .filter((q) => q.neq(q.field("status"), "terminated"))
      .first();
    if (!primaryProfile) throw new Error("No active member profile found for your account");
    if ((primaryProfile as any).memberRole === "dependent") {
      throw new Error("Dependents cannot add their own dependents");
    }

    // Generate IDs
    const memberCount = await ctx.db
      .query("memberProfiles")
      .withIndex("by_site", (q: any) => q.eq("siteId", primaryProfile.siteId))
      .collect();

    const memberId = generateMemberId(memberCount.length + 1);
    const barcode = generateBarcode("default");
    const inviteToken = crypto.randomUUID();
    const now = Date.now();

    const dependentId = await ctx.db.insert("memberProfiles", {
      memberId,
      barcode,
      siteId: primaryProfile.siteId,
      accountId: primaryProfile.accountId,
      groupId: primaryProfile.groupId,
      firstName: args.firstName,
      lastName: args.lastName,
      email: args.email,
      dateOfBirth: args.dateOfBirth,
      // Dependent-specific fields
      memberRole: "dependent" as any,
      primaryMemberId: primaryProfile._id as any,
      relationship: args.relationship as any,
      inviteToken,
      inviteStatus: "pending" as any,
      invitedEmail: args.email as any,
      // Dependent starts as "enrolling" until they claim their account
      memberType: "enrolling" as any,
      status: "active",
      communicationPrefs: {
        emailOptIn: true,
        smsOptIn: true,
        callOptIn: true,
      },
      createdAt: now,
      updatedAt: now,
    } as any);

    // Activity log on primary's timeline
    await ctx.db.insert("memberActivities", {
      memberProfileId: primaryProfile._id,
      siteId: primaryProfile.siteId,
      groupId: primaryProfile.groupId,
      activityType: "dependent_added" as any,
      title: "Dependent added",
      description: `${args.firstName} ${args.lastName} (${args.relationship}) added as dependent`,
      actorType: "member",
      actorId: identity.clerkUserId,
      createdAt: now,
    });

    // Schedule invite email (fires immediately after the mutation commits)
    // @ts-ignore — Convex circular self-reference causes deep type instantiation
    await ctx.scheduler.runAfter(0, internal.enrollment.dependents.sendDependentInviteEmail, {
      dependentFirstName: args.firstName,
      dependentEmail: args.email,
      primaryMemberName: `${primaryProfile.firstName} ${primaryProfile.lastName}`,
      planName: "Ideal Oral Health",
      inviteToken,
    });

    return { dependentId, inviteToken };
  },
});

/**
 * Internal version of addDependent — called by the Stripe webhook after successful
 * checkout to create dependent profiles from the enrollment session data.
 */
export const internalAddDependent = internalMutation({
  args: {
    primaryMemberProfileId: v.id("memberProfiles"),
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    dateOfBirth: v.optional(v.string()),
    relationship: v.union(
      v.literal("spouse"),
      v.literal("child"),
      v.literal("domestic_partner"),
      v.literal("other")
    ),
  },
  handler: async (ctx: MutationCtx, args) => {
    const primaryProfile = await ctx.db.get(args.primaryMemberProfileId);
    if (!primaryProfile) throw new Error("Primary member profile not found");

    const memberCount = await ctx.db
      .query("memberProfiles")
      .withIndex("by_site", (q: any) => q.eq("siteId", primaryProfile.siteId))
      .collect();

    const memberId = generateMemberId(memberCount.length + 1);
    const barcode = generateBarcode("default");
    const inviteToken = crypto.randomUUID();
    const now = Date.now();

    const dependentId = await ctx.db.insert("memberProfiles", {
      memberId,
      barcode,
      siteId: primaryProfile.siteId,
      accountId: primaryProfile.accountId,
      groupId: primaryProfile.groupId,
      firstName: args.firstName,
      lastName: args.lastName,
      email: args.email,
      dateOfBirth: args.dateOfBirth,
      memberRole: "dependent" as any,
      primaryMemberId: args.primaryMemberProfileId as any,
      relationship: args.relationship as any,
      inviteToken,
      inviteStatus: "pending" as any,
      invitedEmail: args.email as any,
      // Dependent starts as "enrolling" until they claim their account
      memberType: "enrolling" as any,
      status: "active",
      communicationPrefs: {
        emailOptIn: true,
        smsOptIn: true,
        callOutIn: true,
      },
      createdAt: now,
      updatedAt: now,
    } as any);

    await ctx.db.insert("memberActivities", {
      memberProfileId: args.primaryMemberProfileId,
      siteId: primaryProfile.siteId,
      groupId: primaryProfile.groupId,
      activityType: "dependent_added" as any,
      title: "Dependent added (system)",
      description: `${args.firstName} ${args.lastName} added during checkout`,
      actorType: "system",
      createdAt: now,
    });

    return { dependentId, inviteToken };
  },
});

/**
 * Remove a dependent from the primary member's account.
 * Sets the dependent's status to "terminated" (soft delete).
 */
export const removeDependent = mutation({
  args: {
    dependentProfileId: v.id("memberProfiles"),
  },
  handler: async (ctx: MutationCtx, args) => {
    const identity = await requireAuth(ctx);

    const dependentProfile = await ctx.db.get(args.dependentProfileId);
    if (!dependentProfile) throw new Error("Dependent profile not found");
    if ((dependentProfile as any).memberRole !== "dependent") {
      throw new Error("Profile is not a dependent");
    }

    // Verify caller owns the primary
    const primaryMemberId = (dependentProfile as any).primaryMemberId;
    if (!primaryMemberId) throw new Error("Dependent has no primary member");

    const primaryProfile = await ctx.db.get(primaryMemberId) as any;
    if (!primaryProfile || primaryProfile.customerId !== identity.clerkUserId) {
      throw new Error("Unauthorized: you can only remove dependents from your own profile");
    }

    const now = Date.now();

    await ctx.db.patch(args.dependentProfileId, {
      status: "terminated",
      memberType: "terminated" as any,
      updatedAt: now,
    });

    await ctx.db.insert("memberActivities", {
      memberProfileId: primaryMemberId,
      siteId: primaryProfile.siteId,
      groupId: primaryProfile.groupId,
      activityType: "dependent_removed" as any,
      title: "Dependent removed",
      description: `${dependentProfile.firstName} ${dependentProfile.lastName} removed`,
      actorType: "member",
      actorId: identity.clerkUserId,
      createdAt: now,
    });

    return { success: true };
  },
});

/**
 * Claim a dependent profile using an invite token.
 * Called after the dependent creates their Clerk account.
 * Binds their Clerk user ID to the memberProfile so they can log in.
 */
export const claimDependentProfile = mutation({
  args: {
    inviteToken: v.string(),
  },
  handler: async (ctx: MutationCtx, args) => {
    const identity = await requireAuth(ctx);

    const profile = await ctx.db
      .query("memberProfiles")
      .withIndex("by_invite_token", (q) => q.eq("inviteToken", args.inviteToken))
      .first();

    if (!profile) throw new Error("Invalid invite token");
    if ((profile as any).inviteStatus !== "pending") {
      throw new Error("This invite has already been used or has expired");
    }

    // Ensure this Clerk ID isn't already bound to another profile
    const existingProfile = await ctx.db
      .query("memberProfiles")
      .withIndex("by_customer", (q) => q.eq("customerId", identity.clerkUserId))
      .first();

    if (existingProfile && existingProfile._id !== profile._id) {
      throw new Error("Your account is already linked to a different member profile");
    }

    const now = Date.now();

    await ctx.db.patch(profile._id, {
      customerId: identity.clerkUserId,
      inviteStatus: "claimed" as any,
      inviteToken: undefined as any, // Consume the token
      memberType: "active" as any, // Promote from "enrolling" → "active" on claim
      updatedAt: now,
    });

    // Log on the dependent's own timeline
    await ctx.db.insert("memberActivities", {
      memberProfileId: profile._id,
      siteId: profile.siteId,
      groupId: profile.groupId,
      activityType: "dependent_claimed" as any,
      title: "Profile claimed",
      description: "Dependent account successfully linked",
      actorType: "member",
      actorId: identity.clerkUserId,
      createdAt: now,
    });

    return { success: true, memberId: profile.memberId };
  },
});

/**
 * Resend the invite for a dependent.
 * Regenerates the inviteToken (invalidating the old link) and resets status to "pending".
 */
export const resendDependentInvite = mutation({
  args: {
    dependentProfileId: v.id("memberProfiles"),
  },
  handler: async (ctx: MutationCtx, args) => {
    const identity = await requireAuth(ctx);

    const dependentProfile = await ctx.db.get(args.dependentProfileId);
    if (!dependentProfile) throw new Error("Dependent profile not found");
    if ((dependentProfile as any).memberRole !== "dependent") {
      throw new Error("Profile is not a dependent");
    }
    if ((dependentProfile as any).inviteStatus === "claimed") {
      throw new Error("This dependent has already claimed their account");
    }

    // Ownership check
    const primaryMemberId = (dependentProfile as any).primaryMemberId;
    const primaryProfile = primaryMemberId ? await ctx.db.get(primaryMemberId) as any : null;
    if (!primaryProfile || primaryProfile.customerId !== identity.clerkUserId) {
      throw new Error("Unauthorized");
    }

    const newToken = crypto.randomUUID();
    const now = Date.now();

    await ctx.db.patch(args.dependentProfileId, {
      inviteToken: newToken as any,
      inviteStatus: "pending" as any,
      updatedAt: now,
    });

    await ctx.db.insert("memberActivities", {
      memberProfileId: primaryMemberId,
      siteId: primaryProfile.siteId,
      groupId: primaryProfile.groupId,
      activityType: "dependent_invited" as any,
      title: "Invite resent",
      description: `New invite sent to ${dependentProfile.firstName} ${dependentProfile.lastName}`,
      actorType: "member",
      actorId: identity.clerkUserId,
      createdAt: now,
    });

    // Schedule resend email
    // @ts-ignore — Convex circular self-reference causes deep type instantiation
    await ctx.scheduler.runAfter(0, internal.enrollment.dependents.sendDependentInviteEmail, {
      dependentFirstName: dependentProfile.firstName,
      dependentEmail: (dependentProfile as any).invitedEmail ?? dependentProfile.email ?? "",
      primaryMemberName: `${primaryProfile.firstName} ${primaryProfile.lastName}`,
      planName: "Ideal Oral Health",
      inviteToken: newToken,
    });

    return { newToken };
  },
});
