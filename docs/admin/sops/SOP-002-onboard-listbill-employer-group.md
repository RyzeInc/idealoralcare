# SOP-002: Onboard a New List-Bill (Payroll Deduction) Employer Group

**Purpose:** Set up a new employer group where the employer pays one consolidated invoice for all enrolled employees (payroll deduction), rather than each member paying Stripe directly.

**Who can do this:** Any admin (Owner or Editor).

**Trigger:** A new employer has signed a list-bill / payroll-deduction agreement.

**Prerequisites:** Same as [SOP-001](SOP-001-onboard-selfpay-employer-group.md), plus: the employer's payment method (check/ACH/wire), their preferred invoice due day, a billing contact name/email, and — if negotiated — custom per-tier rates (Member Only / Member+Spouse / Member+Family).

**Related guide:** [Hierarchy](../guide/02-operations.md#hierarchy-adminhierarchy), [List-Bill Invoices](../guide/03-finance.md#list-bill-invoices-adminlist-bill-invoices), [§6 Known structural gaps](../guide/03-finance.md#6-known-structural-gaps-read-before-trusting-any-number-here)

## Steps

1. Follow [SOP-001](SOP-001-onboard-selfpay-employer-group.md) steps 1–4 exactly (Site → confirm/create Account → Create Organization → fill Name/Org Code/Provider Group Code).
2. In the same Create Organization form, check **Enable List-Bill (FT Payroll Deduction)**. This reveals additional fields:
   - **Payment Method** (check / ACH / wire).
   - **Due Day** — the day of the month invoices are due.
   - **Contact Email** — where invoice-related correspondence goes.
   - **Notes**.
3. If this employer negotiated custom per-tier rates (not the default $14.99 individual / $24.99 family), set them via the group's `listBill.rates` configuration — this determines the MO/MS/MF rate resolution used by List-Bill Invoices (see [guide](../guide/03-finance.md#list-bill-invoices-adminlist-bill-invoices) rate-resolution priority). If you don't have a UI field for this in front of you, confirm with engineering how custom rates are currently set for this group before assuming the default rate is correct.
4. Click **Create**.
5. Once members are loaded (via [SOP-003](SOP-003-bulk-enroll-eligibility-file.md)), the group is ready for its first invoice — see [SOP-007](SOP-007-generate-listbill-invoice-record-payment.md).

## Verification

- Open the Group → confirm the List-Bill section shows `Enabled: true` with the payment method/due day you entered.
- After the first eligibility upload, run a single-group **Generate Invoice** (draft only, don't Issue yet) from List-Bill Invoices to sanity-check the member count and per-tier breakdown before the employer's first real invoice goes out.

## If something goes wrong

- **The group shows up on both the plain Billing page and List-Bill Invoices with different totals for the same period** — this is a known, documented structural gap (two independent billing engines with different default rates), not a data-entry mistake on your part. Treat **List-Bill Invoices** as the source of truth for what the employer actually owes. See [guide/03-finance.md §6](../guide/03-finance.md#6-known-structural-gaps-read-before-trusting-any-number-here).
- **A member who should be billed isn't appearing on the invoice** — check their `effectiveDate` isn't set in the future relative to the coverage period (they're excluded until their coverage period arrives), and confirm their `memberType` is `active`, `enrolling`, or `eligible` (any other status is excluded).

## Related SOPs

- [SOP-001](SOP-001-onboard-selfpay-employer-group.md) — the self-pay equivalent, if you picked the wrong path.
- [SOP-003](SOP-003-bulk-enroll-eligibility-file.md) — load the employer's roster.
- [SOP-007](SOP-007-generate-listbill-invoice-record-payment.md) — generate and manage this group's monthly invoices going forward.
- [SOP-013](SOP-013-reenroll-termed-listbill-employee.md) — handling an employee who terms off list-bill later.
