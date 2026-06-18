'use client';

import { useState, useMemo } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import Link from 'next/link';
import {
  FileText,
  Plus,
  RefreshCw,
  DollarSign,
  Users,
  AlertCircle,
  CheckCircle,
  Clock,
  Filter,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
} from 'lucide-react';
import { Breadcrumbs, SkeletonTable, SkeletonCard, Modal, useToast, Tooltip } from '@/components/admin/ui';
import { formatCurrency, formatDateTime } from '@/lib/admin-format';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type InvoiceStatus =
  | 'draft'
  | 'issued'
  | 'paid'
  | 'partial'
  | 'overdue'
  | 'voided'
  | 'disputed';

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  issued: 'Issued',
  paid: 'Paid',
  partial: 'Partial',
  overdue: 'Overdue',
  voided: 'Voided',
  disputed: 'Disputed',
};

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  issued: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  partial: 'bg-yellow-100 text-yellow-700',
  overdue: 'bg-red-100 text-red-700',
  voided: 'bg-slate-200 text-slate-500 line-through',
  disputed: 'bg-orange-100 text-orange-700',
};

type SortKey =
  | 'invoiceNumber'
  | 'billingDate'
  | 'groupName'
  | 'coveragePeriod'
  | 'memberCount'
  | 'totalCents'
  | 'balanceCents'
  | 'status';

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <ChevronsUpDown size={12} className="text-slate-300" />;
  return dir === 'asc'
    ? <ChevronUp size={12} className="text-blue-600" />
    : <ChevronDown size={12} className="text-blue-600" />;
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
// Generate Invoice Modal
// ---------------------------------------------------------------------------

function GenerateInvoiceModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (id: Id<'listBillInvoices'>) => void;
}) {
  const toast = useToast();
  const generateInvoice = useMutation(api.admin.listBillInvoices.generateInvoice);
  const groups = useQuery(api.admin.billing.getListBillGroups) ?? [];
  const [groupId, setGroupId] = useState('');
  const [period, setPeriod] = useState(() => {
    const d = new Date();
    const y = d.getUTCMonth() === 11 ? d.getUTCFullYear() + 1 : d.getUTCFullYear();
    const m = d.getUTCMonth() === 11 ? 1 : d.getUTCMonth() + 2;
    return `${y}-${String(m).padStart(2, '0')}`;
  });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!groupId.trim() || !period.trim()) return;
    setSubmitting(true);
    try {
      const result = await generateInvoice({
        groupId: groupId.trim() as Id<'groups'>,
        coveragePeriod: period.trim(),
      });
      toast.success(
        result.created
          ? `Invoice created successfully`
          : `Invoice already exists for this period`,
      );
      onSuccess(result.invoiceId);
    } catch (err: unknown) {
      toast.error((err as Error).message ?? 'Failed to generate invoice');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open title="Generate Invoice" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4 p-1">
        <p className="text-xs text-slate-500 -mt-1">
          Creates a <strong>draft</strong> invoice for the selected employer group and coverage month.
          Existing non-voided invoices for the same group + period are skipped.
        </p>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Employer Group
          </label>
          {groups.length === 0 ? (
            <p className="text-xs text-slate-400">Loading groups…</p>
          ) : (
            <select
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              required
            >
              <option value="">Select a group…</option>
              {groups.map((g: any) => (
                <option key={g._id} value={g._id}>
                  {g.name ?? g.slug} {g.groupCode ? `(${g.groupCode})` : ''}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Coverage Month
          </label>
          <input
            type="month"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            required
          />
          <p className="text-xs text-slate-400 mt-1">The month this invoice covers (e.g. 2026-07 for July 2026).</p>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !groupId}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Generating…' : 'Generate Invoice'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Generate All Modal
// ---------------------------------------------------------------------------

function GenerateAllModal({
  period,
  onClose,
}: {
  period: string;
  onClose: (ran: boolean) => void;
}) {
  const toast = useToast();
  const generateMonthly = useMutation(api.admin.listBillInvoices.triggerMonthlyGeneration);
  const [running, setRunning] = useState(false);

  async function handleConfirm() {
    setRunning(true);
    try {
      const result = await generateMonthly({});
      toast.success(`Generated ${result.generated} invoice(s), skipped ${result.skipped} for ${period}`);
      onClose(true);
    } catch (err: unknown) {
      toast.error((err as Error).message ?? 'Generation failed');
      setRunning(false);
    }
  }

  return (
    <Modal open title={`Generate All Invoices — ${period}`} onClose={() => onClose(false)}>
      <div className="space-y-4 p-1">
        <p className="text-sm text-slate-600">
          This will create draft invoices for <strong>all active list-bill groups</strong>{' '}
          for period <code className="font-mono bg-slate-100 px-1 rounded">{period}</code>.
          Existing non-voided invoices will be skipped.
        </p>
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
            disabled={running}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {running ? 'Running…' : 'Generate All'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ListBillInvoicesPage() {
  const toast = useToast();

  // Filter state
  const [periodFilter, setPeriodFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Sort state
  const [sortKey, setSortKey] = useState<SortKey>('billingDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Modal state
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showGenerateAllModal, setShowGenerateAllModal] = useState(false);

  // Default next-month period for bulk generate
  const defaultNextPeriod = useMemo(() => {
    const d = new Date();
    const y = d.getUTCMonth() === 11 ? d.getUTCFullYear() + 1 : d.getUTCFullYear();
    const m = d.getUTCMonth() === 11 ? 1 : d.getUTCMonth() + 2;
    return `${y}-${String(m).padStart(2, '0')}`;
  }, []);

  // Data
  const invoices = useQuery(api.admin.listBillInvoices.listInvoices, {
    period: periodFilter || undefined,
    status: statusFilter || undefined,
    limit: 500,
  });

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sorted = useMemo(() => {
    if (!invoices) return [];
    return [...invoices].sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      switch (sortKey) {
        case 'invoiceNumber': return mul * (a.invoiceNumber - b.invoiceNumber);
        case 'billingDate': return mul * (a.billingDate - b.billingDate);
        case 'groupName': return mul * a.groupName.localeCompare(b.groupName);
        case 'coveragePeriod': return mul * a.coveragePeriod.localeCompare(b.coveragePeriod);
        case 'memberCount': return mul * (a.memberCount - b.memberCount);
        case 'totalCents': return mul * (a.totalCents - b.totalCents);
        case 'balanceCents': return mul * (a.balanceCents - b.balanceCents);
        case 'status': return mul * a.status.localeCompare(b.status);
        default: return 0;
      }
    });
  }, [invoices, sortKey, sortDir]);

  // Summary stats
  const stats = useMemo(() => {
    if (!invoices) return null;
    const active = invoices.filter((i) => i.status !== 'voided');
    const totalOutstanding = active.reduce(
      (sum, i) => sum + (i.status !== 'paid' ? i.balanceCents : 0),
      0,
    );
    const totalCollected = active.reduce((sum, i) => sum + i.amountPaidCents, 0);
    const overdueCount = active.filter((i) => i.status === 'overdue').length;
    return { count: active.length, totalOutstanding, totalCollected, overdueCount };
  }, [invoices]);

  function ThHeader({ label, k }: { label: string; k: SortKey }) {
    return (
      <th
        className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none hover:text-slate-700"
        onClick={() => handleSort(k)}
      >
        <span className="flex items-center gap-1">
          {label}
          <SortIcon active={sortKey === k} dir={sortDir} />
        </span>
      </th>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Breadcrumbs
            items={[{ label: 'Admin', href: '/admin' }, { label: 'List-Bill Invoices' }]}
          />
          <h1 className="text-2xl font-bold text-slate-900 mt-1 flex items-center gap-2">
            <FileText size={24} className="text-blue-600" />
            List-Bill Invoice Generator
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Employer-facing monthly invoices for payroll-deducted groups
          </p>
        </div>
        <div className="flex gap-2">
          <Tooltip
            text="Create draft invoices for ALL list-bill employer groups for next month in one click. Skips any group that already has a non-voided invoice for that period."
            width="lg"
          >
            <button
              onClick={() => setShowGenerateAllModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
            >
              <RefreshCw size={14} />
              Generate All for {defaultNextPeriod}
            </button>
          </Tooltip>
          <Tooltip
            text="Create a single draft invoice for a specific employer group and coverage month. Use this for one-off or out-of-cycle invoices."
            width="lg"
          >
            <button
              onClick={() => setShowGenerateModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              <Plus size={14} />
              Generate Invoice
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Stat cards */}
      {!invoices ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<FileText size={20} className="text-blue-600" />}
            label="Active Invoices"
            value={String(stats?.count ?? 0)}
            accent="bg-blue-50"
          />
          <StatCard
            icon={<DollarSign size={20} className="text-green-600" />}
            label="Collected (all time)"
            value={formatCurrency(stats?.totalCollected ?? 0, { fromCents: true })}
            accent="bg-green-50"
          />
          <StatCard
            icon={<Clock size={20} className="text-yellow-600" />}
            label="Outstanding Balance"
            value={formatCurrency(stats?.totalOutstanding ?? 0, { fromCents: true })}
            accent="bg-yellow-50"
          />
          <StatCard
            icon={<AlertCircle size={20} className="text-red-600" />}
            label="Overdue"
            value={String(stats?.overdueCount ?? 0)}
            accent="bg-red-50"
          />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow px-5 py-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Coverage Period
            </label>
            <input
              type="month"
              className="border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={periodFilter}
              onChange={(e) => {
                // convert YYYY-MM from input type=month
                setPeriodFilter(e.target.value);
              }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
            <select
              className="border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          {(periodFilter || statusFilter) && (
            <button
              onClick={() => { setPeriodFilter(''); setStatusFilter(''); }}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 pb-0.5"
            >
              <Filter size={13} />
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {!invoices ? (
          <SkeletonTable rows={8} cols={9} />
        ) : sorted.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <FileText size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No invoices found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <ThHeader label="Invoice #" k="invoiceNumber" />
                  <ThHeader label="Billing Date" k="billingDate" />
                  <ThHeader label="Group" k="groupName" />
                  <ThHeader label="Coverage" k="coveragePeriod" />
                  <ThHeader label="Members" k="memberCount" />
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <Tooltip text="Member Only / Member + Spouse / Member + Family — the three coverage tiers billed at different rates." width="lg">
                      <span className="cursor-help border-b border-dashed border-slate-400">MO / MS / MF</span>
                    </Tooltip>
                  </th>
                  <ThHeader label="Total" k="totalCents" />
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none hover:text-slate-700" onClick={() => handleSort('balanceCents')}>
                    <span className="flex items-center gap-1">
                      <Tooltip text="Amount still owed. Turns red when unpaid. Zero means paid in full.">
                        <span className="cursor-help border-b border-dashed border-slate-400">Balance</span>
                      </Tooltip>
                      <SortIcon active={sortKey === 'balanceCents'} dir={sortDir} />
                    </span>
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none hover:text-slate-700" onClick={() => handleSort('status')}>
                    <span className="flex items-center gap-1">
                      <Tooltip text="Draft → Issued → Paid / Partial / Overdue. Voided invoices are replaced." width="lg">
                        <span className="cursor-help border-b border-dashed border-slate-400">Status</span>
                      </Tooltip>
                      <SortIcon active={sortKey === 'status'} dir={sortDir} />
                    </span>
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map((inv) => (
                  <tr key={inv._id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-mono text-slate-700 whitespace-nowrap">
                      #{inv.invoiceNumberDisplay}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
                      {formatDateTime(inv.billingDate).split(',')[0]}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-slate-800 max-w-[180px] truncate">
                      <Link
                        href={`/admin/list-bill-invoices/${inv.groupId}`}
                        className="hover:underline text-blue-700"
                        title={inv.groupName}
                      >
                        {inv.groupName}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-600">
                      {inv.coveragePeriod}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-700">
                      {inv.memberCount}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
                      {inv.moCount} / {inv.msCount} / {inv.mfCount}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-slate-800 whitespace-nowrap">
                      {formatCurrency(inv.totalCents, { fromCents: true })}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right font-medium whitespace-nowrap ${
                        inv.balanceCents > 0 ? 'text-red-600' : 'text-slate-400'
                      }`}
                    >
                      {inv.balanceCents > 0
                        ? formatCurrency(inv.balanceCents, { fromCents: true })
                        : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[inv.status as InvoiceStatus]}`}
                      >
                        {STATUS_LABELS[inv.status as InvoiceStatus] ?? inv.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <Link
                        href={`/admin/list-bill-invoices/invoice/${inv._id}`}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {showGenerateModal && (
        <GenerateInvoiceModal
          onClose={() => setShowGenerateModal(false)}
          onSuccess={() => setShowGenerateModal(false)}
        />
      )}
      {showGenerateAllModal && (
        <GenerateAllModal
          period={defaultNextPeriod}
          onClose={() => setShowGenerateAllModal(false)}
        />
      )}
    </div>
  );
}
