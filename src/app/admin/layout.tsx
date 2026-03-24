import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  // Must be authenticated
  if (!userId) {
    redirect("/health");
  }

  // Verify admin role via Convex
  try {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (convexUrl) {
      const convex = new ConvexHttpClient(convexUrl);
      // Call the unprotected isAdmin query to check role
      const isAdmin = await convex.query(
        "admin/adminUsers:isAdmin" as any,
        { clerkUserId: userId }
      );
      if (!isAdmin) {
        redirect("/health");
      }
    }
  } catch (error) {
    // On error, deny access (fail-safe)
    redirect("/health");
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
