'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import {
  Calculator,
  Download,
  Building2,
  Users,
  DollarSign,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ArrowLeft,
  Lock,
  Activity,
  Plus,
} from 'lucide-react';
import { Breadcrumbs, SkeletonTable, SkeletonCard, Modal, useToast } from '@/components/admin/ui';
import { formatCurrency, formatDateTime } from '@/lib/admin-format';

type Filter = 'all' | 'list_bill' | 'self_pay';
type SortKey =
  | 'organizationCode'
  | 'groupName'
  | 'accountName'
  | 'activeMemberCount'
  | 'individualPrimaryCount'
  | 'familyPrimaryCount'
  | 'dependentCount'
  | 'partnerVendorCents'
  | 'ryzeKeepCents'
  | 'grossCents';

const VENDOR_LABELS: Record<string, string> = {
  toothlens: 'Toothlens',
  careington: 'Careington',
  processing: 'Processing (Stripe/Ryze)',
  partnerVendor: 'Partner Vendor (Ideal Health)',
  ryzeKeep: 'Ryze Keep (carrier)',
};

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <ChevronsUpDown size={12} className="text-slate-300" />;
  return dir === 'asc'
    ? <ChevronUp size={12} className="text-blue-600" />
    : <ChevronDown size={12} className="text-blue-600" />;
}

function StatCard({
  icon, label, value, accent,
}: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-5 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${accent}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-slate-900 truncate">{value}</p>
      </div>
    </div>
  );
}

function currentLivePeriod(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export default function InvoiceCalculatorPage() {
  // ── Period selection ────────────────────────────────────────────────────
  // "live" → snapshot of current tables. "YYYY-MM" → period-aware lookup.
  const [periodMode, setPeriodMode] = useState<'live' | 'period'>('live');
  const [selectedPeriod, setSelectedPeriod] = useState<string>(currentLivePeriod());
  const effectivePeriod = periodMode === 'live' ? 'live' : selectedPeriod;

  // ── Drill-down state ────────────────────────────────────────────────────
  const [drillGroupId, setDrillGroupId] = useState<Id<'groups'> | null>(null);

  // ── Vendor export modal state ───────────────────────────────────────────
  const [vendorOpen, setVendorOpen] = useState<keyof typeof VENDOR_LABELS | null>(null);

  // ── Adjustment modal state ──────────────────────────────────────────────
  const [adjustOpen, setAdjustOpen] = useState(false);

  // ── Data ────────────────────────────────────────────────────────────────
  const data = useQuery(
    api.admin.invoiceCalculator.getInvoiceBreakdownForPeriod,
    { period: effectivePeriod === 'live' ? currentLivePeriod() : effectivePeriod },
  );
  const closedPeriods = useQuery(api.admin.invoiceCalculator.listClosedPeriods);
  const isLoading = data === undefined;

  const [filter, setFilter] = useState<Filter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('grossCents');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const filteredGroups = useMemo(() => {
    const rows = data?.groups ?? [];
    const filtered = rows.filter((r) => {
      if (filter === 'list_bill') return r.isListBill;
      if (filter === 'self_pay') return !r.isListBill;
      return true;
    });
    return [...filtered].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      const aTotals = a.totals as Record<string, number>;
      const bTotals = b.totals as Record<string, number>;
      const av: any = sortKey in aTotals ? aTotals[sortKey] : (a as any)[sortKey];
      const bv: any = sortKey in bTotals ? bTotals[sortKey] : (b as any)[sortKey];
      const an = av ?? '';
      const bn = bv ?? '';
      if (typeof an === 'number' && typeof bn === 'number') return (an - bn) * dir;
      return String(an).toLowerCase() < String(bn).toLowerCase() ? -1 * dir : 1 * dir;
    });
  }, [data, filter, sortKey, sortDir]);

  const handleExportCsv = () => {
    if (!data) return;
    const header = [
      'organization_code','group_code','group_name','account','billing_model',
      'active_members','individual_primaries','family_primaries','dependents','unbilled_primaries',
      'gross','toothlens','careington','processing','partner_vendor','ryze_keep',
    ].join(',') + '\n';
    const rows = filteredGroups.map((r) => [
      r.organizationCode ?? '',
      r.groupCode,
      r.groupName.replaceAll('"', '""'),
      (r.accountName ?? '').replaceAll('"', '""'),
      r.isListBill ? 'employer_paid' : 'self_pay',
      r.activeMemberCount,
      r.individualPrimaryCount,
      r.familyPrimaryCount,
      r.dependentCount,
      r.unbilledPrimaryCount,
      (r.totals.grossCents / 100).toFixed(2),
      (r.totals.toothlensCents / 100).toFixed(2),
      (r.totals.careingtonCents / 100).toFixed(2),
      (r.totals.processingCents / 100).toFixed(2),
      (r.totals.partnerVendorCents / 100).toFixed(2),
      (r.totals.ryzeKeepCents / 100).toFixed(2),
    ].map((v) => typeof v === 'string' ? `"${v}"` : v).join(',')).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice_calculator_${effectivePeriod}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Drill-down view
  if (drillGroupId) {
    return (
      <GroupDrillDown
        groupId={drillGroupId}
        period={effectivePeriod}
        onBack={() => setDrillGroupId(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Admin', href: '/admin' }, { label: 'Invoice Calculator' }]} />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <Calculator size={28} className="text-blue-600" />
            Invoice Calculator
          </h1>
          <p className="text-slate-600 mt-1 max-w-3xl">
            Per-member revenue and dispersal breakdown. Primary Individual = $14.99/mo,
            Primary Family = $24.99/mo, dependents = $0. Use this to invoice employer-paid
            groups and reconcile carrier payouts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodSelector
            mode={periodMode}
            period={selectedPeriod}
            closedPeriods={(closedPeriods ?? []).map((p) => p.period)}
            onChange={(mode, p) => { setPeriodMode(mode); if (p) setSelectedPeriod(p); }}
          />
          <button
            onClick={handleExportCsv}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg font-medium"
          >
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      {/* Source banner */}
      {!isLoading && (
        <div className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 ${
          data!.source === 'closed'
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            : 'bg-blue-50 text-blue-800 border border-blue-200'
        }`}>
          {data!.source === 'closed' ? <Lock size={14} /> : <Activity size={14} />}
          {data!.source === 'closed'
            ? <>Showing the <strong>closed snapshot</strong> for {data!.period}. This data is immutable.</>
            : <>Showing <strong>live data</strong> for {data!.period === 'live' ? 'right now' : data!.period}. Numbers will change as members enroll or terminate.</>
          }
        </div>
      )}

      {/* Stat cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<DollarSign size={20} className="text-green-600" />}
            accent="bg-green-100"
            label="Total Monthly Gross"
            value={formatCurrency(data!.grand.totals.grossCents, { fromCents: true })}
          />
          <StatCard
            icon={<Building2 size={20} className="text-blue-600" />}
            accent="bg-blue-100"
            label="Partner Vendor (Ideal Health)"
            value={formatCurrency(data!.grand.totals.partnerVendorCents, { fromCents: true })}
          />
          <StatCard
            icon={<DollarSign size={20} className="text-purple-600" />}
            accent="bg-purple-100"
            label="Ryze Net Keep"
            value={formatCurrency(data!.grand.totals.ryzeKeepCents, { fromCents: true })}
          />
          <StatCard
            icon={<Users size={20} className="text-amber-600" />}
            accent="bg-amber-100"
            label="Billable Primaries"
            value={`${data!.grand.individualPrimaryCount + data!.grand.familyPrimaryCount} (${data!.grand.individualPrimaryCount} ind / ${data!.grand.familyPrimaryCount} fam)`}
          />
        </div>
      )}

      {/* Dispersal summary */}
      {!isLoading && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Monthly Dispersal Breakdown</h2>
              <p className="text-sm text-slate-500">Where every dollar of gross revenue goes. Click a vendor to export its payable batch.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Bucket</th>
                  <th className="text-right px-5 py-3 font-medium">Per Individual ($14.99)</th>
                  <th className="text-right px-5 py-3 font-medium">Per Family ($24.99)</th>
                  <th className="text-right px-5 py-3 font-medium">Employer-Paid</th>
                  <th className="text-right px-5 py-3 font-medium">Self-Pay</th>
                  <th className="text-right px-5 py-3 font-medium">Grand Total</th>
                  <th className="text-right px-5 py-3 font-medium">Export</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {([
                  ['Toothlens',        'toothlensCents',     '$1.00', '$1.00', 'toothlens'],
                  ['Careington',       'careingtonCents',    '$2.00', '$2.00', 'careington'],
                  ['Processing (Stripe/Ryze)', 'processingCents', '$1.00', '$2.00', 'processing'],
                  ['Partner Vendor (Ideal Health)', 'partnerVendorCents', '$6.00', '$11.00', 'partnerVendor'],
                  ['Ryze Keep (carrier)', 'ryzeKeepCents',   '$4.99', '$8.99', 'ryzeKeep'],
                ] as const).map(([label, key, ind, fam, vendor]) => (
                  <tr key={key}>
                    <td className="px-5 py-3 font-medium text-slate-900">{label}</td>
                    <td className="px-5 py-3 text-right text-slate-600">{ind}</td>
                    <td className="px-5 py-3 text-right text-slate-600">{fam}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatCurrency(data!.employerPaid.totals[key], { fromCents: true })}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatCurrency(data!.selfPay.totals[key], { fromCents: true })}</td>
                    <td className="px-5 py-3 text-right tabular-nums font-semibold">{formatCurrency(data!.grand.totals[key], { fromCents: true })}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setVendorOpen(vendor)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Payables
                      </button>
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50">
                  <td className="px-5 py-3 font-bold text-slate-900">Gross</td>
                  <td className="px-5 py-3 text-right font-semibold">$14.99</td>
                  <td className="px-5 py-3 text-right font-semibold">$24.99</td>
                  <td className="px-5 py-3 text-right font-bold tabular-nums">{formatCurrency(data!.employerPaid.totals.grossCents, { fromCents: true })}</td>
                  <td className="px-5 py-3 text-right font-bold tabular-nums">{formatCurrency(data!.selfPay.totals.grossCents, { fromCents: true })}</td>
                  <td className="px-5 py-3 text-right font-bold tabular-nums">{formatCurrency(data!.grand.totals.grossCents, { fromCents: true })}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
          <p className="px-5 py-3 text-xs text-slate-500 border-t border-slate-200">
            Note: Stated splits sum to $15.00 / $25.00 per primary. Because actual gross is $14.99 / $24.99, the $0.01 rounding is absorbed by Ryze Keep ($4.99 / $8.99 net).
          </p>
        </div>
      )}

      {/* Period management toolbar — only when viewing a closed period */}
      {!isLoading && data!.source === 'closed' && (
        <div className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
          <div className="text-sm text-slate-600">
            Closed period — adjustments must be recorded as append-only corrections.
          </div>
          <button
            type="button"
            onClick={() => setAdjustOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-amber-100 text-amber-800 hover:bg-amber-200 rounded-lg font-medium"
          >
            <Plus size={14} /> Record adjustment
          </button>
        </div>
      )}

      {/* Filter pills */}
      <div className="flex items-center gap-2">
        {(['all','list_bill','self_pay'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm rounded-full border ${
              filter === f
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            {f === 'all' ? 'All Groups' : f === 'list_bill' ? 'Employer-Paid (List-Bill)' : 'Self-Pay'}
          </button>
        ))}
        {!isLoading && (
          <span className="text-sm text-slate-500 ml-2">
            {filteredGroups.length} group{filteredGroups.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {/* Per-group table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <SkeletonTable rows={6} cols={9} />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium cursor-pointer" onClick={() => toggleSort('organizationCode')}>
                    <span className="inline-flex items-center gap-1">Org Code <SortIcon active={sortKey === 'organizationCode'} dir={sortDir} /></span>
                  </th>
                  <th className="text-left px-4 py-3 font-medium cursor-pointer" onClick={() => toggleSort('groupName')}>
                    <span className="inline-flex items-center gap-1">Group <SortIcon active={sortKey === 'groupName'} dir={sortDir} /></span>
                  </th>
                  <th className="text-left px-4 py-3 font-medium cursor-pointer" onClick={() => toggleSort('accountName')}>
                    <span className="inline-flex items-center gap-1">Account <SortIcon active={sortKey === 'accountName'} dir={sortDir} /></span>
                  </th>
                  <th className="text-left px-4 py-3 font-medium">Billing</th>
                  <th className="text-right px-4 py-3 font-medium cursor-pointer" onClick={() => toggleSort('individualPrimaryCount')}>
                    <span className="inline-flex items-center gap-1">Ind <SortIcon active={sortKey === 'individualPrimaryCount'} dir={sortDir} /></span>
                  </th>
                  <th className="text-right px-4 py-3 font-medium cursor-pointer" onClick={() => toggleSort('familyPrimaryCount')}>
                    <span className="inline-flex items-center gap-1">Fam <SortIcon active={sortKey === 'familyPrimaryCount'} dir={sortDir} /></span>
                  </th>
                  <th className="text-right px-4 py-3 font-medium cursor-pointer" onClick={() => toggleSort('dependentCount')}>
                    <span className="inline-flex items-center gap-1">Deps <SortIcon active={sortKey === 'dependentCount'} dir={sortDir} /></span>
                  </th>
                  <th className="text-right px-4 py-3 font-medium cursor-pointer" onClick={() => toggleSort('partnerVendorCents')}>
                    <span className="inline-flex items-center gap-1">Partner Vendor <SortIcon active={sortKey === 'partnerVendorCents'} dir={sortDir} /></span>
                  </th>
                  <th className="text-right px-4 py-3 font-medium cursor-pointer" onClick={() => toggleSort('ryzeKeepCents')}>
                    <span className="inline-flex items-center gap-1">Ryze Keep <SortIcon active={sortKey === 'ryzeKeepCents'} dir={sortDir} /></span>
                  </th>
                  <th className="text-right px-4 py-3 font-medium cursor-pointer" onClick={() => toggleSort('grossCents')}>
                    <span className="inline-flex items-center gap-1">Gross <SortIcon active={sortKey === 'grossCents'} dir={sortDir} /></span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredGroups.length === 0 ? (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-500">No groups match the current filter.</td></tr>
                ) : filteredGroups.map((row) => (
                  <tr
                    key={row.groupId}
                    onClick={() => setDrillGroupId(row.groupId)}
                    className="hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="px-4 py-3 text-slate-700 font-mono text-xs">{row.organizationCode ?? row.groupCode}</td>
                    <td className="px-4 py-3 text-slate-900 font-medium">{row.groupName}</td>
                    <td className="px-4 py-3 text-slate-600">{row.accountName ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        row.isListBill
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {row.isListBill ? 'Employer-Paid' : 'Self-Pay'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.individualPrimaryCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.familyPrimaryCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-500">{row.dependentCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(row.totals.partnerVendorCents, { fromCents: true })}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(row.totals.ryzeKeepCents, { fromCents: true })}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">{formatCurrency(row.totals.grossCents, { fromCents: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Closed periods index */}
      {closedPeriods && closedPeriods.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Closed Period Archive</h2>
            <p className="text-sm text-slate-500">Immutable monthly snapshots written by the close cron.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Period</th>
                  <th className="text-left px-5 py-3 font-medium">Closed at (UTC)</th>
                  <th className="text-right px-5 py-3 font-medium">Groups</th>
                  <th className="text-right px-5 py-3 font-medium">Gross</th>
                  <th className="text-right px-5 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {closedPeriods.map((p) => (
                  <tr key={p.period} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-mono text-slate-900">{p.period}</td>
                    <td className="px-5 py-3 text-slate-600">{formatDateTime(p.closedAt)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{p.groupCount}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatCurrency(p.grossCents, { fromCents: true })}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => { setPeriodMode('period'); setSelectedPeriod(p.period); }}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Vendor payable export modal */}
      {vendorOpen && (
        <VendorPayableModal
          vendor={vendorOpen}
          period={effectivePeriod === 'live' ? currentLivePeriod() : effectivePeriod}
          onClose={() => setVendorOpen(null)}
        />
      )}

      {/* Adjustments modal — only meaningful for closed periods */}
      {adjustOpen && data?.source === 'closed' && (
        <AdjustmentModal
          period={data.period}
          onClose={() => setAdjustOpen(false)}
        />
      )}

      {/* Manual close button — for periods that ended but cron hasn't run */}
      {!isLoading && data!.source === 'live' && data!.period !== currentLivePeriod() && (
        <ManualClosePanel period={data!.period} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Period selector
// ---------------------------------------------------------------------------

function PeriodSelector({
  mode, period, closedPeriods, onChange,
}: {
  mode: 'live' | 'period';
  period: string;
  closedPeriods: string[];
  onChange: (mode: 'live' | 'period', period?: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg p-1">
      <button
        onClick={() => onChange('live')}
        className={`px-3 py-1.5 text-sm rounded-md font-medium ${
          mode === 'live'
            ? 'bg-blue-600 text-white'
            : 'text-slate-700 hover:bg-slate-50'
        }`}
      >
        Live
      </button>
      <input
        type="month"
        value={period}
        onChange={(e) => onChange('period', e.target.value)}
        className={`px-2 py-1 text-sm border rounded-md ${
          mode === 'period' ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-300'
        }`}
        list="closed-periods"
      />
      <datalist id="closed-periods">
        {closedPeriods.map((p) => <option key={p} value={p} />)}
      </datalist>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Group drill-down
// ---------------------------------------------------------------------------

function GroupDrillDown({
  groupId, period, onBack,
}: { groupId: Id<'groups'>; period: string; onBack: () => void }) {
  const data = useQuery(api.admin.invoiceCalculator.getGroupInvoice, {
    groupId,
    period: period === 'live' ? undefined : period,
  });
  const adjustments = useQuery(
    api.admin.invoiceCalculator.getAdjustmentsForPeriod,
    period !== 'live' ? { period } : 'skip',
  );
  const isLoading = data === undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            {isLoading ? 'Loading…' : (data!.group.organizationCode ?? data!.group.groupCode)}
          </h1>
          <p className="text-slate-600">
            {isLoading ? '' : <>{data!.group.groupName} — {data!.group.activeMemberCount} active members · period <span className="font-mono">{data!.period}</span> · <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${data!.source === 'closed' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>{data!.source}</span></>}
          </p>
        </div>
      </div>

      {!isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            icon={<DollarSign size={20} className="text-green-600" />}
            accent="bg-green-100"
            label="Gross (this period)"
            value={formatCurrency(data!.group.totals.grossCents, { fromCents: true })}
          />
          <StatCard
            icon={<Building2 size={20} className="text-blue-600" />}
            accent="bg-blue-100"
            label="Partner Vendor"
            value={formatCurrency(data!.group.totals.partnerVendorCents, { fromCents: true })}
          />
          <StatCard
            icon={<DollarSign size={20} className="text-purple-600" />}
            accent="bg-purple-100"
            label="Ryze Keep"
            value={formatCurrency(data!.group.totals.ryzeKeepCents, { fromCents: true })}
          />
        </div>
      )}

      {/* Member-level lines */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Member Lines</h2>
          {!isLoading && data!.source === 'closed' && (
            <p className="text-sm text-slate-500">
              Closed-period drill-down shows member identity only — per-member tier reconstruction
              requires the as-of bundle state. Snapshot totals above are authoritative.
            </p>
          )}
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <SkeletonTable rows={6} cols={6} />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Member ID</th>
                  <th className="text-left px-5 py-3 font-medium">Name</th>
                  <th className="text-left px-5 py-3 font-medium">Email</th>
                  <th className="text-left px-5 py-3 font-medium">Role</th>
                  <th className="text-left px-5 py-3 font-medium">Tier</th>
                  <th className="text-right px-5 py-3 font-medium">Contribution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data!.members.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-500">No active members.</td></tr>
                ) : data!.members.map((m) => (
                  <tr key={m.memberProfileId}>
                    <td className="px-5 py-3 font-mono text-xs text-slate-700">{m.memberId}</td>
                    <td className="px-5 py-3">{m.firstName} {m.lastName}</td>
                    <td className="px-5 py-3 text-slate-600">{m.email ?? '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        m.role === 'primary' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'
                      }`}>{m.role}</span>
                    </td>
                    <td className="px-5 py-3">
                      {m.tier === 'individual' ? <span className="text-slate-700">Individual</span>
                        : m.tier === 'family' ? <span className="text-slate-700">Family</span>
                        : m.unbilled ? <span className="text-amber-700">Unbilled</span>
                        : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {formatCurrency(m.contribution.grossCents, { fromCents: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Adjustments for this period (filtered to this group) */}
      {adjustments && adjustments.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Adjustments</h2>
            <p className="text-sm text-slate-500">Append-only corrections recorded against this period.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">When</th>
                  <th className="text-left px-5 py-3 font-medium">Reason</th>
                  <th className="text-left px-5 py-3 font-medium">Bucket</th>
                  <th className="text-right px-5 py-3 font-medium">Δ</th>
                  <th className="text-left px-5 py-3 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {adjustments.filter((a) => a.groupId === groupId).map((a) => (
                  <tr key={a._id}>
                    <td className="px-5 py-3 text-slate-600">{formatDateTime(a.createdAt)}</td>
                    <td className="px-5 py-3"><span className="font-mono text-xs">{a.reason}</span></td>
                    <td className="px-5 py-3"><span className="font-mono text-xs">{a.bucket}</span></td>
                    <td className={`px-5 py-3 text-right tabular-nums ${a.deltaCents < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                      {a.deltaCents < 0 ? '−' : '+'}
                      {formatCurrency(Math.abs(a.deltaCents), { fromCents: true })}
                    </td>
                    <td className="px-5 py-3 text-slate-700">{a.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vendor payable modal
// ---------------------------------------------------------------------------

function VendorPayableModal({
  vendor, period, onClose,
}: { vendor: keyof typeof VENDOR_LABELS; period: string; onClose: () => void }) {
  const data = useQuery(api.admin.invoiceCalculator.getVendorPayables, { vendor, period });

  const handleExport = () => {
    if (!data) return;
    const header = 'group_code,organization_code,group_name,individual_primaries,family_primaries,payable\n';
    const rows = data.rows.map((r) => [
      r.groupCode,
      r.organizationCode ?? '',
      r.groupName.replaceAll('"', '""'),
      r.individualPrimaryCount,
      r.familyPrimaryCount,
      (r.payableCents / 100).toFixed(2),
    ].map((v) => typeof v === 'string' ? `"${v}"` : v).join(',')).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${vendor}_payables_${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`${VENDOR_LABELS[vendor]} payables — ${period}`}
      description="Per-group payable batch derived from the invoice breakdown."
      size="max-w-3xl"
    >
      {!data ? (
        <SkeletonTable rows={6} cols={4} />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-700">
              Total payable: <span className="font-bold tabular-nums">{formatCurrency(data.totalCents, { fromCents: true })}</span>
            </div>
            <button
              type="button"
              onClick={handleExport}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              <Download size={14} /> Export CSV
            </button>
          </div>
          <div className="overflow-x-auto max-h-96 border border-slate-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Group</th>
                  <th className="text-right px-4 py-2 font-medium text-slate-600">Ind</th>
                  <th className="text-right px-4 py-2 font-medium text-slate-600">Fam</th>
                  <th className="text-right px-4 py-2 font-medium text-slate-600">Payable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.rows.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">No payables.</td></tr>
                ) : data.rows.map((r) => (
                  <tr key={r.groupId}>
                    <td className="px-4 py-2">
                      <div className="font-medium text-slate-900">{r.groupName}</div>
                      <div className="text-xs text-slate-500 font-mono">{r.organizationCode ?? r.groupCode}</div>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.individualPrimaryCount}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.familyPrimaryCount}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold">{formatCurrency(r.payableCents, { fromCents: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Adjustment modal
// ---------------------------------------------------------------------------

function AdjustmentModal({ period, onClose }: { period: string; onClose: () => void }) {
  const periodRows = useQuery(api.admin.invoiceCalculator.getInvoiceBreakdownForPeriod, { period });
  const recordAdjustment = useMutation(api.admin.invoiceCalculator.recordAdjustment);
  const { showToast } = useToast();

  const [groupId, setGroupId] = useState<Id<'groups'> | ''>('');
  const [reason, setReason] = useState<'refund' | 'chargeback' | 'retroactive_term' | 'retroactive_enrollment' | 'misclassification' | 'other'>('refund');
  const [bucket, setBucket] = useState<'gross' | 'toothlens' | 'careington' | 'processing' | 'partnerVendor' | 'ryzeKeep'>('gross');
  const [amountDollars, setAmountDollars] = useState<string>('');
  const [direction, setDirection] = useState<'-' | '+'>('-');
  const [notes, setNotes] = useState('');
  const [appliedToPeriod, setAppliedToPeriod] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId || !amountDollars || !notes.trim()) {
      showToast('Group, amount, and notes are required.', 'error');
      return;
    }
    // Look up the periodId for the chosen group via the breakdown rows;
    // we need to resolve via getInvoiceBreakdownForPeriod returning the
    // invoicePeriod row id. Closed snapshots embed `groupId` not periodId,
    // so we fetch periodId on submission via a dedicated query.
    setSubmitting(true);
    try {
      const groupRow = (periodRows?.groups ?? []).find((g) => g.groupId === groupId);
      if (!groupRow?.periodId) {
        throw new Error('Snapshot row not found for that group/period');
      }
      const periodId = groupRow.periodId;
      const cents = Math.round(parseFloat(amountDollars) * 100);
      if (!Number.isFinite(cents)) throw new Error('Amount must be a number');
      const signed = direction === '-' ? -cents : cents;
      await recordAdjustment({
        periodId,
        reason,
        bucket,
        deltaCents: signed,
        appliedToPeriod: appliedToPeriod || undefined,
        notes: notes.trim(),
      });
      showToast('Adjustment recorded.', 'success');
      onClose();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to record adjustment.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Record adjustment — ${period}`}
      description="Append-only correction to a closed period. Cannot be undone (record an offsetting adjustment instead)."
      size="max-w-lg"
      preventClose={submitting}
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Group *</label>
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value as Id<'groups'> | '')}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            required
          >
            <option value="">Select group…</option>
            {(periodRows?.groups ?? []).map((g) => (
              <option key={g.groupId} value={g.groupId}>
                {g.organizationCode ?? g.groupCode} — {g.groupName}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Reason *</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as typeof reason)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="refund">Refund</option>
              <option value="chargeback">Chargeback</option>
              <option value="retroactive_term">Retroactive termination</option>
              <option value="retroactive_enrollment">Retroactive enrollment</option>
              <option value="misclassification">Misclassification</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Bucket *</label>
            <select
              value={bucket}
              onChange={(e) => setBucket(e.target.value as typeof bucket)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="gross">Gross</option>
              <option value="toothlens">Toothlens</option>
              <option value="careington">Careington</option>
              <option value="processing">Processing</option>
              <option value="partnerVendor">Partner Vendor</option>
              <option value="ryzeKeep">Ryze Keep</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Direction</label>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as '-' | '+')}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="-">Debit (−)</option>
              <option value="+">Credit (+)</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Amount (USD) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amountDollars}
              onChange={(e) => setAmountDollars(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              placeholder="14.99"
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Applied to period (optional)</label>
          <input
            type="month"
            value={appliedToPeriod}
            onChange={(e) => setAppliedToPeriod(e.target.value)}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
          />
          <p className="text-xs text-slate-500 mt-1">When the cash actually moved, if different from the affected period (e.g. a chargeback weeks later).</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Notes *</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            placeholder="Stripe dispute du_xxx; member terminated 2026-04-15; etc."
            required
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white rounded-lg font-medium"
          >
            {submitting ? 'Recording…' : 'Record adjustment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Utility: look up the invoicePeriods row id is now done client-side
// from the breakdown response (groupRow.periodId).

// ---------------------------------------------------------------------------
// Manual close panel — only for past periods that haven't been closed yet
// ---------------------------------------------------------------------------

function ManualClosePanel({ period }: { period: string }) {
  const closePeriodManual = useMutation(api.admin.invoiceCalculator.closePeriodManual);
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const handleClose = async () => {
    const [yStr, mStr] = period.split('-');
    if (!yStr || !mStr) return;
    setSubmitting(true);
    try {
      const result = await closePeriodManual({ year: Number(yStr), month: Number(mStr) });
      if (result.skipped) {
        showToast('Period was already closed.', 'info');
      } else {
        showToast(`Closed ${result.period}: ${result.rowsWritten} group snapshots.`, 'success');
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Close failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between">
      <div className="text-sm text-amber-900">
        This period has ended but no snapshot exists. Run a manual close to lock it in.
      </div>
      <button
        type="button"
        onClick={handleClose}
        disabled={submitting}
        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white rounded-lg font-medium"
      >
        <Lock size={14} /> {submitting ? 'Closing…' : 'Close period now'}
      </button>
    </div>
  );
}
