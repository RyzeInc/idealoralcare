/**
 * SHOP CLICK TRACKING
 *
 * Records outbound affiliate clicks. Affiliate networks report conversions but
 * never our own funnel, so this is the only attribution data we own.
 *
 * This is the one shop write an unauthenticated visitor can trigger, so it is
 * deliberately narrow: it accepts a product id and nothing that isn't derived
 * from a row we already trust. `network` and `productSlug` are read from the
 * product rather than taken from the caller, so a forged request can inflate a
 * counter but cannot write arbitrary data or attribute a click to the wrong
 * network.
 */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin, getAuthenticatedUserId } from "../lib/authGuards";

/** Cap on stored referrer path length — a defensive bound, not a real limit. */
const MAX_REFERRER_LENGTH = 512;

/**
 * Record an outbound click. Fire-and-forget from the browser via sendBeacon;
 * never blocks navigation, and a failure costs a data point, not a sale.
 */
export const record = mutation({
  args: {
    productId: v.id("shopProducts"),
    siteSlug: v.optional(v.string()),
    referrerPath: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    // Silent no-op rather than a throw: this is a beacon, nobody reads the
    // error, and a hidden or deleted product isn't an exceptional case.
    if (!product || !product.isVisible) return null;

    // Recorded only when a member happens to be logged in, for funnel
    // analysis. Never read back to personalize what a member is shown
    // (SHOP_DESIGN.md rule 3).
    const clerkUserId = await getAuthenticatedUserId(ctx);

    await ctx.db.insert("shopClicks", {
      productId: product._id,
      productSlug: product.slug,
      siteSlug: args.siteSlug,
      network: product.network,
      clerkUserId: clerkUserId ?? undefined,
      referrerPath: args.referrerPath?.slice(0, MAX_REFERRER_LENGTH),
      createdAt: Date.now(),
    });

    await ctx.db.patch(product._id, {
      clickCount: product.clickCount + 1,
      lastClickedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Click totals for the admin dashboard, bucketed by product over a window.
 * Reads the append-only log rather than the denormalized counter so the
 * numbers are windowed rather than all-time.
 */
export const statsByProduct = query({
  args: { sinceMs: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const since = args.sinceMs ?? 0;
    const clicks = await ctx.db
      .query("shopClicks")
      .withIndex("by_created", (q) => q.gte("createdAt", since))
      .collect();

    const byProduct = new Map<
      string,
      { productId: string; productSlug: string; clicks: number }
    >();
    for (const click of clicks) {
      const existing = byProduct.get(click.productId);
      if (existing) {
        existing.clicks += 1;
      } else {
        byProduct.set(click.productId, {
          productId: click.productId,
          productSlug: click.productSlug,
          clicks: 1,
        });
      }
    }

    return {
      totalClicks: clicks.length,
      products: [...byProduct.values()].sort((a, b) => b.clicks - a.clicks),
    };
  },
});
