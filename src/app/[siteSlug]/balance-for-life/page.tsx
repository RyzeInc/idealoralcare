import { ServicePage } from "@/components/assurevantage/MarketingPages";
import LegacyPage from "@/app/newideal/balance-for-life/page";
import { assureMetadata } from "@/lib/assure-metadata";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  return (await params).siteSlug === "assurevantage"
    ? assureMetadata("balance-for-life")
    : {};
}
export default async function Page({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  if ((await params).siteSlug === "assurevantage")
    return <ServicePage serviceKey="balance-for-life" />;
  return <LegacyPage />;
}
