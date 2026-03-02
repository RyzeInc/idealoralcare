import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import {
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  DollarSign,
  ArrowLeft,
  ShieldCheck,
  Briefcase,
} from "lucide-react";
import Link from "next/link";

const ADMIN_NAVIGATION = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Sites & Accounts", href: "/admin/hierarchy", icon: Building2 },
  { label: "Members", href: "/admin/members", icon: Users },
  { label: "Brokers", href: "/admin/brokers", icon: Briefcase },
  { label: "Eligibility Files", href: "/admin/eligibility", icon: FileText },
  { label: "Billing", href: "/admin/billing", icon: DollarSign },
  { label: "Admin Users", href: "/admin/users", icon: ShieldCheck },
];

function AdminSidebar() {
  return (
    <aside className="w-64 min-h-screen bg-slate-900 text-white flex flex-col flex-shrink-0">
      {/* Logo / Brand */}
      <div className="px-6 py-5 border-b border-slate-700/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center text-sm font-bold">
            IH
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">Ideal Health</p>
            <p className="text-[11px] text-slate-400 leading-tight">Admin Portal</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {ADMIN_NAVIGATION.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors"
            >
              <Icon size={18} className="flex-shrink-0 opacity-70" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-slate-700/60">
        <Link
          href="/health"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800/70 transition-colors"
        >
          <ArrowLeft size={16} className="flex-shrink-0" />
          <span>Back to Site</span>
        </Link>
      </div>
    </aside>
  );
}

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
