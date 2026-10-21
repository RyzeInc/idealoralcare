import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { convexServiceSecret } from "@/lib/convex-service";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

/**
 * HEALTH DASHBOARD LAYOUT
 *
 * PROTECTED - Requires authentication + active subscription (or admin role)
 * Users see their active plans, account settings, etc.
 * Redirects to /health (catalog) if not authenticated
 * Redirects to /health#plans if authenticated but no active subscription
 * Admins always have access regardless of subscription status
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  // Must be authenticated to see dashboard
  if (!userId) {
    redirect("/health");
  }

  // Check for active subscription via Convex
  try {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
    }
    const convex = new ConvexHttpClient(convexUrl);

    // Check staff access before requesting a member bundle. An admin may have
    // no bundle, and a bundle lookup failure must not revoke admin access.
    const isAdmin = await convex.query(api.admin.adminUsers.isAdmin, { clerkUserId: userId });
    if (isAdmin) {
      return <>{children}</>;
    }

    const bundle = await convex.query(api.subscriptions.queries.getCustomerBundlePublic, {
      customerId: userId,
      serviceSecret: convexServiceSecret(),
    });

    // Allow access if:
    // 1. Status is "active"
    // 2. Status is "cancel_at_period_end" (cancellation scheduled but access continues)
    // 3. Status is "past_due" but less than 3 days old (grace period for payment retries)
    if (!bundle) {
      redirect("/health#plans");
    }

    const now = Date.now();
    const GRACE_PERIOD_MS = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds

    let hasAccess = false;

    if (bundle.status === "active") {
      hasAccess = true;
    } else if (bundle.status === "cancel_at_period_end") {
      hasAccess = true;
    } else if (bundle.status === "past_due" && bundle.pastDueAt) {
      // Allow access for 3 days after entering past_due status
      const daysSincePastDue = now - bundle.pastDueAt;
      if (daysSincePastDue < GRACE_PERIOD_MS) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      redirect("/health#plans");
    }
  } catch {
    // On error, redirect to plans page (fail-safe - require subscription)
    redirect("/health#plans");
  }

  return <>{children}</>;
}
