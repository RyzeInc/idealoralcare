#!/usr/bin/env node
/** Sync saved Stripe Prices with the production Convex catalog. Dry run by default. */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import Stripe from "stripe";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n")
    .filter((line) => /^[A-Z_]+=/.test(line))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    })
);
const apply = process.argv.includes("--apply");
const check = process.argv.includes("--check");
const stripe = new Stripe(env.STRIPE_LIVE_SECRET_KEY);
const products = JSON.parse(execFileSync("npx", ["convex", "run", "--prod", "catalog/queries:list", "{}"], { encoding: "utf8" }));
const variants = [
  ["monthlyCard", "month"],
  ["monthlyACH", "month"],
  ["annualCard", "year"],
  ["annualACH", "year"],
];

async function main() {
  let created = 0;
  let defaultsSet = 0;
  let missing = 0;
  let wrongDefaults = 0;
  for (const item of products) {
    if (!item.isVisible) continue;
    const expected = new Map();
    for (const [variant, interval] of variants) {
      const productId = item.stripeProducts?.[`${variant}Id`];
      const amount = item.pricing?.[`${variant}Cents`];
      if (!productId || !Number.isInteger(amount) || amount <= 0) {
        throw new Error(`${item.slug}: ${variant} lacks a product or valid catalog amount`);
      }
      expected.set(`${productId}:${interval}:${amount}`, { productId, interval, amount, variant });
    }

    const byProduct = new Map();
    for (const spec of expected.values()) {
      if (byProduct.has(spec.productId)) continue;
      const product = await stripe.products.retrieve(spec.productId);
      if (!product.active) throw new Error(`${item.slug}: Stripe product ${product.id} is inactive`);
      const prices = await stripe.prices.list({ product: spec.productId, active: true, limit: 100 });
      if (prices.has_more) throw new Error(`${item.slug}: more than 100 active prices; inspect manually`);
      byProduct.set(spec.productId, { product, prices: prices.data });
    }

    for (const spec of expected.values()) {
      const entry = byProduct.get(spec.productId);
      let price = entry.prices.find((candidate) =>
        candidate.currency === "usd" && candidate.unit_amount === spec.amount &&
        candidate.recurring?.interval === spec.interval && candidate.recurring?.interval_count === 1 &&
        candidate.billing_scheme === "per_unit"
      );
      if (!price && apply) {
        price = await stripe.prices.create({
          product: spec.productId,
          currency: "usd",
          unit_amount: spec.amount,
          recurring: { interval: spec.interval, interval_count: 1 },
          nickname: `${item.slug} ${spec.interval} ${spec.amount}c`,
          metadata: { catalog_slug: item.slug },
        }, { idempotencyKey: `catalog-${spec.productId}-${spec.interval}-${spec.amount}` });
        entry.prices.push(price);
        created++;
      }
      if (!price) missing++;
      console.log(`${item.slug} ${spec.variant}: ${price?.id || (apply ? "MISSING" : "WOULD CREATE")} (${spec.amount}c/${spec.interval})`);
    }

    for (const [productId, entry] of byProduct) {
      const preferred = variants
        .map(([variant, interval]) => ({ productId: item.stripeProducts?.[`${variant}Id`], interval, amount: item.pricing?.[`${variant}Cents`] }))
        .find((spec) => spec.productId === productId);
      const price = entry.prices.find((candidate) =>
        candidate.currency === "usd" && candidate.unit_amount === preferred.amount &&
        candidate.recurring?.interval === preferred.interval && candidate.recurring?.interval_count === 1
      );
      if (!price) continue;
      if (entry.product.default_price !== price.id) {
        wrongDefaults++;
        if (apply) {
          await stripe.products.update(productId, { default_price: price.id });
          defaultsSet++;
        }
        console.log(`${item.slug} ${productId}: ${apply ? "set" : "would set"} default ${price.id}`);
      }
    }
  }
  console.log(`${apply ? "Applied" : check ? "Checked" : "Dry run"}: ${created} prices created, ${defaultsSet} defaults set, ${missing} missing, ${apply ? 0 : wrongDefaults} defaults to update`);
  if (check && (missing || wrongDefaults)) process.exitCode = 1;
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
