import { notFound } from "next/navigation";
import { EnrollmentConfirmation } from "@/components/assurevantage/EnrollmentConfirmation";
import { assureMetadata } from "@/lib/assure-metadata";
export const metadata = assureMetadata("program-success", {
  title: "Enrollment confirmation",
  description: "Review your enrollment and find your next membership steps.",
});
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ siteSlug: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  if ((await params).siteSlug !== "assurevantage") notFound();
  return <EnrollmentConfirmation sessionId={(await searchParams).session_id} />;
}
