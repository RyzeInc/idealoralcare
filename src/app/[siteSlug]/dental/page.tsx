import { redirect } from "next/navigation";
import LegacyPage from "@/app/health/dental/page";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ siteSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if ((await params).siteSlug === "assurevantage") {
    const p = new URLSearchParams();
    for (const [key, value] of Object.entries(await searchParams))
      for (const item of Array.isArray(value)
        ? value
        : value === undefined
          ? []
          : [value])
        p.append(key, item);
    redirect(`/assurevantage/oralcare${p.size ? `?${p}` : ""}`);
  }
  return <LegacyPage />;
}
