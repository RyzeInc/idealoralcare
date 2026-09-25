/**
 * SHOP QUERIES
 *
 * Public reads for the preventative care shop. No auth — the shop is
 * deliberately identical for members and non-members (SHOP_DESIGN.md rule 1),
 * so there is nothing here to gate.
 *
 * Note what these never return: `commissionRate` and `cookieWindowDays` are our
 * terms with the network, not the shopper's business. `stripSensitive` drops
 * them so they can't leak into a page payload.
 *
 * Every read here is behind the storefront kill switch. Gating at the query and
 * not only at the route is the point: with the switch off there is no URL, no
 * stale cache, and no client call that yields a product.
 */

import { query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";

// ============================================
// MASTER SWITCH
// ============================================

/**
 * Resolve the storefront kill switch from its settings row.
 *
 * **A missing row means on.** The shop was live before this switch existed, so
 * the state every deployment starts in has to be the state it was already in —
 * a default of `false` would take down a running storefront the moment this
 * shipped. Only an admin explicitly turning it off writes `false`.
 *
 * Note this is the opposite default from `sites.shopEnabled` (rule 6), which is
 * opt-in because a partner site never had a shop to lose. Different questions:
 * "may this brand carry retail at all" vs "is our own storefront up right now".
 */
export function resolveShopEnabled(settings: Doc<"shopSettings"> | null) {
  return settings?.isEnabled !== false;
}

/** Read the kill switch. Every public shop read goes through this. */
export async function readShopEnabled(ctx: QueryCtx) {
  const settings = await ctx.db
    .query("shopSettings")
    .withIndex("by_key", (q) => q.eq("key", "main"))
    .first();
  return resolveShopEnabled(settings);
}

/**
 * Whether the storefront is on. Public: the header uses it to decide whether to
 * render a Shop link at all, so it can't require auth.
 */
export const isEnabled = query({
  args: {},
  handler: async (ctx) => await readShopEnabled(ctx),
});

/**
 * Public shape of a shop product.
 *
 * Deliberately an allow-list rather than an omit-list: a field added to the
 * table later is invisible to the browser until someone adds it here on
 * purpose. The reverse default would leak new internal fields silently.
 */
function stripSensitive(product: Doc<"shopProducts">) {
  return {
    _id: product._id,
    _creationTime: product._creationTime,
    categoryId: product.categoryId,
    name: product.name,
    slug: product.slug,
    brand: product.brand,
    shortDescription: product.shortDescription,
    description: product.description,
    highlights: product.highlights,
    imageUrl: product.imageUrl,
    imageStorageId: product.imageStorageId,
    affiliateUrl: product.affiliateUrl,
    merchant: product.merchant,
    network: product.network,
    priceCents: product.priceCents,
    priceCapturedAt: product.priceCapturedAt,
    order: product.order,
    isVisible: product.isVisible,
    isFeatured: product.isFeatured,
  };
}

export type PublicShopProduct = ReturnType<typeof stripSensitive>;

/** Visible categories, in editorial order. */
export const listCategories = query({
  args: {},
  handler: async (ctx) => {
    if (!(await readShopEnabled(ctx))) return [];
    const categories = await ctx.db
      .query("shopCategories")
      .withIndex("by_visible", (q) => q.eq("isVisible", true))
      .collect();
    return categories.sort((a, b) => a.order - b.order);
  },
});

/**
 * Visible products, optionally narrowed to one category slug or to featured.
 *
 * Ranking is editorial order only — never derived from member health data
 * (SHOP_DESIGN.md rule 3).
 */
export const listProducts = query({
  args: {
    categorySlug: v.optional(v.string()),
    featured: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (!(await readShopEnabled(ctx))) return [];

    let categoryId = null;
    if (args.categorySlug) {
      const category = await ctx.db
        .query("shopCategories")
        .withIndex("by_slug", (q) => q.eq("slug", args.categorySlug!))
        .first();
      // An unknown or hidden category yields nothing rather than everything.
      if (!category || !category.isVisible) return [];
      categoryId = category._id;
    }

    const products = await ctx.db
      .query("shopProducts")
      .withIndex("by_visible", (q) => q.eq("isVisible", true))
      .collect();

    let filtered = products;
    if (categoryId) {
      filtered = filtered.filter((p) => p.categoryId === categoryId);
    }
    if (args.featured) {
      filtered = filtered.filter((p) => p.isFeatured);
    }

    return filtered
      .sort((a, b) => a.order - b.order)
      .map(stripSensitive);
  },
});

/** One product by slug, for a detail view. Hidden products read as missing. */
export const getProductBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    if (!(await readShopEnabled(ctx))) return null;

    const product = await ctx.db
      .query("shopProducts")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (!product || !product.isVisible) return null;
    return stripSensitive(product);
  },
});

/**
 * The whole shop in one round trip: visible categories each with their visible
 * products. The grid page needs exactly this, and one query beats N+1.
 */
export const listStorefront = query({
  args: {},
  handler: async (ctx) => {
    if (!(await readShopEnabled(ctx))) return [];

    const categories = (
      await ctx.db
        .query("shopCategories")
        .withIndex("by_visible", (q) => q.eq("isVisible", true))
        .collect()
    ).sort((a, b) => a.order - b.order);

    const products = (
      await ctx.db
        .query("shopProducts")
        .withIndex("by_visible", (q) => q.eq("isVisible", true))
        .collect()
    ).sort((a, b) => a.order - b.order);

    return categories.map((category) => ({
      category,
      products: products
        .filter((p) => p.categoryId === category._id)
        .map(stripSensitive),
    }));
  },
});

/**
 * Whether the shop is turned on for a given site slug.
 *
 * Opt-in: an unknown site, or one without `shopEnabled`, is off. The primary
 * `/health` route does not consult this — it has its own gate in the route.
 *
 * The master switch wins over a partner's opt-in. It is a kill switch; a tenant
 * storefront left standing while ours is down would defeat the whole point.
 */
export const isEnabledForSite = query({
  args: { siteSlug: v.string() },
  handler: async (ctx, args) => {
    if (!(await readShopEnabled(ctx))) return false;

    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", args.siteSlug))
      .first();
    return site?.shopEnabled === true;
  },
});
