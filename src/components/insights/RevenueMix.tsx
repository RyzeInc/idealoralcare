"use client";

import { BILLING_SOURCE_LABEL, type BillingSource } from "./BillingBadge";
import { seriesColor } from "./palette";

/**
 * The revenue mix beneath the headline figure.
 *
 * A single combined number hides concentration risk — that most of the book
 * might depend on one employer's invoice being paid on time. The split is
 * always shown alongside the total rather than being collapsed into it.
 */

export interface SourceTotals {
  members: number;
  mrrCents: number;
}

// Fixed slot per source, so a source disappearing never repaints the others.
const SLOT: Record<BillingSource, number> = {
  direct: 0,
  list_bill: 6,
  comp: 3,
  none: 7,
};

const ORDER: BillingSource[] = ["list_bill", "direct", "comp", "none"];

export function RevenueMix({
  bySource,
  totalCents,
  formatMoney,
}: {
  bySource: Record<BillingSource, SourceTotals> | undefined;
  totalCents: number;
  formatMoney: (cents: number) => string;
}) {
  if (!bySource) return null;

  const rows = ORDER.map((source) => ({ source, ...bySource[source] })).filter(
    (r) => r.members > 0,
  );
  if (rows.length === 0) return null;

  const revenueRows = rows.filter((r) => r.mrrCents > 0);
  const denominator = totalCents > 0 ? totalCents : 1;

  return (
    <div className="space-y-2.5">
      {revenueRows.length > 1 && (
        <div className="flex h-2 rounded-full overflow-hidden bg-slate-100" aria-hidden>
          {revenueRows.map((r) => (
            <div
              key={r.source}
              style={{
                width: `${(r.mrrCents / denominator) * 100}%`,
                background: seriesColor(SLOT[r.source]),
              }}
            />
          ))}
        </div>
      )}

      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.source} className="flex items-center gap-2 text-xs">
            <span
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ background: seriesColor(SLOT[r.source]) }}
              aria-hidden
            />
            <span className="text-slate-600">{BILLING_SOURCE_LABEL[r.source]}</span>
            <span className="text-slate-400">
              {r.members.toLocaleString()} {r.members === 1 ? "member" : "members"}
            </span>
            <span className="ml-auto font-medium text-slate-900 tabular-nums">
              {r.mrrCents > 0 ? formatMoney(r.mrrCents) : "—"}
            </span>
            {r.mrrCents > 0 && totalCents > 0 && (
              <span className="text-slate-400 tabular-nums w-10 text-right">
                {Math.round((r.mrrCents / totalCents) * 100)}%
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
