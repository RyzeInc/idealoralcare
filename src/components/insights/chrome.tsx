"use client";

import { ReactNode } from "react";
import { AlertTriangle, Info } from "lucide-react";

/**
 * Small shared chrome for the insights surfaces.
 *
 * `EstimateBadge` exists because several figures in this dashboard are
 * genuinely estimates — partner earnings derive from the dispersal model
 * rather than the commission ledger, which is not reportable. Making that a
 * component rather than prose means a screen cannot quietly forget to say it.
 */

export function EstimateBadge({ title }: { title?: string }) {
  return (
    <span
      title={title ?? "Estimated from the revenue model — not a payout statement."}
      className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 cursor-help"
    >
      <Info size={10} />
      Estimate
    </span>
  );
}

/** Tells the viewer whose book they are looking at. */
export function ScopeBanner({
  label,
  kind,
  truncated,
}: {
  label: string;
  kind: string;
  truncated?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-slate-500">Viewing</span>
      <span className="font-medium text-slate-900">{label}</span>
      <span className="text-[10px] uppercase tracking-wide text-slate-500 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">
        {kind}
      </span>
      {truncated && (
        <span
          title="This book is larger than a single read allows. Figures cover the first 5,000 members."
          className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 cursor-help"
        >
          <AlertTriangle size={11} />
          Partial
        </span>
      )}
    </div>
  );
}

const RANGES = [
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
  { days: 365, label: "12m" },
];

/** Date-range control. One row, above the charts. */
export function RangePicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (days: number) => void;
}) {
  return (
    <div
      className="inline-flex rounded-lg border border-slate-300 overflow-hidden"
      role="group"
      aria-label="Date range"
    >
      {RANGES.map((r) => (
        <button
          key={r.days}
          type="button"
          onClick={() => onChange(r.days)}
          aria-pressed={value === r.days}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
            value === r.days
              ? "bg-blue-600 text-white"
              : "bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
