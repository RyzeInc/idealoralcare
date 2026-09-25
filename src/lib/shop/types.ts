import type { Doc } from "@/convex/_generated/dataModel";
import type { PublicShopProduct } from "@/convex/shop/queries";

/**
 * The public shape of a shop product — exactly what `convex/shop/queries.ts`
 * returns after `stripSensitive`. Aliased rather than re-derived so the two
 * can't drift: commission rate and cookie window are our terms with the
 * network and must never reach the browser.
 */
export type ShopCardProduct = PublicShopProduct;

export type ShopCategory = Doc<"shopCategories">;

/** A category paired with its visible products, as `listStorefront` returns. */
export interface ShopStorefrontSection {
  category: ShopCategory;
  products: ShopCardProduct[];
}

/**
 * Render a captured price as an approximation.
 *
 * We don't control merchant pricing and we don't re-scrape it, so a bare
 * "$29.99" would be a claim we can't stand behind. Every price is qualified as
 * approximate and stamped with when we looked.
 */
export function formatCapturedPrice(
  priceCents: number | undefined,
  capturedAt: number | undefined,
): string | null {
  if (priceCents === undefined) return null;

  const amount = (priceCents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });

  if (!capturedAt) return `About ${amount} at the merchant`;

  const when = new Date(capturedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `About ${amount} — price checked ${when}. Merchant's price at checkout applies.`;
}
