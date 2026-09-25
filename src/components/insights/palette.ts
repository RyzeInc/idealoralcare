/**
 * INSIGHTS PALETTE
 *
 * Validated with the dataviz validator against the surface these charts
 * actually render on (#ffffff — the admin's white cards), not a generic one:
 *
 *   lightness band  PASS   all 8 inside L 0.43-0.77
 *   chroma floor    PASS   all 8 >= 0.1
 *   CVD separation  PASS   worst adjacent yellow-aqua ΔE 9.1 (protan)
 *   normal vision   PASS   worst adjacent magenta-yellow ΔE 19.6
 *   contrast        WARN   aqua/yellow/magenta below 3:1 on white
 *
 * The contrast warning is not dismissable: it obligates relief. Every chart
 * here ships a legend, direct labels on <= 4 series, and a table view, so
 * identity never rests on color alone.
 *
 * Slot order is the colorblind-safety mechanism, not decoration. Assign hues in
 * this fixed order and never cycle — a ninth series folds into "Other" or gets
 * faceted. Colour follows the ENTITY, never its rank, so a filter that changes
 * the series count must not repaint the survivors.
 *
 * The admin surfaces are light-only (no theme toggle anywhere in /admin), so
 * this commits to a single look deliberately rather than shipping a dark set
 * that nothing can select.
 */

/** Categorical slots, in fixed assignment order. */
export const SERIES = [
  "#2a78d6", // 1 blue
  "#eb6834", // 2 orange
  "#1baf7a", // 3 aqua
  "#eda100", // 4 yellow
  "#e87ba4", // 5 magenta
  "#008300", // 6 green
  "#4a3aa7", // 7 violet
  "#e34948", // 8 red
] as const;

/** Sequential ramp (blue, light to dark) for magnitude — cohort cells. */
export const SEQUENTIAL = [
  "#cde2fb", "#b7d3f6", "#9ec5f4", "#86b6ef",
  "#6da7ec", "#5598e7", "#3987e5", "#2a78d6",
  "#256abf", "#1c5cab", "#184f95", "#104281",
] as const;

/**
 * Ordinal ramp for discrete ordered marks (funnel stages).
 * Starts at step 250 — anything lighter drops below 2:1 on a light surface.
 */
export const ORDINAL = ["#86b6ef", "#5598e7", "#2a78d6", "#1c5cab", "#104281"] as const;

/** Status is reserved. Never reuse these as "series 4". Always icon + label. */
export const STATUS = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
} as const;

/** Chart chrome. Text always wears ink, never a series color. */
export const INK = {
  primary: "#0b0b0b",
  secondary: "#52514e",
  muted: "#898781",
  grid: "#e1e0d9",
  axis: "#c3c2b7",
  surface: "#ffffff",
  /** Gap painted between stacked segments and adjacent bars. */
  gap: "#ffffff",
  positive: "#006300",
  negative: "#d03b3b",
} as const;

/** Hue for a series by its index, clamped rather than cycled. */
export function seriesColor(index: number): string {
  return SERIES[Math.min(index, SERIES.length - 1)];
}

/** Step a 0..1 magnitude onto the sequential ramp. */
export function sequentialColor(t: number): string {
  if (!Number.isFinite(t)) return INK.grid;
  const clamped = Math.max(0, Math.min(1, t));
  return SEQUENTIAL[Math.round(clamped * (SEQUENTIAL.length - 1))];
}

/** Readable ink for text sitting on a sequential cell. */
export function sequentialInk(t: number): string {
  return t > 0.55 ? "#ffffff" : INK.primary;
}
