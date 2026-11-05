import { LandingCards, SharedCatalogLink } from "@/app/landing-cards";
import Image from "next/image";
import { Suspense } from "react";
import { MAIN_BRAND, MAIN_ORIGIN } from "@/lib/program-brand";
import { WebSiteJsonLd } from "@/components/seo/JsonLd";

export const metadata = {
  alternates: { canonical: MAIN_ORIGIN },
  openGraph: { title: "AssureVantage — Choose Your Plan", siteName: "AssureVantage", url: MAIN_ORIGIN },
  twitter: { title: "AssureVantage — Choose Your Plan", description: "Explore oral savings, Balance for Life and Essentials memberships.", images: [MAIN_BRAND.branding.logoUrl] },
  title: "AssureVantage — Choose Your Plan",
  description:
    "Explore AssureVantage's Oral Savings Plans from $14.99/mo, Balance for Life mental wellbeing support for $19.95/mo, or the Essentials membership from $58.95/mo. Membership programs, not insurance.",
};

export default function RootPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(150deg, #0c4a6e 0%, #0369a1 55%, #0e7490 100%)",
        fontFamily: "system-ui, -apple-system, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <WebSiteJsonLd name={MAIN_BRAND.name} url={MAIN_ORIGIN} />
      {/* Background texture */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "url('/newideal/site-files/multi-demographic.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: 0.08,
        }}
      />

      {/* Header */}
      <header
        style={{
          position: "relative",
          zIndex: 10,
          display: "flex",
          justifyContent: "center",
          padding: "2rem 1.5rem 0",
        }}
      >
        <div style={{ background: "white", borderRadius: 12, padding: "12px 22px" }}>
          <Image src={MAIN_BRAND.branding.logoUrl} alt="AssureVantage" width={220} height={74} priority style={{ width: 220, height: "auto" }} />
        </div>
      </header>

      {/* Hero text */}
      <section
        style={{
          position: "relative",
          zIndex: 10,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "3rem 1.5rem",
          textAlign: "center",
        }}
      >
        <p
          style={{
            color: "rgba(186,230,253,0.9)",
            fontSize: "0.875rem",
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            marginBottom: "1rem",
          }}
        >
          Welcome to AssureVantage
        </p>
        <h1
          style={{
            color: "#fff",
            fontSize: "clamp(2rem, 5vw, 3.25rem)",
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: "-0.03em",
            maxWidth: 680,
            marginBottom: "1rem",
          }}
        >
          {/* Not "coverage": these are membership programs, not insurance,
              and wording that implies insurance is a compliance risk. */}
          Everyday care, real savings
          <br />
          <span style={{ color: "#7dd3fc" }}>built for real people</span>
        </h1>
        <p
          style={{
            color: "rgba(186,230,253,0.85)",
            fontSize: "1.1rem",
            maxWidth: 520,
            lineHeight: 1.65,
            marginBottom: "3rem",
          }}
        >
          Choose the membership that fits your needs — dental savings from
          $14.99/mo, Balance for Life mental wellbeing support for $19.95/mo,
          or the full Essentials bundle from $58.95/mo.
        </p>

        {/* Interactive cards (client component) */}
        <Suspense fallback={null}><LandingCards /></Suspense>

        <Suspense fallback={null}><SharedCatalogLink /></Suspense>

        {/* Trust line */}
        <p
          style={{
            color: "rgba(186,230,253,0.65)",
            fontSize: "0.8rem",
            marginTop: "2.5rem",
          }}
        >
          Membership and discount programs — not insurance.
        </p>
      </section>
    </main>
  );
}

