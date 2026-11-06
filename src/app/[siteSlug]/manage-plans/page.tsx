import { MembershipBilling } from "@/components/assurevantage/MemberHome";
import LegacyPage from "@/app/health/manage-plans/page";
import { assureMetadata } from "@/lib/assure-metadata";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  return (await params).siteSlug === "assurevantage"
    ? assureMetadata("manage-plans", {
        title: "Membership & billing",
        description:
          "Review your membership and manage billing or get help with changes.",
      })
    : {};
}
export default async function Page({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  return (await params).siteSlug === "assurevantage" ? (
    <MembershipBilling />
  ) : (
    <LegacyPage />
  );
}
