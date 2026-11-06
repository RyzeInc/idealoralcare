import Catalog from "@/components/assurevantage/OfferingCatalog";
import { notFound } from "next/navigation";
import { assureMetadata } from "@/lib/assure-metadata";
export const metadata = assureMetadata("program-plans");
export default async function Page({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  if ((await params).siteSlug !== "assurevantage") notFound();
  return <Catalog />;
}
