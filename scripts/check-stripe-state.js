#!/usr/bin/env node
const fs = require("fs"), path = require("path"), Stripe = require("stripe");
const env = {};
fs.readFileSync(path.join(__dirname, "../.env.local"), "utf8").split("\n").forEach((l) => {
  const t = l.trim();
  if (t.length === 0 || t.charAt(0) === "#") return;
  const i = t.indexOf("=");
  if (i === -1) return;
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
});
const stripe = new Stripe(env.STRIPE_SECRET_KEY);

async function main() {
  // List ALL prices (checkout creates ad-hoc prices)
  const allPrices = await stripe.prices.list({ limit: 100 });
  console.log("Total prices in account:", allPrices.data.length);
  console.log("");

  for (const p of allPrices.data) {
    const prod = typeof p.product === "string" ? p.product : p.product.id;
    console.log(
      `${p.active ? "ACTIVE" : "inactive"} | ${p.id} | product=${prod} | ${p.unit_amount}c | ${p.recurring ? p.recurring.interval : "onetime"} | created=${new Date(p.created * 1000).toISOString().slice(0, 10)}`
    );
  }

  // Also check subscriptions to see what's in flight
  console.log("\n--- Active Subscriptions ---");
  const subs = await stripe.subscriptions.list({ status: "active", limit: 10 });
  console.log("Active subscriptions:", subs.data.length);
  for (const s of subs.data) {
    console.log(`  ${s.id} | customer=${s.customer} | status=${s.status}`);
    for (const item of s.items.data) {
      console.log(`    item=${item.id} | price=${item.price.id} | product=${item.price.product} | ${item.price.unit_amount}c/${item.price.recurring ? item.price.recurring.interval : "?"}`);
    }
    if (s.schedule) {
      console.log(`    schedule=${s.schedule}`);
    }
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
