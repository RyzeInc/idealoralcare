import Catalog from "@/components/assurevantage/OfferingCatalog";
import LegacyPage from "@/app/health/plans/page";
import { assureMetadata } from "@/lib/assure-metadata";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  return (await params).siteSlug === "assurevantage"
    ? assureMetadata("plans")
    : {};
}
export default async function Page({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  return (await params).siteSlug === "assurevantage" ? (
    <Catalog focus="oral" />
  ) : (
    <LegacyPage />
  );
}
