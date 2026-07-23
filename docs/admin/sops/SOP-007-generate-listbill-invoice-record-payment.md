# SOP-007: Generate a List-Bill Invoice and Record Employer Payment

**Purpose:** Produce the monthly itemized invoice document for a payroll-deduction employer group, issue it, and record payment through its lifecycle.

**Who can do this:** Any admin (Owner or Editor).

**Trigger:** Monthly, automatically drafted by cron on the 25th for the following month's coverage — or generated manually here for an off-cycle need.

**Related guide:** [List-Bill Invoices](../guide/03-finance.md#list-bill-invoices-adminlist-bill-invoices)

## Steps — generate and issue

1. Go to **List-Bill Invoices** (`/admin/list-bill-invoices`).
2. Check whether a draft already exists for this group/month (filter by Coverage Period + the group). If the monthly cron already ran, it will — generation is idempotent, so clicking Generate again just returns the existing draft rather than duplicating it.
3. If none exists: click **Generate Invoice**, pick the Employer Group and Coverage Month, submit.
4. Click into the invoice (**View**) to review it before sending: member count, MO/MS/MF breakdown, rate summary, total.
5. If the roster looks wrong (e.g., a new hire missing, someone who should've termed still billed) and **no payment has been recorded yet**, click **Refresh Lines** to rebuild it from current data. If any payment has already posted, use **Adjust** instead (step 8) — Refresh Lines is blocked once there's a nonzero amount paid.
6. When ready to send to the employer: click **Issue**. This locks in `issuedAt` and moves status to `issued`.
7. Click **Generate Invoice** (PDF, opens in a new tab) to get the print-ready document, or use **Columns/Export** to configure which fields print (SSN/Location/Department/etc. are optional, off by default) and export CSV/Excel instead.

## Steps — record payment

8. Once the employer pays: open the invoice → **Record Payment** → enter the amount, method (check/ACH/wire), and the check number or ACH confirmation number → submit.
   - Paying the full balance → status becomes `paid`.
   - Paying less than the balance → status becomes `partial`; you can record additional payments later against the remaining balance.
9. If a correction is needed after payment has started (e.g., a negotiated discount, a retroactive term credit) — do **not** try to edit the line items. Click **Adjust**, enter a signed cents amount and required notes. This recalculates the total and balance without touching the frozen line snapshot.

## Steps — void / replace (rare)

10. If the invoice was generated in error and needs to be scrapped: click **Void**, provide a reason. Treat this as effectively permanent — while an "Un-void" exists, it's blocked the moment a replacement invoice has been generated, and the UI itself warns voiding is irreversible.
11. Generate a fresh invoice for the same group/period afterward if a corrected one is needed — the system will draft a new one since voided invoices don't block regeneration.

## Verification

- The group's **Aging Summary** (visible on that group's invoice-history page) should reflect the new invoice in the correct aging bucket, and drop it once fully paid.
- Cross-check the invoice total against the same group/period on [Invoice Calculator](../guide/03-finance.md#invoice-calculator-admininvoice-calculator) if you also need the internal revenue-dispersal view — see [SOP-014](SOP-014-monthly-finance-reconciliation-checklist.md) for the full monthly reconciliation routine, including the known gap where this total can legitimately disagree with the plain Billing/List-Bill pages.

## If something goes wrong

- **Record Payment refuses your amount** — you're either trying to pay a `draft` (issue it first), pay more than the total balance, or pay a `voided` invoice. None of these are allowed.
- **A dispute comes in from the employer** — there is currently no UI to formally mark/track a dispute even though "Disputed" exists as a status label; log it manually (e.g., in your own ticketing system or the invoice's Edit Details memo field) until this is built. See [guide/05-known-issues.md #B11](../guide/05-known-issues.md).
- **You need a replacement invoice after voiding, and want a formal "supersedes" link** — that specific flow (`generateReplacementInvoice`) has no UI button; generating a fresh invoice for the same period is the practical workaround, it just won't show a formal replacement-chain link back to the voided one.
- **This group's number doesn't match the plain Billing or List-Bill page for the same month** — expected, given the known two-engine gap; see [guide/03-finance.md §6](../guide/03-finance.md#6-known-structural-gaps-read-before-trusting-any-number-here). Treat List-Bill Invoices as authoritative for what the employer owes.

## Related SOPs

- [SOP-002](SOP-002-onboard-listbill-employer-group.md) — setting up the group in the first place.
- [SOP-008](SOP-008-close-invoice-calculator-period-adjustment.md) — the internal-revenue counterpart to this employer-facing invoice.
- [SOP-014](SOP-014-monthly-finance-reconciliation-checklist.md) — the full monthly routine this fits into.
