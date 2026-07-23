# SOP-011: Investigate a Member/Identity Issue Across Systems

**Purpose:** Diagnose a member whose records look inconsistent across Clerk (login), Convex (`memberProfiles`), and Toothlens (AI scanning) — e.g., "member can't log in," "duplicate profile," "missing census data," or a request to fully purge someone's data.

**Who can do this:** Any admin (Owner or Editor) — including permanent deletion, so be deliberate.

**Trigger:** A support escalation that a simple Members-page lookup didn't resolve, or a data-quality sweep.

**Related guide:** [User Audit](../guide/04-support-system.md#user-audit-adminuser-audit), [Members — Member Inspector](../guide/01-members-partners.md#members-adminmembers)

## Steps — general investigation

1. Go to **User Audit** (`/admin/user-audit`).
2. Search by name/email/member ID/Clerk ID/Careington ID, or use the 7 stat-card filters (All / Active (Both) / Linked-No-Sub / Clerk Only / Convex Only / Missing Census / Toothlens) to find the category of problem you're chasing:
   - **Clerk Only** — signed up but no Convex member profile exists (usually an incomplete enrollment or an orphaned account).
   - **Convex Only** — a member profile exists (e.g., loaded via eligibility file) with no matching Clerk login (expected/normal for `eligible`-status members with no email — see [guide/00-overview.md §5](../guide/00-overview.md#5-member-lifecycle)).
   - **Missing Census** — profile is missing required fields.
3. Click the row to expand the full cross-system detail panel: Identity, Personal, Contact, Address, Vendor IDs, Employer/Payroll (SSN behind a reveal toggle), Status, Enrollment, Hierarchy, Clerk account detail, Subscription/Entitlements, Toothlens, Dependents, and a Census Validation summary.
4. For a deeper single-member view with Clerk sign-in history and OAuth account detail, click through to **Open full inspector** (`/admin/members/[id]`) — this is read-only.

## Steps — fix incorrect data

5. Back in the expanded row on User Audit, click **Edit all fields** — this exposes the *complete* field set (unlike the Members page's 5-field inline edit).
6. Correct the field(s), click **Save changes**.

## Steps — permanently delete a member record (rare, deliberate action)

7. **First**: if the member has an active paid Stripe subscription, cancel it via [Customer Service](../guide/04-support-system.md#customer-service-admincustomer-service) ([SOP-010](SOP-010-refund-or-cancel-subscription.md)) — deleting here does **not** touch Stripe, Clerk, or Toothlens, so an un-cancelled Stripe subscription will keep charging against a now-nonexistent Convex record.
8. In the expanded panel, click **Delete permanently**.
9. Read the confirm dialog fully — it explicitly states the profile, activity log, and notes will be removed, but Stripe/Clerk/Toothlens accounts are untouched.
10. Confirm.

## Verification

- Re-search for the member after an edit — the corrected fields should be reflected immediately (Convex is live-reactive).
- After a permanent delete, confirm the member no longer appears anywhere in User Audit or Members — but also separately confirm in Stripe/Clerk that you don't have a dangling paid subscription or login for someone with no Convex record, if that matters for your case.

## If something goes wrong

- **You need to export data for a payroll/compliance audit** — use **Export CSV** with the **Payroll Audit** preset (this is the one preset that includes SSN by default; a warning banner appears whenever SSN is part of the export — handle the resulting file accordingly).
- **You deleted a member but they still have an active Stripe charge** — you skipped step 7. Go cancel it in Customer Service now; the delete itself can't be undone, but the billing can still be stopped.
- **You need to know who deleted/edited a specific record and when** — the write itself is logged to the admin audit trail, but the Audit Log page currently renders these entries blank (see [guide/05-known-issues.md #B1](../guide/05-known-issues.md)); this needs direct database access to verify today.

## Related SOPs

- [SOP-009](SOP-009-terminate-member.md) — for a routine status change/soft-delete, which doesn't require this page at all.
- [SOP-010](SOP-010-refund-or-cancel-subscription.md) — do this first if a Stripe subscription is involved.
