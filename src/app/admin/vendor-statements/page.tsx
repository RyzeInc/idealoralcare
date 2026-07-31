'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from 'convex/react';
import {
  AlertCircle,
  CalendarRange,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Clock,
  DollarSign,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  Plus,
  ScrollText,
  SlidersHorizontal,
  Table2,
  Wrench,
} from 'lucide-react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import {
  Breadcrumbs,
  Modal,
  SkeletonCard,
  SkeletonTable,
  Tooltip,
  useToast,
} from '@/components/admin/ui';
import { formatCurrency, formatDate } from '@/lib/admin-format';

// ---------------------------------------------------------------------------
// Recipients & statuses
// ---------------------------------------------------------------------------

const VENDORS = [
  { id: 'toothlens', name: 'Toothlens' },
  { id: 'careington', name: 'Careington' },
  { id: 'ideal', name: 'Ideal Health' },
  { id: 'ryze', name: 'Ryze' },
] as const;

type VendorId = (typeof VENDORS)[number]['id'];

type StatementStatus = 'draft' | 'issued' | 'partial' | 'paid' | 'voided';

const STATUS_LABELS: Record<StatementStatus, string> = {
  draft: 'Draft',
  issued: 'Issued',
  partial: 'Partial',
  paid: 'Paid',
  voided: 'Voided',
};

const STATUS_COLORS: Record<StatementStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  issued: 'bg-blue-100 text-blue-700',
  partial: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-green-100 text-green-700',
  voided: 'bg-slate-200 text-slate-500 line-through',
};

type SortKey =
  | 'statementNumber'
  | 'statementDate'
  | 'vendorName'
  | 'period'
  | 'primaryCount'
  | 'totalCents'
  | 'balanceCents'
  | 'status';

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <ChevronsUpDown size={12} className="text-slate-300" />;
  return dir === 'asc'
    ? <ChevronUp size={12} className="text-blue-600" />
    : <ChevronDown size={12} className="text-blue-600" />;
}

function SortableHeader({
  label,
  sortBy,
  hint,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  sortBy: SortKey;
  hint?: string;
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
}) {
  return (
    <th
      className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none hover:text-slate-700"
      onClick={() => onSort(sortBy)}
    >
      <span className="flex items-center gap-1">
        {hint ? (
          <Tooltip text={hint} width="lg">
            <span className="cursor-help border-b border-dashed border-slate-400">{label}</span>
          </Tooltip>
        ) : (
          label
        )}
        <SortIcon active={sortKey === sortBy} dir={sortDir} />
      </span>
    </th>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
}) {
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

// ---------------------------------------------------------------------------
// Generate one recipient's statement — with a live preview of the document
// before any number is burned.
// ---------------------------------------------------------------------------

function GenerateStatementModal({
  periods,
  onClose,
}: {
  periods: string[];
  onClose: (statementId?: Id<'vendorStatements'>) => void;
}) {
  const toast = useToast();
  const generate = useMutation(api.admin.vendorStatements.generateStatement);
  const [period, setPeriod] = useState(periods[0] ?? '');
  const [vendor, setVendor] = useState<VendorId>('toothlens');
  const [submitting, setSubmitting] = useState(false);

  const preview = useQuery(
    api.admin.vendorStatements.previewStatement,
    period ? { period, vendor } : 'skip',
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!period) return;
    setSubmitting(true);
    try {
      const result = await generate({ period, vendor });
      toast.success(
        result.created
          ? 'Statement generated as a draft'
          : 'A live statement already exists for this recipient and month',
      );
      onClose(result.statementId);
    } catch (error) {
      toast.error((error as Error).message ?? 'Could not generate the statement');
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      title="Generate Statement"
      description="Creates a draft for one recipient. Nothing is sent until you issue it."
      size="max-w-2xl"
      onClose={() => onClose()}
    >
      <form onSubmit={handleSubmit} className="space-y-4 p-1">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Coverage Month
            </label>
            <select
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              required
            >
              {periods.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Recipient
            </label>
            <select
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"
              value={vendor}
              onChange={(event) => setVendor(event.target.value as VendorId)}
            >
              {VENDORS.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
          {preview === undefined ? (
            <p className="text-sm text-slate-400">Building preview…</p>
          ) : (
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-slate-500">Basis of payment</dt>
              <dd className="text-slate-800 text-right">{preview.basis}</dd>
              <dt className="text-slate-500">Covered primaries</dt>
              <dd className="text-slate-800 text-right">{preview.primaryCount}</dd>
              <dt className="text-slate-500">Subtotal</dt>
              <dd className="text-slate-800 text-right">
                {formatCurrency(preview.subtotalCents, { fromCents: true })}
              </dd>
              {preview.adjustmentCents !== 0 && (
                <>
                  <dt className="text-slate-500">Adjustments</dt>
                  <dd className="text-slate-800 text-right">
                    {formatCurrency(preview.adjustmentCents, { fromCents: true })}
                  </dd>
                </>
              )}
              <dt className="font-semibold text-slate-700">Statement total</dt>
              <dd className="font-semibold text-slate-900 text-right">
                {formatCurrency(preview.totalCents, { fromCents: true })}
              </dd>
            </dl>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={() => onClose()}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !period || preview === undefined}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Generating…' : 'Generate Draft'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Generate the whole coverage month — every recipient in one pass.
// ---------------------------------------------------------------------------

function GenerateMonthModal({
  periods,
  onClose,
}: {
  periods: Array<{ period: string; statementCount: number; missingVendors: string[] }>;
  onClose: (ran: boolean) => void;
}) {
  const toast = useToast();
  const generateAll = useMutation(api.admin.vendorStatements.generateStatementsForPeriod);
  const [period, setPeriod] = useState(
    periods.find((item) => item.missingVendors.length > 0)?.period ?? periods[0]?.period ?? '',
  );
  const [running, setRunning] = useState(false);

  const selected = periods.find((item) => item.period === period);

  async function handleConfirm() {
    if (!period) return;
    setRunning(true);
    try {
      const result = await generateAll({ period });
      toast.success(
        `Generated ${result.generated} statement(s) for ${period}` +
          (result.skipped > 0 ? ` — ${result.skipped} already existed` : ''),
      );
      onClose(true);
    } catch (error) {
      toast.error((error as Error).message ?? 'Generation failed');
      setRunning(false);
    }
  }

  return (
    <Modal
      open
      title="Generate All Statements for a Coverage Month"
      description="One draft per recipient. Recipients that already have a live statement are skipped."
      onClose={() => onClose(false)}
    >
      <div className="space-y-4 p-1">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Coverage Month
          </label>
          <select
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
          >
            {periods.map((item) => (
              <option key={item.period} value={item.period}>
                {item.period} — {item.statementCount}/4 recipients done
              </option>
            ))}
          </select>
        </div>

        {selected && (
          <p className="text-sm text-slate-600">
            {selected.missingVendors.length === 0
              ? 'Every recipient already has a live statement for this month. Running this again will do nothing.'
              : `Will create drafts for: ${selected.missingVendors
                  .map((id) => VENDORS.find((v) => v.id === id)?.name ?? id)
                  .join(', ')}.`}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => onClose(false)}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={running || !period}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {running ? 'Running…' : 'Generate Month'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Member-detail backfill — for months closed before per-member lines existed
// ---------------------------------------------------------------------------

function BackfillModal({
  periods,
  onClose,
}: {
  periods: string[];
  onClose: () => void;
}) {
  const toast = useToast();
  const backfill = useMutation(api.admin.invoiceCalculator.backfillMemberLines);
  const [period, setPeriod] = useState(periods[0] ?? '');
  const [running, setRunning] = useState(false);

  const preview = useQuery(
    api.admin.invoiceCalculator.previewMemberLineBackfill,
    period ? { period } : 'skip',
  );

  async function handleRun() {
    setRunning(true);
    try {
      const result = await backfill({ period });
      toast.success(
        `Filled member detail for ${result.filled} group(s)` +
          (result.skipped > 0 ? `, skipped ${result.skipped}` : ''),
      );
      onClose();
    } catch (error) {
      toast.error((error as Error).message ?? 'Backfill failed');
      setRunning(false);
    }
  }

  return (
    <Modal
      open
      title="Add Member Detail to a Closed Month"
      description="Rebuilds the per-member lines for a month that was closed before they were recorded."
      size="max-w-2xl"
      onClose={onClose}
    >
      <div className="space-y-4 p-1">
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
          <p className="font-semibold">Money is never touched</p>
          <p>
            Member lines are attached only where the rebuilt roster reproduces the
            closed totals to the cent. Any group that does not reconcile is skipped
            and listed, never adjusted. Totals, hashes, and close metadata are left
            exactly as they are.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Coverage Month
          </label>
          <select
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
          >
            {periods.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>

        {preview === undefined ? (
          <p className="text-sm text-slate-400">Checking…</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2">
                <p className="text-xs text-green-800">Can be filled</p>
                <p className="text-xl font-bold text-green-900">{preview.fillable}</p>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-xs text-amber-800">Will be skipped</p>
                <p className="text-xl font-bold text-amber-900">{preview.blocked}</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-600">Already have detail</p>
                <p className="text-xl font-bold text-slate-800">{preview.untouched}</p>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto rounded-md border border-slate-200">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500 uppercase">Organization</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500 uppercase">Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.rows.map((row) => (
                    <tr key={String(row.periodId)}>
                      <td className="px-3 py-1.5 text-slate-700">
                        {row.groupName}
                        <span className="text-slate-400 font-mono"> · {row.groupCode}</span>
                      </td>
                      <td
                        className={`px-3 py-1.5 ${
                          row.alreadyHasDetail
                            ? 'text-slate-400'
                            : row.reconciles
                              ? 'text-green-700'
                              : 'text-amber-700'
                        }`}
                      >
                        {row.detail}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleRun}
            disabled={running || !preview || preview.fillable === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {running ? 'Filling…' : `Fill ${preview?.fillable ?? 0} group(s)`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function VendorStatementsPage() {
  const [periodFilter, setPeriodFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('statementNumber');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showGenerate, setShowGenerate] = useState(false);
  const [showGenerateMonth, setShowGenerateMonth] = useState(false);
  const [showBackfill, setShowBackfill] = useState(false);

  const periods = useQuery(api.admin.vendorStatements.listStatementPeriods);
  const statements = useQuery(api.admin.vendorStatements.listStatements, {
    period: periodFilter || undefined,
    vendor: (vendorFilter || undefined) as VendorId | undefined,
    status: statusFilter || undefined,
    limit: 500,
  });

  const periodKeys = useMemo(() => (periods ?? []).map((p) => p.period), [periods]);
  // The month a bulk download acts on: whatever is filtered, else the newest.
  const bundlePeriod = periodFilter || periodKeys[0] || '';

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sorted = useMemo(() => {
    if (!statements) return [];
    return [...statements].sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      switch (sortKey) {
        case 'statementNumber': return mul * (a.statementNumber - b.statementNumber);
        case 'statementDate': return mul * (a.statementDate - b.statementDate);
        case 'vendorName': return mul * a.vendorName.localeCompare(b.vendorName);
        case 'period': return mul * a.period.localeCompare(b.period);
        case 'primaryCount': return mul * (a.primaryCount - b.primaryCount);
        case 'totalCents': return mul * (a.totalCents - b.totalCents);
        case 'balanceCents': return mul * (a.balanceCents - b.balanceCents);
        case 'status': return mul * a.status.localeCompare(b.status);
        default: return 0;
      }
    });
  }, [statements, sortKey, sortDir]);

  const stats = useMemo(() => {
    if (!statements) return null;
    const live = statements.filter((s) => s.status !== 'voided');
    return {
      count: live.length,
      remitted: live.reduce((sum, s) => sum + s.amountPaidCents, 0),
      outstanding: live.reduce(
        (sum, s) => sum + (s.status === 'paid' ? 0 : s.balanceCents),
        0,
      ),
      overdue: live.filter((s) => s.overdue).length,
    };
  }, [statements]);

  const sortProps = { sortKey, sortDir, onSort: handleSort };

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Breadcrumbs
            items={[{ label: 'Admin', href: '/admin' }, { label: 'Vendor Statements' }]}
          />
          <h1 className="text-2xl font-bold text-slate-900 mt-1 flex items-center gap-2">
            <FileCheck2 size={24} className="text-blue-600" />
            Vendor Statements
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            What each partner earned for a completed coverage month, drawn from that
            month&apos;s closed books
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Tooltip
            text="Every change to what partners are shown, sent, and paid — who made it and when."
            width="lg"
          >
            <Link
              href="/admin/vendor-statements/activity"
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
            >
              <ScrollText size={14} />
              Activity
            </Link>
          </Tooltip>
          <Tooltip
            text="Choose what each recipient is shown on their statement — employer group, rate class, rep attribution — and save it as their default."
            width="lg"
          >
            <Link
              href="/admin/vendor-statements/disclosure"
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
            >
              <SlidersHorizontal size={14} />
              Statement Contents
            </Link>
          </Tooltip>
          <Tooltip
            text="Cut a draft statement for every recipient for one coverage month in a single pass. Recipients that already have a live statement are skipped, so it is safe to re-run."
            width="lg"
          >
            <button
              onClick={() => setShowGenerateMonth(true)}
              disabled={periodKeys.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50"
            >
              <Layers size={14} />
              Generate Month
            </button>
          </Tooltip>
          <Tooltip
            text="Months closed before per-member lines were recorded show totals only. This rebuilds their member and rep detail without touching any figure."
            width="lg"
          >
            <button
              onClick={() => setShowBackfill(true)}
              disabled={periodKeys.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50"
            >
              <Wrench size={14} />
              Add Member Detail
            </button>
          </Tooltip>
          <Tooltip text="Cut a draft statement for a single recipient and coverage month." width="lg">
            <button
              onClick={() => setShowGenerate(true)}
              disabled={periodKeys.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              <Plus size={14} />
              Generate Statement
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Coverage rule — replaces the old, unexplained "financial close" chip */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 flex gap-3">
        <CalendarRange className="text-blue-700 shrink-0" size={20} />
        <div className="text-sm text-blue-950">
          <p className="font-semibold">How a coverage month is counted</p>
          <p>
            A month runs from 12:00 AM on the 1st through 11:59:59 PM UTC on its last
            day. A plan bought at 9 PM on May 31 is May revenue and is paid on the May
            statement. Once that month is closed its figures are fixed — a May
            statement printed in July still reports May, and corrections ride on
            adjustments rather than rewriting the document.
          </p>
        </div>
      </div>

      {/* Stat cards */}
      {!statements ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<FileCheck2 size={20} className="text-blue-600" />}
            label="Live Statements"
            value={String(stats?.count ?? 0)}
            accent="bg-blue-50"
          />
          <StatCard
            icon={<DollarSign size={20} className="text-green-600" />}
            label="Remitted"
            value={formatCurrency(stats?.remitted ?? 0, { fromCents: true })}
            accent="bg-green-50"
          />
          <StatCard
            icon={<Clock size={20} className="text-yellow-600" />}
            label="Owed to Partners"
            value={formatCurrency(stats?.outstanding ?? 0, { fromCents: true })}
            accent="bg-yellow-50"
          />
          <StatCard
            icon={<AlertCircle size={20} className="text-red-600" />}
            label="Past Due"
            value={String(stats?.overdue ?? 0)}
            accent="bg-red-50"
          />
        </div>
      )}

      {/* Filters + whole-month downloads */}
      <div className="bg-white rounded-lg shadow px-5 py-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Coverage Month
              </label>
              <select
                className="border border-slate-300 rounded-md px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-blue-500"
                value={periodFilter}
                onChange={(event) => setPeriodFilter(event.target.value)}
              >
                <option value="">All Months</option>
                {periodKeys.map((key) => (
                  <option key={key} value={key}>{key}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Recipient</label>
              <select
                className="border border-slate-300 rounded-md px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-blue-500"
                value={vendorFilter}
                onChange={(event) => setVendorFilter(event.target.value)}
              >
                <option value="">All Recipients</option>
                {VENDORS.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
              <select
                className="border border-slate-300 rounded-md px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-blue-500"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">All Statuses</option>
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            {(periodFilter || vendorFilter || statusFilter) && (
              <button
                onClick={() => {
                  setPeriodFilter('');
                  setVendorFilter('');
                  setStatusFilter('');
                }}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 pb-1.5"
              >
                <Filter size={13} />
                Clear filters
              </button>
            )}
          </div>

          {bundlePeriod && (
            <div className="flex items-end gap-2">
              <Tooltip
                text={`Download every live statement for ${bundlePeriod} in one file. This is the internal reconciliation copy — send partners their own statement from its detail page.`}
                width="lg"
              >
                <span className="text-xs font-medium text-slate-500 pb-2 cursor-help border-b border-dashed border-slate-400">
                  All of {bundlePeriod}
                </span>
              </Tooltip>
              <a
                href={`/api/admin/vendor-statements/period/${bundlePeriod}/document?format=pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
              >
                <FileText size={14} /> PDF
              </a>
              <a
                href={`/api/admin/vendor-statements/period/${bundlePeriod}/document?format=xlsx`}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
              >
                <FileSpreadsheet size={14} /> XLSX
              </a>
              <a
                href={`/api/admin/vendor-statements/period/${bundlePeriod}/document?format=csv`}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
              >
                <Table2 size={14} /> CSV
              </a>
            </div>
          )}
        </div>
      </div>

      {/* History */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {!statements ? (
          <SkeletonTable rows={8} cols={9} />
        ) : sorted.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <FileCheck2 size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">
              {periodKeys.length === 0
                ? 'No coverage month has been closed yet — close one in the Invoice Calculator first.'
                : 'No statements match these filters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <SortableHeader label="Statement #" sortBy="statementNumber" {...sortProps} />
                  <SortableHeader label="Statement Date" sortBy="statementDate" {...sortProps} />
                  <SortableHeader label="Recipient" sortBy="vendorName" {...sortProps} />
                  <SortableHeader label="Coverage" sortBy="period" {...sortProps} />
                  <SortableHeader
                    label="Primaries"
                    sortBy="primaryCount"
                    hint="Covered primary members this recipient is paid for. Dependents never create their own line."
                    {...sortProps}
                  />
                  <SortableHeader label="Total" sortBy="totalCents" {...sortProps} />
                  <SortableHeader
                    label="Balance"
                    sortBy="balanceCents"
                    hint="Still owed to this partner. Zero means fully remitted."
                    {...sortProps}
                  />
                  <SortableHeader
                    label="Status"
                    sortBy="status"
                    hint="Draft → Issued → Partial / Paid. Voided statements are replaced by a reissue."
                    {...sortProps}
                  />
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Documents
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map((row) => (
                  <tr key={row._id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-mono whitespace-nowrap">
                      <Link
                        href={`/admin/vendor-statements/${row._id}`}
                        className="text-blue-700 hover:underline"
                      >
                        {row.statementNumberDisplay}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
                      {formatDate(row.statementDate)}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-slate-800">
                      {row.vendorName}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-600">{row.period}</td>
                    <td className="px-3 py-2.5 text-right text-slate-700">
                      {row.primaryCount}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-slate-800 whitespace-nowrap">
                      {formatCurrency(row.totalCents, { fromCents: true })}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right font-medium whitespace-nowrap ${
                        row.balanceCents > 0 && row.status !== 'voided'
                          ? row.overdue ? 'text-red-600' : 'text-slate-700'
                          : 'text-slate-400'
                      }`}
                    >
                      {row.status !== 'voided' && row.balanceCents > 0
                        ? formatCurrency(row.balanceCents, { fromCents: true })
                        : '—'}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[row.status as StatementStatus]}`}
                      >
                        {STATUS_LABELS[row.status as StatementStatus] ?? row.status}
                      </span>
                      {row.overdue && (
                        <span className="ml-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          Past due
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-xs font-medium">
                        <a
                          href={`/api/admin/vendor-statements/${row._id}/document?format=pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800"
                        >
                          PDF
                        </a>
                        <a
                          href={`/api/admin/vendor-statements/${row._id}/document?format=xlsx`}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          XLSX
                        </a>
                        <a
                          href={`/api/admin/vendor-statements/${row._id}/document?format=csv`}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          CSV
                        </a>
                        <Link
                          href={`/admin/vendor-statements/${row._id}`}
                          className="text-slate-500 hover:text-slate-700"
                        >
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showGenerate && (
        <GenerateStatementModal
          periods={periodKeys}
          onClose={() => setShowGenerate(false)}
        />
      )}
      {showBackfill && (
        <BackfillModal periods={periodKeys} onClose={() => setShowBackfill(false)} />
      )}
      {showGenerateMonth && periods && (
        <GenerateMonthModal
          periods={periods}
          onClose={() => setShowGenerateMonth(false)}
        />
      )}
    </div>
  );
}
