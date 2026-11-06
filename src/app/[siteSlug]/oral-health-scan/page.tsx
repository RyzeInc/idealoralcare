import { ServicePage } from "@/components/assurevantage/MarketingPages";
import LegacyPage from "@/app/health/oral-health-scan/page";
import { assureMetadata } from "@/lib/assure-metadata";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  return (await params).siteSlug === "assurevantage"
    ? assureMetadata("oral-health-scan")
    : {};
}
export default async function Page({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  if ((await params).siteSlug === "assurevantage")
    return <ServicePage serviceKey="oral-health-scan" />;
  return <LegacyPage />;
}
