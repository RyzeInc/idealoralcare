import { PrivacyPage } from "@/components/assurevantage/InformationPages";
import LegacyPage from "@/components/health/LegacySitePrivacy";
import { assureMetadata } from "@/lib/assure-metadata";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  return (await params).siteSlug === "assurevantage"
    ? assureMetadata("privacy")
    : {};
}
export default async function Page({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  if ((await params).siteSlug === "assurevantage") return <PrivacyPage />;
  return <LegacyPage />;
}
