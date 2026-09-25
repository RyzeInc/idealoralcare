import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use | Ideal Health",
  description: "Terms of use for the Ideal Oral Health discount program.",
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
