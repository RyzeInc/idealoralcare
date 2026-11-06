import { Resources } from "@/components/assurevantage/InformationPages";
import LegacyPage from "@/app/health/blog/page";
import { assureMetadata } from "@/lib/assure-metadata";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  return (await params).siteSlug === "assurevantage"
    ? assureMetadata("blog")
    : {};
}
export default async function Page({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  if ((await params).siteSlug === "assurevantage") return <Resources />;
  return <LegacyPage />;
}
