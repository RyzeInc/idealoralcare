import { action, internalMutation, query } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { requireAdmin } from "../lib/authGuards";
import { getBaseUrl } from "../lib/env";

const TIN_DIGITS_RE = /^\d{9}$/;

function maskTin(tinType: "ssn" | "ein", tin: string): string {
  const digits = tin.replace(/\D/g, "");
  const last4 = digits.slice(-4);
  return tinType === "ssn" ? `***-**-${last4}` : `**-***${last4}`;
}

/**
 * Public action — submits a signed substitute Form W-9 for a distributor
 * partner/rep onboarding submission. Public (no auth) to match the existing
 * repOnboarding.submit flow it's paired with, which is a public intake form
 * for applicants who don't yet have accounts.
 *
 * The full TIN is only ever sent to the PDF-rendering route over an internal,
 * secret-gated call and embedded in the generated PDF — it is never stored
 * as a plaintext DB field. Only a masked version is kept for admin display.
 */
export const submitW9 = action({
  args: {
    repSubmissionId: v.optional(v.id("repOnboardingSubmissions")),
    legalName: v.string(),
    businessName: v.optional(v.string()),
    taxClassification: v.union(
      v.literal("individual"),
      v.literal("c_corp"),
      v.literal("s_corp"),
      v.literal("partnership"),
      v.literal("trust_estate"),
      v.literal("llc"),
      v.literal("other"),
    ),
    llcTaxClassification: v.optional(v.string()),
    address: v.string(),
    city: v.string(),
    state: v.string(),
    zip: v.string(),
    tinType: v.union(v.literal("ssn"), v.literal("ein")),
    tin: v.string(),
    signatureDataUrl: v.string(),
    signerIp: v.optional(v.string()),
    // Allows callers to override the app base URL (useful in tests / staging) —
    // same override pattern as sendFulfillmentPacketEmail.
    appUrl: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ ok: true; w9FormId: string }> => {
    const tinDigits = args.tin.replace(/\D/g, "");
    if (!TIN_DIGITS_RE.test(tinDigits)) {
      throw new Error("TIN must be 9 digits.");
    }
    if (!args.signatureDataUrl) {
      throw new Error("Signature is required.");
    }

    const signedAt = Date.now();

    // 1. Render the PDF (Node/react-pdf runs in the Next.js API route, not
    // in the Convex action runtime — same pattern as generateFulfillmentPdfs).
    const baseUrl = args.appUrl ?? getBaseUrl();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const internalSecret = process.env.INTERNAL_API_SECRET;
    if (internalSecret) headers["Authorization"] = `Bearer ${internalSecret}`;

    const pdfResponse = await fetch(`${baseUrl}/api/generate-w9-pdf`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        legalName: args.legalName,
        businessName: args.businessName,
        taxClassification: args.taxClassification,
        llcTaxClassification: args.llcTaxClassification,
        address: args.address,
        city: args.city,
        state: args.state,
        zip: args.zip,
        tinType: args.tinType,
        tin: tinDigits,
        signatureDataUrl: args.signatureDataUrl,
        signedAt,
        signerIp: args.signerIp,
      }),
    });

    if (!pdfResponse.ok) {
      const snippet = (await pdfResponse.text()).replace(/\s+/g, " ").slice(0, 200);
      throw new Error(
        `W-9 PDF service returned ${pdfResponse.status} from ${baseUrl}/api/generate-w9-pdf. ` +
          `Confirm the app is deployed there (or set NEXT_PUBLIC_APP_URL on this Convex deployment ` +
          `to a reachable URL that serves the route). Response: ${snippet}`,
      );
    }
    const { pdf: pdfBase64 } = await pdfResponse.json();

    // 2. Store the PDF in Convex file storage — this is the only place the
    // full TIN is persisted, inside the encrypted-at-rest storage layer.
    // The Convex default runtime has no Node `Buffer`; decode base64 with the
    // web-standard atob + Uint8Array instead.
    const binary = atob(pdfBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: "application/pdf" });
    const storageId = await ctx.storage.store(blob);

    // 3. Insert the metadata row (masked TIN only).
    const w9FormId: string = await ctx.runMutation(internal.legal.w9Forms._insert, {
      repSubmissionId: args.repSubmissionId,
      legalName: args.legalName,
      businessName: args.businessName,
      taxClassification: args.taxClassification,
      llcTaxClassification: args.llcTaxClassification,
      address: args.address,
      city: args.city,
      state: args.state,
      zip: args.zip,
      tinType: args.tinType,
      maskedTin: maskTin(args.tinType, tinDigits),
      storageId: storageId as unknown as string,
      signedAt,
      signerIp: args.signerIp,
    });

    // 4. Keep the existing repOnboardingSubmissions W-9 status fields in sync
    // so the current admin UI (and any downstream logic keyed on them) keeps working.
    if (args.repSubmissionId) {
      await ctx.runMutation(internal.legal.w9Forms._markSubmissionW9Received, {
        id: args.repSubmissionId,
      });
    }

    return { ok: true, w9FormId };
  },
});

export const _insert = internalMutation({
  args: {
    repSubmissionId: v.optional(v.id("repOnboardingSubmissions")),
    legalName: v.string(),
    businessName: v.optional(v.string()),
    taxClassification: v.union(
      v.literal("individual"),
      v.literal("c_corp"),
      v.literal("s_corp"),
      v.literal("partnership"),
      v.literal("trust_estate"),
      v.literal("llc"),
      v.literal("other"),
    ),
    llcTaxClassification: v.optional(v.string()),
    address: v.string(),
    city: v.string(),
    state: v.string(),
    zip: v.string(),
    tinType: v.union(v.literal("ssn"), v.literal("ein")),
    maskedTin: v.string(),
    storageId: v.string(),
    signedAt: v.number(),
    signerIp: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("w9Forms", { ...args, status: "signed" as const, createdAt: Date.now() });
  },
});

export const _markSubmissionW9Received = internalMutation({
  args: { id: v.id("repOnboardingSubmissions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      w9Status: "received",
      w9ReceivedDate: new Date().toISOString().split("T")[0],
      updatedAt: Date.now(),
    });
  },
});

/**
 * Called from repOnboarding.approve once the real distributionPartners row
 * exists, so the signed W-9 stays linked past the submission stage.
 */
export const _linkPartner = internalMutation({
  args: {
    repSubmissionId: v.id("repOnboardingSubmissions"),
    partnerId: v.id("distributionPartners"),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("w9Forms")
      .withIndex("by_repSubmissionId", (q) => q.eq("repSubmissionId", args.repSubmissionId))
      .first();
    if (row) {
      await ctx.db.patch(row._id, { partnerId: args.partnerId });
    }
  },
});

/**
 * Link a W-9 to a partner by the w9Forms row id directly. Used when the W-9
 * came in through a Partner Kit submission (partnerKitSubmissions.w9FormId)
 * rather than a rep-onboarding submission.
 */
export const _linkPartnerByFormId = internalMutation({
  args: {
    w9FormId: v.id("w9Forms"),
    partnerId: v.id("distributionPartners"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.w9FormId, { partnerId: args.partnerId });
  },
});

// ─── Admin-facing read access ──────────────────────────────────────────

export const getW9ForSubmission = query({
  args: { repSubmissionId: v.id("repOnboardingSubmissions") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const row = await ctx.db
      .query("w9Forms")
      .withIndex("by_repSubmissionId", (q) => q.eq("repSubmissionId", args.repSubmissionId))
      .first();
    if (!row) return null;
    const fileUrl = await ctx.storage.getUrl(row.storageId as Id<"_storage">);
    return { ...row, fileUrl };
  },
});

export const getW9ForPartner = query({
  args: { partnerId: v.id("distributionPartners") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const row = await ctx.db
      .query("w9Forms")
      .withIndex("by_partnerId", (q) => q.eq("partnerId", args.partnerId))
      .first();
    if (!row) return null;
    const fileUrl = await ctx.storage.getUrl(row.storageId as Id<"_storage">);
    return { ...row, fileUrl };
  },
});
