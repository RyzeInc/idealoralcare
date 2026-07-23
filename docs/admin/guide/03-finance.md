# Finance

Covers: [Billing](#billing-adminbilling) · [List-Bill](#list-bill-adminlist-bill) · [List-Bill Invoices](#list-bill-invoices-adminlist-bill-invoices) · [Invoice Calculator](#invoice-calculator-admininvoice-calculator) · [Commissions](#commissions-admincommissions)

Permission note: plain `requireAdmin` throughout — Owner and Editor have identical access. See [00-overview.md §1](00-overview.md#1-the-permission-model-read-this-first).

This is the most structurally complicated part of the admin suite. Before using any of it for real financial decisions, read **[§6 Known structural gaps](#6-known-structural-gaps-read-before-trusting-any-number-here)** at the bottom of this file — there is a documented, unresolved architectural issue (two parallel list-bill billing engines that can disagree) that affects how you should interpret Billing vs. List-Bill Invoices numbers.

---

## Billing (`/admin/billing`)

**Purpose**: read-only reporting of **self-pay** (Stripe) revenue — how many members per organization are paid vs. list-bill vs. free/comp, exported for the external E123 billing system. It does not collect payment itself.

### What's on the page

- Billing Month picker, Account View filter, sortable table (Provider Group Code, Org Code, Org Name, Total, Paid, List-Bill, Free, Billable Amount).
- **Export CSV for E123** — builds the CSV client-side from whatever's currently displayed.
- Click a row to drill into three tables: Paid Members, List-Bill Members, Free/Comp Members.

### How it works

- Member classification per the file's own rule: `paid` = active Stripe bundle with a non-zero price; `list_bill` = group has list-bill enabled and the member isn't termed off it; `free` = everything else (comp access, employer-comped $0).
- "Billable Amount" is **paid-member-count × a flat per-account rate** (default $15.00, or the account's configured override) — it does **not** sum each member's actual individually-priced Stripe bundle. If your organization has a mix of monthly/annual or discounted bundles, this total can diverge from the true sum shown in the per-member drill-down.

### Known limitations

- ⚠️ **The Billing Month picker doesn't filter anything.** The underlying query has no period argument — it always shows live, current-moment counts no matter what month you select. The displayed "Billing Period" box is cosmetic; there is no historical month-over-month view on this page (use [Invoice Calculator](#invoice-calculator-admininvoice-calculator)'s closed-period archive for that instead).
- The flat $15/member default used here disagrees with the $14.99/$24.99 tiered pricing used by [Invoice Calculator](#invoice-calculator-admininvoice-calculator) and [List-Bill Invoices](#list-bill-invoices-adminlist-bill-invoices) — see §6.
- No refund/dispute/dunning view here — for a specific member's payment issue, use [Customer Service](04-support-system.md#customer-service-admincustomer-service) instead.

---

## List-Bill (`/admin/list-bill`)

⚠️ **This page has no sidebar link.** It's only reachable by typing the URL directly. Worth bookmarking if your team uses it.

**Purpose**: records that an employer has **paid** their consolidated monthly bill for a payroll-deduction group, and lets you send re-enrollment links to employees who've termed off list-bill. It is a payment ledger, **not** the invoice document itself — for the actual itemized invoice, see [List-Bill Invoices](#list-bill-invoices-adminlist-bill-invoices).

### What's on the page

- Billing Month picker, Export Invoice CSV, sortable summary table (Organization, FT Members, Rate/Member, Invoice Total).
- Per-group drill-down, two tabs:
  - **Billing Summary**: current period's payment status, **Record Payment** / **Update Payment Record**, and a Payment History table.
  - **Termed Members**: FT employees with `listBillStatus: "termed"`, each with **Send Re-enrollment Link** (disabled if no email on file).
- **Record Payment modal**: Payment Method (Check/ACH), Status (Paid in Full / Partial / Pending / Overdue), conditional check#/date or ACH confirmation #, conditional amount-received field, notes.

### How it works

- "Active" here means `memberType === "active"` **and** `employeeType === "full_time"` — a narrower definition than the plain [Billing](#billing-adminbilling) page's "active," which has no FT filter. Don't compare the two headline numbers directly.
- **Recording a payment is a manual attestation** — "the employer told us / a check arrived" — it does not reconcile against any bank feed or Stripe object.
- List-bill enablement itself (turning list-bill on/off for a group, setting rates/due day/contact email) is **not** configured here — that's done from [Hierarchy](02-operations.md#hierarchy-adminhierarchy) when creating/editing the Group.
- **Send Re-enrollment Link** dispatches an email with a 30-day link. There is no button anywhere to actively *term* someone off list-bill from this page — that transition happens elsewhere (e.g., eligibility-file termination processing, or from the Members page's "Term from List-Bill" button — see [01-members-partners.md](01-members-partners.md#members-adminmembers)).

### Known limitations

- No nav link — easy for a new admin to never discover this page exists.
- No reconciliation against any real payment rail; it's a manual ledger only.

---

## List-Bill Invoices (`/admin/list-bill-invoices`)

**Purpose**: the itemized, per-member invoice document employers actually receive for payroll-deduction groups, plus its full lifecycle (draft → issued → paid/partial/overdue → voided/disputed). This is the module the Billing page's own note banner points employer-invoice questions to. Full spec: `docs/internal/LIST_BILL_INVOICE_SPEC.md`.

### Page structure

- **`/admin/list-bill-invoices`** — all-groups dashboard: stat cards (Active Invoices, Collected, Outstanding, Overdue), filters (coverage period, status), **Generate Invoice** (single group + month) and **Generate All for {next month}** (bulk draft every active list-bill group).
- **`/admin/list-bill-invoices/[groupId]`** — one group's invoice history + an Aging Summary panel (Current / 1–30 / 31–60 / 61–90 / 91+ days).
- **`/admin/list-bill-invoices/invoice/[invoiceId]`** — the invoice itself: cover info, rate summary, member-detail table (columns configurable — see below), and action buttons that appear/disappear based on status: **Refresh Lines**, **Issue**, **Record Payment**, **Edit Details**, **Adjust**, **Columns/Export**, **Generate Invoice** (PDF, opens in new tab), **Void** / **Un-void**.

### How invoicing actually works

- **Tier classification** per primary, based on their active dependents at generation time: 0 dependents → **MO** (Member Only); exactly 1 dependent who's a spouse/domestic partner → **MS** (Member + Spouse); any child dependent, or 2+ dependents → **MF** (Member + Family). A lone dependent with no relationship set defaults conservatively to MO.
- **Rate resolution**, most specific wins: (1) the group's own configured MO/MS/MF rates, else (2) the account's custom pricing, else (3) the standard dispersal defaults ($14.99 individual / $24.99 family). A per-member premium override (captured from an eligibility file) beats all of these if present.
- **Who's billable**: `active`, `enrolling`, **and `eligible`** member types — deliberately including `eligible`, because employer billing obligation starts at eligibility-file ingest, not at portal signup (an eligible member with no email can never complete Clerk provisioning and would otherwise never be billed).
- **Effective-date gating**: a member with a future effective date relative to the invoice's coverage period is excluded from that invoice and will appear starting the month their coverage actually begins. This is whole-period include/exclude, not partial-month proration (proration isn't implemented anywhere in this system).
- **System-entry gating**: a member is only included if their record already existed in Ideal's system by the end of the invoice's coverage period. This matters specifically for **regenerating a past invoice** — without this gate, a member added via a later month's eligibility file would incorrectly appear on an old, already-billed period.
- **Invoice numbering**: a single global sequential counter, zero-padded to 5 digits, never reused (voiding an invoice keeps its number permanently; a replacement gets a new one).
- **Generation is idempotent**: generating for a `(group, period)` that already has a non-voided invoice returns the existing draft rather than duplicating.

### The lifecycle, in practice

1. **Generate** (single or "Generate All") → `draft`.
2. **Issue** → `issued`, sets the issued timestamp.
3. **Record Payment** — full amount → `paid`; partial → `partial`. Rejected if you try to pay a `draft` (issue it first), a `voided` invoice, or push `amountPaidCents` above the total.
4. **Refresh Lines** — rebuilds the member roster/rates from current data. Only allowed on `draft`/`issued`/`overdue` **with zero payment recorded**; once any payment has posted, use **Adjust** instead.
5. **Adjust** — a signed cents delta with required notes; blocked on `voided` or fully-`paid` invoices.
6. **Void** — requires a reason; the UI explicitly (and correctly) warns this is effectively irreversible for practical purposes, even though...
7. **Un-void** exists and can restore a voided invoice to a re-derived status — but is blocked once a replacement invoice has been generated to supersede it.
8. Daily cron auto-flips `issued`/`partial` invoices past their due date to `overdue`.

**Generating a PDF** opens `/api/admin/list-bill-invoices/[invoiceId]/group-pdf` — it computes its aging summary "as of" the invoice's own billing date, not "as of today," specifically so that reprinting an old invoice always shows the same numbers no matter when you reprint it.

**Columns/Export**: which of 16 available fields (SSN, Location, Department, Employee #, Tier Code, etc.) print on the member-detail table and CSV/Excel export — configurable per group, saved with "Save as Default." The SSN column is flagged with an inline sensitivity warning when enabled.

### Known limitations

- **Dispute handling has no UI.** `disputeInvoice` and `resolveDispute` are fully implemented in the backend and "Disputed" even appears as a status color in the frontend, but no button anywhere calls them. If an employer disputes an invoice, there's currently no in-app way to record that — it'll have to be tracked outside the system (e.g., as a note) until the UI catches up.
- **Generating a formal replacement invoice has no UI either** (`generateReplacementInvoice` exists, unreachable). After voiding, your only path back to a valid invoice is generating a new one for the same period, which the system will treat as a fresh draft.
- Payment recording here is real (unlike List-Bill's manual ledger) but still doesn't reconcile against a bank feed — it's admin-entered.
- See §6 below — this system and the plain [Billing](#billing-adminbilling)/List-Bill legacy path can disagree on the rate for the same group.

---

## Invoice Calculator (`/admin/invoice-calculator`)

**Purpose**: the internal finance/reconciliation tool. For any period, it answers "how much gross revenue did we generate, and exactly how does every dollar split across Toothlens, Careington, processing, Partner Vendor (Ideal Health), and Ryze's carrier-keep margin?" This is the source for vendor payable batches and carrier-revenue reporting — and, per the code's own comments, **the most rigorously built and tested module in the Finance section.** Full spec: `docs/internal/INVOICE_CALCULATOR_SPEC.md`.

### The revenue/dispersal math (per primary, per month)

| Bucket | Individual ($14.99 gross) | Family ($24.99 gross) |
|---|---:|---:|
| Toothlens (AI detection license) | $1.00 | $1.00 |
| Careington (network access) | $2.00 | $2.00 |
| Processing (Stripe/Ryze) | $1.00 | $2.00 |
| Partner Vendor (Ideal Health) | $6.00 | $11.00 |
| **Ryze Keep** (residual — always computed, never hardcoded) | **$4.99** | **$8.99** |

Ryze Keep is always the *residual* (`gross − everything else`), which guarantees every primary's splits sum exactly to gross even though the "stated" splits ($15/$25) don't cleanly match the actual SKU price ($14.99/$24.99) — the $0.01 is intentionally absorbed by Ryze Keep. Dependents always contribute $0 to every bucket. A module-load self-check throws immediately if this invariant is ever broken by a code change — this is treated as a "must not ship" condition.

### What's on the page

- **Live** vs. a **closed-period** picker (month picker, datalist of periods that have already been snapshotted).
- Stat cards: Total Monthly Gross, Partner Vendor, Ryze Net Keep, Billable Primaries (with an "N unbilled" note).
- **Dispersal Breakdown table** — one row per bucket, columns for Employer-Paid / Self-Pay / Grand Total, each with a **Payables** link (per-vendor export).
- Filter pills (All / Employer-Paid / Self-Pay), sortable per-group table, and a **Closed Period Archive**.
- Group drill-down: member-level lines (for live periods) or role-only summary (for closed periods — the exact historical per-member tier isn't reconstructed, only the snapshot totals, which are authoritative).
- **Record adjustment** — only available on a **closed** period.
- For list-bill groups, a **Generate Invoice** wizard shortcuts directly into the [List-Bill Invoices](#list-bill-invoices-adminlist-bill-invoices) lifecycle (generate → optionally adjust → optionally issue) without leaving this page.

### How it works

- **Self-pay tier** comes from the member's actual Stripe bundle price, matched exactly against $14.99/$24.99. Anything else (a $0 comp bundle, no bundle at all) is **not billed** and counted separately as `unbilledPrimaryCount` — worth remembering when reading "active member" counts elsewhere, since this page is the one place that explicitly separates "active" from "actually billed."
- **List-bill tier** is derived differently — from household structure (0 dependents = individual, 1+ = family) — since list-bill primaries never carry a Stripe bundle.
- **Closed periods are immutable by design.** A monthly cron snapshots each period; once closed, corrections happen only through **Record Adjustment** (signed cents, a reason code, required notes) — never by re-closing or editing the snapshot. Re-running the close on an already-closed period is a safe no-op.
- Every closed snapshot stores a hash of its own payload and the exact dispersal table in effect at the time, so historical periods stay reproducible even if pricing changes later.
- "Close period now" only appears if you're viewing a past period that has no snapshot yet (i.e., the cron missed a run) — this lets you close it manually rather than waiting.

### Known limitations

- The API route folder for a calculator-specific PDF (`/api/admin/invoice-calculator/group-pdf`) exists on disk but is **empty** — dead scaffolding. The "Generate Invoice" wizard's PDF button actually opens the List-Bill Invoices PDF route instead.
- Closed-period group drill-downs intentionally don't show full per-member historical detail — only the snapshot totals. Don't expect to reconstruct "what exactly was each member's tier in March" beyond what the snapshot itself recorded.

---

## Commissions (`/admin/commissions`)

⚠️ **This section is explicitly unfinished — the page itself displays a permanent "Coming Soon" banner.** Document it to admins as read-only and not yet reliable, full stop.

### What's on the page (and what doesn't work)

- Stat cards (Total Partners, Pending Payout, Total this month), a month/year picker, an Export CSV button, and a read-only table (Partner/Agency, Active Enrollments, Rate, Calculated Payout, Status).
- The month/year picker **has no effect** — it isn't wired to anything.
- The Export CSV button **has no click handler at all** — it does nothing.
- There is no way to set a broker's commission rate, mark a payable as paid, or take any action from this page — it is purely a read-only table, and even that table's numbers should not be trusted (next section).

### Why the numbers can't be trusted yet

- The displayed "Calculated Payout" reads a field name (`amountCents`) that doesn't exist on the underlying record (the real field is `amount`) — so this always computes as effectively meaningless regardless of the real payable amount.
- The payout formula treats the commission rate inconsistently with how it's documented elsewhere (as a decimal fraction vs. a whole-number percent) and the result is displayed as if it were dollars when the underlying math is in cents. The rate itself is also displayed on-screen as a dollar amount ("$X.XX/member") when it's actually meant to be a percentage.
- Full commission **rate management** (`upsertRate`/`deactivateRate`) and **marking a payable paid** (`markAsPaid`) exist as backend functions but have zero UI anywhere in the app.

### Known limitations

- Treat this entire page as informational-only until engineering resolves the field-name/units issues above and builds the missing rate-management and payout UI.
- There's a second, unrelated `commissionRate` field directly on admin user records (for brokers) that this page doesn't read from at all — don't confuse the two when troubleshooting a rep's commission.

---

## 6. Known structural gaps (read before trusting any number here)

The repo's own gap analysis (`docs/internal/FINANCE_PLATFORM_EVALUATION.md`, 2026-06-30) documents a real architectural issue worth knowing before you reconcile numbers across pages:

**There are two parallel, independent list-bill billing systems that do not share a model:**

| | Legacy (feeds [Billing](#billing-adminbilling) / [List-Bill](#list-bill-adminlist-bill)) | Current ([List-Bill Invoices](#list-bill-invoices-adminlist-bill-invoices)) |
|---|---|---|
| Unit | Member count × flat rate | Per-member tier (MO/MS/MF) or premium override |
| Default rate | **$15.00** flat (hardcoded in `getSiteBillingSummary`) | $14.99 / $24.99 tiered (dispersal defaults) |
| Table | `listBillPayments` | `listBillInvoices` |

**Consequence: the same group can show a different total on the Billing/List-Bill pages than on List-Bill Invoices for the same period**, because they're computed by entirely different code paths with different default rates. Neither is "wrong" per se — they're just genuinely unreconciled systems. If a number on Billing/List-Bill doesn't match List-Bill Invoices for the same group and month, that's this known gap, not a data-entry error — don't spend time trying to make them match without an engineering fix. When in doubt about which is authoritative for "what does the employer actually owe," treat **List-Bill Invoices** as the source of truth — it's the one that actually generates the document the employer receives.

Other documented gaps worth knowing (not fixed, not currently blocking, but explains why some things feel thin): no employee/employer cost-share split (can't show "employee paid $X, employer paid $Y" the way some carrier statements do), no per-member payment-remittance reconciliation with reason codes, and no location/department subtotal grouping on invoices. See the full evaluation doc for detail if you're scoping future finance work.
