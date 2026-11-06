import { Suspense } from "react";
import { notFound } from "next/navigation";
import Checkout from "@/components/assurevantage/SharedCheckout";
import { assureMetadata } from "@/lib/assure-metadata";
export const metadata = assureMetadata("program-checkout", {
  title: "Review & enroll",
  description:
    "Review your selected memberships, billing period and agreements before payment.",
});
export default async function MainCheckout({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  if ((await params).siteSlug !== "assurevantage") notFound();
  return (
    <Suspense fallback={null}>
      <Checkout />
    </Suspense>
  );
}
