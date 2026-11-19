'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from 'convex/react';
import { AlertTriangle, ArrowLeft, CheckCircle2, FileCheck2, Scale, Wrench } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import { Breadcrumbs, SkeletonCard, SkeletonTable, Tooltip, useToast } from '@/components/admin/ui';
import { formatCurrency } from '@/lib/admin-format';

type Correction = NonNullable<ReturnType<typeof useQuery<typeof api.admin.vendorStatements.getSplitCorrection>>>;
type Month = Correction['periods'][number];
type Recipient = Month['recipients'][number];

const money = (cents: number) => formatCurrency(cents, { fromCents: true });

const STATUS: Record<Recipient['status'], { label: string; className: string; help: string }> = {
  restate: {
    label: 'Not restated',
    className: 'bg-amber-100 text-amber-800',
    help: 'The month is still divided under the earlier split. Repairing restates it first.',
  },
  reissue: {
    label: 'Statement out of date',
    className: 'bg-amber-100 text-amber-800',
    help: 'The statement was cut from the earlier figures. Repairing voids it and issues a replacement, carrying any remittance already recorded.',
  },
  missing: {
    label: 'No statement yet',
    className: 'bg-slate-100 text-slate-700',
    help: 'Nothing has been generated for this recipient and month. Repairing creates a draft.',
  },
  ok: {
    label: 'Corrected',
    className: 'bg-green-100 text-green-700',
    help: 'Statement matches the control-sheet split.',
  },
};

const SPLIT_COLUMNS: Array<{ key: 'toothlensCents' | 'advisorCents' | 'careingtonCents' | 'processingCents' | 'partnerVendorCents' | 'brokerCents' | 'ryzeKeepCents'; label: string }> = [
  { key: 'toothlensCents', label: 'Toothlens' },
  { key: 'advisorCents', label: 'Advisor' },
  { key: 'careingtonCents', label: 'Careington' },
  { key: 'processingCents', label: 'Processing' },
  { key: 'partnerVendorCents', label: 'Ideal override' },
  { key: 'brokerCents', label: 'Broker' },
  { key: 'ryzeKeepCents', label: 'Ryze' },
];

export default function SplitCorrectionPage() {
  const data = useQuery(api.admin.vendorStatements.getSplitCorrection, {});
  const repair = useMutation(api.admin.vendorStatements.repairSplitPeriod);
  const toast = useToast();
  const [running, setRunning] = useState<string | null>(null);

  const runRepair = async (periods: string[]) => {
    setRunning(periods.length === 1 ? periods[0] : 'all');
    try {
      for (const period of periods) {
        const result = await repair({ period });
        const parts = [
          result.restated > 0 ? `${result.restated} restated` : null,
          result.reissued.length > 0 ? `${result.reissued.length} reissued` : null,
          result.created.length > 0 ? `${result.created.length} created` : null,
          result.voided.length > 0 ? `${result.voided.length} voided` : null,
        ].filter(Boolean);
        toast.success(`${period}: ${parts.length > 0 ? parts.join(', ') : 'already corrected'}`);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Repair failed.');
    } finally {
      setRunning(null);
    }
  };

  const pending = data?.periods.filter((p) => p.needsRepair).map((p) => p.period) ?? [];

  // Per-recipient totals across every affected month.
  const totals = new Map<string, { name: string; earlier: number; correct: number; paid: number; owed: number }>();
  for (const month of data?.periods ?? []) {
    for (const r of month.recipients) {
      const t = totals.get(r.vendor) ?? { name: r.vendorName, earlier: 0, correct: 0, paid: 0, owed: 0 };
      t.earlier += r.earlierCents;
      t.correct += r.correctCents + r.adjustmentCents;
      t.paid += r.paidCents;
      t.owed += r.owedCents;
      totals.set(r.vendor, t);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Breadcrumbs
            items={[
              { label: 'Admin', href: '/admin' },
              { label: 'Vendor Statements', href: '/admin/vendor-statements' },
              { label: 'Split Correction' },
            ]}
          />
          <h1 className="text-2xl font-bold text-slate-900 mt-1 flex items-center gap-2">
            <Scale size={24} className="text-blue-600" />
            Split Correction
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Months closed under the earlier split, what each partner was owed then, what the control sheet
            says they are owed, and whether their statements have caught up.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/vendor-statements"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
          >
            <ArrowLeft size={14} />
            Vendor Statements
          </Link>
          {pending.length > 0 && (
            <Tooltip
              text="Restates every listed month under the control sheet, reissues statements cut from the earlier figures (carrying any remittance already recorded), voids statements that would now be $0, and drafts any that are missing."
              width="lg"
            >
              <button
                onClick={() => runRepair(pending)}
                disabled={running !== null}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700 disabled:opacity-50"
              >
                <Wrench size={14} />
                {running === 'all' ? 'Repairing…' : `Repair all ${pending.length} month${pending.length === 1 ? '' : 's'}`}
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {data === undefined ? (
        <>
          <SkeletonCard />
          <SkeletonTable />
        </>
      ) : data.periods.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-slate-500">
          No closed month was divided under an earlier split. Nothing to correct.
        </div>
      ) : (
        <>
          {/* The two tables side by side */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">What changed</h2>
              <p className="text-sm text-slate-500">
                Per primary, per month. The control sheet&apos;s $1.00 Toothlens line is shared evenly
                between Toothlens and our advisor. Through 2026 Ideal Health is paid its override and the broker
                commission, and pays the brokers. Ryze&apos;s share now covers Careington / DialCare and processing.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-5 py-2 font-medium">Split</th>
                    {SPLIT_COLUMNS.map((c) => (
                      <th key={c.key} className="text-right px-4 py-2 font-medium whitespace-nowrap">{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {data.earlierPricing && (
                    <>
                      <SplitRow label="Earlier — single" split={data.earlierPricing.individualSplits} muted />
                      <SplitRow label="Earlier — family" split={data.earlierPricing.familySplits} muted />
                    </>
                  )}
                  <SplitRow label="Control sheet — single" split={data.currentPricing.individual} />
                  <SplitRow label="Control sheet — family" split={data.currentPricing.family} />
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals per recipient */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...totals.entries()].map(([vendor, t]) => (
              <div key={vendor} className="bg-white rounded-lg shadow p-4">
                <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                <dl className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between text-slate-500">
                    <dt>Earlier split</dt>
                    <dd className="tabular-nums line-through decoration-slate-300">{money(t.earlier)}</dd>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <dt>Control sheet</dt>
                    <dd className="tabular-nums font-medium">{money(t.correct)}</dd>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <dt>Remitted</dt>
                    <dd className="tabular-nums">{money(t.paid)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-1 text-slate-900">
                    <dt className="font-medium">Still owed</dt>
                    <dd className="tabular-nums font-semibold">{money(t.owed)}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 -mt-3">
            Remitted counts only payments recorded on a statement. Record a payment made outside the app on
            the month&apos;s current statement and it carries forward through any repair.
          </p>

          {/* Month by month */}
          {data.periods.map((month) => (
            <MonthCard
              key={month.period}
              month={month}
              running={running}
              onRepair={() => runRepair([month.period])}
            />
          ))}
        </>
      )}
    </div>
  );
}

function SplitRow({
  label,
  split,
  muted = false,
}: {
  label: string;
  split: Partial<Record<(typeof SPLIT_COLUMNS)[number]['key'], number>>;
  muted?: boolean;
}) {
  return (
    <tr className={muted ? 'text-slate-400' : 'text-slate-900'}>
      <td className="px-5 py-2 font-medium whitespace-nowrap">{label}</td>
      {SPLIT_COLUMNS.map((c) => (
        <td key={c.key} className="px-4 py-2 text-right tabular-nums">{money(split[c.key] ?? 0)}</td>
      ))}
    </tr>
  );
}

function MonthCard({
  month,
  running,
  onRepair,
}: {
  month: Month;
  running: string | null;
  onRepair: () => void;
}) {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200 flex flex-wrap items-center gap-3">
        <h2 className="text-base font-semibold text-slate-900 font-mono">{month.period}</h2>
        <span className="text-sm text-slate-500">{month.primaryCount} primaries</span>
        {month.needsRepair ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            <AlertTriangle size={12} /> Needs repair
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
            <CheckCircle2 size={12} /> Corrected
          </span>
        )}
        {month.needsRepair && (
          <button
            onClick={onRepair}
            disabled={running !== null}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700 disabled:opacity-50"
          >
            <Wrench size={12} />
            {running === month.period ? 'Repairing…' : `Repair ${month.period}`}
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-5 py-2 font-medium">Recipient</th>
              <th className="text-right px-4 py-2 font-medium whitespace-nowrap">Earlier split</th>
              <th className="text-right px-4 py-2 font-medium whitespace-nowrap">Control sheet</th>
              <th className="text-right px-4 py-2 font-medium">Difference</th>
              <th className="text-left px-4 py-2 font-medium">Statement</th>
              <th className="text-right px-4 py-2 font-medium">Remitted</th>
              <th className="text-right px-4 py-2 font-medium whitespace-nowrap">Still owed</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {month.recipients.map((r) => (
              <tr key={r.vendor}>
                <td className="px-5 py-2 font-medium text-slate-900 whitespace-nowrap">{r.vendorName}</td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-500">{money(r.earlierCents)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-900">{money(r.correctCents)}</td>
                <td
                  className={`px-4 py-2 text-right tabular-nums ${
                    r.differenceCents > 0 ? 'text-blue-700' : r.differenceCents < 0 ? 'text-red-700' : 'text-slate-400'
                  }`}
                >
                  {r.differenceCents > 0 ? '+' : ''}
                  {money(r.differenceCents)}
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  {r.statements.length === 0 ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    r.statements.map((s) => (
                      <div key={s.statementId} className="flex items-center gap-1.5">
                        <FileCheck2 size={12} className="text-slate-400" />
                        <Link
                          href={`/admin/vendor-statements/${s.statementId}`}
                          className="font-mono text-blue-700 hover:underline"
                        >
                          {s.statementNumberDisplay}
                        </Link>
                        {s.issuedSubtotalCents !== s.booksSubtotalCents && (
                          <span className="text-xs text-amber-700">
                            cut at {money(s.issuedSubtotalCents)}, now {money(s.booksSubtotalCents)}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-600">{money(r.paidCents)}</td>
                <td className="px-4 py-2 text-right tabular-nums font-semibold text-slate-900">{money(r.owedCents)}</td>
                <td className="px-4 py-2">
                  <Tooltip text={STATUS[r.status].help} width="lg">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STATUS[r.status].className}`}>
                      {STATUS[r.status].label}
                    </span>
                  </Tooltip>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
