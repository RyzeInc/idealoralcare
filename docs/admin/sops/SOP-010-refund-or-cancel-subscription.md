# SOP-010: Process a Refund or Cancel a Member's Subscription

**Purpose:** Handle a member-initiated billing request — a refund, a cancellation, or both — via the Customer Service desk.

**Who can do this:** Any admin (Owner or Editor) — there is no department/role restriction on refunds or cancellations despite what the Admin Users "Role Guide" copy implies.

**Trigger:** Member support request, chargeback prevention, or a duplicate/erroneous charge.

**Related guide:** [Customer Service](../guide/04-support-system.md#customer-service-admincustomer-service)

## Steps — cancel a subscription

1. Go to **Customer Service** (`/admin/customer-service`).
2. Use **Member Lookup** to find the member (name/email/member ID).
3. Review their Subscription card (status, amount, cadence, payment method, period end) to confirm you have the right subscription.
4. Click **Cancel Subscription**.
5. Choose:
   - **Cancel at period end** — member keeps access until their current period ends; Convex status and the cancellation email update immediately, even though Stripe's own cancellation takes effect later.
   - **Cancel immediately** — Stripe cancels right away, but the Convex status update and cancellation email are both deferred until Stripe's webhook actually fires (a short async delay — don't be alarmed if the member's status doesn't flip the instant you click).
6. Click **Confirm Cancel**.

## Steps — issue a refund

7. From the member's panel, expand **Invoice History** (lazy-loads on first click).
8. Find the paid invoice in question and click its **Refund** link (only shown for paid invoices with a real charge and a nonzero amount).
9. In the modal: leave **Amount** blank for a full refund, or enter a partial amount. Pick a **Reason** (requested by customer / duplicate / fraudulent). Add an internal note if useful for your own records.
10. Click **Issue Refund**.
11. **⚠️ Critical: a refund does NOT cancel the subscription or revoke entitlements on its own.** It is purely a Stripe-side monetary action plus an audit-log entry — nothing in Convex changes as a result. If the member should also lose access or stop being billed going forward, you must **separately** perform the Cancel Subscription steps above (before or after the refund, doesn't matter which order).

## Steps — log a note

12. Use **Add Support Note** to record what happened and why, regardless of which action(s) above you took — there's no other durable record of the *reason* behind a refund/cancellation tied to the member (only the fact of it, in Stripe/the audit log).

## Verification

- After cancellation, refresh the member's panel — for period-end cancellations, the status should already reflect it; for immediate cancellations, allow a short delay for the webhook, then refresh again.
- After a refund, re-expand Invoice History — the invoice should now show as refunded, and the refund is logged to the admin audit trail (though see [guide/05-known-issues.md #B1](../guide/05-known-issues.md) if you're trying to look that entry up via the Audit Log page — it currently won't display correctly there).

## If something goes wrong

- **You refunded a member and assumed that also ended their membership** — it didn't (see step 11). Go cancel the subscription separately if that's what you actually needed.
- **A second partial refund on the same invoice fails** — Stripe itself enforces that total refunds can't exceed what was paid; the modal only validates against the original amount, not any prior refunds, so this is a real Stripe-side rejection, not a UI bug.
- **You need to see who issued a specific past refund and when** — the Audit Log page is currently broken for reading this back cleanly (see [guide/05-known-issues.md #B1](../guide/05-known-issues.md)); check the Stripe dashboard directly for the refund's own metadata in the meantime.

## Related SOPs

- [SOP-009](SOP-009-terminate-member.md) — if you also need to update the member's Convex status (terminate) alongside the Stripe action.
