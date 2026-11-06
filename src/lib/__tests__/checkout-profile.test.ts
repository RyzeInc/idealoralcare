import { expect, test } from "vitest";
import { normalizeCheckoutProfile } from "../checkout-profile";
const profile = {
  firstName: " Pat ",
  lastName: "Member",
  dateOfBirth: "01/15/1990",
  phone: "(614) 555-0100",
  address: {
    line1: "123 Main St",
    city: "Columbus",
    state: "oh",
    postalCode: "43215",
  },
};
test("normalizes confirmed intake for agreements and member provisioning", () => {
  expect(normalizeCheckoutProfile(profile)).toMatchObject({
    firstName: "Pat",
    dateOfBirth: "1990-01-15",
    phone: "+16145550100",
    address: { state: "OH", country: "US" },
  });
});
test.each(["02/30/1990", "2025-02-29", "2999-01-01", "01/01", "1899-12-31"])(
  "rejects invalid dates such as %s",
  (dateOfBirth) => {
    expect(normalizeCheckoutProfile({ ...profile, dateOfBirth })).toBeNull();
  },
);
test("requires usable census details for existing accounts too", () => {
  expect(normalizeCheckoutProfile({ ...profile, lastName: "" })).toBeNull();
  expect(
    normalizeCheckoutProfile({
      ...profile,
      address: { ...profile.address, state: "ZZ" },
    }),
  ).toBeNull();
  expect(normalizeCheckoutProfile({ ...profile, phone: "614" })).toBeNull();
});
