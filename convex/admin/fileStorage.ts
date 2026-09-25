import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { requireAdmin } from "../lib/authGuards";

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Resolve a stored file to a URL.
 *
 * Guarded because this accepts ANY storage id and a Convex storage URL is a
 * bearer credential — unguarded, it would hand out signed URLs for W-9 PDFs
 * (which embed a full TIN), eligibility files, and vendor exports to anyone
 * who could reach the endpoint. Its only callers are the admin hierarchy
 * logo pickers.
 *
 * Partner-facing file access does NOT go through here: see
 * convex/resources/library.ts, which re-checks per-resource visibility before
 * minting a URL.
 */
export const getFileUrl = query({
  args: { storageId: v.string() },
  handler: async (ctx, { storageId }) => {
    await requireAdmin(ctx);
    return await ctx.storage.getUrl(storageId as Id<"_storage">);
  },
});
