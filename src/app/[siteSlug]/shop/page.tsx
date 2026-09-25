import { notFound } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import ShopClient from "@/app/health/shop/ShopClient";

/**
 * Tenant shop.
 *
 * Unlike the other `[siteSlug]` routes this is not a bare re-export: the shop
 * is opt-in per site. White-label partners inherit our pages, and some have a
 * compliance posture that forbids affiliate retail, so a site that hasn't
 * turned `shopEnabled` on gets a 404 rather than our storefront under their
 * brand. See docs/internal/SHOP_DESIGN.md rule 6.
 */
export default async function SiteShopPage({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  const { siteSlug } = await params;

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || "");
  let enabled = false;
  try {
    enabled = await convex.query(api.shop.queries.isEnabledForSite, { siteSlug });
  } catch {
    // Fail closed. If we can't confirm a partner opted in, don't show it.
    enabled = false;
  }

  if (!enabled) notFound();

  return <ShopClient siteSlug={siteSlug} />;
}
