'use client';

import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import Link from 'next/link';
import { use } from 'react';
import {
  ArrowLeft,
  Send,
  CreditCard,
  Pencil,
  Trash2,
  Download,
  FileText,
  CheckCircle,
  AlertCircle,
  Building2,
  Calendar,
  Users,
  RefreshCw,
  Settings2,
  History,
  Columns3,
} from 'lucide-react';
import { Breadcrumbs, SkeletonCard, Modal, useToast } from '@/components/admin/ui';
import { formatCurrency, formatDateTime } from '@/lib/admin-format';

// ---------------------------------------------------------------------------
// Types / helpers
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
  draft: 'bg-slate-100 text-slate-700',
  issued: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  partial: 'bg-yellow-100 text-yellow-700',
  overdue: 'bg-red-100 text-red-700',
  voided: 'bg-slate-200 text-slate-500',
  disputed: 'bg-orange-100 text-orange-700',
};

const TIER_LABELS: Record<string, string> = {
  MO: 'Member Only',
  MS: 'Member + Spouse',
  MF: 'Member + Family',
};

// ---------------------------------------------------------------------------
// Configurable invoice columns (printed table + CSV export)
//
// The set of parameters shown on a list-bill invoice is admin-configurable and
// persisted per-group via api.admin.listBillInvoices.{getInvoiceColumns,
// updateInvoiceColumns}. Each column key maps to a value getter here. To add a
// new parameter: add it to INVOICE_COLUMN_REGISTRY in the backend and add a
// getter below.
// ---------------------------------------------------------------------------

type InvoiceColumn = { key: string; label: string; enabled: boolean; sensitive?: boolean };

const SENSITIVE_KEYS = new Set(['ssn']);

const VALUE_GETTERS: Record<string, (inv: any, l: any) => string> = {
  memberId: (_, l) => l.memberId ?? '',
  groupMemberId: (_, l) => l.groupMemberId ?? '',
  lastName: (_, l) => l.lastName ?? '',
  firstName: (_, l) => l.firstName ?? '',
  employeeName: (_, l) =>
    l.lastName && l.firstName ? `${l.lastName}, ${l.firstName}` : (l.lastName ?? l.firstName ?? ''),
  ssn: (_, l) => l.ssn ?? '',
  companyName: (inv) => inv.groupName ?? '',
  invoiceNumber: (inv) => inv.invoiceNumberDisplay ?? '',
  coveragePeriod: (inv) => inv.coveragePeriod ?? '',
  location: (_, l) => l.location ?? '',
  department: (_, l) => l.department ?? '',
  tier: (_, l) => l.tier ?? '',
  tierCode: (_, l) => l.tierCode ?? '',
  dependentCount: (_, l) => String(l.dependentCount ?? 0),
  effectiveDate: (_, l) => l.effectiveDate ?? '',
  rate: (_, l) => (l.rateCents != null ? (l.rateCents / 100).toFixed(2) : ''),
};

function getCell(inv: any, l: any, key: string): string {
  const fn = VALUE_GETTERS[key];
  return fn ? fn(inv, l) : '';
}

function runExport(inv: any, columns: InvoiceColumn[]) {
  const cols = columns.filter((c) => c.enabled && VALUE_GETTERS[c.key]);
  if (cols.length === 0) return;
  const header = cols.map((c) => c.label);
  const rows = inv.lines.map((l: any) => cols.map((c) => getCell(inv, l, c.key)));
  const csv = [header, ...rows]
    .map((r) => r.map((c: unknown) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  a.download = `invoice-${inv.invoiceNumberDisplay}-${inv.coveragePeriod}.csv`;
  a.click();
}

// ---------------------------------------------------------------------------
// ManageColumnsModal — configure which parameters appear on this group's
// list-bill invoice (printed table + CSV export). Changes can be downloaded
// immediately and/or saved as the group's default.
// ---------------------------------------------------------------------------

function ManageColumnsModal({
  inv,
  onClose,
}: {
  inv: NonNullable<ReturnType<typeof useInvoice>>;
  onClose: () => void;
}) {
  const toast = useToast();
  const stored = useQuery(api.admin.listBillInvoices.getInvoiceColumns, { groupId: inv.groupId });
  const save = useMutation(api.admin.listBillInvoices.updateInvoiceColumns);
  const [cols, setCols] = useState<InvoiceColumn[] | null>(null);
  const [saving, setSaving] = useState(false);

  // Initialize local editable copy once the stored config loads.
  if (cols === null && stored) {
    setCols(stored.map((c) => ({ ...c })));
  }

  const working = cols ?? [];

  const toggle = (key: string) =>
    setCols((prev) =>
      (prev ?? []).map((c) => (c.key === key ? { ...c, enabled: !c.enabled } : c)),
    );
  const rename = (key: string, label: string) =>
    setCols((prev) => (prev ?? []).map((c) => (c.key === key ? { ...c, label } : c)));
  const move = (idx: number, dir: -1 | 1) =>
    setCols((prev) => {
      const next = [...(prev ?? [])];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return next;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });

  const enabledCount = working.filter((c) => c.enabled).length;
  const hasSsn = working.some((c) => c.key === 'ssn' && c.enabled);

  async function handleSaveDefault() {
    setSaving(true);
    try {
      await save({ groupId: inv.groupId, columns: working.map((c) => ({ key: c.key, label: c.label, enabled: c.enabled })) });
      toast.success('Saved as group default');
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open title="Configure Invoice Columns" onClose={onClose}>
      <div className="space-y-4 p-1">
        <p className="text-xs text-slate-500">
          Choose which parameters appear on this employer&apos;s list-bill invoice and CSV export.
          Toggle, rename, and reorder columns, then save as the group default or download a CSV now.
        </p>

        {!stored ? (
          <div className="py-6 text-center text-sm text-slate-400">Loading columns…</div>
        ) : (
          <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-[22rem] overflow-y-auto">
            {working.map((col, idx) => (
              <div key={col.key} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={col.enabled}
                  onChange={() => toggle(col.key)}
                  className="rounded border-slate-300"
                />
                <input
                  value={col.label}
                  onChange={(e) => rename(col.key, e.target.value)}
                  className={`flex-1 text-sm border border-transparent hover:border-slate-200 focus:border-slate-300 rounded px-1.5 py-1 ${
                    col.sensitive ? 'text-amber-700 font-medium' : 'text-slate-700'
                  }`}
                />
                {col.sensitive && <span title="Sensitive PII">⚠</span>}
                <span className="text-[0.65rem] font-mono text-slate-300">{col.key}</span>
                <div className="flex flex-col">
                  <button onClick={() => move(idx, -1)} disabled={idx === 0} className="text-slate-400 hover:text-slate-700 disabled:opacity-20 leading-none">▲</button>
                  <button onClick={() => move(idx, 1)} disabled={idx === working.length - 1} className="text-slate-400 hover:text-slate-700 disabled:opacity-20 leading-none">▼</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {hasSsn && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
            <strong>SSN included.</strong> The invoice and export will contain full Social Security
            Numbers. Handle and store securely.
          </div>
        )}

        <div className="flex justify-between items-center pt-2">
          <span className="text-xs text-slate-400">
            {enabledCount} column{enabledCount !== 1 ? 's' : ''} enabled · {inv.lines.length} members
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">
              Close
            </button>
            <button
              onClick={handleSaveDefault}
              disabled={saving || enabledCount === 0}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-40"
            >
              <Settings2 size={13} /> {saving ? 'Saving…' : 'Save as Default'}
            </button>
            <button
              onClick={() => runExport(inv, working)}
              disabled={enabledCount === 0}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-40"
            >
              <Download size={13} /> Download CSV
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Custom hook
// ---------------------------------------------------------------------------

function useInvoice(invoiceId: Id<'listBillInvoices'>) {
  return useQuery(api.admin.listBillInvoices.getInvoice, { invoiceId });
}

// ---------------------------------------------------------------------------
// Issue Modal
// ---------------------------------------------------------------------------

function IssueModal({
  inv,
  onClose,
}: {
  inv: NonNullable<ReturnType<typeof useInvoice>>;
  onClose: () => void;
}) {
  const toast = useToast();
  const issue = useMutation(api.admin.listBillInvoices.issueInvoice);
  const [loading, setLoading] = useState(false);

  async function handle() {
    setLoading(true);
    try {
      await issue({ invoiceId: inv._id });
      toast.success(`Invoice #${inv.invoiceNumberDisplay} issued`);
      onClose();
    } catch (e: unknown) {
      toast.error((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <Modal open title={`Issue Invoice #${inv.invoiceNumberDisplay}`} onClose={onClose}>
      <div className="space-y-4 p-1">
        <p className="text-sm text-slate-600">
          This will mark the invoice as <strong>Issued</strong> and make it visible to the
          billing contact. The invoice will become overdue if not paid by the due date.
        </p>
        <p className="text-sm">
          Total:{' '}
          <strong>{formatCurrency(inv.totalCents, { fromCents: true })}</strong>
        </p>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={handle}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Issuing…' : 'Issue Invoice'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Record Payment Modal
// ---------------------------------------------------------------------------

function PaymentModal({
  inv,
  onClose,
}: {
  inv: NonNullable<ReturnType<typeof useInvoice>>;
  onClose: () => void;
}) {
  const toast = useToast();
  const record = useMutation(api.admin.listBillInvoices.recordPayment);
  const [amount, setAmount] = useState(
    ((inv.balanceCents) / 100).toFixed(2),
  );
  const [method, setMethod] = useState<'check' | 'ach' | 'wire'>('check');
  const [checkNumber, setCheckNumber] = useState('');
  const [achConf, setAchConf] = useState('');
  const [loading, setLoading] = useState(false);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    const cents = Math.round(parseFloat(amount) * 100);
    if (!cents || cents <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setLoading(true);
    try {
      await record({
        invoiceId: inv._id,
        amountCents: cents,
        paymentMethod: method,
        ...(method === 'check' && checkNumber ? { checkNumber } : {}),
        ...(method === 'ach' && achConf ? { achConfirmationNumber: achConf } : {}),
      });
      toast.success('Payment recorded');
      onClose();
    } catch (e: unknown) {
      toast.error((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <Modal open title={`Record Payment — #${inv.invoiceNumberDisplay}`} onClose={onClose}>
      <form onSubmit={handle} className="space-y-4 p-1">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Amount ($)</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <p className="text-xs text-slate-400 mt-1">
            Balance: {formatCurrency(inv.balanceCents, { fromCents: true })}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
          <select
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            value={method}
            onChange={(e) => setMethod(e.target.value as 'check' | 'ach' | 'wire')}
          >
            <option value="check">Check</option>
            <option value="ach">ACH</option>
            <option value="wire">Wire</option>
          </select>
        </div>
        {method === 'check' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Check Number</label>
            <input
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              value={checkNumber}
              onChange={(e) => setCheckNumber(e.target.value)}
              placeholder="e.g. 4421"
            />
          </div>
        )}
        {method === 'ach' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ACH Confirmation #</label>
            <input
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              value={achConf}
              onChange={(e) => setAchConf(e.target.value)}
            />
          </div>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Record Payment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Adjustment Modal
// ---------------------------------------------------------------------------

function AdjustModal({
  inv,
  onClose,
}: {
  inv: NonNullable<ReturnType<typeof useInvoice>>;
  onClose: () => void;
}) {
  const toast = useToast();
  const adjust = useMutation(api.admin.listBillInvoices.applyAdjustment);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    const cents = Math.round(parseFloat(amount) * 100);
    if (isNaN(cents)) {
      toast.error('Enter a valid adjustment amount');
      return;
    }
    if (!notes.trim()) {
      toast.error('Notes are required');
      return;
    }
    setLoading(true);
    try {
      await adjust({ invoiceId: inv._id, adjustmentCents: cents, notes });
      toast.success('Adjustment applied');
      onClose();
    } catch (e: unknown) {
      toast.error((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <Modal open title={`Adjust Invoice #${inv.invoiceNumberDisplay}`} onClose={onClose}>
      <form onSubmit={handle} className="space-y-4 p-1">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Adjustment Amount ($)
          </label>
          <input
            type="number"
            step="0.01"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. -10.00 for a credit"
            required
          />
          <p className="text-xs text-slate-400 mt-1">
            Positive = charge more. Negative = credit/discount.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Notes (required)</label>
          <textarea
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            required
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-md hover:bg-yellow-700 disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Apply Adjustment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Void Modal
// ---------------------------------------------------------------------------

function VoidModal({
  inv,
  onClose,
}: {
  inv: NonNullable<ReturnType<typeof useInvoice>>;
  onClose: () => void;
}) {
  const toast = useToast();
  const voidInv = useMutation(api.admin.listBillInvoices.voidInvoice);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error('Reason is required');
      return;
    }
    setLoading(true);
    try {
      await voidInv({ invoiceId: inv._id, reason });
      toast.success(`Invoice #${inv.invoiceNumberDisplay} voided`);
      onClose();
    } catch (e: unknown) {
      toast.error((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <Modal open title={`Void Invoice #${inv.invoiceNumberDisplay}`} onClose={onClose}>
      <form onSubmit={handle} className="space-y-4 p-1">
        <p className="text-sm text-red-600 font-medium">
          This action is irreversible. The invoice will be permanently marked as Voided.
        </p>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Void Reason</label>
          <textarea
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Voiding…' : 'Void Invoice'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = use(params);
  const invId = invoiceId as Id<'listBillInvoices'>;

  const inv = useInvoice(invId);

  // Persisted, admin-configurable invoice columns for this group (drives the
  // member-detail table + CSV export). Falls back to registry defaults.
  const columnConfig = useQuery(
    api.admin.listBillInvoices.getInvoiceColumns,
    inv ? { groupId: inv.groupId } : 'skip',
  );

  const [showIssue, setShowIssue] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [showVoid, setShowVoid] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshLines = useMutation(api.admin.listBillInvoices.refreshInvoiceLines);
  const toast = useToast();

  async function handleRefreshLines() {
    setIsRefreshing(true);
    try {
      await refreshLines({ invoiceId: invId });
      toast.success('Lines refreshed', 'Member list updated to current enrollment.');
    } catch (err) {
      toast.fromError(err, 'Failed to refresh lines');
    } finally {
      setIsRefreshing(false);
    }
  }

  if (inv === undefined) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 space-y-6">
        <Breadcrumbs
          items={[
            { label: 'Admin', href: '/admin' },
            { label: 'List-Bill Invoices', href: '/admin/list-bill-invoices' },
            { label: 'Loading…' },
          ]}
        />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  if (inv === null) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
        <p className="text-slate-500">Invoice not found.</p>
      </div>
    );
  }

  const status = inv.status as InvoiceStatus;
  const isDraft = status === 'draft';
  const isVoided = status === 'voided';
  const isPaid = status === 'paid';
  const canIssue = isDraft;
  const canPay = !isDraft && !isVoided && !isPaid;
  const canAdjust = !isVoided && !isPaid;
  const canVoid = !isVoided;

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Breadcrumbs
            items={[
              { label: 'Admin', href: '/admin' },
              { label: 'List-Bill Invoices', href: '/admin/list-bill-invoices' },
              { label: inv.groupName, href: `/admin/list-bill-invoices/${inv.groupId}` },
              { label: `#${inv.invoiceNumberDisplay}` },
            ]}
          />
          <div className="flex items-center gap-3 mt-2">
            <Link
              href={`/admin/list-bill-invoices/${inv.groupId}`}
              className="p-2 text-slate-400 hover:text-slate-700 rounded"
            >
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-xl font-bold text-slate-900">
              Invoice #{inv.invoiceNumberDisplay}
            </h1>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[status]}`}
            >
              {STATUS_LABELS[status]}
            </span>
          </div>
        </div>

        {/* Action toolbar */}
        <div className="flex flex-wrap gap-2">
          {canIssue && (
            <button
              onClick={handleRefreshLines}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
              Refresh Lines
            </button>
          )}
          {canIssue && (
            <button
              onClick={() => setShowIssue(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              <Send size={14} />
              Issue
            </button>
          )}
          {canPay && (
            <button
              onClick={() => setShowPayment(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
            >
              <CreditCard size={14} />
              Record Payment
            </button>
          )}
          {!isVoided && (
            <button
              onClick={() => setShowEdit(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
            >
              <Settings2 size={14} />
              Edit Details
            </button>
          )}
          {canAdjust && (
            <button
              onClick={() => setShowAdjust(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
            >
              <Pencil size={14} />
              Adjust
            </button>
          )}
          <button
            onClick={() => setShowExport(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
          >
            <Columns3 size={14} />
            Columns / Export
          </button>
          <a
            href={`/api/admin/list-bill-invoices/${inv._id}/group-pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
          >
            <FileText size={14} />
            Generate Invoice
          </a>
          {canVoid && (
            <button
              onClick={() => setShowVoid(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-md hover:bg-red-50"
            >
              <Trash2 size={14} />
              Void
            </button>
          )}
        </div>
      </div>

      {/* Cover card (page 1 info) */}
      <div className="bg-white rounded-lg shadow p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Group / billing info */}
        <div className="space-y-1">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Building2 size={13} /> Employer
          </h2>
          <p className="font-semibold text-slate-800">{inv.groupName}</p>
          <p className="text-sm text-slate-500">Group Code: {inv.groupCode}</p>
          {inv.organizationCode && (
            <p className="text-sm text-slate-500">Org Code: {inv.organizationCode}</p>
          )}
          <p className="text-sm text-slate-500">{inv.accountName}</p>
          {inv.billingContactEmail && (
            <p className="text-sm text-blue-600">{inv.billingContactEmail}</p>
          )}
        </div>

        {/* Coverage / dates */}
        <div className="space-y-1">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Calendar size={13} /> Coverage &amp; Dates
          </h2>
          <p className="text-sm text-slate-700">
            <span className="text-slate-400">Period:</span>{' '}
            <strong className="font-mono">{inv.coveragePeriod}</strong>
          </p>
          <p className="text-sm text-slate-700">
            <span className="text-slate-400">Billing Date:</span>{' '}
            {formatDateTime(inv.billingDate).split(',')[0]}
          </p>
          <p className="text-sm text-slate-700">
            <span className="text-slate-400">Due Date:</span>{' '}
            {formatDateTime(inv.paymentDueDate).split(',')[0]}
          </p>
          {inv.issuedAt && (
            <p className="text-sm text-slate-700">
              <span className="text-slate-400">Issued:</span>{' '}
              {formatDateTime(inv.issuedAt).split(',')[0]}
            </p>
          )}
          {inv.paidAt && (
            <p className="text-sm text-slate-700">
              <span className="text-slate-400">Paid:</span>{' '}
              {formatDateTime(inv.paidAt).split(',')[0]}
            </p>
          )}
        </div>

        {/* Financials */}
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <FileText size={13} /> Financials
          </h2>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-mono">{formatCurrency(inv.subtotalCents, { fromCents: true })}</span>
            </div>
            {inv.adjustmentCents !== 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Adjustment</span>
                <span className={`font-mono ${inv.adjustmentCents < 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {inv.adjustmentCents > 0 ? '+' : ''}
                  {formatCurrency(Math.abs(inv.adjustmentCents), { fromCents: true })}
                </span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-100 pt-1 font-semibold">
              <span>Total</span>
              <span className="font-mono">{formatCurrency(inv.totalCents, { fromCents: true })}</span>
            </div>
            <div className="flex justify-between text-green-600">
              <span>Paid</span>
              <span className="font-mono">{formatCurrency(inv.amountPaidCents, { fromCents: true })}</span>
            </div>
            <div className={`flex justify-between font-semibold ${inv.balanceCents > 0 ? 'text-red-600' : 'text-slate-400'}`}>
              <span>Balance</span>
              <span className="font-mono">{formatCurrency(inv.balanceCents, { fromCents: true })}</span>
            </div>
          </div>
          {inv.adjustmentNotes && (
            <p className="text-xs text-slate-400 italic border-t border-slate-100 pt-2">
              Adj. note: {inv.adjustmentNotes}
            </p>
          )}
        </div>
      </div>

      {/* Rate summary bar */}
      <div className="bg-white rounded-lg shadow px-6 py-4">
        <div className="flex flex-wrap gap-6 items-center">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Rates — {inv.rateLabel}
          </div>
          <div className="flex gap-6 text-sm">
            <span>
              <span className="text-slate-400">MO:</span>{' '}
              <strong>{formatCurrency(inv.moCents, { fromCents: true })}</strong>
            </span>
            <span>
              <span className="text-slate-400">MS:</span>{' '}
              <strong>{formatCurrency(inv.msCents, { fromCents: true })}</strong>
            </span>
            <span>
              <span className="text-slate-400">MF:</span>{' '}
              <strong>{formatCurrency(inv.mfCents, { fromCents: true })}</strong>
            </span>
          </div>
          <div className="ml-auto flex gap-5 text-sm text-slate-600">
            <span>
              <Users size={13} className="inline mr-1" />
              <strong>{inv.memberCount}</strong> members
            </span>
            <span>MO: <strong>{inv.moCount}</strong></span>
            <span>MS: <strong>{inv.msCount}</strong></span>
            <span>MF: <strong>{inv.mfCount}</strong></span>
          </div>
        </div>
      </div>

      {/* Member detail table (page 2 format) */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Users size={16} className="text-blue-500" />
            Member Detail
          </h2>
          <span className="text-xs text-slate-400">{inv.lines.length} line(s)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            {(() => {
              const enabledCols = (columnConfig ?? []).filter(
                (c: InvoiceColumn) => c.enabled && VALUE_GETTERS[c.key],
              );
              const numericKeys = new Set(['dependentCount', 'rate']);
              const rateIdx = enabledCols.findIndex((c: InvoiceColumn) => c.key === 'rate');
              return (
                <>
                  <thead className="bg-slate-50">
                    <tr>
                      {enabledCols.map((col: InvoiceColumn) => (
                        <th
                          key={col.key}
                          className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${
                            numericKeys.has(col.key) ? 'text-right' : 'text-left'
                          }`}
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inv.lines.map((line: any) => (
                      <tr key={line.memberProfileId} className="hover:bg-slate-50">
                        {enabledCols.map((col: InvoiceColumn) => {
                          if (col.key === 'tier') {
                            return (
                              <td key={col.key} className="px-4 py-2.5">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-slate-100 text-slate-700">
                                  {line.tier}
                                </span>
                                <span className="ml-2 text-xs text-slate-400">{TIER_LABELS[line.tier]}</span>
                              </td>
                            );
                          }
                          if (col.key === 'rate') {
                            return (
                              <td key={col.key} className="px-4 py-2.5 text-right font-mono font-medium text-slate-800">
                                {line.rateCents != null ? formatCurrency(line.rateCents, { fromCents: true }) : ''}
                              </td>
                            );
                          }
                          if (col.key === 'ssn') {
                            return (
                              <td key={col.key} className="px-4 py-2.5 font-mono text-amber-700 text-xs">
                                {line.ssn ?? ''}
                              </td>
                            );
                          }
                          return (
                            <td
                              key={col.key}
                              className={`px-4 py-2.5 text-slate-700 ${
                                numericKeys.has(col.key) ? 'text-right' : ''
                              } ${col.key === 'memberId' ? 'font-mono text-slate-600 text-xs' : ''} ${
                                col.key === 'lastName' ? 'font-medium text-slate-800' : ''
                              }`}
                            >
                              {getCell(inv, line, col.key)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t border-slate-200">
                    <tr>
                      <td
                        colSpan={rateIdx >= 0 ? rateIdx : enabledCols.length}
                        className="px-4 py-3 text-sm font-semibold text-slate-700"
                      >
                        Subtotal
                      </td>
                      {rateIdx >= 0 && (
                        <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800">
                          {formatCurrency(inv.subtotalCents, { fromCents: true })}
                        </td>
                      )}
                      {rateIdx >= 0 && rateIdx < enabledCols.length - 1 && (
                        <td colSpan={enabledCols.length - rateIdx - 1} />
                      )}
                    </tr>
                  </tfoot>
                </>
              );
            })()}
          </table>
        </div>
      </div>

      {/* Void notice */}
      {isVoided && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          <strong>Voided</strong> on {formatDateTime(inv.voidedAt!)} by {inv.voidedBy}.
          {inv.voidReason && <> Reason: {inv.voidReason}</>}
          {inv.supersededById && (
            <> —{' '}
              <Link
                href={`/admin/list-bill-invoices/invoice/${inv.supersededById}`}
                className="underline"
              >
                View replacement invoice
              </Link>
            </>
          )}
        </div>
      )}

      {/* Modals */}
      {showIssue && inv && (
        <IssueModal inv={inv} onClose={() => setShowIssue(false)} />
      )}
      {showPayment && inv && (
        <PaymentModal inv={inv} onClose={() => setShowPayment(false)} />
      )}
      {showAdjust && inv && (
        <AdjustModal inv={inv} onClose={() => setShowAdjust(false)} />
      )}
      {showVoid && inv && (
        <VoidModal inv={inv} onClose={() => setShowVoid(false)} />
      )}
      {showEdit && inv && (
        <EditDetailsModal inv={inv} onClose={() => setShowEdit(false)} />
      )}
      {showExport && inv && (
        <ManageColumnsModal inv={inv} onClose={() => setShowExport(false)} />
      )}

      {/* Audit history */}
      <InvoiceAuditLog invoiceId={invId} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit Details Modal
// ---------------------------------------------------------------------------

function EditDetailsModal({
  inv,
  onClose,
}: {
  inv: NonNullable<ReturnType<typeof useInvoice>>;
  onClose: () => void;
}) {
  const toast = useToast();
  const patch = useMutation(api.admin.listBillInvoices.patchInvoiceMeta);

  const toDateInput = (ms: number) => new Date(ms).toISOString().slice(0, 10);

  const [billingDate, setBillingDate] = useState(toDateInput(inv.billingDate));
  const [dueDate, setDueDate] = useState(toDateInput(inv.paymentDueDate));
  const [contactName, setContactName] = useState(inv.billingContactName ?? '');
  const [contactEmail, setContactEmail] = useState(inv.billingContactEmail ?? '');
  const [memo, setMemo] = useState((inv as any).internalMemo ?? '');
  const [loading, setLoading] = useState(false);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    const billingDateMs = Date.parse(`${billingDate}T12:00:00Z`);
    const dueDateMs = Date.parse(`${dueDate}T12:00:00Z`);
    if (Number.isNaN(billingDateMs) || Number.isNaN(dueDateMs)) {
      toast.error('Invalid date');
      return;
    }
    setLoading(true);
    try {
      await patch({
        invoiceId: inv._id,
        billingDate: billingDateMs,
        paymentDueDate: dueDateMs,
        billingContactName: contactName,
        billingContactEmail: contactEmail,
        internalMemo: memo,
      });
      toast.success('Invoice details updated');
      onClose();
    } catch (err: unknown) {
      toast.error((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <Modal
      open
      title={`Edit Invoice #${inv.invoiceNumberDisplay}`}
      description="Changes are logged to the invoice audit trail."
      onClose={() => { if (!loading) onClose(); }}
      size="max-w-lg"
    >
      <form onSubmit={handle} className="space-y-5 p-1">
        {/* Dates */}
        <fieldset className="border border-slate-200 rounded-md p-3 space-y-3">
          <legend className="text-xs font-semibold text-slate-500 px-1 uppercase tracking-wide">Dates</legend>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <div className="font-medium text-slate-700 mb-1">Billing date</div>
              <input
                type="date"
                required
                value={billingDate}
                onChange={(e) => setBillingDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </label>
            <label className="text-sm">
              <div className="font-medium text-slate-700 mb-1">Payment due date</div>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </label>
          </div>
        </fieldset>

        {/* Billing contact */}
        <fieldset className="border border-slate-200 rounded-md p-3 space-y-3">
          <legend className="text-xs font-semibold text-slate-500 px-1 uppercase tracking-wide">Billing contact</legend>
          <label className="block text-sm">
            <div className="font-medium text-slate-700 mb-1">Contact name</div>
            <input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="e.g. Jane Smith"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
          </label>
          <label className="block text-sm">
            <div className="font-medium text-slate-700 mb-1">Contact email</div>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="e.g. billing@company.com"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
          </label>
        </fieldset>

        {/* Internal memo */}
        <label className="block text-sm">
          <div className="font-medium text-slate-700 mb-1">Internal memo <span className="text-slate-400 font-normal">(admin only — not printed on PDF)</span></div>
          <textarea
            rows={3}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="e.g. Employer confirmed check mailed 5/20"
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
          />
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-medium disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Audit log section
// ---------------------------------------------------------------------------

function InvoiceAuditLog({ invoiceId }: { invoiceId: Id<'listBillInvoices'> }) {
  const entries = useQuery(api.admin.adminAudit.listRecent, {
    targetType: 'listBillInvoices',
    targetId: invoiceId,
    limit: 50,
  });

  if (!entries || entries.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
        <History size={16} className="text-slate-400" />
        <h2 className="text-sm font-semibold text-slate-700">Invoice History</h2>
        <span className="ml-auto text-xs text-slate-400">{entries.length} event{entries.length !== 1 ? 's' : ''}</span>
      </div>
      <ul className="divide-y divide-slate-100">
        {entries.map((entry: any) => (
          <li key={entry._id} className="px-6 py-3 flex items-start gap-3">
            <div className="mt-1.5 w-2 h-2 rounded-full bg-slate-300 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-800">{entry.summary}</p>
              {entry.metadata?.changes && Array.isArray(entry.metadata.changes) && (
                <ul className="mt-1 space-y-0.5">
                  {entry.metadata.changes.map((c: string, i: number) => (
                    <li key={i} className="text-xs text-slate-500 font-mono">{c}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="text-xs text-slate-400 shrink-0 text-right">
              <div>{formatDateTime(entry.createdAt)}</div>
              {entry.actorName && <div className="text-slate-400">{entry.actorName}</div>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
