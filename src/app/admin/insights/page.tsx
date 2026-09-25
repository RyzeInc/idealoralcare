"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import {
  Users, UserPlus, DollarSign, TrendingDown, AlertTriangle, CheckCircle2,
  ArrowRight, Activity,
} from "lucide-react";
import {
  StatCard, StatCardGrid, ChartFrame, ChartEmpty, TrendChart, DataTable,
  RangePicker, SectionHeader, RevenueMix, type Column,
} from "@/components/insights";
import { MaintenancePanel } from "@/components/admin/MaintenancePanel";
import { formatCurrency } from "@/lib/admin-format";

const money = (cents: number) => formatCurrency(cents, { fromCents: true });
const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(1)}%`);

type LeaderRow = {
  rank: number;
  repId: string;
  name: string;
  agencyName: string | null;
  activeMembers: number;
  newMembers: number;
  churnedMembers: number;
  netGrowth: number;
};

/**
 * Internal insights.
 *
 * Same queries and components as /partner — they resolve an admin scope and
 * return the whole book. What is extra here is the data-health panel: every
 * figure on this dashboard rests on attribution stamps, exit timestamps, and
 * tier classification, and when any of those degrade the numbers get quietly
 * wrong rather than visibly broken. This is where that shows up.
 */
export default function AdminInsights() {
  const [days, setDays] = useState(30);

  const overview = useQuery(api.insights.metrics.getOverview, { days });
  const trends = useQuery(api.insights.metrics.getTrends, { days: 90 });
  const leaderboard = useQuery(api.insights.downline.getLeaderboard, { days, limit: 10 });

  const drift = useQuery(api.admin.repAttributionBackfill.getAttributionDrift, { sampleSize: 200 });
  const lifecycle = useQuery(api.admin.lifecycleBackfill.getLifecycleHealth);
  const tiers = useQuery(api.admin.revenueHealth.getTierClassificationHealth);
  const ledger = useQuery(api.admin.commissions.getCommissionLedgerHealth);
  const bundleHealth = useQuery(api.insights.metrics.getBundleHealth);

  const k = overview?.kpis;
  const loading = overview === undefined;

  const leaderColumns: Column<LeaderRow>[] = [
    { key: "rank", header: "#", cell: (r) => r.rank, value: (r) => r.rank },
    {
      key: "name", header: "Rep",
      cell: (r) => (
        <div className="min-w-0">
          <p className="text-slate-900 truncate">{r.name}</p>
          <p className="text-xs text-slate-400 truncate">{r.agencyName ?? "Independent"}</p>
        </div>
      ),
      value: (r) => r.name,
    },
    { key: "activeMembers", header: "Active", align: "right", cell: (r) => r.activeMembers, value: (r) => r.activeMembers },
    { key: "newMembers", header: "New", align: "right", cell: (r) => r.newMembers, value: (r) => r.newMembers },
    {
      key: "netGrowth", header: "Net", align: "right",
      cell: (r) => (
        <span className={r.netGrowth > 0 ? "text-emerald-700 font-medium" : r.netGrowth < 0 ? "text-red-600" : ""}>
          {r.netGrowth > 0 ? "+" : ""}{r.netGrowth}
        </span>
      ),
      value: (r) => r.netGrowth,
    },
  ];

  const healthChecks = [
    {
      label: "Attribution stamps",
      ok: drift ? drift.drifted === 0 : null,
      detail: drift
        ? drift.drifted === 0
          ? `${drift.sampled} sampled, no drift`
          : `${drift.drifted} of ${drift.sampled} sampled disagree with the resolver`
        : "…",
      fix: "Click \"Run backfills\" above.",
    },
    {
      label: "Exit timestamps",
      ok: lifecycle ? lifecycle.exitedMissingTimestamp === 0 : null,
      detail: lifecycle
        ? lifecycle.exitedMissingTimestamp === 0
          ? `All ${lifecycle.exited} departed members dated`
          : `${lifecycle.exitedMissingTimestamp} departed members have no exit date`
        : "…",
      fix: "Click \"Run backfills\" above.",
    },
    {
      label: "Billing coverage",
      ok: bundleHealth ? bundleHealth.bySource.none === 0 : null,
      detail: bundleHealth
        ? bundleHealth.bySource.none === 0
          ? `Every covered member has a billing arrangement (${bundleHealth.bySource.list_bill} employer-billed, ${bundleHealth.bySource.direct} direct, ${bundleHealth.bySource.comp} comped)`
          : `${bundleHealth.bySource.none} covered members have no billing arrangement at all`
        : "…",
      fix: "Members on the book with no subscription and no list-bill group — check their group's list-bill config.",
    },
    {
      label: "Dispersal classification",
      ok: tiers ? tiers.unclassifiedPaidBundles === 0 : null,
      detail: tiers
        ? tiers.unclassifiedPaidBundles === 0
          ? "All paid bundles priced by the dispersal model"
          : `${tiers.unclassifiedPaidBundles} paid bundles produce $0 partner share — ~${money(tiers.unrecognizedMonthlyCentsEstimate)}/mo unrecognised`
        : "…",
      fix: "Annual plans are not classified by the dispersal engine — needs a pricing policy decision. Affects partner earnings only, not revenue.",
    },
    {
      label: "Commission ledger",
      ok: ledger ? ledger.quarantined === 0 : null,
      detail: ledger
        ? ledger.quarantined === 0
          ? `${ledger.reportable} payables reportable`
          : `${ledger.quarantined} of ${ledger.total} payables quarantined (pre-repair rows)`
        : "…",
      fix: "Legacy rows were written at a hardcoded rate; excluded from all totals",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Insights</h1>
          <p className="text-slate-500 mt-1">Whole-book performance across every partner.</p>
        </div>
        <RangePicker value={days} onChange={setDays} />
      </div>

      <StatCardGrid>
        <StatCard
          label="Active members"
          value={loading ? "—" : k!.activeMembers.current.toLocaleString()}
          delta={loading ? undefined : k!.activeMembers}
          icon={<Users size={18} className="text-blue-600" />}
          accent="bg-blue-50"
        />
        <StatCard
          label="New enrollments"
          value={loading ? "—" : k!.newEnrollments.current.toLocaleString()}
          delta={loading ? undefined : k!.newEnrollments}
          icon={<UserPlus size={18} className="text-emerald-600" />}
          accent="bg-emerald-50"
        />
        <StatCard
          label="Monthly revenue"
          value={loading ? "—" : money(k!.mrrCents.current)}
          delta={loading ? undefined : k!.mrrCents}
          formatDelta={(c) => `${c > 0 ? "+" : ""}${money(c)}`}
          icon={<DollarSign size={18} className="text-violet-600" />}
          accent="bg-violet-50"
          sub={loading ? undefined : `${money(k!.arpmCents.current)} per member`}
        />
        <StatCard
          label="Retention"
          value={loading ? "—" : pct(k!.retentionRate)}
          icon={<TrendingDown size={18} className="text-amber-600" />}
          accent="bg-amber-50"
          sub={loading ? undefined : `${k!.atRiskMembers} at risk`}
        />
      </StatCardGrid>

      {overview && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <ChartFrame
            title="Where the revenue comes from"
            subtitle="Whole book, by billing arrangement"
          >
            <RevenueMix
              bySource={overview.bySource}
              totalCents={k?.mrrCents.current ?? 0}
              formatMoney={money}
            />
          </ChartFrame>
          <div className="lg:col-span-2" />
        </div>
      )}

      <div>
        <SectionHeader
          title="Data health"
          subtitle="Every number above depends on these. Fix them before trusting a report."
        />
        <div className="mt-4">
          <MaintenancePanel />
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {healthChecks.map((check) => (
            <div
              key={check.label}
              className={`rounded-xl border p-4 ${
                check.ok === null
                  ? "bg-white border-slate-200"
                  : check.ok
                    ? "bg-white border-slate-200"
                    : "bg-amber-50 border-amber-200"
              }`}
            >
              <div className="flex items-start gap-3">
                {check.ok === null ? (
                  <Activity size={16} className="text-slate-300 mt-0.5 shrink-0" />
                ) : check.ok ? (
                  <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{check.label}</p>
                  <p className="text-xs text-slate-600 mt-0.5">{check.detail}</p>
                  {check.ok === false && (
                    <p className="text-xs text-amber-800 mt-1.5 font-mono">{check.fix}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <ChartFrame
        title="Members over time"
        subtitle="Whole book, active members at end of day"
        footnote={
          trends?.backfilledFrom
            ? `History begins ${trends.backfilledFrom}. Run insights.rollups.backfillRollupDay to fill earlier days.`
            : undefined
        }
      >
        {!trends || trends.series.length === 0 ? (
          <ChartEmpty message="No rollups yet. The nightly cron writes the first row at 09:00 UTC." />
        ) : (
          <TrendChart
            data={trends.series}
            series={[
              { key: "activeMembers", label: "Active members", slot: 0 },
              { key: "newMembers", label: "New", slot: 2 },
            ]}
          />
        )}
      </ChartFrame>

      <div>
        <SectionHeader
          title="Top reps"
          subtitle={`Net growth over the last ${days} days`}
          action={
            <Link
              href="/admin/brokers"
              className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
            >
              All partners <ArrowRight size={13} />
            </Link>
          }
        />
        <div className="mt-4">
          <DataTable
            columns={leaderColumns}
            rows={(leaderboard?.rows ?? []) as LeaderRow[]}
            rowKey={(r) => r.repId}
            exportFilename="top-reps"
            empty={leaderboard === undefined ? "Loading…" : "No rep production yet."}
          />
        </div>
      </div>

      {tiers && tiers.unclassifiedPricePoints.length > 0 && (
        <ChartFrame
          title="Unpriced subscriptions"
          subtitle="Paid bundles the dispersal model scores at $0"
          footnote="These contribute to MRR but produce no vendor fees or partner share. Resolving this is a revenue-policy decision, not a code change."
        >
          <DataTable
            columns={[
              {
                key: "price", header: "Price point",
                cell: (r: { totalCents: number }) => money(r.totalCents),
                value: (r) => r.totalCents,
              },
              { key: "count", header: "Bundles", align: "right", cell: (r: { count: number }) => r.count, value: (r) => r.count },
              { key: "monthly", header: "Monthly", align: "right", cell: (r: { monthly: number }) => r.monthly, value: (r) => r.monthly },
              { key: "annual", header: "Annual", align: "right", cell: (r: { annual: number }) => r.annual, value: (r) => r.annual },
            ]}
            rows={tiers.unclassifiedPricePoints}
            rowKey={(r) => String(r.totalCents)}
          />
        </ChartFrame>
      )}
    </div>
  );
}
