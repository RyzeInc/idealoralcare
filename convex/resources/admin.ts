/**
 * PARTNER RESOURCE LIBRARY — the admin/curation side.
 *
 * Internal staff only. `requireStaffAdmin` rather than `requireAdmin`: a
 * partner must never be able to publish material to other partners, and the
 * distinction matters here in a way it does not for a read-only surface.
 */

import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { Doc } from "../_generated/dataModel";
import { requireStaffAdmin } from "../lib/authGuards";
import { ACTIVE_CATEGORIES, CATEGORY_LABEL } from "./library";

// Narrower than the schema union on purpose: retired categories still
// validate on read, but nothing new may be filed under one.
const categoryValidator = v.union(
  v.literal("partner_kit"),
  v.literal("partner_pieces"),
  v.literal("other"),
);

const audienceValidator = v.union(
  v.literal("all"),
  v.literal("partner_types"),
  v.literal("specific"),
);

const partnerTypeValidator = v.union(
  v.literal("program_manager"),
  v.literal("fmo"),
  v.literal("agency"),
);

/** Upload target for a resource file. Staff-only. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireStaffAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Every resource, published or not, with its visibility spelled out. */
export const listAll = query({
  args: { includeArchived: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requireStaffAdmin(ctx);

    const [resources, partners, sites] = await Promise.all([
      ctx.db.query("partnerResources").withIndex("by_created").order("desc").collect(),
      ctx.db.query("distributionPartners").collect(),
      ctx.db.query("sites").collect(),
    ]);

    const partnerNames = new Map(partners.map((p) => [String(p._id), p.name]));
    const siteNames = new Map(sites.map((s) => [String(s._id), s.name]));

    const rows = resources
      .filter((r) => args.includeArchived || r.status !== "archived")
      .map((r) => ({
        _id: r._id,
        title: r.title,
        description: r.description,
        category: r.category,
        categoryLabel: CATEGORY_LABEL[r.category] ?? r.category,
        kind: r.kind,
        fileName: r.fileName,
        contentType: r.contentType,
        fileSizeBytes: r.fileSizeBytes,
        externalUrl: r.externalUrl,
        status: r.status,
        featured: r.featured === true,
        sortOrder: r.sortOrder,
        version: r.version,
        audience: r.audience,
        partnerTypes: r.partnerTypes ?? [],
        // Resolved to names so the admin table is readable without a join.
        partnerNames: (r.partnerIds ?? []).map(
          (id) => partnerNames.get(id) ?? "(deleted partner)",
        ),
        siteNames: (r.siteIds ?? []).map(
          (id) => siteNames.get(String(id)) ?? "(deleted site)",
        ),
        /** Empty means every brand — the common case. */
        allBrands: !r.siteIds || r.siteIds.length === 0,
        downloadCount: r.downloadCount ?? 0,
        lastDownloadedAt: r.lastDownloadedAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));

    return {
      rows,
      totals: {
        published: resources.filter((r) => r.status === "published").length,
        draft: resources.filter((r) => r.status === "draft").length,
        archived: resources.filter((r) => r.status === "archived").length,
        downloads: resources.reduce((s, r) => s + (r.downloadCount ?? 0), 0),
      },
    };
  },
});

/** Options for the visibility pickers. */
export const getVisibilityOptions = query({
  args: {},
  handler: async (ctx) => {
    await requireStaffAdmin(ctx);
    const [partners, sites] = await Promise.all([
      ctx.db.query("distributionPartners").collect(),
      ctx.db.query("sites").collect(),
    ]);
    return {
      partners: partners
        .filter((p) => p.status === "active")
        .map((p) => ({ id: String(p._id), name: p.name, type: p.type }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      sites: sites
        .map((s) => ({ id: String(s._id), name: s.name, type: s.type }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      categories: ACTIVE_CATEGORIES.map((value) => ({
        value,
        label: CATEGORY_LABEL[value],
      })),
    };
  },
});

export const createResource = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    category: categoryValidator,
    kind: v.union(v.literal("file"), v.literal("link")),
    storageId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    contentType: v.optional(v.string()),
    fileSizeBytes: v.optional(v.number()),
    externalUrl: v.optional(v.string()),
    audience: audienceValidator,
    partnerTypes: v.optional(v.array(partnerTypeValidator)),
    partnerIds: v.optional(v.array(v.string())),
    siteIds: v.optional(v.array(v.id("sites"))),
    status: v.optional(v.union(v.literal("draft"), v.literal("published"))),
    featured: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
    supersedesId: v.optional(v.id("partnerResources")),
  },
  handler: async (ctx, args) => {
    const identity = await requireStaffAdmin(ctx);

    // Refuse a resource that can never resolve to anything downloadable,
    // rather than publishing a dead tile into every partner's library.
    if (args.kind === "file" && !args.storageId) {
      throw new Error("A file resource needs an uploaded file.");
    }
    if (args.kind === "link" && !args.externalUrl?.trim()) {
      throw new Error("A link resource needs a URL.");
    }
    if (args.audience === "partner_types" && !(args.partnerTypes ?? []).length) {
      throw new Error("Select at least one partner type, or set the audience to everyone.");
    }
    if (args.audience === "specific" && !(args.partnerIds ?? []).length) {
      throw new Error("Select at least one partner, or set the audience to everyone.");
    }

    const now = Date.now();
    const status = args.status ?? "draft";

    // Superseding carries the version forward so "v3" means something.
    let version = 1;
    if (args.supersedesId) {
      const prior = await ctx.db.get(args.supersedesId);
      if (prior) {
        version = (prior.version ?? 1) + 1;
        // The old one stops being offered but keeps its download history.
        await ctx.db.patch(prior._id, { status: "archived", updatedAt: now });
      }
    }

    return await ctx.db.insert("partnerResources", {
      title: args.title.trim(),
      description: args.description?.trim() || undefined,
      category: args.category,
      kind: args.kind,
      storageId: args.storageId,
      fileName: args.fileName,
      contentType: args.contentType,
      fileSizeBytes: args.fileSizeBytes,
      externalUrl: args.externalUrl?.trim(),
      audience: args.audience,
      partnerTypes: args.partnerTypes,
      partnerIds: args.partnerIds,
      siteIds: args.siteIds,
      status,
      featured: args.featured,
      sortOrder: args.sortOrder,
      version,
      supersedesId: args.supersedesId,
      downloadCount: 0,
      createdAt: now,
      updatedAt: now,
      createdBy: identity.clerkUserId,
      publishedAt: status === "published" ? now : undefined,
    });
  },
});

export const updateResource = mutation({
  args: {
    resourceId: v.id("partnerResources"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(categoryValidator),
    audience: v.optional(audienceValidator),
    partnerTypes: v.optional(v.array(partnerTypeValidator)),
    partnerIds: v.optional(v.array(v.string())),
    siteIds: v.optional(v.array(v.id("sites"))),
    featured: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
    externalUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaffAdmin(ctx);
    const { resourceId, ...rest } = args;
    const existing = await ctx.db.get(resourceId);
    if (!existing) throw new Error("Resource not found");

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(rest)) {
      if (value !== undefined) patch[key] = value;
    }
    await ctx.db.patch(resourceId, patch);
    return await ctx.db.get(resourceId);
  },
});

/**
 * Publish, unpublish, or archive.
 *
 * Archiving rather than deleting: the download log references the resource,
 * and "who took the superseded compliance notice" must stay answerable.
 */
export const setStatus = mutation({
  args: {
    resourceId: v.id("partnerResources"),
    status: v.union(
      v.literal("draft"),
      v.literal("published"),
      v.literal("archived"),
    ),
  },
  handler: async (ctx, args) => {
    await requireStaffAdmin(ctx);
    const existing = await ctx.db.get(args.resourceId);
    if (!existing) throw new Error("Resource not found");

    await ctx.db.patch(args.resourceId, {
      status: args.status,
      updatedAt: Date.now(),
      publishedAt:
        args.status === "published"
          ? existing.publishedAt ?? Date.now()
          : existing.publishedAt,
    });
    return { status: args.status };
  },
});

/** A staff-side URL for previewing a resource before publishing it. */
export const getAdminDownloadUrl = mutation({
  args: { resourceId: v.id("partnerResources") },
  handler: async (ctx, args) => {
    await requireStaffAdmin(ctx);
    const resource = await ctx.db.get(args.resourceId);
    if (!resource) return null;
    if (resource.kind === "link") {
      return { url: resource.externalUrl ?? null, fileName: resource.title };
    }
    if (!resource.storageId) return null;
    return {
      url: await ctx.storage.getUrl(resource.storageId),
      fileName: resource.fileName ?? resource.title,
    };
  },
});

/** Recent downloads, and the most-used resources. */
export const getDownloadActivity = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireStaffAdmin(ctx);
    const limit = Math.min(args.limit ?? 50, 200);

    const recent = await ctx.db
      .query("partnerResourceDownloads")
      .withIndex("by_downloaded")
      .order("desc")
      .take(limit);

    const resources = await ctx.db.query("partnerResources").collect();
    const topResources = resources
      .filter((r) => (r.downloadCount ?? 0) > 0)
      .sort((a, b) => (b.downloadCount ?? 0) - (a.downloadCount ?? 0))
      .slice(0, 10)
      .map((r: Doc<"partnerResources">) => ({
        _id: r._id,
        title: r.title,
        category: r.category,
        downloadCount: r.downloadCount ?? 0,
        lastDownloadedAt: r.lastDownloadedAt,
      }));

    return {
      recent: recent.map((d) => ({
        _id: d._id,
        resourceTitle: d.resourceTitle,
        partnerName: d.partnerName ?? "(internal)",
        viewerKind: d.viewerKind,
        downloadedAt: d.downloadedAt,
      })),
      topResources,
      /** Resources nobody has taken — usually a visibility mistake. */
      neverDownloaded: resources
        .filter((r) => r.status === "published" && (r.downloadCount ?? 0) === 0)
        .map((r) => ({ _id: r._id, title: r.title, category: r.category })),
    };
  },
});
