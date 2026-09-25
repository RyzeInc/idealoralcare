import { action, internalMutation, mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { requireAdmin, requireAuth } from "../lib/authGuards";
import { getBaseUrl } from "../lib/env";
import { sendViaResend } from "../lib/resend";
import { EMAIL_TEMPLATES } from "../lib/emailTemplates";
import { autoGrantFreeAccess } from "./grantFreeAccess";
import { recordAdminAction } from "./adminAudit";
import { collectDescendantPartnerIds } from "../insights/scope";

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

const reportScopeValidator = v.union(v.literal("own"), v.literal("agency"), v.literal("downline"));

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validateContact(name: string, email: string) {
  if (!name.trim()) throw new Error("A name is required.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error("Enter a valid email address.");
}
function validateRate(rate?: number | null) {
  if (rate != null && (!Number.isFinite(rate) || rate < 0 || rate > 100)) {
    throw new Error("The override rate must be between 0 and 100.");
  }
}
function validateTerms(effectiveDate?: string, terminationDate?: string) {
  for (const d of [effectiveDate, terminationDate]) {
    if (d && !DATE_RE.test(d)) throw new Error("Dates must be in YYYY-MM-DD format.");
  }
  if (effectiveDate && terminationDate && terminationDate < effectiveDate) {
    throw new Error("The termination date cannot be before the effective date.");
  }
}

/**
 * Admin broker workspace: profile, team, downline, codes, book and activity
 * in one read. Invite tokens are stripped — the page only needs to know
 * whether an invite is outstanding, and tokens are bearer credentials.
 */
export const getWorkspace = query({
  args: { partnerId: v.id("distributionPartners") },
  handler: async (ctx, { partnerId }) => {
    await requireAdmin(ctx);
    const partner = await ctx.db.get(partnerId);
    if (!partner) return null;
    const [leaders, children, members, activeMembers, activity, applications, upline, descendantIds] = await Promise.all([
      ctx.db.query("partnerLeaders").withIndex("by_partner", (q) => q.eq("partnerId", partnerId)).collect(),
      ctx.db.query("distributionPartners").withIndex("by_parent", (q) => q.eq("parentId", partnerId)).collect(),
      ctx.db.query("memberProfiles").withIndex("by_attributed_agency", (q) => q.eq("attributedAgencyId", partnerId)).order("desc").take(51),
      ctx.db.query("memberProfiles").withIndex("by_attributed_agency_type", (q) => q.eq("attributedAgencyId", partnerId).eq("memberType", "active")).collect(),
      ctx.db.query("adminAuditLog").withIndex("by_target", (q) => q.eq("targetType", "distributionPartner").eq("targetId", partnerId)).order("desc").take(50),
      ctx.db.query("repOnboardingSubmissions").withIndex("by_approved_partner", (q) => q.eq("approvedPartnerId", partnerId)).collect(),
      partner.parentId ? ctx.db.get(partner.parentId) : Promise.resolve(null),
      collectDescendantPartnerIds(ctx, partnerId),
    ]);
    const codeLists = await Promise.all(leaders.flatMap((leader) =>
      [String(leader._id), ...(leader.clerkUserId ? [leader.clerkUserId] : [])].map((key) =>
        ctx.db.query("brokerTrackingCodes").withIndex("by_broker", (q) => q.eq("brokerId", key)).collect())));
    const codes = [...new Map(codeLists.flat().map((code) => [code._id, code])).values()];
    const descendants = (await Promise.all(descendantIds.map((id) => ctx.db.get(id))))
      .filter((p): p is Doc<"distributionPartners"> => p !== null);
    const directChildIds = new Set(children.map((c) => String(c._id)));
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { inviteToken: _partnerToken, ...partnerSafe } = partner;
    return {
      partner: partnerSafe,
      upline: upline ? { id: upline._id, name: upline.name, type: upline.type, status: upline.status } : null,
      leaders: leaders.map(({ inviteToken, ...leader }) => ({ ...leader, hasOpenInvite: !!inviteToken })),
      downline: descendants.map((p) => ({ id: p._id, name: p.name, type: p.type, status: p.status, agencyCode: p.agencyCode, direct: directChildIds.has(String(p._id)) })),
      codes: codes.map((c) => ({ id: c._id, code: c.code, slug: c.slug, brokerId: c.brokerId, status: c.status, usageCount: c.usageCount, createdAt: c.createdAt })),
      activity: activity.map((a) => ({ id: a._id, action: a.action, summary: a.summary, actorName: a.actorName, createdAt: a.createdAt })),
      applications: applications.map((a) => ({ id: a._id, submissionType: a.submissionType, status: a.status, createdAt: a.createdAt, hasPartnerKit: !!a.partnerKitSubmissionId })),
      activeMemberCount: activeMembers.length,
      members: members.slice(0, 50).map((m) => ({ id: m._id, name: `${m.firstName} ${m.lastName}`, memberId: m.memberId, memberType: m.memberType, repId: m.attributedRepId, createdAt: m.createdAt })),
      hasMoreMembers: members.length > 50,
    };
  },
});

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
    const linkedByAgency = new Map<string, number>();
    const pendingByAgency = new Map<string, number>();
    for (const leader of leaders) {
      const key = String(leader.partnerId);
      bump(leaderCountByAgency, key);
      if (leader.clerkUserId) bump(linkedByAgency, key);
      else if (leader.inviteStatus === "pending") bump(pendingByAgency, key);
    }

    return partners.map((p) => {
      const key = String(p._id);
      return {
        ...p,
        completedEnrollments: completedByAgency.get(key) ?? 0,
        activeMemberCount: activeMembersByAgency.get(key) ?? 0,
        totalMemberCount: totalMembersByAgency.get(key) ?? 0,
        repCount: leaderCountByAgency.get(key) ?? 0,
        linkedLeaderCount: linkedByAgency.get(key) ?? 0,
        pendingInviteCount: pendingByAgency.get(key) ?? 0,
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

/** Public invite preview: no contact details, internal notes, or access settings. */
export const getByInviteToken = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const leader = await ctx.db.query("partnerLeaders").withIndex("by_invite_token", q => q.eq("inviteToken", token)).first();
    const partner = leader ? await ctx.db.get(leader.partnerId) : await ctx.db.query("distributionPartners").withIndex("by_invite_token", q => q.eq("inviteToken", token)).first();
    const invite = leader ?? partner;
    if (!partner || !invite || partner.status !== "active" || leader?.portalAccess === false || invite.inviteStatus === "claimed" || (invite.inviteExpiry && invite.inviteExpiry < Date.now())) return null;
    return { name: partner.name, inviteStatus: invite.inviteStatus };
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
    return await requireAdmin(ctx);
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
    portalAccess: v.optional(v.boolean()),
    reportScope: v.optional(reportScopeValidator),
    inviteToken: v.string(),
    inviteStatus: v.union(v.literal("pending"), v.literal("claimed")),
    inviteExpiry: v.number(),
  },
  handler: async (ctx, args) => {
    validateContact(args.name, args.email);
    if (!await ctx.db.get(args.partnerId)) throw new Error("Partner not found");
    return await ctx.db.insert("partnerLeaders", {
      ...args,
      name: args.name.trim(),
      email: args.email.trim().toLowerCase(),
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

/** Update org-level fields on a distribution partner. Empty strings clear optional text. */
export const update = mutation({
  args: {
    id: v.id("distributionPartners"),
    name: v.optional(v.string()),
    type: v.optional(partnerTypeValidator),
    parentId: v.optional(v.union(v.id("distributionPartners"), v.null())),
    contactName: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    overrideRate: v.optional(v.union(v.number(), v.null())),
    status: v.optional(statusValidator),
    notes: v.optional(v.string()),
    effectiveDate: v.optional(v.string()),
    terminationDate: v.optional(v.string()),
    npn: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAdmin(ctx);
    const { id, parentId, overrideRate, ...fields } = args;
    const current = await ctx.db.get(id);
    if (!current) throw new Error("Partner not found");
    validateContact(fields.contactName ?? current.contactName, fields.contactEmail ?? current.contactEmail);
    if (fields.name !== undefined && !fields.name.trim()) throw new Error("Organization name is required.");
    validateRate(overrideRate);
    validateTerms(
      fields.effectiveDate !== undefined ? fields.effectiveDate.trim() : current.effectiveDate,
      fields.terminationDate !== undefined ? fields.terminationDate.trim() : current.terminationDate,
    );

    // Any partner may be an upline (PM, FMO, or agency), so a cycle is now
    // reachable: A→B plus B→A would spin forever in anything that walks the
    // parent chain for overrides. Reject before writing.
    if (parentId) {
      if (parentId === id) {
        throw new Error("A partner cannot be its own upline.");
      }
      let cursor: Id<"distributionPartners"> | undefined = parentId;
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
        if (!ancestor) throw new Error("Upline partner not found.");
        cursor = ancestor.parentId;
      }
    }

    // `undefined` in a Convex patch removes the field, which is how null and
    // "" clear a value.
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined) continue;
      const trimmed = typeof value === "string" ? value.trim() : value;
      patch[key] = trimmed === "" ? undefined : trimmed;
    }
    if (typeof patch.contactEmail === "string") patch.contactEmail = patch.contactEmail.toLowerCase();
    if (parentId !== undefined) patch.parentId = parentId ?? undefined;
    if (overrideRate !== undefined) patch.overrideRate = overrideRate ?? undefined;

    const before = Object.fromEntries(
      Object.keys(patch).map((key) => [key, (current as Record<string, unknown>)[key] ?? null]),
    );
    await ctx.db.patch(id, { ...patch, updatedAt: Date.now() });
    await recordAdminAction(ctx, identity, {
      action: "partner.updated",
      targetType: "distributionPartner",
      targetId: id,
      summary: `Updated ${String(patch.name ?? current.name)}`,
      metadata: { before, after: Object.fromEntries(Object.entries(patch).map(([k, val]) => [k, val ?? null])) },
    });
  },
});

/** Remove a distribution partner (also removes all leader records) */
export const remove = mutation({
  args: { id: v.id("distributionPartners") },
  handler: async (ctx, args) => {
    const identity = await requireAdmin(ctx);
    const partner = await ctx.db.get(args.id);
    if (!partner) throw new Error("Partner not found");
    // Deleting an upline would leave its children pointing at a missing id.
    const child = await ctx.db
      .query("distributionPartners")
      .withIndex("by_parent", (q) => q.eq("parentId", args.id))
      .first();
    if (child) throw new Error("Reassign or remove this partner's downline before deleting it.");
    const leaders = await ctx.db
      .query("partnerLeaders")
      .withIndex("by_partner", (q) => q.eq("partnerId", args.id))
      .collect();
    for (const leader of leaders) {
      await ctx.db.delete(leader._id);
    }
    await ctx.db.delete(args.id);
    await recordAdminAction(ctx, identity, {
      action: "partner.deleted",
      targetType: "distributionPartner",
      targetId: args.id,
      summary: `Deleted ${partner.name} and ${leaders.length} team member${leaders.length === 1 ? "" : "s"}`,
      metadata: { name: partner.name, type: partner.type, leaderEmails: leaders.map((l) => l.email) },
    });
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
    portalAccess: v.optional(v.boolean()),
    reportScope: v.optional(reportScopeValidator),
  },
  handler: async (ctx, args) => {
    const identity = await requireAdmin(ctx);
    const { leaderId, ...updates } = args;
    const leader = await ctx.db.get(leaderId);
    if (!leader) throw new Error("Team member not found");
    validateContact(updates.name ?? leader.name, updates.email ?? leader.email);
    if (leader.clerkUserId && updates.email && updates.email.trim().toLowerCase() !== leader.email.toLowerCase()) throw new Error("A linked account's email cannot be changed here. Disable access and add the replacement contact.");
    const patch: Record<string, unknown> = Object.fromEntries(Object.entries(updates).filter(([, value]) => value !== undefined));
    if (updates.email) patch.email = updates.email.trim().toLowerCase();
    if (updates.name) patch.name = updates.name.trim();
    // Blank optional text clears the field rather than storing "".
    for (const key of ["phone", "title"] as const) {
      if (typeof patch[key] === "string") patch[key] = (patch[key] as string).trim() || undefined;
    }
    await ctx.db.patch(leaderId, { ...patch, updatedAt: Date.now() });
    await recordAdminAction(ctx, identity, { action: "partner.team_updated", targetType: "distributionPartner", targetId: leader.partnerId, summary: `Updated access or details for ${updates.name ?? leader.name}`, metadata: { leaderId, before: { portalAccess: leader.portalAccess ?? true, reportScope: leader.reportScope ?? "own" }, changes: patch } });
  },
});

/** Remove a leader from a partner */
export const removeLeader = mutation({
  args: { leaderId: v.id("partnerLeaders") },
  handler: async (ctx, args) => {
    const identity = await requireAdmin(ctx);
    const leader = await ctx.db.get(args.leaderId);
    if (!leader) return;
    await ctx.db.delete(args.leaderId);
    await recordAdminAction(ctx, identity, {
      action: "partner.team_removed",
      targetType: "distributionPartner",
      targetId: leader.partnerId,
      summary: `Removed ${leader.name} (${leader.email})`,
      metadata: { leaderId: leader._id, wasPrimary: leader.isPrimary, linked: !!leader.clerkUserId },
    });
  },
});

/** Make a team member the partner's primary contact and mirror their details onto the partner. */
export const setPrimaryLeader = mutation({
  args: { leaderId: v.id("partnerLeaders") },
  handler: async (ctx, args) => {
    const identity = await requireAdmin(ctx);
    const leader = await ctx.db.get(args.leaderId);
    if (!leader) throw new Error("Team member not found");
    const team = await ctx.db
      .query("partnerLeaders")
      .withIndex("by_partner", (q) => q.eq("partnerId", leader.partnerId))
      .collect();
    const now = Date.now();
    for (const member of team) {
      const isPrimary = member._id === leader._id;
      if (member.isPrimary !== isPrimary) await ctx.db.patch(member._id, { isPrimary, updatedAt: now });
    }
    await ctx.db.patch(leader.partnerId, {
      contactName: leader.name,
      contactEmail: leader.email,
      contactPhone: leader.phone,
      updatedAt: now,
    });
    await recordAdminAction(ctx, identity, {
      action: "partner.primary_changed",
      targetType: "distributionPartner",
      targetId: leader.partnerId,
      summary: `Made ${leader.name} the primary contact`,
    });
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
    await requireAdmin(ctx);
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
      if (!partner || partner.status !== "active" || leader.portalAccess === false) throw new Error("Partner access is disabled. Contact your administrator.");
      if (identity.email && identity.email.trim().toLowerCase() !== leader.email.trim().toLowerCase()) throw new Error("Sign in with the email address this invitation was sent to.");
      const linked = await ctx.db.query("partnerLeaders").withIndex("by_clerk_id", q => q.eq("clerkUserId", identity.clerkUserId)).first();
      if (linked && linked._id !== leader._id) throw new Error("This account is already linked to a partner. Contact your administrator.");

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

    if (partner.status !== "active") throw new Error("Partner access is disabled.");
    if (identity.email && identity.email.trim().toLowerCase() !== partner.contactEmail.trim().toLowerCase()) throw new Error("Sign in with the email address this invitation was sent to.");
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

const onboardingArgs = {
  name: v.string(), type: partnerTypeValidator,
  parentId: v.optional(v.id("distributionPartners")),
  contactName: v.string(), contactEmail: v.string(),
  contactPhone: v.optional(v.string()), contactTitle: v.optional(v.string()),
  overrideRate: v.optional(v.number()), status: statusValidator, notes: v.optional(v.string()),
  effectiveDate: v.optional(v.string()), npn: v.optional(v.string()),
  reportScope: v.optional(reportScopeValidator), portalAccess: v.optional(v.boolean()),
  sendInvite: v.optional(v.boolean()),
};

/** Organization and primary contact are created in one transaction. */
export const _createOnboarding = internalMutation({
  args: { ...onboardingArgs, token: v.string() },
  handler: async (ctx, args) => {
    const identity = await requireAdmin(ctx);
    validateContact(args.contactName, args.contactEmail);
    validateRate(args.overrideRate);
    validateTerms(args.effectiveDate || undefined);
    if (!args.name.trim()) throw new Error("Organization name is required.");
    if (args.parentId && !await ctx.db.get(args.parentId)) throw new Error("Upline partner not found.");
    const send = args.sendInvite !== false;
    if (send && (args.status !== "active" || args.portalAccess === false)) throw new Error("Enable partner and portal access before sending an invite.");
    const now = Date.now();
    const partnerId = await ctx.db.insert("distributionPartners", {
      name: args.name.trim(), type: args.type, parentId: args.parentId,
      contactName: args.contactName.trim(), contactEmail: args.contactEmail.trim().toLowerCase(), contactPhone: args.contactPhone,
      overrideRate: args.overrideRate, status: args.status, notes: args.notes?.trim() || undefined,
      effectiveDate: args.effectiveDate || undefined, npn: args.npn?.trim() || undefined,
      createdBy: identity.clerkUserId, createdAt: now, updatedAt: now,
    });
    const leaderId = await ctx.db.insert("partnerLeaders", {
      partnerId, name: args.contactName.trim(), email: args.contactEmail.trim().toLowerCase(), phone: args.contactPhone, title: args.contactTitle,
      isPrimary: true, portalAccess: args.portalAccess ?? true, reportScope: args.reportScope ?? "own",
      ...(send ? { inviteToken: args.token, inviteStatus: "pending" as const, inviteExpiry: now + 30 * 86400000 } : {}),
      createdAt: now, updatedAt: now,
    });
    await recordAdminAction(ctx, identity, { action: "partner.created", targetType: "distributionPartner", targetId: partnerId, summary: `Created ${args.name.trim()} and primary contact`, metadata: { leaderId, reportScope: args.reportScope ?? "own" } });
    return { partnerId, leaderId };
  },
});

export const _recordInviteResult = internalMutation({
  args: { leaderId: v.id("partnerLeaders"), sent: v.boolean() },
  handler: async (ctx, { leaderId, sent }) => {
    const identity = await requireAdmin(ctx);
    const leader = await ctx.db.get(leaderId);
    if (!leader) return;
    await recordAdminAction(ctx, identity, { action: sent ? "partner.invite_sent" : "partner.invite_failed", targetType: "distributionPartner", targetId: leader.partnerId, summary: `${sent ? "Invite sent" : "Invite email failed"} for ${leader.name}` });
  },
});

/** Create a partner; callers may save the profile before sending an invite. */
export const add = action({
  args: onboardingArgs,
  handler: async (ctx, args): Promise<{ partnerId: Id<"distributionPartners">; leaderId: Id<"partnerLeaders">; inviteSent: boolean; inviteError?: string }> => {
    const token = crypto.randomUUID();
    const ids = await ctx.runMutation(internal.admin.distributionPartners._createOnboarding, { ...args, token });
    if (args.sendInvite === false) return { ...ids, inviteSent: false };
    const result = await dispatchInviteEmail({ recipientName: args.contactName, recipientEmail: args.contactEmail.trim().toLowerCase(), partnerName: args.name, typeLabel: typeLabel(args.type), claimUrl: `${getBaseUrl()}/health/claim-invite?token=${token}&source=partner` });
    await ctx.runMutation(internal.admin.distributionPartners._recordInviteResult, { leaderId: ids.leaderId, sent: result.ok });
    return { ...ids, inviteSent: result.ok, inviteError: result.error };
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
    portalAccess: v.optional(v.boolean()),
    reportScope: v.optional(reportScopeValidator),
  },
  handler: async (ctx, args): Promise<{
    leaderId: string;
    inviteSent: boolean;
    inviteError?: string;
  }> => {
    await ctx.runMutation(internal.admin.distributionPartners._verifyAdmin, {});

    const token = crypto.randomUUID();
    const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const baseUrl = getBaseUrl();
    const claimUrl = `${baseUrl}/health/claim-invite?token=${token}&source=partner`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const partners = await ctx.runQuery(api.admin.distributionPartners.getAll, {}) as any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const partner = partners.find((p: any) => p._id === args.partnerId);
    if (!partner || partner.status !== "active") throw new Error("Activate the partner before inviting team members.");
    if (args.portalAccess === false) throw new Error("Enable portal access before sending an invite.");

    const leaderId = await ctx.runMutation(
      internal.admin.distributionPartners._createLeader,
      {
        partnerId: args.partnerId,
        name: args.name,
        email: args.email,
        phone: args.phone,
        title: args.title,
        isPrimary: false,
        portalAccess: args.portalAccess ?? true,
        reportScope: args.reportScope ?? "own",
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

    await ctx.runMutation(internal.admin.distributionPartners._recordInviteResult, { leaderId, sent: emailResult.ok });
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
    if (!partner || partner.status !== "active" || leaderData.portalAccess === false) throw new Error("Enable partner and portal access before sending an invite.");
    if (leaderData.clerkUserId || leaderData.inviteStatus === "claimed") throw new Error("This contact has already connected their account.");

    const token = crypto.randomUUID();
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

    await ctx.runMutation(internal.admin.distributionPartners._recordInviteResult, { leaderId: args.leaderId, sent: emailResult.ok });
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

    const token = crypto.randomUUID();
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
