import type { MutationCtx } from "../_generated/server";
import { BFL_MONTHLY_CENTS, BFL_SLUG } from "./productSlugs";

/** Balance for Life sold on its own — the behavioral-health piece of Essentials. */
const BFL_INCLUSIONS = [
  "Zenn — an AI wellness companion in the Balance for Life app, 24/7 in 70 languages",
  "Up to 10 sessions with a licensed counselor per life event — video, phone, or in person",
  "Live support answered by a counselor, 24/7",
  "Life, work-life and wellness coaching, plus the Aware Mindfulness program",
  "Preferred provider network for inpatient and outpatient care (at additional self-pay cost or through your insurance)",
];

export function balanceForLifeProduct(now: number, order: number) {
  return {
    slug: BFL_SLUG,
    name: "Balance for Life — Individual",
    category: "newideal",
    description: "Balance for Life member support program on its own: counseling, 24/7 live support, coaching and the BFL app.",
    inclusions: BFL_INCLUSIONS,
    exclusions: ["Not insurance", "Not a substitute for major medical or behavioral health coverage"],
    eligibilityRules: {
      requiresVerification: false,
      disclosureText:
        "This is a membership program and is NOT insurance. Preferred Provider Network services are at additional self-pay cost or through your own insurance.",
    },
    activationBehavior: "immediate" as const,
    pricing: {
      monthlyCardCents: BFL_MONTHLY_CENTS,
      monthlyACHCents: BFL_MONTHLY_CENTS,
      annualCardCents: BFL_MONTHLY_CENTS * 12,
      annualACHCents: BFL_MONTHLY_CENTS * 12,
    },
    metadata: { icon: "Brain", bestFor: ["Individual"], color: "pink" },
    isVisible: true,
    isFeatured: false,
    order,
    createdAt: now,
    updatedAt: now,
  };
}

/** Creates only the missing BFL product; existing catalog settings stay intact. */
export async function ensureBalanceForLifeProduct(ctx: MutationCtx, stripeProductId?: string) {
  let product = await ctx.db.query("catalogProducts")
    .withIndex("by_slug", q => q.eq("slug", BFL_SLUG))
    .unique();
  if (!product) {
    if (!stripeProductId || !/^prod_[a-zA-Z0-9]+$/.test(stripeProductId)) {
      throw new Error("Balance for Life is missing from the catalog. Supply bflStripeProductId with a Stripe product from this deployment's payment environment.");
    }
    const id = await ctx.db.insert("catalogProducts", {
      ...balanceForLifeProduct(Date.now(), 106),
      stripeProducts: {
        monthlyCardId: stripeProductId,
        monthlyACHId: stripeProductId,
        annualCardId: stripeProductId,
        annualACHId: stripeProductId,
      },
    });
    product = await ctx.db.get(id);
  }
  if (!product?.isVisible) {
    throw new Error("Balance for Life is hidden in the catalog. Review its visibility before configuring AssureVantage.");
  }
  if (!product.stripeProducts?.monthlyCardId || !product.stripeProducts?.monthlyACHId ||
      product.pricing.monthlyCardCents <= 0 || product.pricing.monthlyACHCents <= 0) {
    throw new Error("Balance for Life needs monthly card and ACH pricing and Stripe product mappings before configuring AssureVantage.");
  }
  return product._id;
}
