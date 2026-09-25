import type { Metadata } from "next";

// Metadata lives here because the page is a client component (it reads the
// site theme for the brand name).
export const metadata: Metadata = {
  title: "AI Oral Health Scan | Instant Dental Screening | Ideal Health",
  description:
    "Get instant AI-powered insights into your dental health with our AI oral health scan. No waiting, no hassle — just quick results from your smartphone.",
  alternates: { canonical: "/health/oral-health-scan" },
  openGraph: {
    title: "AI Oral Health Scan — Screen Your Teeth From Home",
    description:
      "Snap a photo with your smartphone and get instant AI-powered dental health insights. No appointment needed.",
    url: "https://getidealoh.com/health/oral-health-scan",
    images: [{ url: "/health-assets/toothlensscan_1086x1024.png", width: 1086, height: 1024 }],
  },
};

export default function OralHealthScanLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
