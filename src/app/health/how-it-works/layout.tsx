import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How It Works | Ideal Health Oral Health Plan",
  description:
    "Learn how to sign up for Ideal Health in minutes. Browse plans, checkout securely, and get activated within 24 hours — no waiting periods, no hidden fees.",
};

export default function HowItWorksLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
