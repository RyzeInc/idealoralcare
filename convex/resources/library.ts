/**
 * PARTNER RESOURCE LIBRARY — the partner-facing read side.
 *
 * Marketing collateral, the partner kit, training and forms that agencies and
 * reps download from /partner/resources.
 *
 * The security shape to understand here: a Convex storage URL is a bearer
 * token. Anyone holding it can fetch the file, with no further auth. So the
 * URL is minted ONLY inside `getDownloadUrl`, after the same visibility rules
 * that filtered the list are re-checked for that specific resource. Listing
 * and downloading are separately authorized — a resource id obtained some
 * other way still cannot be downloaded.
 *
 * White-label is the substantive rule. `distributionPartners` carries no
 * `siteId`, so a partner's brands are derived from the sites their own book
 * touches. A resource restricted to site X is visible only to viewers with
 * members on site X — which is what stops a Flourish XV agency being handed
 * Ideal-branded material.
 */

import { v } from "convex/values";
import { mutation, query, QueryCtx } from "../_generated/server";
import { Doc } from "../_generated/dataModel";
import {
  resolveViewerScope,
  scopeLabel,
  isAdminScope,
  ViewerScope,
} from "../insights/scope";
import { loadScopedMembers } from "../insights/book";

/* ------------------------------------------------------------------ */
/* Visibility                                                         */
/* ------------------------------------------------------------------ */

/**
 * The sites a viewer's book actually touches.
 *
 * Computed lazily — most resources are brand-agnostic, so the member read is
 * skipped entirely unless at least one candidate resource is site-restricted.
 * Admins get null, meaning "no restriction".
 */
async function resolveViewerSiteIds(
  ctx: QueryCtx,
  scope: ViewerScope,
): Promise<Set<string> | null> {
  if (isAdminScope(scope)) return null;
  const { members } = await loadScopedMembers(ctx, scope);
  return new Set(members.map((m) => String(m.siteId)));
}

/** The partner row a viewer belongs to, for audience matching. */
async function resolveViewerPartner(
  ctx: QueryCtx,
  scope: ViewerScope,
): Promise<Doc<"distributionPartners"> | null> {
  if (isAdminScope(scope)) return null;
  return await ctx.db.get(scope.partnerId).catch(() => null);
}

interface VisibilityContext {
  scope: ViewerScope;
  partner: Doc<"distributionPartners"> | null;
  /** null = unrestricted (admin). */
  siteIds: Set<string> | null;
}

/**
 * Whether one resource is visible to one viewer.
 *
 * Both gates must pass: the audience rule (who it is for) and the brand rule
 * (which white-label it belongs to). Admins bypass both — they curate the
 * library and must be able to see drafts and everything else.
 */
export function isResourceVisible(
  resource: Doc<"partnerResources">,
  vctx: VisibilityContext,
): boolean {
  if (isAdminScope(vctx.scope)) return true;
  if (resource.status !== "published") return false;

  // Brand gate. Absent or empty means every brand.
  if (resource.siteIds && resource.siteIds.length > 0) {
    if (!vctx.siteIds) return false;
    const overlap = resource.siteIds.some((s) => vctx.siteIds!.has(String(s)));
    if (!overlap) return false;
  }

  // Audience gate.
  switch (resource.audience) {
    case "all":
      return true;
    case "partner_types": {
      const type = vctx.partner?.type;
      return !!type && (resource.partnerTypes ?? []).includes(type);
    }
    case "specific": {
      // Admin returned early above, so the scope is partner or rep here — both
      // carry a partnerId. A rep inherits their agency's grant; the material is
      // issued to the firm, not the individual.
      const allowed = resource.partnerIds ?? [];
      return allowed.includes(String(vctx.scope.partnerId));
    }
  }
}

/** Build the visibility context once per request. */
async function buildVisibilityContext(
  ctx: QueryCtx,
  scope: ViewerScope,
  resources: Doc<"partnerResources">[],
): Promise<VisibilityContext> {
  const anySiteRestricted = resources.some(
    (r) => r.siteIds && r.siteIds.length > 0,
  );
  return {
    scope,
    partner: await resolveViewerPartner(ctx, scope),
    siteIds: anySiteRestricted ? await resolveViewerSiteIds(ctx, scope) : null,
  };
}

/* ------------------------------------------------------------------ */
/* Queries                                                            */
/* ------------------------------------------------------------------ */

/**
 * The categories an admin may file a resource under, in display order.
 *
 * This array is the single source for the admin picker and the partner filter
 * rail. Retired categories (see the schema note on `partnerResources.category`)
 * are deliberately absent: nothing new can be filed under them, but rows that
 * already carry one still list and still label correctly via CATEGORY_LABEL.
 */
export const ACTIVE_CATEGORIES = [
  "partner_kit",
  "partner_pieces",
  "other",
] as const;

export type ActiveCategory = (typeof ACTIVE_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<string, string> = {
  partner_kit: "Partner Kit",
  partner_pieces: "Partner Pieces",
  other: "Other",
  // Retired — kept so legacy rows render with a name rather than a raw key.
  marketing: "Marketing",
  collateral: "Plan Collateral",
  training: "Training",
  compliance: "Compliance",
  forms: "Forms & Templates",
};

/** Sort key placing active categories in display order, retired ones last. */
function categoryRank(category: string): number {
  const i = (ACTIVE_CATEGORIES as readonly string[]).indexOf(category);
  return i === -1 ? ACTIVE_CATEGORIES.length : i;
}

/**
 * Everything the signed-in viewer may see, grouped for display.
 *
 * Deliberately does NOT return storage URLs — see the module note. The list is
 * metadata only; a URL is minted per download.
 */
export const listForViewer = query({
  args: {
    category: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const scope = await resolveViewerScope(ctx);

    const all = await ctx.db
      .query("partnerResources")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .collect();

    const vctx = await buildVisibilityContext(ctx, scope, all);
    let visible = all.filter((r) => isResourceVisible(r, vctx));

    if (args.category) {
      visible = visible.filter((r) => r.category === args.category);
    }
    if (args.search && args.search.trim()) {
      const needle = args.search.trim().toLowerCase();
      visible = visible.filter((r) =>
        [r.title, r.description, r.fileName]
          .filter(Boolean)
          .some((f) => String(f).toLowerCase().includes(needle)),
      );
    }

    visible.sort(
      (a, b) =>
        (a.sortOrder ?? 500) - (b.sortOrder ?? 500) ||
        a.title.localeCompare(b.title),
    );

    const toView = (r: Doc<"partnerResources">) => ({
      _id: r._id,
      title: r.title,
      description: r.description,
      category: r.category,
      categoryLabel: CATEGORY_LABEL[r.category] ?? r.category,
      kind: r.kind,
      fileName: r.fileName,
      contentType: r.contentType,
      fileSizeBytes: r.fileSizeBytes,
      // Safe to expose: it is already a public destination.
      externalUrl: r.kind === "link" ? r.externalUrl : undefined,
      featured: r.featured === true,
      version: r.version,
      updatedAt: r.updatedAt,
    });

    const byCategory = new Map<string, ReturnType<typeof toView>[]>();
    for (const r of visible) {
      const list = byCategory.get(r.category) ?? [];
      list.push(toView(r));
      byCategory.set(r.category, list);
    }

    return {
      scope: { kind: scope.kind, label: scopeLabel(scope) },
      total: visible.length,
      featured: visible.filter((r) => r.featured).map(toView),
      categories: [...byCategory]
        .map(([category, items]) => ({
          category,
          label: CATEGORY_LABEL[category] ?? category,
          items,
        }))
        .sort((a, b) => categoryRank(a.category) - categoryRank(b.category)),
    };
  },
});

/**
 * Mint a download URL for one resource, and record the download.
 *
 * A mutation rather than a query because it writes the audit row — and because
 * a storage URL is a credential, so it should be an explicit action rather
 * than something a page fetches speculatively for every row.
 *
 * Re-checks visibility for this specific resource. Passing an id obtained
 * elsewhere gets the same null a nonexistent id does: whether a resource
 * exists is itself not something a partner should be able to probe.
 */
export const getDownloadUrl = mutation({
  args: { resourceId: v.id("partnerResources") },
  handler: async (ctx, args) => {
    const scope = await resolveViewerScope(ctx);
    const resource = await ctx.db.get(args.resourceId);
    if (!resource) return null;

    const vctx = await buildVisibilityContext(ctx, scope, [resource]);
    if (!isResourceVisible(resource, vctx)) return null;

    const url =
      resource.kind === "link"
        ? resource.externalUrl ?? null
        : resource.storageId
          ? await ctx.storage.getUrl(resource.storageId)
          : null;
    if (!url) return null;

    const now = Date.now();
    await ctx.db.patch(resource._id, {
      downloadCount: (resource.downloadCount ?? 0) + 1,
      lastDownloadedAt: now,
    });

    await ctx.db.insert("partnerResourceDownloads", {
      resourceId: resource._id,
      resourceTitle: resource.title,
      clerkUserId: scope.clerkUserId,
      partnerId: scope.kind === "admin" ? undefined : String(scope.partnerId),
      partnerName: vctx.partner?.name,
      leaderId: scope.kind === "rep" ? String(scope.leaderId) : undefined,
      viewerKind: scope.kind,
      downloadedAt: now,
    });

    return { url, fileName: resource.fileName ?? resource.title, kind: resource.kind };
  },
});

/** Category counts for the viewer, used to build the filter rail. */
export const getCategoryCounts = query({
  args: {},
  handler: async (ctx) => {
    const scope = await resolveViewerScope(ctx);
    const all = await ctx.db
      .query("partnerResources")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .collect();
    const vctx = await buildVisibilityContext(ctx, scope, all);

    const counts = new Map<string, number>();
    for (const r of all) {
      if (!isResourceVisible(r, vctx)) continue;
      counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
    }

    return [...counts]
      .map(([category, count]) => ({
        category,
        label: CATEGORY_LABEL[category] ?? category,
        count,
      }))
      .sort(
        (a, b) =>
          categoryRank(a.category) - categoryRank(b.category) ||
          a.label.localeCompare(b.label),
      );
  },
});
