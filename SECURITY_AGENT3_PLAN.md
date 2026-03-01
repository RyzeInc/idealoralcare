# Security Agent 3 — Stripe Lifecycle, API Hardening & Input Sanitization

**Scope**: `src/app/api/stripe/*` routes + `convex/lib/sanitize.ts` (new utility)  
**Goal**: Complete the Stripe subscription lifecycle, harden API routes, and create input sanitization utilities  
**Dependencies**: None (fully independent — coordinate with Agent 2 post-completion for internal mutation imports)

---

## Task List

| # | Task | File | Severity |
|---|---|---|---|
| 1 | Implement `customer.subscription.deleted` handler | `src/app/api/stripe/webhook/route.ts` | HIGH |
| 2 | Add `invoice.payment_failed` handler for suspension | `src/app/api/stripe/webhook/route.ts` | HIGH |
| 3 | Fix Stripe env var fallback (fail fast) | `src/app/api/stripe/webhook/route.ts` + `checkout/route.ts` | LOW |
| 4 | Create input sanitization utility | `convex/lib/sanitize.ts` (NEW) | MEDIUM |
| 5 | Create Convex `cancelBundle` mutation for webhook use | `convex/subscriptions/webhookActions.ts` (NEW) | HIGH |

---

## Task 1: Implement `customer.subscription.deleted` Handler

**Problem**: The current handler (lines 228-252 of `src/app/api/stripe/webhook/route.ts`) only logs the event. It does NOT:
- Cancel the subscription bundle in Convex
- Revoke entitlements
- The user retains full platform access after Stripe cancellation

**Current Code** (broken):
```typescript
case "customer.subscription.deleted": {
  const subscription = event.data.object as Stripe.Subscription;
  const stripeSubscriptionId = subscription.id;

  try {
    await convex.mutation(api.subscriptions.mutations.logEvent, {
      eventType: "customer.subscription.deleted",
      actor: "stripe",
      stripeEventId: event.id,
      stripeObjectId: subscription.id,
      payload: { subscription: stripeSubscriptionId },
      success: true,
      idempotencyKey: event.id,
    });

    console.log("[webhook] customer.subscription.deleted logged:", {
      stripeSubscriptionId,
    });
  } catch (error) {
    console.error("[webhook] Error processing customer.subscription.deleted:", error);
  }
  break;
}
```

**Replace entire `customer.subscription.deleted` case with:**

```typescript
case "customer.subscription.deleted": {
  const subscription = event.data.object as Stripe.Subscription;
  const stripeSubscriptionId = subscription.id;
  const stripeCustomerId = typeof subscription.customer === "string"
    ? subscription.customer
    : (subscription.customer as any)?.id || "";

  try {
    // 1. Find and cancel the subscription bundle in Convex
    const bundle = await convex.query(
      api.subscriptions.queries.getBundleByStripeSubscription,
      { stripeSubscriptionId }
    );

    if (bundle) {
      // 2. Cancel the bundle
      await convex.mutation(api.subscriptions.webhookActions.cancelBundleFromWebhook, {
        bundleId: bundle._id,
        reason: "Stripe subscription deleted",
        stripeEventId: event.id,
      });

      // 3. Revoke all entitlements for this bundle
      await convex.mutation(api.subscriptions.webhookActions.revokeEntitlementsByBundle, {
        bundleId: bundle._id,
        reason: "Stripe subscription deleted",
      });

      console.log("[webhook] customer.subscription.deleted processed:", {
        stripeSubscriptionId,
        bundleId: bundle._id,
        customerId: bundle.customerId,
      });
    } else {
      console.warn("[webhook] No bundle found for deleted subscription:", stripeSubscriptionId);
    }

    // 4. Log the event
    await convex.mutation(api.subscriptions.mutations.logEvent, {
      eventType: "customer.subscription.deleted",
      actor: "stripe",
      customerId: bundle?.customerId,
      bundleId: bundle?._id,
      stripeEventId: event.id,
      stripeObjectId: subscription.id,
      payload: {
        subscription: stripeSubscriptionId,
        bundleCancelled: !!bundle,
      },
      success: true,
      idempotencyKey: event.id,
    });
  } catch (error) {
    console.error("[webhook] Error processing customer.subscription.deleted:", error);

    // Log failure event
    try {
      await convex.mutation(api.subscriptions.mutations.logEvent, {
        eventType: "customer.subscription.deleted",
        actor: "stripe",
        stripeEventId: event.id,
        stripeObjectId: subscription.id,
        payload: { subscription: stripeSubscriptionId },
        success: false,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        idempotencyKey: `${event.id}_error`,
      });
    } catch (logError) {
      console.error("[webhook] Failed to log error event:", logError);
    }
  }
  break;
}
```

---

## Task 2: Add `invoice.payment_failed` Handler

**Problem**: There is no handler for `invoice.payment_failed`. When a recurring payment fails, the user keeps access. Stripe retries payments but eventually the subscription will be deleted. We should suspend access on payment failure.

**Add this new case** after the `invoice.payment_succeeded` case and before `customer.subscription.deleted`:

```typescript
case "invoice.payment_failed": {
  const invoice = event.data.object as any;
  const stripeSubscriptionId = typeof invoice.subscription === "string"
    ? invoice.subscription
    : undefined;

  if (!stripeSubscriptionId) {
    console.warn("[webhook] invoice.payment_failed without subscription:", invoice.id);
    break;
  }

  try {
    // Find the bundle by Stripe subscription ID
    const bundle = await convex.query(
      api.subscriptions.queries.getBundleByStripeSubscription,
      { stripeSubscriptionId }
    );

    if (bundle) {
      // Suspend the bundle and entitlements
      await convex.mutation(api.subscriptions.webhookActions.suspendBundleFromWebhook, {
        bundleId: bundle._id,
        reason: `Payment failed: ${invoice.id}`,
      });

      console.log("[webhook] invoice.payment_failed processed — bundle suspended:", {
        stripeSubscriptionId,
        bundleId: bundle._id,
        invoiceId: invoice.id,
      });
    } else {
      console.warn("[webhook] No bundle found for failed payment subscription:", stripeSubscriptionId);
    }

    // Log event
    await convex.mutation(api.subscriptions.mutations.logEvent, {
      eventType: "invoice.payment_failed",
      actor: "stripe",
      customerId: bundle?.customerId,
      bundleId: bundle?._id,
      stripeEventId: event.id,
      stripeObjectId: invoice.id,
      payload: {
        subscription: stripeSubscriptionId,
        attemptCount: invoice.attempt_count,
        amountDue: invoice.amount_due,
      },
      success: true,
      idempotencyKey: event.id,
    });
  } catch (error) {
    console.error("[webhook] Error processing invoice.payment_failed:", error);
  }
  break;
}
```

---

## Task 3: Fix Stripe Env Var Fallback

**Problem**: Both Stripe API routes create a Stripe client with `process.env.STRIPE_SECRET_KEY || ""`. If the env var is missing, this silently creates a broken client instead of failing immediately.

### Fix in `src/app/api/stripe/webhook/route.ts` (line 6):

**Current:**
```typescript
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
```

**Replace with:**
```typescript
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY environment variable is required");
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
```

### Fix in `src/app/api/stripe/checkout/route.ts` (line 7):

**Current:**
```typescript
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
```

**Replace with:**
```typescript
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY environment variable is required");
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
```

---

## Task 4: Create Input Sanitization Utility

**Problem**: 
- `convex/admin/notifications.ts` interpolates user-supplied values directly into HTML email templates → HTML injection risk
- `convex/admin/vendorFiles.ts` writes user data to CSV without protecting against Excel formula injection

**Solution**: Create a shared utility in `convex/lib/sanitize.ts` that Agent 2's files can import.

### File to Create: `convex/lib/sanitize.ts`

```typescript
/**
 * INPUT SANITIZATION UTILITIES
 *
 * Shared helpers for sanitizing user-supplied data before
 * interpolation into HTML, CSV, or other output formats.
 */

/**
 * Escape HTML entities to prevent HTML/XSS injection.
 * Use before interpolating user data into HTML templates (emails, PDFs, etc.)
 *
 * @example
 * const safe = escapeHtml(userInput);
 * const html = `<p>Hello ${safe}</p>`;
 */
export function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Sanitize a value for safe CSV output.
 * Prevents Excel/Sheets formula injection by prefixing dangerous
 * start characters with a single quote.
 *
 * Characters that trigger formulas: = + - @ | \t \r \n
 *
 * @example
 * const safe = sanitizeCsvValue(memberName);
 * csv += `"${safe}",`;
 */
export function sanitizeCsvValue(str: string): string {
  if (!str) return "";

  // First, escape double quotes for CSV (standard CSV escaping)
  let safe = str.replace(/"/g, '""');

  // Prefix with single quote if starts with a formula-triggering character
  // The single quote is invisible in most spreadsheet apps but prevents formula execution
  if (/^[=+\-@|\t\r\n]/.test(safe)) {
    safe = `'${safe}`;
  }

  return safe;
}

/**
 * Sanitize an object's string values for HTML context.
 * Useful for sanitizing all fields of an args object at once.
 *
 * @example
 * const safeArgs = sanitizeForHtml({ firstName: args.firstName, planName: args.planName });
 * const html = `<p>Hi ${safeArgs.firstName}, your plan: ${safeArgs.planName}</p>`;
 */
export function sanitizeForHtml<T extends Record<string, unknown>>(
  obj: T
): { [K in keyof T]: T[K] extends string ? string : T[K] } {
  const result = { ...obj } as any;
  for (const key of Object.keys(result)) {
    if (typeof result[key] === "string") {
      result[key] = escapeHtml(result[key]);
    }
  }
  return result;
}

/**
 * Sanitize an array of values for CSV output.
 * Returns a properly escaped and quoted CSV row.
 *
 * @example
 * const row = toCsvRow(["John", "=SUM(A1)", "john@example.com"]);
 * // Returns: "John","'=SUM(A1)","john@example.com"
 */
export function toCsvRow(values: string[]): string {
  return values.map((v) => `"${sanitizeCsvValue(v)}"`).join(",");
}
```

### Usage Instructions for Agent 2

After Agent 2 locks down the admin files, these utilities should be imported for the body of the handlers:

**In `convex/admin/notifications.ts`** — wrap interpolated values:
```typescript
import { escapeHtml } from "../lib/sanitize";

// In sendWelcomeEmail handler:
const safeFirstName = escapeHtml(args.firstName);
const safePlanName = escapeHtml(args.planName);
const safeMemberId = escapeHtml(args.memberId);
const html = `
  <p>Hi ${safeFirstName},</p>
  <li><strong>Plan:</strong> ${safePlanName}</li>
  <li><strong>Member ID:</strong> ${safeMemberId}</li>
`;
```

**In `convex/admin/vendorFiles.ts`** — wrap CSV values:
```typescript
import { sanitizeCsvValue } from "../lib/sanitize";

// In generateDentalDiscountNetworkFile handler:
const firstName = sanitizeCsvValue(member.firstName);
const lastName = sanitizeCsvValue(member.lastName);
csv += `"${memberId}","${firstName}","${lastName}",...\n`;
```

---

## Task 5: Create Webhook Action Mutations

**Problem**: The webhook handler needs to cancel bundles and revoke entitlements, but the existing mutations don't have the right API for webhook use. Also, we need a query to look up bundles by Stripe subscription ID.

### File to Create: `convex/subscriptions/webhookActions.ts`

```typescript
/**
 * WEBHOOK ACTION MUTATIONS
 *
 * Mutations specifically designed for Stripe webhook handlers.
 * These are callable via ConvexHttpClient (no auth context).
 *
 * Security note: These mutations perform critical state changes.
 * In a future iteration, consider using Convex internalMutation
 * with httpAction for webhook handling to restrict access.
 * For now, these validate Stripe event context via bundleId lookup.
 */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";

/**
 * Look up a subscription bundle by Stripe subscription ID
 * Used by webhook to find the Convex bundle for a Stripe event
 */
export const getBundleByStripeSubscription = query({
  args: {
    stripeSubscriptionId: v.string(),
  },
  handler: async (ctx, args) => {
    // Use index if available, otherwise filter
    const bundle = await ctx.db
      .query("subscriptionBundles")
      .filter((q) =>
        q.eq(q.field("stripeSubscriptionId"), args.stripeSubscriptionId)
      )
      .first();

    return bundle;
  },
});

/**
 * Cancel a bundle from a Stripe webhook event.
 * Sets bundle status to "cancelled" and records the reason.
 */
export const cancelBundleFromWebhook = mutation({
  args: {
    bundleId: v.id("subscriptionBundles"),
    reason: v.string(),
    stripeEventId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const bundle = await ctx.db.get(args.bundleId);
    if (!bundle) {
      throw new Error(`Bundle not found: ${args.bundleId}`);
    }

    // Idempotency: if already cancelled, skip
    if (bundle.status === "cancelled") {
      console.log(`[webhookActions] Bundle ${args.bundleId} already cancelled`);
      return bundle._id;
    }

    await ctx.db.patch(args.bundleId, {
      status: "cancelled",
      updatedAt: Date.now(),
      cancelledAt: Date.now(),
      cancellationReason: args.reason,
    });

    return bundle._id;
  },
});

/**
 * Revoke all entitlements for a bundle (subscription deleted/cancelled).
 * Sets all active entitlements to "revoked" status.
 */
export const revokeEntitlementsByBundle = mutation({
  args: {
    bundleId: v.id("subscriptionBundles"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const entitlements = await ctx.db
      .query("entitlements")
      .withIndex("by_bundle", (q) => q.eq("bundleId", args.bundleId))
      .collect();

    let revokedCount = 0;
    for (const entitlement of entitlements) {
      if (entitlement.status === "active" || entitlement.status === "cancel_at_period_end") {
        await ctx.db.patch(entitlement._id, {
          status: "revoked",
          revokedAt: Date.now(),
          endCondition: "expire",
          notes: args.reason,
        });
        revokedCount++;
      }
    }

    return { revokedCount, totalEntitlements: entitlements.length };
  },
});

/**
 * Suspend a bundle and its entitlements (payment failed).
 * Sets bundle to "past_due" and entitlements to "suspended".
 * Access can be restored when payment succeeds.
 */
export const suspendBundleFromWebhook = mutation({
  args: {
    bundleId: v.id("subscriptionBundles"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const bundle = await ctx.db.get(args.bundleId);
    if (!bundle) {
      throw new Error(`Bundle not found: ${args.bundleId}`);
    }

    // Don't suspend if already cancelled
    if (bundle.status === "cancelled") {
      return { suspended: false, reason: "Bundle already cancelled" };
    }

    // Update bundle status to past_due
    await ctx.db.patch(args.bundleId, {
      status: "past_due",
      updatedAt: Date.now(),
    });

    // Suspend all active entitlements
    const entitlements = await ctx.db
      .query("entitlements")
      .withIndex("by_bundle", (q) => q.eq("bundleId", args.bundleId))
      .collect();

    let suspendedCount = 0;
    for (const entitlement of entitlements) {
      if (entitlement.status === "active") {
        await ctx.db.patch(entitlement._id, {
          status: "suspended",
          suspendedAt: Date.now(),
          notes: args.reason,
        });
        suspendedCount++;
      }
    }

    return { suspended: true, suspendedCount };
  },
});
```

### Also Add to Webhook Route Imports

At the top of `src/app/api/stripe/webhook/route.ts`, the existing import is:
```typescript
import { api } from "@/convex/_generated/api";
```

This already covers all query/mutation references since the new file is under `convex/subscriptions/`. After creating `webhookActions.ts` and running `npx convex dev` to regenerate types, the new references like `api.subscriptions.webhookActions.cancelBundleFromWebhook` will be available.

### Add `getBundleByStripeSubscription` to Queries

Alternatively, add the `getBundleByStripeSubscription` query to the existing `convex/subscriptions/queries.ts` file instead of `webhookActions.ts`. But since Agent 2 owns that file, it's cleaner to put it in the new `webhookActions.ts` file that Agent 3 owns.

The webhook route references it as:
```typescript
api.subscriptions.webhookActions.getBundleByStripeSubscription
```

If you prefer it in `queries.ts`, coordinate with Agent 2.

---

## Schema Note

The `cancelBundleFromWebhook` mutation patches these fields onto `subscriptionBundles`:
- `cancelledAt` (number)
- `cancellationReason` (string)

The `suspendBundleFromWebhook` also sets `status: "past_due"`.

**Check `convex/schema.ts`** to verify these fields exist on the `subscriptionBundles` table. If not, they need to be added:

```typescript
// In the subscriptionBundles table definition, add:
cancelledAt: v.optional(v.number()),
cancellationReason: v.optional(v.string()),
```

And ensure the `status` union includes `"past_due"`:
```typescript
status: v.union(
  v.literal("active"),
  v.literal("cancelled"),
  v.literal("past_due"),  // ← add if missing
),
```

---

## Updated Webhook Route — Full `switch` Block

After all changes, the webhook `switch` statement should have these cases:

```
switch (event.type) {
  case "checkout.session.completed":    // existing — no changes
  case "invoice.payment_succeeded":     // existing — no changes
  case "invoice.payment_failed":        // NEW (Task 2)
  case "customer.subscription.deleted": // REWRITTEN (Task 1)
  default:                              // existing — no changes
}
```

---

## Files Summary

| File | Action | Notes |
|---|---|---|
| `src/app/api/stripe/webhook/route.ts` | **EDIT** | Rewrite subscription.deleted, add payment_failed, fix env var |
| `src/app/api/stripe/checkout/route.ts` | **EDIT** | Fix env var fallback only (2 lines) |
| `convex/lib/sanitize.ts` | **CREATE** | HTML + CSV sanitization utilities |
| `convex/subscriptions/webhookActions.ts` | **CREATE** | Cancel/suspend/revoke mutations for webhook use |
| `convex/schema.ts` | **EDIT** (if needed) | Add `cancelledAt`, `cancellationReason`, `past_due` status |

---

## Testing Instructions

### Stripe Lifecycle
1. **Cancel test**: In Stripe dashboard, cancel a test subscription → verify Convex bundle status changes to "cancelled" and entitlements become "revoked"
2. **Payment failure test**: In Stripe test mode, use a card that fails on renewal (e.g., `4000000000000341`) → verify bundle becomes "past_due" and entitlements become "suspended"
3. **Idempotency test**: Send the same `customer.subscription.deleted` webhook event twice → second call should be a no-op (bundle already cancelled)
4. **Missing bundle test**: Send a `customer.subscription.deleted` event for a non-existent subscription → should log warning, not crash

### Env Var Hardening
5. **Missing key test**: Temporarily remove `STRIPE_SECRET_KEY` env var → app should throw clear error at startup, not silently create broken Stripe client

### Sanitization
6. **HTML injection test**: Create a member with `firstName = "<img src=x onerror=alert(1)>"` → email HTML should contain `&lt;img src=x onerror=alert(1)&gt;` (escaped)
7. **CSV injection test**: Create a member with `firstName = "=CMD('calc')"` → vendor CSV should output `"'=CMD('calc')"` (single-quote prefixed)

---

## Coordination Notes

### With Agent 2
- Agent 2 may create `internalMutation` variants of `createBundle`, `activateEntitlement`, `logEvent`. If so, this agent's webhook handler should be updated post-completion to use `internal.subscriptions.mutations.*` instead of `api.subscriptions.mutations.*`.
- The `getBundleByStripeSubscription` query is in Agent 3's new file (`webhookActions.ts`). If Agent 2 prefers it in `queries.ts`, coordinate.
- Agent 3's `convex/lib/sanitize.ts` is a standalone utility with no imports from other convex files. Agent 2 can import it into notification/vendor files after adding auth guards.

### With Agent 1
- No file conflicts. Agent 1 handles middleware, layouts, and next.config.ts. Agent 3 handles API routes.
