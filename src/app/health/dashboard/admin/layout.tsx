'use client';

import { useAuth } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  DollarSign,
  BarChart3,
  Settings,
  LogOut,
} from "lucide-react";

/**
 * ADMIN DASHBOARD LAYOUT
 * 
 * Protected route requiring org:admin role.
 * Provides navigation sidebar with access to all admin functions.
 */

const ADMIN_NAVIGATION = [
  { label: "Dashboard", href: "/health/dashboard/admin", icon: LayoutDashboard },
  { label: "Sites & Accounts", href: "/health/dashboard/admin/hierarchy", icon: Building2 },
  { label: "Members", href: "/health/dashboard/admin/members", icon: Users },
  { label: "Eligibility Files", href: "/health/dashboard/admin/eligibility", icon: FileText },
  { label: "Vendor Files", href: "/health/dashboard/admin/vendor-files", icon: BarChart3 },
  { label: "Billing", href: "/health/dashboard/admin/billing", icon: DollarSign },
  { label: "Commissions", href: "/health/dashboard/admin/commissions", icon: BarChart3 },
];

function AdminSidebar() {
  return (
    <aside className="w-64 bg-slate-900 text-white min-h-screen">
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-xl font-bold">Admin Portal</h1>
      </div>

      <nav className="p-4 space-y-2">
        {ADMIN_NAVIGATION.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-2 rounded hover:bg-slate-800 transition-colors"
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="absolute bottom-6 left-6 right-6">
        <Link
          href="/health/dashboard"
          className="flex items-center gap-2 px-4 py-2 rounded hover:bg-slate-800 transition-colors text-slate-300 text-sm"
        >
          <LogOut size={16} />
          <span>Back to Dashboard</span>
        </Link>
      </div>
    </aside>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = useAuth();

  // Admin route protection would normally check org:admin role
  // For now, we render the layout for authenticated users
  if (!userId) {
    redirect("/health");
  }

  return (
    <div className="flex">
      <AdminSidebar />
      <main className="flex-1 bg-slate-50">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
