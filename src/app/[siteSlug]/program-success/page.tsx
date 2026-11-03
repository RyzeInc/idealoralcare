import Page from "@/app/newideal/success/page";
import { notFound } from "next/navigation";
export const metadata = { alternates: { canonical: "https://www.assurevantage.com/assurevantage/program-success" }, title: "Welcome | AssureVantage" };
export default async function MainProgramPage({ params, searchParams }: { params: Promise<{ siteSlug: string }>; searchParams: Promise<{ program?: string }> }) {
  if ((await params).siteSlug !== "assurevantage") notFound();
  return <Page params={params} searchParams={searchParams} />;
}
