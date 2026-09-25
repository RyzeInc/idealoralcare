"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ArrowDown, ArrowUp, Minus, Network } from "lucide-react";
import {
  DataTable, ScopeBanner, SectionHeader, EstimateBadge, StatCard, StatCardGrid,
  type Column,
} from "@/components/insights";
import { formatCurrency, humanize } from "@/lib/admin-format";

const money = (cents: number) => formatCurrency(cents, { fromCents: true });

type Node = {
  partnerId: string;
  name: string;
  type: string;
  parentId: string | null;
  status: string;
  agencyCode: string | null;
  isSelf: boolean;
  repCount: number;
  members: number;
  activeMembers: number;
  newMembers: number;
  grossCents: number;
  partnerVendorCents: number;
  yourOverrideCents: number;
};

type LeaderRow = {
  rank: number;
  previousRank: number | null;
  rankChange: number;
  repId: string;
  name: string;
  agencyName: string | null;
  activeMembers: number;
  newMembers: number;
  churnedMembers: number;
  netGrowth: number;
};

export default function PartnerDownline() {
  const [metric, setMetric] = useState<"netGrowth" | "newMembers" | "activeMembers">("netGrowth");

  const downline = useQuery(api.insights.downline.getDownline, { months: 3 });
  const leaderboard = useQuery(api.insights.downline.getLeaderboard, { days: 30, metric });

  const nodeColumns: Column<Node>[] = [
    {
      key: "name",
      header: "Partner",
      cell: (r) => (
        <div className="flex items-center gap-2 min-w-0">
          {!r.isSelf && r.parentId && <span className="text-slate-300">└</span>}
          <div className="min-w-0">
            <p className={`truncate ${r.isSelf ? "font-semibold text-slate-900" : "text-slate-800"}`}>
              {r.name}
              {r.isSelf && <span className="ml-2 text-xs text-slate-400">(you)</span>}
            </p>
            <p className="text-xs text-slate-400">
              {humanize(r.type)}
              {r.agencyCode ? ` · ${r.agencyCode}` : ""}
            </p>
          </div>
        </div>
      ),
      value: (r) => r.name,
    },
    { key: "repCount", header: "Reps", align: "right", cell: (r) => r.repCount, value: (r) => r.repCount },
    {
      key: "activeMembers", header: "Active", align: "right",
      cell: (r) => <span className="font-medium">{r.activeMembers.toLocaleString()}</span>,
      value: (r) => r.activeMembers,
    },
    { key: "newMembers", header: "New (3mo)", align: "right", cell: (r) => r.newMembers, value: (r) => r.newMembers },
    {
      key: "gross", header: "Production", align: "right",
      cell: (r) => money(r.grossCents), value: (r) => r.grossCents,
    },
    {
      key: "override", header: "Your override", align: "right",
      cell: (r) =>
        r.isSelf ? (
          <span className="text-slate-300">—</span>
        ) : (
          <span className="font-medium text-slate-900">{money(r.yourOverrideCents)}</span>
        ),
      value: (r) => r.yourOverrideCents,
    },
  ];

  const leaderColumns: Column<LeaderRow>[] = [
    {
      key: "rank",
      header: "#",
      cell: (r) => (
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-slate-900 tabular-nums">{r.rank}</span>
          {r.rankChange > 0 ? (
            <ArrowUp size={11} className="text-emerald-600" />
          ) : r.rankChange < 0 ? (
            <ArrowDown size={11} className="text-red-500" />
          ) : (
            <Minus size={11} className="text-slate-300" />
          )}
        </div>
      ),
      value: (r) => r.rank,
    },
    {
      key: "name",
      header: "Rep",
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
    { key: "churnedMembers", header: "Lost", align: "right", cell: (r) => r.churnedMembers, value: (r) => r.churnedMembers },
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Downline</h1>
        <div className="mt-1.5">
          {downline && <ScopeBanner label={downline.scope.label} kind={downline.scope.kind} />}
        </div>
      </div>

      <StatCardGrid>
        <StatCard
          label="Partners in your tree"
          value={downline ? String(downline.nodes.length) : "—"}
          icon={<Network size={18} className="text-blue-600" />}
          accent="bg-blue-50"
        />
        <StatCard
          label="Active members"
          value={downline ? downline.nodes.reduce((s, n) => s + n.activeMembers, 0).toLocaleString() : "—"}
        />
        <StatCard
          label="New (3 months)"
          value={downline ? downline.nodes.reduce((s, n) => s + n.newMembers, 0).toLocaleString() : "—"}
        />
        <StatCard
          label="Your override"
          value={downline ? money(downline.totalOverrideCents) : "—"}
          sub={downline ? `At ${downline.yourOverridePercent}%` : undefined}
          hint="Estimated from closed dispersal periods, not a payout statement."
        />
      </StatCardGrid>

      <div>
        <SectionHeader
          title="Your tree"
          subtitle="Production and the override you earn on it"
          action={<EstimateBadge title={downline?.basis} />}
        />
        <div className="mt-4">
          <DataTable
            columns={nodeColumns}
            rows={(downline?.nodes ?? []) as Node[]}
            rowKey={(r) => r.partnerId}
            exportFilename="downline"
            empty={downline === undefined ? "Loading…" : "No partners beneath you yet."}
          />
        </div>
        <p className="text-xs text-slate-400 mt-3">
          Override amounts are your share only. A downline&rsquo;s own commission rate and payout
          are not shown here.
        </p>
      </div>

      <div>
        <SectionHeader
          title="Leaderboard"
          subtitle="Last 30 days, with movement against the prior 30"
          action={
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as typeof metric)}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="netGrowth">Net growth</option>
              <option value="newMembers">New members</option>
              <option value="activeMembers">Active members</option>
            </select>
          }
        />
        <div className="mt-4">
          <DataTable
            columns={leaderColumns}
            rows={(leaderboard?.rows ?? []) as LeaderRow[]}
            rowKey={(r) => r.repId}
            searchable
            searchPlaceholder="Search reps…"
            exportFilename="leaderboard"
            empty={leaderboard === undefined ? "Loading…" : "No reps in your scope yet."}
          />
        </div>
        <p className="text-xs text-slate-400 mt-3">
          Ranked on net growth by default — a rep who wrote 20 and lost 18 did not outperform one
          who wrote 12 and kept them.
        </p>
      </div>
    </div>
  );
}
