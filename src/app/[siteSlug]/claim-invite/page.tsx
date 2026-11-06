import Page from "@/app/health/claim-invite/page";
import { assureMetadata } from "@/lib/assure-metadata";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  return (await params).siteSlug === "assurevantage"
    ? assureMetadata("claim-invite", {
        title: "Accept invitation",
        description: "Link your membership invitation to your account.",
      })
    : {};
}
export default Page;
