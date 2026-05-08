/**
 * Period helpers for the Invoice Calculator.
 *
 * All boundaries are UTC. Display layers may render in a local time zone,
 * but the canonical values (stored in `invoicePeriods`) are UTC instants.
 */

export interface PeriodWindow {
  /** "YYYY-MM" canonical key. */
  period: string;
  year: number;
  /** 1..12 */
  month: number;
  /** UTC start (inclusive). */
  startMs: number;
  /** UTC end (exclusive). */
  endMs: number;
}

/** Format a "YYYY-MM" key for the given UTC year/month (1..12). */
export function periodKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Build the calendar-month UTC window for a given year/month (1..12). */
export function periodWindow(year: number, month: number): PeriodWindow {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Invalid period: ${year}-${month}`);
  }
  const startMs = Date.UTC(year, month - 1, 1, 0, 0, 0, 0);
  const endMs = Date.UTC(year, month, 1, 0, 0, 0, 0);
  return { period: periodKey(year, month), year, month, startMs, endMs };
}

/** Parse a "YYYY-MM" key back into a window. Throws on bad input. */
export function parsePeriodKey(key: string): PeriodWindow {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) throw new Error(`Invalid period key: ${key}`);
  return periodWindow(Number(m[1]), Number(m[2]));
}

/** Calendar month containing the given UTC instant. */
export function periodWindowForInstant(ms: number): PeriodWindow {
  const d = new Date(ms);
  return periodWindow(d.getUTCFullYear(), d.getUTCMonth() + 1);
}

/** The current calendar month (UTC). */
export function currentPeriod(now: number = Date.now()): PeriodWindow {
  return periodWindowForInstant(now);
}

/** Returns true iff the period ends strictly in the past (i.e. closeable). */
export function isPeriodInPast(p: PeriodWindow, now: number = Date.now()): boolean {
  return p.endMs <= now;
}
