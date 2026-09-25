import { v } from "convex/values";

/**
 * SITE PROMO LINKS — shared constants
 *
 * A promo link is a plain sentence with one hyperlinked phrase, pointing at an
 * offer we neither sell nor underwrite (e.g. a white-label partner's vision
 * carrier sending members to the carrier's own co-branded landing page).
 *
 * These live on the site record rather than in the shared page components
 * because every brand renders the same pages. A hardcoded link would appear on
 * all of them; a link stored per-site appears only where it was configured.
 *
 * The validator is the single source of truth for the schema (convex/schema.ts)
 * and the admin site wizard. Adding a placement here is a schema change —
 * deploy it before an admin can select it.
 */

export const PROMO_PLACEMENTS = ["landing", "plans"] as const;

export type PromoPlacement = (typeof PROMO_PLACEMENTS)[number];

/** Human labels for the admin wizard checkboxes. */
export const PROMO_PLACEMENT_LABELS: Record<PromoPlacement, string> = {
  landing: "Site landing page",
  plans: "Plans page",
};

export const promoPlacementValidator = v.union(
  v.literal("landing"),
  v.literal("plans"),
);

export const promoLinkValidator = v.object({
  /** Lead-in copy shown as plain text, e.g. "Interested in Exploring Vision?" */
  text: v.string(),
  /** The hyperlinked phrase, e.g. "Click Here!" */
  ctaText: v.string(),
  /** Absolute destination. Opens in a new tab. */
  url: v.string(),
  /**
   * Fine print rendered beneath. Optional, but the reason it exists: these
   * links point at third-party products, and a member should not read one as
   * part of the plan they bought from us.
   */
  disclosure: v.optional(v.string()),
  /** Empty renders nowhere — the same as disabling it. */
  placements: v.array(promoPlacementValidator),
  enabled: v.boolean(),
});
