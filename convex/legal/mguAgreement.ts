/**
 * MASTER MGU AGREEMENT
 *
 * The agreement agencies sign with Ideal Health. Staff upload the document as
 * a PDF — each upload is a new version and replaces the previous one — and
 * agency principals review and e-sign it in the partner portal.
 *
 * Nothing is shown to partners until a version has been uploaded, so the
 * signing flow can ship before the legal text is final.
 *
 * WHO SIGNS: the agency's principal, using the same rule as the partner
 * agreement card (resources/agreement.ts): partner scope, or a rep scope whose
 * leader row is the agency's primary. Downline reps never sign for an agency.
 * Only agencies and FMOs sign; Program Managers have their own contracts.
 */

import { mutation, query, type QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { requireAccess } from "../lib/authGuards";
import { recordAdminAction } from "../admin/adminAudit";
import { tryResolveViewerScope } from "../insights/scope";

const SIGNING_PARTNER_TYPES = new Set<Doc<"distributionPartners">["type"]>(["agency", "fmo"]);

export function acknowledgmentText(version: number, partnerName: string): string {
  return (
    `I have read the Master MGU Agreement (version ${version}) and I am authorized to sign it ` +
    `on behalf of ${partnerName}. Typing my name is my electronic signature.`
  );
}

async function activeVersion(ctx: QueryCtx) {
  return await ctx.db
    .query("mguAgreementVersions")
    .withIndex("by_status", (q) => q.eq("status", "active"))
    .first();
}

/** The agency the signed-in person may sign for, or null. */
async function resolvePrincipal(ctx: QueryCtx) {
  const scope = await tryResolveViewerScope(ctx, { staff: [], partner: "any" });
  if (!scope || scope.kind === "admin") return null;

  let partnerId: Id<"distributionPartners">;
  if (scope.kind === "partner") {
    partnerId = scope.partnerId;
  } else {
    const leader = await ctx.db.get(scope.leaderId);
    if (!leader?.isPrimary) return null;
    partnerId = leader.partnerId;
  }
  const partner = await ctx.db.get(partnerId);
  if (!partner || partner.status !== "active" || !SIGNING_PARTNER_TYPES.has(partner.type)) return null;
  const identity = await ctx.auth.getUserIdentity();
  return { partner, clerkUserId: scope.clerkUserId, email: identity?.email };
}

// ─────────────────────────────────────────────────────────────────────
// PARTNER PORTAL
// ─────────────────────────────────────────────────────────────────────

/** The card on the partner portal: what to sign, and whether it's signed. */
export const getMine = query({
  args: {},
  handler: async (ctx) => {
    const principal = await resolvePrincipal(ctx);
    if (!principal) return null;
    const current = await activeVersion(ctx);
    if (!current) return null;

    const signatures = await ctx.db
      .query("mguAgreementSignatures")
      .withIndex("by_partner", (q) => q.eq("partnerId", principal.partner._id))
      .collect();
    const signed = signatures.find((s) => s.versionId === current._id) ?? null;
    const lastSigned = signatures.sort((a, b) => b.signedAt - a.signedAt)[0] ?? null;

    return {
      versionId: current._id,
      version: current.version,
      title: current.title,
      fileName: current.fileName,
      partnerName: principal.partner.name,
      acknowledgment: acknowledgmentText(current.version, principal.partner.name),
      signed: signed && { signerName: signed.signerName, signerTitle: signed.signerTitle, signedAt: signed.signedAt },
      // Signed an earlier version, so this is a re-sign of an updated agreement.
      previousVersion: !signed && lastSigned ? lastSigned.version : null,
    };
  },
});

/** A URL for reading the current agreement. Minted per click, principal only. */
export const getMineDocumentUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const principal = await resolvePrincipal(ctx);
    if (!principal) return null;
    const current = await activeVersion(ctx);
    if (!current) return null;
    const url = await ctx.storage.getUrl(current.storageId);
    return url ? { url, fileName: current.fileName } : null;
  },
});

export const sign = mutation({
  args: {
    versionId: v.id("mguAgreementVersions"),
    signerName: v.string(),
    signerTitle: v.string(),
    acknowledged: v.boolean(),
  },
  handler: async (ctx, args) => {
    const principal = await resolvePrincipal(ctx);
    if (!principal) throw new Error("Only an agency's principal can sign the MGU agreement.");
    const current = await activeVersion(ctx);
    // Signing a version that was replaced while the page was open would bind
    // them to text that is no longer current.
    if (!current || current._id !== args.versionId) {
      throw new Error("The agreement was just updated. Reload the page to review the current version.");
    }
    const signerName = args.signerName.trim();
    const signerTitle = args.signerTitle.trim();
    if (signerName.length < 2 || signerName.length > 120) throw new Error("Type your full name to sign.");
    if (!signerTitle || signerTitle.length > 120) throw new Error("Enter your title.");
    if (!args.acknowledged) throw new Error("Confirm that you're authorized to sign for the agency.");

    const existing = await ctx.db
      .query("mguAgreementSignatures")
      .withIndex("by_partner", (q) => q.eq("partnerId", principal.partner._id))
      .collect();
    if (existing.some((s) => s.versionId === current._id)) {
      throw new Error("This version is already signed for your agency.");
    }

    const now = Date.now();
    await ctx.db.insert("mguAgreementSignatures", {
      versionId: current._id,
      version: current.version,
      partnerId: principal.partner._id,
      partnerName: principal.partner.name,
      signerClerkUserId: principal.clerkUserId,
      signerEmail: principal.email,
      signerName,
      signerTitle,
      acknowledgment: acknowledgmentText(current.version, principal.partner.name),
      signedAt: now,
    });
    return { signedAt: now };
  },
});

// ─────────────────────────────────────────────────────────────────────
// STAFF
// ─────────────────────────────────────────────────────────────────────

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAccess(ctx, "partners.manage");
    return await ctx.storage.generateUploadUrl();
  },
});

/** Upload a new version. It becomes the one agencies sign; the old one retires. */
export const publishVersion = mutation({
  args: {
    storageId: v.id("_storage"),
    fileName: v.string(),
    title: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAccess(ctx, "partners.manage");
    const file = await ctx.db.system.get(args.storageId);
    if (!file) throw new Error("Upload not found. Try again.");
    if (file.contentType !== "application/pdf" && !args.fileName.toLowerCase().endsWith(".pdf")) {
      await ctx.storage.delete(args.storageId);
      throw new Error("Upload the agreement as a PDF.");
    }

    const all = await ctx.db.query("mguAgreementVersions").collect();
    const now = Date.now();
    for (const row of all.filter((r) => r.status === "active")) {
      await ctx.db.patch(row._id, { status: "retired", retiredAt: now });
    }
    const version = all.reduce((max, r) => Math.max(max, r.version), 0) + 1;
    const versionId = await ctx.db.insert("mguAgreementVersions", {
      version,
      title: args.title?.trim() || "Master MGU Agreement",
      storageId: args.storageId,
      fileName: args.fileName,
      status: "active",
      notes: args.notes?.trim() || undefined,
      uploadedBy: identity.clerkUserId,
      uploadedByName: identity.name ?? identity.email,
      createdAt: now,
    });

    await recordAdminAction(ctx, identity, {
      action: "publishMguAgreement",
      targetType: "mguAgreementVersions",
      targetId: String(versionId),
      summary: `Published Master MGU Agreement version ${version} (${args.fileName})`,
      metadata: { version, fileName: args.fileName },
    });
    return { versionId, version };
  },
});

/** Versions, and which agencies have signed the current one. */
export const getAdminOverview = query({
  args: {},
  handler: async (ctx) => {
    await requireAccess(ctx, "partners.view");
    const versions = (await ctx.db.query("mguAgreementVersions").collect()).sort((a, b) => b.version - a.version);
    const current = versions.find((v) => v.status === "active") ?? null;

    const partners = (await ctx.db.query("distributionPartners").withIndex("by_status", (q) => q.eq("status", "active")).collect())
      .filter((p) => SIGNING_PARTNER_TYPES.has(p.type));
    const signatures = current
      ? await ctx.db.query("mguAgreementSignatures").withIndex("by_version", (q) => q.eq("versionId", current._id)).collect()
      : [];
    const byPartner = new Map(signatures.map((s) => [String(s.partnerId), s]));

    return {
      current: current && {
        _id: current._id, version: current.version, title: current.title, fileName: current.fileName,
        createdAt: current.createdAt, uploadedByName: current.uploadedByName ?? null, notes: current.notes ?? null,
      },
      versions: versions.map((v) => ({
        _id: v._id, version: v.version, fileName: v.fileName, status: v.status, createdAt: v.createdAt,
      })),
      agencies: partners
        .map((p) => {
          const s = byPartner.get(String(p._id));
          return {
            partnerId: p._id,
            name: p.name,
            type: p.type,
            signed: s ? { signerName: s.signerName, signerTitle: s.signerTitle, signerEmail: s.signerEmail ?? null, signedAt: s.signedAt } : null,
          };
        })
        .sort((a, b) => Number(!!a.signed) - Number(!!b.signed) || a.name.localeCompare(b.name)),
    };
  },
});

export const getVersionUrl = mutation({
  args: { versionId: v.id("mguAgreementVersions") },
  handler: async (ctx, args) => {
    await requireAccess(ctx, "partners.view");
    const row = await ctx.db.get(args.versionId);
    if (!row) return null;
    const url = await ctx.storage.getUrl(row.storageId);
    return url ? { url, fileName: row.fileName } : null;
  },
});
