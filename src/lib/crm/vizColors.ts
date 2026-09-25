/**
 * CRM analytics chart colors — pulled from the dataviz skill's validated
 * default palette (light mode only: this admin console has no dark-mode
 * support anywhere else, so introducing one just for these charts would be
 * inconsistent with every other /admin page).
 *
 * Categorical order is FIXED, never cycled — see the skill's color-formula.
 */
export const SERIES_BLUE = '#2a78d6';
export const SERIES_ORANGE = '#eb6834';
export const SERIES_AQUA = '#1baf7a';

/** Sequential ordinal ramp (one hue, light→dark) for stage-ordered charts — stays within the doc's ordinal-safe band (step 250–600 on light). */
export const SEQUENTIAL_BLUE_RAMP = ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#184f95'];

/** Status palette — reserved for call-outcome state, never used as a series identity color. */
export const STATUS_GOOD = '#0ca30c';
export const STATUS_WARNING = '#fab219';
export const STATUS_CRITICAL = '#d03b3b';

export function sequentialStep(index: number, total: number): string {
  const ramp = SEQUENTIAL_BLUE_RAMP;
  const i = total <= 1 ? 0 : Math.round((index / (total - 1)) * (ramp.length - 1));
  return ramp[Math.min(ramp.length - 1, Math.max(0, i))];
}
