import { Suspense } from "react";
import { notFound } from "next/navigation";
import Checkout from "@/components/assurevantage/SharedCheckout";
import { SatelliteAuthRedirect } from "@/components/auth/SatelliteAuthRedirect";
export const metadata = { alternates: { canonical: "https://www.assurevantage.com/assurevantage/program-checkout" }, title: "Checkout | AssureVantage" };
export default async function MainCheckout({ params }: { params: Promise<{ siteSlug: string }> }) {
  if ((await params).siteSlug !== "assurevantage") notFound();
  return <Suspense fallback={null}><SatelliteAuthRedirect mode="checkout"><Checkout /></SatelliteAuthRedirect></Suspense>;
}
