import { v } from "convex/values";

/**
 * PREVENTATIVE CARE SHOP — shared constants
 *
 * The network list is the single source of truth for both the schema validator
 * (imported by convex/schema.ts) and the admin UI dropdown. Adding a network
 * here is a schema change; deploy before seeding products that use it.
 */

export const SHOP_NETWORKS = [
  "amazon",
  "shareasale",
  "cj",
  "impact",
  "awin",
  "flexoffers",
  "levanta",
  "direct",
  "other",
] as const;

export type ShopNetwork = (typeof SHOP_NETWORKS)[number];

export const shopNetworkValidator = v.union(
  v.literal("amazon"),
  v.literal("shareasale"),
  v.literal("cj"),
  v.literal("impact"),
  v.literal("awin"),
  v.literal("flexoffers"),
  v.literal("levanta"),
  v.literal("direct"),
  v.literal("other"),
);

/** Human labels for the admin UI. */
export const SHOP_NETWORK_LABELS: Record<ShopNetwork, string> = {
  amazon: "Amazon Associates",
  shareasale: "ShareASale",
  cj: "CJ Affiliate",
  impact: "Impact",
  awin: "AWIN",
  flexoffers: "FlexOffers",
  levanta: "Levanta",
  direct: "Direct with brand",
  other: "Other",
};

/**
 * Required FTC disclosure. Must render on the same page as the links, before
 * the first product, with no interaction needed to reveal it.
 *
 * "Affiliate link" alone is not adequate under current FTC guidance; "paid
 * link" is. Do not soften this copy without legal review.
 */
export const SHOP_DISCLOSURE =
  "Paid links. We earn a commission when you buy through links on this page, " +
  "at no extra cost to you. This does not affect what we show you, and these " +
  "products are not part of any Ideal plan or benefit.";

/** Per-card marker sitting next to each outbound link. */
export const SHOP_PAID_LINK_LABEL = "Paid link";
