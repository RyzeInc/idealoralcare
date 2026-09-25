/**
 * SHOP ADMIN
 *
 * Category and product CRUD for the preventative care shop. Every mutation
 * requires admin and writes an audit entry — an affiliate link is a commercial
 * arrangement and a compliance surface, so who pointed a product where needs to
 * be answerable later.
 *
 * Rules these enforce: docs/internal/SHOP_DESIGN.md
 */

import { mutation, query } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "../lib/authGuards";
import { recordAdminAction } from "../admin/adminAudit";
import { shopNetworkValidator } from "./constants";
import { resolveShopEnabled } from "./queries";

/**
 * Out-of-scope merchants: they sell savings plans and lab services, not goods.
 *
 * The shop is for physical products someone uses at home. These programs pay
 * well (dental plan programs run ~30%) but they sell against `catalogProducts`,
 * and one of them we already buy fulfillment from — so a commission here costs
 * a plan sale. A scope guard, not a judgment about the merchants.
 * SHOP_DESIGN.md rule 4.
 */
const COMPETING_DOMAINS = [
  "careington.com",
  "dentalplans.com",
  "letsgetchecked.com",
  "lifelinescreening.com",
  "dentalplans.co",
];

/**
 * Claim words that turn a cosmetic or device into an unapproved drug claim.
 * SHOP_DESIGN.md rule 2. A guard, not a substitute for review — it catches the
 * obvious cases so they don't reach a shopper.
 */
const DISEASE_CLAIM_PATTERNS = [
  /\bcures?\b/i,
  /\btreats?\b/i,
  /\bprevents?\b/i,
  /\breverses?\b/i,
  /\bheals?\b/i,
  /\bdiagnos(e|es|is)\b/i,
  /\bgingivitis\b/i,
  /\bperiodontal\b/i,
  /\bperiodontitis\b/i,
  /\bcavit(y|ies)\b/i,
  /\bdisease\b/i,
  /\bFDA[- ]approved\b/i,
];

function assertNoDiseaseClaims(fields: Record<string, string | undefined>) {
  for (const [field, value] of Object.entries(fields)) {
    if (!value) continue;
    for (const pattern of DISEASE_CLAIM_PATTERNS) {
      if (pattern.test(value)) {
        throw new Error(
          `Copy in "${field}" contains a possible health claim (${pattern.source}). ` +
            `Shop copy must describe what a product is, not what it treats or prevents. ` +
            `See docs/internal/SHOP_DESIGN.md rule 2.`,
        );
      }
    }
  }
}

function assertUsableAffiliateUrl(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Affiliate URL must be an absolute URL.");
  }
  if (url.protocol !== "https:") {
    throw new Error("Affiliate URL must use https.");
  }
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (COMPETING_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))) {
    throw new Error(
      `${host} sells against our own plan catalog and cannot be carried in the shop. ` +
        `See docs/internal/SHOP_DESIGN.md rule 4.`,
    );
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ============================================
// STOREFRONT SWITCH
// ============================================

/**
 * The kill switch as an admin sees it: state plus who last flipped it.
 *
 * Reads the row directly rather than calling the public `isEnabled` query,
 * because the admin needs `updatedAt`/`updatedBy` — "is the shop up" and "who
 * took it down and when" are different questions.
 */
export const getSettings = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const settings = await ctx.db
      .query("shopSettings")
      .withIndex("by_key", (q) => q.eq("key", "main"))
      .first();
    return {
      isEnabled: resolveShopEnabled(settings),
      updatedAt: settings?.updatedAt ?? null,
      updatedBy: settings?.updatedBy ?? null,
    };
  },
});

/**
 * Turn the whole storefront on or off.
 *
 * Nothing is deleted or unpublished: categories and products keep their own
 * `isVisible` state and come back exactly as they were. Audited like every
 * other shop mutation — taking a commercial surface down is a decision someone
 * should be answerable for later.
 */
export const setEnabled = mutation({
  args: { isEnabled: v.boolean() },
  handler: async (ctx, args) => {
    const identity = await requireAdmin(ctx);

    const existing = await ctx.db
      .query("shopSettings")
      .withIndex("by_key", (q) => q.eq("key", "main"))
      .first();
    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        isEnabled: args.isEnabled,
        updatedAt: now,
        updatedBy: identity.clerkUserId,
      });
    } else {
      await ctx.db.insert("shopSettings", {
        key: "main",
        isEnabled: args.isEnabled,
        updatedAt: now,
        updatedBy: identity.clerkUserId,
      });
    }

    await recordAdminAction(ctx, identity, {
      action: args.isEnabled ? "shop.storefront.enable" : "shop.storefront.disable",
      targetType: "shopSettings",
      targetId: "main",
      summary: args.isEnabled
        ? "Turned the preventative care shop on"
        : "Turned the preventative care shop off",
    });
    return args.isEnabled;
  },
});

// ============================================
// READS (admin — includes the internal economics the public queries strip)
// ============================================

export const listCategories = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return (await ctx.db.query("shopCategories").withIndex("by_order").collect())
      .sort((a, b) => a.order - b.order);
  },
});

export const listProducts = query({
  args: { categoryId: v.optional(v.id("shopCategories")) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const products = args.categoryId
      ? await ctx.db
          .query("shopProducts")
          .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId!))
          .collect()
      : await ctx.db.query("shopProducts").withIndex("by_order").collect();
    return products.sort((a, b) => a.order - b.order);
  },
});

// ============================================
// CATEGORIES
// ============================================

export const createCategory = mutation({
  args: {
    name: v.string(),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    order: v.optional(v.number()),
    isVisible: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAdmin(ctx);
    assertNoDiseaseClaims({
      name: args.name,
      description: args.description,
    });

    const slug = slugify(args.slug ?? args.name);
    if (!slug) throw new Error("Category needs a name that yields a slug.");

    const clash = await ctx.db
      .query("shopCategories")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (clash) throw new Error(`A shop category with slug "${slug}" already exists.`);

    const now = Date.now();
    const categoryId = await ctx.db.insert("shopCategories", {
      name: args.name,
      slug,
      description: args.description,
      icon: args.icon,
      order: args.order ?? (await nextCategoryOrder(ctx)),
      isVisible: args.isVisible ?? false, // Off until someone looks at it
      createdAt: now,
      updatedAt: now,
    });

    await recordAdminAction(ctx, identity, {
      action: "shop.category.create",
      targetType: "shopCategories",
      targetId: categoryId,
      summary: `Created shop category "${args.name}"`,
    });
    return categoryId;
  },
});

export const updateCategory = mutation({
  args: {
    categoryId: v.id("shopCategories"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    order: v.optional(v.number()),
    isVisible: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAdmin(ctx);
    const { categoryId, ...patch } = args;

    const category = await ctx.db.get(categoryId);
    if (!category) throw new Error("Shop category not found.");

    assertNoDiseaseClaims({
      name: patch.name,
      description: patch.description,
    });

    await ctx.db.patch(categoryId, { ...definedOnly(patch), updatedAt: Date.now() });
    await recordAdminAction(ctx, identity, {
      action: "shop.category.update",
      targetType: "shopCategories",
      targetId: categoryId,
      summary: `Updated shop category "${category.name}"`,
      metadata: definedOnly(patch),
    });
    return null;
  },
});

export const deleteCategory = mutation({
  args: { categoryId: v.id("shopCategories") },
  handler: async (ctx, args) => {
    const identity = await requireAdmin(ctx);
    const category = await ctx.db.get(args.categoryId);
    if (!category) throw new Error("Shop category not found.");

    // Refuse rather than orphan. `shopProducts.categoryId` is required, so a
    // cascade would mean silently deleting products an admin didn't name.
    const products = await ctx.db
      .query("shopProducts")
      .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
      .collect();
    if (products.length > 0) {
      throw new Error(
        `"${category.name}" still holds ${products.length} product(s). ` +
          `Move or delete them first.`,
      );
    }

    await ctx.db.delete(args.categoryId);
    await recordAdminAction(ctx, identity, {
      action: "shop.category.delete",
      targetType: "shopCategories",
      targetId: args.categoryId,
      summary: `Deleted shop category "${category.name}"`,
    });
    return null;
  },
});

// ============================================
// PRODUCTS
// ============================================

export const createProduct = mutation({
  args: {
    categoryId: v.id("shopCategories"),
    name: v.string(),
    slug: v.optional(v.string()),
    brand: v.string(),
    shortDescription: v.string(),
    description: v.optional(v.string()),
    highlights: v.optional(v.array(v.string())),
    imageUrl: v.optional(v.string()),
    affiliateUrl: v.string(),
    merchant: v.string(),
    network: shopNetworkValidator,
    commissionRate: v.optional(v.number()),
    cookieWindowDays: v.optional(v.number()),
    priceCents: v.optional(v.number()),
    order: v.optional(v.number()),
    isVisible: v.optional(v.boolean()),
    isFeatured: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAdmin(ctx);

    const category = await ctx.db.get(args.categoryId);
    if (!category) throw new Error("Shop category not found.");

    assertUsableAffiliateUrl(args.affiliateUrl);
    assertNoDiseaseClaims({
      name: args.name,
      shortDescription: args.shortDescription,
      description: args.description,
      ...Object.fromEntries(
        (args.highlights ?? []).map((h, i) => [`highlights[${i}]`, h]),
      ),
    });

    const slug = slugify(args.slug ?? `${args.brand}-${args.name}`);
    if (!slug) throw new Error("Product needs a name that yields a slug.");

    const clash = await ctx.db
      .query("shopProducts")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (clash) throw new Error(`A shop product with slug "${slug}" already exists.`);

    const now = Date.now();
    const productId = await ctx.db.insert("shopProducts", {
      categoryId: args.categoryId,
      name: args.name,
      slug,
      brand: args.brand,
      shortDescription: args.shortDescription,
      description: args.description,
      highlights: args.highlights,
      imageUrl: args.imageUrl,
      affiliateUrl: args.affiliateUrl,
      merchant: args.merchant,
      network: args.network,
      commissionRate: args.commissionRate,
      cookieWindowDays: args.cookieWindowDays,
      priceCents: args.priceCents,
      // Stamped together: a price with no capture time can't be qualified
      // honestly on the card.
      priceCapturedAt: args.priceCents === undefined ? undefined : now,
      order: args.order ?? (await nextProductOrder(ctx)),
      isVisible: args.isVisible ?? false, // Off until reviewed
      isFeatured: args.isFeatured ?? false,
      clickCount: 0,
      createdAt: now,
      updatedAt: now,
      createdBy: identity.clerkUserId,
      updatedBy: identity.clerkUserId,
    });

    await recordAdminAction(ctx, identity, {
      action: "shop.product.create",
      targetType: "shopProducts",
      targetId: productId,
      summary: `Created shop product "${args.brand} ${args.name}" (${args.network})`,
      metadata: { affiliateUrl: args.affiliateUrl, merchant: args.merchant },
    });
    return productId;
  },
});

export const updateProduct = mutation({
  args: {
    productId: v.id("shopProducts"),
    categoryId: v.optional(v.id("shopCategories")),
    name: v.optional(v.string()),
    brand: v.optional(v.string()),
    shortDescription: v.optional(v.string()),
    description: v.optional(v.string()),
    highlights: v.optional(v.array(v.string())),
    imageUrl: v.optional(v.string()),
    affiliateUrl: v.optional(v.string()),
    merchant: v.optional(v.string()),
    network: v.optional(shopNetworkValidator),
    commissionRate: v.optional(v.number()),
    cookieWindowDays: v.optional(v.number()),
    priceCents: v.optional(v.number()),
    order: v.optional(v.number()),
    isVisible: v.optional(v.boolean()),
    isFeatured: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAdmin(ctx);
    const { productId, ...patch } = args;

    const product = await ctx.db.get(productId);
    if (!product) throw new Error("Shop product not found.");

    if (patch.categoryId) {
      const category = await ctx.db.get(patch.categoryId);
      if (!category) throw new Error("Shop category not found.");
    }
    if (patch.affiliateUrl) assertUsableAffiliateUrl(patch.affiliateUrl);
    assertNoDiseaseClaims({
      name: patch.name,
      shortDescription: patch.shortDescription,
      description: patch.description,
      ...Object.fromEntries(
        (patch.highlights ?? []).map((h, i) => [`highlights[${i}]`, h]),
      ),
    });

    const fields = definedOnly(patch);
    // Re-stamp the capture time whenever the price is touched, so the "as of"
    // on the card always describes the number next to it.
    if (patch.priceCents !== undefined) {
      (fields as Record<string, unknown>).priceCapturedAt = Date.now();
    }

    await ctx.db.patch(productId, {
      ...fields,
      updatedAt: Date.now(),
      updatedBy: identity.clerkUserId,
    });

    await recordAdminAction(ctx, identity, {
      action: "shop.product.update",
      targetType: "shopProducts",
      targetId: productId,
      summary: `Updated shop product "${product.brand} ${product.name}"`,
      metadata: fields,
    });
    return null;
  },
});

export const deleteProduct = mutation({
  args: { productId: v.id("shopProducts") },
  handler: async (ctx, args) => {
    const identity = await requireAdmin(ctx);
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Shop product not found.");

    // `shopClicks` rows are left in place on purpose — they're an append-only
    // log and they carry `productSlug` so they stay readable without the row.
    await ctx.db.delete(args.productId);
    await recordAdminAction(ctx, identity, {
      action: "shop.product.delete",
      targetType: "shopProducts",
      targetId: args.productId,
      summary: `Deleted shop product "${product.brand} ${product.name}"`,
    });
    return null;
  },
});

// ============================================
// HELPERS
// ============================================

// The compliance guards are the load-bearing part of this module, so they're
// reachable from tests without standing up a Convex context.
export const __testOnly_assertNoDiseaseClaims = assertNoDiseaseClaims;
export const __testOnly_assertUsableAffiliateUrl = assertUsableAffiliateUrl;
export const __testOnly_slugify = slugify;

/** Drop undefined keys so a patch never clears a field the caller omitted. */
function definedOnly<T extends Record<string, unknown>>(patch: T) {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

/** Append to the end of the editorial order rather than colliding at 0. */
async function nextCategoryOrder(ctx: MutationCtx) {
  const rows = await ctx.db.query("shopCategories").collect();
  return rows.length === 0 ? 0 : Math.max(...rows.map((r) => r.order)) + 1;
}

async function nextProductOrder(ctx: MutationCtx) {
  const rows = await ctx.db.query("shopProducts").collect();
  return rows.length === 0 ? 0 : Math.max(...rows.map((r) => r.order)) + 1;
}
