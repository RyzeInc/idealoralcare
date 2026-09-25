import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { PartnerSidebar } from "@/components/partner/PartnerSidebar";
import { AdminProviders } from "@/components/admin/AdminProviders";
import { ConvexAuthGate } from "@/components/auth/ConvexAuthGate";
import { api } from "@/convex/_generated/api";

/**
 * Partner portal shell.
 *
 * The gate here is a routing decision only — it decides whether someone sees
 * the portal at all. It does NOT decide what they see inside it: every query
 * under convex/insights/* resolves its own ViewerScope and filters by it,
 * because Convex functions are callable directly over the wire and a layout
 * redirect protects nothing from a crafted request.
 *
 * Fails closed: any error resolving the scope sends the visitor to /health.
 */
export default async function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, getToken } = await auth();
  if (!userId) {
    // Carry a return path, as src/proxy.ts does. A layout cannot see the
    // pathname it was rendered for, so this lands on the portal root rather
    // than the exact sub-page — the proxy normally gets here first and does
    // better; this is the fallback for a request its matcher misses.
    redirect("/health/sign-in?redirect_url=%2Fpartner");
  }

  try {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (convexUrl) {
      const convex = new ConvexHttpClient(convexUrl);
      // Forward the caller's identity — getMyScope resolves the signed-in user,
      // it does not take a user id, so nobody can probe someone else's scope.
      const token = await getToken({ template: "convex" });
      if (token) convex.setAuth(token);

      const scope = await convex.query(api.insights.scope.getMyScope, {});
      if (!scope) redirect("/health");
    }
  } catch (error) {
    // redirect() throws by design; let it through rather than swallowing it.
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect("/health");
  }

  return (
    <AdminProviders>
      <div className="flex min-h-screen bg-slate-100">
        <PartnerSidebar />
        <main className="flex-1 min-w-0">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <ConvexAuthGate>{children}</ConvexAuthGate>
          </div>
        </main>
      </div>
    </AdminProviders>
  );
}
