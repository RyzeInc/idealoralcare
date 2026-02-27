/**
 * PRICING CALCULATOR
 *
 * Deterministic price calculation based on catalog + cadence + payment method.
 * Used in:
 * - Cart preview
 * - Checkout review
 * - Invoices & receipts
 *
 * Design principle: Single source of truth for all pricing logic.
 * No surprises at checkout.
 */

import {
  CatalogProduct,
  Cadence,
  PaymentMethod,
  getProductPrice,
} from "@/types/health-plans";

export interface CartItem {
  productId: string;
  product: CatalogProduct;
  quantity: number;
}

export interface PricingCalculation {
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
  }>;
  subtotalCents: number;
  discountCents: number; // ACH discount
  totalCents: number;
  achSavings?: {
    monthlyCardCents: number;
    achCents: number;
    monthlySavingsCents: number;
  };
  cadence: Cadence;
  paymentMethod: PaymentMethod;
  calculatedAt: number;
}

/**
 * Calculate total price for a cart
 * 
 * Design: Card pricing is the baseline. ACH applies a discount.
 */
export function calculateCartPrice(
  items: CartItem[],
  cadence: Cadence,
  paymentMethod: PaymentMethod
): PricingCalculation {
  // Line items are calculated at the selected payment method price
  const itemBreakdown = items.map((item) => {
    const unitPrice = getProductPrice(item.product, cadence, paymentMethod);
    const lineTotal = unitPrice * item.quantity;

    return {
      productId: item.productId,
      productName: item.product.name,
      quantity: item.quantity,
      unitPriceCents: unitPrice,
      lineTotalCents: lineTotal,
    };
  });

  // Subtotal is ALWAYS based on card pricing (the base price)
  const subtotalCents = items.reduce((sum, item) => {
    const cardPrice = getProductPrice(item.product, cadence, "card");
    return sum + cardPrice * item.quantity;
  }, 0);

  // Calculate ACH discount (if applicable)
  let discountCents = 0;
  if (paymentMethod === "ach") {
    discountCents = items.reduce((sum, item) => {
      const cardPrice = getProductPrice(item.product, cadence, "card");
      const achPrice = getProductPrice(item.product, cadence, "ach");
      return sum + (cardPrice - achPrice) * item.quantity;
    }, 0);
  }

  const totalCents = subtotalCents - discountCents;

  return {
    items: itemBreakdown,
    subtotalCents,
    discountCents,
    totalCents,
    cadence,
    paymentMethod,
    calculatedAt: Date.now(),
  };
}

/**
 * Format cents as USD string for display
 */
export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Calculate monthly equivalent for annual pricing display
 */
export function getMonthlyEquivalent(annualCents: number): number {
  return Math.round(annualCents / 12);
}

/**
 * Comparison display: show savings for annual vs monthly
 */
export function calculateAnnualSavings(
  monthlyCents: number,
  annualCents: number
): {
  monthlyTotalForYear: number;
  annualTotal: number;
  savingsCents: number;
  savingsPercent: number;
} {
  const monthlyTotalForYear = monthlyCents * 12;
  const savingsCents = monthlyTotalForYear - annualCents;
  const savingsPercent = Math.round((savingsCents / monthlyTotalForYear) * 100);

  return {
    monthlyTotalForYear,
    annualTotal: annualCents,
    savingsCents,
    savingsPercent,
  };
}
