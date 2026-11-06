import { expect, test } from "vitest";
import { checkoutReturnUrls } from "../checkout-urls";
test.each([
  "https://www.assurevantage.com/api/stripe/checkout",
  "https://assurevantage.com/api/stripe/checkout",
  "https://www.getidealoh.com/api/stripe/checkout",
])(
  "keeps secure AssureVantage checkout and receipt on the shared auth host from %s",
  (request) => {
    const urls = checkoutReturnUrls(
      request,
      "https://www.getidealoh.com",
      "assurevantage",
    );
    expect(urls.success).toBe(
      "https://www.getidealoh.com/assurevantage/program-success?session_id={CHECKOUT_SESSION_ID}",
    );
    expect(urls.cancel).toBe(
      "https://www.getidealoh.com/assurevantage/program-checkout",
    );
  },
);
test("local payment tests return to their own local checkout", () => {
  expect(
    checkoutReturnUrls(
      "http://localhost:3000/api/stripe/checkout",
      "https://www.getidealoh.com",
      "assurevantage",
    ).cancel,
  ).toBe("http://localhost:3000/assurevantage/program-checkout");
});
test("legacy and tenant enrollments retain their own route namespace", () => {
  expect(
    checkoutReturnUrls(
      "https://www.getidealoh.com/api/stripe/checkout",
      "https://www.getidealoh.com",
    ).cancel,
  ).toBe("https://www.getidealoh.com/health/checkout");
  expect(
    checkoutReturnUrls(
      "https://www.getidealoh.com/api/stripe/checkout",
      "https://www.getidealoh.com",
      "newideal",
    ).success,
  ).toContain("/newideal/success?");
  expect(
    checkoutReturnUrls(
      "https://www.getidealoh.com/api/stripe/checkout",
      "https://www.getidealoh.com",
      "flourishxv",
    ).success,
  ).toContain("/flourishxv/dashboard?");
});
