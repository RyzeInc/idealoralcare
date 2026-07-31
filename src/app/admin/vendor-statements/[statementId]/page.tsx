'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from 'convex/react';
import {
  AlertTriangle,
  CalendarRange,
  CreditCard,
  FileSpreadsheet,
  FileText,
  History,
  Lock,
  RefreshCw,
  Send,
  Settings2,
  Table2,
  Trash2,
  Users,
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
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Group</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Organization</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Primaries</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {statement.groups.map((row) => (
                  <tr key={`${row.groupCode}-${row.groupName}`}>
                    <td className="px-4 py-2 font-mono text-slate-700">{row.groupCode}</td>
                    <td className="px-4 py-2 text-slate-700">{row.groupName}</td>
                    <td className="px-4 py-2 text-right text-slate-700">{row.primaryCount}</td>
                    <td className="px-4 py-2 text-right text-slate-800">
                      {formatCurrency(row.amountCents, { fromCents: true })}
                    </td>
                  </tr>
                ))}
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
            {statement.memberLines.length} line{statement.memberLines.length !== 1 ? 's' : ''}
          </span>
        </div>
        {!statement.memberDetailAvailable ? (
          <p className="px-6 py-6 text-sm text-slate-500">
            This coverage month was closed before per-primary lines were frozen. Its totals
            are authoritative and appear above; the detail is not rebuilt from today&apos;s
            roster.
          </p>
        ) : statement.memberLines.length === 0 ? (
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
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Group</th>
                  )}
                  {statement.showTier && (
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Rate Class</th>
                  )}
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Amount</th>
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
                      <td className="px-4 py-2 font-mono text-slate-600">{line.groupCode}</td>
                    )}
                    {statement.showTier && (
                      <td className="px-4 py-2 text-slate-600">{line.rateClass}</td>
                    )}
                    <td className="px-4 py-2 text-right text-slate-800">
                      {formatCurrency(line.amountCents, { fromCents: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <StatementAuditLog statementId={id} />

      {/* Dialogs */}
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
