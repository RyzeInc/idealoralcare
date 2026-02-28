/**
 * EVENT EMISSION & PROCESSING
 *
 * Centralized system for:
 * - Recording immutable events
 * - Ensuring idempotency
 * - Driving state transitions
 * - Enabling auditability
 *
 * Design principle: All state changes flow through events.
 * Events are the source of truth; database state is derived.
 */

import { SystemEvent } from "@/types/health-plans";

export class EventEmitter {
  constructor(private mutationFn?: (name: string, args: any) => Promise<any>) {}

  /**
   * Emit an event and record it in the ledger
   * Enforces idempotency via idempotencyKey
   */
  async emit(event: Omit<SystemEvent, "_id" | "createdAt">): Promise<SystemEvent> {
    try {
      if (!this.mutationFn) {
        console.warn("[EventEmitter] Mutation function not available, logging event only", event);
        return event as SystemEvent;
      }

      // Emit new event via mutation
      const result = await this.mutationFn("subscriptions.events.create", event);
      console.log(`[EventEmitter] Event emitted: ${event.eventType}`, {
        customerId: event.customerId,
        bundleId: event.bundleId,
      });

      return result;
    } catch (error) {
      console.error("[EventEmitter] Failed to emit event:", event, error);
      throw error;
    }
  }

  /**
   * Specific event emitters for common scenarios
   */

  async emitCheckoutInitiated(params: {
    customerId: string;
    sessionId: string;
    cartItems: Array<{ productId: string; quantity: number }>;
    cadence: "monthly" | "annual";
    paymentMethod: "card" | "ach";
  }) {
    return this.emit({
      eventType: "checkout.initiated",
      actor: "user",
      customerId: params.customerId,
      payload: {
        sessionId: params.sessionId,
        itemCount: params.cartItems.length,
        cadence: params.cadence,
        paymentMethod: params.paymentMethod,
      },
      success: true,
      idempotencyKey: `checkout-init-${params.sessionId}`,
    });
  }

  async emitPaymentSucceeded(params: {
    customerId: string;
    bundleId: string;
    stripePaymentIntentId: string;
    amountCents: number;
    cadence: "monthly" | "annual";
  }) {
    return this.emit({
      eventType: "payment.succeeded",
      actor: "stripe",
      customerId: params.customerId,
      bundleId: params.bundleId,
      stripeEventId: params.stripePaymentIntentId,
      payload: {
        amountCents: params.amountCents,
        cadence: params.cadence,
      },
      success: true,
      idempotencyKey: `payment-${params.stripePaymentIntentId}`,
    });
  }

  async emitPaymentFailed(params: {
    customerId?: string;
    bundleId?: string;
    stripePaymentIntentId: string;
    reason: string;
  }) {
    return this.emit({
      eventType: "payment.failed",
      actor: "stripe",
      customerId: params.customerId || "unknown",
      bundleId: params.bundleId,
      stripeEventId: params.stripePaymentIntentId,
      payload: {
        reason: params.reason,
      },
      success: false,
      errorMessage: params.reason,
      idempotencyKey: `payment-failed-${params.stripePaymentIntentId}`,
    });
  }

  async emitSubscriptionCreated(params: {
    customerId: string;
    bundleId: string;
    stripeSubscriptionId: string;
  }) {
    return this.emit({
      eventType: "subscription.created",
      actor: "stripe",
      customerId: params.customerId,
      bundleId: params.bundleId,
      stripeObjectId: params.stripeSubscriptionId,
      payload: {
        subscriptionId: params.stripeSubscriptionId,
      },
      success: true,
      idempotencyKey: `sub-created-${params.stripeSubscriptionId}`,
    });
  }

  async emitEntitlementActivated(params: {
    customerId: string;
    entitlementId: string;
    productId: string;
    bundleId: string;
  }) {
    return this.emit({
      eventType: "entitlement.activated",
      actor: "system",
      customerId: params.customerId,
      entitlementId: params.entitlementId,
      productId: params.productId,
      bundleId: params.bundleId,
      payload: {
        activatedAt: Date.now(),
      },
      success: true,
      idempotencyKey: `ent-activate-${params.entitlementId}`,
    });
  }

  async emitPlanCancelled(params: {
    customerId: string;
    entitlementId: string;
    productId: string;
    bundleId: string;
    cancelledAt?: number;
  }) {
    return this.emit({
      eventType: "plan.cancel_scheduled",
      actor: "user",
      customerId: params.customerId,
      entitlementId: params.entitlementId,
      productId: params.productId,
      bundleId: params.bundleId,
      payload: {
        scheduledCancelAt: params.cancelledAt || Date.now(),
      },
      success: true,
      idempotencyKey: `plan-cancel-${params.entitlementId}`,
    });
  }

  async emitEntitlementExpired(params: {
    customerId: string;
    entitlementId: string;
    productId: string;
    bundleId: string;
  }) {
    return this.emit({
      eventType: "entitlement.expired",
      actor: "system",
      customerId: params.customerId,
      entitlementId: params.entitlementId,
      productId: params.productId,
      bundleId: params.bundleId,
      payload: {
        expiredAt: Date.now(),
      },
      success: true,
      idempotencyKey: `ent-expire-${params.entitlementId}`,
    });
  }

  async emitSystemError(params: {
    customerId?: string;
    bundleId?: string;
    eventType: string;
    error: Error | string;
  }) {
    return this.emit({
      eventType: "system.error",
      actor: "system",
      customerId: params.customerId || "unknown",
      bundleId: params.bundleId,
      payload: {
        originalEventType: params.eventType,
        errorStack: params.error instanceof Error ? params.error.stack : String(params.error),
      },
      success: false,
      errorMessage: params.error instanceof Error ? params.error.message : String(params.error),
    });
  }
}

// Singleton instance (created per context in hooks)
let emitterInstance: EventEmitter | null = null;

export function initializeEventEmitter(mutationFn?: (name: string, args: any) => Promise<any>) {
  emitterInstance = new EventEmitter(mutationFn);
  return emitterInstance;
}

export function getEventEmitter(): EventEmitter {
  if (!emitterInstance) {
    emitterInstance = new EventEmitter();
  }
  return emitterInstance;
}

