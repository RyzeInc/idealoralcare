import { describe, expect, test } from "vitest";
import { isPipeEligibility, validatePipeEligibility } from "./careingtonEligibility";

// Fake members from the October 21 guide; no employee data is stored here.
export const PRIMARY = "|John|A|Sample||100000001|00||123 Main St|Apt 4|Dallas|TX|75034||2145550101||MF|123GRPS||11012026|05141985||||M|john.sample@example.com||0";
export const DEPENDENT = "|Jane||Sample||100000001|01||123 Main St|Apt 4|Dallas|TX|75034||||MF|123GRPS||11012026|08221987|S|N||F|||0";
const changed = (index: number, value: string, row = PRIMARY) => {
  const cells = row.split("|"); cells[index] = value; return cells.join("|");
};

describe("28-field eligibility preflight", () => {
  test("accepts the supplied primary/dependent layout and a month-end termination", () => {
    expect(validatePipeEligibility(`${PRIMARY}\r\n${DEPENDENT}\r\n`)).toEqual([]);
    expect(validatePipeEligibility(changed(18, "11302026"))).toEqual([]);
  });

  test("recognizes pipe records regardless of the .csv extension, including a BOM", () => {
    expect(isPipeEligibility(`\uFEFF\n${PRIMARY}`)).toBe(true);
    expect(isPipeEligibility(changed(0, "MR"))).toBe(true);
    expect(isPipeEligibility('firstName,lastName\nJohn,"Sample | Family"')).toBe(false);
  });

  test("rejects missing/extra pipes instead of accepting shifted columns", () => {
    for (const row of [PRIMARY.slice(1), PRIMARY + "|"]) expect(validatePipeEligibility(row).some(issue => issue.field === "layout")).toBe(true);
  });

  test.each([[8, "address"], [10, "city"], [11, "state"], [12, "zip"]])("reports a missing required address column %s", (column, field) => {
    expect(validatePipeEligibility(changed(Number(column), "")).some(issue => issue.field === field)).toBe(true);
  });

  test.each([[11, "ZZ", "state"], [12, "1234", "zip"], [20, "02312026", "dateOfBirth"], [19, "11152026", "effectiveDate"], [5, "SAMPLE", "uniqueId"], [17, "DTC-DEFAULT-2026", "groupCode"]])("catches invalid column %s without exposing its contents", (column, value, field) => {
    const issues = validatePipeEligibility(changed(Number(column), String(value)));
    expect(issues.some(issue => issue.field === field)).toBe(true);
    expect(issues.map(issue => issue.message).join(" ")).not.toContain("100000001");
  });

  test("prevents duplicate policy sequences and attaching a dependent to the wrong primary", () => {
    expect(validatePipeEligibility(`${PRIMARY}\n${PRIMARY}`).some(issue => /Duplicate/.test(issue.message))).toBe(true);
    expect(validatePipeEligibility(`${PRIMARY}\n${changed(5, "100000002", DEPENDENT)}`).some(issue => /share the primary/.test(issue.message))).toBe(true);
    expect(validatePipeEligibility(DEPENDENT).some(issue => /follow its primary/.test(issue.message))).toBe(true);
  });

  test("allows historical mid-month activations in exports without weakening new intake", () => {
    const row = changed(19, "11152026");
    expect(validatePipeEligibility(row).some(issue => issue.field === "effectiveDate")).toBe(true);
    expect(validatePipeEligibility(row, { requireFirstOfMonth: false })).toEqual([]);
  });

  test("requires primary email for intake/e-fulfillment but allows dependents without it", () => {
    expect(validatePipeEligibility(changed(25, "")).some(issue => issue.field === "email")).toBe(true);
    expect(validatePipeEligibility(changed(25, ""), { requireEmail: false })).toEqual([]);
    expect(validatePipeEligibility(`${PRIMARY}\n${DEPENDENT}`)).toEqual([]);
  });
});
