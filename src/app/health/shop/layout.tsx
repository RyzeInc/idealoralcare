import type { Metadata } from "next";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title: "Preventative Care Shop | Ideal Oral Health",
  description:
    "Curated everyday oral and self-care products — toothbrushes, floss, whitening, and more. Sold by third-party retailers; not part of any Ideal plan.",
  alternates: { canonical: "/health/shop" },
  openGraph: {
    title: "Preventative Care Shop | Ideal Oral Health",
    description:
      "Curated everyday oral and self-care products from retailers we trust.",
    url: "https://getidealoh.com/health/shop",
    images: [{ url: "/health-assets/og-default.png", width: 1200, height: 630 }],
  },
};

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "https://getidealoh.com/health" },
          { name: "Preventative Care Shop", url: "https://getidealoh.com/health/shop" },
        ]}
      />
      {children}
    </>
  );
}
