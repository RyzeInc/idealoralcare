'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Breadcrumbs, StatusBadge } from '@/components/admin/ui';
import {
  Users, Search, AlertTriangle, CheckCircle2, ExternalLink,
  Loader, Filter, Download, ScanLine, ShieldCheck, CreditCard,
  Building2, Database, CloudOff, Layers, UserCheck,
  ChevronDown, ChevronUp, RefreshCw,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClerkUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  imageUrl?: string;
  createdAt: number;
}

type SystemPresence =
  | 'both-active'   // Clerk + Convex + active subscription
  | 'both'          // Clerk + Convex, no/unknown sub
  | 'both-no-sub'   // Clerk + Convex, explicitly no subscription
  | 'clerk-only'    // Clerk only, no Convex member profile
  | 'convex-only';  // Convex member profile, no Clerk account

type PresenceFilter = 'all' | SystemPresence | 'missing-census' | 'has-toothlens' | 'no-toothlens';

interface UnifiedUser {
  key: string;
  // Clerk
  clerkId?: string;
  clerkEmail?: string;
  clerkName?: string;
  clerkCreatedAt?: number;
  clerkImageUrl?: string;
  // Convex member
  memberId?: string;
  memberProfileId?: string;
  memberType?: string;
  memberFirstName?: string;
  memberLastName?: string;
  memberEmail?: string;
  memberDob?: string;
  memberEffective?: string;
  memberAddress?: { line1?: string; line2?: string; city?: string; state?: string; postalCode?: string };
  careingtonUniqueId?: string;
  careingtonSeqNum?: string;
  // Subscription
  subscriptionStatus?: string;
  entitlementCount?: number;
  // Toothlens
  hasToothlens: boolean;
  toothlensUid?: string;
  toothlensScans?: number;
  // Derived
  presence: SystemPresence;
  missingFields: string[];
}

// ─── Census validation ────────────────────────────────────────────────────────

const CENSUS_REQUIRED: { label: string; get: (u: UnifiedUser) => boolean }[] = [
  { label: 'First Name',     get: (u) => !!u.memberFirstName },
  { label: 'Last Name',      get: (u) => !!u.memberLastName },
  { label: 'Unique ID',      get: (u) => !!u.careingtonUniqueId },
  { label: 'Sequence #',     get: (u) => !!u.careingtonSeqNum },
  { label: 'Address',        get: (u) => !!u.memberAddress?.line1 },
  { label: 'City',           get: (u) => !!u.memberAddress?.city },
  { label: 'State',          get: (u) => !!u.memberAddress?.state },
  { label: 'Zip',            get: (u) => !!u.memberAddress?.postalCode },
  { label: 'Email',          get: (u) => !!(u.memberEmail || u.clerkEmail) },
  { label: 'Date of Birth',  get: (u) => !!u.memberDob },
  { label: 'Effective Date', get: (u) => !!u.memberEffective },
];

function getMissing(u: UnifiedUser): string[] {
  if (!u.memberProfileId) return [];
  return CENSUS_REQUIRED.filter((f) => !f.get(u)).map((f) => f.label);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(ms?: number | null) {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const PRESENCE_META: Record<SystemPresence, { label: string; color: string; bg: string }> = {
  'both-active':  { label: 'Active',          color: 'text-green-700',  bg: 'bg-green-50 border-green-200' },
  'both':         { label: 'Linked',           color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' },
  'both-no-sub':  { label: 'No Subscription',  color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200' },
  'clerk-only':   { label: 'Clerk Only',        color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  'convex-only':  { label: 'Convex Only',       color: 'text-slate-600',  bg: 'bg-slate-100 border-slate-300' },
};

function PresenceBadge({ presence }: { presence: SystemPresence }) {
  const m = PRESENCE_META[presence];
  return (
    <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded border ${m.color} ${m.bg}`}>
      {m.label}
    </span>
  );
}


// ─── Main page ────────────────────────────────────────────────────────────────

export default function UserAuditPage() {
  // ── Convex live data ────────────────────────────────────────────────────────
  const convexMembers = (useQuery(api.admin.members.getAllMembers, {}) ?? []) as any[];
  const toothlensRecords = (useQuery(api.admin.userAudit.getAllToothlensUserRecords) ?? []) as any[];

  // Only query subscription statuses for members that have a Clerk ID
  const clerkIdsInConvex = useMemo(
    () => convexMembers.filter((m) => m.customerId).map((m) => m.customerId as string),
    [convexMembers]
  );
  const subscriptionStatuses = (useQuery(
    api.admin.userAudit.getUserStatuses,
    clerkIdsInConvex.length > 0 ? { clerkUserIds: clerkIdsInConvex } : 'skip'
  ) ?? {}) as Record<string, any>;

  // ── Clerk users (fetched via API route) ─────────────────────────────────────
  const [clerkUsers, setClerkUsers] = useState<ClerkUser[]>([]);
  const [clerkLoading, setClerkLoading] = useState(true);
  const [clerkError, setClerkError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchAllClerk = async () => {
    setClerkLoading(true);
    setClerkError(null);
    try {
      const all: ClerkUser[] = [];
      for (let offset = 0; offset < 500; offset += 100) {
        const r = await fetch(`/api/clerk/users?limit=100&offset=${offset}`);
        if (!r.ok) throw new Error(`Clerk API ${r.status}`);
        const d = await r.json();
        const page: ClerkUser[] = d.users ?? [];
        all.push(...page);
        if (all.length >= (d.total ?? 0) || page.length < 100) break;
      }
      setClerkUsers(all);
      setLastRefreshed(new Date());
    } catch (e: any) {
      setClerkError(e?.message ?? 'Failed to load Clerk users');
    } finally {
      setClerkLoading(false);
    }
  };

  useEffect(() => { fetchAllClerk(); }, []);

  // ── Merge all three systems into one unified list ───────────────────────────
  const unified = useMemo<UnifiedUser[]>(() => {
    const clerkMap = new Map<string, ClerkUser>(clerkUsers.map((u) => [u.id, u]));
    const toothlensMap = new Map<string, any>(
      toothlensRecords.map((t) => [t.clerkUserId, t])
    );
    const matchedClerkIds = new Set<string>();
    const rows: UnifiedUser[] = [];

    // 1. Every Convex member profile
    for (const m of convexMembers) {
      const clerkId: string | undefined = m.customerId;
      const clerk = clerkId ? clerkMap.get(clerkId) : undefined;
      if (clerkId) matchedClerkIds.add(clerkId);

      const tl = clerkId ? toothlensMap.get(clerkId) : undefined;
      const sub = clerkId ? subscriptionStatuses[clerkId] : undefined;

      let presence: SystemPresence;
      if (!clerkId || !clerk) {
        presence = 'convex-only';
      } else if (sub?.hasDashboard || sub?.subscriptionStatus === 'active') {
        presence = 'both-active';
      } else if (sub?.subscriptionStatus) {
        presence = 'both-no-sub';
      } else {
        presence = 'both';
      }

      const row: UnifiedUser = {
        key: m._id,
        clerkId,
        clerkEmail: clerk?.email,
        clerkName: clerk?.name,
        clerkCreatedAt: clerk?.createdAt,
        clerkImageUrl: clerk?.imageUrl,
        memberId: m.memberId,
        memberProfileId: m._id,
        memberType: m.memberType,
        memberFirstName: m.firstName,
        memberLastName: m.lastName,
        memberEmail: m.email,
        memberDob: m.dateOfBirth,
        memberEffective: m.effectiveDate,
        memberAddress: m.address,
        careingtonUniqueId: m.careingtonUniqueId,
        careingtonSeqNum: m.careingtonSeqNum,
        hasToothlens: !!tl,
        toothlensUid: tl?.toothlensUid,
        toothlensScans: tl?.scanCount,
        subscriptionStatus: sub?.subscriptionStatus,
        entitlementCount: sub?.entitlementCount ?? 0,
        presence,
        missingFields: [],
      };
      row.missingFields = getMissing(row);
      rows.push(row);
    }

    // 2. Clerk users with NO matching Convex member profile
    for (const u of clerkUsers) {
      if (matchedClerkIds.has(u.id)) continue;
      const tl = toothlensMap.get(u.id);
      const sub = subscriptionStatuses[u.id];
      rows.push({
        key: u.id,
        clerkId: u.id,
        clerkEmail: u.email,
        clerkName: u.name,
        clerkCreatedAt: u.createdAt,
        clerkImageUrl: u.imageUrl,
        hasToothlens: !!tl,
        toothlensUid: tl?.toothlensUid,
        toothlensScans: tl?.scanCount,
        subscriptionStatus: sub?.subscriptionStatus,
        entitlementCount: sub?.entitlementCount ?? 0,
        presence: 'clerk-only',
        missingFields: [],
      });
    }

    return rows;
  }, [convexMembers, clerkUsers, toothlensRecords, subscriptionStatuses]);

  // ── Filters ──────────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [presenceFilter, setPresenceFilter] = useState<PresenceFilter>('all');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return unified.filter((u) => {
      if (q) {
        const name = `${u.memberFirstName ?? ''} ${u.memberLastName ?? ''} ${u.clerkName ?? ''}`.toLowerCase();
        const email = `${u.memberEmail ?? ''} ${u.clerkEmail ?? ''}`.toLowerCase();
        const ids = `${u.memberId ?? ''} ${u.clerkId ?? ''} ${u.careingtonUniqueId ?? ''}`.toLowerCase();
        if (!name.includes(q) && !email.includes(q) && !ids.includes(q)) return false;
      }
      if (presenceFilter === 'all') return true;
      if (presenceFilter === 'missing-census') return u.missingFields.length > 0;
      if (presenceFilter === 'has-toothlens') return u.hasToothlens;
      if (presenceFilter === 'no-toothlens') return !u.hasToothlens && !!u.memberProfileId;
      return u.presence === presenceFilter;
    });
  }, [unified, search, presenceFilter]);

  // ── Stats ─────────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total: unified.length,
    bothActive: unified.filter((u) => u.presence === 'both-active').length,
    clerkOnly: unified.filter((u) => u.presence === 'clerk-only').length,
    convexOnly: unified.filter((u) => u.presence === 'convex-only').length,
    noSub: unified.filter((u) => u.presence === 'both-no-sub' || u.presence === 'both').length,
    missingCensus: unified.filter((u) => u.missingFields.length > 0).length,
    hasToothlens: unified.filter((u) => u.hasToothlens).length,
  }), [unified]);

  // ── CSV export ────────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const headers = ['Presence', 'First Name', 'Last Name', 'Email (member)', 'Email (Clerk)',
      'Member ID', 'Member Status', 'Careington Unique ID', 'Seq #', 'DOB', 'Effective Date',
      'Address Line 1', 'City', 'State', 'Zip', 'Clerk ID', 'Subscription Status',
      'Entitlements', 'Toothlens UID', 'Scans', 'Missing Census Fields'];
    const rows = filtered.map((u) => [
      u.presence,
      u.memberFirstName ?? u.clerkName?.split(' ')[0] ?? '',
      u.memberLastName ?? u.clerkName?.split(' ').slice(1).join(' ') ?? '',
      u.memberEmail ?? '',
      u.clerkEmail ?? '',
      u.memberId ?? '',
      u.memberType ?? '',
      u.careingtonUniqueId ?? '',
      u.careingtonSeqNum ?? '',
      u.memberDob ?? '',
      u.memberEffective ?? '',
      u.memberAddress?.line1 ?? '',
      u.memberAddress?.city ?? '',
      u.memberAddress?.state ?? '',
      u.memberAddress?.postalCode ?? '',
      u.clerkId ?? '',
      u.subscriptionStatus ?? '',
      String(u.entitlementCount ?? ''),
      u.toothlensUid ?? '',
      String(u.toothlensScans ?? ''),
      u.missingFields.join('; '),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `user-investigation-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const dataLoading = clerkLoading || convexMembers === undefined || toothlensRecords === undefined;

  return (
    <div className="space-y-6 pb-16">
      <Breadcrumbs items={[{ label: 'User Audit' }]} />
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users size={22} /> User Investigation
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Every user across Clerk, Convex (IdealOH), and Toothlens — unified.
            {lastRefreshed && (
              <span className="ml-2 text-slate-400">Clerk last loaded {lastRefreshed.toLocaleTimeString()}</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchAllClerk}
            disabled={clerkLoading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40"
          >
            <RefreshCw size={14} className={clerkLoading ? 'animate-spin' : ''} />
            Refresh Clerk
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* ── Stats cards (each is a clickable filter) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {([
          { key: 'all',           label: 'All Users',       value: stats.total,        color: 'text-slate-700', border: '' },
          { key: 'both-active',   label: 'Active (Both)',   value: stats.bothActive,   color: 'text-green-700', border: '' },
          { key: 'both-no-sub',   label: 'Linked / No Sub', value: stats.noSub,        color: 'text-amber-700', border: '' },
          { key: 'clerk-only',    label: 'Clerk Only',      value: stats.clerkOnly,    color: 'text-purple-700', border: '' },
          { key: 'convex-only',   label: 'Convex Only',     value: stats.convexOnly,   color: 'text-slate-500', border: '' },
          { key: 'missing-census', label: 'Missing Census', value: stats.missingCensus, color: stats.missingCensus > 0 ? 'text-red-700' : 'text-green-700', border: '' },
          { key: 'has-toothlens', label: 'Toothlens',       value: stats.hasToothlens, color: 'text-blue-700', border: '' },
        ] as { key: PresenceFilter; label: string; value: number; color: string; border: string }[]).map((s) => (
          <button
            key={s.key}
            onClick={() => setPresenceFilter(presenceFilter === s.key ? 'all' : s.key)}
            className={`bg-white border rounded-xl p-3 text-left hover:shadow-sm transition-all ${
              presenceFilter === s.key ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200'
            }`}
          >
            <p className={`text-xl font-bold ${s.color}`}>
              {dataLoading ? <Loader size={14} className="animate-spin inline" /> : s.value}
            </p>
            <p className="text-xs text-slate-500 mt-0.5 leading-tight">{s.label}</p>
          </button>
        ))}
      </div>

      {/* ── The key insight explainer ── */}
      {!dataLoading && (stats.clerkOnly > 0 || stats.convexOnly > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900 space-y-1">
          <p className="font-semibold flex items-center gap-1.5"><AlertTriangle size={14} /> Why do the Members page and old User Audit show different counts?</p>
          <ul className="list-disc ml-5 space-y-0.5 text-amber-800">
            {stats.convexOnly > 0 && (
              <li>
                <strong>{stats.convexOnly} Convex-only</strong> members were imported via eligibility file upload — they have no Clerk login yet.
                They appear on the Members page but are invisible to Clerk-only views.
              </li>
            )}
            {stats.clerkOnly > 0 && (
              <li>
                <strong>{stats.clerkOnly} Clerk-only</strong> users signed up or were invited into Clerk but have no member profile created in Convex yet.
                They appear in Clerk user lists but are invisible to the Members page.
              </li>
            )}
          </ul>
        </div>
      )}

      {/* ── Search + filter bar ── */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex-1 min-w-56 relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Name, email, member ID, Clerk ID, Careington ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter size={13} className="text-slate-400" />
          <select
            value={presenceFilter}
            onChange={(e) => setPresenceFilter(e.target.value as PresenceFilter)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Users</option>
            <optgroup label="System Presence">
              <option value="both-active">Active in Both Systems</option>
              <option value="both">Linked (any sub status)</option>
              <option value="both-no-sub">Linked but No Subscription</option>
              <option value="clerk-only">Clerk Only — no member profile</option>
              <option value="convex-only">Convex Only — no Clerk account</option>
            </optgroup>
            <optgroup label="Data Quality">
              <option value="missing-census">Missing Census Template Fields</option>
              <option value="has-toothlens">Has Toothlens Account</option>
              <option value="no-toothlens">No Toothlens (members only)</option>
            </optgroup>
          </select>
        </div>
        {(search || presenceFilter !== 'all') && (
          <button
            onClick={() => { setSearch(''); setPresenceFilter('all'); }}
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            Clear filters
          </button>
        )}
        <span className="text-sm text-slate-500">
          Showing <strong>{filtered.length}</strong> of <strong>{unified.length}</strong> users
        </span>
      </div>

      {/* ── Error banner ── */}
      {clerkError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          Clerk error: {clerkError}. Convex data is still shown below.
        </div>
      )}

      {/* ── Table ── */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="w-8 px-3 py-3" />
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">User</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">System Presence</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Member ID</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase text-center">Toothlens</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Subscription</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Census</th>
                <th className="w-10 px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dataLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                    <Loader size={18} className="animate-spin inline mr-2" />
                    Loading users from Clerk, Convex, and Toothlens…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                    No users match the current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <UserRow
                    key={u.key}
                    user={u}
                    isExpanded={expandedKey === u.key}
                    onToggle={() => setExpandedKey(expandedKey === u.key ? null : u.key)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Expandable Row ───────────────────────────────────────────────────────────

function UserRow({
  user: u, isExpanded, onToggle,
}: {
  user: UnifiedUser;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const displayName = u.memberFirstName
    ? `${u.memberFirstName} ${u.memberLastName ?? ''}`.trim()
    : u.clerkName || u.clerkEmail || '(unknown)';
  const displayEmail = u.memberEmail ?? u.clerkEmail ?? '—';

  const subColors: Record<string, string> = {
    active: 'text-green-700 bg-green-50',
    cancelled: 'text-red-600 bg-red-50',
    past_due: 'text-orange-600 bg-orange-50',
    payment_failed: 'text-red-600 bg-red-50',
    cancel_at_period_end: 'text-amber-700 bg-amber-50',
  };

  return (
    <>
      <tr
        onClick={onToggle}
        className={`hover:bg-slate-50 cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50/40' : ''}`}
      >
        <td className="px-3 py-3 text-slate-400">
          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </td>

        {/* User identity */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2.5">
            {u.clerkImageUrl ? (
              <img src={u.clerkImageUrl} alt="" className="w-7 h-7 rounded-full flex-shrink-0 object-cover" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-medium text-slate-900 truncate">{displayName}</p>
              <p className="text-xs text-slate-500 truncate">{displayEmail}</p>
            </div>
          </div>
        </td>

        {/* Presence */}
        <td className="px-4 py-3"><PresenceBadge presence={u.presence} /></td>

        {/* Member ID */}
        <td className="px-4 py-3">
          <span className="font-mono text-xs text-slate-600">{u.memberId ?? '—'}</span>
        </td>

        {/* Member status */}
        <td className="px-4 py-3">
          {u.memberType ? (
            <StatusBadge status={u.memberType} />
          ) : (
            <span className="text-xs text-slate-300">—</span>
          )}
        </td>

        {/* Toothlens */}
        <td className="px-4 py-3 text-center">
          {u.hasToothlens ? (
            <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
              <ScanLine size={10} /> {u.toothlensScans ?? 0}
            </span>
          ) : (
            <span className="text-xs text-slate-300">—</span>
          )}
        </td>

        {/* Subscription */}
        <td className="px-4 py-3">
          {u.subscriptionStatus ? (
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${subColors[u.subscriptionStatus] ?? 'text-slate-600 bg-slate-100'}`}>
              {u.subscriptionStatus.replace(/_/g, ' ')}
              {u.entitlementCount ? ` · ${u.entitlementCount}` : ''}
            </span>
          ) : (
            <span className="text-xs text-slate-300">None</span>
          )}
        </td>

        {/* Census */}
        <td className="px-4 py-3">
          {!u.memberProfileId ? (
            <span className="text-xs text-slate-300">N/A</span>
          ) : u.missingFields.length === 0 ? (
            <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded">
              <CheckCircle2 size={10} /> OK
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
              <AlertTriangle size={10} /> {u.missingFields.length} missing
            </span>
          )}
        </td>

        {/* Inspector link */}
        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
          {u.memberProfileId && (
            <Link
              href={`/admin/members/${u.memberProfileId}`}
              className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700 inline-flex"
              title="Full Inspector"
            >
              <ExternalLink size={13} />
            </Link>
          )}
        </td>
      </tr>

      {/* Expanded inline detail */}
      {isExpanded && (
        <tr>
          <td colSpan={9} className="p-0 border-b border-slate-100">
            <div className="bg-slate-50 px-6 py-5">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5 text-sm">

                {/* IdealOH */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                    <Database size={11} /> Convex / IdealOH
                  </p>
                  <MiniField label="Member ID" value={u.memberId} mono />
                  <MiniField label="Careington Unique ID" value={u.careingtonUniqueId} mono missing={!u.careingtonUniqueId} />
                  <MiniField label="Sequence #" value={u.careingtonSeqNum} mono missing={!u.careingtonSeqNum} />
                  <MiniField label="Date of Birth" value={u.memberDob} missing={!u.memberDob} />
                  <MiniField label="Effective Date" value={u.memberEffective} missing={!u.memberEffective} />
                  <MiniField label="Member Type" value={u.memberType} />
                </div>

                {/* Address */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                    <Building2 size={11} /> Address
                  </p>
                  {u.memberAddress?.line1 ? (
                    <>
                      <MiniField label="Line 1" value={u.memberAddress.line1} />
                      {u.memberAddress.line2 && <MiniField label="Line 2" value={u.memberAddress.line2} />}
                      <MiniField label="City" value={u.memberAddress.city} missing={!u.memberAddress.city} />
                      <MiniField label="State" value={u.memberAddress.state} missing={!u.memberAddress.state} />
                      <MiniField label="Zip" value={u.memberAddress.postalCode} mono missing={!u.memberAddress.postalCode} />
                    </>
                  ) : (
                    <p className="text-xs text-red-500 font-medium">No address on file</p>
                  )}
                </div>

                {/* Clerk */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                    <ShieldCheck size={11} /> Clerk
                  </p>
                  {u.clerkId ? (
                    <>
                      <MiniField label="Clerk ID" value={u.clerkId} mono />
                      <MiniField label="Email" value={u.clerkEmail} />
                      <MiniField label="Account Created" value={fmt(u.clerkCreatedAt)} />
                    </>
                  ) : (
                    <p className="text-xs text-amber-600 font-semibold">No Clerk account linked</p>
                  )}
                </div>

                {/* Toothlens */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                    <ScanLine size={11} /> Toothlens
                  </p>
                  {u.hasToothlens ? (
                    <>
                      <MiniField label="UID" value={u.toothlensUid} mono />
                      <MiniField label="Total Scans" value={String(u.toothlensScans ?? 0)} />
                    </>
                  ) : (
                    <p className="text-xs text-slate-400">No Toothlens account</p>
                  )}
                </div>

                {/* Census gaps */}
                {u.memberProfileId && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                      <AlertTriangle size={11} /> Census Gaps
                    </p>
                    {u.missingFields.length === 0 ? (
                      <p className="text-xs text-green-600 font-semibold flex items-center gap-1">
                        <CheckCircle2 size={11} /> All required fields present
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {u.missingFields.map((f) => (
                          <span key={f} className="text-xs bg-red-100 text-red-700 border border-red-200 px-1.5 py-0.5 rounded">
                            {f}
                          </span>
                        ))}
                      </div>
                    )}
                    <Link
                      href={`/admin/members/${u.memberProfileId}`}
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      Full Inspector <ExternalLink size={10} />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function MiniField({ label, value, mono, missing }: {
  label: string;
  value?: string | null;
  mono?: boolean;
  missing?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      {missing || !value ? (
        <p className="text-xs text-red-500 font-semibold italic">missing</p>
      ) : (
        <p className={`text-xs text-slate-800 ${mono ? 'font-mono' : ''}`}>{value}</p>
      )}
    </div>
  );
}
