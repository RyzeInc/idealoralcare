import { AboutPage } from "@/components/assurevantage/InformationPages";
import { notFound } from "next/navigation";
import { assureMetadata } from "@/lib/assure-metadata";
export const metadata = assureMetadata("about");
export default async function Page({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  if ((await params).siteSlug !== "assurevantage") notFound();
  return <AboutPage />;
}
