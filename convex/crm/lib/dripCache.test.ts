import { describe, test, expect } from "vitest";
import { dripStatusForEnrollment, pickPrimaryEnrollment } from "./dripCache";
import type { Doc } from "../../_generated/dataModel";

type Enrollment = Doc<"crmDripEnrollments">;

/**
 * Only the fields pickPrimaryEnrollment actually reads.
 *
 * Ids are taken as plain strings and branded here rather than typed as
 * `Partial<Enrollment>`, so a test can say `_id: "live"` and stay readable.
 * The branding happens in ONE place instead of at every call site — and the
 * return type is still the real Doc, so the function under test is exercised
 * against the genuine shape rather than a loosely-typed stand-in.
 */
type EnrollmentOverrides = Partial<Omit<Enrollment, "_id" | "dripCampaignId" | "contactId">> & {
  _id?: string;
  dripCampaignId?: string;
  contactId?: string;
};

function enrollment(over: EnrollmentOverrides = {}): Enrollment {
  return {
    _id: (over._id ?? "e1") as Enrollment["_id"],
    _creationTime: 0,
    dripCampaignId: (over.dripCampaignId ?? "c1") as Enrollment["dripCampaignId"],
    contactId: (over.contactId ?? "ct1") as Enrollment["contactId"],
    phase: over.phase ?? 0,
    status: over.status ?? "active",
    enrolledAt: over.enrolledAt ?? 1000,
    updatedAt: over.updatedAt ?? 1000,
    lastPhaseSentAt: over.lastPhaseSentAt,
    completedAt: over.completedAt,
    exitedAt: over.exitedAt,
    exitReason: over.exitReason,
    enrolledBy: over.enrolledBy,
  };
}

describe("dripStatusForEnrollment", () => {
  test("enrolled but nothing sent is Not Started, not in-progress-at-zero", () => {
    expect(dripStatusForEnrollment("active", 0)).toBe("not_started");
  });

  test("an active enrollment past phase 0 is in progress", () => {
    expect(dripStatusForEnrollment("active", 3)).toBe("in_progress");
  });

  test("terminal enrollment states map onto the shipped drip vocabulary", () => {
    expect(dripStatusForEnrollment("completed", 5)).toBe("completed");
    expect(dripStatusForEnrollment("paused", 2)).toBe("paused");
    expect(dripStatusForEnrollment("replied", 2)).toBe("replied_removed");
  });

  test("a removed enrollment reads as not started — it is no longer a sequence", () => {
    expect(dripStatusForEnrollment("removed", 4)).toBe("not_started");
  });
});

describe("pickPrimaryEnrollment", () => {
  test("no enrollments means no primary", () => {
    expect(pickPrimaryEnrollment([])).toBeNull();
  });

  test("removed enrollments are never primary", () => {
    expect(pickPrimaryEnrollment([enrollment({ status: "removed" })])).toBeNull();
  });

  test("an active campaign wins over a completed one, regardless of age", () => {
    // Someone actively being mailed by a new track, who finished an old one:
    // "what are they on" is the live one even though it is the newer row.
    const completed = enrollment({ _id: "old", status: "completed", enrolledAt: 9000 });
    const active = enrollment({ _id: "live", status: "active", enrolledAt: 1000 });
    expect(pickPrimaryEnrollment([completed, active])?._id).toBe("live");
  });

  test("among active enrollments the most recently enrolled wins", () => {
    const older = enrollment({ _id: "a", status: "active", enrolledAt: 1000 });
    const newer = enrollment({ _id: "b", status: "active", enrolledAt: 5000 });
    expect(pickPrimaryEnrollment([older, newer])?._id).toBe("b");
  });

  test("with no active enrollment, the most recent surviving one is used", () => {
    const paused = enrollment({ _id: "p", status: "paused", enrolledAt: 1000 });
    const replied = enrollment({ _id: "r", status: "replied", enrolledAt: 7000 });
    expect(pickPrimaryEnrollment([paused, replied])?._id).toBe("r");
  });
});
