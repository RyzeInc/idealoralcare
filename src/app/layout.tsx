import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { ConvexClientProvider } from "@/components/providers/ConvexClientProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ideal Health | Modern Health Plans Made Simple",
  description:
    "Ideal Health - Comprehensive oral health plan with AI Oral Scanning, 24/7 teledentistry, and Dental Discount Network dental network access.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
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
