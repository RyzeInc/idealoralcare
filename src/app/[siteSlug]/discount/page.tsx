import { ServicePage } from "@/components/assurevantage/MarketingPages";
import LegacyPage from "@/app/health/discount/page";
import { assureMetadata } from "@/lib/assure-metadata";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  return (await params).siteSlug === "assurevantage"
    ? assureMetadata("discount")
    : {};
}
export default async function Page({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  if ((await params).siteSlug === "assurevantage")
    return <ServicePage serviceKey="discount" />;
  return <LegacyPage />;
}
