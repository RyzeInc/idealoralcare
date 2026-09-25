import type { Metadata } from "next";

// Metadata lives here because the page is a client component (it reads the
// site theme for the brand name).
export const metadata: Metadata = {
  title: "Dental Discount Network | Ideal Health",
  description:
    "Save 20%–58% on dental procedures through our national dental discount network. No waiting periods, no annual maximums.",
  alternates: { canonical: "/health/discount" },
  openGraph: {
    title: "Save 20–58% on Dental Care | Dental Discount Network",
    description:
      "Access 140,000+ dental providers nationwide. Save on cleanings, crowns, root canals & more. No waiting periods, no annual maximums.",
    url: "https://getidealoh.com/health/discount",
    images: [{ url: "/health-assets/dentist-network-discount_1536x1024.png", width: 1536, height: 1024 }],
  },
};

export default function DiscountLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
