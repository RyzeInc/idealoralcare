'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from 'convex/react';
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CreditCard,
  FileSpreadsheet,
  FileText,
  History,
  Lock,
  RefreshCw,
  Send,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Table2,
  Trash2,
  Undo2,
  UserMinus,
  Users,
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
import { formatCurrency, formatDate, formatDateTime } from '@/lib/admin-format';

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

// ---------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------

function RemittanceModal({
  statementId,
  balanceCents,
  onClose,
}: {
  statementId: Id<'vendorStatements'>;
  balanceCents: number;
  onClose: () => void;
}) {
  const toast = useToast();
  const recordRemittance = useMutation(api.admin.vendorStatements.recordRemittance);
  const [amount, setAmount] = useState((balanceCents / 100).toFixed(2));
  const [method, setMethod] = useState<'check' | 'ach' | 'wire'>('ach');
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const cents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      toast.error('Enter a positive amount');
      return;
    }
    setSaving(true);
    try {
      await recordRemittance({
        statementId,
        amountCents: cents,
        paymentMethod: method,
        paymentReference: reference.trim() || undefined,
      });
      toast.success('Remittance recorded');
      onClose();
    } catch (error) {
      toast.error((error as Error).message ?? 'Could not record remittance');
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title="Record Remittance"
      description="Money paid out to this partner against the statement."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4 p-1">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Amount (USD)</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
          <p className="text-xs text-slate-400 mt-1">
            Outstanding balance: {formatCurrency(balanceCents, { fromCents: true })}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Method</label>
          <select
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500"
            value={method}
            onChange={(event) => setMethod(event.target.value as 'check' | 'ach' | 'wire')}
          >
            <option value="ach">ACH</option>
            <option value="check">Check</option>
            <option value="wire">Wire</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Reference <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            placeholder="Check number, ACH trace, wire reference"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
          />
        </div>
        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Record Remittance'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ReasonModal({
  title,
  description,
  confirmLabel,
  confirmClass,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  confirmClass: string;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  return (
    <Modal open title={title} description={description} onClose={onClose}>
      <form
        className="space-y-4 p-1"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!reason.trim()) return;
          setSaving(true);
          try {
            await onConfirm(reason.trim());
          } finally {
            setSaving(false);
          }
        }}
      >
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
          <textarea
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
          />
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !reason.trim()}
            className={`px-4 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50 ${confirmClass}`}
          >
            {saving ? 'Working…' : confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditModal({
  statementId,
  paymentDueDate,
  internalMemo,
  onClose,
}: {
  statementId: Id<'vendorStatements'>;
  paymentDueDate: number;
  internalMemo?: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const patchMeta = useMutation(api.admin.vendorStatements.patchStatementMeta);
  const [due, setDue] = useState(new Date(paymentDueDate).toISOString().slice(0, 10));
  const [memo, setMemo] = useState(internalMemo ?? '');
  const [saving, setSaving] = useState(false);

  return (
    <Modal
      open
      title="Edit Statement Details"
      description="Amounts are never edited here — corrections go through an adjustment and a reissue."
      onClose={onClose}
    >
      <form
        className="space-y-4 p-1"
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          try {
            await patchMeta({
              statementId,
              paymentDueDate: Date.parse(`${due}T00:00:00.000Z`),
              internalMemo: memo,
            });
            toast.success('Statement updated');
            onClose();
          } catch (error) {
            toast.error((error as Error).message ?? 'Could not update the statement');
            setSaving(false);
          }
        }}
      >
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Remittance Due</label>
          <input
            type="date"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            value={due}
            onChange={(event) => setDue(event.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Internal Memo
          </label>
          <textarea
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            rows={3}
            placeholder="Admin-only notes. Never printed on the statement."
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
          />
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Primaries deliberately left off
// ---------------------------------------------------------------------------

function ExcludedPrimaries({
  statementId,
  excluded,
  isDraft,
}: {
  statementId: Id<'vendorStatements'>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  excluded: any[];
  isDraft: boolean;
}) {
  const toast = useToast();
  const restore = useMutation(api.admin.vendorStatements.restoreMemberToStatement);
  const [busy, setBusy] = useState<string | null>(null);

  if (excluded.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden border-l-4 border-amber-400">
      <div className="px-6 py-4 border-b border-slate-200">
        <h2 className="text-sm font-semibold text-slate-700">
          Excluded from this statement ({excluded.length})
        </h2>
        <p className="text-xs text-slate-500">
          Left off deliberately. Their amounts are already off the subtotal above.
        </p>
      </div>
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Member</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Reason</th>
            <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Removed</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {excluded.map((entry) => (
            <tr key={entry.memberId}>
              <td className="px-4 py-2 text-slate-800">
                {entry.memberName}
                <span className="block text-xs text-slate-400 font-mono">
                  {entry.memberId}
                </span>
              </td>
              <td className="px-4 py-2 text-slate-600">{entry.reason}</td>
              <td className="px-4 py-2 text-right text-slate-700">
                −{formatCurrency(entry.amountCents, { fromCents: true })}
              </td>
              <td className="px-4 py-2 text-right">
                {isDraft && (
                  <button
                    disabled={busy === entry.memberId}
                    onClick={async () => {
                      setBusy(entry.memberId);
                      try {
                        await restore({ statementId, memberId: entry.memberId });
                        toast.success(`${entry.memberName} put back on the statement`);
                      } catch (error) {
                        toast.error((error as Error).message ?? 'Could not restore');
                      } finally {
                        setBusy(null);
                      }
                    }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50"
                  >
                    <Undo2 size={12} /> Put back
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExcludeModal({
  statementId,
  member,
  onClose,
}: {
  statementId: Id<'vendorStatements'>;
  member: { memberId: string; name: string; amountCents: number };
  onClose: () => void;
}) {
  const toast = useToast();
  const exclude = useMutation(api.admin.vendorStatements.excludeMemberFromStatement);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  return (
    <Modal
      open
      title="Leave this primary off the statement"
      description="The line is removed and its amount comes off the subtotal."
      onClose={onClose}
    >
      <form
        className="space-y-4 p-1"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!reason.trim()) return;
          setSaving(true);
          try {
            await exclude({ statementId, memberId: member.memberId, reason });
            toast.success(`${member.name} excluded`);
            onClose();
          } catch (error) {
            toast.error((error as Error).message ?? 'Could not exclude');
            setSaving(false);
          }
        }}
      >
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <p className="font-medium text-slate-800">{member.name}</p>
          <p className="text-xs text-slate-500 font-mono">{member.memberId}</p>
          <p className="text-xs text-slate-600 mt-1">
            Subtotal will drop by{' '}
            {formatCurrency(member.amountCents, { fromCents: true })}.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
          <textarea
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            rows={3}
            placeholder="Duplicate enrollment, billed in error, retro term…"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
          />
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !reason.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700 disabled:opacity-50"
          >
            {saving ? 'Excluding…' : 'Exclude'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Member detail missing — explain why, and offer the fix in place
// ---------------------------------------------------------------------------

function MissingMemberDetail({
  period,
  missing,
  hasSome,
}: {
  period: string;
  missing: Array<{ groupName: string; primaryCount: number }>;
  hasSome: boolean;
}) {
  const toast = useToast();
  const preview = useQuery(
    api.admin.invoiceCalculator.previewMemberLineBackfill,
    { period },
  );
  const backfill = useMutation(api.admin.invoiceCalculator.backfillMemberLines);
  const [running, setRunning] = useState(false);

  async function handleRun() {
    setRunning(true);
    try {
      const result = await backfill({ period });
      toast.success(
        result.filled > 0
          ? `Member detail added for ${result.filled} organization(s)`
          : 'Nothing could be filled — see the reasons listed',
      );
    } catch (error) {
      toast.error((error as Error).message ?? 'Backfill failed');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="px-6 py-5 space-y-4">
      <div className="flex gap-3">
        <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
        <div className="text-sm text-slate-700">
          <p className="font-semibold text-slate-900">
            {hasSome
              ? `${missing.reduce((n, m) => n + m.primaryCount, 0)} primaries are not itemized below`
              : `${period} was closed before per-member lines were recorded`}
          </p>
          <p className="mt-0.5">
            {hasSome
              ? 'These organizations were closed before per-member lines were recorded, so their primaries are counted in the totals but cannot be named. Everything else is listed below.'
              : 'The totals above are authoritative, but this month has no per-member rows to show. This is a gap in the stored data, not a setting you can switch on.'}
          </p>
          {missing.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {missing.map((item) => (
                <li key={item.groupName} className="text-xs text-slate-600">
                  <span className="font-medium">{item.groupName}</span> —{' '}
                  {item.primaryCount} primar{item.primaryCount === 1 ? 'y' : 'ies'} not
                  itemized
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {preview === undefined ? (
        <p className="text-sm text-slate-400">Checking whether it can be rebuilt…</p>
      ) : (
        <div className="rounded-md border border-slate-200 overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
            Member lines can be rebuilt for{' '}
            <strong className="text-slate-800">{preview.fillable}</strong> of{' '}
            {preview.rows.length} organization(s). Figures are never touched — a rebuild
            is accepted only where it reproduces the closed totals to the cent.
          </div>
          <ul className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
            {preview.rows.map((row) => (
              <li
                key={String(row.periodId)}
                className="px-4 py-2 flex items-start justify-between gap-3 text-xs"
              >
                <span className="text-slate-700">
                  {row.groupName}
                  <span className="text-slate-400 font-mono"> · {row.groupCode}</span>
                </span>
                <span
                  className={
                    row.alreadyHasDetail
                      ? 'text-slate-400'
                      : row.reconciles
                        ? 'text-green-700'
                        : 'text-amber-700'
                  }
                >
                  {row.detail}
                </span>
              </li>
            ))}
          </ul>
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200">
            <button
              onClick={handleRun}
              disabled={running || preview.fillable === 0}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              <Wrench size={14} />
              {running
                ? 'Rebuilding…'
                : `Rebuild member detail for ${period}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal payables verification — admin-only, never part of a vendor document
// ---------------------------------------------------------------------------

function VerificationPanel({ statementId }: { statementId: Id<'vendorStatements'> }) {
  const audit = useQuery(api.admin.vendorStatements.getStatementVerification, {
    statementId,
  });
  const [open, setOpen] = useState(false);

  if (audit === undefined) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <SkeletonCard />
      </div>
    );
  }
  if (audit === null) return null;

  const docBase = `/api/admin/vendor-statements/${statementId}/document?variant=verification`;

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden border-l-4 border-slate-400">
      <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center gap-3">
        <ShieldCheck size={16} className="text-slate-500" />
        <div>
          <h2 className="text-sm font-semibold text-slate-700">
            Payables Verification
          </h2>
          <p className="text-xs text-slate-500">
            Full dispersal behind this statement. Internal only — never included in
            any document sent to {audit.vendorName}.
          </p>
        </div>
        <span
          className={`ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
            audit.allChecksPassed
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          }`}
        >
          {audit.allChecksPassed ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
          {audit.allChecksPassed ? 'All checks pass' : 'Check failed'}
        </span>
        <a
          href={`${docBase}&format=xlsx`}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
        >
          <FileSpreadsheet size={13} /> XLSX
        </a>
        <a
          href={`${docBase}&format=csv`}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
        >
          <Table2 size={13} /> CSV
        </a>
      </div>

      {/* Reconciliation checks */}
      <ul className="divide-y divide-slate-100">
        {audit.checks.map((check) => (
          <li key={check.label} className="px-6 py-3 flex items-start gap-3">
            {check.passed ? (
              <CheckCircle2 size={16} className="text-green-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <p className="text-sm text-slate-800">{check.label}</p>
              <p className="text-xs text-slate-500 font-mono">{check.detail}</p>
            </div>
          </li>
        ))}
      </ul>

      {/* Bucket totals */}
      <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Bucket totals across the closed month
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
          {(
            [
              ['Gross', audit.totals.grossCents, 'grossCents'],
              ['Toothlens', audit.totals.toothlensCents, 'toothlensCents'],
              ['Careington', audit.totals.careingtonCents, 'careingtonCents'],
              ['Processing', audit.totals.processingCents, 'processingCents'],
              ['Ideal Health', audit.totals.partnerVendorCents, 'partnerVendorCents'],
              ['Ryze Keep', audit.totals.ryzeKeepCents, 'ryzeKeepCents'],
            ] as const
          ).map(([label, cents, field]) => (
            <div
              key={label}
              className={`rounded-md px-3 py-2 ${
                field === audit.amountField
                  ? 'bg-blue-50 border border-blue-200'
                  : 'bg-white border border-slate-200'
              }`}
            >
              <p className="text-xs text-slate-500">{label}</p>
              <p className="font-semibold text-slate-900">
                {formatCurrency(cents, { fromCents: true })}
              </p>
              {field === audit.amountField && (
                <p className="text-[10px] text-blue-700 font-medium uppercase">
                  This statement
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Per-member dispersal */}
      {audit.memberDetailAvailable && audit.lines.length > 0 && (
        <div className="border-t border-slate-200">
          <button
            onClick={() => setOpen((value) => !value)}
            className="w-full px-6 py-3 flex items-center gap-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            Full member dispersal ({audit.lines.length} members)
          </button>
          {open && (
            <div className="overflow-x-auto max-h-[520px] border-t border-slate-100">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    {[
                      'Member ID',
                      'Member',
                      'Group',
                      'Class',
                      'Gross',
                      'Toothlens',
                      'Careington',
                      'Processing',
                      'Ideal',
                      'Ryze',
                      'On Statement',
                      'Rep / Broker',
                      'Attribution',
                    ].map((label) => (
                      <th
                        key={label}
                        className="px-3 py-2 text-left font-semibold text-slate-500 uppercase whitespace-nowrap"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {audit.lines.map((line, index) => (
                    <tr
                      key={`${line.memberId}-${index}`}
                      className={line.splitBalances ? 'hover:bg-slate-50' : 'bg-red-50'}
                    >
                      <td className="px-3 py-1.5 font-mono text-slate-700">{line.memberId}</td>
                      <td className="px-3 py-1.5 text-slate-800 whitespace-nowrap">{line.memberName}</td>
                      <td className="px-3 py-1.5 font-mono text-slate-500">{line.groupCode}</td>
                      <td className="px-3 py-1.5 text-slate-600">{line.rateClass}</td>
                      <td className="px-3 py-1.5 text-right text-slate-700">
                        {formatCurrency(line.grossCents, { fromCents: true })}
                      </td>
                      <td className="px-3 py-1.5 text-right text-slate-600">
                        {formatCurrency(line.toothlensCents, { fromCents: true })}
                      </td>
                      <td className="px-3 py-1.5 text-right text-slate-600">
                        {formatCurrency(line.careingtonCents, { fromCents: true })}
                      </td>
                      <td className="px-3 py-1.5 text-right text-slate-600">
                        {formatCurrency(line.processingCents, { fromCents: true })}
                      </td>
                      <td className="px-3 py-1.5 text-right text-slate-600">
                        {formatCurrency(line.partnerVendorCents, { fromCents: true })}
                      </td>
                      <td className="px-3 py-1.5 text-right text-slate-600">
                        {formatCurrency(line.ryzeKeepCents, { fromCents: true })}
                      </td>
                      <td className="px-3 py-1.5 text-right font-semibold text-blue-800 bg-blue-50/50">
                        {formatCurrency(line.statementCents, { fromCents: true })}
                      </td>
                      <td className="px-3 py-1.5 text-slate-700 whitespace-nowrap">
                        {line.repName ?? <span className="text-slate-400">Unattributed</span>}
                        {line.repCode && (
                          <span className="text-slate-400 font-mono"> · {line.repCode}</span>
                        )}
                        {line.agencyName && (
                          <div className="text-slate-400">{line.agencyName}</div>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-slate-500">{line.repSource}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Audit trail
// ---------------------------------------------------------------------------

function StatementAuditLog({ statementId }: { statementId: Id<'vendorStatements'> }) {
  const entries = useQuery(api.admin.adminAudit.listRecent, {
    targetType: 'vendorStatements',
    targetId: statementId,
    limit: 50,
  });
  if (!entries || entries.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
        <History size={16} className="text-slate-400" />
        <h2 className="text-sm font-semibold text-slate-700">Statement History</h2>
        <span className="ml-auto text-xs text-slate-400">
          {entries.length} event{entries.length !== 1 ? 's' : ''}
        </span>
      </div>
      <ul className="divide-y divide-slate-100">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {entries.map((entry: any) => (
          <li key={entry._id} className="px-6 py-3 flex items-start gap-3">
            <div className="mt-1.5 w-2 h-2 rounded-full bg-slate-300 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-800">{entry.summary}</p>
              {Array.isArray(entry.metadata?.changes) && (
                <ul className="mt-1 space-y-0.5">
                  {entry.metadata.changes.map((change: string, index: number) => (
                    <li key={index} className="text-xs text-slate-500 font-mono">{change}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="text-xs text-slate-400 shrink-0 text-right">
              <div>{formatDateTime(entry.createdAt)}</div>
              {entry.actorName && <div>{entry.actorName}</div>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function VendorStatementDetailPage({
  params,
}: {
  params: Promise<{ statementId: string }>;
}) {
  const { statementId } = use(params);
  const id = statementId as Id<'vendorStatements'>;
  const toast = useToast();

  const statement = useQuery(api.admin.vendorStatements.getStatement, { statementId: id });
  const issue = useMutation(api.admin.vendorStatements.issueStatement);
  const voidStatement = useMutation(api.admin.vendorStatements.voidStatement);
  const unvoidStatement = useMutation(api.admin.vendorStatements.unvoidStatement);
  const reissue = useMutation(api.admin.vendorStatements.generateReplacementStatement);

  const [showRemittance, setShowRemittance] = useState(false);
  const [showVoid, setShowVoid] = useState(false);
  const [showReissue, setShowReissue] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [excluding, setExcluding] = useState<
    { memberId: string; name: string; amountCents: number } | null
  >(null);
  const [busy, setBusy] = useState(false);

  if (statement === undefined) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
        <SkeletonTable rows={8} cols={5} />
      </div>
    );
  }

  if (statement === null) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <p className="text-slate-500">Statement not found.</p>
        <Link href="/admin/vendor-statements" className="text-blue-600 hover:underline text-sm">
          Back to Vendor Statements
        </Link>
      </div>
    );
  }

  const status = statement.status as StatementStatus;
  const isVoided = status === 'voided';
  const docBase = `/api/admin/vendor-statements/${id}/document`;

  async function handleIssue() {
    setBusy(true);
    try {
      await issue({ statementId: id });
      toast.success('Statement issued');
    } catch (error) {
      toast.error((error as Error).message ?? 'Could not issue the statement');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Breadcrumbs
            items={[
              { label: 'Admin', href: '/admin' },
              { label: 'Vendor Statements', href: '/admin/vendor-statements' },
              { label: statement.statementNumberDisplay },
            ]}
          />
          <h1 className="text-2xl font-bold text-slate-900 mt-1 flex items-center gap-3">
            {statement.vendorName} — {statement.period}
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status]}`}
            >
              {STATUS_LABELS[status]}
            </span>
            {statement.overdue && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                Past due
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-mono">
            {statement.statementNumberDisplay}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {status === 'draft' && (
            <button
              onClick={handleIssue}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              <Send size={14} /> Issue
            </button>
          )}
          {(status === 'issued' || status === 'partial') && (
            <button
              onClick={() => setShowRemittance(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
            >
              <CreditCard size={14} /> Record Remittance
            </button>
          )}
          <Tooltip
            text="Change what this recipient is shown on their statements — employer group, rate class, rep attribution. Applies to statements generated from now on."
            width="lg"
          >
            <Link
              href={`/admin/vendor-statements/disclosure?vendor=${statement.vendor}&return=${id}&label=${encodeURIComponent(statement.statementNumberDisplay)}`}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
            >
              <SlidersHorizontal size={14} /> Contents
            </Link>
          </Tooltip>
          {!isVoided && (
            <button
              onClick={() => setShowEdit(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
            >
              <Settings2 size={14} /> Edit Details
            </button>
          )}
          <a
            href={`${docBase}?format=pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
          >
            <FileText size={14} /> PDF
          </a>
          <a
            href={`${docBase}?format=xlsx`}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
          >
            <FileSpreadsheet size={14} /> XLSX
          </a>
          <a
            href={`${docBase}?format=csv`}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
          >
            <Table2 size={14} /> CSV
          </a>
          {!isVoided && !statement.supersededById && (
            <button
              onClick={() => setShowReissue(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-amber-700 bg-white border border-amber-300 rounded-md hover:bg-amber-50"
            >
              <RefreshCw size={14} /> Reissue
            </button>
          )}
          {!isVoided && (
            <button
              onClick={() => setShowVoid(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-md hover:bg-red-50"
            >
              <Trash2 size={14} /> Void
            </button>
          )}
          {isVoided && !statement.supersededById && (
            <button
              onClick={async () => {
                setBusy(true);
                try {
                  await unvoidStatement({ statementId: id });
                  toast.success('Statement restored');
                } catch (error) {
                  toast.error((error as Error).message ?? 'Could not un-void');
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-amber-700 bg-white border border-amber-300 rounded-md hover:bg-amber-50 disabled:opacity-50"
            >
              <RefreshCw size={14} className={busy ? 'animate-spin' : ''} /> Un-void
            </button>
          )}
        </div>
      </div>

      {/* Void / replacement banners */}
      {isVoided && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-semibold">Voided {formatDate(statement.voidedAt)}</p>
          <p>{statement.voidReason}</p>
          {statement.supersededByNumber && (
            <p className="mt-1">Replaced by {statement.supersededByNumber}.</p>
          )}
        </div>
      )}
      {statement.replacesNumber && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          This statement replaces {statement.replacesNumber}.
        </div>
      )}
      {statement.disclosureDrift.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex gap-3">
          <SlidersHorizontal className="text-amber-600 shrink-0" size={20} />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">
              Contents changed since this statement was generated
            </p>
            <p>
              It now renders under {statement.vendorName}&apos;s current settings, so a
              fresh download will not match the copy sent on{' '}
              {formatDate(statement.statementDate)}. Figures are unaffected — only
              which columns appear.
            </p>
            <ul className="mt-1 space-y-0.5">
              {statement.disclosureDrift.map((change: string) => (
                <li key={change} className="text-xs font-mono">{change}</li>
              ))}
            </ul>
            <Link
              href={`/admin/vendor-statements/activity?kind=contents&vendor=${statement.vendor}`}
              className="text-xs font-medium text-amber-900 underline hover:text-amber-700"
            >
              See who changed it and when
            </Link>
          </div>
        </div>
      )}
      {statement.unappliedAdjustments.length > 0 && !isVoided && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex gap-3">
          <AlertTriangle className="text-amber-600 shrink-0" size={20} />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">
              {statement.unappliedAdjustments.length} adjustment
              {statement.unappliedAdjustments.length !== 1 ? 's' : ''} recorded after this
              statement
            </p>
            <p>
              The figures below are the ones that were sent, and they do not move on their
              own. Reissue to fold these in:{' '}
              {statement.unappliedAdjustments
                .map((a) => `${a.reason} ${formatCurrency(a.deltaCents, { fromCents: true })}`)
                .join(', ')}
              .
            </p>
          </div>
        </div>
      )}

      {/* Facts */}
      <div className="bg-white rounded-lg shadow p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-1">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <CalendarRange size={13} /> Coverage
          </h2>
          <p className="text-sm text-slate-700">
            <span className="text-slate-400">Month:</span>{' '}
            <strong className="font-mono">{statement.period}</strong>
          </p>
          <p className="text-sm text-slate-700">
            <span className="text-slate-400">Window:</span>{' '}
            {formatDate(statement.coverageStart)} – {formatDate(statement.coverageEnd)}
          </p>
          <p className="text-sm text-slate-700">
            <span className="text-slate-400">Statement date:</span>{' '}
            {formatDate(statement.statementDate)}
          </p>
          <p className="text-sm text-slate-700">
            <span className="text-slate-400">Remittance due:</span>{' '}
            {formatDate(statement.paymentDueDate)}
          </p>
        </div>

        <div className="space-y-1">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Users size={13} /> What is being paid
          </h2>
          <p className="text-sm text-slate-700">{statement.basis}</p>
          <p className="text-sm text-slate-700">
            <span className="text-slate-400">Covered primaries:</span>{' '}
            <strong>{statement.primaryCount}</strong>
          </p>
          <p className="text-sm text-slate-700">
            <span className="text-slate-400">Individual / Family:</span>{' '}
            <strong>{statement.individualCount}</strong> /{' '}
            <strong>{statement.familyCount}</strong>
          </p>
          {statement.internalMemo && (
            <p className="text-xs text-slate-500 mt-2 italic">{statement.internalMemo}</p>
          )}
        </div>

        <div className="space-y-1">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Lock size={13} /> Source of figures
          </h2>
          <p className="text-sm text-slate-700">
            <Tooltip
              text="The moment this coverage month's books were closed. Everything on this statement was read from that close and cannot shift afterwards."
              width="lg"
            >
              <span className="cursor-help border-b border-dashed border-slate-400 text-slate-400">
                Books closed:
              </span>
            </Tooltip>{' '}
            {formatDateTime(statement.sourceClosedAt)}
          </p>
          <p className="text-sm text-slate-700">
            <span className="text-slate-400">Close records:</span>{' '}
            {statement.sourcePeriodIds.length}
          </p>
          <p className="text-sm text-slate-700">
            <Tooltip
              text="What this statement currently shows. These follow the recipient's live settings — change them under Contents and this document updates immediately."
              width="lg"
            >
              <span className="cursor-help border-b border-dashed border-slate-400 text-slate-400">
                Contents:
              </span>
            </Tooltip>{' '}
            {[
              statement.showMemberDetail ? 'member detail' : 'totals only',
              statement.disclosure?.groupVisibility === 'all'
                ? 'all groups'
                : statement.disclosure?.groupVisibility === 'listBillOnly'
                  ? 'list-bill employers'
                  : null,
              statement.showTier ? 'rate class' : null,
              statement.showBroker ? 'rep' : null,
              statement.showFullSplit ? 'full split' : null,
            ]
              .filter(Boolean)
              .join(', ')}
          </p>
          <p className="text-xs text-slate-400 font-mono break-all">
            {statement.sourcePayloadHashes[0]?.slice(0, 16)}
            {statement.sourcePayloadHashes.length > 1
              ? ` +${statement.sourcePayloadHashes.length - 1} more`
              : ''}
          </p>
        </div>
      </div>

      {/* Money */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="max-w-sm ml-auto space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Subtotal</span>
            <span className="text-slate-800">
              {formatCurrency(statement.subtotalCents, { fromCents: true })}
            </span>
          </div>
          {(statement.adjustments.length > 0 || statement.adjustmentCents !== 0) && (
            <div className="flex justify-between">
              <span className="text-slate-500">Adjustments</span>
              <span className="text-slate-800">
                {formatCurrency(statement.adjustmentCents, { fromCents: true })}
              </span>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold">
            <span className="text-slate-900">Statement Total</span>
            <span className="text-slate-900">
              {formatCurrency(statement.totalCents, { fromCents: true })}
            </span>
          </div>
          {statement.amountPaidCents > 0 && (
            <>
              <div className="flex justify-between">
                <span className="text-slate-500">Remitted</span>
                <span className="text-slate-800">
                  {formatCurrency(statement.amountPaidCents, { fromCents: true })}
                </span>
              </div>
              <div className="flex justify-between font-semibold">
                <span className="text-slate-700">Balance</span>
                <span className={statement.balanceCents > 0 ? 'text-red-600' : 'text-slate-400'}>
                  {formatCurrency(statement.balanceCents, { fromCents: true })}
                </span>
              </div>
            </>
          )}
          {statement.paymentMethod && (
            <p className="text-xs text-slate-400 text-right">
              Paid by {statement.paymentMethod.toUpperCase()}
              {statement.paymentReference ? ` · ${statement.paymentReference}` : ''}
            </p>
          )}
        </div>
      </div>

      {/* Adjustments on this statement */}
      {statement.adjustments.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-700">Adjustments Included</h2>
          </div>
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Recorded</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Reason</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Notes</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {statement.adjustments.map((row) => (
                <tr key={String(row.id)}>
                  <td className="px-4 py-2 text-slate-600">{formatDate(row.createdAt)}</td>
                  <td className="px-4 py-2 text-slate-700">{row.reason}</td>
                  <td className="px-4 py-2 text-slate-600">{row.notes}</td>
                  <td className="px-4 py-2 text-right text-slate-800">
                    {formatCurrency(row.deltaCents, { fromCents: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Group rollup — internal statements only */}
      {statement.showGroups && statement.groups.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-700">Group Summary</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Organization</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Org Code</th>
                  {statement.groupCodeVaries && (
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Group Code</th>
                  )}
                  {statement.showBroker && (
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Rep / Agency</th>
                  )}
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">
                    <Tooltip text="Primaries on an Individual rate versus a Family rate." width="lg">
                      <span className="cursor-help border-b border-dashed border-slate-400">
                        Ind / Fam
                      </span>
                    </Tooltip>
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Primaries</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {statement.groups.map((row, index) => (
                  <tr key={`${row.groupCode}-${row.groupName}-${index}`}>
                    <td className="px-4 py-2 text-slate-800 font-medium">{row.groupName}</td>
                    <td className="px-4 py-2 font-mono text-slate-500">
                      {row.organizationCode ?? '—'}
                    </td>
                    {statement.groupCodeVaries && (
                      <td className="px-4 py-2 font-mono text-slate-500">{row.groupCode}</td>
                    )}
                    {statement.showBroker && (
                      <td className="px-4 py-2 text-slate-700">
                        {row.repName ?? <span className="text-slate-400">—</span>}
                        {row.agencyName && (
                          <span className="block text-xs text-slate-400">{row.agencyName}</span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-2 text-right text-slate-600 font-mono">
                      {row.individualCount} / {row.familyCount}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-700">{row.primaryCount}</td>
                    <td className="px-4 py-2 text-right text-slate-800">
                      {formatCurrency(row.amountCents, { fromCents: true })}
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-semibold">
                  <td className="px-4 py-2 text-slate-800">Total</td>
                  <td className="px-4 py-2" />
                  {statement.groupCodeVaries && <td className="px-4 py-2" />}
                  {statement.showBroker && <td className="px-4 py-2" />}
                  <td className="px-4 py-2 text-right text-slate-700 font-mono">
                    {statement.individualCount} / {statement.familyCount}
                  </td>
                  <td className="px-4 py-2 text-right text-slate-800">
                    {statement.primaryCount}
                  </td>
                  <td className="px-4 py-2 text-right text-slate-900">
                    {formatCurrency(statement.subtotalCents, { fromCents: true })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Covered primary detail */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-700">Covered Primary Detail</h2>
          <span className="ml-auto text-xs text-slate-400">
            {statement.memberLines.length} of {statement.primaryCount} primaries itemized
            {statement.memberLines.length > 0 &&
              ` · ${formatCurrency(statement.itemizedCents, { fromCents: true })}`}
          </span>
        </div>
        {statement.showBroker && statement.attributionBasis !== 'frozen' &&
          statement.attributionBasis !== 'none' && (
            <p className="px-6 py-3 bg-amber-50 border-b border-amber-200 text-xs text-amber-900">
              {statement.attributionBasis === 'current'
                ? 'This coverage month was closed before rep attribution was captured, so the reps below are the current attribution of record rather than a frozen historical one.'
                : 'Some rows below carry the rep captured at close; the rest fall back to the current attribution of record.'}
            </p>
          )}
        {!statement.memberDetailComplete && (
          <div className="border-b border-amber-200">
            <MissingMemberDetail
              period={statement.period}
              missing={statement.missingDetailGroups}
              hasSome={statement.memberDetailAvailable}
            />
          </div>
        )}
        {!statement.memberDetailAvailable ? null : statement.memberLines.length === 0 ? (
          <p className="px-6 py-6 text-sm text-slate-500">
            No covered primaries earned this recipient a payment in {statement.period}.
          </p>
        ) : (
          <div className="overflow-x-auto max-h-[520px]">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Member ID</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Member</th>
                  {statement.showGroups && (
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">
                      Organization
                    </th>
                  )}
                  {statement.showTier && (
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Rate Class</th>
                  )}
                  {statement.showBroker && (
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">
                      Rep / Broker
                    </th>
                  )}
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Amount</th>
                  {status === 'draft' && <th className="px-4 py-2" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {statement.memberLines.map((line, index) => (
                  <tr key={`${line.memberId}-${index}`} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-mono text-slate-700">{line.memberId}</td>
                    <td className="px-4 py-2 text-slate-800">
                      {line.lastName}, {line.firstName}
                    </td>
                    {statement.showGroups && (
                      <td className="px-4 py-2 text-slate-700">
                        {line.groupName}
                        {line.groupCode && line.groupCode !== 'DIRECT' && (
                          <span className="block text-xs text-slate-400 font-mono">
                            {line.groupCode}
                            {line.organizationCode ? ` · ${line.organizationCode}` : ''}
                          </span>
                        )}
                      </td>
                    )}
                    {statement.showTier && (
                      <td className="px-4 py-2 text-slate-600">{line.rateClass}</td>
                    )}
                    {statement.showBroker && (
                      <td className="px-4 py-2 text-slate-700">
                        {line.repName ?? (
                          <span className="text-slate-400">Unattributed</span>
                        )}
                        {line.repCode && (
                          <span className="text-slate-400 font-mono text-xs"> · {line.repCode}</span>
                        )}
                        {line.agencyName && (
                          <div className="text-xs text-slate-400">{line.agencyName}</div>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-2 text-right text-slate-800">
                      {formatCurrency(line.amountCents, { fromCents: true })}
                    </td>
                    {status === 'draft' && (
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() =>
                            setExcluding({
                              memberId: line.memberId,
                              name: `${line.lastName}, ${line.firstName}`,
                              amountCents: line.amountCents,
                            })
                          }
                          className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-amber-700"
                          title="Leave this primary off the statement"
                        >
                          <UserMinus size={12} /> Exclude
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ExcludedPrimaries
        statementId={id}
        excluded={statement.excludedMembers ?? []}
        isDraft={status === 'draft'}
      />

      <VerificationPanel statementId={id} />

      <StatementAuditLog statementId={id} />

      {/* Dialogs */}
      {excluding && (
        <ExcludeModal
          statementId={id}
          member={excluding}
          onClose={() => setExcluding(null)}
        />
      )}
      {showRemittance && (
        <RemittanceModal
          statementId={id}
          balanceCents={statement.balanceCents}
          onClose={() => setShowRemittance(false)}
        />
      )}
      {showEdit && (
        <EditModal
          statementId={id}
          paymentDueDate={statement.paymentDueDate}
          internalMemo={statement.internalMemo}
          onClose={() => setShowEdit(false)}
        />
      )}
      {showVoid && (
        <ReasonModal
          title="Void Statement"
          description="The statement stays on the books as a voided record. Generate a replacement if the partner still needs one."
          confirmLabel="Void Statement"
          confirmClass="bg-red-600 hover:bg-red-700"
          onClose={() => setShowVoid(false)}
          onConfirm={async (reason) => {
            try {
              await voidStatement({ statementId: id, reason });
              toast.success('Statement voided');
              setShowVoid(false);
            } catch (error) {
              toast.error((error as Error).message ?? 'Could not void the statement');
            }
          }}
        />
      )}
      {showReissue && (
        <ReasonModal
          title="Reissue Statement"
          description="Voids this statement and cuts a fresh one from the same closed month, picking up any adjustments recorded since."
          confirmLabel="Void and Reissue"
          confirmClass="bg-amber-600 hover:bg-amber-700"
          onClose={() => setShowReissue(false)}
          onConfirm={async (reason) => {
            try {
              const result = await reissue({ statementId: id, reason });
              toast.success('Replacement statement generated');
              setShowReissue(false);
              window.location.href = `/admin/vendor-statements/${result.replacementId}`;
            } catch (error) {
              toast.error((error as Error).message ?? 'Could not reissue the statement');
            }
          }}
        />
      )}
    </div>
  );
}
