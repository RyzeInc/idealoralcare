import { action, internalMutation, mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin, requireAuth } from "../lib/authGuards";
import { getBaseUrl } from "../lib/env";
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

/** Look up a partner by invite token — legacy path (pre-leaders) */
export const getByInviteToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("distributionPartners")
      .withIndex("by_invite_token", (q) => q.eq("inviteToken", args.token))
      .first();
  },
});

/** All leaders for a specific partner */
export const getLeadersByPartner = query({
  args: { partnerId: v.id("distributionPartners") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("partnerLeaders")
      .withIndex("by_partner", (q) => q.eq("partnerId", args.partnerId))
      .collect();
  },
});

// ── Internal helpers (called from actions) ──────────────────────────────────

/** Verify the caller is an admin — used from within action handlers */
export const _verifyAdmin = internalMutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
  },
});

/** Create the distributionPartners record only (no invite/leader) */
export const _createPartner = internalMutation({
  args: {
    name: v.string(),
    type: v.union(v.literal("program_manager"), v.literal("fmo"), v.literal("agency")),
    parentId: v.optional(v.id("distributionPartners")),
    contactName: v.string(),
    contactEmail: v.string(),
    contactPhone: v.optional(v.string()),
    overrideRate: v.optional(v.number()),
    status: v.union(v.literal("active"), v.literal("inactive"), v.literal("suspended")),
    notes: v.optional(v.string()),
    createdBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("distributionPartners", {
      ...args,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/** Insert a partnerLeader record */
export const _createLeader = internalMutation({
  args: {
    partnerId: v.id("distributionPartners"),
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    title: v.optional(v.string()),
    isPrimary: v.boolean(),
    inviteToken: v.string(),
    inviteStatus: v.union(v.literal("pending"), v.literal("claimed")),
    inviteExpiry: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("partnerLeaders", {
      ...args,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/** Update invite token on a leader record */
export const _setLeaderInviteToken = internalMutation({
  args: {
    leaderId: v.id("partnerLeaders"),
    token: v.string(),
    expiry: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.leaderId, {
      inviteToken: args.token,
      inviteStatus: "pending",
      inviteExpiry: args.expiry,
      updatedAt: Date.now(),
    });
  },
});

// ── Public mutations ─────────────────────────────────────────────────────────

/** Update org-level fields on a distribution partner */
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

/** Remove a distribution partner (also removes all leader records) */
export const remove = mutation({
  args: { id: v.id("distributionPartners") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const leaders = await ctx.db
      .query("partnerLeaders")
      .withIndex("by_partner", (q) => q.eq("partnerId", args.id))
      .collect();
    for (const leader of leaders) {
      await ctx.db.delete(leader._id);
    }
    await ctx.db.delete(args.id);
  },
});

/** Update a specific leader's details */
export const updateLeader = mutation({
  args: {
    leaderId: v.id("partnerLeaders"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { leaderId, ...updates } = args;
    await ctx.db.patch(leaderId, { ...updates, updatedAt: Date.now() });
  },
});

/** Remove a leader from a partner */
export const removeLeader = mutation({
  args: { leaderId: v.id("partnerLeaders") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.leaderId);
  },
});

/** Legacy: write the invite token on distributionPartners (kept for old records) */
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

/** Legacy: verify admin check (kept for old sendInvite) */
export const _verifyAdminForInvite = mutation({
  args: { partnerId: v.id("distributionPartners") },
  handler: async (ctx) => {
    await requireAdmin(ctx);
  },
});

/**
 * Claim an invite.
 * Checks the new partnerLeaders table first, falls back to legacy distributionPartners flow.
 * Links the Clerk account and grants full free access.
 */
export const claimInvite = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    // ── New flow: partnerLeaders ──────────────────────────────────────────
    const leader = await ctx.db
      .query("partnerLeaders")
      .withIndex("by_invite_token", (q) => q.eq("inviteToken", args.token))
      .first();

    if (leader) {
      if (leader.inviteStatus === "claimed") throw new Error("This invite has already been claimed");
      if (leader.inviteExpiry && leader.inviteExpiry < Date.now()) {
        throw new Error("This invite link has expired. Please ask for a new one.");
      }
      const partner = await ctx.db.get(leader.partnerId);
      if (!partner) throw new Error("Partner not found");

      await ctx.db.patch(leader._id, {
        clerkUserId: identity.clerkUserId,
        inviteStatus: "claimed",
        inviteToken: undefined,
        updatedAt: Date.now(),
      });

      await autoGrantFreeAccess(
        ctx,
        identity.clerkUserId,
        `Free access granted on partner invite claim — ${leader.name} @ ${partner.name} (${partner.type})`
      );

      return { partnerId: partner._id, partnerName: partner.name };
    }

    // ── Legacy flow: distributionPartners.inviteToken ─────────────────────
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

// ── Shared email helper ───────────────────────────────────────────────────────

async function dispatchInviteEmail(opts: {
  recipientName: string;
  recipientEmail: string;
  partnerName: string;
  typeLabel: string;
  claimUrl: string;
  resendApiKey: string | undefined;
}): Promise<{ ok: boolean; error?: string }> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <div style="background: linear-gradient(135deg, #0066CC 0%, #14b8a6 100%); color: white; padding: 24px 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">Your Ideal Oral Health Access</h1>
        <p style="margin: 10px 0 0 0; font-size: 15px; opacity: 0.9;">${opts.typeLabel} — ${opts.partnerName}</p>
      </div>
      <div style="padding: 32px; background: #f9fafb; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px;">Hi ${opts.recipientName},</p>
        <p style="font-size: 15px; line-height: 1.6;">
          You've been invited to access the <strong>Ideal Oral Health</strong> member platform as part of your partnership with us.
          This gives you full access to explore the benefits your clients and prospects will receive.
        </p>
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; margin: 24px 0; text-align: center;">
          <p style="font-size: 15px; color: #374151; margin: 0 0 16px 0;">
            Click below to create your account and activate your complimentary membership.
          </p>
          <a href="${opts.claimUrl}"
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
      Authorization: `Bearer ${opts.resendApiKey}`,
    },
    body: JSON.stringify({
      from: "Ideal Oral Health <noreply@getidealoh.com>",
      to: opts.recipientEmail,
      subject: `Your complimentary access to Ideal Oral Health — ${opts.partnerName}`,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return { ok: false, error: `Email send failed: ${err}` };
  }
  return { ok: true };
}

function typeLabel(type: string): string {
  if (type === "program_manager") return "Program Manager";
  if (type === "fmo") return "FMO Partner";
  return "Agency Partner";
}

// ── Actions ───────────────────────────────────────────────────────────────────

/**
 * Add a distribution partner.
 * Automatically creates the primary leader record and sends them an invite email.
 * The leader receives free dashboard access upon claiming the invite.
 */
export const add = action({
  args: {
    name: v.string(),
    type: partnerTypeValidator,
    parentId: v.optional(v.id("distributionPartners")),
    contactName: v.string(),
    contactEmail: v.string(),
    contactPhone: v.optional(v.string()),
    contactTitle: v.optional(v.string()),
    overrideRate: v.optional(v.number()),
    status: statusValidator,
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{
    partnerId: string;
    leaderId: string;
    inviteSent: boolean;
    inviteError?: string;
  }> => {
    // @ts-ignore — avoid deep type instantiation
    await ctx.runMutation(require("../_generated/api").internal.admin.distributionPartners._verifyAdmin, {});

    const token = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
    const baseUrl = getBaseUrl();
    const claimUrl = `${baseUrl}/health/claim-invite?token=${token}&source=partner`;

    // @ts-ignore
    const partnerId: string = await ctx.runMutation(
      require("../_generated/api").internal.admin.distributionPartners._createPartner,
      {
        name: args.name,
        type: args.type,
        parentId: args.parentId,
        contactName: args.contactName,
        contactEmail: args.contactEmail,
        contactPhone: args.contactPhone,
        overrideRate: args.overrideRate,
        status: args.status,
        notes: args.notes,
      }
    );

    // @ts-ignore
    const leaderId: string = await ctx.runMutation(
      require("../_generated/api").internal.admin.distributionPartners._createLeader,
      {
        partnerId,
        name: args.contactName,
        email: args.contactEmail,
        phone: args.contactPhone,
        title: args.contactTitle,
        isPrimary: true,
        inviteToken: token,
        inviteStatus: "pending",
        inviteExpiry: expiry,
      }
    );

    const emailResult = await dispatchInviteEmail({
      recipientName: args.contactName,
      recipientEmail: args.contactEmail,
      partnerName: args.name,
      typeLabel: typeLabel(args.type),
      claimUrl,
      resendApiKey: process.env.RESEND_API_KEY,
    });

    return {
      partnerId,
      leaderId,
      inviteSent: emailResult.ok,
      inviteError: emailResult.error,
    };
  },
});

/**
 * Add an additional leader to an existing partner and send them an invite.
 */
export const addLeader = action({
  args: {
    partnerId: v.id("distributionPartners"),
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{
    leaderId: string;
    inviteSent: boolean;
    inviteError?: string;
  }> => {
    // @ts-ignore
    await ctx.runMutation(require("../_generated/api").internal.admin.distributionPartners._verifyAdmin, {});

    const token = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const baseUrl = getBaseUrl();
    const claimUrl = `${baseUrl}/health/claim-invite?token=${token}&source=partner`;

    const partners = await ctx.runQuery(
      // @ts-ignore
      require("../_generated/api").api.admin.distributionPartners.getAll, {}
    ) as any[];
    const partner = partners.find((p: any) => p._id === args.partnerId);
    if (!partner) throw new Error("Partner not found");

    // @ts-ignore
    const leaderId: string = await ctx.runMutation(
      require("../_generated/api").internal.admin.distributionPartners._createLeader,
      {
        partnerId: args.partnerId,
        name: args.name,
        email: args.email,
        phone: args.phone,
        title: args.title,
        isPrimary: false,
        inviteToken: token,
        inviteStatus: "pending",
        inviteExpiry: expiry,
      }
    );

    const emailResult = await dispatchInviteEmail({
      recipientName: args.name,
      recipientEmail: args.email,
      partnerName: partner.name,
      typeLabel: typeLabel(partner.type),
      claimUrl,
      resendApiKey: process.env.RESEND_API_KEY,
    });

    return {
      leaderId,
      inviteSent: emailResult.ok,
      inviteError: emailResult.error,
    };
  },
});

/**
 * Resend an invite to a specific leader (generates a new token).
 */
export const sendLeaderInvite = action({
  args: { leaderId: v.id("partnerLeaders") },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    // @ts-ignore
    await ctx.runMutation(require("../_generated/api").internal.admin.distributionPartners._verifyAdmin, {});

    const leaders = await ctx.runQuery(
      // @ts-ignore
      require("../_generated/api").api.admin.distributionPartners.getAll, {}
    ) as any[];

    // Fetch the leader by scanning (no direct getById query needed — use internal pattern)
    const allPartners = leaders;
    // We need to find the leader — use a separate query fetching by partnerId is not efficient here,
    // so we expose a helper query to find by leaderId
    const leaderData = await ctx.runQuery(
      // @ts-ignore
      require("../_generated/api").api.admin.distributionPartners.getLeaderById,
      { leaderId: args.leaderId }
    ) as any;

    if (!leaderData) throw new Error("Leader not found");
    const partner = allPartners.find((p: any) => p._id === leaderData.partnerId);
    if (!partner) throw new Error("Partner not found");

    const token = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const baseUrl = getBaseUrl();
    const claimUrl = `${baseUrl}/health/claim-invite?token=${token}&source=partner`;

    // @ts-ignore
    await ctx.runMutation(require("../_generated/api").internal.admin.distributionPartners._setLeaderInviteToken, {
      leaderId: args.leaderId,
      token,
      expiry,
    });

    const emailResult = await dispatchInviteEmail({
      recipientName: leaderData.name,
      recipientEmail: leaderData.email,
      partnerName: partner.name,
      typeLabel: typeLabel(partner.type),
      claimUrl,
      resendApiKey: process.env.RESEND_API_KEY,
    });

    return { success: emailResult.ok, error: emailResult.error };
  },
});

/** Lookup a single leader by ID (used by sendLeaderInvite action) */
export const getLeaderById = query({
  args: { leaderId: v.id("partnerLeaders") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.leaderId);
  },
});

/**
 * Legacy: send invite using distributionPartners.contactEmail (for old partners without leader records).
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
    const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000;

    // @ts-ignore
    await ctx.runMutation(require("../_generated/api").api.admin.distributionPartners._setInviteToken, {
      partnerId: args.partnerId,
      token,
      expiry,
    });

    const baseUrl = getBaseUrl();
    const claimUrl = `${baseUrl}/health/claim-invite?token=${token}&source=partner`;

    const emailResult = await dispatchInviteEmail({
      recipientName: partner.contactName,
      recipientEmail: partner.contactEmail,
      partnerName: partner.name,
      typeLabel: typeLabel(partner.type),
      claimUrl,
      resendApiKey: process.env.RESEND_API_KEY,
    });

    return { success: emailResult.ok, error: emailResult.error };
  },
});
