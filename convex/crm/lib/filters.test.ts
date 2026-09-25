import { describe, test, expect } from "vitest";
import {
  chooseDriverIndex,
  assertNotSearchDriven,
  buildContactPredicate,
  isEmailable,
  isCallable,
  FILTER_DEFAULTS,
  type FilterableContact,
} from "./filters";

function contact(overrides: Partial<FilterableContact> = {}): FilterableContact {
  return {
    status: "new",
    tagIds: [],
    emailOptOut: false,
    emailStatus: "unknown",
    callOptOut: false,
    phoneStatus: "unknown",
    createdAt: Date.now(),
    isArchived: false,
    ...overrides,
  };
}

describe("chooseDriverIndex", () => {
  test("prefers search when a search term of 2+ chars is present", () => {
    expect(chooseDriverIndex({ searchTerm: "jo" })).toEqual({ kind: "search_contacts", searchTerm: "jo" });
  });

  test("ignores a 1-char search term (below the useful threshold)", () => {
    expect(chooseDriverIndex({ searchTerm: "j" })).not.toEqual(
      expect.objectContaining({ kind: "search_contacts" }),
    );
  });

  test("single tag group with a single tag drives by_tag_contact", () => {
    expect(chooseDriverIndex({ tagGroups: [{ tagIds: ["tag1"] }] })).toEqual({
      kind: "by_tag_contact",
      tagId: "tag1",
    });
  });

  test("multi-tag group does not drive by_tag_contact (would need OR fan-out)", () => {
    const driver = chooseDriverIndex({ tagGroups: [{ tagIds: ["tag1", "tag2"] }] });
    expect(driver.kind).not.toBe("by_tag_contact");
  });

  test("companyId drives by_company", () => {
    expect(chooseDriverIndex({ companyId: "co1" })).toEqual({ kind: "by_company", companyId: "co1" });
  });

  test("single owner + single status drives by_owner_status", () => {
    expect(
      chooseDriverIndex({ ownerClerkUserIds: ["u1"], statuses: ["working"] }),
    ).toEqual({ kind: "by_owner_status", ownerClerkUserId: "u1", status: "working" });
  });

  test("single status alone drives by_status", () => {
    expect(chooseDriverIndex({ statuses: ["working"] })).toEqual({ kind: "by_status", status: "working" });
  });

  test("neverContacted drives by_last_contacted", () => {
    expect(chooseDriverIndex({ neverContacted: true })).toEqual({ kind: "by_last_contacted" });
  });

  test("falls back to by_updated with no discriminating filter", () => {
    expect(chooseDriverIndex({})).toEqual({ kind: "by_updated" });
  });
});

describe("assertNotSearchDriven", () => {
  test("throws for a search-text driver", () => {
    expect(() => assertNotSearchDriven({ kind: "search_contacts", searchTerm: "jo" })).toThrow(
      /search-text query/,
    );
  });

  test("passes for every non-search driver", () => {
    expect(() => assertNotSearchDriven({ kind: "by_updated" })).not.toThrow();
    expect(() => assertNotSearchDriven({ kind: "by_status", status: "new" })).not.toThrow();
  });
});

describe("isEmailable / isCallable", () => {
  test("requires the contact info to exist", () => {
    expect(isEmailable({ email: undefined, emailOptOut: false, emailStatus: "valid" })).toBe(false);
    expect(isCallable({ mobilePhone: undefined, callOptOut: false, phoneStatus: "valid" })).toBe(false);
  });

  test("opt-out always wins even with a valid status", () => {
    expect(isEmailable({ email: "a@b.com", emailOptOut: true, emailStatus: "valid" })).toBe(false);
    expect(isCallable({ mobilePhone: "+15551234567", callOptOut: true, phoneStatus: "valid" })).toBe(false);
  });

  test("bad deliverability status blocks even without an explicit opt-out", () => {
    for (const status of ["bounced_hard", "complained", "unsubscribed"]) {
      expect(isEmailable({ email: "a@b.com", emailOptOut: false, emailStatus: status })).toBe(false);
    }
    for (const status of ["disconnected", "dnc"]) {
      expect(isCallable({ mobilePhone: "+15551234567", callOptOut: false, phoneStatus: status })).toBe(false);
    }
  });

  test("clean record is reachable", () => {
    expect(isEmailable({ email: "a@b.com", emailOptOut: false, emailStatus: "valid" })).toBe(true);
    expect(isCallable({ mobilePhone: "+15551234567", callOptOut: false, phoneStatus: "valid" })).toBe(true);
  });
});

describe("buildContactPredicate", () => {
  test("defaults exclude archived contacts", () => {
    expect(FILTER_DEFAULTS.isArchived).toBe(false);
    const predicate = buildContactPredicate({});
    expect(predicate(contact({ isArchived: true }))).toBe(false);
    expect(predicate(contact({ isArchived: false }))).toBe(true);
  });

  test("an explicit isArchived: true overrides the default", () => {
    const predicate = buildContactPredicate({ isArchived: true });
    expect(predicate(contact({ isArchived: true }))).toBe(true);
    expect(predicate(contact({ isArchived: false }))).toBe(false);
  });

  test("jobTitleContains is OR-matched, case-insensitive substring", () => {
    const predicate = buildContactPredicate({ jobTitleContains: ["hr director", "vp"] });
    expect(predicate(contact({ jobTitle: "VP of People" }))).toBe(true);
    expect(predicate(contact({ jobTitle: "Sales Rep" }))).toBe(false);
  });

  test("jobTitleExcludes overrides a positive jobTitleContains match", () => {
    const predicate = buildContactPredicate({
      jobTitleContains: ["manager"],
      jobTitleExcludes: ["office manager"],
    });
    expect(predicate(contact({ jobTitle: "Benefits Manager" }))).toBe(true);
    expect(predicate(contact({ jobTitle: "Office Manager" }))).toBe(false);
  });

  test("tagGroups is AND-across-groups, OR-within-group", () => {
    const predicate = buildContactPredicate({
      tagGroups: [
        { tagIds: ["tx", "ca"] },        // Location: TX or CA
        { tagIds: ["manufacturing"] },   // Industry: Manufacturing
      ],
    });
    expect(predicate(contact({ tagIds: ["tx", "manufacturing"] }))).toBe(true);
    expect(predicate(contact({ tagIds: ["ca", "manufacturing"] }))).toBe(true);
    expect(predicate(contact({ tagIds: ["tx"] }))).toBe(false); // missing industry tag
    expect(predicate(contact({ tagIds: ["ny", "manufacturing"] }))).toBe(false); // wrong location
  });

  test("excludeTagIds vetoes an otherwise-matching contact", () => {
    const predicate = buildContactPredicate({ excludeTagIds: ["competitor"] });
    expect(predicate(contact({ tagIds: ["competitor"] }))).toBe(false);
    expect(predicate(contact({ tagIds: ["prospect"] }))).toBe(true);
  });

  test("emailable / callable delegate to isEmailable / isCallable", () => {
    const predicate = buildContactPredicate({ emailable: true });
    expect(predicate(contact({ email: "a@b.com", emailOptOut: true }))).toBe(false);
    expect(predicate(contact({ email: "a@b.com", emailOptOut: false }))).toBe(true);
  });

  test("neverContacted is true only when lastContactedAt is unset", () => {
    const predicate = buildContactPredicate({ neverContacted: true });
    expect(predicate(contact({ lastContactedAt: undefined }))).toBe(true);
    expect(predicate(contact({ lastContactedAt: Date.now() }))).toBe(false);
  });

  test("lastContactedBeforeDays excludes contacts with no contact history at all", () => {
    // A contact never contacted is not the same claim as "contacted >30 days ago" —
    // this must not silently include never-contacted rows in a "gone cold" segment.
    const predicate = buildContactPredicate({ lastContactedBeforeDays: 30 });
    expect(predicate(contact({ lastContactedAt: undefined }))).toBe(false);
    const fortyDaysAgo = Date.now() - 40 * 24 * 60 * 60 * 1000;
    expect(predicate(contact({ lastContactedAt: fortyDaysAgo }))).toBe(true);
    const fiveDaysAgo = Date.now() - 5 * 24 * 60 * 60 * 1000;
    expect(predicate(contact({ lastContactedAt: fiveDaysAgo }))).toBe(false);
  });

  test("importBatchId filters to exactly that batch", () => {
    const predicate = buildContactPredicate({ importBatchId: "batch1" });
    expect(predicate(contact({ importBatchId: "batch1" }))).toBe(true);
    expect(predicate(contact({ importBatchId: "batch2" }))).toBe(false);
    expect(predicate(contact({ importBatchId: undefined }))).toBe(false);
  });
});
