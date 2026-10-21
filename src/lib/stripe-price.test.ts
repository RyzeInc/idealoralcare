import { describe, expect, test } from "vitest";
import { getCatalogStripePrice } from "./stripe-price";
import type Stripe from "stripe";

function stripeWithPrices(prices: object[]) {
  return {
    prices: {
      list: () => ({
        async *[Symbol.asyncIterator]() {
          for (const price of prices) yield price;
        },
      }),
    },
  } as unknown as Stripe;
}

describe("getCatalogStripePrice", () => {
  test("selects the saved Price with the displayed amount and cadence", async () => {
    const stripe = stripeWithPrices([
      { id: "old", currency: "usd", unit_amount: 14999, recurring: { interval: "year", interval_count: 1 }, billing_scheme: "per_unit" },
      { id: "current", currency: "usd", unit_amount: 16499, recurring: { interval: "year", interval_count: 1 }, billing_scheme: "per_unit" },
    ]);
    await expect(getCatalogStripePrice(stripe, "prod_test", 16499, "annual")).resolves.toBe("current");
  });

  test("rejects a product without a matching saved Price", async () => {
    const stripe = stripeWithPrices([]);
    await expect(getCatalogStripePrice(stripe, "prod_test", 1995, "monthly")).rejects.toThrow("No saved Stripe Price");
  });
});
