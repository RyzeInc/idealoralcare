import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Compare Oral Health Plans | Individual vs Family | Ideal Health",
  description:
    "Compare Ideal Health individual and family oral health plans side by side. See pricing, features, and choose the right plan for your needs.",
};

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
