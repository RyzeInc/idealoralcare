import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { convexServiceSecret } from "@/lib/convex-service";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

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
    if (!convexUrl) {
      throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
    }
    const convex = new ConvexHttpClient(convexUrl);

    const isAdmin = await convex.query(api.admin.adminUsers.isAdmin, { clerkUserId: userId });
    if (isAdmin) return <>{children}</>;

    const bundle = await convex.query(api.subscriptions.queries.getCustomerBundlePublic, {
      customerId: userId,
      serviceSecret: convexServiceSecret(),
    });

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
  } catch {
    redirect(`/${siteSlug}/plans`);
  }

  return <>{children}</>;
}
