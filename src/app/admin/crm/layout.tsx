import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { CrmSubNav } from "@/components/admin/crm/CrmSubNav";
import { CrmAuthGate } from "@/components/admin/crm/CrmAuthGate";

/**
 * CRM ROUTE GATE.
 *
 * The parent /admin layout already requires an `adminUsers` row — as of the
 * broker-insights migration, distribution partners are routed to /partner
 * before they ever reach here. So by the time this layout runs, the caller is
 * already internal staff.
 *
 * This second check exists anyway, deliberately: the CRM's prospect list,
 * touch history and pipeline are the company's most sensitive commercial
 * asset, and some CRM contacts ARE brokers — a partner reading a rep's candid
 * note about themselves would be a business incident, not just a bug. If
 * /admin's gate ever regresses or gets narrowed in a way that stops matching
 * "internal staff" exactly, this layout should not silently inherit that
 * change. See convex/crm/guards.ts for the matching backend-side guard used
 * by every CRM query/mutation/action.
 */
export default async function CrmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, getToken } = await auth();
  if (!userId) {
    redirect("/health");
  }

  try {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (convexUrl) {
      const convex = new ConvexHttpClient(convexUrl);
      const token = await getToken({ template: "convex" });
      if (token) convex.setAuth(token);
      const isCrmStaff = await convex.query(api.crm.access.isCrmStaff, {});
      if (!isCrmStaff) {
        redirect("/admin");
      }
    }
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect("/admin");
  }

  return (
    <div className="space-y-6">
      <CrmSubNav />
      {/* Cmd-K now lives in AdminShell, one level up: the palette searches CRM
          records from anywhere in the console, so a CRM-only copy here would
          only double-bind the shortcut. */}
      <CrmAuthGate>{children}</CrmAuthGate>
    </div>
  );
}
