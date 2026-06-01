import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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
    // Trim strings + drop empty strings to keep the table tidy.
    const cleaned: Record<string, unknown> = {};
    for (const [k, raw] of Object.entries(args)) {
      if (typeof raw === "string") {
        const trimmed = raw.trim();
        if (trimmed !== "") cleaned[k] = trimmed;
      } else if (raw !== undefined) {
        cleaned[k] = raw;
      }
    }

    if (!cleaned.submissionType) {
      throw new Error("submissionType is required");
    }

    const wantsAgency = cleaned.submissionType === "agency" || cleaned.submissionType === "both";
    const wantsRep = cleaned.submissionType === "rep" || cleaned.submissionType === "both";

    if (wantsAgency && !cleaned.agencyName) {
      throw new Error("Agency name is required for agency submissions.");
    }
    if (wantsAgency && !cleaned.primaryContactEmail) {
      throw new Error("Primary contact email is required for agency submissions.");
    }
    if (wantsRep && (!cleaned.repFirstName || !cleaned.repLastName || !cleaned.repEmail)) {
      throw new Error("Rep first name, last name, and email are required for rep submissions.");
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
