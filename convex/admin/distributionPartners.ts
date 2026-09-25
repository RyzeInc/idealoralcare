import { action, internalMutation, mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { requireAdmin, requireAuth } from "../lib/authGuards";
import { getBaseUrl } from "../lib/env";
import { sendViaResend } from "../lib/resend";
import { EMAIL_TEMPLATES } from "../lib/emailTemplates";
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
    await requireAdmin(ctx);
    return await ctx.db.query("distributionPartners").collect();
  },
});

/**
 * All partners with enrollment and member counts.
 *
 * These figures were wrong before: every join keyed off the partner's own
 * `clerkUserId`, but `enrollmentSessions.brokerId` and
 * `brokerTrackingCodes.brokerId` hold a `partnerLeaders._id`, and
 * `memberProfiles.assignedStaffId` is an `adminUsers` id — so a partner's
 * stats were silently all zero unless they happened to also be a rep.
 *
 * Attribution now comes from the denormalized stamp on `memberProfiles`
 * (schema.ts, DENORMALIZED REP ATTRIBUTION), which already rolls a member's
 * rep up to that rep's agency for both Scenario A and Scenario B.
 */
export const getAllWithStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [partners, leaders, members, codes, sessions] = await Promise.all([
      ctx.db.query("distributionPartners").collect(),
      ctx.db.query("partnerLeaders").collect(),
      ctx.db.query("memberProfiles").collect(),
      ctx.db.query("brokerTrackingCodes").collect(),
      ctx.db.query("enrollmentSessions").collect(),
    ]);

    // rep id (and legacy Clerk id) -> owning agency, so rows keyed either way
    // land on the right partner.
    const agencyForRepKey = new Map<string, string>();
    for (const leader of leaders) {
      const agencyId = String(leader.partnerId);
      agencyForRepKey.set(String(leader._id), agencyId);
      if (leader.clerkUserId) agencyForRepKey.set(leader.clerkUserId, agencyId);
    }

    const bump = (map: Map<string, number>, key: string | undefined | null, by = 1) => {
      if (!key) return;
      map.set(key, (map.get(key) ?? 0) + by);
    };

    // Single pass per table — no nested scans.
    const totalMembersByAgency = new Map<string, number>();
    const activeMembersByAgency = new Map<string, number>();
    for (const m of members) {
      const agencyId =
        m.attributedAgencyId ??
        (m.attributedRepId ? agencyForRepKey.get(m.attributedRepId) : undefined);
      if (!agencyId) continue;
      bump(totalMembersByAgency, agencyId);
      if (m.memberType === "active") bump(activeMembersByAgency, agencyId);
    }

    const completedByAgency = new Map<string, number>();
    for (const s of sessions) {
      if (s.status !== "completed") continue;
      const agencyId =
        (s.agencyId as string | undefined) ??
        (s.brokerId ? agencyForRepKey.get(s.brokerId) : undefined);
      bump(completedByAgency, agencyId);
    }

    const codeCountByAgency = new Map<string, number>();
    const usageByAgency = new Map<string, number>();
    for (const c of codes) {
      const agencyId =
        (c.agencyId as string | undefined) ??
        (c.brokerId ? agencyForRepKey.get(c.brokerId) : undefined);
      bump(codeCountByAgency, agencyId);
      bump(usageByAgency, agencyId, c.usageCount ?? 0);
    }

    const leaderCountByAgency = new Map<string, number>();
    for (const leader of leaders) bump(leaderCountByAgency, String(leader.partnerId));

    return partners.map((p) => {
      const key = String(p._id);
      return {
        ...p,
        completedEnrollments: completedByAgency.get(key) ?? 0,
        activeMemberCount: activeMembersByAgency.get(key) ?? 0,
        totalMemberCount: totalMembersByAgency.get(key) ?? 0,
        repCount: leaderCountByAgency.get(key) ?? 0,
        repCodeCount: codeCountByAgency.get(key) ?? 0,
        // Only meaningful for links clicked after rep-link tracking shipped;
        // historical codes were never incremented.
        totalUsage: usageByAgency.get(key) ?? 0,
      };
    });
  },
});

/** Program Managers only */
export const getProgramManagers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
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
    await requireAdmin(ctx);
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

    // Any partner may be an upline (PM, FMO, or agency), so a cycle is now
    // reachable: A→B plus B→A would spin forever in anything that walks the
    // parent chain for overrides. Reject before writing.
    if (updates.parentId) {
      if (updates.parentId === id) {
        throw new Error("A partner cannot be its own upline.");
      }
      let cursor: Id<"distributionPartners"> | undefined = updates.parentId;
      const seen = new Set<string>([id]);
      while (cursor) {
        if (seen.has(cursor)) {
          throw new Error(
            "That upline would create a loop in the partner hierarchy.",
          );
        }
        seen.add(cursor);
        // Annotated explicitly: without it TS sees `cursor` defined in terms of
        // its own initializer and bails with TS7022.
        const ancestor: Doc<"distributionPartners"> | null =
          await ctx.db.get(cursor);
        cursor = ancestor?.parentId;
      }
    }

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
}): Promise<{ ok: boolean; error?: string }> {
  const { subject, html } = EMAIL_TEMPLATES["partner-invite"].render({
    recipientName: opts.recipientName,
    partnerName: opts.partnerName,
    typeLabel: opts.typeLabel,
    claimUrl: opts.claimUrl,
  });

  const result = await sendViaResend({
    to: opts.recipientEmail,
    subject,
    html,
    tags: [{ name: "category", value: "partner-invite" }],
  });

  return { ok: result.success, error: result.error };
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
    await ctx.runMutation(internal.admin.distributionPartners._verifyAdmin, {});

    const token = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
    const baseUrl = getBaseUrl();
    const claimUrl = `${baseUrl}/health/claim-invite?token=${token}&source=partner`;

    const partnerId = await ctx.runMutation(
      internal.admin.distributionPartners._createPartner,
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

    const leaderId = await ctx.runMutation(
      internal.admin.distributionPartners._createLeader,
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
    await ctx.runMutation(internal.admin.distributionPartners._verifyAdmin, {});

    const token = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const baseUrl = getBaseUrl();
    const claimUrl = `${baseUrl}/health/claim-invite?token=${token}&source=partner`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const partners = await ctx.runQuery(api.admin.distributionPartners.getAll, {}) as any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const partner = partners.find((p: any) => p._id === args.partnerId);
    if (!partner) throw new Error("Partner not found");

    const leaderId = await ctx.runMutation(
      internal.admin.distributionPartners._createLeader,
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
    await ctx.runMutation(internal.admin.distributionPartners._verifyAdmin, {});

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allPartners = await ctx.runQuery(api.admin.distributionPartners.getAll, {}) as any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const leaderData = await ctx.runQuery(api.admin.distributionPartners.getLeaderById, { leaderId: args.leaderId }) as any;

    if (!leaderData) throw new Error("Leader not found");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const partner = allPartners.find((p: any) => p._id === leaderData.partnerId);
    if (!partner) throw new Error("Partner not found");

    const token = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const baseUrl = getBaseUrl();
    const claimUrl = `${baseUrl}/health/claim-invite?token=${token}&source=partner`;

    await ctx.runMutation(internal.admin.distributionPartners._setLeaderInviteToken, {
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
    });

    return { success: emailResult.ok, error: emailResult.error };
  },
});

/** Lookup a single leader by ID (used by sendLeaderInvite action) */
export const getLeaderById = query({
  args: { leaderId: v.id("partnerLeaders") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db.get(args.leaderId);
  },
});

/**
 * Legacy: send invite using distributionPartners.contactEmail (for old partners without leader records).
 */
export const sendInvite = action({
  args: { partnerId: v.id("distributionPartners") },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    await ctx.runMutation(api.admin.distributionPartners._verifyAdminForInvite, { partnerId: args.partnerId });

    const partner = await ctx.runQuery(api.admin.distributionPartners.getAll, {})
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((all: any[]) => all.find((p: any) => p._id === args.partnerId));

    const token = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000;

    await ctx.runMutation(api.admin.distributionPartners._setInviteToken, {
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
    });

    return { success: emailResult.ok, error: emailResult.error };
  },
});
