'use client';

import { useQuery } from "convex/react";
import { api } from '../../../../../convex/_generated/api';
import Link from "next/link";
import { ArrowRight, Users, FileUp, BarChart3, AlertCircle } from "lucide-react";

/**
 * ADMIN DASHBOARD OVERVIEW
 * 
 * Summary cards and quick actions for admin functions
 */

export default function AdminDashboard() {
  // Placeholder queries - in production, would aggregate data across all groups/sites
  // const activeMembersQuery = useQuery(api.admin.members.getActiveMembersBySite, { siteId: "..." });
  // const pendingEnrollmentsQuery = useQuery(api.admin.members.getMembersByStatus, { groupId: "...", memberType: "enrolling" });
  // const eligibilityStatsQuery = useQuery(api.admin.eligibility.getEligibilityStats, { groupId: "..." });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Admin Dashboard</h1>
        <p className="text-slate-600">Manage sites, accounts, groups, and member data</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <CardWithStat
          title="Active Members"
          value="—"
          icon={<Users className="text-blue-600" />}
          href="/health/dashboard/admin/members"
        />
        <CardWithStat
          title="Pending Enrollments"
          value="—"
          icon={<AlertCircle className="text-orange-600" />}
          href="/health/dashboard/admin/members"
        />
        <CardWithStat
          title="Eligibility Files"
          value="—"
          icon={<FileUp className="text-green-600" />}
          href="/health/dashboard/admin/eligibility"
        />
        <CardWithStat
          title="Monthly Billing"
          value="—"
          icon={<BarChart3 className="text-purple-600" />}
          href="/health/dashboard/admin/billing"
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <QuickActionButton
            label="Create New Group"
            description="Set up a new enrollment group"
            href="/health/dashboard/admin/hierarchy"
          />
          <QuickActionButton
            label="Upload Eligibility File"
            description="Batch import member records"
            href="/health/dashboard/admin/eligibility"
          />
          <QuickActionButton
            label="Generate Vendor Files"
            description="Create Careington & Dial Care feeds"
            href="/health/dashboard/admin/vendor-files"
          />
          <QuickActionButton
            label="View Billing Summary"
            description="Monthly member counts & amounts"
            href="/health/dashboard/admin/billing"
          />
        </div>
      </div>

      {/* Recent Activity Placeholder */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
        <p className="text-slate-500 text-sm">Activity log coming soon</p>
      </div>
    </div>
  );
}

function CardWithStat({
  title,
  value,
  icon,
  href,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  href: string;
}) {
  return (
    <Link href={href}>
      <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-slate-600 text-sm">{title}</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">{value}</p>
          </div>
          <div className="text-4xl">{icon}</div>
        </div>
      </div>
    </Link>
  );
}

function QuickActionButton({
  label,
  description,
  href,
}: {
  label: string;
  description: string;
  href: string;
}) {
  return (
    <Link href={href}>
      <div className="p-4 border border-slate-200 rounded-lg hover:border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold text-slate-900">{label}</p>
            <p className="text-slate-600 text-sm">{description}</p>
          </div>
          <ArrowRight size={18} className="text-slate-400 flex-shrink-0" />
        </div>
      </div>
    </Link>
  );
}
