import { describe, test, expect } from "vitest";
import {
  normalizeEmail,
  isRoleAddress,
  extractDomain,
  normalizePhoneE164,
  normalizeCompanyKey,
  normalizeNameKey,
  buildDedupeKey,
  buildContactSearchText,
  buildCompanySearchText,
} from "./normalize";

describe("normalizeEmail", () => {
  test("lowercases and trims", () => {
    expect(normalizeEmail("  Jon@Acme.COM  ")).toBe("jon@acme.com");
  });
  test("rejects malformed input", () => {
    expect(normalizeEmail("not-an-email")).toBeUndefined();
    expect(normalizeEmail("@acme.com")).toBeUndefined();
    expect(normalizeEmail("jon@")).toBeUndefined();
    expect(normalizeEmail(undefined)).toBeUndefined();
    expect(normalizeEmail(null)).toBeUndefined();
    expect(normalizeEmail("")).toBeUndefined();
  });
});

describe("isRoleAddress", () => {
  test("flags shared mailboxes", () => {
    expect(isRoleAddress("info@acme.com")).toBe(true);
    expect(isRoleAddress("Sales@Acme.com")).toBe(true);
    expect(isRoleAddress("postmaster@acme.com")).toBe(true);
  });
  test("passes individual addresses", () => {
    expect(isRoleAddress("jon@acme.com")).toBe(false);
    expect(isRoleAddress("j.smith@acme.com")).toBe(false);
  });
});

describe("extractDomain", () => {
  test("extracts the bare host", () => {
    expect(extractDomain("jon@Acme.COM")).toBe("acme.com");
  });
  test("undefined for invalid email", () => {
    expect(extractDomain("not-an-email")).toBeUndefined();
  });
});

describe("normalizePhoneE164", () => {
  test("formats a bare 10-digit US number", () => {
    expect(normalizePhoneE164("(555) 123-4567")).toBe("+15551234567");
  });
  test("formats an 11-digit number with leading 1", () => {
    expect(normalizePhoneE164("1-555-123-4567")).toBe("+15551234567");
  });
  test("rejects implausible lengths", () => {
    expect(normalizePhoneE164("12345")).toBeUndefined();
    expect(normalizePhoneE164("+44 20 7946 0958")).toBeUndefined(); // UK, 12 digits
    expect(normalizePhoneE164(undefined)).toBeUndefined();
  });
});

describe("normalizeCompanyKey", () => {
  test("lowercases, collapses whitespace, strips legal suffixes", () => {
    expect(normalizeCompanyKey("  Acme   Inc.  ")).toBe("acme");
    expect(normalizeCompanyKey("Acme LLC")).toBe("acme");
    expect(normalizeCompanyKey("Acme Corp")).toBe("acme");
  });
  test("leaves a name with no suffix alone", () => {
    expect(normalizeCompanyKey("Acme Dental Group")).toBe("acme dental"); // "Group" is a stripped suffix
  });
  test("undefined for empty input", () => {
    expect(normalizeCompanyKey("")).toBeUndefined();
    expect(normalizeCompanyKey(undefined)).toBeUndefined();
  });
});

describe("normalizeNameKey", () => {
  test("lowercases and strips punctuation", () => {
    expect(normalizeNameKey("Jon", "O'Brien")).toBe("jon obrien");
  });
  test("handles missing parts", () => {
    expect(normalizeNameKey("Jon", undefined)).toBe("jon");
    expect(normalizeNameKey(undefined, undefined)).toBe("");
  });
});

describe("buildDedupeKey", () => {
  test("combines name key and company key", () => {
    expect(buildDedupeKey("Jon", "Smith", "Acme Inc.")).toBe("jon smith|acme");
  });
  test("undefined when there is no name at all", () => {
    expect(buildDedupeKey(undefined, undefined, "Acme")).toBeUndefined();
  });
  test("still produces a key with no company", () => {
    expect(buildDedupeKey("Jon", "Smith", undefined)).toBe("jon smith|");
  });
});

describe("buildContactSearchText", () => {
  test("joins present fields, lowercased, including phone digits", () => {
    const text = buildContactSearchText({
      fullName: "Jon Smith",
      email: "Jon@Acme.com",
      companyName: "Acme Inc.",
      jobTitle: "VP of HR",
      mobilePhone: "(555) 123-4567",
    });
    expect(text).toContain("jon smith");
    expect(text).toContain("jon@acme.com");
    expect(text).toContain("acme inc.");
    expect(text).toContain("vp of hr");
    expect(text).toContain("5551234567");
  });
  test("skips missing fields without leaving artifacts", () => {
    const text = buildContactSearchText({ fullName: "Jon Smith" });
    expect(text).toBe("jon smith");
  });
});

describe("buildCompanySearchText", () => {
  test("joins present fields", () => {
    const text = buildCompanySearchText({ name: "Acme Inc.", city: "Austin", state: "TX" });
    expect(text).toBe("acme inc. austin tx");
  });
});
