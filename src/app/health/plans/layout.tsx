import type { Metadata } from "next";
import { ProductJsonLd, BreadcrumbJsonLd } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title: "Oral Health Plans & Pricing | Ideal Health",
  description:
    "Browse Ideal Health oral health plans. Individual and family options with AI oral scanning, 24/7 teledentistry, and dental discount network access starting at $14.99/month.",
  alternates: { canonical: "/health/plans" },
  openGraph: {
    title: "Oral Health Plans & Pricing | Starting at $14.99/mo",
    description:
      "Individual ($14.99/mo) and family ($24.99/mo) oral health plans with AI scanning, 24/7 teledentistry, and 140,000+ dental providers. No waiting periods.",
    url: "https://getidealoh.com/health/plans",
    images: [{ url: "/health-assets/og-default.png", width: 1200, height: 630 }],
  },
};

export default function PlansLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ProductJsonLd
        name="Ideal Oral Savings Plan — Individual"
        description="AI Oral Scanning, 24/7 teledentistry, and dental discount network access with 140,000+ providers. Save 20–58% on dental procedures."
        priceCents={1499}
        cadence="MONTH"
        url="https://getidealoh.com/health/plans"
      />
      <ProductJsonLd
        name="Ideal Oral Savings Plan — Family"
        description="Everything in the individual plan plus unlimited dependents. AI Oral Scanning, 24/7 teledentistry, and dental discount network for the whole family."
        priceCents={2499}
        cadence="MONTH"
        url="https://getidealoh.com/health/plans"
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "https://getidealoh.com/health" },
          { name: "Plans & Pricing", url: "https://getidealoh.com/health/plans" },
        ]}
      />
      {children}
    </>
  );
}
