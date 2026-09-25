"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Download, X } from "lucide-react";
import { DataTable, ScopeBanner, BillingBadge, BILLING_SOURCE_LABEL, type BillingSource, type Column } from "@/components/insights";
import { formatCurrency, formatDate, humanize } from "@/lib/admin-format";
import { downloadCsvFromObjects } from "@/lib/export-csv";
import { MemberDrawer } from "@/components/partner/MemberDrawer";
import type { Id } from "@/convex/_generated/dataModel";

const money = (cents: number) => formatCurrency(cents, { fromCents: true });

type Row = {
  _id: Id<"memberProfiles">;
  memberId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  memberType: string;
  groupName?: string;
  effectiveDate?: string;
  enrolledAt?: number;
  mrrCents: number;
  bundleStatus?: string;
  dependentCount: number;
  attributedRepName?: string;
  billingSource?: BillingSource;
  employerPays?: boolean;
  tier?: string;
  tierLabel?: string;
  listBillStatus?: string;
};

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  enrolling: "bg-blue-50 text-blue-700 border-blue-200",
  eligible: "bg-slate-50 text-slate-600 border-slate-200",
  lead: "bg-slate-50 text-slate-600 border-slate-200",
  inactive: "bg-amber-50 text-amber-700 border-amber-200",
  terminated: "bg-red-50 text-red-700 border-red-200",
  declined: "bg-slate-50 text-slate-500 border-slate-200",
};

export default function PartnerMembers() {
  const [search, setSearch] = useState("");
  const [memberType, setMemberType] = useState("");
  const [groupId, setGroupId] = useState("");
  const [billingSource, setBillingSource] = useState("");
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState("lastName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<Id<"memberProfiles"> | null>(null);

  const filters = useQuery(api.insights.roster.getRosterFilters);
  const roster = useQuery(api.insights.roster.getRoster, {
    search: search || undefined,
    memberType: memberType || undefined,
    groupId: (groupId || undefined) as Id<"groups"> | undefined,
    billingSource: billingSource || undefined,
    sortBy,
    sortDir,
    page,
    pageSize: 25,
  });
  const exportData = useQuery(api.insights.roster.getRosterForExport, {
    memberType: memberType || undefined,
  });

  const columns: Column<Row>[] = [
    {
      key: "lastName",
      header: "Member",
      cell: (r) => (
        <div className="min-w-0">
          <p className="font-medium text-slate-900 truncate">
            {r.firstName} {r.lastName}
          </p>
          <p className="text-xs text-slate-400 font-mono">{r.memberId}</p>
        </div>
      ),
      value: (r) => r.lastName,
    },
    {
      key: "contact",
      header: "Contact",
      cell: (r) => (
        <div className="min-w-0 text-xs">
          <p className="text-slate-700 truncate">{r.email ?? "—"}</p>
          <p className="text-slate-400">{r.phone ?? ""}</p>
        </div>
      ),
    },
    {
      key: "memberType",
      header: "Status",
      cell: (r) => (
        <span
          className={`inline-block text-xs px-2 py-0.5 rounded-full border ${
            STATUS_STYLES[r.memberType] ?? STATUS_STYLES.eligible
          }`}
        >
          {humanize(r.memberType)}
        </span>
      ),
      value: (r) => r.memberType,
    },
    { key: "groupName", header: "Group", cell: (r) => r.groupName ?? "—", value: (r) => r.groupName },
    {
      key: "effectiveDate",
      header: "Effective",
      cell: (r) => r.effectiveDate ?? "—",
      value: (r) => r.effectiveDate,
    },
    {
      key: "enrolledAt",
      header: "Enrolled",
      cell: (r) => (r.enrolledAt ? formatDate(r.enrolledAt) : "—"),
      value: (r) => r.enrolledAt,
    },
    {
      key: "billingSource",
      header: "Billing",
      cell: (r) => (
        <div className="flex flex-col gap-1 items-start">
          <BillingBadge source={r.billingSource} compact />
          {r.tierLabel && (
            <span className="text-xs text-slate-400" title="Coverage tier, derived from household">
              {r.tier}
            </span>
          )}
        </div>
      ),
      value: (r) => r.billingSource ?? "",
    },
    {
      key: "mrrCents",
      header: "Monthly revenue",
      align: "right",
      cell: (r) =>
        r.mrrCents > 0 ? (
          money(r.mrrCents)
        ) : (
          // A genuine $0 and a missing record are different facts; the badge
          // beside this cell says which.
          <span className="text-slate-300" title="No revenue recorded for this member">
            —
          </span>
        ),
      value: (r) => r.mrrCents,
    },
  ];

  const handleSort = (key: string, dir: "asc" | "desc") => {
    setSortBy(key);
    setSortDir(dir);
    setPage(0);
  };

  const totalPages = roster?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Members</h1>
        <div className="mt-1.5">
          {roster && (
            <ScopeBanner
              label={roster.scope.label}
              kind={roster.scope.kind}
              truncated={roster.truncated}
            />
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          placeholder="Search name, email, member ID…"
          className="flex-1 min-w-[220px] px-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
        <select
          value={memberType}
          onChange={(e) => {
            setMemberType(e.target.value);
            setPage(0);
          }}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
        >
          <option value="">All statuses</option>
          {filters?.memberTypes.map((t) => (
            <option key={t} value={t}>
              {humanize(t)}
            </option>
          ))}
        </select>
        <select
          value={groupId}
          onChange={(e) => {
            setGroupId(e.target.value);
            setPage(0);
          }}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white max-w-[200px]"
        >
          <option value="">All groups</option>
          {filters?.groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        {filters?.billingSources && filters.billingSources.length > 1 && (
          <select
            value={billingSource}
            onChange={(e) => {
              setBillingSource(e.target.value);
              setPage(0);
            }}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
          >
            <option value="">All billing</option>
            {filters.billingSources.map((b) => (
              <option key={b.source} value={b.source}>
                {BILLING_SOURCE_LABEL[b.source as BillingSource] ?? b.source} ({b.count})
              </option>
            ))}
          </select>
        )}
        {(search || memberType || groupId || billingSource) && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setMemberType("");
              setGroupId("");
              setBillingSource("");
              setPage(0);
            }}
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 px-2 py-2"
          >
            <X size={14} /> Clear
          </button>
        )}
        <button
          type="button"
          disabled={!exportData}
          onClick={() =>
            exportData &&
            downloadCsvFromObjects(
              `members-${new Date().toISOString().slice(0, 10)}`,
              [
                { header: "Member ID", value: (r: Row) => r.memberId },
                { header: "First name", value: (r: Row) => r.firstName },
                { header: "Last name", value: (r: Row) => r.lastName },
                { header: "Email", value: (r: Row) => r.email ?? "" },
                { header: "Phone", value: (r: Row) => r.phone ?? "" },
                { header: "Status", value: (r: Row) => r.memberType },
                { header: "Group", value: (r: Row) => r.groupName ?? "" },
                { header: "Effective date", value: (r: Row) => r.effectiveDate ?? "" },
                { header: "Enrolled", value: (r: Row) => (r.enrolledAt ? new Date(r.enrolledAt).toISOString().slice(0, 10) : "") },
                { header: "Dependents", value: (r: Row) => r.dependentCount },
                { header: "Monthly revenue (cents)", value: (r: Row) => r.mrrCents },
                { header: "Billing source", value: (r: Row) => r.billingSource ?? "" },
                { header: "Coverage tier", value: (r: Row) => r.tier ?? "" },
                { header: "Rep", value: (r: Row) => r.attributedRepName ?? "" },
              ],
              exportData.rows as Row[],
            )
          }
          className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-blue-600 border border-slate-300 rounded-lg px-3 py-2 disabled:opacity-40 transition-colors"
        >
          <Download size={14} />
          Export
        </button>
      </div>

      <DataTable
        columns={columns}
        rows={(roster?.rows ?? []) as Row[]}
        rowKey={(r) => String(r._id)}
        empty={roster === undefined ? "Loading…" : "No members match these filters."}
        onSort={handleSort}
        sortKey={sortBy}
        sortDir={sortDir}
        onRowClick={(r) => setSelected(r._id)}
      />

      {roster && roster.total > roster.pageSize && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">
            Showing {page * roster.pageSize + 1}–
            {Math.min((page + 1) * roster.pageSize, roster.total)} of{" "}
            {roster.total.toLocaleString()}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 border border-slate-300 rounded-md disabled:opacity-40 hover:bg-slate-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 border border-slate-300 rounded-md disabled:opacity-40 hover:bg-slate-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {selected && <MemberDrawer memberId={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
