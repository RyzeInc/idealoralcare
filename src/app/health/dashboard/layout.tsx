import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

/**
 * HEALTH DASHBOARD LAYOUT
 *
 * PROTECTED - Requires authentication
 * Users see their active plans, account settings, etc.
 * Redirects to /health (catalog) if not authenticated
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

  return <>{children}</>;
}
