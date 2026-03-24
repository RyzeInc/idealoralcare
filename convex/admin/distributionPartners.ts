import { action, mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin, requireAuth } from "../lib/authGuards";
import { autoGrantFreeAccess } from "./grantFreeAccess";

const partnerTypeValidator = v.union(
  v.literal("program_manager"),
  v.literal("fmo"),
  v.literal("agency"),
);

const statusValidator = v.union(
  v.literal("active"),
  v.literal("inactive"),
  v.literal("suspended"),
);

/** All distribution partners */
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("distributionPartners").collect();
  },
});

/** All partners with enrollment and member counts */
export const getAllWithStats = query({
  args: {},
  handler: async (ctx) => {
    const partners = await ctx.db.query("distributionPartners").collect();
    const sessions = await ctx.db.query("enrollmentSessions").collect();
    const members = await ctx.db.query("memberProfiles").collect();
    const codes = await ctx.db.query("brokerTrackingCodes").collect();

    return partners.map((p) => {
      const clerkId = p.clerkUserId;
      const completedSessions = clerkId
        ? sessions.filter((s: any) => s.brokerId === clerkId && s.status === "completed")
        : [];
      const activeMembers = clerkId
        ? members.filter((m: any) => m.assignedStaffId === clerkId || sessions.some(
            (s: any) => s.brokerId === clerkId && s.memberId === m._id
          ))
        : [];
      const partnerCodes = clerkId
        ? codes.filter((c: any) => c.brokerId === clerkId)
        : [];

      return {
        ...p,
        completedEnrollments: completedSessions.length,
        activeMemberCount: activeMembers.length,
        repCodeCount: partnerCodes.length,
        totalUsage: partnerCodes.reduce((s: number, c: any) => s + c.usageCount, 0),
      };
    });
  },
});

/** Program Managers only */
export const getProgramManagers = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("distributionPartners")
      .withIndex("by_type", (q) => q.eq("type", "program_manager"))
      .collect();
  },
});

/** Look up a partner by invite token (for the claim-invite page) */
export const getByInviteToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("distributionPartners")
      .withIndex("by_invite_token", (q) => q.eq("inviteToken", args.token))
      .first();
  },
});

/**
 * Add a distribution partner.
 * Access is granted via the invitation flow — no Clerk account linking at creation time.
 */
export const add = mutation({
  args: {
    name: v.string(),
    type: partnerTypeValidator,
    parentId: v.optional(v.id("distributionPartners")),
    contactName: v.string(),
    contactEmail: v.string(),
    contactPhone: v.optional(v.string()),
    overrideRate: v.optional(v.number()),
    status: statusValidator,
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const identity = await ctx.auth.getUserIdentity();

    return await ctx.db.insert("distributionPartners", {
      name: args.name,
      type: args.type,
      parentId: args.parentId,
      contactName: args.contactName,
      contactEmail: args.contactEmail,
      contactPhone: args.contactPhone,
      overrideRate: args.overrideRate,
      status: args.status,
      notes: args.notes,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: identity?.subject,
    });
  },
});

/** Update a distribution partner */
export const update = mutation({
  args: {
    id: v.id("distributionPartners"),
    name: v.optional(v.string()),
    parentId: v.optional(v.id("distributionPartners")),
    contactName: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    overrideRate: v.optional(v.number()),
    status: v.optional(statusValidator),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { id, ...updates } = args;
    await ctx.db.patch(id, { ...updates, updatedAt: Date.now() });
  },
});

/** Remove a distribution partner */
export const remove = mutation({
  args: { id: v.id("distributionPartners") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});

/**
 * Send an invitation email to a distribution partner.
 * Generates a one-time token and emails the contact a link to claim
 * their free member access at /health/dashboard.
 */
export const sendInvite = action({
  args: { partnerId: v.id("distributionPartners") },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    // @ts-ignore — avoid deep type instantiation
    await ctx.runMutation(require("../_generated/api").api.admin.distributionPartners._verifyAdminForInvite, { partnerId: args.partnerId });

    const partner = await ctx.runQuery(
      // @ts-ignore
      require("../_generated/api").api.admin.distributionPartners.getAll,
      {}
    ).then((all: any[]) => all.find((p: any) => p._id === args.partnerId));

    if (!partner) throw new Error("Partner not found");

    const token = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days

    // @ts-ignore
    await ctx.runMutation(require("../_generated/api").api.admin.distributionPartners._setInviteToken, {
      partnerId: args.partnerId,
      token,
      expiry,
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getidealoh.com";
    const claimUrl = `${baseUrl}/health/claim-invite?token=${token}&source=partner`;

    const typeLabel =
      partner.type === "program_manager" ? "Program Manager" :
      partner.type === "fmo" ? "FMO Partner" : "Agency Partner";

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="background: linear-gradient(135deg, #0066CC 0%, #14b8a6 100%); color: white; padding: 24px 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">Your Ideal Oral Health Access</h1>
          <p style="margin: 10px 0 0 0; font-size: 15px; opacity: 0.9;">${typeLabel} — ${partner.name}</p>
        </div>
        <div style="padding: 32px; background: #f9fafb; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px;">Hi ${partner.contactName},</p>
          <p style="font-size: 15px; line-height: 1.6;">
            You've been invited to access the <strong>Ideal Oral Health</strong> member platform as part of your partnership with us.
            This gives you full access to explore the benefits your clients and prospects will receive.
          </p>
          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; margin: 24px 0; text-align: center;">
            <p style="font-size: 15px; color: #374151; margin: 0 0 16px 0;">
              Click below to create your account and activate your complimentary membership.
            </p>
            <a href="${claimUrl}"
              style="display: inline-block; padding: 14px 32px; background: #0066CC; color: white; font-weight: 700; font-size: 16px; text-decoration: none; border-radius: 8px;">
              Accept Invite &amp; Get Access
            </a>
            <p style="font-size: 12px; color: #9ca3af; margin: 16px 0 0 0;">This link expires in 30 days.</p>
          </div>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="font-size: 13px; color: #6b7280; line-height: 1.5;">
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
        to: partner.contactEmail,
        subject: `Your complimentary access to Ideal Oral Health — ${partner.name}`,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: `Email send failed: ${err}` };
    }
    return { success: true };
  },
});

/** Internal: write the invite token (called from sendInvite action) */
export const _setInviteToken = mutation({
  args: {
    partnerId: v.id("distributionPartners"),
    token: v.string(),
    expiry: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.partnerId, {
      inviteToken: args.token,
      inviteStatus: "pending",
      inviteExpiry: args.expiry,
      updatedAt: Date.now(),
    });
  },
});

/** Internal: verify admin before sending invite */
export const _verifyAdminForInvite = mutation({
  args: { partnerId: v.id("distributionPartners") },
  handler: async (ctx) => {
    await requireAdmin(ctx);
  },
});

/**
 * Claim a partner invite.
 * Called from /health/claim-invite after the user signs in.
 * Links their Clerk account and grants free member access.
 */
export const claimInvite = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    const partner = await ctx.db
      .query("distributionPartners")
      .withIndex("by_invite_token", (q) => q.eq("inviteToken", args.token))
      .first();

    if (!partner) throw new Error("Invalid or expired invite token");
    if (partner.inviteStatus === "claimed") throw new Error("This invite has already been claimed");
    if (partner.inviteExpiry && partner.inviteExpiry < Date.now()) {
      throw new Error("This invite link has expired. Please ask for a new one.");
    }

    await ctx.db.patch(partner._id, {
      clerkUserId: identity.clerkUserId,
      inviteStatus: "claimed",
      inviteToken: undefined,
      updatedAt: Date.now(),
    });

    await autoGrantFreeAccess(
      ctx,
      identity.clerkUserId,
      `Free access granted on partner invite claim — ${partner.name} (${partner.type})`
    );

    return { partnerId: partner._id, partnerName: partner.name };
  },
});
