import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Ideal Health",
  description: "Privacy policy for the Ideal Oral Health discount program.",
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
