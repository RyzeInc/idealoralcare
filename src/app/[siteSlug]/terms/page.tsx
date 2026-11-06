import { TermsPage } from "@/components/assurevantage/InformationPages";
import LegacyPage from "@/components/health/LegacySiteTerms";
import { assureMetadata } from "@/lib/assure-metadata";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  return (await params).siteSlug === "assurevantage"
    ? assureMetadata("terms")
    : {};
}
export default async function Page({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  if ((await params).siteSlug === "assurevantage") return <TermsPage />;
  return <LegacyPage />;
}
