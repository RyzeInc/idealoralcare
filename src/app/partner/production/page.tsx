"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PhoneCall, Info } from "lucide-react";
import {
  ChartFrame, ChartEmpty, FunnelChart, BreakdownBars, DataTable,
  ScopeBanner, RangePicker, SectionHeader, type Column,
} from "@/components/insights";
import { formatDate } from "@/lib/admin-format";

type AbandonedRow = {
  enrollmentSessionId: string;
  status: string;
  currentStep: string;
  ageDays: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  groupName: string | null;
  updatedAt: number;
};

export default function PartnerProduction() {
  const [days, setDays] = useState(30);

  const funnel = useQuery(api.insights.funnel.getFunnel, { days });
  const abandoned = useQuery(api.insights.funnel.getAbandonedQueue, { days });
  const sources = useQuery(api.insights.funnel.getAttributionBreakdown, { days: 90 });
  const visits = useQuery(api.insights.visits.getVisitsByCode, { days });

  const columns: Column<AbandonedRow>[] = [
    {
      key: "name",
      header: "Prospect",
      cell: (r) => (
        <div className="min-w-0">
          <p className="text-slate-900 truncate">
            {[r.firstName, r.lastName].filter(Boolean).join(" ") || (
              <span className="text-slate-400">Unnamed</span>
            )}
          </p>
          <p className="text-xs text-slate-400 truncate">{r.email ?? "no email captured"}</p>
        </div>
      ),
      value: (r) => r.lastName ?? "",
    },
    { key: "phone", header: "Phone", cell: (r) => r.phone ?? "—", value: (r) => r.phone },
    { key: "groupName", header: "Group", cell: (r) => r.groupName ?? "—", value: (r) => r.groupName },
    {
      key: "currentStep",
      header: "Stalled at",
      cell: (r) => <span className="text-xs">{r.currentStep}</span>,
      value: (r) => r.currentStep,
    },
    {
      key: "status",
      header: "State",
      cell: (r) => (
        <span
          className={`text-xs px-2 py-0.5 rounded-full border ${
            r.status === "pending_payment"
              ? "bg-amber-50 text-amber-700 border-amber-200"
              : "bg-slate-50 text-slate-600 border-slate-200"
          }`}
        >
          {r.status.replace(/_/g, " ")}
        </span>
      ),
      value: (r) => r.status,
    },
    {
      key: "ageDays",
      header: "Age",
      align: "right",
      cell: (r) => `${r.ageDays}d`,
      value: (r) => r.ageDays,
    },
    {
      key: "updatedAt",
      header: "Last seen",
      cell: (r) => formatDate(r.updatedAt),
      value: (r) => r.updatedAt,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Production</h1>
          <div className="mt-1.5">
            {funnel && <ScopeBanner label={funnel.scope.label} kind={funnel.scope.kind} />}
          </div>
        </div>
        <RangePicker value={days} onChange={setDays} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartFrame
          title="Funnel"
          subtitle="Each stage is counted from its own table"
          footnote="Stages are not one cohort walking down — a member enrolled before link tracking existed has an enrollment but no visit."
        >
          {!funnel ? (
            <ChartEmpty message="Loading…" />
          ) : (
            <>
              <FunnelChart stages={funnel.stages} />
              {!funnel.visitTrackingActive && (
                <div className="flex items-start gap-2 mt-3 text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
                  <Info size={13} className="shrink-0 mt-0.5" />
                  <span>
                    No link visits recorded yet. Tracking begins when someone clicks a rep link
                    from now on — a zero here means &ldquo;no data&rdquo;, not &ldquo;no traffic&rdquo;.
                  </span>
                </div>
              )}
            </>
          )}
        </ChartFrame>

        <ChartFrame
          title="Where they stalled"
          subtitle="Incomplete enrollment wizard sessions by step"
        >
          {!funnel || funnel.wizardDropOff.length === 0 ? (
            <ChartEmpty message="No incomplete wizard sessions in this window." />
          ) : (
            <BreakdownBars
              rows={funnel.wizardDropOff.map((d) => ({ label: d.step, count: d.count }))}
            />
          )}
        </ChartFrame>
      </div>

      <div>
        <SectionHeader
          title="Follow-up queue"
          subtitle="People who started and did not finish"
          action={
            abandoned ? (
              <span className="inline-flex items-center gap-1.5 text-sm text-slate-500">
                <PhoneCall size={14} />
                {abandoned.total} to work
              </span>
            ) : null
          }
        />
        <div className="mt-4">
          <DataTable
            columns={columns}
            rows={(abandoned?.rows ?? []) as AbandonedRow[]}
            rowKey={(r) => r.enrollmentSessionId}
            searchable
            searchPlaceholder="Search prospects…"
            exportFilename={`follow-ups-${new Date().toISOString().slice(0, 10)}`}
            pageSize={20}
            empty={abandoned === undefined ? "Loading…" : "Nobody abandoned an enrollment in this window."}
          />
        </div>
        {abandoned && abandoned.unattributedCarts > 0 && (
          <p className="text-xs text-slate-400 mt-3">
            {abandoned.unattributedCarts} additional abandoned carts could not be attributed to a
            rep — a shopper who leaves before the enrollment step carries no attribution.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartFrame
          title="Sources"
          subtitle="Where the last 90 days of members came from"
          footnote={sources?.signupSourceNote}
        >
          {!sources ? (
            <ChartEmpty message="Loading…" />
          ) : sources.totalMembers === 0 ? (
            <ChartEmpty message="No members enrolled in the last 90 days." />
          ) : (
            <BreakdownBars rows={sources.byCode} />
          )}
        </ChartFrame>

        <ChartFrame title="Link visits by code" subtitle={`Last ${days} days, bots excluded`}>
          {!visits || visits.rows.length === 0 ? (
            <ChartEmpty message="No rep link visits recorded yet." />
          ) : (
            <BreakdownBars
              rows={visits.rows.map((r) => ({ label: r.code, count: r.visits }))}
            />
          )}
        </ChartFrame>
      </div>
    </div>
  );
}
