/**
 * NEXUS HEALTH PLANS - Type Definitions
 * 
 * Defines the core data structures for:
 * - Catalog products
 * - Cart state
 * - Cadence/payment method selections
 * - Checkout flow
 */

export type Cadence = "monthly" | "annual";
export type PaymentMethod = "card" | "ach";

export interface CatalogProduct {
  _id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  longDescription?: string;
  inclusions: string[];
  exclusions: string[];
  eligibilityRules: {
    minAge?: number;
    maxAge?: number;
    requiresVerification: boolean;
    disclosureText: string;
  };
  activationBehavior: "immediate" | "next_renewal" | "verified_then_immediate";
  pricing: {
    monthlyCardCents: number;
    monthlyACHCents: number;
    annualCardCents: number;
    annualACHCents: number;
  };
  metadata?: {
    icon?: string;
    color?: string;
    bestFor?: string[];
    recommendedAddOns?: string[];
  };
  isVisible: boolean;
  isFeatured: boolean;
  order: number;
}

export interface CartItem {
  productId: string;
  product: CatalogProduct;
  addedAt: number;
}

export interface CartState {
  items: CartItem[];
  cadence: Cadence;
  paymentMethod: PaymentMethod;
  compareItems: string[]; // Product IDs for comparison
}

// Calculate price based on cadence and payment method
export function getPrice(
  product: CatalogProduct,
  cadence: Cadence,
  paymentMethod: PaymentMethod
): number {
  const { pricing } = product;
  
  if (cadence === "monthly") {
    return paymentMethod === "ach" ? pricing.monthlyACHCents : pricing.monthlyCardCents;
  }
  return paymentMethod === "ach" ? pricing.annualACHCents : pricing.annualCardCents;
}

// Format cents as dollars
export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// Format price with period label
export function formatPriceWithPeriod(cents: number, cadence: Cadence): string {
  const period = cadence === "monthly" ? "/mo" : "/yr";
  return `${formatPrice(cents)}${period}`;
}

// Calculate monthly equivalent for annual pricing
export function getMonthlyEquivalent(annualCents: number): number {
  return Math.round(annualCents / 12);
}

// Calculate annual savings percentage
export function getAnnualSavingsPercent(
  monthlyPrice: number,
  annualPrice: number
): number {
  const monthlyAnnualized = monthlyPrice * 12;
  const savings = monthlyAnnualized - annualPrice;
  return Math.round((savings / monthlyAnnualized) * 100);
}

// Calculate ACH savings
export function getACHSavings(
  cardPrice: number,
  achPrice: number,
  cadence: Cadence
): number {
  const savings = cardPrice - achPrice;
  return cadence === "monthly" ? savings : Math.round(savings / 12);
}

// Category display info
export const CATEGORY_INFO: Record<string, { icon: string; color: string; label: string }> = {
  dental: { icon: "Tooth", color: "blue", label: "Oral Health" },
  wellness: { icon: "Leaf", color: "green", label: "Wellness" },
  vision: { icon: "Eye", color: "purple", label: "Vision" },
  telehealth: { icon: "Video", color: "cyan", label: "Telehealth" },
  chronic: { icon: "Activity", color: "red", label: "Chronic Care" },
  rx: { icon: "Pill", color: "amber", label: "Rx Savings" },
  coaching: { icon: "Users", color: "indigo", label: "Coaching" },
};

// "Best for" filter options
export const BEST_FOR_OPTIONS = [
  { value: "individuals", label: "Individuals" },
  { value: "families", label: "Families" },
  { value: "seniors", label: "Seniors" },
  { value: "fitness", label: "Fitness Enthusiasts" },
  { value: "chronic", label: "Chronic Conditions" },
];
