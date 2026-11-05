import { redirect } from "next/navigation";
import Checkout from "@/app/health/checkout/page";

export default async function SiteCheckout({ params, searchParams }: {
  params: Promise<{ siteSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if ((await params).siteSlug === "assurevantage") {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(await searchParams)) {
      for (const entry of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, entry);
    }
    redirect(`/assurevantage/program-checkout${query.size ? `?${query}` : ""}`);
  }
  return <Checkout />;
}
