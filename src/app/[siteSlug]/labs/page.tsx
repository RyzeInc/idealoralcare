import { ServicePage } from "@/components/assurevantage/MarketingPages";
import { notFound } from "next/navigation";
import { assureMetadata } from "@/lib/assure-metadata";
export const metadata = assureMetadata("labs");
export default async function Page({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  if ((await params).siteSlug !== "assurevantage") notFound();
  return <ServicePage serviceKey="labs" />;
}
