/**
 * DRIP SCHEDULING ARITHMETIC — when the next phase is allowed to go out.
 *
 * Pure and dependency-free so the rules that decide when unattended mail
 * leaves the system are unit-testable without a database or a clock. Every
 * function takes `now` explicitly rather than calling Date.now(), for the same
 * reason.
 *
 * ALL TIMES ARE UTC, matching crmSendCounters' `todayUtc()` day key and the
 * campaign engine's midnight rollover. A send window of 13-21 is 1pm-9pm UTC,
 * not the reader's local time — the UI says so.
 */

export const DEFAULT_PHASE_DELAY_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export interface SendWindow {
  /** Inclusive UTC hour the window opens, 0-23. */
  sendWindowStartHour?: number;
  /** Exclusive UTC hour the window closes, 1-24. */
  sendWindowEndHour?: number;
  /** Allowed weekdays, 0=Sunday. Undefined or empty means every day. */
  sendDays?: number[];
}

/** When a phase becomes due, given when the previous one actually landed. */
export function computeDueAt(previousPhaseSentAt: number, delayDays: number): number {
  const days = Number.isFinite(delayDays) ? Math.max(0, delayDays) : DEFAULT_PHASE_DELAY_DAYS;
  return previousPhaseSentAt + days * DAY_MS;
}

function hasWindow(window: SendWindow): boolean {
  return window.sendWindowStartHour !== undefined && window.sendWindowEndHour !== undefined;
}

function dayAllowed(date: Date, window: SendWindow): boolean {
  if (!window.sendDays || window.sendDays.length === 0) return true;
  return window.sendDays.includes(date.getUTCDay());
}

/**
 * Is `now` inside the campaign's allowed sending window?
 *
 * A campaign with no window configured is always open — quiet hours are
 * opt-in, so an existing campaign does not silently stop sending when this
 * feature ships.
 */
export function isWithinSendWindow(now: number, window: SendWindow): boolean {
  const date = new Date(now);
  if (!dayAllowed(date, window)) return false;
  if (!hasWindow(window)) return true;

  const hour = date.getUTCHours();
  const start = window.sendWindowStartHour!;
  const end = window.sendWindowEndHour!;
  // A window that wraps midnight (22 → 6) is two ranges, not one.
  return start <= end ? hour >= start && hour < end : hour >= start || hour < end;
}

/**
 * The next instant sending is permitted at or after `now`.
 *
 * Returns `now` when the window is already open. Walks forward a day at a time
 * when the weekday is disallowed, capped at a week so a campaign configured
 * with an impossible window (no allowed days) can never spin forever — it
 * simply reports a week out, and the row is re-examined then.
 */
export function nextWindowOpening(now: number, window: SendWindow): number {
  if (isWithinSendWindow(now, window)) return now;

  const date = new Date(now);
  if (hasWindow(window)) {
    const start = window.sendWindowStartHour!;
    const end = window.sendWindowEndHour!;
    const hour = date.getUTCHours();
    // Before today's opening: wait for it. Otherwise the next opening is
    // tomorrow's (which the day-walk below then validates against sendDays).
    const openingToday = Date.UTC(
      date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), start, 0, 0, 0,
    );
    const isBeforeOpening = start <= end ? hour < start : hour < start && hour >= end;
    let candidate = isBeforeOpening ? openingToday : openingToday + DAY_MS;

    for (let i = 0; i < 7; i++) {
      if (dayAllowed(new Date(candidate), window)) return candidate;
      candidate += DAY_MS;
    }
    return candidate;
  }

  // Day restriction only: open at the start of the next allowed day.
  let candidate = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) + DAY_MS;
  for (let i = 0; i < 7; i++) {
    if (dayAllowed(new Date(candidate), window)) return candidate;
    candidate += DAY_MS;
  }
  return candidate;
}

/** Milliseconds until the next UTC midnight — the daily-cap hold, same as the campaign engine's. */
export function msUntilNextUtcMidnight(now: number): number {
  const date = new Date(now);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1) - now;
}

/** Backoff for a send that failed transiently: 1h, then 4h, then 16h. */
export function retryDelayMs(attempt: number): number {
  return Math.min(16, 4 ** Math.max(0, attempt - 1)) * HOUR_MS;
}
