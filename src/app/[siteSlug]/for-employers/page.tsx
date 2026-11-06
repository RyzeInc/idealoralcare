import { EmployersPage } from "@/components/assurevantage/InformationPages";
import { notFound } from "next/navigation";
import { assureMetadata } from "@/lib/assure-metadata";
export const metadata = assureMetadata("for-employers");
export default async function Page({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  if ((await params).siteSlug !== "assurevantage") notFound();
  return <EmployersPage />;
}
