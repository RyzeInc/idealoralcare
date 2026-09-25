"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { UserButton } from "@clerk/nextjs";
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  RefreshCw,
  Network,
  Building2,
  BellRing,
  FolderOpen,
  ExternalLink,
} from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  tooltip: string;
  /** Hidden for reps, who have no downline. */
  requiresDownline?: boolean;
};

const NAV: NavItem[] = [
  { label: "Overview", href: "/partner", icon: LayoutDashboard, tooltip: "Your book at a glance." },
  { label: "Members", href: "/partner/members", icon: Users, tooltip: "Everyone you are credited for." },
  { label: "Production", href: "/partner/production", icon: TrendingUp, tooltip: "Funnel, sources, and follow-ups." },
  { label: "Retention", href: "/partner/retention", icon: RefreshCw, tooltip: "Cohorts, churn, and revenue movement." },
  { label: "Downline", href: "/partner/downline", icon: Network, tooltip: "Your agencies and reps.", requiresDownline: true },
  { label: "Groups", href: "/partner/groups", icon: Building2, tooltip: "Employer accounts and participation." },
  { label: "Watchlist", href: "/partner/watchlist", icon: BellRing, tooltip: "Things that need action today." },
  { label: "Resources", href: "/partner/resources", icon: FolderOpen, tooltip: "Marketing material, your partner kit, collateral, and forms." },
];

export function PartnerSidebar() {
  const pathname = usePathname();
  // The sidebar renders outside the layout's ConvexAuthGate, so it has to
  // hold its own query back until the JWT has reached Convex.
  const { isAuthenticated } = useConvexAuth();
  const scope = useQuery(api.insights.scope.getMyScope, isAuthenticated ? {} : "skip");

  const isActive = (href: string) =>
    href === "/partner" ? pathname === "/partner" : pathname?.startsWith(href);

  // Reps have no downline; hide the tab rather than showing them an empty tree.
  const visible = NAV.filter((item) => !item.requiresDownline || scope?.canSeeDownline);

  return (
    <aside className="w-60 min-h-screen bg-slate-900 text-white flex flex-col shrink-0">
      <div className="px-5 py-5 border-b border-slate-800">
        <p className="text-sm font-semibold">Partner Portal</p>
        <p className="text-xs text-slate-400 mt-0.5 truncate" title={scope?.label ?? ""}>
          {scope?.label ?? "…"}
        </p>
        {scope?.partnerType && (
          <span className="inline-block mt-2 text-[10px] uppercase tracking-wide bg-slate-800 text-slate-300 rounded px-1.5 py-0.5">
            {scope.partnerType.replace(/_/g, " ")}
          </span>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5" aria-label="Partner navigation">
        {visible.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.tooltip}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-blue-600 text-white font-medium"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Icon size={17} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-slate-800 space-y-2">
        <Link
          href="/health"
          className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ExternalLink size={14} />
          Main site
        </Link>
        <div className="px-3">
          <UserButton afterSignOutUrl="/health" />
        </div>
      </div>
    </aside>
  );
}
