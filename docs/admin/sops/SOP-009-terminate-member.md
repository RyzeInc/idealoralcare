# SOP-009: Terminate a Member / Change Member Status

**Purpose:** Move a single member (or a batch) to a new status — most commonly terminating them, but also correcting a status that's out of sync.

**Who can do this:** Any admin (Owner or Editor).

**Trigger:** Member requests cancellation, employer reports someone left, or a status correction is needed.

**Related guide:** [Members](../guide/01-members-partners.md#members-adminmembers)

## Steps — terminate one member

1. Go to **Members** (`/admin/members`) and search for the member by name/email/member ID.
2. Click the row to open the detail drawer, and confirm you have the right person (check email + group).
3. **Decide first: does this also require ending their Stripe billing?** Terminating here does **not** touch Stripe — see the warning below. If they have an active paid subscription you need to stop charging, do [SOP-010](SOP-010-refund-or-cancel-subscription.md) (Customer Service) either before or right after this step.
4. Click the **Terminate** (trash) icon on their row.
5. Confirm the native dialog ("Terminate member "{name}"? This marks them as terminated.").
6. This is a **soft delete** — it flips their status to `terminated` and logs the action; the profile itself still exists and remains searchable if you re-enable "Show terminated."

## Steps — change status without terminating (correction)

7. Click the **Edit/Change Status** (pencil) icon on their row instead of Terminate.
8. Pick the new status from the dropdown (current status is excluded from the list) and optionally add a reason.
9. Click **Update**.

## Steps — bulk status change

10. Check the boxes on multiple rows (or "select all on page").
11. The bulk-action bar appears → **Bulk Status Change** → pick the new status → **Apply**.
12. Read the resulting toast carefully — it reports how many succeeded vs. the total; a partial failure doesn't roll back the ones that succeeded.

## Verification

- The member should disappear from the default Members list view (terminated members are hidden by default) — toggle **Show terminated** to confirm they're there with the correct status.
- Their Activity Timeline (in the detail drawer) should show the status-change entry.

## If something goes wrong

- **⚠️ You terminated a member but their Stripe subscription is still charging them** — this is expected, not a bug: terminating a member here is purely a Convex status change and does **not** cancel Stripe or issue a refund. Go to [Customer Service](../guide/04-support-system.md#customer-service-admincustomer-service) and cancel the subscription separately ([SOP-010](SOP-010-refund-or-cancel-subscription.md)).
- **You need to permanently, completely delete a member's record** (not just terminate/soft-delete) — there's no button for that on this page. Use [User Audit](../guide/04-support-system.md#user-audit-adminuser-audit)'s "Delete permanently" instead ([SOP-011](SOP-011-investigate-member-identity-issue.md)), and cancel their Stripe subscription first if relevant.
- **You clicked "Download ID Card" and got an error** — that button is currently broken (calls a function that doesn't exist); there's no working ID-card export today. See [guide/05-known-issues.md #B2](../guide/05-known-issues.md).
- **Bulk change reports a partial failure** — check the Activity Timeline of the members that didn't update; retry them individually since the bulk action doesn't automatically retry failures.

## Related SOPs

- [SOP-010](SOP-010-refund-or-cancel-subscription.md) — the Stripe-side counterpart to a termination.
- [SOP-011](SOP-011-investigate-member-identity-issue.md) — for a permanent delete, or when the issue is more complex than a status change (identity/linkage problems).
