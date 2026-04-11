import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Manage Plans | Ideal Health",
  description:
    "Manage your Ideal Health membership. Upgrade, downgrade, or cancel your oral health plan anytime.",
  robots: { index: false, follow: false },
};

export default function ManagePlansLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
