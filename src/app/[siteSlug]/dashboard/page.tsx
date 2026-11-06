import { Suspense } from "react";
import { MemberHome } from "@/components/assurevantage/MemberHome";
import LegacyPage from "@/app/health/dashboard/page";
import { assureMetadata } from "@/lib/assure-metadata";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  return (await params).siteSlug === "assurevantage"
    ? assureMetadata("dashboard", {
        title: "Member portal",
        description:
          "Access your purchased benefits, documents and membership support.",
      })
    : {};
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ siteSlug: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  return (await params).siteSlug === "assurevantage" ? (
    <Suspense fallback={<p>Loading member portal…</p>}>
      <MemberHome />
    </Suspense>
  ) : (
    <LegacyPage searchParams={searchParams} />
  );
}
