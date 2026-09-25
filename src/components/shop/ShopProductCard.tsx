"use client";

import Image from "next/image";
import { ExternalLink } from "lucide-react";
import { SHOP_PAID_LINK_LABEL } from "@/convex/shop/constants";
import type { ShopCardProduct } from "@/lib/shop/types";
import { formatCapturedPrice } from "@/lib/shop/types";

/**
 * One outbound affiliate product.
 *
 * The anchor carries the real tagged `affiliateUrl` — no interstitial redirect.
 * Routing affiliate traffic through our own hop is link cloaking under several
 * networks' terms (Amazon's included) and risks the account. Attribution is a
 * fire-and-forget beacon instead: if it fails we lose a data point, not a sale.
 *
 * `rel="sponsored"` is the correct signal for a paid link and keeps the site's
 * SEO standing intact.
 */
export default function ShopProductCard({
  product,
  siteSlug,
}: {
  product: ShopCardProduct;
  siteSlug?: string;
}) {
  const recordClick = () => {
    // sendBeacon survives the page unload that follows the click; fetch does
    // not reliably. Failure is silent by design — never block the navigation.
    try {
      const payload = JSON.stringify({
        productId: product._id,
        siteSlug,
        referrerPath: window.location.pathname,
      });
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon?.("/api/shop/click", blob);
    } catch {
      // No-op: attribution is best-effort.
    }
  };

  const price = formatCapturedPrice(product.priceCents, product.priceCapturedAt);

  return (
    <article
      className="glass-card"
      style={{
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        height: "100%",
      }}
    >
      {product.imageUrl && (
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "4 / 3",
            borderRadius: "12px",
            overflow: "hidden",
          }}
        >
          <Image
            src={product.imageUrl}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 320px"
            style={{ objectFit: "contain" }}
          />
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.06em", opacity: 0.7 }}>
          {product.brand}
        </span>
        <h3 style={{ margin: 0, fontSize: "1.0625rem", fontWeight: 600 }}>{product.name}</h3>
      </div>

      <p style={{ margin: 0, fontSize: "0.9375rem", lineHeight: 1.6, opacity: 0.85, flexGrow: 1 }}>
        {product.shortDescription}
      </p>

      {product.highlights && product.highlights.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.875rem", lineHeight: 1.7, opacity: 0.8 }}>
          {product.highlights.slice(0, 3).map((highlight) => (
            <li key={highlight}>{highlight}</li>
          ))}
        </ul>
      )}

      {price && (
        <p style={{ margin: 0, fontSize: "0.8125rem", opacity: 0.7 }}>
          {price}
        </p>
      )}

      <a
        href={product.affiliateUrl}
        target="_blank"
        rel="sponsored noopener noreferrer"
        onClick={recordClick}
        className="button button--primary"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          padding: "12px 20px",
          fontSize: "0.9375rem",
        }}
      >
        View at {product.merchant}
        <ExternalLink size={16} aria-hidden="true" />
      </a>

      {/* Per-card marker. The FTC treats "affiliate link" alone as inadequate;
          "paid link" adjacent to the link is what passes. */}
      <span style={{ fontSize: "0.75rem", opacity: 0.65, textAlign: "center" }}>
        {SHOP_PAID_LINK_LABEL}
      </span>
    </article>
  );
}
