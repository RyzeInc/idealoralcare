import Page from "@/app/newideal/balance-for-life/page";
import { notFound } from "next/navigation";
export const metadata = { alternates: { canonical: "https://www.assurevantage.com/assurevantage/balance-for-life" }, title: "Balance for Life | AssureVantage" };
export default async function MainProgramPage({ params }: { params: Promise<{ siteSlug: string }> }) {
  if ((await params).siteSlug !== "assurevantage") notFound();
  return <Page params={params} />;
}
