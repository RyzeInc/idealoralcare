"use client";

import { ReactNode, useState } from "react";
import { Table2, BarChart3 } from "lucide-react";

/**
 * The shell every chart sits in.
 *
 * Carries the table toggle. That is not a nicety: three of the palette's slots
 * sit below 3:1 contrast on white, which under the dataviz contrast rule
 * obligates relief — a table view is that relief, alongside the legend and
 * direct labels. It is also simply how you read exact numbers off a chart.
 */

export interface ChartFrameProps {
  title: string;
  subtitle?: string;
  /** Rendered when the reader switches to the table view. */
  table?: ReactNode;
  action?: ReactNode;
  footnote?: string;
  children: ReactNode;
}

export function ChartFrame({
  title,
  subtitle,
  table,
  action,
  footnote,
  children,
}: ChartFrameProps) {
  const [showTable, setShowTable] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {action}
          {table && (
            <button
              type="button"
              onClick={() => setShowTable((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-blue-600 border border-slate-200 rounded-md px-2 py-1 transition-colors"
              aria-pressed={showTable}
            >
              {showTable ? <BarChart3 size={13} /> : <Table2 size={13} />}
              {showTable ? "Chart" : "Table"}
            </button>
          )}
        </div>
      </div>

      {/* Wide content scrolls inside its own container so the page never does. */}
      <div className="px-5 pb-5 overflow-x-auto">
        {showTable && table ? table : children}
      </div>

      {footnote && (
        <p className="px-5 pb-4 -mt-2 text-xs text-slate-400">{footnote}</p>
      )}
    </div>
  );
}

/** Consistent empty state — never an empty chart axis with no explanation. */
export function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="h-56 flex items-center justify-center text-sm text-slate-400 text-center px-6">
      {message}
    </div>
  );
}
