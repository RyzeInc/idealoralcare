import type { Metadata } from "next";

// Metadata lives here because the page is a client component (it reads the
// site theme for the brand name).
export const metadata: Metadata = {
  title: "Frequently Asked Questions | Ideal Health Oral Health Plan",
  description:
    "Get answers to common questions about Ideal Health oral health plans, dental discount networks, teledentistry, AI oral scanning, pricing, and how to enroll.",
  alternates: { canonical: "/health/faq" },
  openGraph: {
    title: "FAQ — Ideal Health Oral Health Plans",
    description:
      "Everything you need to know about dental discount plans, teledentistry, AI oral scanning, and Ideal Health membership.",
    url: "https://getidealoh.com/health/faq",
    images: [
      { url: "/health-assets/og-default.png", width: 1200, height: 630 },
    ],
  },
};

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
