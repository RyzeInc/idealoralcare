'use client';

import Link from "next/link";
import { ArrowRight, Users, FileUp, BarChart3, AlertCircle, Gift, Activity, Clock, Mail, FileX, UserX, Bell, CreditCard, CheckCircle2, AlertTriangle, Circle, Wallet, RefreshCw, Search } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useEffect } from "react";
import { SkeletonText, SkeletonCard } from "@/components/admin/ui";
import { formatDate } from "@/lib/admin-format";

export default function AdminDashboard() {
  const grantAccess = useMutation(api.admin.grantFreeAccess.grantMeFullAccess);
  const [isGranting, setIsGranting] = useState(false);
  const [grantStatus, setGrantStatus] = useState<null | { success: boolean; message: string }>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<null | { success: boolean; message: string }>(null);

  const stats = useQuery(api.admin.members.getDashboardStats);
  const billingGroups = useQuery(api.admin.billing.getAllGroupBillingSummaries) || [];
  const recentActivity = useQuery(api.admin.members.getRecentActivity, { limit: 10 });
  const alerts = useQuery(api.admin.members.getAdminAlerts);
  const systemHealth = useQuery(api.admin.members.getSystemHealth);

  const totalBilling = billingGroups.reduce((sum: number, g: any) => sum + g.totalAmount, 0);

  const handleGrantAccess = async () => {
    setIsGranting(true);
    setGrantStatus(null);
    try {
      const result = await grantAccess({ durationDays: 365 });
      setGrantStatus({ success: true, message: result.message });
    } catch (error) {
      setGrantStatus({ success: false, message: `Error: ${error instanceof Error ? error.message : "Failed"}` });
    } finally {
      setIsGranting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-1">Admin Dashboard</h1>
        <p className="text-slate-500">Manage brokers, organizations, and member data</p>
      </div>

      {/* Alert Feed */}
      {alerts && alerts.total > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell size={18} className="text-amber-600" />
            <h2 className="text-sm font-semibold text-amber-900">
              {alerts.total} Action{alerts.total !== 1 ? "s" : ""} Required
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {alerts.unreadContacts > 0 && (
              <AlertItem icon={<Mail size={16} className="text-amber-600" />} label="Unread Contacts" count={alerts.unreadContacts} href="/admin/settings?tab=contacts" />
            )}
            {alerts.newInquiries > 0 && (
              <AlertItem icon={<Bell size={16} className="text-blue-600" />} label="New Inquiries" count={alerts.newInquiries} href="/admin/settings?tab=inquiries" />
            )}
            {alerts.failedEligibilityFiles > 0 && (
              <AlertItem icon={<FileX size={16} className="text-red-600" />} label="Failed Files" count={alerts.failedEligibilityFiles} href="/admin/eligibility" />
            )}
            {alerts.stuckEnrollments > 0 && (
              <AlertItem icon={<UserX size={16} className="text-orange-600" />} label="Stuck Enrollments" count={alerts.stuckEnrollments} href="/admin/members" />
            )}
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
        {stats === undefined ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard
              title="Paying Subscribers"
              value={stats?.payingSubscribers?.toString() ?? "—"}
              subtitle={stats ? `${stats.totalBundles} total subscriptions` : undefined}
              icon={<CreditCard size={22} className="text-emerald-600" />}
              href="/admin/billing"
              color="emerald"
            />
            <StatCard
              title="Active Members"
              value={stats?.activeMembers?.toString() ?? "—"}
              subtitle={stats ? `${stats.totalMembers} total members` : undefined}
              icon={<Users size={22} className="text-blue-600" />}
              href="/admin/members"
              color="blue"
            />
            <StatCard
              title="Monthly Revenue"
              value={stats?.monthlyRevenueCents != null ? `$${(stats.monthlyRevenueCents / 100).toFixed(2)}` : totalBilling > 0 ? `$${totalBilling.toFixed(2)}` : "—"}
              icon={<Wallet size={22} className="text-violet-600" />}
              href="/admin/billing"
              color="violet"
            />
            <StatCard
              title="Pending Enrollments"
              value={stats?.pendingEnrollments?.toString() ?? "—"}
              icon={<AlertCircle size={22} className="text-amber-600" />}
              href="/admin/members"
              color="amber"
            />
            <StatCard
              title="Eligibility Files"
              value={stats?.eligibilityFiles?.toString() ?? "—"}
              icon={<FileUp size={22} className="text-slate-600" />}
              href="/admin/eligibility"
              color="slate"
            />
          </>
        )}
      </div>

      {/* Quick Eligibility Check */}
      <QuickEligibilityCheckWidget />

      {/* System Health */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">System Health</h2>
          <p className="text-xs text-slate-400 mt-0.5">Real-time status of platform features</p>
        </div>
        {!systemHealth ? (
          <div className="px-6 py-6"><SkeletonText lines={3} /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-slate-100">
            <HealthCard
              title="Stripe Subscriptions"
              status={systemHealth.stripe.status as "ok" | "warning" | "idle"}
              label={systemHealth.stripe.label}
              details={[
                `${systemHealth.stripe.activePaidSubscriptions} paid active`,
                `${systemHealth.stripe.totalSubscriptions} total bundles`,
                systemHealth.stripe.failedPayments > 0
                  ? `${systemHealth.stripe.failedPayments} failed/past due`
                  : undefined,
              ]}
              href="/admin/billing"
            />
            <HealthCard
              title="Enrollment Pipeline"
              status={systemHealth.enrollment.status as "ok" | "warning" | "idle"}
              label={systemHealth.enrollment.label}
              details={[
                `${systemHealth.enrollment.completed} completed`,
                `${systemHealth.enrollment.inProgress} in progress`,
                `${systemHealth.enrollment.abandoned} abandoned/expired`,
              ]}
              href="/admin/members"
            />
            <HealthCard
              title="Eligibility Processing"
              status={systemHealth.eligibility.status as "ok" | "warning" | "idle"}
              label={systemHealth.eligibility.label}
              details={[
                `${systemHealth.eligibility.completedFiles} completed`,
                `${systemHealth.eligibility.recentUploads} uploaded this week`,
                systemHealth.eligibility.failedFiles > 0
                  ? `${systemHealth.eligibility.failedFiles} failed`
                  : undefined,
              ]}
              href="/admin/eligibility"
            />
            <HealthCard
              title="Contact & Newsletter"
              status={systemHealth.contacts.status as "ok" | "warning" | "idle"}
              label={systemHealth.contacts.label}
              details={[
                `${systemHealth.contacts.totalSubmissions} contact submissions`,
                `${systemHealth.contacts.newsletterSubscribers} newsletter subscribers`,
              ]}
              href="/admin/settings?tab=contacts"
            />
            <HealthCard
              title="Member Profiles"
              status={systemHealth.members.status as "ok" | "warning" | "idle"}
              label={systemHealth.members.label}
              details={[
                `${systemHealth.members.linked} linked to user accounts`,
                `${systemHealth.members.unlinked} unlinked (eligibility-only)`,
              ]}
              href="/admin/members"
            />
            <div className="bg-white px-5 py-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity size={16} className="text-slate-400" />
                <p className="text-sm font-medium text-slate-700">Last Activity</p>
              </div>
              <p className="text-xs text-slate-500">
                {systemHealth.lastActivityAt
                  ? formatTimeAgo(systemHealth.lastActivityAt)
                  : "No activity recorded"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">Quick Actions</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-100">
          <button onClick={handleGrantAccess} disabled={isGranting} className="bg-white px-6 py-4 hover:bg-emerald-50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">Grant Free Access</p>
                <p className="text-sm text-slate-500 mt-0.5">Enable all plans for this admin account</p>
              </div>
              <Gift size={16} className="text-emerald-500 flex-shrink-0" />
            </div>
          </button>
          <button onClick={async () => {
            setIsSyncing(true);
            setSyncStatus(null);
            try {
              const res = await fetch("/api/stripe/sync", { method: "POST" });
              const data = await res.json();
              if (res.ok) {
                setSyncStatus({ success: true, message: data.message });
              } else {
                setSyncStatus({ success: false, message: data.error || "Sync failed" });
              }
            } catch (error) {
              setSyncStatus({ success: false, message: `Error: ${error instanceof Error ? error.message : "Failed"}` });
            } finally {
              setIsSyncing(false);
            }
          }} disabled={isSyncing} className="bg-white px-6 py-4 hover:bg-blue-50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">Sync Stripe Subscriptions</p>
                <p className="text-sm text-slate-500 mt-0.5">{isSyncing ? "Syncing..." : "Reconcile active Stripe subs with member data"}</p>
              </div>
              <RefreshCw size={16} className={`text-blue-500 flex-shrink-0 ${isSyncing ? "animate-spin" : ""}`} />
            </div>
          </button>
          <QuickAction label="Create New Group" description="Set up a new enrollment group" href="/admin/hierarchy" />
          <QuickAction label="Upload Eligibility File" description="Batch import member records" href="/admin/eligibility" />
          <QuickAction label="View Billing Summary" description="Monthly member counts & amounts" href="/admin/billing" />
        </div>
        {grantStatus && (
          <div className={`px-6 py-3 border-t border-slate-100 text-sm font-medium ${grantStatus.success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
            {grantStatus.message}
          </div>
        )}
        {syncStatus && (
          <div className={`px-6 py-3 border-t border-slate-100 text-sm font-medium ${syncStatus.success ? "bg-blue-50 text-blue-700" : "bg-red-50 text-red-700"}`}>
            {syncStatus.message}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">Recent Activity</h2>
        </div>
        {!recentActivity || recentActivity.length === 0 ? (
          <div className="px-6 py-10 text-center"><p className="text-slate-400 text-sm">No activity recorded yet</p></div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentActivity.map((activity: any) => (
              <div key={activity._id} className="px-6 py-3 flex items-start gap-3">
                <div className="mt-0.5"><Activity size={14} className="text-slate-400" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{activity.title}</p>
                  {activity.description && <p className="text-xs text-slate-500 truncate">{activity.description}</p>}
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-1 flex-shrink-0">
                  <Clock size={12} />
                  {formatDate(activity.createdAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? "s" : ""} ago`;
}

function QuickEligibilityCheckWidget() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  // Debounce input — wait 300ms after typing stops before querying
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const results = useQuery(
    api.admin.members.quickEligibilityCheck,
    debounced.length >= 2 ? { query: debounced } : "skip"
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Quick Eligibility Check</h2>
          <p className="text-xs text-slate-500 mt-0.5">Look up any member by name, email, or member ID</p>
        </div>
        <Link href="/admin/members" className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
          Browse all members <ArrowRight size={12} />
        </Link>
      </div>
      <div className="p-6">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a name, email, or member ID…"
            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {debounced.length >= 2 && (
          <div className="mt-4">
            {results === undefined ? (
              <p className="text-sm text-slate-400">Searching…</p>
            ) : results.length === 0 ? (
              <p className="text-sm text-slate-500">No members match &quot;{debounced}&quot;</p>
            ) : (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Name</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Email</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Member ID</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Group</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Status</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Effective</th>
                      <th className="px-3 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {results.map((m: any) => (
                      <tr key={m._id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-900 font-medium">{m.firstName} {m.lastName}</td>
                        <td className="px-3 py-2 text-slate-600 font-mono text-xs">{m.email || "—"}</td>
                        <td className="px-3 py-2 text-slate-600 font-mono text-xs">{m.memberId}</td>
                        <td className="px-3 py-2 text-slate-600 text-xs">
                          {m.group ? <><span className="font-mono">[{m.group.groupCode}]</span> {m.group.name}</> : "—"}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${eligibilityStatusColor(m.status)}`}>
                            {m.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-600 font-mono text-xs">{m.effectiveDate || "—"}</td>
                        <td className="px-3 py-2">
                          <Link href={`/admin/members?id=${m._id}`} className="text-blue-600 hover:text-blue-700">
                            <ArrowRight size={14} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {results.length === 25 && (
                  <p className="text-xs text-slate-500 px-3 py-2 bg-slate-50 border-t border-slate-200">
                    Showing first 25 matches. Refine your search to narrow results.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function eligibilityStatusColor(status: string): string {
  switch (status) {
    case "active": return "bg-green-100 text-green-800";
    case "eligible":
    case "enrolling": return "bg-blue-100 text-blue-800";
    case "terminated": return "bg-red-100 text-red-800";
    case "suspended": return "bg-amber-100 text-amber-800";
    default: return "bg-slate-100 text-slate-700";
  }
}

function HealthCard({ title, status, label, details, href }: {
  title: string;
  status: "ok" | "warning" | "idle";
  label: string;
  details: (string | undefined)[];
  href: string;
}) {
  const statusIcon = status === "ok"
    ? <CheckCircle2 size={16} className="text-emerald-500" />
    : status === "warning"
      ? <AlertTriangle size={16} className="text-amber-500" />
      : <Circle size={16} className="text-slate-300" />;

  const statusBg = status === "ok"
    ? "bg-emerald-50 text-emerald-700"
    : status === "warning"
      ? "bg-amber-50 text-amber-700"
      : "bg-slate-50 text-slate-500";

  return (
    <Link href={href} className="bg-white px-5 py-4 hover:bg-slate-50 transition-colors block">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-slate-700">{title}</p>
        {statusIcon}
      </div>
      <p className={`text-xs font-medium px-2 py-0.5 rounded-full inline-block mb-2 ${statusBg}`}>
        {status === "ok" ? "Operational" : status === "warning" ? "Needs Attention" : "Idle"}
      </p>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <ul className="space-y-0.5">
        {details.filter(Boolean).map((d, i) => (
          <li key={i} className="text-[11px] text-slate-400">{d}</li>
        ))}
      </ul>
    </Link>
  );
}

function AlertItem({ icon, label, count, href }: { icon: React.ReactNode; label: string; count: number; href: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 hover:bg-amber-100 transition-colors border border-amber-200">
      {icon}
      <div className="min-w-0">
        <p className="text-xs text-slate-600 truncate">{label}</p>
        <p className="text-sm font-bold text-slate-900">{count}</p>
      </div>
    </Link>
  );
}

function StatCard({ title, value, subtitle, icon, href, color: _ }: { title: string; value: string; subtitle?: string; icon: React.ReactNode; href: string; color: string }) {
  return (
    <Link href={href}>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group">
        <div className="flex items-start justify-between mb-3">
          <div className="p-2 rounded-lg bg-slate-50 group-hover:bg-slate-100 transition-colors">{icon}</div>
        </div>
        <p className="text-sm text-slate-500 mb-1">{title}</p>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
      </div>
    </Link>
  );
}

function QuickAction({ label, description, href }: { label: string; description: string; href: string }) {
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
