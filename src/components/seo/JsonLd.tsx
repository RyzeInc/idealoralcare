/**
 * JSON-LD Structured Data Components
 *
 * Renders schema.org structured data in <script type="application/ld+json"> tags
 * for search engines and AI assistants to understand page content.
 */

interface JsonLdProps {
  data: Record<string, unknown>;
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/** Organization schema — use on homepage / layout */
export function OrganizationJsonLd() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "Ideal Health",
        url: "https://getidealoh.com",
        logo: "https://getidealoh.com/logo-apple-touch-icon.png",
        description:
          "Ideal Health offers affordable oral health plans with AI oral scanning, 24/7 teledentistry, and access to a dental discount network of 140,000+ providers.",
        contactPoint: {
          "@type": "ContactPoint",
          telephone: "+1-801-820-0010",
          contactType: "customer service",
          email: "info@getidealoh.com",
          availableLanguage: "English",
        },
        sameAs: [
          "https://twitter.com/idealhealth",
          "https://linkedin.com/company/idealhealth",
        ],
      }}
    />
  );
}

/** WebSite schema with search — use on homepage */
export function WebSiteJsonLd() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "Ideal Health",
        url: "https://getidealoh.com",
      }}
    />
  );
}

/** Product schema for plan pages */
export function ProductJsonLd({
  name,
  description,
  priceCents,
  cadence = "MONTH",
  url,
}: {
  name: string;
  description: string;
  priceCents: number;
  cadence?: "MONTH" | "YEAR";
  url: string;
}) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Product",
        name,
        description,
        brand: { "@type": "Brand", name: "Ideal Health" },
        offers: {
          "@type": "Offer",
          price: (priceCents / 100).toFixed(2),
          priceCurrency: "USD",
          priceValidUntil: new Date(
            new Date().getFullYear() + 1,
            0,
            1
          ).toISOString().split("T")[0],
          availability: "https://schema.org/InStock",
          url,
          hasMerchantReturnPolicy: {
            "@type": "MerchantReturnPolicy",
            applicableCountry: "US",
            returnPolicyCategory:
              "https://schema.org/MerchantReturnNotPermitted",
          },
          billingIncrement: 1,
          billingPeriod: cadence === "MONTH" ? "P1M" : "P1Y",
        },
      }}
    />
  );
}

/** FAQ schema — renders FAQPage structured data */
export function FAQJsonLd({
  questions,
}: {
  questions: { question: string; answer: string }[];
}) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: questions.map((q) => ({
          "@type": "Question",
          name: q.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: q.answer,
          },
        })),
      }}
    />
  );
}

/** BreadcrumbList schema */
export function BreadcrumbJsonLd({
  items,
}: {
  items: { name: string; url: string }[];
}) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: item.name,
          item: item.url,
        })),
      }}
    />
  );
}

/** Article schema for blog posts */
export function ArticleJsonLd({
  title,
  description,
  url,
  datePublished,
  dateModified,
  image,
}: {
  title: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified?: string;
  image?: string;
}) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Article",
        headline: title,
        description,
        url,
        datePublished,
        dateModified: dateModified || datePublished,
        image: image || "https://getidealoh.com/health-assets/og-default.png",
        author: {
          "@type": "Organization",
          name: "Ideal Health",
          url: "https://getidealoh.com",
        },
        publisher: {
          "@type": "Organization",
          name: "Ideal Health",
          url: "https://getidealoh.com",
          logo: {
            "@type": "ImageObject",
            url: "https://getidealoh.com/logo-apple-touch-icon.png",
          },
        },
      }}
    />
  );
}
