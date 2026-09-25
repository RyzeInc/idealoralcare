import { describe, test, expect } from "vitest";
import {
  CONTACT_STATUSES,
  CONTACT_STATUS_LABELS,
  LEGACY_CONTACT_STATUSES,
  LEGACY_STATUS_MIGRATION,
  isLegacyStatus,
  advanceDrip,
  dripLabel,
  DRIP_MAX_STEP,
  EMAIL_STATUSES,
  EMAIL_STATUS_LABELS,
  BLOCKING_EMAIL_STATUSES,
  isBlockingEmailStatus,
  NEXT_ACTIONS,
  NEXT_ACTION_LABELS,
} from "./contactStatus";

describe("status taxonomy", () => {
  test("every status, legacy included, has a label", () => {
    for (const status of [...CONTACT_STATUSES, ...LEGACY_CONTACT_STATUSES]) {
      expect(CONTACT_STATUS_LABELS[status]).toBeTruthy();
    }
  });

  test("no value is both current and legacy", () => {
    for (const legacy of LEGACY_CONTACT_STATUSES) {
      expect(CONTACT_STATUSES).not.toContain(legacy);
    }
  });

  test("every legacy status migrates to a current one", () => {
    for (const legacy of LEGACY_CONTACT_STATUSES) {
      expect(CONTACT_STATUSES).toContain(LEGACY_STATUS_MIGRATION[legacy]);
    }
  });

  test("isLegacyStatus only matches the retired values", () => {
    expect(isLegacyStatus("new")).toBe(true);
    expect(isLegacyStatus("customer")).toBe(true);
    expect(isLegacyStatus("prospect")).toBe(false);
    expect(isLegacyStatus("partner")).toBe(false);
    // nurturing and disqualified survived the redesign unchanged — they must
    // not be treated as legacy or the migration would rewrite them needlessly.
    expect(isLegacyStatus("nurturing")).toBe(false);
    expect(isLegacyStatus("disqualified")).toBe(false);
  });

  test("customer maps to partner, not to a mere expression of interest", () => {
    expect(LEGACY_STATUS_MIGRATION.customer).toBe("partner");
    expect(LEGACY_STATUS_MIGRATION.qualified).toBe("interested_qualified");
  });
});

describe("advanceDrip", () => {
  test("a fresh contact goes to step 1, in progress", () => {
    expect(advanceDrip({})).toEqual({ dripStatus: "in_progress", dripStep: 1 });
  });

  test("walks 1 through 5 and lands on completed at the last step", () => {
    let state: { dripStatus: "not_started" | "in_progress" | "completed" | "paused" | "replied_removed"; dripStep: number } = {
      dripStatus: "not_started",
      dripStep: 0,
    };
    const seen: number[] = [];
    for (let i = 0; i < DRIP_MAX_STEP; i++) {
      state = advanceDrip(state)!;
      seen.push(state.dripStep);
    }
    expect(seen).toEqual([1, 2, 3, 4, 5]);
    expect(state.dripStatus).toBe("completed");
  });

  test("never advances past the last email", () => {
    expect(advanceDrip({ dripStatus: "completed", dripStep: DRIP_MAX_STEP })).toEqual({
      dripStatus: "completed",
      dripStep: DRIP_MAX_STEP,
    });
  });

  test("a contact who replied is never re-entered into the sequence", () => {
    expect(advanceDrip({ dripStatus: "replied_removed", dripStep: 2 })).toBeNull();
  });

  test("a paused contact resumes rather than restarting", () => {
    expect(advanceDrip({ dripStatus: "paused", dripStep: 3 })).toEqual({
      dripStatus: "in_progress",
      dripStep: 4,
    });
  });

  test("a corrupt step above the maximum is clamped, not extended", () => {
    expect(advanceDrip({ dripStatus: "in_progress", dripStep: 99 })).toEqual({
      dripStatus: "completed",
      dripStep: DRIP_MAX_STEP,
    });
  });
});

describe("dripLabel", () => {
  test("renders the sent-count sentence the team asked for", () => {
    expect(dripLabel("in_progress", 3)).toBe("Email 3 Sent");
    expect(dripLabel("not_started", 0)).toBe("Not Started");
    expect(dripLabel("completed", 5)).toBe("Drip Completed");
    expect(dripLabel("replied_removed", 2)).toBe("Replied / Removed");
  });

  test("a row written before these fields existed still renders", () => {
    expect(dripLabel(undefined, undefined)).toBe("Not Started");
  });
});

describe("deliverability", () => {
  test("every email status has a label", () => {
    for (const status of EMAIL_STATUSES) {
      expect(EMAIL_STATUS_LABELS[status]).toBeTruthy();
    }
  });

  test("blocking statuses are a subset of the declared statuses", () => {
    for (const status of BLOCKING_EMAIL_STATUSES) {
      expect(EMAIL_STATUSES).toContain(status);
    }
  });

  test("a soft bounce does not block sending", () => {
    // Retiring an address over one full mailbox is how a real prospect
    // silently stops hearing from you — the drip pauses instead.
    expect(isBlockingEmailStatus("bounced_soft")).toBe(false);
  });

  test("hard failures and stated wishes all block", () => {
    for (const status of ["bounced_hard", "complained", "unsubscribed", "blocked", "invalid", "do_not_contact"]) {
      expect(isBlockingEmailStatus(status)).toBe(true);
    }
  });

  test("unknown and good addresses are reachable", () => {
    expect(isBlockingEmailStatus("unknown")).toBe(false);
    expect(isBlockingEmailStatus("valid")).toBe(false);
  });
});

describe("next action", () => {
  test("every next action has a label", () => {
    for (const action of NEXT_ACTIONS) {
      expect(NEXT_ACTION_LABELS[action]).toBeTruthy();
    }
  });
});
