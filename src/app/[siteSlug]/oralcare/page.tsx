import { ProgramPage } from "@/components/assurevantage/MarketingPages";
import LegacyPage from "@/app/newideal/oralcare/page";
import { assureMetadata } from "@/lib/assure-metadata";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  return (await params).siteSlug === "assurevantage"
    ? assureMetadata("oralcare")
    : {};
}
export default async function Page({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  if ((await params).siteSlug === "assurevantage")
    return <ProgramPage program="oralcare" />;
  return <LegacyPage />;
}
