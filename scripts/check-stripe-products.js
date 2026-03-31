#!/usr/bin/env node
/**
 * Quick check: do the Stripe product IDs in the catalog actually exist in Stripe?
 */
const fs = require("fs");
const path = require("path");
const Stripe = require("stripe");

const envPath = path.join(__dirname, "../.env.local");
const env = {};
fs.readFileSync(envPath, "utf8").split("\n").forEach((line) => {
  const t = line.trim();
  if (!t || t.startsWith("#")) return;
  const i = t.indexOf("=");
  if (i === -1) return;
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
});

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

const products = {
  "individual-monthlyCard": "prod_UFQwP7oLE6LaoU",
  "individual-monthlyACH":  "prod_UFQwqleadCCmTv",
  "individual-annualCard":  "prod_UFQwd4VoI2ElkY",
  "individual-annualACH":   "prod_UFQwF02ytw1Glt",
  "family-monthlyCard":     "prod_UFQwdJtmYz0LdJ",
  "family-monthlyACH":      "prod_UFQwtsAdd0KSdj",
  "family-annualCard":      "prod_UFQwRYiwNrGLIf",
  "family-annualACH":       "prod_UFQwQO6SvWv55Z",
};

async function main() {
  console.log("Checking Stripe products...\n");
  for (const [label, id] of Object.entries(products)) {
    try {
      const p = await stripe.products.retrieve(id);
      const prices = await stripe.prices.list({ product: id, active: true, limit: 5 });
      const priceInfo = prices.data.map(pr => 
        `${pr.id} (${pr.unit_amount}c/${pr.recurring ? pr.recurring.interval : "one-time"})`
      ).join(", ");
      console.log(`✅ ${label}: ${p.name} [active=${p.active}]`);
      console.log(`   Prices: ${priceInfo || "NONE"}`);
    } catch (e) {
      console.log(`❌ ${label} (${id}): ${e.message}`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
