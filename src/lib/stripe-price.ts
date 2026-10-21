import type Stripe from "stripe";

/** Resolve a saved, active recurring Price for the amount shown in the catalog. */
export async function getCatalogStripePrice(
  stripe: Stripe,
  productId: string,
  amountCents: number,
  cadence: "monthly" | "annual"
): Promise<string> {
  const interval = cadence === "monthly" ? "month" : "year";
  for await (const price of stripe.prices.list({ product: productId, active: true, limit: 100 })) {
    if (
      price.currency === "usd" &&
      price.unit_amount === amountCents &&
      price.recurring?.interval === interval &&
      price.recurring?.interval_count === 1 &&
      price.billing_scheme === "per_unit"
    ) {
      return price.id;
    }
  }
  throw new Error(`No saved Stripe Price matches ${productId} at ${amountCents} cents per ${interval}`);
}
