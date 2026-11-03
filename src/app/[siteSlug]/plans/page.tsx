// Re-uses the plans catalog — HealthHeader and StickyCart links are path-aware
export { default } from "@/app/health/plans/page";

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params;
  return siteSlug === "assurevantage" ? { title: "Oral Savings Plans | AssureVantage", alternates: { canonical: "https://www.assurevantage.com/assurevantage/plans" } } : {};
}
