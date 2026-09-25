'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Building2, ChevronRight, Inbox, Loader2, Plus, Search, X } from 'lucide-react';
import { StatusBadge } from '@/components/admin/ui';
import { formatDate } from '@/lib/admin-format';
import {
  TYPE_BADGE,
  TYPE_LABEL,
  cardCls,
  inputCls,
  labelCls,
  primaryBtn,
  secondaryBtn,
  type PartnerStatus,
  type PartnerType,
} from './shared';

type AccessFilter = 'all' | 'connected' | 'pending' | 'none';

const EMPTY_FILTERS = {
  search: '',
  status: 'active' as PartnerStatus | 'all',
  type: 'all' as PartnerType | 'all',
  upline: 'all',
  access: 'all' as AccessFilter,
  from: '',
  to: '',
};

/** Onboarded date: the agreement's effective date when recorded, else creation. */
function onboardedAt(p: { effectiveDate?: string; createdAt: number }): number {
  if (p.effectiveDate) {
    const [y, m, d] = p.effectiveDate.split('-').map(Number);
    if (y && m && d) return new Date(y, m - 1, d).getTime();
  }
  return p.createdAt;
}

function dayStart(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

export function BrokerDirectory() {
  const router = useRouter();
  const partners = useQuery(api.admin.distributionPartners.getAllWithStats);
  const pendingApplications = useQuery(api.repOnboarding.listForAdmin, { status: 'new' });
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const set = <K extends keyof typeof EMPTY_FILTERS>(key: K, value: (typeof EMPTY_FILTERS)[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  const byId = useMemo(() => new Map((partners ?? []).map((p) => [String(p._id), p])), [partners]);

  const uplineOptions = useMemo(
    () =>
      (partners ?? [])
        .filter((p) => (partners ?? []).some((c) => c.parentId === p._id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [partners],
  );

  const rows = useMemo(() => {
    if (!partners) return [];
    const q = filters.search.trim().toLowerCase();
    const from = filters.from ? dayStart(filters.from) : null;
    const to = filters.to ? dayStart(filters.to) + 86_400_000 - 1 : null;
    return partners
      .filter((p) => filters.status === 'all' || p.status === filters.status)
      .filter((p) => filters.type === 'all' || p.type === filters.type)
      .filter((p) =>
        filters.upline === 'all'
          ? true
          : filters.upline === 'none'
            ? !p.parentId
            : String(p.parentId) === filters.upline,
      )
      .filter((p) => {
        if (filters.access === 'all') return true;
        if (filters.access === 'connected') return p.linkedLeaderCount > 0 || !!p.clerkUserId;
        if (filters.access === 'pending') return p.pendingInviteCount > 0;
        return p.linkedLeaderCount === 0 && p.pendingInviteCount === 0 && !p.clerkUserId;
      })
      .filter((p) => {
        const at = onboardedAt(p);
        return (from == null || at >= from) && (to == null || at <= to);
      })
      .filter(
        (p) =>
          !q ||
          [p.name, p.contactName, p.contactEmail, p.agencyCode, p.npn]
            .filter(Boolean)
            .some((s) => String(s).toLowerCase().includes(q)),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [partners, filters]);

  const filtersActive = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 pb-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Brokers</h1>
          <p className="mt-1 text-sm text-slate-500">
            Program Managers, FMOs and agencies in the distribution chain: their people, access, codes and book.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/partner-applications" className={secondaryBtn}>
            <Inbox size={15} /> Applications
            {pendingApplications && pendingApplications.length > 0 && (
              <span className="rounded-full bg-amber-100 px-2 text-xs font-semibold text-amber-800">
                {pendingApplications.length} new
              </span>
            )}
          </Link>
          <Link href="/admin/brokers/new" className={primaryBtn}>
            <Plus size={16} /> Onboard broker
          </Link>
        </div>
      </header>

      <section className={cardCls} aria-label="Search brokers">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="xl:col-span-2">
            <label className={labelCls} htmlFor="broker-search">Search</label>
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="broker-search"
                className={`${inputCls} pl-9`}
                placeholder="Organization, contact, email, agency code or NPN"
                value={filters.search}
                onChange={(e) => set('search', e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="broker-status">Status</label>
            <select id="broker-status" className={inputCls} value={filters.status} onChange={(e) => set('status', e.target.value as PartnerStatus | 'all')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
              <option value="all">All statuses</option>
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="broker-type">Type</label>
            <select id="broker-type" className={inputCls} value={filters.type} onChange={(e) => set('type', e.target.value as PartnerType | 'all')}>
              <option value="all">All types</option>
              <option value="program_manager">Program Managers</option>
              <option value="fmo">FMOs</option>
              <option value="agency">Agencies</option>
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="broker-upline">Upline</label>
            <select id="broker-upline" className={inputCls} value={filters.upline} onChange={(e) => set('upline', e.target.value)}>
              <option value="all">Any upline</option>
              <option value="none">Independent (no upline)</option>
              {uplineOptions.map((p) => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="broker-access">Portal access</label>
            <select id="broker-access" className={inputCls} value={filters.access} onChange={(e) => set('access', e.target.value as AccessFilter)}>
              <option value="all">Any</option>
              <option value="connected">Someone connected</option>
              <option value="pending">Invite outstanding</option>
              <option value="none">Nobody invited or connected</option>
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="broker-from">Onboarded from</label>
            <input id="broker-from" type="date" className={inputCls} value={filters.from} onChange={(e) => set('from', e.target.value)} />
          </div>
          <div>
            <label className={labelCls} htmlFor="broker-to">Onboarded to</label>
            <input id="broker-to" type="date" className={inputCls} value={filters.to} onChange={(e) => set('to', e.target.value)} />
          </div>
        </div>
        {filtersActive && (
          <button type="button" className="mt-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700" onClick={() => setFilters(EMPTY_FILTERS)}>
            <X size={14} /> Reset filters
          </button>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {partners === undefined ? (
          <div role="status" className="flex items-center justify-center gap-2 p-12 text-slate-500">
            <Loader2 size={18} className="animate-spin" /> Loading brokers…
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center text-slate-500">
            <Building2 size={36} className="text-slate-300" />
            <p>{partners.length === 0 ? 'No brokers yet.' : 'No brokers match these filters.'}</p>
            {partners.length === 0 && (
              <Link href="/admin/brokers/new" className={primaryBtn}>
                <Plus size={16} /> Onboard your first broker
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Organization ({rows.length})</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Agency code</th>
                  <th className="px-4 py-3 font-medium">Upline</th>
                  <th className="px-4 py-3 font-medium">Primary contact</th>
                  <th className="px-4 py-3 font-medium">Team</th>
                  <th className="px-4 py-3 text-right font-medium">Active members</th>
                  <th className="px-4 py-3 font-medium">Onboarded</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-2 py-3" aria-hidden />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((p) => {
                  const href = `/admin/brokers/${p._id}`;
                  const upline = p.parentId ? byId.get(String(p.parentId)) : undefined;
                  return (
                    <tr
                      key={p._id}
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('a')) return;
                        router.push(href);
                      }}
                    >
                      <td className="px-4 py-3">
                        <Link href={href} className="font-medium text-slate-900 hover:text-teal-700">
                          {p.name}
                        </Link>
                        {p.npn && <div className="text-xs text-slate-500">NPN {p.npn}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${TYPE_BADGE[p.type]}`}>
                          {TYPE_LABEL[p.type]}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">{p.agencyCode ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {upline ? (
                          <Link href={`/admin/brokers/${upline._id}`} className="hover:text-teal-700">
                            {upline.name}
                          </Link>
                        ) : (
                          <span className="text-slate-400">Independent</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-800">{p.contactName}</div>
                        <div className="text-xs text-slate-500">{p.contactEmail}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {p.linkedLeaderCount}/{p.repCount} connected
                        {p.pendingInviteCount > 0 && (
                          <div className="text-xs text-purple-700">{p.pendingInviteCount} invite{p.pendingInviteCount === 1 ? '' : 's'} pending</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-800">{p.activeMemberCount}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(onboardedAt(p))}</td>
                      <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                      <td className="px-2 py-3 text-slate-300"><ChevronRight size={16} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
