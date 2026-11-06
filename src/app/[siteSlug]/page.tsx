import { AssureHome } from "@/components/assurevantage/MarketingPages";
import LegacyPage from "@/components/health/LegacySiteLanding";
import { ASSURE_URL } from "@/lib/assure-content";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  return (await params).siteSlug === "assurevantage"
    ? {
        alternates: { canonical: ASSURE_URL },
        title: "AssureVantage | Everyday care & wellbeing",
      }
    : {};
}
export default async function Page({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  return (await params).siteSlug === "assurevantage" ? (
    <AssureHome />
  ) : (
    <LegacyPage />
  );
}
