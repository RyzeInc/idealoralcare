'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  DollarSign,
  ArrowLeft,
  ShieldCheck,
  Network,
  Tag,
  FileOutput,
  Settings,
  BarChart3,
  Headphones,
  Receipt,
} from "lucide-react";

type NavItem = { label: string; href: string; icon: typeof LayoutDashboard };
type NavSection = { section: string; items: NavItem[] };

const ADMIN_NAVIGATION: NavSection[] = [
  {
    section: "Overview",
    items: [
      { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
    ],
  },
  {
    section: "Members & Partners",
    items: [
      { label: "Members", href: "/admin/members", icon: Users },
      { label: "Distribution", href: "/admin/brokers", icon: Network },
      { label: "Rep Codes", href: "/admin/rep-codes", icon: Tag },
    ],
  },
  {
    section: "Operations",
    items: [
      { label: "Sites & Accounts", href: "/admin/hierarchy", icon: Building2 },
      { label: "Eligibility Files", href: "/admin/eligibility", icon: FileText },
      { label: "Vendor Files", href: "/admin/vendor-files", icon: FileOutput },
    ],
  },
  {
    section: "Finance",
    items: [
      { label: "Billing", href: "/admin/billing", icon: DollarSign },
      { label: "List-Bill", href: "/admin/list-bill", icon: Receipt },
      { label: "Commissions", href: "/admin/commissions", icon: BarChart3 },
    ],
  },
  {
    section: "Support",
    items: [
      { label: "Customer Service", href: "/admin/customer-service", icon: Headphones },
    ],
  },
  {
    section: "System",
    items: [
      { label: "Admin Users", href: "/admin/users", icon: ShieldCheck },
      { label: "Site Settings", href: "/admin/settings", icon: Settings },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  return (
    <aside className="w-64 min-h-screen bg-slate-900 text-white flex flex-col flex-shrink-0">
      {/* Brand */}
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
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {ADMIN_NAVIGATION.map((section, idx) => (
          <div key={section.section} className={idx > 0 ? "mt-5" : ""}>
            {section.section !== "Overview" && (
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {section.section}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      active
                        ? "bg-blue-600 text-white font-medium"
                        : "text-slate-300 hover:text-white hover:bg-slate-800/70"
                    }`}
                  >
                    <Icon size={18} className={`flex-shrink-0 ${active ? "opacity-100" : "opacity-70"}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
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
