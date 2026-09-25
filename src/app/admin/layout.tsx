import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminProviders } from "@/components/admin/AdminProviders";
import { ConvexAuthGate } from "@/components/auth/ConvexAuthGate";
import { api } from "@/convex/_generated/api";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, getToken } = await auth();

  // Must be authenticated
  if (!userId) {
    redirect("/health");
  }

  // Verify admin role via Convex.
  //
  // Distribution partners used to pass this check and see the whole book. They
  // now belong in /partner, so send them there rather than bouncing them to the
  // marketing site with no explanation.
  try {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (convexUrl) {
      const convex = new ConvexHttpClient(convexUrl);
      const isAdmin = await convex.query(api.admin.adminUsers.isAdmin, {
        clerkUserId: userId,
      });
      if (!isAdmin) {
        const token = await getToken({ template: "convex" });
        if (token) convex.setAuth(token);
        const portal = await convex
          .query(api.admin.adminUsers.getMyPortal, {})
          .catch(() => null);
        redirect(portal?.portal === "partner" ? "/partner" : "/health");
      }
    }
  } catch (error) {
    // redirect() signals by throwing — let it through rather than swallowing it
    // into the fail-safe below.
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect("/health");
  }

  return (
    <AdminProviders>
      <AdminShell>
        <ConvexAuthGate>{children}</ConvexAuthGate>
      </AdminShell>
    </AdminProviders>
  );
}
