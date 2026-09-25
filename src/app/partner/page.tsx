"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import {
  Users, UserPlus, DollarSign, TrendingDown, AlertTriangle, ArrowRight, Wallet,
} from "lucide-react";
import {
  StatCard, StatCardGrid, ChartFrame, ChartEmpty, TrendChart, DataTable,
  ScopeBanner, RangePicker, SectionHeader, EstimateBadge, RevenueMix, type Column,
} from "@/components/insights";
import { formatCurrency } from "@/lib/admin-format";

const money = (cents: number) => formatCurrency(cents, { fromCents: true });
const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(1)}%`);

type EarningRow = { period: string; partnerVendorCents: number; grossCents: number; memberCount: number };

export default function PartnerOverview() {
  const [days, setDays] = useState(30);

  const overview = useQuery(api.insights.metrics.getOverview, { days });
  const trends = useQuery(api.insights.metrics.getTrends, { days: Math.max(days, 30) });
  const earnings = useQuery(api.insights.metrics.getEarningsByPeriod, { months: 6 });
  const watchlist = useQuery(api.insights.watchlist.getWatchlist, { limit: 5 });

  const k = overview?.kpis;
  const loading = overview === undefined;

  const earningColumns: Column<EarningRow>[] = [
    { key: "period", header: "Month", cell: (r) => r.period, value: (r) => r.period },
    { key: "members", header: "Members", align: "right", cell: (r) => r.memberCount.toLocaleString(), value: (r) => r.memberCount },
    { key: "gross", header: "Gross", align: "right", cell: (r) => money(r.grossCents), value: (r) => r.grossCents },
    {
      key: "share", header: "Your share", align: "right",
      cell: (r) => <span className="font-medium text-slate-900">{money(r.partnerVendorCents)}</span>,
      value: (r) => r.partnerVendorCents,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Overview</h1>
          <div className="mt-1.5">
            {overview && (
              <ScopeBanner
                label={overview.scope.label}
                kind={overview.scope.kind}
                truncated={overview.truncated}
              />
            )}
          </div>
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
          sub={loading ? undefined : `Net ${k!.netGrowth.current >= 0 ? "+" : ""}${k!.netGrowth.current} after churn`}
        />
        <StatCard
          label="Monthly revenue"
          value={loading ? "—" : money(k!.mrrCents.current)}
          delta={loading ? undefined : k!.mrrCents}
          formatDelta={(c) => `${c > 0 ? "+" : ""}${money(c)}`}
          icon={<DollarSign size={18} className="text-violet-600" />}
          accent="bg-violet-50"
          sub={loading ? undefined : `${money(k!.arpmCents.current)} per member`}
          hint="Recurring revenue across every billing arrangement — members paying us directly, plus employers invoiced for payroll-deducted members. Annual plans divided by 12. Separate from the dispersal model that partner earnings are drawn from."
        />
        <StatCard
          label="Retention"
          value={loading ? "—" : pct(k!.retentionRate)}
          icon={<TrendingDown size={18} className="text-amber-600" />}
          accent="bg-amber-50"
          higherIsBetter
          sub={loading ? undefined : `${k!.terminations.current} left this period`}
        />
      </StatCardGrid>

      {overview && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <ChartFrame
            title="Where the revenue comes from"
            subtitle="Concentration across billing arrangements"
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

      {!loading && k!.unclassifiedPayingMembers > 0 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-900">
              {k!.unclassifiedPayingMembers} paying{" "}
              {k!.unclassifiedPayingMembers === 1 ? "member is" : "members are"} not priced by the
              revenue model
            </p>
            <p className="text-amber-800 mt-0.5">
              They contribute to monthly revenue above, but produce no partner share — annual
              plans are not classified by the dispersal engine. Estimated earnings understate by
              this amount. This is separate from how the member is billed.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <ChartFrame
            title="Members over time"
            subtitle="Active members at the end of each day"
            footnote={
              trends?.backfilledFrom
                ? `History begins ${trends.backfilledFrom}. Earlier days have no rollup yet.`
                : undefined
            }
          >
            {!trends || trends.series.length === 0 ? (
              <ChartEmpty message="No history yet. The nightly rollup writes the first points tonight; today's figures are live above." />
            ) : (
              <TrendChart
                data={trends.series}
                series={[{ key: "activeMembers", label: "Active members" }]}
                area
              />
            )}
          </ChartFrame>
        </div>

        <ChartFrame
          title="Needs attention"
          subtitle={watchlist ? `${watchlist.total} open` : undefined}
          action={
            <Link
              href="/partner/watchlist"
              className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
            >
              All <ArrowRight size={12} />
            </Link>
          }
        >
          {!watchlist || watchlist.items.length === 0 ? (
            <ChartEmpty message="Nothing needs action right now." />
          ) : (
            <ul className="divide-y divide-slate-100 -mx-1">
              {watchlist.items.map((item, i) => (
                <li key={i} className="py-2.5 px-1">
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                        item.severity === "high"
                          ? "bg-red-500"
                          : item.severity === "medium"
                            ? "bg-amber-500"
                            : "bg-slate-300"
                      }`}
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="text-sm text-slate-900 truncate">{item.title}</p>
                      <p className="text-xs text-slate-500 line-clamp-2">{item.detail}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ChartFrame>
      </div>

      <div>
        <SectionHeader
          title="Estimated earnings"
          subtitle="Your share of the revenue split, by closed month"
          action={<EstimateBadge title={earnings?.basis} />}
        />
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-5">
          <StatCard
            label="Last 6 months"
            value={earnings ? money(earnings.totalPartnerVendorCents) : "—"}
            icon={<Wallet size={18} className="text-slate-600" />}
            accent="bg-slate-100"
            sub="From closed dispersal periods"
            hint={earnings?.basis}
          />
          <div className="lg:col-span-2">
            <DataTable
              columns={earningColumns}
              rows={(earnings?.earnings ?? []) as EarningRow[]}
              rowKey={(r) => r.period}
              empty="No closed periods yet."
            />
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-3">
          These are estimates derived from the revenue model at month close, not a payout
          statement. Commission statements are a separate system and are not yet reportable.
        </p>
      </div>
    </div>
  );
}
