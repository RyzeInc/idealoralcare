"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Building2, Users, DollarSign } from "lucide-react";
import {
  DataTable, ScopeBanner, StatCard, StatCardGrid, type Column,
} from "@/components/insights";
import { formatCurrency, formatDate, humanize } from "@/lib/admin-format";

const money = (cents: number) => formatCurrency(cents, { fromCents: true });

type GroupRow = {
  groupId: string;
  groupName: string;
  groupCode: string;
  accountName: string | null;
  status: string;
  isListBill: boolean;
  activeMembers: number;
  primaryMembers: number;
  dependents: number;
  eligibleCount: number | null;
  participationRate: number | null;
  mrrCents: number;
  tierMix?: Record<string, number>;
  latestEligibilityFileAt: number | null;
  eligibilityFileStaleDays: number | null;
  latestInvoiceStatus: string | null;
  terminationDate: number | null;
};

export default function PartnerGroups() {
  const book = useQuery(api.insights.watchlist.getGroupBook);

  const columns: Column<GroupRow>[] = [
    {
      key: "groupName",
      header: "Group",
      cell: (r) => (
        <div className="min-w-0">
          <p className="text-slate-900 truncate">{r.groupName}</p>
          <p className="text-xs text-slate-400">
            {r.accountName ? `${r.accountName} · ` : ""}
            <span className="font-mono">{r.groupCode}</span>
            {r.isListBill && <span className="ml-1.5 text-slate-500">list bill</span>}
          </p>
        </div>
      ),
      value: (r) => r.groupName,
    },
    {
      key: "activeMembers", header: "Active", align: "right",
      cell: (r) => <span className="font-medium">{r.activeMembers.toLocaleString()}</span>,
      value: (r) => r.activeMembers,
    },
    { key: "dependents", header: "Dependents", align: "right", cell: (r) => r.dependents, value: (r) => r.dependents },
    {
      key: "participation",
      header: "Participation",
      align: "right",
      cell: (r) =>
        r.participationRate === null ? (
          // No eligibility file means no denominator. Showing 0% or 100% here
          // would be a fabrication.
          <span className="text-slate-300" title="No eligibility file — participation cannot be calculated.">
            —
          </span>
        ) : (
          <span>
            {(r.participationRate * 100).toFixed(0)}%
            <span className="text-slate-400 text-xs ml-1">of {r.eligibleCount}</span>
          </span>
        ),
      value: (r) => r.participationRate,
    },
    {
      key: "tierMix",
      header: "Coverage tiers",
      cell: (r) => {
        const mix = r.tierMix;
        if (!mix || (mix.MO ?? 0) + (mix.MS ?? 0) + (mix.MF ?? 0) === 0) {
          return <span className="text-slate-300">—</span>;
        }
        return (
          <span className="text-xs text-slate-600 whitespace-nowrap" title="Member Only / +Spouse / +Family — derived from household, not elected">
            {mix.MO ?? 0} MO · {mix.MS ?? 0} MS · {mix.MF ?? 0} MF
          </span>
        );
      },
    },
    {
      key: "mrr",
      header: "Monthly revenue",
      align: "right",
      cell: (r) => money(r.mrrCents),
      value: (r) => r.mrrCents,
    },
    {
      key: "file",
      header: "Eligibility file",
      cell: (r) =>
        r.latestEligibilityFileAt === null ? (
          <span className="text-slate-300">Never</span>
        ) : (
          <span className={r.eligibilityFileStaleDays! > 60 ? "text-amber-700" : "text-slate-600"}>
            {formatDate(r.latestEligibilityFileAt)}
            {r.eligibilityFileStaleDays! > 60 && (
              <span className="text-xs ml-1">({r.eligibilityFileStaleDays}d)</span>
            )}
          </span>
        ),
      value: (r) => r.latestEligibilityFileAt,
    },
    {
      key: "invoice",
      header: "Invoice",
      cell: (r) =>
        r.latestInvoiceStatus ? (
          <span
            className={`text-xs px-2 py-0.5 rounded-full border ${
              r.latestInvoiceStatus === "overdue"
                ? "bg-red-50 text-red-700 border-red-200"
                : r.latestInvoiceStatus === "paid"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-slate-50 text-slate-600 border-slate-200"
            }`}
          >
            {humanize(r.latestInvoiceStatus)}
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        ),
      value: (r) => r.latestInvoiceStatus,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Groups</h1>
        <div className="mt-1.5">
          {book && <ScopeBanner label={book.scope.label} kind={book.scope.kind} />}
        </div>
      </div>

      <StatCardGrid>
        <StatCard
          label="Employer groups"
          value={book ? String(book.totals.groups) : "—"}
          icon={<Building2 size={18} className="text-blue-600" />}
          accent="bg-blue-50"
        />
        <StatCard
          label="Active members"
          value={book ? book.totals.activeMembers.toLocaleString() : "—"}
          icon={<Users size={18} className="text-emerald-600" />}
          accent="bg-emerald-50"
        />
        <StatCard
          label="Monthly revenue"
          value={book ? money(book.totals.mrrCents) : "—"}
          icon={<DollarSign size={18} className="text-violet-600" />}
          accent="bg-violet-50"
        />
      </StatCardGrid>

      <DataTable
        columns={columns}
        rows={(book?.rows ?? []) as GroupRow[]}
        rowKey={(r) => r.groupId}
        searchable
        searchPlaceholder="Search groups…"
        exportFilename="groups"
        pageSize={25}
        empty={book === undefined ? "Loading…" : "No employer groups in your book."}
      />

      <p className="text-xs text-slate-400">
        Participation is covered members divided by the headcount in the group&rsquo;s most
        recent eligibility file. Groups with no file on record show no participation rather than
        a guessed one. &ldquo;Covered&rdquo; matches what the invoice generator bills &mdash;
        active, enrolling, and eligible &mdash; so these counts tie out to your invoices.
        Coverage tiers are derived from each household at billing time; employees do not elect
        them.
      </p>
    </div>
  );
}
