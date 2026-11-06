import { HowItWorks } from "@/components/assurevantage/InformationPages";
import LegacyPage from "@/app/health/how-it-works/page";
import { assureMetadata } from "@/lib/assure-metadata";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  return (await params).siteSlug === "assurevantage"
    ? assureMetadata("how-it-works")
    : {};
}
export default async function Page({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  if ((await params).siteSlug === "assurevantage") return <HowItWorks />;
  return <LegacyPage />;
}
