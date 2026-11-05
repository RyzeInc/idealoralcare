import Page from "@/components/assurevantage/OfferingCatalog";
import { notFound } from "next/navigation";
export const metadata = { alternates: { canonical: "https://www.assurevantage.com/assurevantage/program-plans" }, title: "Plans & Pricing | AssureVantage" };
export default async function MainProgramPage({ params }: { params: Promise<{ siteSlug: string }> }) {
  if ((await params).siteSlug !== "assurevantage") notFound();
  return <Page  />;
}
