import Page from "@/app/health/forgot-password/page";
import { assureMetadata } from "@/lib/assure-metadata";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  return (await params).siteSlug === "assurevantage"
    ? assureMetadata("forgot-password", {
        title: "Reset password",
        description: "Recover access to your AssureVantage account.",
      })
    : {};
}
export default Page;
