import { describe, test, expect } from "vitest";
import {
  computeDueAt,
  isWithinSendWindow,
  nextWindowOpening,
  msUntilNextUtcMidnight,
  retryDelayMs,
  DEFAULT_PHASE_DELAY_DAYS,
} from "./dripSchedule";

const DAY = 24 * 60 * 60 * 1000;
/** Wednesday 2026-09-16, 14:00 UTC. */
const WED_1400 = Date.UTC(2026, 8, 16, 14, 0, 0, 0);

describe("computeDueAt", () => {
  test("adds whole days to when the previous phase landed", () => {
    expect(computeDueAt(WED_1400, 3)).toBe(WED_1400 + 3 * DAY);
  });

  test("a zero delay is due immediately, not a day later", () => {
    expect(computeDueAt(WED_1400, 0)).toBe(WED_1400);
  });

  test("a negative or non-finite delay never schedules into the past", () => {
    expect(computeDueAt(WED_1400, -5)).toBe(WED_1400);
    expect(computeDueAt(WED_1400, Number.NaN)).toBe(WED_1400 + DEFAULT_PHASE_DELAY_DAYS * DAY);
  });
});

describe("isWithinSendWindow", () => {
  test("no window configured means always open", () => {
    // Quiet hours are opt-in: an existing campaign must not silently stop
    // sending the day this feature ships.
    expect(isWithinSendWindow(WED_1400, {})).toBe(true);
  });

  test("respects an ordinary daytime window", () => {
    const window = { sendWindowStartHour: 13, sendWindowEndHour: 21 };
    expect(isWithinSendWindow(WED_1400, window)).toBe(true);
    expect(isWithinSendWindow(Date.UTC(2026, 8, 16, 12, 59), window)).toBe(false);
    expect(isWithinSendWindow(Date.UTC(2026, 8, 16, 21, 0), window)).toBe(false);
  });

  test("the start hour is inclusive and the end hour exclusive", () => {
    const window = { sendWindowStartHour: 13, sendWindowEndHour: 21 };
    expect(isWithinSendWindow(Date.UTC(2026, 8, 16, 13, 0), window)).toBe(true);
    expect(isWithinSendWindow(Date.UTC(2026, 8, 16, 20, 59), window)).toBe(true);
  });

  test("a window that wraps midnight is two ranges, not an empty one", () => {
    const overnight = { sendWindowStartHour: 22, sendWindowEndHour: 6 };
    expect(isWithinSendWindow(Date.UTC(2026, 8, 16, 23, 0), overnight)).toBe(true);
    expect(isWithinSendWindow(Date.UTC(2026, 8, 16, 3, 0), overnight)).toBe(true);
    expect(isWithinSendWindow(Date.UTC(2026, 8, 16, 12, 0), overnight)).toBe(false);
  });

  test("weekday restrictions apply independently of the hour window", () => {
    // Weekdays only: Wednesday passes, Saturday does not.
    const weekdays = { sendDays: [1, 2, 3, 4, 5] };
    expect(isWithinSendWindow(WED_1400, weekdays)).toBe(true);
    expect(isWithinSendWindow(Date.UTC(2026, 8, 19, 14, 0), weekdays)).toBe(false);
  });
});

describe("nextWindowOpening", () => {
  test("returns the same instant when the window is already open", () => {
    expect(nextWindowOpening(WED_1400, { sendWindowStartHour: 13, sendWindowEndHour: 21 })).toBe(WED_1400);
  });

  test("waits for today's opening when called before it", () => {
    const early = Date.UTC(2026, 8, 16, 6, 0);
    expect(nextWindowOpening(early, { sendWindowStartHour: 13, sendWindowEndHour: 21 })).toBe(
      Date.UTC(2026, 8, 16, 13, 0),
    );
  });

  test("rolls to tomorrow's opening when called after today's close", () => {
    const late = Date.UTC(2026, 8, 16, 22, 0);
    expect(nextWindowOpening(late, { sendWindowStartHour: 13, sendWindowEndHour: 21 })).toBe(
      Date.UTC(2026, 8, 17, 13, 0),
    );
  });

  test("skips disallowed weekdays", () => {
    // Friday 18:00, weekdays-only window → Monday's opening, not Saturday's.
    const friday = Date.UTC(2026, 8, 18, 22, 0);
    const result = nextWindowOpening(friday, {
      sendWindowStartHour: 13, sendWindowEndHour: 21, sendDays: [1, 2, 3, 4, 5],
    });
    expect(new Date(result).getUTCDay()).toBe(1);
    expect(result).toBe(Date.UTC(2026, 8, 21, 13, 0));
  });

  test("terminates even when no weekday is allowed", () => {
    // A misconfigured campaign must not spin forever looking for an opening.
    const result = nextWindowOpening(WED_1400, { sendDays: [] });
    expect(Number.isFinite(result)).toBe(true);
  });
});

describe("msUntilNextUtcMidnight", () => {
  test("counts the remainder of the UTC day", () => {
    expect(msUntilNextUtcMidnight(WED_1400)).toBe(Date.UTC(2026, 8, 17) - WED_1400);
  });
});

describe("retryDelayMs", () => {
  test("backs off and then stops growing", () => {
    const hour = 60 * 60 * 1000;
    expect(retryDelayMs(1)).toBe(hour);
    expect(retryDelayMs(2)).toBe(4 * hour);
    expect(retryDelayMs(3)).toBe(16 * hour);
    expect(retryDelayMs(9)).toBe(16 * hour);
  });
});
