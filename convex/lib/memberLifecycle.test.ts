/**
 * MEMBER LIFECYCLE — status derivation and exit timestamps.
 *
 * These are pure functions, so the tests are about the rules themselves:
 * that `status` follows `memberType`, that a suspension is not silently
 * lifted, and that `terminatedAt` records the FIRST exit rather than the most
 * recent save.
 */

import { describe, test, expect } from "vitest";
import {
  statusForMemberType,
  lifecyclePatchFor,
  hasExited,
  EXITED_MEMBER_TYPES,
} from "./memberLifecycle";

describe("statusForMemberType", () => {
  test("in-funnel positions are live records", () => {
    for (const t of ["lead", "eligible", "enrolling", "active"] as const) {
      expect(statusForMemberType(t, undefined)).toBe("active");
    }
  });

  test("inactive and declined are inactive records", () => {
    expect(statusForMemberType("inactive", undefined)).toBe("inactive");
    expect(statusForMemberType("declined", undefined)).toBe("inactive");
  });

  test("an administrative suspension survives a lifecycle move", () => {
    // Deriving status blindly would un-suspend someone as a side effect of an
    // unrelated funnel transition.
    expect(statusForMemberType("active", "suspended")).toBe("suspended");
    expect(statusForMemberType("lead", "suspended")).toBe("suspended");
  });

  test("but terminating overrides a suspension", () => {
    expect(statusForMemberType("terminated", "suspended")).toBe("terminated");
  });
});

describe("hasExited", () => {
  test("inactive counts as leaving, not just terminated", () => {
    expect(hasExited("inactive")).toBe(true);
    expect(hasExited("terminated")).toBe(true);
    expect(hasExited("active")).toBe(false);
    expect(hasExited(undefined)).toBe(false);
    expect(EXITED_MEMBER_TYPES.has("inactive")).toBe(true);
  });
});

describe("lifecyclePatchFor", () => {
  test("exiting stamps terminatedAt", () => {
    const patch = lifecyclePatchFor("terminated", { memberType: "active" }, 1000);
    expect(patch.memberType).toBe("terminated");
    expect(patch.status).toBe("terminated");
    expect(patch.terminatedAt).toBe(1000);
  });

  test("re-saving an already-exited member does not move the timestamp", () => {
    // The first exit is what a cohort measures; a later admin edit must not
    // silently restate history.
    const patch = lifecyclePatchFor(
      "terminated",
      { memberType: "inactive", terminatedAt: 500 },
      9999,
    );
    expect(patch.terminatedAt).toBeUndefined();
    expect("terminatedAt" in patch).toBe(false);
  });

  test("reactivation clears the timestamp", () => {
    const patch = lifecyclePatchFor(
      "active",
      { memberType: "terminated", terminatedAt: 500 },
      9999,
    );
    expect(patch.status).toBe("active");
    expect("terminatedAt" in patch).toBe(true);
    expect(patch.terminatedAt).toBeUndefined();
  });

  test("a move between two non-exit states leaves the field alone", () => {
    const patch = lifecyclePatchFor("enrolling", { memberType: "lead" }, 1000);
    expect("terminatedAt" in patch).toBe(false);
  });

  test("active -> inactive is an exit", () => {
    const patch = lifecyclePatchFor("inactive", { memberType: "active" }, 1000);
    expect(patch.status).toBe("inactive");
    expect(patch.terminatedAt).toBe(1000);
  });
});
