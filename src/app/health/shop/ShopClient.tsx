"use client";

/**
 * PREVENTATIVE CARE SHOP — storefront
 *
 * A curated catalog of third-party products we link out to. We don't sell,
 * stock, or ship any of it.
 *
 * Public and identical for members and non-members, on purpose: no member
 * pricing, no member-only items, no "included with your plan" framing. Making
 * enrollment change nothing here is what keeps the shop from reading as an
 * inducement to buy a health plan. See docs/internal/SHOP_DESIGN.md rule 1.
 */

import { useQuery } from "convex/react";
import { usePathname } from "next/navigation";
import { api } from "@/convex/_generated/api";
import HealthHeader from "@/components/health/HealthHeader";
import ShopDisclosure from "@/components/shop/ShopDisclosure";
import ShopProductCard from "@/components/shop/ShopProductCard";
import type { ShopStorefrontSection } from "@/lib/shop/types";

export default function ShopClient({ siteSlug }: { siteSlug?: string }) {
  const pathname = usePathname();
  const sections = useQuery(api.shop.queries.listStorefront) as
    | ShopStorefrontSection[]
    | undefined;

  const populated = sections?.filter((s) => s.products.length > 0) ?? [];

  return (
    <>
      <HealthHeader />
      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "48px 24px 80px" }}>
        <header style={{ marginBottom: "32px" }}>
          <h1 style={{ margin: "0 0 12px", fontSize: "2.25rem", fontWeight: 700 }}>
            Preventative Care Shop
          </h1>
          <p style={{ margin: 0, maxWidth: "62ch", fontSize: "1.0625rem", lineHeight: 1.7, opacity: 0.85 }}>
            Everyday oral and self-care products we think are worth a look. These
            are sold by other retailers — not by us, and not as part of any plan.
          </p>
        </header>

        {/* Must render before the first product, always visible. */}
        <ShopDisclosure />

        {sections === undefined && (
          <p style={{ opacity: 0.7 }}>Loading products…</p>
        )}

        {sections !== undefined && populated.length === 0 && (
          <div className="glass-card" style={{ padding: "40px", textAlign: "center" }}>
            <p style={{ margin: 0, opacity: 0.8 }}>
              We&rsquo;re putting this collection together. Check back soon.
            </p>
          </div>
        )}

        {populated.map(({ category, products }) => (
          <section key={category._id} style={{ marginBottom: "56px" }}>
            <h2 id={category.slug} style={{ margin: "0 0 6px", fontSize: "1.5rem", fontWeight: 600 }}>
              {category.name}
            </h2>
            {category.description && (
              <p style={{ margin: "0 0 20px", maxWidth: "62ch", opacity: 0.8, lineHeight: 1.6 }}>
                {category.description}
              </p>
            )}
            <div
              style={{
                display: "grid",
                gap: "20px",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              }}
            >
              {products.map((product) => (
                <ShopProductCard
                  key={product._id}
                  product={product}
                  siteSlug={siteSlug ?? deriveSiteSlug(pathname)}
                />
              ))}
            </div>
          </section>
        ))}
      </main>
    </>
  );
}

/**
 * Pull the tenant out of the path for click attribution.
 *
 * `/health/shop` is our own brand and reports no slug; `/{siteSlug}/shop`
 * reports the tenant. Attribution only — never used to gate anything.
 */
function deriveSiteSlug(pathname: string): string | undefined {
  const [, first] = pathname.split("/");
  if (!first || first === "health") return undefined;
  return first;
}
