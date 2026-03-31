#!/usr/bin/env node
/**
 * scripts/setup-test-stripe.js
 *
 * Creates the required Stripe TEST MODE products and seeds the Convex dev
 * catalog with their IDs. Run this once when setting up local dev.
 *
 * Prerequisites:
 *   - .env.local must have STRIPE_SECRET_KEY=sk_test_... (test mode key)
 *   - Convex dev deployment must be running (CONVEX_DEPLOYMENT set in .env.local)
 *   - npx convex CLI must be available
 *
 * Usage:
 *   node scripts/setup-test-stripe.js
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// ── Load .env.local ──────────────────────────────────────────────────────────
const envPath = path.join(__dirname, "../.env.local");
if (!fs.existsSync(envPath)) {
  console.error("❌ .env.local not found");
  process.exit(1);
}

const env = {};
fs.readFileSync(envPath, "utf8")
  .split("\n")
  .forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const idx = trimmed.indexOf("=");
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    env[key] = val;
  });

const STRIPE_SECRET_KEY = env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  console.error("❌ STRIPE_SECRET_KEY not found in .env.local");
  process.exit(1);
}
if (!STRIPE_SECRET_KEY.startsWith("sk_test_")) {
  console.error(
    "❌ STRIPE_SECRET_KEY must be a TEST key (sk_test_...). Live keys are not allowed for this script."
  );
  process.exit(1);
}

// ── Load Stripe ───────────────────────────────────────────────────────────────
const Stripe = require("stripe");
const stripe = new Stripe(STRIPE_SECRET_KEY);

// ── Plan definitions (must match convex/catalog/mutations.ts) ─────────────────
const PLANS = [
  {
    slug: "oral-health-individual",
    name: "Ideal Oral Health Plan",
    pricing: {
      monthlyCardCents: 1499,
      monthlyACHCents: 1499,
      annualCardCents: 16499,
      annualACHCents: 16499,
    },
    variants: [
      { key: "monthlyCard", label: "Monthly (Card)", interval: "month", cents: 1499 },
      { key: "monthlyACH",  label: "Monthly (ACH)",  interval: "month", cents: 1499 },
      { key: "annualCard",  label: "Annual (Card)",  interval: "year",  cents: 16499 },
      { key: "annualACH",   label: "Annual (ACH)",   interval: "year",  cents: 16499 },
    ],
  },
  {
    slug: "oral-health-family",
    name: "Ideal Oral Health Plan — Family",
    pricing: {
      monthlyCardCents: 2499,
      monthlyACHCents: 2499,
      annualCardCents: 27499,
      annualACHCents: 27499,
    },
    variants: [
      { key: "monthlyCard", label: "Monthly (Card)", interval: "month", cents: 2499 },
      { key: "monthlyACH",  label: "Monthly (ACH)",  interval: "month", cents: 2499 },
      { key: "annualCard",  label: "Annual (Card)",  interval: "year",  cents: 27499 },
      { key: "annualACH",   label: "Annual (ACH)",   interval: "year",  cents: 27499 },
    ],
  },
];

async function getOrCreateProduct(slug, variantKey, variantLabel, planName) {
  const metadataKey = `idealhealth_test_${slug}_${variantKey}`;

  // Check if it already exists via metadata search
  const existing = await stripe.products.search({
    query: `metadata["idealhealth_slug"]:"${slug}" AND metadata["idealhealth_variant"]:"${variantKey}"`,
    limit: 1,
  });

  if (existing.data.length > 0) {
    console.log(`  ✓ Product already exists: ${existing.data[0].id} (${variantLabel})`);
    return existing.data[0].id;
  }

  const product = await stripe.products.create({
    name: `${planName} — ${variantLabel} [TEST]`,
    metadata: {
      idealhealth_slug: slug,
      idealhealth_variant: variantKey,
      environment: "test",
    },
  });

  console.log(`  ✓ Created product: ${product.id} (${variantLabel})`);
  return product.id;
}

async function main() {
  console.log("🔧 Setting up Stripe TEST products for Ideal Health...\n");

  const results = {};

  for (const plan of PLANS) {
    console.log(`📦 ${plan.name}`);

    const stripeProducts = {};

    for (const variant of plan.variants) {
      const productId = await getOrCreateProduct(
        plan.slug,
        variant.key,
        variant.label,
        plan.name
      );
      stripeProducts[`${variant.key}Id`] = productId;
    }

    results[plan.slug] = stripeProducts;
    console.log();
  }

  // ── Update Convex dev catalog ─────────────────────────────────────────────
  console.log("📡 Updating Convex dev catalog with test Stripe product IDs...\n");

  for (const plan of PLANS) {
    const ids = results[plan.slug];
    const argsJson = JSON.stringify({
      slug: plan.slug,
      stripeProducts: ids,
    });

    try {
      const output = execSync(
        `npx convex run admin/devTools:setTestStripeIds '${argsJson}'`,
        {
          cwd: path.join(__dirname, ".."),
          encoding: "utf8",
          env: { ...process.env, ...env },
        }
      );
      console.log(`  ✓ Updated catalog: ${plan.slug}`);
    } catch (err) {
      const msg = err.stderr || err.message || String(err);
      if (msg.includes("Catalog product not found")) {
        console.warn(`  ⚠ Catalog product "${plan.slug}" not found in Convex.`);
        console.warn(`    Run 'npx convex run admin/devTools:seedCatalog' first, then re-run this script.`);
      } else {
        console.error(`  ❌ Failed to update ${plan.slug}:\n  ${msg.trim()}`);
      }
    }
  }

  console.log("\n✅ Done! Stripe test products are wired to the Convex dev catalog.");
  console.log("\n─────────────────────────────────────────────────────────────────");
  console.log("📌 Next step — start the local webhook relay (keep it running):");
  console.log("   npm run webhook");
  console.log("\n   Copy the 'whsec_...' secret it prints and set it in .env.local:");
  console.log("   STRIPE_WEBHOOK_SECRET=whsec_...");
  console.log("─────────────────────────────────────────────────────────────────\n");
}

main().catch((err) => {
  console.error("❌ Script failed:", err.message);
  process.exit(1);
});
