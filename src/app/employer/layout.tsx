import {
  PublicDomainFrame,
  isAssureHost,
} from "@/components/assurevantage/PublicDomainFrame";
import type { Metadata } from "next";

const legacyMetadata: Metadata = {
  title: "Employer Eligibility | Ideal Oral Health",
  robots: { index: false, follow: false },
  alternates: { canonical: "/employer/upload" },
};
export async function generateMetadata() {
  return (await isAssureHost())
    ? {
        title: "Employer access | AssureVantage",
        robots: { index: false, follow: false },
      }
    : legacyMetadata;
}
export default function EmployerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PublicDomainFrame>{children}</PublicDomainFrame>;
}
