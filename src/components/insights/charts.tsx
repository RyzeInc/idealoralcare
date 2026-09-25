"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { INK, ORDINAL, seriesColor, sequentialColor, sequentialInk } from "./palette";

/**
 * Chart primitives.
 *
 * Conventions applied throughout, from the dataviz method:
 *  - 2px lines, >=8px markers, 4px rounded data-ends on bars
 *  - a 2px surface-coloured gap between stacked segments and adjacent bars
 *  - recessive grid: horizontal hairlines only, no vertical rules, no axis lines
 *  - legend present whenever there are >= 2 series; a single series is named by
 *    the frame's title instead
 *  - text in ink tokens; a coloured swatch beside a label carries identity
 *  - ONE y-axis, always. Two measures of different scale get two charts.
 */

const AXIS_TICK = { fill: INK.muted, fontSize: 11 };
const GRID = { stroke: INK.grid, strokeDasharray: "0" };

function TooltipBox({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string; dataKey?: string }>;
  label?: string;
  formatter?: (value: number, key: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      {label && <p className="font-medium text-slate-900 mb-1">{label}</p>}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <span
            className="w-2.5 h-2.5 rounded-sm shrink-0"
            style={{ background: entry.color }}
            aria-hidden
          />
          <span className="text-slate-600">{entry.name}</span>
          <span className="ml-auto font-medium text-slate-900 tabular-nums">
            {formatter && typeof entry.value === "number"
              ? formatter(entry.value, entry.dataKey ?? "")
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export interface SeriesSpec {
  key: string;
  label: string;
  /** Slot index into the categorical palette. Tied to the ENTITY, not its rank. */
  slot?: number;
}

/* ------------------------------------------------------------------ */
/* Trend (line)                                                       */
/* ------------------------------------------------------------------ */

export function TrendChart({
  data,
  series,
  xKey = "date",
  height = 260,
  valueFormatter,
  area = false,
}: {
  data: Array<Record<string, unknown>>;
  series: SeriesSpec[];
  xKey?: string;
  height?: number;
  valueFormatter?: (v: number, key: string) => string;
  area?: boolean;
}) {
  const Chart = area ? AreaChart : LineChart;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <Chart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: INK.axis }}
          minTickGap={28}
        />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={(v) => (valueFormatter ? valueFormatter(v as number, series[0]?.key ?? "") : String(v))}
        />
        <Tooltip
          content={<TooltipBox formatter={valueFormatter} />}
          cursor={{ stroke: INK.axis, strokeWidth: 1 }}
        />
        {series.length > 1 && (
          <Legend
            iconType="square"
            iconSize={9}
            wrapperStyle={{ fontSize: 11, color: INK.secondary, paddingTop: 8 }}
          />
        )}
        {series.map((s, i) =>
          area ? (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={seriesColor(s.slot ?? i)}
              fill={seriesColor(s.slot ?? i)}
              fillOpacity={0.12}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: INK.surface }}
            />
          ) : (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={seriesColor(s.slot ?? i)}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: INK.surface }}
            />
          ),
        )}
      </Chart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/* Bars                                                               */
/* ------------------------------------------------------------------ */

export function BarSeriesChart({
  data,
  series,
  xKey = "month",
  height = 260,
  stacked = false,
  valueFormatter,
  showZeroLine = false,
}: {
  data: Array<Record<string, unknown>>;
  series: SeriesSpec[];
  xKey?: string;
  height?: number;
  stacked?: boolean;
  valueFormatter?: (v: number, key: string) => string;
  showZeroLine?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: INK.axis }}
          minTickGap={16}
        />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={(v) => (valueFormatter ? valueFormatter(v as number, series[0]?.key ?? "") : String(v))}
        />
        <Tooltip
          content={<TooltipBox formatter={valueFormatter} />}
          cursor={{ fill: "rgba(11,11,11,0.04)" }}
        />
        {series.length > 1 && (
          <Legend
            iconType="square"
            iconSize={9}
            wrapperStyle={{ fontSize: 11, color: INK.secondary, paddingTop: 8 }}
          />
        )}
        {showZeroLine && <ReferenceLine y={0} stroke={INK.axis} strokeWidth={1} />}
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            stackId={stacked ? "a" : undefined}
            fill={seriesColor(s.slot ?? i)}
            // 4px rounded data-end, anchored to the baseline.
            radius={stacked ? 0 : [4, 4, 0, 0]}
            // 2px surface gap so adjacent fills never touch.
            stroke={INK.gap}
            strokeWidth={stacked ? 2 : 0}
            maxBarSize={44}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/* Funnel                                                             */
/* ------------------------------------------------------------------ */

/**
 * Funnel stages as a horizontal ordinal bar.
 *
 * Stages come from different tables and are NOT one cohort walking down, so
 * this deliberately does not draw a tapering funnel shape — that would imply a
 * containment relationship the data does not support. Each stage is labelled
 * with its own basis and conversion is shown stage-to-stage.
 */
export function FunnelChart({
  stages,
  height = 40,
}: {
  stages: Array<{ key: string; label: string; value: number; basis?: string }>;
  height?: number;
}) {
  const max = Math.max(...stages.map((s) => s.value), 1);

  return (
    <div className="space-y-2.5 py-2">
      {stages.map((stage, i) => {
        const prev = i > 0 ? stages[i - 1].value : null;
        const conversion = prev && prev > 0 ? stage.value / prev : null;
        const width = Math.max((stage.value / max) * 100, stage.value > 0 ? 2 : 0);
        const color = ORDINAL[Math.min(i, ORDINAL.length - 1)];

        return (
          <div key={stage.key}>
            <div className="flex items-baseline justify-between text-xs mb-1">
              <span className="text-slate-700 font-medium">{stage.label}</span>
              <span className="text-slate-500 tabular-nums">
                {stage.value.toLocaleString()}
                {conversion !== null && (
                  <span className="text-slate-400 ml-2">
                    {(conversion * 100).toFixed(1)}% of prior
                  </span>
                )}
              </span>
            </div>
            <div className="bg-slate-100 rounded" style={{ height }}>
              <div
                className="rounded flex items-center px-3"
                style={{ width: `${width}%`, height, background: color, minWidth: stage.value > 0 ? 44 : 0 }}
              >
                {/* Direct label inside the bar — the relief the contrast rule requires. */}
                {width > 14 && (
                  <span className="text-xs font-semibold text-white tabular-nums">
                    {stage.value.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
            {stage.basis && (
              <p className="text-[10px] text-slate-400 mt-0.5">source: {stage.basis}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cohort grid                                                        */
/* ------------------------------------------------------------------ */

/**
 * Retention heatmap. Sequential single-hue ramp — magnitude, so one hue
 * light-to-dark, never a rainbow.
 *
 * A null cell means "hasn't happened yet" and renders as empty rather than as
 * 0%, which would draw a cliff that does not exist.
 */
export function CohortGrid({
  cohorts,
  months,
}: {
  cohorts: Array<{ cohort: string; size: number; cells: Array<number | null> }>;
  months: number;
}) {
  if (cohorts.every((c) => c.size === 0)) {
    return (
      <div className="h-40 flex items-center justify-center text-sm text-slate-400">
        No cohorts in this range yet.
      </div>
    );
  }

  return (
    <table className="text-xs border-separate" style={{ borderSpacing: 2 }}>
      <thead>
        <tr>
          <th className="text-left font-medium text-slate-500 pr-3 pb-1">Cohort</th>
          <th className="text-right font-medium text-slate-500 pr-3 pb-1">Size</th>
          {Array.from({ length: months }).map((_, i) => (
            <th key={i} className="font-medium text-slate-500 pb-1 px-1 text-center min-w-[38px]">
              M{i}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {cohorts.map((row) => (
          <tr key={row.cohort}>
            <td className="text-slate-700 pr-3 whitespace-nowrap font-medium">{row.cohort}</td>
            <td className="text-slate-500 pr-3 text-right tabular-nums">{row.size}</td>
            {row.cells.map((cell, i) => (
              <td key={i} className="p-0">
                {cell === null ? (
                  <div className="h-7 rounded bg-slate-50" />
                ) : (
                  <div
                    className="h-7 rounded flex items-center justify-center tabular-nums font-medium"
                    style={{ background: sequentialColor(cell), color: sequentialInk(cell) }}
                    title={`${row.cohort} · month ${i} · ${(cell * 100).toFixed(0)}% retained`}
                  >
                    {(cell * 100).toFixed(0)}
                  </div>
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Distribution bar — a single categorical breakdown with direct labels. */
export function BreakdownBars({
  rows,
  limit = 8,
}: {
  rows: Array<{ label: string; count: number }>;
  limit?: number;
}) {
  const shown = rows.slice(0, limit);
  const rest = rows.slice(limit);
  // A ninth category is never a generated hue — it folds into "Other".
  const all = rest.length
    ? [...shown, { label: `Other (${rest.length})`, count: rest.reduce((s, r) => s + r.count, 0) }]
    : shown;
  const max = Math.max(...all.map((r) => r.count), 1);

  return (
    <div className="space-y-2 py-1">
      {all.map((row, i) => (
        <div key={row.label} className="flex items-center gap-3">
          <span className="text-xs text-slate-600 w-40 truncate shrink-0" title={row.label}>
            {row.label}
          </span>
          <div className="flex-1 bg-slate-50 rounded h-5 min-w-0">
            <div
              className="h-5 rounded"
              style={{
                width: `${Math.max((row.count / max) * 100, 1)}%`,
                background: i === all.length - 1 && rest.length ? INK.axis : seriesColor(0),
              }}
            />
          </div>
          <span className="text-xs text-slate-700 tabular-nums w-12 text-right shrink-0">
            {row.count.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}
