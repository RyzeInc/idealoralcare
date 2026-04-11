import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { ConvexClientProvider } from "@/components/providers/ConvexClientProvider";
import { GoogleAnalytics } from "@/components/seo/GoogleAnalytics";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "Ideal Health | Modern Health Plans Made Simple",
  description:
    "Ideal Health - Comprehensive oral health plan with AI Oral Scanning, 24/7 teledentistry, and Dental Discount Network dental network access.",
  metadataBase: new URL("https://getidealoh.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: "Ideal Health",
    title: "Ideal Health | Modern Health Plans Made Simple",
    description:
      "AI Oral Scanning, 24/7 teledentistry, and a nationwide dental discount network — starting at $14.99/month. No waiting periods.",
    url: "https://getidealoh.com",
    images: [
      {
        url: "/health-assets/og-default.png",
        width: 1200,
        height: 630,
        alt: "Ideal Health — Affordable Oral Health Plans",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@idealhealth",
    title: "Ideal Health | Modern Health Plans Made Simple",
    description:
      "AI Oral Scanning, 24/7 teledentistry, and a nationwide dental discount network — starting at $14.99/month.",
    images: ["/health-assets/og-default.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <GoogleAnalytics />
        {/*
          signInUrl / signUpUrl tell Clerk where YOUR sign-in pages live.
          Without these, Clerk redirects to its hosted page at accounts.getidealoh.com.
          These are also read from NEXT_PUBLIC_CLERK_SIGN_IN_URL env var if set.
        */}
        <ClerkProvider
          signInUrl="/health/sign-in"
          signUpUrl="/health/sign-up"
          signInFallbackRedirectUrl="/health/dashboard"
          signUpFallbackRedirectUrl="/health/dashboard"
        >
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
