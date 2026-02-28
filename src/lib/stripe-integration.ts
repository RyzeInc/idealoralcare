/**
 * STRIPE INTEGRATION BRIDGE
 *
 * Narrow interface to Stripe for the subscription system.
 * Stripe's responsibilities:
 * - Collect payment
 * - Create subscription
 * - Generate invoices
 * - Emit webhooks
 *
 * Stripe does NOT:
 * - Define plans
 * - Determine access
 * - Control lifecycle meaning
 */

export interface StripeCheckoutConfig {
  /**
   * Minimal Stripe session config
   * Most payment logic lives in your backend
   */
  customerId: string;
  lineItems: Array<{
    priceId: string;
    quantity: number;
  }>;
  mode: "subscription" | "payment";
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export interface StripeSubscriptionConfig {
  /**
   * What we send to Stripe when creating a subscription
   */
  customerId: string;
  items: Array<{
    priceId: string;
    quantity: number;
  }>;
  billing_cycle_anchor?: number; // Unix timestamp for alignment
  metadata: {
    bundleId: string;
    cadence: "monthly" | "annual";
    paymentMethod: "card" | "ach";
  };
}

export interface StripeWebhookPayload {
  /**
   * Structure of webhook events we care about
   */
  id: string; // Event ID
  type: string; // e.g., "payment_intent.succeeded"
  data: {
    object: {
      id: string;
      object: string;
      customer: string;
      [key: string]: any;
    };
  };
  created: number;
}

export interface StripePaymentIntentData {
  id: string; // Payment intent ID
  customer: string; // Stripe customer ID
  amount: number; // Amount in cents
  status: "succeeded" | "processing" | "requires_payment_method" | "requires_action" | "requires_confirmation";
  metadata: {
    bundleId?: string;
    customerId?: string;
  };
}

/**
 * Validation: Ensure webhook came from Stripe
 */
export function validateStripeSignature(
  payload: string,
  signature: string,
  webhookSecret: string
): boolean {
  // This should be done server-side using Stripe's SDK
  // For type reference only
  return true;
}

/**
 * Mapping: Convert Stripe subscription to our bundle concept
 */
export function mapStripeSubscriptionToBundle(stripeSubscription: any) {
  return {
    stripeSubscriptionId: stripeSubscription.id,
    stripeCustomerId: stripeSubscription.customer,
    status: mapStripeStatus(stripeSubscription.status),
    currentPeriodStart: stripeSubscription.current_period_start * 1000, // Convert to ms
    currentPeriodEnd: stripeSubscription.current_period_end * 1000,
    metadata: stripeSubscription.metadata,
  };
}

function mapStripeStatus(
  status: string
): "active" | "cancel_at_period_end" | "cancelled" | "suspended" | "payment_failed" {
  switch (status) {
    case "active":
      return "active";
    case "past_due":
      return "payment_failed";
    case "unpaid":
      return "suspended";
    case "canceled":
      return "cancelled";
    default:
      return "active";
  }
}

/**
 * Mapping: Convert our entitlements to Stripe subscription items
 */
export function mapEntitlementToStripeItem(
  entitlement: any,
  priceId: string,
  bundleId: string
) {
  return {
    priceId,
    metadata: {
      entitlementId: entitlement._id,
      bundleId,
      productId: entitlement.productId,
    },
    billing_cycle_anchor: entitlement.periodStart / 1000, // Convert to Unix seconds
  };
}

/**
 * Helper: Get payment method from Stripe
 */
export function mapStripePaymentMethod(
  source: any
): "card" | "ach" | "unknown" {
  if (!source) return "unknown";

  if (source.object === "card") return "card";
  if (source.object === "bank_account") return "ach";

  return "unknown";
}
