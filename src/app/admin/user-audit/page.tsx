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
  ChevronDown, ChevronUp, RefreshCw, Pencil, Trash2, Save, X, Eye, EyeOff, ChevronsUpDown, Columns3,
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

// How a member's coverage is paid for (computed server-side in admin/members.ts)
type BillingSource = 'individual' | 'list_bill' | 'comp' | 'none';

// Whether money is actually flowing for that coverage right now
type PaymentState =
  | 'paid'          // individual enrollment, currently collecting
  | 'employer_paid' // list bill — employer is invoiced, no Stripe bundle
  | 'comped'        // active coverage at $0
  | 'incomplete'    // started checkout, never completed it
  | 'past_due'      // payment failed / past due / suspended
  | 'cancelled'     // was paying, no longer
  | 'none';         // never enrolled

type MemberRole = 'primary' | 'dependent';

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
  memberCreatedAt?: number;
  memberAddress?: { line1?: string; line2?: string; city?: string; state?: string; postalCode?: string };
  careingtonUniqueId?: string;
  careingtonSeqNum?: string;
  // Subscription
  subscriptionStatus?: string;
  entitlementCount?: number;
  // Billing — how coverage is paid for, and whether it currently is
  billingSource: BillingSource;
  paymentState: PaymentState;
  listBillStatus?: string;
  organizationName?: string;
  // Family structure
  memberRole?: MemberRole;
  relationship?: string;
  primaryMemberName?: string;
  dependentCount?: number;
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
  // Earliest known creation date across systems (when first added to our system)
  systemCreatedAt?: number;
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

// ─── Billing / family classification ──────────────────────────────────────────

const BILLING_SOURCE_META: Record<BillingSource, { label: string; short: string; color: string }> = {
  individual: { label: 'Individual',  short: 'Individual', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  list_bill:  { label: 'List Bill',   short: 'List Bill',  color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
  comp:       { label: 'Comped',      short: 'Comped',     color: 'text-sky-700 bg-sky-50 border-sky-200' },
  none:       { label: 'No Plan',     short: 'No Plan',    color: 'text-slate-500 bg-slate-100 border-slate-200' },
};

const PAYMENT_STATE_META: Record<PaymentState, { label: string; color: string; paying: boolean }> = {
  paid:          { label: 'Paid',            color: 'text-green-700',  paying: true },
  employer_paid: { label: 'Employer paid',   color: 'text-indigo-700', paying: true },
  comped:        { label: '$0 / comped',     color: 'text-sky-700',    paying: false },
  incomplete:    { label: 'Never completed', color: 'text-amber-700',  paying: false },
  past_due:      { label: 'Past due',        color: 'text-red-600',    paying: false },
  cancelled:     { label: 'Cancelled',       color: 'text-red-600',    paying: false },
  none:          { label: 'Never enrolled',  color: 'text-slate-400',  paying: false },
};

// Ordered worst-to-best so sorting groups the problem accounts together
const PAYMENT_STATE_ORDER: PaymentState[] = [
  'none', 'incomplete', 'past_due', 'cancelled', 'comped', 'employer_paid', 'paid',
];

function derivePaymentState(source: BillingSource, subscriptionStatus?: string): PaymentState {
  if (source === 'list_bill') return 'employer_paid';
  if (source === 'comp') return 'comped';
  switch (subscriptionStatus) {
    // Still collecting through the end of the current period
    case 'active':
    case 'cancel_at_period_end':
      return 'paid';
    case 'draft':               return 'incomplete';
    case 'past_due':
    case 'payment_failed':
    case 'suspended':           return 'past_due';
    case 'cancelled':           return 'cancelled';
    default:                    return 'none';
  }
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  spouse: 'Spouse',
  child: 'Child',
  domestic_partner: 'Domestic partner',
  other: 'Other',
};

const SUB_COLORS: Record<string, string> = {
  active: 'text-green-700 bg-green-50',
  cancelled: 'text-red-600 bg-red-50',
  past_due: 'text-orange-600 bg-orange-50',
  payment_failed: 'text-red-600 bg-red-50',
  cancel_at_period_end: 'text-amber-700 bg-amber-50',
};

function FilterChip({ label, count, active, tone, onClick }: {
  label: string;
  count: number;
  active: boolean;
  tone: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-all ${
        active ? `${tone} ring-2 ring-offset-1 ring-blue-300` : `${tone} hover:brightness-95`
      }`}
    >
      {label}
      <span className="font-bold">{count}</span>
    </button>
  );
}

// Small render helpers for table cells
function Plain({ value, mono }: { value?: string | null; mono?: boolean }) {
  if (!value) return <span className="text-xs text-slate-300">—</span>;
  return <span className={mono ? 'font-mono text-xs text-slate-600' : 'text-slate-700'}>{value}</span>;
}

// ─── Configurable table columns ────────────────────────────────────────────────

interface DisplayColumn {
  key: string;
  label: string;
  defaultOn: boolean;
  fixed?: boolean;            // always shown (cannot be toggled off)
  align?: 'left' | 'center';
  sortValue: (u: UnifiedUser) => string | number;
  render: (u: UnifiedUser) => React.ReactNode;
}

const DISPLAY_COLUMNS: DisplayColumn[] = [
  {
    key: 'user', label: 'User', defaultOn: true, fixed: true,
    sortValue: (u) => (u.memberFirstName
      ? `${u.memberFirstName} ${u.memberLastName ?? ''}`
      : u.clerkName || u.clerkEmail || '').trim().toLowerCase(),
    render: (u) => {
      const displayName = u.memberFirstName
        ? `${u.memberFirstName} ${u.memberLastName ?? ''}`.trim()
        : u.clerkName || u.clerkEmail || '(unknown)';
      const displayEmail = u.memberEmail ?? u.clerkEmail ?? '—';
      return (
        <div className="flex items-center gap-2.5">
          {u.clerkImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
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
      );
    },
  },
  {
    key: 'created', label: 'Created', defaultOn: true,
    sortValue: (u) => u.systemCreatedAt ?? Number.POSITIVE_INFINITY,
    render: (u) => (
      u.systemCreatedAt
        ? <span className="text-xs text-slate-600 whitespace-nowrap">{fmt(u.systemCreatedAt)}</span>
        : <span className="text-xs text-slate-300">—</span>
    ),
  },
  {
    key: 'presence', label: 'System Presence', defaultOn: true,
    sortValue: (u) => u.presence,
    render: (u) => <PresenceBadge presence={u.presence} />,
  },
  {
    key: 'memberId', label: 'Member ID', defaultOn: true,
    sortValue: (u) => (u.memberId ?? '').toLowerCase(),
    render: (u) => <Plain value={u.memberId} mono />,
  },
  {
    key: 'memberType', label: 'Status', defaultOn: true,
    sortValue: (u) => (u.memberType ?? '').toLowerCase(),
    render: (u) => u.memberType
      ? <StatusBadge status={u.memberType} />
      : <span className="text-xs text-slate-300">—</span>,
  },
  {
    key: 'billing', label: 'Billing', defaultOn: true,
    sortValue: (u) => `${u.billingSource}:${PAYMENT_STATE_ORDER.indexOf(u.paymentState)}`,
    render: (u) => {
      const src = BILLING_SOURCE_META[u.billingSource];
      const pay = PAYMENT_STATE_META[u.paymentState];
      return (
        <div className="leading-tight">
          <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded border ${src.color}`}>
            {src.short}
          </span>
          <p className={`text-[11px] mt-0.5 whitespace-nowrap ${pay.color}`}>{pay.label}</p>
        </div>
      );
    },
  },
  {
    key: 'role', label: 'Role', defaultOn: true,
    sortValue: (u) => (!u.memberProfileId ? 'z' : u.memberRole === 'dependent' ? 'b' : 'a'),
    render: (u) => {
      if (!u.memberProfileId) return <span className="text-xs text-slate-300">—</span>;
      if (u.memberRole === 'dependent') {
        return (
          <div className="leading-tight">
            <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded border text-purple-700 bg-purple-50 border-purple-200">
              Dependent
            </span>
            <p className="text-[11px] text-slate-500 mt-0.5 whitespace-nowrap">
              {[RELATIONSHIP_LABELS[u.relationship ?? ''], u.primaryMemberName && `of ${u.primaryMemberName}`]
                .filter(Boolean).join(' ')}
            </p>
          </div>
        );
      }
      return (
        <div className="leading-tight">
          <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded border text-slate-700 bg-slate-50 border-slate-200">
            Primary
          </span>
          {!!u.dependentCount && (
            <p className="text-[11px] text-slate-500 mt-0.5 whitespace-nowrap">
              +{u.dependentCount} dependent{u.dependentCount === 1 ? '' : 's'}
            </p>
          )}
        </div>
      );
    },
  },
  {
    key: 'toothlens', label: 'Toothlens', defaultOn: true, align: 'center',
    sortValue: (u) => (u.hasToothlens ? (u.toothlensScans ?? 0) : -1),
    render: (u) => u.hasToothlens
      ? (
        <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
          <ScanLine size={10} /> {u.toothlensScans ?? 0}
        </span>
      )
      : <span className="text-xs text-slate-300">—</span>,
  },
  {
    key: 'subscription', label: 'Subscription', defaultOn: true,
    sortValue: (u) => (u.subscriptionStatus ?? '').toLowerCase(),
    render: (u) => u.subscriptionStatus
      ? (
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${SUB_COLORS[u.subscriptionStatus] ?? 'text-slate-600 bg-slate-100'}`}>
          {u.subscriptionStatus.replace(/_/g, ' ')}
          {u.entitlementCount ? ` · ${u.entitlementCount}` : ''}
        </span>
      )
      : <span className="text-xs text-slate-300">None</span>,
  },
  {
    key: 'census', label: 'Census', defaultOn: true,
    sortValue: (u) => (u.memberProfileId ? u.missingFields.length : -1),
    render: (u) => !u.memberProfileId
      ? <span className="text-xs text-slate-300">N/A</span>
      : u.missingFields.length === 0
        ? (
          <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded">
            <CheckCircle2 size={10} /> OK
          </span>
        )
        : (
          <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
            <AlertTriangle size={10} /> {u.missingFields.length} missing
          </span>
        ),
  },
  // ── Optional columns (off by default) ──
  {
    key: 'clerkCreated', label: 'Clerk Created', defaultOn: false,
    sortValue: (u) => u.clerkCreatedAt ?? Number.POSITIVE_INFINITY,
    render: (u) => u.clerkCreatedAt
      ? <span className="text-xs text-slate-600 whitespace-nowrap">{fmt(u.clerkCreatedAt)}</span>
      : <span className="text-xs text-slate-300">—</span>,
  },
  {
    key: 'memberCreated', label: 'Convex Created', defaultOn: false,
    sortValue: (u) => u.memberCreatedAt ?? Number.POSITIVE_INFINITY,
    render: (u) => u.memberCreatedAt
      ? <span className="text-xs text-slate-600 whitespace-nowrap">{fmt(u.memberCreatedAt)}</span>
      : <span className="text-xs text-slate-300">—</span>,
  },
  {
    key: 'memberEmail', label: 'Member Email', defaultOn: false,
    sortValue: (u) => (u.memberEmail ?? '').toLowerCase(),
    render: (u) => <Plain value={u.memberEmail} />,
  },
  {
    key: 'clerkEmail', label: 'Clerk Email', defaultOn: false,
    sortValue: (u) => (u.clerkEmail ?? '').toLowerCase(),
    render: (u) => <Plain value={u.clerkEmail} />,
  },
  {
    key: 'dob', label: 'DOB', defaultOn: false,
    sortValue: (u) => u.memberDob ?? '',
    render: (u) => <Plain value={u.memberDob} mono />,
  },
  {
    key: 'effective', label: 'Effective Date', defaultOn: false,
    sortValue: (u) => u.memberEffective ?? '',
    render: (u) => <Plain value={u.memberEffective} mono />,
  },
  {
    key: 'careingtonId', label: 'Careington ID', defaultOn: false,
    sortValue: (u) => (u.careingtonUniqueId ?? '').toLowerCase(),
    render: (u) => <Plain value={u.careingtonUniqueId} mono />,
  },
  {
    key: 'seqNum', label: 'Seq #', defaultOn: false,
    sortValue: (u) => u.careingtonSeqNum ?? '',
    render: (u) => <Plain value={u.careingtonSeqNum} mono />,
  },
  {
    key: 'entitlements', label: 'Entitlements', defaultOn: false, align: 'center',
    sortValue: (u) => u.entitlementCount ?? 0,
    render: (u) => <Plain value={u.entitlementCount != null ? String(u.entitlementCount) : undefined} mono />,
  },
  {
    key: 'location', label: 'Location', defaultOn: false,
    sortValue: (u) => (u.location ?? '').toLowerCase(),
    render: (u) => <Plain value={u.location} />,
  },
  {
    key: 'department', label: 'Department', defaultOn: false,
    sortValue: (u) => (u.department ?? '').toLowerCase(),
    render: (u) => <Plain value={u.department} />,
  },
  {
    key: 'city', label: 'City', defaultOn: false,
    sortValue: (u) => (u.memberAddress?.city ?? '').toLowerCase(),
    render: (u) => <Plain value={u.memberAddress?.city} />,
  },
  {
    key: 'state', label: 'State', defaultOn: false,
    sortValue: (u) => (u.memberAddress?.state ?? '').toLowerCase(),
    render: (u) => <Plain value={u.memberAddress?.state} mono />,
  },
  {
    key: 'clerkId', label: 'Clerk ID', defaultOn: false,
    sortValue: (u) => (u.clerkId ?? '').toLowerCase(),
    render: (u) => <Plain value={u.clerkId} mono />,
  },
  {
    key: 'organization', label: 'Organization', defaultOn: false,
    sortValue: (u) => (u.organizationName ?? '').toLowerCase(),
    render: (u) => <Plain value={u.organizationName} />,
  },
  {
    key: 'listBillStatus', label: 'List Bill Status', defaultOn: false,
    sortValue: (u) => (u.listBillStatus ?? '').toLowerCase(),
    render: (u) => <Plain value={u.listBillStatus} />,
  },
  {
    key: 'relationship', label: 'Relationship', defaultOn: false,
    sortValue: (u) => (u.relationship ?? '').toLowerCase(),
    render: (u) => <Plain value={RELATIONSHIP_LABELS[u.relationship ?? ''] ?? u.relationship} />,
  },
];

// Versioned: bumping resets saved selections so newly-added default columns appear.
const COLUMN_STORAGE_KEY = 'userAuditVisibleColumns.v2';
const DEFAULT_VISIBLE_COLUMNS = DISPLAY_COLUMNS.filter((c) => c.defaultOn || c.fixed).map((c) => c.key);


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

      const billingSource: BillingSource = (m.billingSource ?? 'none') as BillingSource;
      const subscriptionStatus: string | undefined =
        sub?.subscriptionStatus ?? m.subscriptionStatus ?? undefined;
      const paymentState = derivePaymentState(billingSource, subscriptionStatus);

      let presence: SystemPresence;
      if (!clerkId || !clerk) {
        presence = 'convex-only';
      } else if (
        sub?.hasDashboard ||
        subscriptionStatus === 'active' ||
        // List-bill members are actively covered but never hold a Stripe bundle
        billingSource === 'list_bill'
      ) {
        presence = 'both-active';
      } else if (subscriptionStatus) {
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
        memberCreatedAt: m.createdAt,
        memberAddress: m.address,
        careingtonUniqueId: m.careingtonUniqueId,
        careingtonSeqNum: m.careingtonSeqNum,
        hasToothlens: !!tl,
        toothlensUid: tl?.toothlensUid,
        toothlensScans: tl?.scanCount,
        subscriptionStatus,
        entitlementCount: sub?.entitlementCount ?? 0,
        billingSource,
        paymentState,
        listBillStatus: m.listBillStatus ?? undefined,
        organizationName: m.organizationName ?? undefined,
        memberRole: (m.memberRole ?? (m.primaryMemberId ? 'dependent' : 'primary')) as MemberRole,
        relationship: m.relationship ?? undefined,
        primaryMemberName: m.primaryMemberName ?? undefined,
        dependentCount: m.dependentCount ?? 0,
        ssn: (m as any).ssn ?? undefined,
        location: (m as any).location ?? undefined,
        department: (m as any).department ?? undefined,
        presence,
        missingFields: [],
        systemCreatedAt: (() => {
          const c = [m.createdAt, clerk?.createdAt].filter((x): x is number => typeof x === 'number');
          return c.length ? Math.min(...c) : undefined;
        })(),
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
        // No member profile means no enrollment ever completed
        billingSource: 'none',
        paymentState: derivePaymentState('none', sub?.subscriptionStatus),
        presence: 'clerk-only',
        missingFields: [],
        systemCreatedAt: u.createdAt,
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
  const [billingFilter, setBillingFilter] = useState<string>('all');
  const [payFilter, setPayFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  // ── Sorting ──────────────────────────────────────────────────────────────────
  // Default: chronological by when they were first added to our system (oldest first)
  const [sortKey, setSortKey] = useState<string>('created');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // ── Visible columns (persisted) ──────────────────────────────────────────────
  const [visibleCols, setVisibleCols] = useState<string[]>(DEFAULT_VISIBLE_COLUMNS);
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(COLUMN_STORAGE_KEY);
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr) && arr.every((x) => typeof x === 'string')) {
          setVisibleCols(arr);
        }
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(visibleCols));
    } catch { /* ignore */ }
  }, [visibleCols]);

  const enabledColumns = useMemo(
    () => DISPLAY_COLUMNS.filter((c) => c.fixed || visibleCols.includes(c.key)),
    [visibleCols]
  );

  const toggleColumn = (key: string) =>
    setVisibleCols((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );

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
      // Billing source filter (individual / list bill / comped / no plan)
      if (billingFilter !== 'all' && u.billingSource !== billingFilter) return false;
      // Payment filter — either the paying/not-paying rollup or a specific state
      if (payFilter === 'paying' || payFilter === 'not-paying') {
        if (PAYMENT_STATE_META[u.paymentState].paying !== (payFilter === 'paying')) return false;
      } else if (payFilter !== 'all' && u.paymentState !== payFilter) return false;
      // Primary / dependent filter — only meaningful for rows with a member profile
      if (roleFilter !== 'all') {
        if (!u.memberProfileId || (u.memberRole ?? 'primary') !== roleFilter) return false;
      }
      // Presence / data-quality filter
      if (presenceFilter === 'all') return true;
      if (presenceFilter === 'missing-census') return u.missingFields.length > 0;
      if (presenceFilter === 'has-toothlens') return u.hasToothlens;
      if (presenceFilter === 'no-toothlens') return !u.hasToothlens && !!u.memberProfileId;
      return u.presence === presenceFilter;
    });
  }, [unified, search, presenceFilter, showTerminated, statusFilter, subFilter, toothlensFilter, billingFilter, payFilter, roleFilter]);

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const col = DISPLAY_COLUMNS.find((c) => c.key === sortKey);
    const valueFor = col?.sortValue ?? ((u: UnifiedUser) => u.key);
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

  const billingStats = useMemo(() => ({
    individual: unified.filter((u) => u.billingSource === 'individual').length,
    listBill: unified.filter((u) => u.billingSource === 'list_bill').length,
    comped: unified.filter((u) => u.billingSource === 'comp').length,
    noPlan: unified.filter((u) => u.billingSource === 'none').length,
    paying: unified.filter((u) => PAYMENT_STATE_META[u.paymentState].paying).length,
    notPaying: unified.filter((u) => !PAYMENT_STATE_META[u.paymentState].paying).length,
    incomplete: unified.filter((u) => u.paymentState === 'incomplete').length,
    pastDue: unified.filter((u) => u.paymentState === 'past_due').length,
    primary: unified.filter((u) => u.memberProfileId && (u.memberRole ?? 'primary') === 'primary').length,
    dependents: unified.filter((u) => u.memberRole === 'dependent').length,
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
    toothlensFilter !== 'all' ||
    billingFilter !== 'all' ||
    payFilter !== 'all' ||
    roleFilter !== 'all';

  const clearAllFilters = () => {
    setSearch('');
    setPresenceFilter('all');
    setStatusFilter('all');
    setSubFilter('all');
    setToothlensFilter('all');
    setBillingFilter('all');
    setPayFilter('all');
    setRoleFilter('all');
  };

  // ── CSV column picker ──────────────────────────────────────────────────────
  const AUDIT_COLUMNS: { key: string; label: string; defaultOn: boolean; sensitive?: boolean; get: (u: UnifiedUser) => string }[] = [
    { key: 'presence',        label: 'Presence',              defaultOn: true,  get: (u) => u.presence },
    { key: 'systemCreated',   label: 'Created (System)',      defaultOn: true,  get: (u) => u.systemCreatedAt ? new Date(u.systemCreatedAt).toISOString().slice(0, 10) : '' },
    { key: 'firstName',       label: 'First Name',            defaultOn: true,  get: (u) => u.memberFirstName ?? u.clerkName?.split(' ')[0] ?? '' },
    { key: 'lastName',        label: 'Last Name',             defaultOn: true,  get: (u) => u.memberLastName ?? u.clerkName?.split(' ').slice(1).join(' ') ?? '' },
    { key: 'memberEmail',     label: 'Email (member)',        defaultOn: true,  get: (u) => u.memberEmail ?? '' },
    { key: 'clerkEmail',      label: 'Email (Clerk)',         defaultOn: false, get: (u) => u.clerkEmail ?? '' },
    { key: 'memberId',        label: 'Member ID',             defaultOn: true,  get: (u) => u.memberId ?? '' },
    { key: 'memberType',      label: 'Member Status',         defaultOn: true,  get: (u) => u.memberType ?? '' },
    { key: 'billingSource',   label: 'Billing Type',          defaultOn: true,  get: (u) => BILLING_SOURCE_META[u.billingSource].label },
    { key: 'paymentState',    label: 'Payment Status',        defaultOn: true,  get: (u) => PAYMENT_STATE_META[u.paymentState].label },
    { key: 'isPaying',        label: 'Paying?',               defaultOn: true,  get: (u) => (PAYMENT_STATE_META[u.paymentState].paying ? 'Yes' : 'No') },
    { key: 'listBillStatus',  label: 'List Bill Status',      defaultOn: false, get: (u) => u.listBillStatus ?? '' },
    { key: 'organization',    label: 'Organization',          defaultOn: false, get: (u) => u.organizationName ?? '' },
    { key: 'memberRole',      label: 'Member Role',           defaultOn: true,  get: (u) => (u.memberProfileId ? (u.memberRole === 'dependent' ? 'Dependent' : 'Primary') : '') },
    { key: 'relationship',    label: 'Relationship',          defaultOn: false, get: (u) => RELATIONSHIP_LABELS[u.relationship ?? ''] ?? u.relationship ?? '' },
    { key: 'primaryMember',   label: 'Primary Member',        defaultOn: false, get: (u) => u.primaryMemberName ?? '' },
    { key: 'dependentCount',  label: 'Dependents',            defaultOn: false, get: (u) => (u.memberRole === 'dependent' ? '' : String(u.dependentCount ?? 0)) },
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
            onClick={() => setShowColumnPicker(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            <Columns3 size={14} /> Columns
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

      {/* ── Billing & family breakdown (clickable filters) ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Who pays</span>
        <FilterChip
          label="Individual" count={billingStats.individual} tone={BILLING_SOURCE_META.individual.color}
          active={billingFilter === 'individual'}
          onClick={() => setBillingFilter(billingFilter === 'individual' ? 'all' : 'individual')}
        />
        <FilterChip
          label="List Bill" count={billingStats.listBill} tone={BILLING_SOURCE_META.list_bill.color}
          active={billingFilter === 'list_bill'}
          onClick={() => setBillingFilter(billingFilter === 'list_bill' ? 'all' : 'list_bill')}
        />
        <FilterChip
          label="Comped" count={billingStats.comped} tone={BILLING_SOURCE_META.comp.color}
          active={billingFilter === 'comp'}
          onClick={() => setBillingFilter(billingFilter === 'comp' ? 'all' : 'comp')}
        />
        <FilterChip
          label="No Plan" count={billingStats.noPlan} tone={BILLING_SOURCE_META.none.color}
          active={billingFilter === 'none'}
          onClick={() => setBillingFilter(billingFilter === 'none' ? 'all' : 'none')}
        />

        <span className="w-px h-5 bg-slate-200 mx-1.5" />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Paid</span>
        <FilterChip
          label="Paying" count={billingStats.paying} tone="text-green-700 bg-green-50 border-green-200"
          active={payFilter === 'paying'}
          onClick={() => setPayFilter(payFilter === 'paying' ? 'all' : 'paying')}
        />
        <FilterChip
          label="Not paying" count={billingStats.notPaying} tone="text-slate-600 bg-slate-100 border-slate-200"
          active={payFilter === 'not-paying'}
          onClick={() => setPayFilter(payFilter === 'not-paying' ? 'all' : 'not-paying')}
        />
        <FilterChip
          label="Never completed checkout" count={billingStats.incomplete} tone="text-amber-700 bg-amber-50 border-amber-200"
          active={payFilter === 'incomplete'}
          onClick={() => setPayFilter(payFilter === 'incomplete' ? 'all' : 'incomplete')}
        />
        <FilterChip
          label="Past due" count={billingStats.pastDue} tone="text-red-700 bg-red-50 border-red-200"
          active={payFilter === 'past_due'}
          onClick={() => setPayFilter(payFilter === 'past_due' ? 'all' : 'past_due')}
        />

        <span className="w-px h-5 bg-slate-200 mx-1.5" />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Family</span>
        <FilterChip
          label="Primary" count={billingStats.primary} tone="text-slate-700 bg-slate-50 border-slate-200"
          active={roleFilter === 'primary'}
          onClick={() => setRoleFilter(roleFilter === 'primary' ? 'all' : 'primary')}
        />
        <FilterChip
          label="Dependent" count={billingStats.dependents} tone="text-purple-700 bg-purple-50 border-purple-200"
          active={roleFilter === 'dependent'}
          onClick={() => setRoleFilter(roleFilter === 'dependent' ? 'all' : 'dependent')}
        />
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
        {/* Payment status filter */}
        <select
          value={payFilter}
          onChange={(e) => setPayFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"
          title="Filter by payment status"
        >
          <option value="all">All Payment States</option>
          <option value="paying">Paying (any source)</option>
          <option value="not-paying">Not paying</option>
          <optgroup label="Specific">
            {PAYMENT_STATE_ORDER.map((s) => (
              <option key={s} value={s}>{PAYMENT_STATE_META[s].label}</option>
            ))}
          </optgroup>
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
                {enabledColumns.map((col) => (
                  <SortableTh
                    key={col.key}
                    label={col.label}
                    sortKey={col.key}
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                    align={col.align}
                  />
                ))}
                <th className="w-10 px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dataLoading ? (
                <tr>
                  <td colSpan={enabledColumns.length + 2} className="px-4 py-12 text-center text-slate-400">
                    <Loader size={18} className="animate-spin inline mr-2" />
                    Loading users from Clerk, Convex, and Toothlens…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={enabledColumns.length + 2} className="px-4 py-10 text-center text-slate-400">
                    No users match the current filters.
                  </td>
                </tr>
              ) : (
                sorted.map((u) => (
                  <UserRow
                    key={u.key}
                    user={u}
                    columns={enabledColumns}
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
              <button onClick={() => setExportEnabled(['firstName', 'lastName', 'memberEmail', 'memberId', 'memberType', 'billingSource', 'paymentState', 'isPaying', 'listBillStatus', 'organization', 'memberRole', 'relationship', 'primaryMember', 'dependentCount', 'subStatus'])} className="px-3 py-1 text-xs rounded border border-slate-300 hover:bg-slate-50">Billing &amp; Family</button>
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

      {/* ── Table column picker modal ── */}
      {showColumnPicker && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Table Columns</h2>
              <button onClick={() => setShowColumnPicker(false)} className="text-slate-400 hover:text-slate-700 text-lg leading-none">&times;</button>
            </div>
            <p className="text-xs text-slate-500">
              Choose which data points appear as columns in the table. Your selection is saved on this device.
            </p>
            {/* Presets */}
            <div className="flex gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-500 self-center">Presets:</span>
              <button onClick={() => setVisibleCols(DEFAULT_VISIBLE_COLUMNS)} className="px-3 py-1 text-xs rounded border border-slate-300 hover:bg-slate-50">Default</button>
              <button onClick={() => setVisibleCols(DISPLAY_COLUMNS.map((c) => c.key))} className="px-3 py-1 text-xs rounded border border-slate-300 hover:bg-slate-50">Show all</button>
              <button onClick={() => setVisibleCols(DISPLAY_COLUMNS.filter((c) => c.fixed).map((c) => c.key))} className="px-3 py-1 text-xs rounded border border-slate-300 hover:bg-slate-50">Minimal</button>
            </div>
            {/* Column checkboxes */}
            <div className="grid grid-cols-2 gap-1 max-h-72 overflow-y-auto pr-1">
              {DISPLAY_COLUMNS.map((col) => (
                <label
                  key={col.key}
                  className={`flex items-center gap-2 text-sm rounded px-2 py-1.5 ${col.fixed ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-50'}`}
                >
                  <input
                    type="checkbox"
                    checked={col.fixed || visibleCols.includes(col.key)}
                    disabled={col.fixed}
                    onChange={() => toggleColumn(col.key)}
                    className="rounded border-slate-300"
                  />
                  <span className="text-slate-700">
                    {col.label}{col.fixed && <span className="text-xs text-slate-400"> (always)</span>}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="text-xs text-slate-400">{enabledColumns.length} column{enabledColumns.length !== 1 ? 's' : ''} shown</span>
              <button
                onClick={() => setShowColumnPicker(false)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Done
              </button>
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
  user: u, columns, isExpanded, onToggle,
}: {
  user: UnifiedUser;
  columns: DisplayColumn[];
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={`hover:bg-slate-50 cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50/40' : ''}`}
      >
        <td className="px-3 py-3 text-slate-400">
          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </td>

        {columns.map((col) => (
          <td key={col.key} className={`px-4 py-3 ${col.align === 'center' ? 'text-center' : ''}`}>
            {col.render(u)}
          </td>
        ))}

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
          <td colSpan={columns.length + 2} className="p-0 border-b border-slate-100">
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
