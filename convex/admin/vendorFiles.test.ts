/**
 * Vendor file row-format parity tests.
 *
 * The aggregated Dental Discount Network file is produced by concatenating
 * the per-organization outputs and post-processing each row through
 * `replaceGroupCodeWithProviderCode`. This test asserts that swap behaves
 * exactly as expected so per-org and aggregated outputs stay byte-identical
 * outside of column 18 (1-indexed) — the group-code column.
 */
import { describe, it, expect } from "vitest";
import { __testOnly_replaceGroupCodeWithProviderCode } from "./vendorFiles";
import { PROVIDER_GROUP_CODE } from "../lib/constants";

const sampleRow =
  // 18 columns (0..17), per Careington Electronic Eligibility spec CI007
  [
    "0000000001",   // 0  Unique ID
    "00",            // 1  Sequence
    "1",             // 2  Guardian
    "MO",            // 3  Coverage
    "ACTIVE",        // 4  Status
    "01012025",      // 5  Effective Date
    "Doe",           // 6  Last Name
    "John",          // 7  First Name
    "",              // 8  Middle
    "",              // 9  Suffix
    "M",             // 10 Gender
    "01011980",      // 11 DOB
    "123 Main St",   // 12 Address
    "Apt 4",         // 13 Address 2
    "Springfield",   // 14 City
    "IL",            // 15 State
    "62701",         // 16 Zip
    "ACME-0042",     // 17 Group Code (per-org value)
  ].join("|");

describe("replaceGroupCodeWithProviderCode", () => {
  it("swaps only column 18 (group code)", () => {
    const out = __testOnly_replaceGroupCodeWithProviderCode(sampleRow);
    const inFields = sampleRow.split("|");
    const outFields = out.split("|");

    // All other columns unchanged
    for (let i = 0; i < 17; i++) {
      expect(outFields[i]).toBe(inFields[i]);
    }
    // Column 18 (index 17) is replaced with the canonical provider code
    expect(outFields[17]).toBe(PROVIDER_GROUP_CODE);
    // No extra/fewer columns introduced
    expect(outFields).toHaveLength(inFields.length);
  });

  it("returns a row with PROVIDER_GROUP_CODE regardless of input value", () => {
    const variants = ["IDC-0001", "ACME-9999", "XYZ", ""];
    for (const code of variants) {
      const fields = sampleRow.split("|");
      fields[17] = code;
      const out = __testOnly_replaceGroupCodeWithProviderCode(fields.join("|"));
      expect(out.split("|")[17]).toBe(PROVIDER_GROUP_CODE);
    }
  });

  it("leaves rows with fewer than 18 columns unchanged", () => {
    const short = "abc|def|ghi";
    expect(__testOnly_replaceGroupCodeWithProviderCode(short)).toBe(short);
  });
});
