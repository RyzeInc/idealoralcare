import { describe, expect, test } from "vitest";
import { normalizeBflMemberCode, resolveBflMemberCode } from "./bflCodes";
import { EMAIL_TEMPLATES } from "./emailTemplates";

describe("group-specific Balance for Life access", () => {
  test("uses an explicit assignment and preserves the legacy default", () => {
    expect(resolveBflMemberCode()).toBe("IDEAL");
    expect(resolveBflMemberCode({})).toBe("IDEAL");
    expect(resolveBflMemberCode({ bflMemberCode: " CMG " })).toBe("CMG");
    expect(normalizeBflMemberCode("")).toBeUndefined();
    expect(normalizeBflMemberCode(null)).toBeUndefined();
    expect(() => normalizeBflMemberCode('<script>')).toThrow();
  });

  test.each(["essentials-fulfillment-packet", "bfl-fulfillment-packet"] as const)("%s uses the assigned code in every access instruction", id => {
    const html = EMAIL_TEMPLATES[id].render({
      memberFirstName: "Sample", essentialsMemberNumber: "100000001", essentialsGroupNumber: "123456",
      bflMemberCode: "CMG", planName: "Membership", coverageType: "Employee", effectiveDate: "Nov 1, 2026",
      memberServicesPhone: "844-433-2502", portalUrl: "https://example.test",
    }).html;
    expect(html).toMatch(/Member Code[^]*?<strong>CMG<\/strong>/);
    expect(html).not.toMatch(/Member Code[^]*?<strong>IDEAL<\/strong>/);
    expect(html).not.toMatch(/559-ZENN/);
  });
});
