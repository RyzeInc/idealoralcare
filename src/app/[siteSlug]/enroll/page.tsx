import { redirect } from "next/navigation";
import LegacyPage from "@/app/health/enroll/page";
import { assureMetadata } from "@/lib/assure-metadata";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  return (await params).siteSlug === "assurevantage"
    ? assureMetadata("enroll", {
        title: "Choose your membership",
        description: "Explore membership options and continue enrollment.",
      })
    : {};
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ siteSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  if (
    (await params).siteSlug === "assurevantage" &&
    (!query.flow || query.flow === "dtc")
  ) {
    const p = new URLSearchParams();
    for (const [key, value] of Object.entries(query))
      for (const entry of Array.isArray(value)
        ? value
        : value === undefined
          ? []
          : [value])
        p.append(key, entry);
    redirect(`/assurevantage/program-plans${p.size ? `?${p}` : ""}`);
  }
  return <LegacyPage />;
}
