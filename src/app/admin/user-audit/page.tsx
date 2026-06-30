'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from 'convex/react';
import type { Id } from '@/convex/_generated/dataModel';
import { api } from '@/convex/_generated/api';
import { Breadcrumbs, StatusBadge } from '@/components/admin/ui';
import {
  Users, Search, AlertTriangle, CheckCircle2, ExternalLink,
  Loader, Filter, Download, ScanLine, ShieldCheck, CreditCard,
  Building2, Database, CloudOff, Layers, UserCheck,
  ChevronDown, ChevronUp, RefreshCw, Pencil, Trash2, Save, X, Eye, EyeOff, ChevronsUpDown,
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
  // Employer / payroll audit
  ssn?: string;
  location?: string;
  department?: string;
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
        ssn: (m as any).ssn ?? undefined,
        location: (m as any).location ?? undefined,
        department: (m as any).department ?? undefined,
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
  const [showTerminated, setShowTerminated] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [subFilter, setSubFilter] = useState<string>('all');
  const [toothlensFilter, setToothlensFilter] = useState<string>('all');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  // ── Sorting ──────────────────────────────────────────────────────────────────
  type SortKey = 'name' | 'presence' | 'memberId' | 'memberType' | 'toothlens' | 'subscription' | 'census';
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const terminatedCount = useMemo(
    () => unified.filter((u) => u.memberType === 'terminated').length,
    [unified]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return unified.filter((u) => {
      // Hide terminated members unless explicitly shown
      if (!showTerminated && u.memberType === 'terminated') return false;
      if (q) {
        const name = `${u.memberFirstName ?? ''} ${u.memberLastName ?? ''} ${u.clerkName ?? ''}`.toLowerCase();
        const email = `${u.memberEmail ?? ''} ${u.clerkEmail ?? ''}`.toLowerCase();
        const ids = `${u.memberId ?? ''} ${u.clerkId ?? ''} ${u.careingtonUniqueId ?? ''}`.toLowerCase();
        if (!name.includes(q) && !email.includes(q) && !ids.includes(q)) return false;
      }
      // Member status filter
      if (statusFilter !== 'all' && (u.memberType ?? '') !== statusFilter) return false;
      // Subscription filter
      if (subFilter === 'none') {
        if (u.subscriptionStatus) return false;
      } else if (subFilter !== 'all') {
        if ((u.subscriptionStatus ?? '') !== subFilter) return false;
      }
      // Toothlens filter
      if (toothlensFilter === 'has' && !u.hasToothlens) return false;
      if (toothlensFilter === 'none' && u.hasToothlens) return false;
      // Presence / data-quality filter
      if (presenceFilter === 'all') return true;
      if (presenceFilter === 'missing-census') return u.missingFields.length > 0;
      if (presenceFilter === 'has-toothlens') return u.hasToothlens;
      if (presenceFilter === 'no-toothlens') return !u.hasToothlens && !!u.memberProfileId;
      return u.presence === presenceFilter;
    });
  }, [unified, search, presenceFilter, showTerminated, statusFilter, subFilter, toothlensFilter]);

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const valueFor = (u: UnifiedUser): string | number => {
      switch (sortKey) {
        case 'name':
          return (u.memberFirstName
            ? `${u.memberFirstName} ${u.memberLastName ?? ''}`
            : u.clerkName || u.clerkEmail || '').trim().toLowerCase();
        case 'presence':
          return u.presence;
        case 'memberId':
          return (u.memberId ?? '').toLowerCase();
        case 'memberType':
          return (u.memberType ?? '').toLowerCase();
        case 'toothlens':
          return u.hasToothlens ? (u.toothlensScans ?? 0) : -1;
        case 'subscription':
          return (u.subscriptionStatus ?? '').toLowerCase();
        case 'census':
          return u.memberProfileId ? u.missingFields.length : -1;
        default:
          return '';
      }
    };
    return [...filtered].sort((a, b) => {
      const av = valueFor(a);
      const bv = valueFor(b);
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av) < String(bv) ? -1 * dir : String(av) > String(bv) ? 1 * dir : 0;
    });
  }, [filtered, sortKey, sortDir]);

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

  // Distinct values present in the data, for the filter dropdowns
  const memberStatusOptions = useMemo(
    () => Array.from(new Set(unified.map((u) => u.memberType).filter(Boolean))).sort() as string[],
    [unified]
  );
  const subStatusOptions = useMemo(
    () => Array.from(new Set(unified.map((u) => u.subscriptionStatus).filter(Boolean))).sort() as string[],
    [unified]
  );

  const anyFilterActive =
    !!search ||
    presenceFilter !== 'all' ||
    statusFilter !== 'all' ||
    subFilter !== 'all' ||
    toothlensFilter !== 'all';

  const clearAllFilters = () => {
    setSearch('');
    setPresenceFilter('all');
    setStatusFilter('all');
    setSubFilter('all');
    setToothlensFilter('all');
  };

  // ── CSV column picker ──────────────────────────────────────────────────────
  const AUDIT_COLUMNS: { key: string; label: string; defaultOn: boolean; sensitive?: boolean; get: (u: UnifiedUser) => string }[] = [
    { key: 'presence',        label: 'Presence',              defaultOn: true,  get: (u) => u.presence },
    { key: 'firstName',       label: 'First Name',            defaultOn: true,  get: (u) => u.memberFirstName ?? u.clerkName?.split(' ')[0] ?? '' },
    { key: 'lastName',        label: 'Last Name',             defaultOn: true,  get: (u) => u.memberLastName ?? u.clerkName?.split(' ').slice(1).join(' ') ?? '' },
    { key: 'memberEmail',     label: 'Email (member)',        defaultOn: true,  get: (u) => u.memberEmail ?? '' },
    { key: 'clerkEmail',      label: 'Email (Clerk)',         defaultOn: false, get: (u) => u.clerkEmail ?? '' },
    { key: 'memberId',        label: 'Member ID',             defaultOn: true,  get: (u) => u.memberId ?? '' },
    { key: 'memberType',      label: 'Member Status',         defaultOn: true,  get: (u) => u.memberType ?? '' },
    { key: 'ssn',             label: 'SSN',                   defaultOn: false, sensitive: true, get: (u) => u.ssn ?? '' },
    { key: 'location',        label: 'Location',              defaultOn: false, get: (u) => u.location ?? '' },
    { key: 'department',      label: 'Department',            defaultOn: false, get: (u) => u.department ?? '' },
    { key: 'careingtonId',    label: 'Careington Unique ID',  defaultOn: true,  get: (u) => u.careingtonUniqueId ?? '' },
    { key: 'seqNum',          label: 'Seq #',                 defaultOn: false, get: (u) => u.careingtonSeqNum ?? '' },
    { key: 'dob',             label: 'DOB',                   defaultOn: false, get: (u) => u.memberDob ?? '' },
    { key: 'effectiveDate',   label: 'Effective Date',        defaultOn: false, get: (u) => u.memberEffective ?? '' },
    { key: 'addrLine1',       label: 'Address Line 1',        defaultOn: false, get: (u) => u.memberAddress?.line1 ?? '' },
    { key: 'city',            label: 'City',                  defaultOn: false, get: (u) => u.memberAddress?.city ?? '' },
    { key: 'state',           label: 'State',                 defaultOn: false, get: (u) => u.memberAddress?.state ?? '' },
    { key: 'zip',             label: 'Zip',                   defaultOn: false, get: (u) => u.memberAddress?.postalCode ?? '' },
    { key: 'clerkId',         label: 'Clerk ID',              defaultOn: false, get: (u) => u.clerkId ?? '' },
    { key: 'subStatus',       label: 'Subscription Status',   defaultOn: true,  get: (u) => u.subscriptionStatus ?? '' },
    { key: 'entitlements',    label: 'Entitlements',          defaultOn: false, get: (u) => String(u.entitlementCount ?? '') },
    { key: 'toothlensUid',    label: 'Toothlens UID',         defaultOn: false, get: (u) => u.toothlensUid ?? '' },
    { key: 'scans',           label: 'Scans',                 defaultOn: false, get: (u) => String(u.toothlensScans ?? '') },
    { key: 'missingFields',   label: 'Missing Census Fields', defaultOn: true,  get: (u) => u.missingFields.join('; ') },
  ];

  const [showExportPicker, setShowExportPicker] = useState(false);
  const [exportEnabled, setExportEnabled] = useState<string[]>(
    () => AUDIT_COLUMNS.filter((c) => c.defaultOn).map((c) => c.key)
  );

  const toggleExportCol = (key: string) =>
    setExportEnabled((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );

  const runExportCSV = () => {
    const cols = AUDIT_COLUMNS.filter((c) => exportEnabled.includes(c.key));
    const header = cols.map((c) => c.label);
    const rows = sorted.map((u) => cols.map((c) => c.get(u)));
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `user-audit-${new Date().toISOString().slice(0, 10)}.csv`;
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
            onClick={() => setShowExportPicker(true)}
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
        {/* Member status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"
          title="Filter by member status"
        >
          <option value="all">All Statuses</option>
          {memberStatusOptions.map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        {/* Subscription filter */}
        <select
          value={subFilter}
          onChange={(e) => setSubFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"
          title="Filter by subscription status"
        >
          <option value="all">All Subscriptions</option>
          <option value="none">No subscription</option>
          {subStatusOptions.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
        {/* Toothlens filter */}
        <select
          value={toothlensFilter}
          onChange={(e) => setToothlensFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"
          title="Filter by Toothlens presence"
        >
          <option value="all">Toothlens: Any</option>
          <option value="has">Has Toothlens</option>
          <option value="none">No Toothlens</option>
        </select>
        <button
          onClick={() => setShowTerminated((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors ${
            showTerminated
              ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
              : 'border-slate-300 text-slate-600 hover:bg-slate-50'
          }`}
          title={showTerminated ? 'Hide terminated members' : 'Show terminated members'}
        >
          {showTerminated ? <Eye size={14} /> : <EyeOff size={14} />}
          {showTerminated ? 'Showing terminated' : 'Terminated hidden'}
          {terminatedCount > 0 && (
            <span className="ml-0.5 text-xs font-semibold bg-white/70 border border-current/20 rounded-full px-1.5">
              {terminatedCount}
            </span>
          )}
        </button>
        {anyFilterActive && (
          <button
            onClick={clearAllFilters}
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            Clear filters
          </button>
        )}
        <span className="text-sm text-slate-500">
          Showing <strong>{sorted.length}</strong> of <strong>{unified.length}</strong> users
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
                <SortableTh label="User" sortKey="name" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableTh label="System Presence" sortKey="presence" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableTh label="Member ID" sortKey="memberId" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableTh label="Status" sortKey="memberType" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableTh label="Toothlens" sortKey="toothlens" activeKey={sortKey} dir={sortDir} onSort={toggleSort} align="center" />
                <SortableTh label="Subscription" sortKey="subscription" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableTh label="Census" sortKey="census" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
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
                sorted.map((u) => (
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

      {/* ── Export column picker modal ── */}
      {showExportPicker && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Configure CSV Export</h2>
              <button onClick={() => setShowExportPicker(false)} className="text-slate-400 hover:text-slate-700 text-lg leading-none">&times;</button>
            </div>
            {/* Presets */}
            <div className="flex gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-500 self-center">Presets:</span>
              <button onClick={() => setExportEnabled(AUDIT_COLUMNS.filter((c) => c.defaultOn).map((c) => c.key))} className="px-3 py-1 text-xs rounded border border-slate-300 hover:bg-slate-50">Standard</button>
              <button onClick={() => setExportEnabled(AUDIT_COLUMNS.map((c) => c.key))} className="px-3 py-1 text-xs rounded border border-slate-300 hover:bg-slate-50">All Columns</button>
              <button onClick={() => setExportEnabled(['ssn', 'firstName', 'lastName', 'memberId', 'location', 'department', 'effectiveDate'])} className="px-3 py-1 text-xs rounded border border-slate-300 hover:bg-slate-50">Payroll Audit</button>
            </div>
            {/* Column checkboxes */}
            <div className="grid grid-cols-2 gap-1 max-h-64 overflow-y-auto pr-1">
              {AUDIT_COLUMNS.map((col) => (
                <label key={col.key} className="flex items-center gap-2 text-sm cursor-pointer rounded px-2 py-1.5 hover:bg-slate-50">
                  <input type="checkbox" checked={exportEnabled.includes(col.key)} onChange={() => toggleExportCol(col.key)} className="rounded border-slate-300" />
                  <span className={col.sensitive ? 'text-amber-700 font-medium' : 'text-slate-700'}>
                    {col.label}{col.sensitive && ' ⚠'}
                  </span>
                </label>
              ))}
            </div>
            {exportEnabled.includes('ssn') && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                <strong>SSN included.</strong> This export will contain Social Security Numbers. Handle the file securely.
              </div>
            )}
            <div className="flex justify-between items-center pt-1">
              <span className="text-xs text-slate-400">{exportEnabled.length} column{exportEnabled.length !== 1 ? 's' : ''} · {sorted.length} users</span>
              <div className="flex gap-2">
                <button onClick={() => setShowExportPicker(false)} className="px-4 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">Cancel</button>
                <button
                  onClick={() => { runExportCSV(); setShowExportPicker(false); }}
                  disabled={exportEnabled.length === 0}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-40"
                >
                  <Download size={13} /> Download CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sortable header cell ─────────────────────────────────────────────────────

function SortableTh({ label, sortKey, activeKey, dir, onSort, align }: {
  label: string;
  sortKey: any;
  activeKey: string;
  dir: 'asc' | 'desc';
  onSort: (key: any) => void;
  align?: 'left' | 'center';
}) {
  const isActive = activeKey === sortKey;
  return (
    <th className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase ${align === 'center' ? 'text-center' : ''}`}>
      <button
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-slate-800 transition-colors ${isActive ? 'text-slate-800' : ''}`}
      >
        {label}
        {isActive ? (
          dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
        ) : (
          <ChevronsUpDown size={12} className="text-slate-300" />
        )}
      </button>
    </th>
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
            <ExpandedDetail user={u} />
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

// ─── Expanded Detail: full data + inline edit + permanent delete ────────────────

type EditForm = {
  title: string; firstName: string; middleName: string; lastName: string; suffix: string;
  email: string; phone: string; workPhone: string;
  dateOfBirth: string; effectiveDate: string; gender: string;
  subscriberId: string; careingtonUniqueId: string; careingtonSeqNum: string; toothlensMemberId: string;
  ssn: string; location: string; department: string; groupMemberId: string;
  addrLine1: string; addrLine2: string; addrCity: string; addrState: string; addrZip: string; addrCountry: string;
  memberType: string; status: string;
};

function ExpandedDetail({ user: u }: { user: UnifiedUser }) {
  const data = useQuery(
    api.admin.userAudit.getMemberInspectorData,
    u.memberProfileId ? { memberProfileId: u.memberProfileId as Id<'memberProfiles'> } : 'skip'
  ) as any;

  const updateMember = useMutation(api.admin.members.updateMemberProfile);
  const hardDeleteMember = useMutation(api.admin.members.hardDeleteMember);

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [revealSsn, setRevealSsn] = useState(false);

  const member = data?.member;

  const startEdit = () => {
    if (!member) return;
    setErrorMsg(null);
    setForm({
      title: member.title ?? '', firstName: member.firstName ?? '', middleName: member.middleName ?? '',
      lastName: member.lastName ?? '', suffix: member.suffix ?? '',
      email: member.email ?? '', phone: member.phone ?? '', workPhone: member.workPhone ?? '',
      dateOfBirth: member.dateOfBirth ?? '', effectiveDate: member.effectiveDate ?? '', gender: member.gender ?? '',
      subscriberId: member.subscriberId ?? '', careingtonUniqueId: member.careingtonUniqueId ?? '',
      careingtonSeqNum: member.careingtonSeqNum ?? '', toothlensMemberId: member.toothlensMemberId ?? '',
      ssn: member.ssn ?? u.ssn ?? '', location: member.location ?? u.location ?? '', department: member.department ?? u.department ?? '',
      groupMemberId: member.groupMemberId ?? '',
      addrLine1: member.address?.line1 ?? '', addrLine2: member.address?.line2 ?? '',
      addrCity: member.address?.city ?? '', addrState: member.address?.state ?? '',
      addrZip: member.address?.postalCode ?? '', addrCountry: member.address?.country ?? 'US',
      memberType: member.memberType ?? '', status: member.status ?? '',
    });
    setIsEditing(true);
  };

  const set = (k: keyof EditForm, val: string) =>
    setForm((f) => (f ? { ...f, [k]: val } : f));

  const handleSave = async () => {
    if (!form || !u.memberProfileId) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const hasAddress = !!(form.addrLine1 || form.addrCity || form.addrState || form.addrZip);
      await updateMember({
        memberId: u.memberProfileId as Id<'memberProfiles'>,
        title: form.title || undefined,
        firstName: form.firstName || undefined,
        middleName: form.middleName || undefined,
        lastName: form.lastName || undefined,
        suffix: form.suffix || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        workPhone: form.workPhone || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        effectiveDate: form.effectiveDate || undefined,
        gender: (form.gender || undefined) as any,
        subscriberId: form.subscriberId || undefined,
        careingtonUniqueId: form.careingtonUniqueId || undefined,
        careingtonSeqNum: form.careingtonSeqNum || undefined,
        toothlensMemberId: form.toothlensMemberId || undefined,
        ssn: form.ssn || undefined,
        location: form.location || undefined,
        department: form.department || undefined,
        groupMemberId: form.groupMemberId || undefined,
        memberType: (form.memberType || undefined) as any,
        status: (form.status || undefined) as any,
        address: hasAddress
          ? {
              line1: form.addrLine1,
              line2: form.addrLine2 || undefined,
              city: form.addrCity,
              state: form.addrState,
              postalCode: form.addrZip,
              country: form.addrCountry || 'US',
            }
          : undefined,
      });
      setIsEditing(false);
    } catch (e: any) {
      setErrorMsg(e?.message ?? 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!u.memberProfileId) return;
    const name = `${member?.firstName ?? ''} ${member?.lastName ?? ''}`.trim() || u.memberId || 'this member';
    if (!window.confirm(
      `Permanently delete ${name}?\n\nThis CANNOT be undone. The member profile, its activity log, and notes will be removed entirely. Subscriptions and Clerk/Toothlens accounts are not affected.`
    )) return;
    setDeleting(true);
    setErrorMsg(null);
    try {
      await hardDeleteMember({ memberId: u.memberProfileId as Id<'memberProfiles'>, reason: 'Permanently deleted via User Audit' });
      // Row will disappear from the live query automatically.
    } catch (e: any) {
      setErrorMsg(e?.message ?? 'Failed to delete member');
      setDeleting(false);
    }
  };

  // ── Clerk-only user (no Convex member profile to inspect/edit) ──
  if (!u.memberProfileId) {
    return (
      <div className="bg-slate-50 px-6 py-5">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-5 text-sm">
          <div className="space-y-2">
            <SectionTitle icon={<ShieldCheck size={11} />}>Clerk</SectionTitle>
            <MiniField label="Clerk ID" value={u.clerkId} mono />
            <MiniField label="Email" value={u.clerkEmail} />
            <MiniField label="Name" value={u.clerkName} />
            <MiniField label="Account Created" value={fmt(u.clerkCreatedAt)} />
          </div>
          <div className="space-y-2">
            <SectionTitle icon={<ScanLine size={11} />}>Toothlens</SectionTitle>
            {u.hasToothlens ? (
              <>
                <MiniField label="UID" value={u.toothlensUid} mono />
                <MiniField label="Total Scans" value={String(u.toothlensScans ?? 0)} />
              </>
            ) : (
              <p className="text-xs text-slate-400">No Toothlens account</p>
            )}
          </div>
          <div className="space-y-2">
            <SectionTitle icon={<CreditCard size={11} />}>Subscription</SectionTitle>
            <MiniField label="Status" value={u.subscriptionStatus ?? 'None'} />
            <MiniField label="Entitlements" value={String(u.entitlementCount ?? 0)} />
          </div>
        </div>
        <p className="mt-4 text-xs text-amber-600 font-medium">
          This is a Clerk-only account with no member profile. There is nothing to edit or delete here.
        </p>
      </div>
    );
  }

  if (data === undefined) {
    return (
      <div className="bg-slate-50 px-6 py-8 text-center text-slate-400 text-sm">
        <Loader size={16} className="animate-spin inline mr-2" /> Loading full record…
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="bg-slate-50 px-6 py-6 text-sm text-red-600">
        Member record not found (it may have just been deleted).
      </div>
    );
  }

  const addr = member.address;
  const validation = data.validation;

  return (
    <div className="bg-slate-50 px-6 py-5 space-y-5">
      {/* Action toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {validation?.isComplete ? (
            <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded">
              <CheckCircle2 size={12} /> Census complete
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 border border-red-200 px-2 py-1 rounded">
              <AlertTriangle size={12} /> {validation?.missingFields?.length ?? 0} census field(s) missing
            </span>
          )}
          <Link
            href={`/admin/members/${u.memberProfileId}`}
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            Open full inspector <ExternalLink size={10} />
          </Link>
        </div>
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <>
              <button
                onClick={startEdit}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                <Pencil size={12} /> Edit all fields
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50"
              >
                {deleting ? <Loader size={12} className="animate-spin" /> : <Trash2 size={12} />} Delete permanently
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <Loader size={12} className="animate-spin" /> : <Save size={12} />} Save changes
              </button>
              <button
                onClick={() => { setIsEditing(false); setErrorMsg(null); }}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
              >
                <X size={12} /> Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
          {errorMsg}
        </div>
      )}

      {/* ── EDIT MODE ── */}
      {isEditing && form ? (
        <div className="space-y-5">
          <FormSection title="Personal Information">
            <Field label="Title"><Input value={form.title} onChange={(v) => set('title', v)} placeholder="Mr / Mrs / Ms" /></Field>
            <Field label="First Name"><Input value={form.firstName} onChange={(v) => set('firstName', v)} /></Field>
            <Field label="Middle Name"><Input value={form.middleName} onChange={(v) => set('middleName', v)} /></Field>
            <Field label="Last Name"><Input value={form.lastName} onChange={(v) => set('lastName', v)} /></Field>
            <Field label="Suffix"><Input value={form.suffix} onChange={(v) => set('suffix', v)} placeholder="Jr / Sr / II" /></Field>
            <Field label="Date of Birth"><Input value={form.dateOfBirth} onChange={(v) => set('dateOfBirth', v)} placeholder="YYYY-MM-DD" /></Field>
            <Field label="Gender">
              <select value={form.gender} onChange={(e) => set('gender', e.target.value)} className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-xs bg-white">
                <option value="">—</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="non_binary">Non-binary</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Effective Date"><Input value={form.effectiveDate} onChange={(v) => set('effectiveDate', v)} placeholder="YYYY-MM-DD" /></Field>
          </FormSection>

          <FormSection title="Contact">
            <Field label="Email"><Input value={form.email} onChange={(v) => set('email', v)} /></Field>
            <Field label="Phone"><Input value={form.phone} onChange={(v) => set('phone', v)} /></Field>
            <Field label="Work Phone"><Input value={form.workPhone} onChange={(v) => set('workPhone', v)} /></Field>
          </FormSection>

          <FormSection title="Address">
            <Field label="Line 1"><Input value={form.addrLine1} onChange={(v) => set('addrLine1', v)} /></Field>
            <Field label="Line 2"><Input value={form.addrLine2} onChange={(v) => set('addrLine2', v)} /></Field>
            <Field label="City"><Input value={form.addrCity} onChange={(v) => set('addrCity', v)} /></Field>
            <Field label="State"><Input value={form.addrState} onChange={(v) => set('addrState', v)} /></Field>
            <Field label="Zip"><Input value={form.addrZip} onChange={(v) => set('addrZip', v)} /></Field>
            <Field label="Country"><Input value={form.addrCountry} onChange={(v) => set('addrCountry', v)} /></Field>
          </FormSection>

          <FormSection title="Vendor / Identity IDs">
            <Field label="Subscriber ID"><Input value={form.subscriberId} onChange={(v) => set('subscriberId', v)} /></Field>
            <Field label="Careington Unique ID"><Input value={form.careingtonUniqueId} onChange={(v) => set('careingtonUniqueId', v)} /></Field>
            <Field label="Careington Seq #"><Input value={form.careingtonSeqNum} onChange={(v) => set('careingtonSeqNum', v)} placeholder="00" /></Field>
            <Field label="Toothlens Member ID"><Input value={form.toothlensMemberId} onChange={(v) => set('toothlensMemberId', v)} /></Field>
            <Field label="Group Member ID"><Input value={form.groupMemberId} onChange={(v) => set('groupMemberId', v)} /></Field>
          </FormSection>

          <FormSection title="Employer / Payroll Audit">
            <Field label="SSN"><Input value={form.ssn} onChange={(v) => set('ssn', v)} /></Field>
            <Field label="Location"><Input value={form.location} onChange={(v) => set('location', v)} /></Field>
            <Field label="Department"><Input value={form.department} onChange={(v) => set('department', v)} /></Field>
          </FormSection>

          <FormSection title="Status">
            <Field label="Member Type">
              <select value={form.memberType} onChange={(e) => set('memberType', e.target.value)} className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-xs bg-white">
                <option value="">—</option>
                {['lead', 'eligible', 'enrolling', 'active', 'inactive', 'terminated', 'declined'].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Account Status">
              <select value={form.status} onChange={(e) => set('status', e.target.value)} className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-xs bg-white">
                <option value="">—</option>
                {['active', 'inactive', 'suspended', 'terminated'].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
          </FormSection>
        </div>
      ) : (
        /* ── READ MODE: every data point ── */
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-5 text-sm">
          {/* Identity */}
          <div className="space-y-2">
            <SectionTitle icon={<Database size={11} />}>Identity</SectionTitle>
            <MiniField label="Member ID" value={member.memberId} mono />
            <MiniField label="Subscriber ID" value={member.subscriberId} mono />
            <MiniField label="Barcode" value={member.barcode} mono />
            <MiniField label="Profile _id" value={member._id} mono />
            <MiniField label="Group Member ID" value={member.groupMemberId} mono />
          </div>

          {/* Personal */}
          <div className="space-y-2">
            <SectionTitle icon={<UserCheck size={11} />}>Personal</SectionTitle>
            <MiniField label="Title" value={member.title} />
            <MiniField label="First Name" value={member.firstName} missing={!member.firstName} />
            <MiniField label="Middle Name" value={member.middleName} />
            <MiniField label="Last Name" value={member.lastName} missing={!member.lastName} />
            <MiniField label="Suffix" value={member.suffix} />
            <MiniField label="Date of Birth" value={member.dateOfBirth} missing={!member.dateOfBirth} />
            <MiniField label="Gender" value={member.gender} />
            <MiniField label="Effective Date" value={member.effectiveDate} missing={!member.effectiveDate} />
          </div>

          {/* Contact */}
          <div className="space-y-2">
            <SectionTitle icon={<UserCheck size={11} />}>Contact</SectionTitle>
            <MiniField label="Email" value={member.email} missing={!member.email} />
            <MiniField label="Phone" value={member.phone} />
            <MiniField label="Work Phone" value={member.workPhone} />
          </div>

          {/* Address */}
          <div className="space-y-2">
            <SectionTitle icon={<Building2 size={11} />}>Address</SectionTitle>
            {addr?.line1 ? (
              <>
                <MiniField label="Line 1" value={addr.line1} />
                {addr.line2 && <MiniField label="Line 2" value={addr.line2} />}
                <MiniField label="City" value={addr.city} missing={!addr.city} />
                <MiniField label="State" value={addr.state} missing={!addr.state} />
                <MiniField label="Zip" value={addr.postalCode} mono missing={!addr.postalCode} />
                <MiniField label="Country" value={addr.country} />
              </>
            ) : (
              <p className="text-xs text-red-500 font-medium">No address on file</p>
            )}
          </div>

          {/* Vendor IDs */}
          <div className="space-y-2">
            <SectionTitle icon={<CreditCard size={11} />}>Vendor IDs</SectionTitle>
            <MiniField label="Careington Unique ID" value={member.careingtonUniqueId} mono missing={!member.careingtonUniqueId} />
            <MiniField label="Careington Seq #" value={member.careingtonSeqNum} mono missing={!member.careingtonSeqNum} />
            <MiniField label="Toothlens Member ID" value={member.toothlensMemberId} mono />
          </div>

          {/* Employer / Payroll */}
          <div className="space-y-2">
            <SectionTitle icon={<Building2 size={11} />}>Employer / Payroll</SectionTitle>
            <div>
              <p className="text-xs text-slate-400">SSN</p>
              {(member.ssn || u.ssn) ? (
                <p className="text-xs text-slate-800 font-mono flex items-center gap-1">
                  {revealSsn ? (member.ssn ?? u.ssn) : '•••-••-' + String(member.ssn ?? u.ssn ?? '').slice(-4)}
                  <button onClick={() => setRevealSsn((s) => !s)} className="text-slate-400 hover:text-slate-700">
                    {revealSsn ? <EyeOff size={11} /> : <Eye size={11} />}
                  </button>
                </p>
              ) : (
                <p className="text-xs text-slate-400 italic">—</p>
              )}
            </div>
            <MiniField label="Location" value={member.location ?? u.location} />
            <MiniField label="Department" value={member.department ?? u.department} />
            <MiniField label="Employee Type" value={member.employeeType} />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <SectionTitle icon={<ShieldCheck size={11} />}>Status</SectionTitle>
            <MiniField label="Member Type" value={member.memberType} />
            <MiniField label="Account Status" value={member.status} />
            <MiniField label="Member Role" value={member.memberRole} />
            <MiniField label="Relationship" value={member.relationship} />
          </div>

          {/* Enrollment */}
          <div className="space-y-2">
            <SectionTitle icon={<Layers size={11} />}>Enrollment</SectionTitle>
            <MiniField label="Enrolled At" value={fmt(member.enrolledAt)} />
            <MiniField label="Created At" value={fmt(member.createdAt)} />
            <MiniField label="Updated At" value={fmt(member.updatedAt)} />
            <MiniField label="Signup Source" value={member.signupSource} />
            <MiniField label="Eligibility File" value={member.eligibilityFileId} mono />
          </div>

          {/* Hierarchy */}
          <div className="space-y-2">
            <SectionTitle icon={<Building2 size={11} />}>Hierarchy</SectionTitle>
            <MiniField label="Group" value={data.hierarchy?.groupName} />
            <MiniField label="Group Code" value={data.hierarchy?.groupCode} />
            <MiniField label="Org Code" value={data.hierarchy?.organizationCode} />
            <MiniField label="Account" value={data.hierarchy?.accountName} />
            <MiniField label="Site" value={data.hierarchy?.siteName} />
          </div>

          {/* Clerk */}
          <div className="space-y-2">
            <SectionTitle icon={<ShieldCheck size={11} />}>Clerk</SectionTitle>
            {member.customerId ? (
              <>
                <MiniField label="Clerk ID" value={member.customerId} mono />
                <MiniField label="Email" value={u.clerkEmail} />
                <MiniField label="Created" value={fmt(u.clerkCreatedAt)} />
              </>
            ) : (
              <p className="text-xs text-amber-600 font-semibold">No Clerk account linked</p>
            )}
          </div>

          {/* Subscription */}
          <div className="space-y-2">
            <SectionTitle icon={<CreditCard size={11} />}>Subscription</SectionTitle>
            {data.subscription ? (
              <>
                <MiniField label="Status" value={data.subscription.status} />
                <MiniField label="Cadence" value={data.subscription.cadence} />
                <MiniField label="Payment Method" value={data.subscription.paymentMethod} />
                <MiniField label="Total" value={data.subscription.totalCents != null ? `$${(data.subscription.totalCents / 100).toFixed(2)}` : undefined} />
                <MiniField label="Period End" value={fmt(data.subscription.currentPeriodEnd)} />
                <MiniField label="Stripe Customer" value={data.subscription.stripeCustomerId} mono />
                <MiniField label="Stripe Sub" value={data.subscription.stripeSubscriptionId} mono />
              </>
            ) : (
              <p className="text-xs text-slate-400">No subscription bundle</p>
            )}
            {data.entitlements?.length > 0 && (
              <div className="pt-1">
                <p className="text-xs text-slate-400 mb-1">Entitlements ({data.entitlements.length})</p>
                <div className="flex flex-wrap gap-1">
                  {data.entitlements.map((e: any) => (
                    <span key={e._id} className="text-xs bg-slate-100 border border-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                      {e.productName} · {e.status}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Toothlens */}
          <div className="space-y-2">
            <SectionTitle icon={<ScanLine size={11} />}>Toothlens</SectionTitle>
            {data.toothlens ? (
              <>
                <MiniField label="UID" value={data.toothlens.toothlensUid} mono />
                <MiniField label="Company" value={data.toothlens.company} />
                <MiniField label="Email" value={data.toothlens.email} />
                <MiniField label="Total Scans" value={String(data.toothlens.scanCount ?? 0)} />
                <MiniField label="Last Scan" value={fmt(data.toothlens.lastScanAt)} />
              </>
            ) : (
              <p className="text-xs text-slate-400">No Toothlens account</p>
            )}
          </div>

          {/* Dependents */}
          {data.dependents?.length > 0 && (
            <div className="space-y-2 col-span-2">
              <SectionTitle icon={<Users size={11} />}>Dependents ({data.dependents.length})</SectionTitle>
              <div className="space-y-1">
                {data.dependents.map((d: any, i: number) => (
                  <div key={i} className="text-xs text-slate-700 bg-white border border-slate-200 rounded px-2 py-1 flex flex-wrap gap-x-3">
                    <span className="font-medium">{d.firstName} {d.lastName}</span>
                    <span className="text-slate-400">{d.relationship}</span>
                    {d.dateOfBirth && <span className="text-slate-400">DOB {d.dateOfBirth}</span>}
                    {d.seqNum && <span className="font-mono text-slate-400">Seq {d.seqNum}</span>}
                    {d.toothlensMemberId && <span className="font-mono text-slate-400">TL {d.toothlensMemberId}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Census gaps */}
          <div className="space-y-2 col-span-2">
            <SectionTitle icon={<AlertTriangle size={11} />}>Census Validation</SectionTitle>
            {validation?.isComplete ? (
              <p className="text-xs text-green-600 font-semibold flex items-center gap-1">
                <CheckCircle2 size={11} /> All required fields present
              </p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {validation?.missingFields?.map((f: string) => (
                  <span key={f} className="text-xs bg-red-100 text-red-700 border border-red-200 px-1.5 py-0.5 rounded">{f}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
      {icon} {children}
    </p>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{title}</p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-slate-500 mb-1">{label}</span>
      {children}
    </label>
  );
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    />
  );
}
