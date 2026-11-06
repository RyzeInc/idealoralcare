import Page from "@/app/health/sign-up/page";
import { assureMetadata } from "@/lib/assure-metadata";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  return (await params).siteSlug === "assurevantage"
    ? assureMetadata("sign-up", {
        title: "Create account",
        description:
          "Create your account to continue enrollment or link your membership.",
      })
    : {};
}
export default Page;
