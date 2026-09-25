import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internal, api } from "./_generated/api";
import { requireAdmin, requireAdminAction } from "./lib/authGuards";
import { getBaseUrl } from "./lib/env";

/**
 * Public upload URL for the Partner Kit intake. This is a public-facing
 * onboarding form (prospective partners have no account yet), so — like
 * repOnboarding.submit and legal/w9Forms.submitW9 — it is intentionally
 * unauthenticated. The returned URL is a short-lived, single-use Convex
 * storage upload target.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Public — submit a Partner Agreement & Acknowledgment (Partner Kit section 7).
 * The agreement can be completed online (signatureDataUrl + acknowledged) or
 * uploaded as a completed PDF (method === "upload"). A W-9 can be attached
 * either as an e-signed w9Forms row (w9FormId) or an uploaded file (w9FileId).
 */
export const submit = mutation({
  args: {
    partnerAgencyName: v.string(),
    dba: v.optional(v.string()),
    primaryContactName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    npnLicenseInfo: v.optional(v.string()),
    effectiveDate: v.optional(v.string()),
    signatureDataUrl: v.optional(v.string()),
    printedName: v.optional(v.string()),
    title: v.optional(v.string()),
    signedDate: v.optional(v.string()),
    acknowledged: v.boolean(),
    method: v.union(v.literal("online"), v.literal("upload")),
    partnerKitFileId: v.optional(v.string()),
    partnerKitFileName: v.optional(v.string()),
    w9FormId: v.optional(v.id("w9Forms")),
    w9FileId: v.optional(v.string()),
    w9FileName: v.optional(v.string()),
    submittedFromIp: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ ok: true; id: Id<"partnerKitSubmissions"> }> => {
    if (!args.acknowledged) {
      throw new Error("You must acknowledge the Partner Agreement before submitting.");
    }
    if (args.method === "online" && !args.signatureDataUrl) {
      throw new Error("An authorized signature is required to complete the agreement online.");
    }
    if (args.method === "upload" && !args.partnerKitFileId) {
      throw new Error("Please attach your completed Partner Kit PDF.");
    }

    const now = Date.now();

    // ── auto-match by email to an existing application / lead ──────────
    const email = args.email.trim();
    const matchedApp = await ctx.db
      .query("repOnboardingSubmissions")
      .withIndex("by_email", (q) => q.eq("primaryContactEmail", email))
      .first();
    const matchedAppByRep = matchedApp
      ? null
      : await ctx.db
          .query("repOnboardingSubmissions")
          .withIndex("by_rep_email", (q) => q.eq("repEmail", email))
          .first();
    const application = matchedApp ?? matchedAppByRep;
    const matchedLead = await ctx.db
      .query("partnerRegistrations")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    const id = await ctx.db.insert("partnerKitSubmissions", {
      ...args,
      ...(application ? { matchedApplicationId: application._id } : {}),
      ...(matchedLead ? { matchedLeadId: matchedLead._id } : {}),
      status: "new" as const,
      createdAt: now,
      updatedAt: now,
    });

    // ── back-link the application to this signed kit ───────────────────
    if (application && !application.partnerKitSubmissionId) {
      await ctx.db.patch(application._id, {
        partnerKitSubmissionId: id,
        updatedAt: now,
      });
    }

    // The online path has no signed PDF — only field values and a signature
    // image. Compose the executed copy now, at execution time, rather than
    // lazily on first download: the record should exist from the moment the
    // agreement is signed. Scheduled because rendering needs an action.
    if (args.method === "online") {
      await ctx.scheduler.runAfter(0, internal.partnerKit.generateExecutedAgreement, {
        id,
      });
    }

    return { ok: true, id };
  },
});

// ─── Admin-facing read access ──────────────────────────────────────────

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("partnerKitSubmissions").order("desc").collect();
  },
});

export const getWithFiles = query({
  args: { id: v.id("partnerKitSubmissions") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const row = await ctx.db.get(args.id);
    if (!row) return null;

    const partnerKitFileUrl = row.partnerKitFileId
      ? await ctx.storage.getUrl(row.partnerKitFileId as Id<"_storage">)
      : null;
    const w9UploadUrl = row.w9FileId
      ? await ctx.storage.getUrl(row.w9FileId as Id<"_storage">)
      : null;

    let w9SignedUrl: string | null = null;
    let w9MaskedTin: string | null = null;
    if (row.w9FormId) {
      const w9 = await ctx.db.get(row.w9FormId);
      if (w9) {
        w9SignedUrl = await ctx.storage.getUrl(w9.storageId as Id<"_storage">);
        w9MaskedTin = w9.maskedTin;
      }
    }

    return { ...row, partnerKitFileUrl, w9UploadUrl, w9SignedUrl, w9MaskedTin };
  },
});

export const getById = query({
  args: { id: v.id("partnerKitSubmissions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// ─── manual match — link a signed kit to an application ────────────────

export const linkToApplication = mutation({
  args: {
    id: v.id("partnerKitSubmissions"),
    applicationId: v.id("repOnboardingSubmissions"),
  },
  handler: async (ctx, args) => {
    const identity = await requireAdmin(ctx);
    const kit = await ctx.db.get(args.id);
    if (!kit) throw new Error("Partner Kit submission not found");
    const app = await ctx.db.get(args.applicationId);
    if (!app) throw new Error("Application not found");

    const now = Date.now();
    await ctx.db.patch(args.id, { matchedApplicationId: args.applicationId, updatedAt: now });
    await ctx.db.patch(args.applicationId, { partnerKitSubmissionId: args.id, updatedAt: now });

    await ctx.runMutation(internal.admin.adminAudit.record, {
      actorClerkUserId: identity.clerkUserId,
      action: "partner_kit.linked_to_application",
      targetType: "partnerKitSubmissions",
      targetId: args.id,
      summary: `Linked signed Partner Kit for ${kit.partnerAgencyName} to application ${args.applicationId}`,
    });
  },
});

// ─── internal: stamp a kit as approved + surface its W-9 form id ───────

export const _stampApproved = internalMutation({
  args: {
    id: v.id("partnerKitSubmissions"),
    approvedPartnerId: v.string(),
    approvedRepLeaderId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ w9FormId?: Id<"w9Forms"> }> => {
    const kit = await ctx.db.get(args.id);
    if (!kit) throw new Error("Partner Kit submission not found");
    await ctx.db.patch(args.id, {
      status: "approved" as const,
      approvedPartnerId: args.approvedPartnerId,
      approvedRepLeaderId: args.approvedRepLeaderId,
      updatedAt: Date.now(),
    });
    return { w9FormId: kit.w9FormId };
  },
});

// ─── standalone promotion — signed kit → broker (distributionPartners) ─
// For kits with no linked application. Mirrors repOnboarding.approve.

export const approveAsPartner = action({
  args: {
    id: v.id("partnerKitSubmissions"),
    /** Optional parent Program Manager / FMO for tree placement. */
    parentPartnerId: v.optional(v.id("distributionPartners")),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: boolean; partnerId: string; leaderId: string; inviteSent: boolean }> => {
    // @ts-ignore
    const identity = await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);

    // @ts-ignore
    const kit: any = await ctx.runQuery(api.partnerKit.getById, { id: args.id });
    if (!kit) throw new Error("Partner Kit submission not found");
    if (kit.approvedPartnerId) throw new Error("Already promoted to a partner");
    if (kit.matchedApplicationId) {
      throw new Error(
        "This kit is linked to an application — approve it from the application instead.",
      );
    }

    const makeToken = () => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
    const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000;

    // Create the distributionPartners (agency) row
    const partnerId: string = await ctx.runMutation(
      // @ts-ignore
      internal.admin.distributionPartners._createPartner,
      {
        name: kit.partnerAgencyName,
        type: "agency" as const,
        parentId: args.parentPartnerId,
        contactName: kit.primaryContactName ?? kit.partnerAgencyName,
        contactEmail: kit.email,
        contactPhone: kit.phone,
        status: "active" as const,
        notes: kit.npnLicenseInfo ? `NPN/License: ${kit.npnLicenseInfo}` : undefined,
        createdBy: identity.clerkUserId,
      },
    );

    const leaderId: string = await ctx.runMutation(
      // @ts-ignore
      internal.admin.distributionPartners._createLeader,
      {
        partnerId: partnerId as any,
        name: kit.primaryContactName ?? kit.partnerAgencyName,
        email: kit.email,
        phone: kit.phone,
        title: "Primary Contact",
        isPrimary: true,
        inviteToken: makeToken(),
        inviteStatus: "pending" as const,
        inviteExpiry: expiry,
      },
    );

    let inviteSent = false;
    try {
      await ctx.runAction(
        // @ts-ignore
        api.admin.distributionPartners.sendLeaderInvite,
        { leaderId: leaderId as any },
      );
      inviteSent = true;
    } catch {
      // Non-fatal — admin can resend manually
    }

    // Stamp the kit approved + capture its W-9 form id
    const { w9FormId } = await ctx.runMutation(internal.partnerKit._stampApproved, {
      id: args.id,
      approvedPartnerId: partnerId,
      approvedRepLeaderId: leaderId,
    });

    // Link the kit's W-9 to the new partner (if e-signed)
    if (w9FormId) {
      try {
        await ctx.runMutation(internal.legal.w9Forms._linkPartnerByFormId, {
          w9FormId: w9FormId as any,
          partnerId: partnerId as any,
        });
      } catch (e) {
        console.warn("[approveAsPartner] linking W-9 failed:", e);
      }
    }

    // Provision agency code + rep codes
    try {
      await ctx.runAction(
        // @ts-ignore
        api.admin.repCodes.provisionCodesForPartner,
        { partnerId: partnerId as any },
      );
    } catch (e) {
      console.warn("[approveAsPartner] provisionCodesForPartner failed:", e);
    }

    await ctx.runMutation(internal.admin.adminAudit.record, {
      actorClerkUserId: identity.clerkUserId,
      action: "partner_kit.promoted",
      targetType: "partnerKitSubmissions",
      targetId: args.id,
      summary: `Promoted signed Partner Kit for ${kit.partnerAgencyName} to a broker`,
      metadata: { partnerId, leaderId },
    });

    return { ok: true, partnerId, leaderId, inviteSent };
  },
});

/* ------------------------------------------------------------------ */
/* Executed agreement — the partner's own signed copy                  */
/* ------------------------------------------------------------------ */

/**
 * Render and store the executed agreement for an online submission.
 *
 * Only the online path needs this. An uploaded kit is already a signed PDF
 * (`partnerKitFileId`) and is served as-is — re-rendering it would replace the
 * partner's own instrument with our reconstruction of it.
 *
 * Idempotent: a submission that already has a rendered file is left alone, so
 * the backfill and the post-submit schedule cannot duplicate work.
 */
export const generateExecutedAgreement = internalAction({
  args: { id: v.id("partnerKitSubmissions"), appUrl: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ ok: boolean; skipped?: string }> => {
    const kit = await ctx.runQuery(internal.partnerKit._getForRender, { id: args.id });
    if (!kit) return { ok: false, skipped: "not_found" };
    if (kit.executedAgreementFileId) return { ok: true, skipped: "already_rendered" };
    if (kit.method !== "online") return { ok: false, skipped: "uploaded_kit" };
    if (!kit.signatureDataUrl) return { ok: false, skipped: "no_signature" };

    const baseUrl = args.appUrl ?? getBaseUrl();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const internalSecret = process.env.INTERNAL_API_SECRET;
    if (internalSecret) headers["Authorization"] = `Bearer ${internalSecret}`;

    const response = await fetch(`${baseUrl}/api/generate-partner-agreement-pdf`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        partnerAgencyName: kit.partnerAgencyName,
        dba: kit.dba,
        primaryContactName: kit.primaryContactName,
        email: kit.email,
        phone: kit.phone,
        npnLicenseInfo: kit.npnLicenseInfo,
        effectiveDate: kit.effectiveDate,
        signatureDataUrl: kit.signatureDataUrl,
        printedName: kit.printedName,
        title: kit.title,
        signedDate: kit.signedDate,
        submittedAt: kit.createdAt,
        submittedFromIp: kit.submittedFromIp,
      }),
    });

    if (!response.ok) {
      const snippet = (await response.text()).replace(/\s+/g, " ").slice(0, 200);
      throw new Error(
        `Partner agreement PDF service returned ${response.status} from ` +
          `${baseUrl}/api/generate-partner-agreement-pdf. Confirm the app is deployed there ` +
          `(or set NEXT_PUBLIC_APP_URL on this Convex deployment). Response: ${snippet}`,
      );
    }

    // The route returns PDF bytes rather than base64 — the kit pages make this
    // a multi-megabyte document, and base64 would inflate it by a third for no
    // reason. Blob straight into storage.
    const blob = await response.blob();
    const storageId = await ctx.storage.store(blob);

    await ctx.runMutation(internal.partnerKit._setExecutedAgreementFile, {
      id: args.id,
      storageId: storageId as unknown as string,
    });

    return { ok: true };
  },
});

/** Everything the renderer needs. Internal — this row carries the signature. */
export const _getForRender = internalQuery({
  args: { id: v.id("partnerKitSubmissions") },
  handler: async (ctx, args) => await ctx.db.get(args.id),
});

export const _setExecutedAgreementFile = internalMutation({
  args: { id: v.id("partnerKitSubmissions"), storageId: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    // Lost a race with another render — drop ours rather than orphan the file.
    if (!row || row.executedAgreementFileId) {
      await ctx.storage.delete(args.storageId as Id<"_storage">).catch(() => {});
      return;
    }
    await ctx.db.patch(args.id, {
      executedAgreementFileId: args.storageId,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Render executed copies for submissions signed before this existed.
 *
 * Admin-triggered and safe to re-run — `generateExecutedAgreement` skips any
 * submission that already has a file.
 */
export const backfillExecutedAgreements = action({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<{ scheduled: number }> => {
    await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);

    const pending: Id<"partnerKitSubmissions">[] = await ctx.runQuery(
      internal.partnerKit._listMissingExecutedAgreements,
      { limit: args.limit ?? 50 },
    );

    for (const id of pending) {
      await ctx.scheduler.runAfter(0, internal.partnerKit.generateExecutedAgreement, { id });
    }
    return { scheduled: pending.length };
  },
});

export const _listMissingExecutedAgreements = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("partnerKitSubmissions").collect();
    return rows
      .filter((r) => r.method === "online" && !!r.signatureDataUrl && !r.executedAgreementFileId)
      .slice(0, args.limit)
      .map((r) => r._id);
  },
});
