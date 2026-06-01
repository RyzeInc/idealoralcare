import { action, internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";
import { requireAdmin, requireAdminAction } from "./lib/authGuards";

// ─── validation helpers ────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NPN_RE = /^\d{4,10}$/;
const EIN_DIGITS_RE = /^\d{9}$/;

function validateEmail(val: string | undefined, label: string): void {
  if (!val) return;
  if (!EMAIL_RE.test(val.trim())) throw new Error(`${label} must be a valid email address.`);
}

function validateNpn(val: string | undefined, label: string): void {
  if (!val) return;
  const digits = val.replace(/\D/g, "");
  if (!NPN_RE.test(digits)) throw new Error(`${label} must be 4–10 digits.`);
}

function validateEin(val: string | undefined): void {
  if (!val) return;
  const digits = val.replace(/\D/g, "");
  if (!EIN_DIGITS_RE.test(digits)) throw new Error("EIN must be 9 digits (e.g. 12-3456789).");
}

/**
 * Normalize a phone to digits-only (10 or 11 digits for US).
 * Throws if present and clearly wrong length.
 */
function normalizePhone(val: string | undefined): string | undefined {
  if (!val) return undefined;
  const digits = val.replace(/\D/g, "");
  if (digits.length === 11 && digits[0] === "1") return digits.slice(1);
  if (digits.length !== 10) throw new Error(`Phone "${val}" must be a 10-digit US number.`);
  return digits;
}

/**
 * Public mutation accepting submissions from /register/rep.
 * No auth required — this is a public-facing intake form.
 */
export const submit = mutation({
  args: {
    submissionType: v.union(v.literal("agency"), v.literal("rep"), v.literal("both")),
    // Agency fields
    agencyName: v.optional(v.string()),
    dba: v.optional(v.string()),
    ein: v.optional(v.string()),
    agencyNpn: v.optional(v.string()),
    primaryContactName: v.optional(v.string()),
    primaryContactEmail: v.optional(v.string()),
    primaryContactPhone: v.optional(v.string()),
    programManager: v.optional(v.string()),
    physicalAddress: v.optional(v.string()),
    mailingAddress: v.optional(v.string()),
    agencyLicenses: v.optional(v.string()),
    eoCarrier: v.optional(v.string()),
    eoExpiration: v.optional(v.string()),
    commissionTier: v.optional(v.string()),
    agencyEffectiveDate: v.optional(v.string()),
    agencyStatus: v.optional(v.string()),
    w9Status: v.optional(v.string()),
    w9ReceivedDate: v.optional(v.string()),
    paymentMethod: v.optional(v.string()),
    achAuthorizationStatus: v.optional(v.string()),
    // Rep fields
    repFirstName: v.optional(v.string()),
    repLastName: v.optional(v.string()),
    repEmail: v.optional(v.string()),
    repPhone: v.optional(v.string()),
    repNpn: v.optional(v.string()),
    assignedAgency: v.optional(v.string()),
    repLicenses: v.optional(v.string()),
    repEffectiveDate: v.optional(v.string()),
    repStatus: v.optional(v.string()),
    writingNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // ── trim all strings, drop empties ────────────────────────────────
    const cleaned: Record<string, unknown> = {};
    for (const [k, raw] of Object.entries(args)) {
      if (typeof raw === "string") {
        const trimmed = raw.trim();
        if (trimmed !== "") cleaned[k] = trimmed;
      } else if (raw !== undefined) {
        cleaned[k] = raw;
      }
    }

    const t = cleaned.submissionType as string;
    if (!t) throw new Error("submissionType is required");

    const wantsAgency = t === "agency" || t === "both";
    const wantsRep    = t === "rep"    || t === "both";

    // ── required-presence checks ──────────────────────────────────────
    if (wantsAgency && !cleaned.agencyName) throw new Error("Agency name is required.");
    if (wantsAgency && !cleaned.primaryContactName) throw new Error("Primary contact name is required.");
    if (wantsAgency && !cleaned.primaryContactEmail) throw new Error("Primary contact email is required.");
    if (wantsRep && !cleaned.repFirstName) throw new Error("Rep first name is required.");
    if (wantsRep && !cleaned.repLastName) throw new Error("Rep last name is required.");
    if (wantsRep && !cleaned.repEmail) throw new Error("Rep email is required.");

    // ── format validation ─────────────────────────────────────────────
    validateEmail(cleaned.primaryContactEmail as string, "Primary contact email");
    validateEmail(cleaned.repEmail as string, "Rep email");
    validateEin(cleaned.ein as string);
    validateNpn(cleaned.agencyNpn as string, "Agency NPN");
    validateNpn(cleaned.repNpn as string, "Rep NPN");

    // ── phone normalization ───────────────────────────────────────────
    const agencyPhone = normalizePhone(cleaned.primaryContactPhone as string | undefined);
    if (agencyPhone) cleaned.primaryContactPhone = agencyPhone;
    const repPhone = normalizePhone(cleaned.repPhone as string | undefined);
    if (repPhone) cleaned.repPhone = repPhone;

    // ── EIN normalisation (store as XX-XXXXXXX) ───────────────────────
    if (cleaned.ein) {
      const d = (cleaned.ein as string).replace(/\D/g, "");
      cleaned.ein = `${d.slice(0, 2)}-${d.slice(2)}`;
    }

    const now = Date.now();
    const id = await ctx.db.insert("repOnboardingSubmissions", {
      ...(cleaned as any),
      status: "new",
      createdAt: now,
      updatedAt: now,
    });

    return { ok: true as const, id };
  },
});

/**
 * Admin-facing list of submissions, newest first.
 */
export const listForAdmin = query({
  args: {
    status: v.optional(v.union(
      v.literal("new"),
      v.literal("reviewing"),
      v.literal("approved"),
      v.literal("rejected"),
    )),
  },
  handler: async (ctx, args) => {
    const q = args.status
      ? ctx.db.query("repOnboardingSubmissions").withIndex("by_status", (i) => i.eq("status", args.status as any))
      : ctx.db.query("repOnboardingSubmissions");
    const rows = await q.collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// ─── internal: patch status + write audit ─────────────────────────────

export const _setApprovedPartner = internalMutation({
  args: {
    id: v.id("repOnboardingSubmissions"),
    approvedPartnerId: v.string(),
    approvedRepLeaderId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      approvedPartnerId: args.approvedPartnerId,
      approvedRepLeaderId: args.approvedRepLeaderId,
      updatedAt: Date.now(),
    } as any);
  },
});

export const _patchStatus = internalMutation({  args: {
    id: v.id("repOnboardingSubmissions"),
    status: v.union(
      v.literal("new"),
      v.literal("reviewing"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
    notes: v.optional(v.string()),
    actorClerkUserId: v.string(),
    actorName: v.optional(v.string()),
    summary: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const patch: Record<string, unknown> = { status: args.status, updatedAt: now };
    if (args.notes !== undefined) patch.notes = args.notes;
    await ctx.db.patch(args.id, patch as any);
    await ctx.runMutation(internal.admin.adminAudit.record, {
      actorClerkUserId: args.actorClerkUserId,
      actorName: args.actorName,
      action: `rep_onboarding.${args.status}`,
      targetType: "repOnboardingSubmission",
      targetId: args.id,
      summary: args.summary,
      metadata: args.metadata,
    });
  },
});

// ─── mark reviewing ───────────────────────────────────────────────────

export const markReviewing = mutation({
  args: { id: v.id("repOnboardingSubmissions") },
  handler: async (ctx, args) => {
    const identity = await requireAdmin(ctx);
    const sub = await ctx.db.get(args.id);
    if (!sub) throw new Error("Submission not found");
    await ctx.db.patch(args.id, { status: "reviewing", updatedAt: Date.now() });
    await ctx.runMutation(internal.admin.adminAudit.record, {
      actorClerkUserId: identity.clerkUserId,
      action: "rep_onboarding.reviewing",
      targetType: "repOnboardingSubmission",
      targetId: args.id,
      summary: `Marked submission from ${sub.primaryContactEmail ?? sub.repEmail ?? "unknown"} as reviewing`,
    });
  },
});

// ─── reject ───────────────────────────────────────────────────────────

export const reject = mutation({
  args: {
    id: v.id("repOnboardingSubmissions"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAdmin(ctx);
    const sub = await ctx.db.get(args.id);
    if (!sub) throw new Error("Submission not found");
    const notes = args.reason
      ? `Rejected: ${args.reason}`
      : "Rejected";
    await ctx.db.patch(args.id, { status: "rejected", notes, updatedAt: Date.now() });
    await ctx.runMutation(internal.admin.adminAudit.record, {
      actorClerkUserId: identity.clerkUserId,
      action: "rep_onboarding.rejected",
      targetType: "repOnboardingSubmission",
      targetId: args.id,
      summary: `Rejected submission from ${sub.primaryContactEmail ?? sub.repEmail ?? "unknown"}: ${args.reason ?? "no reason given"}`,
    });
  },
});

// ─── approve ──────────────────────────────────────────────────────────
// Promotes the submission into distributionPartners + partnerLeaders,
// sends invite emails, and marks the submission approved.

export const approve = action({
  args: {
    id: v.id("repOnboardingSubmissions"),
    /**
     * For agency submissions: the distributionPartners._id of the parent
     * Program Manager (optional — can be linked later).
     */
    parentPartnerId: v.optional(v.id("distributionPartners")),
    /**
     * For rep-only submissions: the distributionPartners._id of the agency
     * to attach the rep under (required for rep/both submissions).
     */
    agencyPartnerId: v.optional(v.id("distributionPartners")),
  },
  handler: async (ctx, args): Promise<{
    ok: boolean;
    agencyPartnerId?: string;
    agencyLeaderId?: string;
    repLeaderId?: string;
    inviteSent: boolean;
  }> => {
    // @ts-ignore
    const identity = await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);

    // @ts-ignore
    const sub: any = await ctx.runQuery(api.repOnboarding.getById, { id: args.id });
    if (!sub) throw new Error("Submission not found");
    if (sub.status === "approved") throw new Error("Already approved");

    const wantsAgency = sub.submissionType === "agency" || sub.submissionType === "both";
    const wantsRep    = sub.submissionType === "rep"    || sub.submissionType === "both";

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://getidealoh.com";
    const makeToken = () => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
    const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000;

    let agencyPartnerId: string | undefined;
    let agencyLeaderId: string | undefined;
    let repLeaderId: string | undefined;
    let inviteSent = false;

    if (wantsAgency) {
      // Create the distributionPartners (agency) row
      agencyPartnerId = await ctx.runMutation(
        // @ts-ignore
        internal.admin.distributionPartners._createPartner,
        {
          name: sub.agencyName,
          type: "agency" as const,
          parentId: args.parentPartnerId,
          contactName: sub.primaryContactName ?? sub.agencyName,
          contactEmail: sub.primaryContactEmail,
          contactPhone: sub.primaryContactPhone,
          status: "active" as const,
          notes: sub.agencyNpn ? `NPN: ${sub.agencyNpn}` : undefined,
          createdBy: identity.clerkUserId,
        },
      );

      const agencyToken = makeToken();
      agencyLeaderId = await ctx.runMutation(
        // @ts-ignore
        internal.admin.distributionPartners._createLeader,
        {
          partnerId: agencyPartnerId as any,
          name: sub.primaryContactName ?? sub.agencyName,
          email: sub.primaryContactEmail,
          phone: sub.primaryContactPhone,
          title: "Primary Contact",
          isPrimary: true,
          inviteToken: agencyToken,
          inviteStatus: "pending" as const,
          inviteExpiry: expiry,
        },
      );

      // Attempt to send invite email via the existing dispatchInviteEmail path
      try {
        await ctx.runAction(
          // @ts-ignore
          api.admin.distributionPartners.sendLeaderInvite,
          { leaderId: agencyLeaderId as any },
        );
        inviteSent = true;
      } catch {
        // Invite email failure is non-fatal — admin can resend manually
      }
    }

    if (wantsRep) {
      // Determine which distributionPartner to attach the rep under.
      // Prefer a newly-created agency (for "both"), else the explicitly passed agency.
      const partnerId = (agencyPartnerId ?? args.agencyPartnerId) as any;
      if (!partnerId) throw new Error("agencyPartnerId is required to approve a rep submission");

      const repToken = makeToken();
      repLeaderId = await ctx.runMutation(
        // @ts-ignore
        internal.admin.distributionPartners._createLeader,
        {
          partnerId: partnerId as any,
          name: `${sub.repFirstName} ${sub.repLastName}`,
          email: sub.repEmail,
          phone: sub.repPhone,
          title: "Front-Line Rep",
          isPrimary: false,
          inviteToken: repToken,
          inviteStatus: "pending" as const,
          inviteExpiry: expiry,
        },
      );
    }

    // Mark submission approved + audit
    await ctx.runMutation(
      // @ts-ignore
      internal.repOnboarding._patchStatus,
      {
        id: args.id,
        status: "approved",
        actorClerkUserId: identity.clerkUserId,
        summary: `Approved submission from ${sub.primaryContactEmail ?? sub.repEmail ?? "unknown"}`,
        metadata: { agencyPartnerId, agencyLeaderId, repLeaderId },
      },
    );

    // Store the created partnerId on the submission for easy retroactive access
    const resolvedPartnerId = agencyPartnerId ?? args.agencyPartnerId;
    if (resolvedPartnerId) {
      await ctx.runMutation(
        // @ts-ignore
        internal.repOnboarding._setApprovedPartner,
        { id: args.id, approvedPartnerId: resolvedPartnerId, approvedRepLeaderId: repLeaderId },
      );
    }

    // Auto-provision agency code + tracking codes for the new partner
    if (resolvedPartnerId) {
      try {
        await ctx.runAction(
          // @ts-ignore
          api.admin.repCodes.provisionCodesForPartner,
          { partnerId: resolvedPartnerId as any },
        );
      } catch (e) {
        // Non-fatal — admin can provision manually via the drawer button
        console.warn("[approve] provisionCodesForPartner failed:", e);
      }
    }

    return { ok: true, agencyPartnerId, agencyLeaderId, repLeaderId, inviteSent };
  },
});

// ─── get single (for admin detail view) ──────────────────────────────

export const getById = query({
  args: { id: v.id("repOnboardingSubmissions") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.id);
  },
});
