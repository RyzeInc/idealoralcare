# SOP-014: Monthly Finance Reconciliation Checklist

**Purpose:** A month-end routine tying together Billing, List-Bill Invoices, Invoice Calculator, and Commissions so finance has a consistent view of the month that just closed — and knows which disagreements are expected (documented gaps) vs. real problems.

**Who can do this:** Any admin (Owner or Editor).

**Trigger:** First few business days of each month, after the prior month has ended.

**Related guide:** [Finance overview](../guide/03-finance.md), especially [§6 Known structural gaps](../guide/03-finance.md#6-known-structural-gaps-read-before-trusting-any-number-here)

## Checklist

1. **Invoice Calculator — confirm the period closed.**
   Go to `/admin/invoice-calculator` → Closed Period Archive → confirm last month appears with a closed-at timestamp. If not, see [SOP-008](SOP-008-close-invoice-calculator-period-adjustment.md) to close it manually.

2. **Invoice Calculator — sanity-check the grand totals.**
   View the closed period → confirm Total Monthly Gross, Partner Vendor total, and Ryze Net Keep look consistent with enrollment volume for the month. Check the "N unbilled" note on Billable Primaries — a spike here usually means a webhook issue left Stripe bundles in a non-active state, or eligibility processing didn't complete for some members.

3. **List-Bill Invoices — confirm every list-bill group has an issued (or at least drafted) invoice for the month.**
   Go to `/admin/list-bill-invoices`, filter by the closed coverage period, and check for any active list-bill group missing from the list. Use **Generate Invoice** (or **Generate All for {month}**, if this hasn't run yet) to fill gaps — see [SOP-007](SOP-007-generate-listbill-invoice-record-payment.md).

4. **List-Bill Invoices — chase overdue balances.**
   Filter by status `overdue` and `partial`; follow up with each employer's billing contact.

5. **Billing / List-Bill (legacy) — cross-check self-pay revenue.**
   Go to `/admin/billing` for the self-pay E123 export, and `/admin/list-bill` for any manually-recorded employer payments this month (see [SOP-007](SOP-007-generate-listbill-invoice-record-payment.md) for how those get recorded).
   **Expect these totals to disagree with List-Bill Invoices for the same list-bill groups.** This is a known, documented architectural gap (two independent billing engines, three disagreeing default rate sources) — see [guide/03-finance.md §6](../guide/03-finance.md#6-known-structural-gaps-read-before-trusting-any-number-here). Don't spend reconciliation time trying to force these to match; treat **List-Bill Invoices** as authoritative for "what the employer owes," and the Billing page as authoritative only for actual Stripe self-pay revenue.

6. **Vendor payables.**
   From Invoice Calculator's Dispersal Breakdown table, click **Payables** on the Toothlens and Careington/Partner Vendor rows for the closed period, export, and hand off to AP for vendor payment.

7. **Commissions — do not use this month's numbers for payroll.**
   `/admin/commissions` is explicitly unfinished (permanent "Coming Soon" banner) and its displayed payout figures are currently based on a broken formula/field reference — see [guide/05-known-issues.md #B3](../guide/05-known-issues.md). If broker commission payouts are due this month, calculate them manually from `commissionPayables`/`commissionRates` records (ask engineering for a data pull) rather than trusting this page's table.

8. **Spot-check a refund/cancellation from the month.**
   In `/admin/customer-service`, confirm any refunds issued this month also had a corresponding subscription cancellation if one was intended — refunds don't cancel automatically (see [SOP-010](SOP-010-refund-or-cancel-subscription.md)).

## Verification

- You should end this checklist with: a closed Invoice Calculator period, every list-bill group invoiced, overdue balances flagged for follow-up, and vendor payable exports handed to AP — with a clear mental note of which cross-page discrepancies are expected vs. worth escalating.

## If something goes wrong

- **A group's Invoice Calculator total and List-Bill Invoice total genuinely can't be explained by the known rate-source gap** — that's worth escalating as a real bug rather than assuming it's the documented issue; check whether the group has a custom rate configured that one system honors and the other doesn't.
- **Commissions numbers look plausible and someone wants to use them anyway** — push back; the field-name bug means the displayed payout is not computed from the real `amount` on the underlying records at all, so "plausible-looking" is coincidental, not correct.

## Related SOPs

- [SOP-007](SOP-007-generate-listbill-invoice-record-payment.md), [SOP-008](SOP-008-close-invoice-calculator-period-adjustment.md) — the individual procedures this checklist draws on.
