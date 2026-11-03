import Page from "@/app/newideal/oralcare/page";
import { notFound } from "next/navigation";
export const metadata = { alternates: { canonical: "https://www.assurevantage.com/assurevantage/oralcare" }, title: "Oral Care | AssureVantage" };
export default async function MainProgramPage({ params }: { params: Promise<{ siteSlug: string }> }) {
  if ((await params).siteSlug !== "assurevantage") notFound();
  return <Page params={params} />;
}
