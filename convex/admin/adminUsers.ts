import { action, internalMutation, mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { requireAdmin, requireAuth } from "../lib/authGuards";
import { getBaseUrl } from "../lib/env";
import { sendViaGmail } from "../lib/gmail";
import { autoGrantFreeAccess } from "./grantFreeAccess";

// Check if user is admin (adminUsers table OR active distribution partner)
export const isAdmin = query({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    const admin = await ctx.db
      .query("adminUsers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();
    if (admin) return true;

    // Program Managers, FMOs, and Agencies with a clerkUserId get portal access
    const partner = await ctx.db
      .query("distributionPartners")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();
    return !!partner && partner.status === "active";
  },
});

// Get admin user
export const getByClerkId = query({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    // Public query - access control at page level (/admin layout verifies admin role)
    return await ctx.db
      .query("adminUsers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();
  },
});

// Get all admin users
// Get all admin users (public query - access control at page level)
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    // Public - the /admin layout already verifies admin role
    // This prevents auth dependency issues on client-side component mount
    return await ctx.db.query("adminUsers").collect();
  },
});

// Get current authenticated admin's profile
export const getMyAdminProfile = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireAuth(ctx);
    const admin = await ctx.db
      .query("adminUsers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.clerkUserId))
      .first();
    return admin || null;
  },
});

// Get all brokers (adminUsers with "broker" department)
export const getBrokersByDepartment = query({
  args: {},
  handler: async (ctx) => {
    // Public query - fetch all users with broker department
    const allAdmins = await ctx.db.query("adminUsers").collect();
    return allAdmins.filter((admin) =>
      admin.departments?.includes("broker") ?? false
    );
  },
});

// Add admin user
export const add = mutation({
  args: {
    clerkUserId: v.string(),
    email: v.string(),
    name: v.string(),
    phone: v.optional(v.string()),
    role: v.union(v.literal("owner"), v.literal("editor")),
    departments: v.array(
      v.union(
        v.literal("program_manager"),
        v.literal("fmo"),
        v.literal("broker"),
        v.literal("sales"),
        v.literal("hr"),
        v.literal("executive"),
        v.literal("admin")
      )
    ),
    commissionRate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    // Check if already exists
    const existing = await ctx.db
      .query("adminUsers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();

    if (existing) {
      return existing._id;
    }

    const id = await ctx.db.insert("adminUsers", {
      clerkUserId: args.clerkUserId,
      email: args.email,
      name: args.name,
      phone: args.phone,
      role: args.role,
      departments: args.departments,
      commissionRate: args.commissionRate,
      createdAt: Date.now(),
    });

    // Automatically grant free platform access to all new team members
    await autoGrantFreeAccess(
      ctx,
      args.clerkUserId,
      `Auto-granted on team member addition (${args.departments.join(", ")})`
    );

    return id;
  },
});

// Update admin role
export const updateRole = mutation({
  args: {
    id: v.id("adminUsers"),
    role: v.union(v.literal("owner"), v.literal("editor")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.id, { role: args.role });
  },
});

// Update admin user (name, email, phone, departments, commission rate)
export const updateAdmin = mutation({
  args: {
    id: v.id("adminUsers"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    departments: v.optional(
      v.array(
        v.union(
          v.literal("program_manager"),
          v.literal("fmo"),
          v.literal("broker"),
          v.literal("sales"),
          v.literal("hr"),
          v.literal("executive"),
          v.literal("admin")
        )
      )
    ),
    commissionRate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

// Remove admin user
export const remove = mutation({
  args: { id: v.id("adminUsers") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});

// Initialize first admin (call this after first Clerk signup)
export const initializeFirstAdmin = mutation({
  args: {
    clerkUserId: v.string(),
    email: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    // Check if any admins exist
    const existingAdmins = await ctx.db.query("adminUsers").first();
    if (existingAdmins) {
      // If admins exist, this should be called through add() instead
      return null;
    }

    // First user becomes owner with admin department
    return await ctx.db.insert("adminUsers", {
      clerkUserId: args.clerkUserId,
      email: args.email,
      name: args.name,
      role: "owner",
      departments: ["admin"],
      createdAt: Date.now(),
    });
  },
});

// Bootstrap first admin without auth (CLI/one-time use only)
// Safe: only runs when zero admins exist in the database
export const bootstrapFirstAdmin = internalMutation({
  args: {
    clerkUserId: v.string(),
    email: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const existingAdmins = await ctx.db.query("adminUsers").first();
    if (existingAdmins) {
      return { status: "already_exists" };
    }
    const id = await ctx.db.insert("adminUsers", {
      clerkUserId: args.clerkUserId,
      email: args.email,
      name: args.name,
      role: "owner",
      departments: ["admin"],
      createdAt: Date.now(),
    });
    return { status: "created", id };
  },
});

// ============================================
// ADMIN INVITATIONS
// ============================================

const departmentValidator = v.union(
  v.literal("program_manager"),
  v.literal("fmo"),
  v.literal("broker"),
  v.literal("sales"),
  v.literal("hr"),
  v.literal("executive"),
  v.literal("admin")
);

/** Get all admin invites */
export const getAllInvites = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("adminInvites").collect();
  },
});

/** Look up an admin invite by token (public — used on claim page) */
export const getInviteByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("adminInvites")
      .withIndex("by_token", (q) => q.eq("inviteToken", args.token))
      .first();
  },
});

/** Internal: create the adminInvites record */
export const _createAdminInvite = internalMutation({
  args: {
    email: v.string(),
    name: v.string(),
    role: v.union(v.literal("owner"), v.literal("editor")),
    departments: v.array(departmentValidator),
    commissionRate: v.optional(v.number()),
    inviteToken: v.string(),
    inviteExpiry: v.number(),
    invitedBy: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("adminInvites", {
      email: args.email,
      name: args.name,
      role: args.role,
      departments: args.departments,
      commissionRate: args.commissionRate,
      inviteToken: args.inviteToken,
      inviteStatus: "pending",
      inviteExpiry: args.inviteExpiry,
      invitedBy: args.invitedBy,
      createdAt: Date.now(),
    });
  },
});

/** Internal: update invite token (for resend) */
export const _updateAdminInviteToken = internalMutation({
  args: {
    inviteId: v.id("adminInvites"),
    token: v.string(),
    expiry: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.inviteId, {
      inviteToken: args.token,
      inviteStatus: "pending",
      inviteExpiry: args.expiry,
    });
  },
});

/** Internal: verify admin (used by actions) */
export const _verifyAdminForInvite = internalMutation({
  args: {},
  handler: async (ctx) => {
    const identity = await requireAdmin(ctx);
    return identity;
  },
});

/** Send invite email via Gmail SMTP */
async function dispatchAdminInviteEmail(opts: {
  recipientName: string;
  recipientEmail: string;
  role: string;
  claimUrl: string;
}): Promise<{ ok: boolean; error?: string }> {
  const roleLabel = opts.role === "owner" ? "Owner (Full Access)" : "Editor (Operational Access)";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <div style="background: linear-gradient(135deg, #0066CC 0%, #14b8a6 100%); color: white; padding: 24px 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">You're Invited to Ideal Health Admin</h1>
        <p style="margin: 10px 0 0 0; font-size: 15px; opacity: 0.9;">Role: ${roleLabel}</p>
      </div>
      <div style="padding: 32px; background: #f9fafb; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px;">Hi ${opts.recipientName},</p>
        <p style="font-size: 15px; line-height: 1.6;">
          You've been invited to join the <strong>Ideal Health Admin Portal</strong>.
          Click the button below to create your account and activate your admin access.
        </p>
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; margin: 24px 0; text-align: center;">
          <p style="font-size: 15px; color: #374151; margin: 0 0 16px 0;">
            Your role: <strong>${roleLabel}</strong>
          </p>
          <a href="${opts.claimUrl}"
            style="display: inline-block; padding: 14px 32px; background: #0066CC; color: white; font-weight: 700; font-size: 16px; text-decoration: none; border-radius: 8px;">
            Accept Invite &amp; Create Account
          </a>
          <p style="font-size: 12px; color: #9ca3af; margin: 16px 0 0 0;">This link expires in 30 days.</p>
        </div>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="font-size: 13px; color: #6b7280; line-height: 1.5;">
          Questions? Contact us at
          <a href="mailto:support@getidealoh.com" style="color: #0066CC;">support@getidealoh.com</a>.
        </p>
      </div>
    </div>`;

  const result = await sendViaGmail({
    to: opts.recipientEmail,
    subject: "You're invited to Ideal Health Admin Portal",
    html,
  });

  return { ok: result.success, error: result.error };
}

/**
 * Invite a new admin user.
 * Creates an invite record and sends the invite email.
 */
export const inviteAdmin = action({
  args: {
    email: v.string(),
    name: v.string(),
    role: v.union(v.literal("owner"), v.literal("editor")),
    departments: v.array(departmentValidator),
    commissionRate: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{
    inviteId: string;
    inviteSent: boolean;
    inviteError?: string;
  }> => {
    const identity = await ctx.runMutation(internal.admin.adminUsers._verifyAdminForInvite, {});

    const token = `adm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
    const baseUrl = getBaseUrl();
    const claimUrl = `${baseUrl}/health/claim-invite?token=${token}&source=admin`;

    const inviteId = await ctx.runMutation(
      internal.admin.adminUsers._createAdminInvite,
      {
        email: args.email,
        name: args.name,
        role: args.role,
        departments: args.departments.length > 0 ? args.departments : ["admin"],
        commissionRate: args.commissionRate,
        inviteToken: token,
        inviteExpiry: expiry,
        invitedBy: identity.clerkUserId,
      }
    );

    const emailResult = await dispatchAdminInviteEmail({
      recipientName: args.name,
      recipientEmail: args.email,
      role: args.role,
      claimUrl,
    });

    return {
      inviteId,
      inviteSent: emailResult.ok,
      inviteError: emailResult.error,
    };
  },
});

/**
 * Resend an admin invite (generates a new token).
 */
export const resendAdminInvite = action({
  args: { inviteId: v.id("adminInvites") },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    await ctx.runMutation(internal.admin.adminUsers._verifyAdminForInvite, {});

    const invite = await ctx.runMutation(internal.admin.adminUsers._getInviteById, {
      inviteId: args.inviteId,
    });
    if (!invite || invite.inviteStatus !== "pending") {
      return { success: false, error: "Invite not found or already claimed" };
    }

    const token = `adm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const baseUrl = getBaseUrl();
    const claimUrl = `${baseUrl}/health/claim-invite?token=${token}&source=admin`;

    await ctx.runMutation(internal.admin.adminUsers._updateAdminInviteToken, {
      inviteId: args.inviteId,
      token,
      expiry,
    });

    const emailResult = await dispatchAdminInviteEmail({
      recipientName: invite.name,
      recipientEmail: invite.email,
      role: invite.role,
      claimUrl,
    });

    return { success: emailResult.ok, error: emailResult.error };
  },
});

/** Internal query: get invite by ID (for actions) */
export const _getInviteById = internalMutation({
  args: { inviteId: v.id("adminInvites") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.inviteId);
  },
});

/** Cancel a pending invite */
export const cancelAdminInvite = mutation({
  args: { inviteId: v.id("adminInvites") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const invite = await ctx.db.get(args.inviteId);
    if (!invite) throw new Error("Invite not found");
    if (invite.inviteStatus === "claimed") throw new Error("Cannot cancel a claimed invite");
    await ctx.db.patch(args.inviteId, { inviteStatus: "cancelled" });
  },
});

/**
 * Claim an admin invite.
 * Called after the invited user creates a Clerk account and signs in.
 * Creates the adminUsers record and grants free access.
 */
export const claimAdminInvite = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    const invite = await ctx.db
      .query("adminInvites")
      .withIndex("by_token", (q) => q.eq("inviteToken", args.token))
      .first();

    if (!invite) throw new Error("Invalid or expired invite token");
    if (invite.inviteStatus === "claimed") throw new Error("This invite has already been claimed");
    if (invite.inviteStatus === "cancelled") throw new Error("This invite has been cancelled");
    if (invite.inviteExpiry < Date.now()) {
      throw new Error("This invite link has expired. Please ask for a new one.");
    }

    // Check if this clerkUserId already has an adminUsers record
    const existing = await ctx.db
      .query("adminUsers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.clerkUserId))
      .first();

    if (!existing) {
      await ctx.db.insert("adminUsers", {
        clerkUserId: identity.clerkUserId,
        email: invite.email,
        name: invite.name,
        role: invite.role,
        departments: invite.departments,
        commissionRate: invite.commissionRate,
        createdAt: Date.now(),
      });
    }

    // Mark invite as claimed
    await ctx.db.patch(invite._id, {
      inviteStatus: "claimed",
      clerkUserId: identity.clerkUserId,
    });

    // Grant free platform access
    await autoGrantFreeAccess(
      ctx,
      identity.clerkUserId,
      `Auto-granted on admin invite claim (${invite.role} — ${invite.departments?.join(", ") ?? "admin"})`
    );

    return { name: invite.name, role: invite.role };
  },
});