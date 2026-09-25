import { notFound } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import ShopClient from "./ShopClient";

/**
 * The storefront switch is read per request, never at build time — a kill
 * switch baked into a static render would only take effect on the next deploy,
 * which is the one thing it must not do.
 */
export const dynamic = "force-dynamic";

export default async function ShopPage() {
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || "");

  // Fail *open*, unlike the tenant route next door. That one fails closed
  // because it answers "did this partner opt into affiliate retail at all"
  // (SHOP_DESIGN.md rule 6) and a wrong yes puts our shop under their brand.
  // This one answers "is our own storefront up right now", and a transient
  // Convex error should not 404 a live page. Nothing leaks either way: the
  // public queries are gated on the same switch, so a page rendered during an
  // outage still comes up empty if the shop is genuinely off.
  let enabled = true;
  try {
    enabled = await convex.query(api.shop.queries.isEnabled, {});
  } catch {
    enabled = true;
  }

  if (!enabled) notFound();

  return <ShopClient />;
}
