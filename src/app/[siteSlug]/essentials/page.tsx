import Page from "@/app/newideal/essentials/page";
import { notFound } from "next/navigation";
export const metadata = { alternates: { canonical: "https://www.assurevantage.com/assurevantage/essentials" }, title: "Essentials Plan | AssureVantage" };
export default async function MainProgramPage({ params }: { params: Promise<{ siteSlug: string }> }) {
  if ((await params).siteSlug !== "assurevantage") notFound();
  return <Page params={params} />;
}
