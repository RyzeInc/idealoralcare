import Page from "@/app/health/sign-in/page";
import { assureMetadata } from "@/lib/assure-metadata";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  return (await params).siteSlug === "assurevantage"
    ? assureMetadata("sign-in", {
        title: "Sign in",
        description: "Sign in to your AssureVantage member account.",
      })
    : {};
}
export default Page;
