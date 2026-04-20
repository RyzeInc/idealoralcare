'use client';

import { useState, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import {
  Search,
  Loader,
  Calendar,
  ShieldCheck,
  ShieldAlert,
  LayoutDashboard,
  XCircle,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Filter,
  Users,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Package,
  User,
  ScanLine,
  Building2,
  Clock,
  DollarSign,
} from 'lucide-react';

interface ClerkUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  imageUrl?: string;
  createdAt: number;
}

type StatusFilter = 'all' | 'no-dashboard' | 'no-admin' | 'has-both' | 'has-neither';

const PAGE_SIZE = 50;

export default function UserAuditPage() {
  const { user } = useUser();
  const clerkUserId = user?.id ?? '';
  const adminProfile = useQuery(api.admin.adminUsers.getByClerkId, clerkUserId ? { clerkUserId } : 'skip');

  // Date range state
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Fetched users
  const [clerkUsers, setClerkUsers] = useState<ClerkUser[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Status filter
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Expanded user detail
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  // Convex statuses — keyed by clerk ID
  const clerkIds = clerkUsers.map((u) => u.id);
  const statuses = useQuery(
    api.admin.userAudit.getUserStatuses,
    clerkIds.length > 0 ? { clerkUserIds: clerkIds } : 'skip'
  );

  const fetchUsers = useCallback(async (newOffset: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(newOffset));
      if (dateFrom) {
        params.set('created_after', String(new Date(dateFrom).getTime()));
      }
      if (dateTo) {
        // End of selected day
        params.set('created_before', String(new Date(dateTo + 'T23:59:59').getTime()));
      }

      const res = await fetch(`/api/clerk/users?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setClerkUsers(data.users || []);
      setTotalCount(data.total || 0);
      setOffset(newOffset);
      setLoaded(true);
    } catch {
      setClerkUsers([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  const handleSearch = () => {
    setOffset(0);
    fetchUsers(0);
  };

  // Filter users based on status
  const filteredUsers = clerkUsers.filter((u) => {
    if (!statuses || statusFilter === 'all') return true;
    const s = statuses[u.id];
    if (!s) {
      // No status means no dashboard, no admin
      return statusFilter === 'has-neither' || statusFilter === 'no-dashboard' || statusFilter === 'no-admin';
    }
    switch (statusFilter) {
      case 'no-dashboard': return !s.hasDashboard;
      case 'no-admin': return !s.isAdmin;
      case 'has-both': return s.hasDashboard && s.isAdmin;
      case 'has-neither': return !s.hasDashboard && !s.isAdmin;
      default: return true;
    }
  });

  // Count discrepancies
  const discrepancyCount = statuses
    ? clerkUsers.filter((u) => {
        const s = statuses[u.id];
        return !s || !s.hasDashboard;
      }).length
    : 0;

  // Gate to owner
  if (!adminProfile || adminProfile.role !== 'owner') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <ShieldAlert size={48} className="mx-auto text-red-400 mb-4" />
          <h2 className="text-xl font-bold text-slate-900">Owner Access Required</h2>
          <p className="text-slate-500 mt-2">This page is restricted to owners.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
          <Users size={24} />
          User Audit
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          View all Clerk users and check their dashboard &amp; admin access status.
        </p>
      </div>

      {/* Date Range & Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              <Calendar size={12} className="inline mr-1" />
              Created After
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              <Calendar size={12} className="inline mr-1" />
              Created Before
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
          >
            {loading ? <Loader size={14} className="animate-spin" /> : <Search size={14} />}
            {loaded ? 'Refresh' : 'Load Users'}
          </button>
          {dateFrom || dateTo ? (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
            >
              <XCircle size={14} /> Clear dates
            </button>
          ) : null}
        </div>
      </div>

      {/* Results */}
      {loaded && (
        <>
          {/* Summary Bar */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="text-sm text-slate-600">
              <strong>{totalCount}</strong> total Clerk users
              {(dateFrom || dateTo) && ' (in date range)'}
            </div>
            {statuses && discrepancyCount > 0 && (
              <div className="flex items-center gap-1.5 text-sm text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
                <AlertTriangle size={14} />
                <strong>{discrepancyCount}</strong> without dashboard access
              </div>
            )}

            {/* Status Filter */}
            <div className="ml-auto flex items-center gap-2">
              <Filter size={14} className="text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Users</option>
                <option value="no-dashboard">No Dashboard Access</option>
                <option value="no-admin">No Admin Access</option>
                <option value="has-both">Has Both</option>
                <option value="has-neither">Has Neither</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase w-8"></th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">User</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Clerk ID</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Created</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase text-center">Dashboard</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase text-center">Admin</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Subscription</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                        {loading ? 'Loading...' : 'No users match the current filter.'}
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const s = statuses?.[u.id];
                      const isExpanded = expandedUserId === u.id;
                      return (
                        <UserRow
                          key={u.id}
                          user={u}
                          status={s}
                          statusesLoaded={!!statuses}
                          isExpanded={isExpanded}
                          onToggle={() => setExpandedUserId(isExpanded ? null : u.id)}
                        />
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalCount > PAGE_SIZE && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, totalCount)} of {totalCount}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchUsers(Math.max(0, offset - PAGE_SIZE))}
                  disabled={offset === 0 || loading}
                  className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 disabled:opacity-30 px-3 py-1.5 border border-slate-300 rounded-lg"
                >
                  <ChevronLeft size={14} /> Previous
                </button>
                <button
                  onClick={() => fetchUsers(offset + PAGE_SIZE)}
                  disabled={offset + PAGE_SIZE >= totalCount || loading}
                  className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 disabled:opacity-30 px-3 py-1.5 border border-slate-300 rounded-lg"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!loaded && !loading && (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <Users size={40} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-1">Ready to Audit</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Optionally pick a date range, then click <strong>Load Users</strong> to pull all Clerk users
            and cross-reference their dashboard &amp; admin access.
          </p>
        </div>
      )}
    </div>
  );
}

function SubscriptionBadge({ status, entitlements }: { status: string; entitlements: number }) {
  const styles: Record<string, string> = {
    active: 'text-green-700 bg-green-50',
    cancel_at_period_end: 'text-amber-700 bg-amber-50',
    cancelled: 'text-red-600 bg-red-50',
    payment_failed: 'text-red-600 bg-red-50',
    past_due: 'text-orange-600 bg-orange-50',
    suspended: 'text-slate-600 bg-slate-100',
    draft: 'text-slate-500 bg-slate-50',
  };
  const labels: Record<string, string> = {
    active: 'Active',
    cancel_at_period_end: 'Canceling',
    cancelled: 'Cancelled',
    payment_failed: 'Failed',
    past_due: 'Past Due',
    suspended: 'Suspended',
    draft: 'Draft',
  };
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${styles[status] || 'text-slate-500 bg-slate-50'}`}>
        {labels[status] || status}
      </span>
      {entitlements > 0 && (
        <span className="text-xs text-slate-400">{entitlements} plan{entitlements !== 1 ? 's' : ''}</span>
      )}
    </div>
  );
}

// ─── Clickable Row + Expandable Detail ────────────────────────────────

interface UserRowProps {
  user: ClerkUser;
  status?: { isAdmin: boolean; adminRole?: string; hasDashboard: boolean; subscriptionStatus?: string; entitlementCount: number };
  statusesLoaded: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}

function UserRow({ user: u, status: s, statusesLoaded, isExpanded, onToggle }: UserRowProps) {
  return (
    <>
      <tr onClick={onToggle} className="hover:bg-slate-50/50 transition-colors cursor-pointer">
        {/* Expand chevron */}
        <td className="px-4 py-3 text-slate-400">
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </td>
        {/* User */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2.5">
            {u.imageUrl ? (
              <img src={u.imageUrl} alt="" className="w-7 h-7 rounded-full" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">
                {(u.name || u.email).charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{u.name || '—'}</p>
              <p className="text-xs text-slate-500 truncate">{u.email}</p>
            </div>
          </div>
        </td>
        {/* Clerk ID */}
        <td className="px-4 py-3">
          <code className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-mono">
            {u.id}
          </code>
        </td>
        {/* Created */}
        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
          {new Date(u.createdAt).toLocaleDateString()}
        </td>
        {/* Dashboard Access */}
        <td className="px-4 py-3 text-center">
          {!statusesLoaded ? (
            <Loader size={14} className="animate-spin text-slate-300 mx-auto" />
          ) : s?.hasDashboard ? (
            <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium">
              <LayoutDashboard size={12} />
              Yes
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded-full font-medium">
              <XCircle size={12} />
              No
            </span>
          )}
        </td>
        {/* Admin Access */}
        <td className="px-4 py-3 text-center">
          {!statusesLoaded ? (
            <Loader size={14} className="animate-spin text-slate-300 mx-auto" />
          ) : s?.isAdmin ? (
            <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-medium">
              <ShieldCheck size={12} />
              {s.adminRole === 'owner' ? 'Owner' : 'Editor'}
            </span>
          ) : (
            <span className="text-xs text-slate-400">—</span>
          )}
        </td>
        {/* Subscription */}
        <td className="px-4 py-3">
          {!statusesLoaded ? (
            <Loader size={14} className="animate-spin text-slate-300" />
          ) : s?.subscriptionStatus ? (
            <SubscriptionBadge status={s.subscriptionStatus} entitlements={s.entitlementCount} />
          ) : (
            <span className="text-xs text-slate-400">None</span>
          )}
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={7} className="p-0">
            <UserDetailPanel clerkUserId={u.id} />
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────

function UserDetailPanel({ clerkUserId }: { clerkUserId: string }) {
  const detail = useQuery(api.admin.userAudit.getUserDetail, { clerkUserId });

  if (!detail) {
    return (
      <div className="bg-slate-50 px-8 py-6 flex items-center gap-2 text-sm text-slate-400">
        <Loader size={14} className="animate-spin" /> Loading details…
      </div>
    );
  }

  const fmt = (ms: number) => new Date(ms).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const fmtCents = (c: number) => `$${(c / 100).toFixed(2)}`;

  return (
    <div className="bg-slate-50 border-t border-slate-200 px-8 py-5 space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">

        {/* Admin Info */}
        <DetailCard
          icon={<ShieldCheck size={16} className="text-blue-500" />}
          title="Admin Access"
          empty={!detail.admin}
          emptyText="Not an admin"
        >
          {detail.admin && (
            <div className="space-y-1 text-sm">
              <Row label="Role" value={detail.admin.role} />
              <Row label="Departments" value={detail.admin.departments?.join(', ') || '—'} />
              <Row label="Admin Since" value={fmt(detail.admin.createdAt)} />
            </div>
          )}
        </DetailCard>

        {/* Subscription Bundle */}
        <DetailCard
          icon={<CreditCard size={16} className="text-green-500" />}
          title="Subscription Bundle"
          empty={!detail.bundle}
          emptyText="No subscription"
        >
          {detail.bundle && (
            <div className="space-y-1 text-sm">
              <Row label="Status" value={<SubscriptionBadge status={detail.bundle.status} entitlements={0} />} />
              <Row label="Cadence" value={detail.bundle.cadence} />
              <Row label="Payment" value={detail.bundle.paymentMethod} />
              <Row label="Total" value={fmtCents(detail.bundle.pricingSnapshot.totalCents)} />
              <Row label="Plans in Bundle" value={String(detail.bundle.pricingSnapshot.planCount)} />
              <Row label="Period" value={`${fmt(detail.bundle.currentPeriodStart)} → ${fmt(detail.bundle.currentPeriodEnd)}`} />
              {detail.bundle.stripeCustomerId && (
                <Row label="Stripe Customer" value={<code className="text-xs font-mono">{detail.bundle.stripeCustomerId}</code>} />
              )}
              {detail.bundle.stripeSubscriptionId && (
                <Row label="Stripe Sub" value={<code className="text-xs font-mono">{detail.bundle.stripeSubscriptionId}</code>} />
              )}
              {detail.bundle.cancelledAt && (
                <Row label="Cancelled" value={`${fmt(detail.bundle.cancelledAt)}${detail.bundle.cancellationReason ? ` — ${detail.bundle.cancellationReason}` : ''}`} />
              )}
            </div>
          )}
        </DetailCard>

        {/* Member Profiles */}
        <DetailCard
          icon={<User size={16} className="text-violet-500" />}
          title={`Member Profile${(detail.memberProfiles?.length ?? 0) > 1 ? 's' : ''}`}
          empty={!detail.memberProfiles?.length}
          emptyText="No member profile"
        >
          {detail.memberProfiles?.map((mp) => (
            <div key={mp._id} className="space-y-1 text-sm border-b border-slate-200 pb-2 last:border-b-0 last:pb-0 mb-2 last:mb-0">
              <Row label="Member ID" value={<code className="text-xs font-mono">{mp.memberId}</code>} />
              <Row label="Name" value={`${mp.firstName} ${mp.lastName}`} />
              <Row label="Type" value={mp.memberType} />
              <Row label="Role" value={mp.memberRole || '—'} />
              <Row label="Status" value={mp.status} />
              {mp.enrolledAt && <Row label="Enrolled" value={fmt(mp.enrolledAt)} />}
            </div>
          ))}
        </DetailCard>

        {/* Toothlens */}
        <DetailCard
          icon={<ScanLine size={16} className="text-teal-500" />}
          title="Toothlens / Oral Scan"
          empty={!detail.toothlens}
          emptyText="Not registered"
        >
          {detail.toothlens && (
            <div className="space-y-1 text-sm">
              <Row label="UID" value={<code className="text-xs font-mono">{detail.toothlens.toothlensUid}</code>} />
              <Row label="Company" value={detail.toothlens.company || '—'} />
              <Row label="Registered" value={fmt(detail.toothlens.createdAt)} />
            </div>
          )}
        </DetailCard>

        {/* Distribution Partner */}
        {detail.distributionPartner && (
          <DetailCard
            icon={<Building2 size={16} className="text-amber-500" />}
            title="Distribution Partner"
            empty={false}
          >
            <div className="space-y-1 text-sm">
              <Row label="Company" value={detail.distributionPartner.name || '—'} />
              <Row label="Type" value={detail.distributionPartner.type} />
              <Row label="Status" value={detail.distributionPartner.status} />
            </div>
          </DetailCard>
        )}
      </div>

      {/* Entitlements Table */}
      {detail.entitlements.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
            <Package size={14} />
            Entitlements ({detail.entitlements.length})
          </h4>
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200">
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Product</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Status</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">End Condition</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Period</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Created Via</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {detail.entitlements.map((ent) => {
                  const entStatusStyles: Record<string, string> = {
                    active: 'text-green-700 bg-green-50',
                    cancel_at_period_end: 'text-amber-700 bg-amber-50',
                    expired: 'text-slate-500 bg-slate-100',
                    suspended: 'text-orange-600 bg-orange-50',
                    revoked: 'text-red-600 bg-red-50',
                  };
                  return (
                    <tr key={ent._id} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2">
                        <span className="font-medium text-slate-900">{ent.productName}</span>
                        <span className="text-xs text-slate-400 ml-1.5">{ent.productCategory}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${entStatusStyles[ent.status] || 'text-slate-500 bg-slate-50'}`}>
                          {ent.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">{ent.endCondition}</td>
                      <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">
                        {fmt(ent.periodStart)} → {fmt(ent.periodEnd)}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">{ent.createdVia.replace(/_/g, ' ')}</td>
                      <td className="px-3 py-2 text-xs text-slate-400 max-w-[200px] truncate">{ent.notes || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shared UI Helpers ────────────────────────────────────────────────

function DetailCard({
  icon,
  title,
  empty,
  emptyText,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  empty: boolean;
  emptyText?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1.5">
        {icon} {title}
      </h4>
      {empty ? (
        <p className="text-sm text-slate-400 italic">{emptyText || 'None'}</p>
      ) : (
        children
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-slate-500 text-xs shrink-0">{label}</span>
      <span className="text-slate-900 text-xs text-right">{value}</span>
    </div>
  );
}
