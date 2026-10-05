import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Employer Eligibility | Ideal Oral Health",
  robots: { index: false, follow: false },
  alternates: { canonical: "/employer/upload" },
};
export default function EmployerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
