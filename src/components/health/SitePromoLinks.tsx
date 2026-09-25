"use client";

import { ArrowUpRight } from "lucide-react";
import {
  useSiteThemeOptional,
  type SitePromoLink,
  type SitePromoPlacement,
} from "@/components/providers/SiteThemeProvider";

/**
 * SITE PROMO LINKS
 *
 * Renders the current site's configured third-party offers for one placement as
 * an accented card — a headline and a button, e.g.
 *   "Interested in Exploring Vision?"  [ Click Here! ↗ ]
 *
 * Nothing renders unless the site record carries a matching, enabled promo, so
 * the shared /health pages and every other white-label brand stay untouched by
 * one partner's vendor link. See convex/lib/promoLinks.ts.
 */

/**
 * Admins type these URLs by hand, so the scheme is checked rather than trusted —
 * an href is an injection point, and `javascript:` in a promo field would run
 * on every visitor's click.
 */
function isSafeUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * The accent picks up `--brand-secondary`, which SiteThemeProvider injects from
 * each site's own branding record — so a white-label's promo wears that brand's
 * colour rather than ours. Teal is the fallback when a site sets no secondary.
 *
 * Secondary rather than primary is deliberate: on the plans page the primary
 * blue belongs to Checkout, and a third-party offer should not outrank our own
 * conversion path.
 */
const ACCENT = "var(--brand-secondary, #14b8a6)";

function PromoRow({ promo }: { promo: SitePromoLink }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "1.5rem",
        maxWidth: "960px",
        margin: "0 auto",
        background: "#ffffff",
        // The bar is the whole point of the treatment — it reads as an offer
        // rather than a footnote before a single word has been parsed.
        borderLeft: `5px solid ${ACCENT}`,
        borderRadius: "var(--radius-lg, 24px)",
        boxShadow: "var(--glass-shadow, 0 8px 32px rgba(0, 0, 0, 0.08))",
        padding: "1.75rem 2rem",
      }}
    >
      <div style={{ flex: "1 1 320px", minWidth: 0 }}>
        <p
          style={{
            fontSize: "clamp(1.25rem, 2.5vw, 1.625rem)",
            fontWeight: 700,
            color: "var(--text-primary, #0f172a)",
            margin: 0,
            lineHeight: 1.3,
            letterSpacing: "-0.01em",
          }}
        >
          {promo.text}
        </p>
        {promo.disclosure ? (
          <p
            style={{
              fontSize: "0.8125rem",
              color: "var(--text-muted, #64748b)",
              margin: "0.5rem 0 0",
              lineHeight: 1.5,
            }}
          >
            {promo.disclosure}
          </p>
        ) : null}
      </div>

      <a
        href={promo.url}
        target="_blank"
        rel="noopener noreferrer"
        className="button"
        style={{
          flex: "0 0 auto",
          gap: "8px",
          background: ACCENT,
          color: "#ffffff",
          textDecoration: "none",
          whiteSpace: "nowrap",
        }}
      >
        {promo.ctaText}
        <ArrowUpRight size={18} aria-hidden="true" />
      </a>
    </div>
  );
}

export default function SitePromoLinks({
  placement,
}: {
  placement: SitePromoPlacement;
}) {
  const theme = useSiteThemeOptional();

  const promos = (theme?.site?.promoLinks ?? []).filter(
    (p) =>
      p.enabled &&
      p.placements?.includes(placement) &&
      p.text?.trim() &&
      p.ctaText?.trim() &&
      isSafeUrl(p.url ?? "")
  );

  if (promos.length === 0) return null;

  return (
    // Padding is set here rather than via a `bg--` modifier: those selectors
    // style `> .container` into a frosted panel, which would nest a card inside
    // a card. (An earlier version used `bg--light`, which does not exist at all,
    // leaving the promo as bare text on the page gradient.)
    <section style={{ padding: "3rem 0" }}>
      <div className="container">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}
        >
          {promos.map((promo, i) => (
            <PromoRow key={`${promo.url}-${i}`} promo={promo} />
          ))}
        </div>
      </div>
    </section>
  );
}
