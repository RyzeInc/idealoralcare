import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { ConvexClientProvider } from "@/components/providers/ConvexClientProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ideal Health | Modern Health Plans Made Simple",
  description:
    "Ideal Health - Comprehensive oral health plan with Toothlens AI scanning, Dial Care teledentistry, and Dental Discount Network Dental Discount Network dental network access.",
  icons: {
    icon: "/ideal-health-logo.png",
    shortcut: "/ideal-health-logo.png",
    apple: "/ideal-health-logo.png",
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
        <ClerkProvider>
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
