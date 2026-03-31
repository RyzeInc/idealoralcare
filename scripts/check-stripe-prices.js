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
  // Retrieve the specific price from the active subscription
  try {
    const price = await stripe.prices.retrieve("price_1TGwMW0FY7ibitHR61QuBNKJ");
    console.log("Current subscription price:");
    console.log("  id:", price.id);
    console.log("  product:", price.product);
    console.log("  amount:", price.unit_amount, "cents");
    console.log("  interval:", price.recurring ? price.recurring.interval : "none");
    console.log("  active:", price.active);
    console.log("  type:", price.type);
  } catch (e) {
    console.log("Price retrieve error:", e.message);
  }

  // Now check: what prices exist on the individual monthlyCard product (the upgrade target)?
  // This is what the change-plan route would look for
  const individualMonthlyCardId = "prod_UFQwP7oLE6LaoU";
  const individualAnnualCardId = "prod_UFQwd4VoI2ElkY";
  
  console.log("\n--- Prices on individual-monthlyCard product ---");
  const p1 = await stripe.prices.list({ product: individualMonthlyCardId, limit: 10 });
  console.log("Count:", p1.data.length);
  p1.data.forEach(p => console.log("  ", p.id, p.unit_amount + "c", p.active));

  console.log("\n--- Prices on individual-annualCard product ---");
  const p2 = await stripe.prices.list({ product: individualAnnualCardId, limit: 10 });
  console.log("Count:", p2.data.length);
  p2.data.forEach(p => console.log("  ", p.id, p.unit_amount + "c", p.active));

  // Check prices on the family products too
  const familyMonthlyCardId = "prod_UFQwdJtmYz0LdJ";
  const familyAnnualCardId = "prod_UFQwRYiwNrGLIf";
  
  console.log("\n--- Prices on family-monthlyCard product ---");
  const p3 = await stripe.prices.list({ product: familyMonthlyCardId, limit: 10 });
  console.log("Count:", p3.data.length);
  p3.data.forEach(p => console.log("  ", p.id, p.unit_amount + "c", p.active));

  console.log("\n--- Prices on family-annualCard product ---");
  const p4 = await stripe.prices.list({ product: familyAnnualCardId, limit: 10 });
  console.log("Count:", p4.data.length);
  p4.data.forEach(p => console.log("  ", p.id, p.unit_amount + "c", p.active));
}

main().catch((e) => { console.error(e.message); process.exit(1); });
