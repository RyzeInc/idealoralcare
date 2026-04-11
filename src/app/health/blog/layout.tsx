import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s | Ideal Health Blog",
    default: "Oral Health Blog | Ideal Health",
  },
  description:
    "Expert advice on dental discount plans, affordable dental care alternatives, teledentistry, and oral health tips from Ideal Health.",
  alternates: { canonical: "/health/blog" },
  openGraph: {
    title: "Oral Health Blog | Ideal Health",
    description:
      "Expert advice on dental discount plans, affordable dental care, teledentistry, and oral health tips.",
    url: "https://getidealoh.com/health/blog",
    images: [{ url: "/health-assets/og-default.png", width: 1200, height: 630 }],
  },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
