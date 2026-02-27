/**
 * TYPES & INTERFACES
 *
 * Shared TypeScript types for the health plans system.
 * These are the source of truth for data shape across components.
 */

// CADENCE: The billing schedule
export type Cadence = "monthly" | "annual";

// PAYMENT METHOD: How the customer pays
export type PaymentMethod = "card" | "ach";

// CATALOG PRODUCT: A plan/offering
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
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
  updatedBy?: string;
}

// Helper to get price for a product based on cadence + payment method
export function getProductPrice(
  product: CatalogProduct,
  cadence: Cadence,
  paymentMethod: PaymentMethod
): number {
  if (cadence === "monthly") {
    return paymentMethod === "card"
      ? product.pricing.monthlyCardCents
      : product.pricing.monthlyACHCents;
  } else {
    return paymentMethod === "card"
      ? product.pricing.annualCardCents
      : product.pricing.annualACHCents;
  }
}

// Helper to calculate ACH discount
export function calculateACHDiscount(
  product: CatalogProduct,
  cadence: Cadence
): number {
  if (cadence === "monthly") {
    return product.pricing.monthlyCardCents - product.pricing.monthlyACHCents;
  } else {
    return product.pricing.annualCardCents - product.pricing.annualACHCents;
  }
}

// SUBSCRIPTION BUNDLE: Billing context
export interface SubscriptionBundle {
  _id: string;
  customerId: string;
  cadence: Cadence;
  paymentMethod: PaymentMethod;
  stripeCustomerId: string;
  stripeSubscriptionId?: string;
  stripeInvoiceId?: string;
  status:
    | "draft"
    | "active"
    | "cancel_at_period_end"
    | "cancelled"
    | "payment_failed"
    | "suspended";
  currentPeriodStart: number;
  currentPeriodEnd: number;
  pricingSnapshot: {
    cadence: Cadence;
    paymentMethod: PaymentMethod;
    totalCents: number;
    planCount: number;
    capturedAt: number;
  };
  createdAt: number;
  activatedAt?: number;
  updatedAt: number;
  cancelledAt?: number;
}

// ENTITLEMENT: Access record
export interface Entitlement {
  _id: string;
  customerId: string;
  bundleId: string;
  productId: string;
  periodStart: number;
  periodEnd: number;
  status: "active" | "cancel_at_period_end" | "expired" | "suspended" | "revoked";
  endCondition: "renew" | "expire" | "unknown";
  stripeSubscriptionItemId?: string;
  createdAt: number;
  activatedAt?: number;
  expiresAt: number;
  suspendedAt?: number;
  revokedAt?: number;
  createdVia: "initial_purchase" | "plan_addition" | "reactivation" | "admin_action";
  notes?: string;
}

// EVENT: Immutable fact record
export interface SystemEvent {
  _id: string;
  eventType: string;
  actor: "system" | "stripe" | "user" | "admin";
  customerId?: string;
  bundleId?: string;
  productId?: string;
  entitlementId?: string;
  stripeEventId?: string;
  stripeObjectId?: string;
  payload?: Record<string, any>;
  success: boolean;
  errorMessage?: string;
  createdAt: number;
  processedAt?: number;
  idempotencyKey?: string;
}

// CART SESSION: Temporary shopping context
export interface CartSession {
  _id: string;
  sessionId: string;
  customerId?: string;
  cadence: Cadence;
  paymentMethod?: PaymentMethod;
  items: Array<{
    productId: string;
    quantity: number;
    addedAt: number;
  }>;
  pricingPreview?: {
    cadence: Cadence;
    paymentMethod: PaymentMethod;
    totalCents: number;
    breakdown?: Array<{
      productId: string;
      priceCents: number;
    }>;
    calculatedAt: number;
  };
  status: "active" | "checked_out" | "abandoned" | "error";
  createdAt: number;
  lastActivityAt: number;
  checkoutInitiatedAt?: number;
  completedAt?: number;
  finalBundleId?: string;
}

// CHECKOUT REQUEST: What the frontend sends to checkout
export interface CheckoutRequest {
  sessionId: string;
  customerId: string;
  cadence: Cadence;
  paymentMethod: PaymentMethod;
  cartItems: Array<{
    productId: string;
    quantity: number;
  }>;
  idempotencyKey: string;
}

// CHECKOUT RESPONSE: What we return
export interface CheckoutResponse {
  success: boolean;
  bundleId?: string;
  stripeCheckoutUrl?: string;
  error?: string;
}

// CUSTOMER DASHBOARD: What member sees
export interface CustomerDashboard {
  customerId: string;
  bundle: SubscriptionBundle | null;
  activeEntitlements: Entitlement[];
  cancellationScheduledEntitlements: Entitlement[];
  nextRenewalDate: number;
  upcomingChargeAmount: number;
  paymentMethod: PaymentMethod;
}

// PLAN FOR DISPLAY: Combined product + entitlement info
export interface DisplayPlan {
  product: CatalogProduct;
  entitlement?: Entitlement;
  status: "active" | "cancels_at_period_end" | "not_owned";
  cancelledAt?: number;
}
