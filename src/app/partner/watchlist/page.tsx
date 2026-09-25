"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  AlertOctagon, AlertTriangle, Info, CreditCard, UserMinus, MailWarning,
  Building2, Receipt, UserPlus,
} from "lucide-react";
import { DataTable, ScopeBanner, StatCard, StatCardGrid, type Column } from "@/components/insights";
import { formatDate, humanize } from "@/lib/admin-format";

type Item = {
  kind: string;
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  memberId?: string;
  groupName?: string;
  email?: string;
  phone?: string;
  occurredAt?: number;
};

const KIND_ICON: Record<string, typeof CreditCard> = {
  payment_failed: CreditCard,
  past_due: CreditCard,
  list_bill_termed: UserMinus,
  unclaimed_dependent: UserPlus,
  email_bounced: MailWarning,
  group_terminating: Building2,
  group_at_capacity: Building2,
  invoice_overdue: Receipt,
};

/** Status colour never carries meaning alone — every row pairs it with an icon and a label. */
const SEVERITY = {
  high: { icon: AlertOctagon, color: "#d03b3b", label: "Urgent" },
  medium: { icon: AlertTriangle, color: "#ec835a", label: "Soon" },
  low: { icon: Info, color: "#898781", label: "FYI" },
} as const;

export default function PartnerWatchlist() {
  const [kind, setKind] = useState("");
  const watchlist = useQuery(api.insights.watchlist.getWatchlist, { limit: 300 });

  const rows = (watchlist?.items ?? []).filter((i) => !kind || i.kind === kind) as Item[];

  const columns: Column<Item>[] = [
    {
      key: "severity",
      header: "",
      cell: (r) => {
        const s = SEVERITY[r.severity];
        const Icon = s.icon;
        return (
          <span className="inline-flex items-center gap-1.5" title={s.label}>
            <Icon size={14} style={{ color: s.color }} aria-hidden />
            <span className="sr-only">{s.label}</span>
          </span>
        );
      },
      value: (r) => ({ high: 0, medium: 1, low: 2 })[r.severity],
    },
    {
      key: "title",
      header: "Issue",
      cell: (r) => {
        const Icon = KIND_ICON[r.kind] ?? Info;
        return (
          <div className="flex items-start gap-2 min-w-0">
            <Icon size={14} className="text-slate-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-slate-900">{r.title}</p>
              <p className="text-xs text-slate-500">{r.detail}</p>
            </div>
          </div>
        );
      },
      value: (r) => r.title,
    },
    {
      key: "contact",
      header: "Contact",
      cell: (r) => (
        <div className="text-xs min-w-0">
          <p className="text-slate-700 truncate">{r.email ?? "—"}</p>
          <p className="text-slate-400">{r.phone ?? ""}</p>
        </div>
      ),
      value: (r) => r.email,
    },
    { key: "groupName", header: "Group", cell: (r) => r.groupName ?? "—", value: (r) => r.groupName },
    {
      key: "occurredAt",
      header: "When",
      cell: (r) => (r.occurredAt ? formatDate(r.occurredAt) : "—"),
      value: (r) => r.occurredAt,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Watchlist</h1>
        <div className="mt-1.5">
          {watchlist && (
            <ScopeBanner
              label={watchlist.scope.label}
              kind={watchlist.scope.kind}
              truncated={watchlist.truncated}
            />
          )}
        </div>
      </div>

      <StatCardGrid>
        <StatCard
          label="Urgent"
          value={watchlist ? String(watchlist.bySeverity.high) : "—"}
          icon={<AlertOctagon size={18} style={{ color: SEVERITY.high.color }} />}
          accent="bg-red-50"
          sub="Payments, overdue invoices, ending contracts"
        />
        <StatCard
          label="Soon"
          value={watchlist ? String(watchlist.bySeverity.medium) : "—"}
          icon={<AlertTriangle size={18} style={{ color: SEVERITY.medium.color }} />}
          accent="bg-orange-50"
          sub="Conversions and deliverability"
        />
        <StatCard
          label="FYI"
          value={watchlist ? String(watchlist.bySeverity.low) : "—"}
          icon={<Info size={18} className="text-slate-500" />}
          accent="bg-slate-100"
        />
        <StatCard label="Total open" value={watchlist ? String(watchlist.total) : "—"} />
      </StatCardGrid>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => `${r.kind}-${r.memberId ?? r.groupName ?? ""}-${r.occurredAt ?? 0}-${r.title}`}
        searchable
        searchPlaceholder="Search the watchlist…"
        exportFilename={`watchlist-${new Date().toISOString().slice(0, 10)}`}
        pageSize={25}
        empty={watchlist === undefined ? "Loading…" : "Nothing needs your attention right now."}
        toolbar={
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
          >
            <option value="">All types</option>
            {Object.keys(watchlist?.counts ?? {}).map((k) => (
              <option key={k} value={k}>
                {humanize(k)} ({watchlist!.counts[k]})
              </option>
            ))}
          </select>
        }
      />
    </div>
  );
}
