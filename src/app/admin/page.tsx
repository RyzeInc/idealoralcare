'use client';

import Link from "next/link";
import { ArrowRight, Users, FileUp, BarChart3, AlertCircle, Gift } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";

export default function AdminDashboard() {
  const grantAccess = useMutation(api.admin.grantFreeAccess.grantMeFullAccess);
  const [isGranting, setIsGranting] = useState(false);
  const [grantStatus, setGrantStatus] = useState<null | { success: boolean; message: string }>(null);

  const handleGrantAccess = async () => {
    setIsGranting(true);
    setGrantStatus(null);
    try {
      const result = await grantAccess({ durationDays: 365 });
      setGrantStatus({ success: true, message: result.message });
    } catch (error) {
      setGrantStatus({
        success: false,
        message: `Error: ${error instanceof Error ? error.message : "Failed to grant access"}`,
      });
    } finally {
      setIsGranting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-1">Admin Dashboard</h1>
        <p className="text-slate-500">Manage sites, accounts, groups, and member data</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Active Members"
          value="—"
          icon={<Users size={22} className="text-blue-600" />}
          href="/admin/members"
          color="blue"
        />
        <StatCard
          title="Pending Enrollments"
          value="—"
          icon={<AlertCircle size={22} className="text-amber-600" />}
          href="/admin/members"
          color="amber"
        />
        <StatCard
          title="Eligibility Files"
          value="—"
          icon={<FileUp size={22} className="text-emerald-600" />}
          href="/admin/eligibility"
          color="emerald"
        />
        <StatCard
          title="Monthly Billing"
          value="—"
          icon={<BarChart3 size={22} className="text-violet-600" />}
          href="/admin/billing"
          color="violet"
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">Quick Actions</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-100">
          <button
            onClick={handleGrantAccess}
            disabled={isGranting}
            className="bg-white px-6 py-4 hover:bg-emerald-50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">Grant Free Access</p>
                <p className="text-sm text-slate-500 mt-0.5">Enable all plans for this admin account</p>
              </div>
              <Gift size={16} className="text-emerald-500 flex-shrink-0" />
            </div>
          </button>
          <QuickAction
            label="Create New Group"
            description="Set up a new enrollment group"
            href="/admin/hierarchy"
          />
          <QuickAction
            label="Upload Eligibility File"
            description="Batch import member records"
            href="/admin/eligibility"
          />
          <QuickAction
            label="View Billing Summary"
            description="Monthly member counts & amounts"
            href="/admin/billing"
          />
        </div>
        {grantStatus && (
          <div
            className={`px-6 py-3 border-t border-slate-100 text-sm font-medium ${
              grantStatus.success
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {grantStatus.message}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">Recent Activity</h2>
        </div>
        <div className="px-6 py-10 text-center">
          <p className="text-slate-400 text-sm">Activity log coming soon</p>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  href,
  color,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  href: string;
  color: string;
}) {
  return (
    <Link href={href}>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group">
        <div className="flex items-start justify-between mb-3">
          <div className="p-2 rounded-lg bg-slate-50 group-hover:bg-slate-100 transition-colors">
            {icon}
          </div>
        </div>
        <p className="text-sm text-slate-500 mb-1">{title}</p>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
      </div>
    </Link>
  );
}

function QuickAction({
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
      <div className="bg-white px-6 py-4 hover:bg-slate-50 transition-colors cursor-pointer group">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-slate-900">{label}</p>
            <p className="text-sm text-slate-500 mt-0.5">{description}</p>
          </div>
          <ArrowRight size={16} className="text-slate-300 group-hover:text-slate-500 transition-colors flex-shrink-0" />
        </div>
      </div>
    </Link>
  );
}
