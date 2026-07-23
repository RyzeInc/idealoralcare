# SOP-008: Close a Monthly Invoice Calculator Period / Record an Adjustment

**Purpose:** Verify (or manually trigger) the monthly close of the internal revenue-dispersal snapshot, and record a correction (refund, chargeback, retroactive term/enrollment) against an already-closed period.

**Who can do this:** Any admin (Owner or Editor).

**Trigger:** Monthly, automatically via cron shortly after month-end — or manually if the cron missed its run, or whenever a correction is needed against a past period.

**Related guide:** [Invoice Calculator](../guide/03-finance.md#invoice-calculator-admininvoice-calculator)

## Steps — routine monthly verification

1. Go to **Invoice Calculator** (`/admin/invoice-calculator`) shortly after the start of a new month.
2. Check the **Closed Period Archive** table at the bottom — the prior month should now appear with a "closed at" timestamp.
3. If it's there: use the month picker to view it, and confirm the source banner reads "closed snapshot… immutable" (not the live/blue banner). Spot-check the grand totals against what you expect from enrollment volume.
4. If the prior month is **not** in the archive yet (the cron missed its run): switch the period picker to that month — since there's no snapshot, it'll show a live reconstruction gated to that period's end, and a **Close period now** button will appear. Click it to close manually.

## Steps — recording an adjustment against a closed period

5. Select the closed period in question from the picker.
6. Click **Record adjustment** (only available on closed periods — not on Live).
7. Fill in: the affected **Group**, a **Reason** (refund / chargeback / retroactive_term / retroactive_enrollment / misclassification / other), which **Bucket** it affects (gross / toothlens / careington / processing / partnerVendor / ryzeKeep), the signed **Amount** (debit/credit), optionally which period the cash actually moved in if different from the affected period, and required **Notes** explaining why.
8. Submit. This is append-only — it does not edit the frozen snapshot; the period's "as-of-now" total becomes snapshot + adjustments.

## Verification

- After an adjustment, re-view that period — the group's total should reflect the original snapshot amount **plus** your adjustment, and the adjustment should appear in that group's drill-down adjustments list with your notes intact.
- For vendor payables: open the relevant bucket's **Payables** link and confirm the adjusted total flows through before cutting a vendor payment based on it.

## If something goes wrong

- **You need to correct a closed period and there's no adjustment option showing** — you're likely still on the Live view; switch the period selector to the actual closed month first (Record Adjustment only appears there).
- **Clicking "Close period now" seems to do nothing on a period that's already closed** — this is expected: closing is idempotent and refuses to overwrite an existing snapshot, even on a repeat click.
- **The group drill-down for a closed period won't show individual member-level tier detail** — that's by design; closed periods intentionally show only the snapshot totals and member identity, not a full historical per-member reconstruction. Use the snapshot totals as authoritative.
- **You need a PDF/export specific to this calculator** — the API route folder for one exists but is empty (dead scaffolding); use **Export CSV** instead, or generate a real invoice document via the "Generate Invoice" wizard on a list-bill group's drill-down, which routes to the [List-Bill Invoices](SOP-007-generate-listbill-invoice-record-payment.md) PDF.

## Related SOPs

- [SOP-007](SOP-007-generate-listbill-invoice-record-payment.md) — the employer-facing invoice counterpart; you can jump directly into generating one from a list-bill group's drill-down here.
- [SOP-014](SOP-014-monthly-finance-reconciliation-checklist.md) — how this fits into the full monthly close routine.
