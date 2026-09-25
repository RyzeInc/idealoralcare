"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AlertTriangle } from "lucide-react";
import {
  ChartFrame, ChartEmpty, CohortGrid, BarSeriesChart, DataTable,
  ScopeBanner, SectionHeader, type Column,
} from "@/components/insights";
import { formatCurrency } from "@/lib/admin-format";

const money = (cents: number) => formatCurrency(cents, { fromCents: true });

type ChurnRow = {
  month: string;
  openingMembers: number;
  newMembers: number;
  churnedMembers: number;
  listBillExits: number;
  trueChurn: number;
  churnRate: number | null;
  churnedMrrCents: number;
};

export default function PartnerRetention() {
  const cohorts = useQuery(api.insights.retention.getCohortRetention, { months: 12 });
  const churn = useQuery(api.insights.retention.getChurn, { months: 12 });
  const movement = useQuery(api.insights.retention.getMrrMovement, { months: 6 });
  const confidence = useQuery(api.insights.retention.getRetentionConfidence);

  const churnColumns: Column<ChurnRow>[] = [
    { key: "month", header: "Month", cell: (r) => r.month, value: (r) => r.month },
    { key: "opening", header: "Opening", align: "right", cell: (r) => r.openingMembers, value: (r) => r.openingMembers },
    { key: "new", header: "New", align: "right", cell: (r) => r.newMembers, value: (r) => r.newMembers },
    { key: "churned", header: "Left", align: "right", cell: (r) => r.churnedMembers, value: (r) => r.churnedMembers },
    {
      key: "listBill", header: "of which payroll exits", align: "right",
      cell: (r) => <span className="text-slate-500">{r.listBillExits}</span>,
      value: (r) => r.listBillExits,
    },
    {
      key: "rate", header: "Churn rate", align: "right",
      cell: (r) => (r.churnRate === null ? "—" : `${(r.churnRate * 100).toFixed(1)}%`),
      value: (r) => r.churnRate,
    },
    {
      key: "mrr", header: "MRR lost", align: "right",
      cell: (r) => money(r.churnedMrrCents), value: (r) => r.churnedMrrCents,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Retention</h1>
        <div className="mt-1.5">
          {cohorts && <ScopeBanner label={cohorts.scope.label} kind={cohorts.scope.kind} truncated={cohorts.truncated} />}
        </div>
      </div>

      {confidence && !confidence.complete && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-900">
              {confidence.exitedMissingTimestamp} of {confidence.exitedMembers} departed members
              have no exit date
            </p>
            <p className="text-amber-800 mt-0.5">
              Cohorts below treat them as still retained, which overstates retention. Running
              the lifecycle backfill reconstructs their exit dates from Stripe cancellations,
              payroll-deduction terminations, and the activity log.
            </p>
          </div>
        </div>
      )}

      <ChartFrame
        title="Cohort retention"
        subtitle="Share of each month's joiners still active, by months since joining"
        footnote="Empty cells have not happened yet. Members marked inactive count as churned — 'no active plans' is the same event as leaving for a retention curve."
      >
        {!cohorts ? (
          <ChartEmpty message="Loading…" />
        ) : (
          <CohortGrid cohorts={cohorts.cohorts} months={cohorts.months} />
        )}
      </ChartFrame>

      <ChartFrame
        title="Revenue movement"
        subtitle="Where monthly recurring revenue changed"
        footnote="Expansion and contraction come from recorded tier changes; new and churned from member lifecycle dates."
      >
        {!movement || movement.series.length === 0 ? (
          <ChartEmpty message="Not enough history yet." />
        ) : (
          <BarSeriesChart
            data={movement.series}
            xKey="month"
            stacked
            showZeroLine
            valueFormatter={(v) => money(v)}
            series={[
              { key: "newMrrCents", label: "New", slot: 0 },
              { key: "expansionMrrCents", label: "Expansion", slot: 2 },
              { key: "contractionMrrCents", label: "Contraction", slot: 3 },
              { key: "churnedMrrCents", label: "Churned", slot: 7 },
            ]}
          />
        )}
      </ChartFrame>

      <div>
        <SectionHeader title="Churn detail" subtitle="Monthly, with payroll exits separated out" />
        <div className="mt-4">
          <DataTable
            columns={churnColumns}
            rows={(churn?.series ?? []) as ChurnRow[]}
            rowKey={(r) => r.month}
            exportFilename="churn"
            empty={churn === undefined ? "Loading…" : "No history yet."}
          />
        </div>
        <p className="text-xs text-slate-400 mt-3">
          Payroll exits are members who came off an employer&rsquo;s list bill. They are usually
          converting to direct pay rather than leaving, so counting them as churn would overstate
          losses.
        </p>
      </div>

      {churn && churn.cancellationReasons.length > 0 && (
        <ChartFrame title="Cancellation reasons" subtitle="Where a reason was recorded">
          <DataTable
            columns={[
              { key: "reason", header: "Reason", cell: (r: { reason: string; count: number }) => r.reason, value: (r) => r.reason },
              { key: "count", header: "Members", align: "right", cell: (r) => r.count, value: (r) => r.count },
            ]}
            rows={churn.cancellationReasons}
            rowKey={(r) => r.reason}
          />
        </ChartFrame>
      )}
    </div>
  );
}
