import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";

export default async function SiteSlugDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ siteSlug: string }>;
}) {
  const { siteSlug } = await params;
  const { userId } = await auth();

  if (!userId) {
    redirect(`/${siteSlug}/sign-in`);
  }

  try {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (convexUrl) {
      const convex = new ConvexHttpClient(convexUrl);

      const [isAdmin, bundle] = await Promise.all([
        convex.query("admin/adminUsers:isAdmin" as any, { clerkUserId: userId }),
        convex.query("subscriptions/queries:getCustomerBundlePublic" as any, { customerId: userId }),
      ]);

      if (isAdmin) return <>{children}</>;

      if (!bundle) {
        redirect(`/${siteSlug}/plans`);
      }

      const GRACE_PERIOD_MS = 3 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      let hasAccess = false;

      if (bundle.status === "active" || bundle.status === "cancel_at_period_end") {
        hasAccess = true;
      } else if (bundle.status === "past_due" && bundle.pastDueAt) {
        hasAccess = now - bundle.pastDueAt < GRACE_PERIOD_MS;
      }

      if (!hasAccess) {
        redirect(`/${siteSlug}/plans`);
      }
    }
  } catch {
    redirect(`/${siteSlug}/plans`);
  }

  return <>{children}</>;
}
