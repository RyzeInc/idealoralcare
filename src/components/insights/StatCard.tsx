"use client";

import { ReactNode } from "react";
import { ArrowDown, ArrowUp, Minus, Info } from "lucide-react";
import { INK } from "./palette";

/**
 * The KPI tile.
 *
 * Replaces five near-identical copies scattered across /admin, and adds the
 * two things every one of them was missing: a period-over-period delta, and an
 * honest signal for when that comparison is derived rather than measured.
 *
 * Delta direction is not always "up is good" — churn rising is bad — so the
 * caller declares `higherIsBetter` instead of the component guessing.
 */

export interface StatCardProps {
  label: string;
  value: string;
  icon?: ReactNode;
  accent?: string;
  sub?: string;
  delta?: { change: number; previous: number; derived?: boolean };
  higherIsBetter?: boolean;
  /** Formats the delta; defaults to a signed integer. */
  formatDelta?: (change: number) => string;
  hint?: string;
}

export function StatCard({
  label,
  value,
  icon,
  accent = "bg-slate-100",
  sub,
  delta,
  higherIsBetter = true,
  formatDelta,
  hint,
}: StatCardProps) {
  const change = delta?.change ?? 0;
  const flat = !delta || change === 0;
  const good = higherIsBetter ? change > 0 : change < 0;

  const DeltaIcon = flat ? Minus : change > 0 ? ArrowUp : ArrowDown;
  // Ink tokens, not series colours — a stat tile is text, and text never wears
  // a categorical hue.
  const deltaColor = flat
    ? INK.muted
    : good
      ? INK.positive
      : INK.negative;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-start gap-4">
        {icon && <div className={`p-2.5 rounded-lg shrink-0 ${accent}`}>{icon}</div>}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-sm text-slate-500 truncate">{label}</p>
            {hint && (
              <span title={hint} className="shrink-0 cursor-help">
                <Info size={12} className="text-slate-400" />
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-slate-900 truncate mt-0.5">{value}</p>

          {delta && (
            <div className="flex items-center gap-1 mt-1.5">
              <DeltaIcon size={13} style={{ color: deltaColor }} aria-hidden />
              <span className="text-xs font-medium" style={{ color: deltaColor }}>
                {formatDelta ? formatDelta(change) : `${change > 0 ? "+" : ""}${change}`}
              </span>
              <span className="text-xs text-slate-400">
                vs prior period
                {/* An estimated baseline is marked rather than presented as measured. */}
                {delta.derived && (
                  <span title="Prior level was reconstructed from flows, not measured — no rollup existed for that day.">
                    {" "}·{" "}
                    <span className="underline decoration-dotted cursor-help">est.</span>
                  </span>
                )}
              </span>
            </div>
          )}

          {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

/** Grid wrapper so every KPI row lines up the same way. */
export function StatCardGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{children}</div>
  );
}
