# List-Bill Invoice Generator — Full Specification

**Version:** 1.0  
**Date:** May 8, 2026  
**Status:** Spec — Pending Implementation  
**Related:** `docs/internal/INVOICE_CALCULATOR_SPEC.md` (internal revenue tracking — separate system)

---

## 1. Purpose and Scope

The **List-Bill Invoice Generator** produces employer-facing billing documents for groups configured with `listBill.enabled = true`. It is the external-facing counterpart to the Invoice Calculator:

| System | Audience | What it measures |
|---|---|---|
| Invoice Calculator | Internal (Ryze/Ideal Health) | How gross revenue splits across Toothlens, Careington, Processing, Partner Vendor, Ryze Keep |
| **List-Bill Invoice Generator** | **External (Employer / Group Admin)** | **What the employer owes per member, per tier, per period** |

A list-bill invoice:
- Shows every **active primary member** in the group for the coverage period
- Classifies each member into a **billing tier** (MO / MS / MF)
- Applies the group's **contracted per-tier rate**
- Produces a two-page, print-ready document matching the reference format (see §8)
- Tracks **payment status** through a full lifecycle (draft → issued → paid / overdue → voided)
- Maintains a rolling **aging ledger** (current / 30 / 60 / 90 / 91+ days) across all open invoices for a group

---

## 2. Billing Tier Definitions

Every active primary member on a list-bill group is assigned exactly one tier at invoice generation time. Tier assignment is based on the member's **active dependents** in `memberProfiles` at the snapshot timestamp.

| Code | Name | Criteria | Default Rate |
|---|---|---|---|
| **MO** | Member Only | Primary with **zero** active dependents | $14.99 / mo |
| **MS** | Member + Spouse | Primary with **exactly one** active dependent whose `relationship` ∈ `{"spouse", "domestic_partner"}` | $24.99 / mo |
| **MF** | Member + Family | Primary with **any child dependent**, OR **two or more** dependents regardless of relationship | $24.99 / mo |

**Tie-breaking rule:** If a member has both a spouse and at least one child, MF wins over MS.  
**Default rates** come from the dispersal model (`convex/lib/dispersal.ts`). Groups can configure custom per-tier rates (see §3).

### 2.1 Dependent Inclusion Logic

A dependent counts toward tier determination if ALL of the following hold:

1. `memberProfiles.primaryMemberId` = this primary's `_id`
2. `memberProfiles.memberType` ∈ `{"active", "enrolling"}`
3. `memberProfiles.memberRole` = `"dependent"`

Terminated / inactive dependents are excluded. This snapshot is taken at invoice generation time and frozen in the invoice line items.

---

## 3. Rate Source of Truth

Rates are resolved in order of specificity (most specific wins):

1. **Group-level custom rate** — `groups.listBill.rates.{mo|ms|mf}Cents`  
2. **Account-level custom pricing** — `accounts.customPricing[product].monthlyCardCents` for the group's primary product  
3. **Dispersal defaults** — Individual gross ($1499) for MO; Family gross ($2499) for MS and MF  

### 3.1 Schema Addition — `groups.listBill.rates`

The `listBill` object on groups needs to be extended with per-tier rate configuration:

```ts
// Extension to groups.listBill (new optional sub-object)
rates: v.optional(v.object({
  moCents: v.number(),    // Member Only rate in cents
  msCents: v.number(),    // Member + Spouse rate in cents
  mfCents: v.number(),    // Member + Family rate in cents
  effectiveFrom: v.optional(v.string()),  // "YYYY-MM" — rate applies from this period onward
  rateLabel: v.optional(v.string()),      // Display name for the product, e.g. "Financial Shield (List Bill)"
}))
```

**Rate label example:** "Financial Shield (List Bill)" — displayed on member line items as `{rateLabel} - Member Only`, `{rateLabel} - Member + Spouse`, or `{rateLabel} - Member + Family`.  
If no `rateLabel` is configured, falls back to "Ideal Oral Health (List Bill)".

---

## 4. Invoice Object Model

### 4.1 `listBillInvoices` — New Table

Replaces and supersedes the existing `listBillPayments` table for new invoices. Existing `listBillPayments` rows remain as a payment ledger; new invoices write here.

```ts
listBillInvoices: defineTable({
  // ── IDENTITY ─────────────────────────────────────────────────────────────
  invoiceNumber: v.number(),          // Sequential integer (counter: "listBillInvoiceSeq")
  invoiceNumberDisplay: v.string(),   // e.g. "10113" (zero-padded if needed)

  // ── SCOPE ────────────────────────────────────────────────────────────────
  groupId: v.id("groups"),
  accountId: v.id("accounts"),
  siteId: v.id("sites"),

  // ── BILLING PERIOD ───────────────────────────────────────────────────────
  coveragePeriod: v.string(),         // "YYYY-MM" — the month this invoice covers
  coverageStart: v.number(),          // Unix ms — first day of coverage month (UTC)
  coverageEnd: v.number(),            // Unix ms — last day of coverage month (UTC, inclusive)

  // ── DATES ────────────────────────────────────────────────────────────────
  billingDate: v.number(),            // Unix ms — when this invoice was issued/generated
  paymentDueDate: v.number(),         // Unix ms — when payment is due (group's configured due day)

  // ── DENORMALIZED GROUP METADATA (frozen at generation time) ──────────────
  groupName: v.string(),
  groupCode: v.string(),
  organizationCode: v.optional(v.string()),
  accountName: v.string(),
  billingContactEmail: v.optional(v.string()),
  billingContactName: v.optional(v.string()),

  // ── RATES (frozen at generation time, from §3) ───────────────────────────
  moCents: v.number(),
  msCents: v.number(),
  mfCents: v.number(),
  rateLabel: v.string(),              // e.g. "Financial Shield (List Bill)"

  // ── MEMBER LINE ITEMS (one per active primary, snapshot at generation) ───
  lines: v.array(v.object({
    memberProfileId: v.id("memberProfiles"),
    memberId: v.string(),             // denormalized from memberProfiles.memberId
    lastName: v.string(),
    firstName: v.string(),
    tier: v.union(v.literal("MO"), v.literal("MS"), v.literal("MF")),
    dependentCount: v.number(),       // number of active dependents counted
    rateCents: v.number(),            // rate applied (moCents / msCents / mfCents)
    productLabel: v.string(),         // e.g. "Financial Shield (List Bill) - Member Only"
  })),

  // ── HEAD COUNTS ──────────────────────────────────────────────────────────
  memberCount: v.number(),            // total active primaries billed (= lines.length)
  moCount: v.number(),
  msCount: v.number(),
  mfCount: v.number(),

  // ── FINANCIALS (integer cents) ────────────────────────────────────────────
  subtotalCents: v.number(),          // sum of all line rateCents
  adjustmentCents: v.number(),        // signed; positive = credit (reduces balance)
  totalCents: v.number(),             // subtotalCents + adjustmentCents
  adjustmentNotes: v.optional(v.string()),

  // ── PAYMENT TRACKING ─────────────────────────────────────────────────────
  status: v.union(
    v.literal("draft"),               // Generated but not yet sent
    v.literal("issued"),              // Sent to employer
    v.literal("paid"),                // Fully paid
    v.literal("partial"),             // Partially paid
    v.literal("overdue"),             // Past due date, not fully paid
    v.literal("voided"),              // Cancelled; a corrected invoice supersedes this
    v.literal("disputed")            // Employer has raised a dispute
  ),
  paymentMethod: v.optional(v.union(v.literal("check"), v.literal("ach"), v.literal("wire"))),
  checkNumber: v.optional(v.string()),
  checkDate: v.optional(v.string()),  // "YYYY-MM-DD"
  achConfirmationNumber: v.optional(v.string()),
  amountPaidCents: v.number(),        // running total paid (starts at 0)
  balanceCents: v.number(),           // totalCents - amountPaidCents
  paidAt: v.optional(v.number()),     // Unix ms when fully paid

  // ── VOID / REPLACEMENT CHAIN ─────────────────────────────────────────────
  voidedAt: v.optional(v.number()),
  voidedBy: v.optional(v.string()),   // admin Clerk user ID
  voidReason: v.optional(v.string()),
  supersededById: v.optional(v.id("listBillInvoices")), // replacement invoice

  // ── DOCUMENT STORAGE ─────────────────────────────────────────────────────
  pdfStorageId: v.optional(v.id("_storage")), // Convex storage ID for generated PDF
  pdfUrl: v.optional(v.string()),             // Signed URL (short-lived)

  // ── SOURCE PROVENANCE ────────────────────────────────────────────────────
  generatedBy: v.string(),            // "cron" | admin Clerk user ID
  memberProfileIdsSnapshot: v.array(v.id("memberProfiles")), // provenance

  // ── AUDIT ────────────────────────────────────────────────────────────────
  createdAt: v.number(),
  updatedAt: v.number(),
  issuedAt: v.optional(v.number()),
  reconciledAt: v.optional(v.number()),
  reconciledBy: v.optional(v.string()),
})
  .index("by_group", ["groupId"])
  .index("by_account", ["accountId"])
  .index("by_period", ["coveragePeriod"])
  .index("by_group_period", ["groupId", "coveragePeriod"])
  .index("by_status", ["status"])
  .index("by_invoice_number", ["invoiceNumber"])
  .index("by_due_date", ["paymentDueDate"])
```

### 4.2 `listBillPayments` (Existing)

The existing `listBillPayments` table is kept as-is for historical records. New invoices use `listBillInvoices`. A future migration may link old `listBillPayments` rows to synthetic `listBillInvoices` rows.

---

## 5. Invoice Lifecycle

```
                ┌─────────┐
   generate ──► │  draft  │ ─── issue ──► issued ──┬── mark_paid ──► paid
                └─────────┘                         │
                                                    ├── record_partial ──► partial
                                                    │                        │
                                                    ├── overdue (cron) ◄─────┘
                                                    │
                                                    ├── dispute ──► disputed
                                                    │
                                                    └── void ──► voided
                                                                    │
                                                           create_replacement ──► (new draft)
```

### 5.1 State Transition Rules

| From | To | Trigger | Auth |
|---|---|---|---|
| — | draft | `generateInvoice` mutation | admin or cron |
| draft | issued | `issueInvoice` mutation | admin |
| issued | paid | `recordPayment` with full balance | admin |
| issued / partial | partial | `recordPayment` with partial amount | admin |
| partial | paid | `recordPayment` completing balance | admin |
| issued / partial | overdue | `markOverdueInvoices` cron (daily at 08:00 UTC) | cron |
| issued / partial / overdue | disputed | `disputeInvoice` mutation | admin |
| disputed | issued | `resolveDispute` mutation | admin |
| issued / partial / overdue / disputed | voided | `voidInvoice` mutation | admin |
| voided | — (new draft created) | `generateReplacementInvoice` | admin |

---

## 6. Invoice Numbering

Uses the `counters` table (key: `"listBillInvoiceSeq"`) for a globally unique, monotonically incrementing integer. The display string is the raw integer, zero-padded to 5 digits (e.g., `10113`).

**Allocation algorithm (inside a Convex mutation — atomic):**
1. Read the current counter row by name `"listBillInvoiceSeq"`.
2. Increment `value` by 1.
3. Write back.
4. Use the new value as `invoiceNumber`.

No gaps are permitted; void + replacement creates a new number. The original voided invoice retains its number permanently.

---

## 7. Aging Buckets

Each invoice has a computed `agingBucket` derived from `paymentDueDate` and the current date:

| Label | Rule |
|---|---|
| Current | `balanceCents > 0` AND `daysOverdue ≤ 0` |
| Up to 30 Days | `1 ≤ daysOverdue ≤ 30` |
| 31 to 60 Days | `31 ≤ daysOverdue ≤ 60` |
| 61 to 90 Days | `61 ≤ daysOverdue ≤ 90` |
| 91+ Days | `daysOverdue ≥ 91` |
| Paid | `balanceCents = 0` (never appears in aged columns) |

The **Invoice History** section on the cover page shows only open invoices for that group, with balances in the correct bucket column.

### 7.1 Group-Level Aging Summary

The `getGroupAgingSummary({ groupId })` query returns:

```ts
{
  current: number,      // cents
  upTo30Days: number,
  days31To60: number,
  days61To90: number,
  days91Plus: number,
  totalDue: number,     // sum of all buckets
}
```

---

## 8. Document Format

The invoice renders as **two pages**. Both pages share a common header.

### 8.1 Shared Header (Both Pages)

```
 [Logo — "Ideal Health" text mark, 28px bold]

   Group: {groupName} ({organizationCode})          List Bill Invoice
   Invoice #: {invoiceNumberDisplay}
   Billing Date: {billingDate formatted as "MMMM D, YYYY"}
```

### 8.2 Page 1 — Cover / Remittance Stub

```
────────────────────────────────────────────────────────────
                    {accountName / employer name}
────────────────────────────────────────────────────────────

Invoice Summary
  # of Members:       {memberCount}
  # of Products:      {memberCount}   (one product line per member)
  Coverage Period:    {coverageStart formatted} to {coverageEnd formatted}
  Adjustments:        {adjustmentCents formatted as currency}
  Invoice Amount:     {totalCents formatted as currency}

Invoice History   [aging table, columns: Current | ≤30 Days | 31–60 | 61–90 | 91+ | Total Due]
  [one row showing this group's aged open balances]

────────────────────────────────────────────────────────────
Payment Information

  Payment Due Date:  {paymentDueDate formatted}
  Amount Paid:       ___________________
  Check Number:      ___________________

  Return this invoice to:
      Ideal Health
      [address if configured]

  If you have any questions, please contact at [support phone / email]
────────────────────────────────────────────────────────────
```

### 8.3 Page 2 — Member Detail

```
[Shared header]

Invoice #: {invoiceNumberDisplay}          Return this invoice to:
Group: {groupName} ({organizationCode})        Ideal Health
Coverage Period: {start} to {end}              [address]
Payment Due Date: {paymentDueDate}

Member Products
┌─────────────┬────────────┬───────────┬──────────────────────────────────────────┬──────────┐
│ LAST NAME   │ FIRST NAME │ ID        │ PRODUCT                                  │ AMOUNT   │
├─────────────┼────────────┼───────────┼──────────────────────────────────────────┼──────────┤
│ {lastName}  │{firstName} │{memberId} │ {productLabel}                           │{rateFmt} │
│ ...         │            │           │                                          │          │
├─────────────┴────────────┴───────────┴──────────────────────────────────────────┼──────────┤
│                                                                           Total │{totalFmt}│
└─────────────────────────────────────────────────────────────────────────────────┴──────────┘

Product Summary
┌─────────────────────────────────────┬───────┬────────────┐
│ PRODUCT                             │ COUNT │ AMOUNT     │
├─────────────────────────────────────┼───────┼────────────┤
│ {rateLabel} - Member Only           │ {moCount} │ {moAmt}│
│ {rateLabel} - Member + Spouse       │ {msCount} │ {msAmt}│
│ {rateLabel} - Member + Family       │ {mfCount} │ {mfAmt}│
├─────────────────────────────────────┼───────┼────────────┤
│                             Total   │{total}│ {totalFmt} │
└─────────────────────────────────────┴───────┴────────────┘
```

**Member sort order:** Alphabetical by `lastName`, then `firstName`.  
**Rows with zero-count tiers** in Product Summary are omitted.

---

## 9. Drill Levels and Export Matrix

The system provides data at 4 levels. Each supports viewing and export.

| Level | Query | View | CSV Export | PDF Export |
|---|---|---|---|---|
| **L1: All Groups** | `listInvoices({ period?, status?, accountId? })` | Admin dashboard table | ✅ | ✗ |
| **L2: Single Group** | `getGroupInvoiceHistory({ groupId, limit? })` | Group invoice list with aging | ✅ | ✗ |
| **L3: Single Invoice** | `getInvoice({ invoiceId })` | Cover + detail in browser | ✅ | ✅ |
| **L4: Single Member Line** | Derived from `getInvoice` lines array | Modal / tooltip on member row | ✅ (per-invoice row) | ✗ |

### 9.1 CSV Format — L1 (All Groups, a period)

```
invoice_number,billing_date,coverage_period,group_code,organization_code,group_name,
member_count,mo_count,ms_count,mf_count,subtotal,adjustments,total,status,balance,days_overdue
```

### 9.2 CSV Format — L2 (Single Group History)

```
invoice_number,billing_date,coverage_period,member_count,mo_count,ms_count,mf_count,
total,amount_paid,balance,status,paid_at
```

### 9.3 CSV Format — L3 (Single Invoice Member Lines)

```
last_name,first_name,member_id,tier,dependent_count,product,amount
```

### 9.4 PDF — L3 Only

Generated server-side as HTML → PDF (using a print-optimized React component via `react-pdf` or HTML + `@react-pdf/renderer`). Output matches the 2-page format in §8. Stored in Convex `_storage` with a short-lived signed URL.

---

## 10. Cron Automation

### 10.1 Monthly Invoice Generation

**Schedule:** `0 8 25 * *` — 25th of each month at 08:00 UTC  
**Entry point:** `internal.admin.listBillInvoices.generateMonthlyInvoices`  
**Action:** Generate `draft` invoices for ALL active list-bill groups for the **next calendar month** (coverage period = following month). Existing drafts for the same group × period are skipped (idempotent).

Example: Runs on April 25 → generates drafts for May coverage.

### 10.2 Daily Overdue Detection

**Schedule:** `0 8 * * *` — daily at 08:00 UTC  
**Entry point:** `internal.admin.listBillInvoices.markOverdueInvoices`  
**Action:** Find all `issued` or `partial` invoices where `paymentDueDate < now` and update status to `overdue`.

### 10.3 Monthly Issue (Optional Auto-Issue)

Groups can configure `listBill.autoIssue = true` to automatically transition `draft` → `issued` and trigger an email to `listBill.employerContactEmail` on the 1st of the coverage month.

---

## 11. Backend API — Convex Functions

All functions live in `convex/admin/listBillInvoices.ts` and are exported via `convex/admin/index.ts`.

### 11.1 Mutations (admin-only unless marked internal)

| Name | Args | Description |
|---|---|---|
| `generateInvoice` | `{ groupId, coveragePeriod, billingDate? }` | Create a draft invoice for a group × period. Idempotent (returns existing if present). |
| `generateMonthlyInvoices` | `{}` (internal) | Cron: generate drafts for all list-bill groups for next month. |
| `issueInvoice` | `{ invoiceId }` | Transition draft → issued. Sets `issuedAt`, optionally sends email. |
| `recordPayment` | `{ invoiceId, amountCents, paymentMethod, checkNumber?, achConfirmationNumber?, paidAt? }` | Record a full or partial payment. Transitions to `paid` or `partial`. |
| `voidInvoice` | `{ invoiceId, reason }` | Mark voided. |
| `generateReplacementInvoice` | `{ voidedInvoiceId, coveragePeriod? }` | Create a fresh draft that references the voided invoice. |
| `applyAdjustment` | `{ invoiceId, adjustmentCents, notes }` | Add a signed adjustment (positive = credit). Recalculates `totalCents` and `balanceCents`. |
| `markOverdueInvoices` | `{}` (internal) | Cron: flip issued/partial invoices past due to `overdue`. |

### 11.2 Queries

| Name | Args | Returns |
|---|---|---|
| `getInvoice` | `{ invoiceId }` | Full invoice doc with computed `agingBucket` |
| `listInvoices` | `{ period?, status?, accountId?, groupId?, limit? }` | Paginated invoice list for L1/L2 views |
| `getGroupInvoiceHistory` | `{ groupId, limit? }` | Last N invoices for a group with aging |
| `getGroupAgingSummary` | `{ groupId }` | Aging buckets totals (§7.1) |
| `getInvoicePdfUrl` | `{ invoiceId }` | Signed storage URL for the PDF |
| `previewInvoice` | `{ groupId, coveragePeriod }` | Live (non-persisted) breakdown for a group × period |

### 11.3 `previewInvoice` Detail

The preview query runs the same tier-classification logic as `generateInvoice` but does not write to the database. Used to show admins "what this month's invoice will look like" before generation. Returns the same shape as a full `getInvoice` response with `source: "preview"`.

---

## 12. Core Computation Logic

```
function buildInvoiceLines(groupId, coveragePeriod, snapshotMs):
  members ← memberProfiles WHERE groupId=groupId AND memberType IN (active, enrolling)
                               AND memberRole = "primary"

  for each primary in members:
    deps ← memberProfiles WHERE primaryMemberId=primary._id
                              AND memberType IN (active, enrolling)
                              AND memberRole = "dependent"

    hasChild   ← deps.some(d => d.relationship IN {child, other} OR d.relationship IS null)
    hasSpouse  ← deps.some(d => d.relationship IN {spouse, domestic_partner})
    depCount   ← deps.length

    tier ←
      if depCount = 0              → "MO"
      elif depCount ≥ 2            → "MF"
      elif hasChild                → "MF"
      elif hasSpouse               → "MS"
      else                         → "MO"   // 1 dependent with no relationship set → MO conservative

    rate ← resolveRate(group, tier)    // §3
    label ← tierLabel(rateLabel, tier) // "{rateLabel} - Member Only" etc.

    append line { memberProfileId, memberId, lastName, firstName, tier, depCount, rate, label }

  return lines.sortBy(lastName, firstName)

function resolveRate(group, tier):
  if group.listBill.rates.{tier}Cents  → return that
  elif account.customPricing[primaryProduct]  → return tier-appropriate price
  else                                  → return DISPERSAL[tier == "MO" ? individual : family].grossCents
```

---

## 13. UI Pages and Components

### 13.1 Page Structure

```
/admin/list-bill-invoices
  — L1 dashboard: all groups, filterable by period / status
  — "Generate Invoice" button (single group × period)
  — "Generate All for [month]" batch action

/admin/list-bill-invoices/[groupId]
  — L2: Group invoice history + aging summary panel
  — Quick-pay sidebar

/admin/list-bill-invoices/[invoiceId]
  — L3: Full invoice view (cover + member detail)
  — Action toolbar: Issue / Record Payment / Void / Export PDF / Export CSV
  — Payment history timeline

/admin/list-bill-invoices/[invoiceId]/preview
  — Print view (no admin chrome) — same as PDF output
```

### 13.2 Components

| Component | Location | Description |
|---|---|---|
| `InvoiceStatusBadge` | `components/admin/invoice/` | Color-coded status pill |
| `AgingTable` | `components/admin/invoice/` | Current / 30 / 60 / 90 / 91+ columns |
| `MemberLinesTable` | `components/admin/invoice/` | Sortable, L4 drill-down on row click |
| `ProductSummaryTable` | `components/admin/invoice/` | MO / MS / MF count + total |
| `InvoiceCoverPage` | `components/admin/invoice/` | Print-ready cover (Page 1) |
| `InvoiceDetailPage` | `components/admin/invoice/` | Print-ready detail (Page 2) |
| `RecordPaymentModal` | `components/admin/invoice/` | Amount + method + check/ACH fields |
| `AdjustmentModal` | `components/admin/invoice/` | Signed adjustment + notes |
| `InvoicePreviewBanner` | `components/admin/invoice/` | "This is a preview, not yet generated" banner |

### 13.3 L1 Dashboard Table Columns

| Column | Sortable | Filterable |
|---|---|---|
| Invoice # | ✅ | — |
| Billing Date | ✅ | ✅ (period picker) |
| Group | ✅ | ✅ (search) |
| Coverage Period | ✅ | ✅ |
| Members | ✅ | — |
| MO / MS / MF | — | — |
| Total | ✅ | — |
| Paid | — | — |
| Balance | ✅ | — |
| Status | — | ✅ (status filter) |
| Actions | — | — |

---

## 14. PDF Generation

PDF generation occurs server-side via a Convex HTTP action or scheduled action that:

1. Calls `getInvoice({ invoiceId })` to fetch all data.
2. Renders `<InvoiceCoverPage />` and `<InvoiceDetailPage />` as HTML strings (using `ReactDOMServer.renderToStaticMarkup`).
3. Passes HTML to a headless-browser PDF service (e.g., Puppeteer on a serverless function, or an API like `html-pdf-node`).
4. Stores the resulting PDF binary in Convex `_storage`.
5. Updates `listBillInvoices.pdfStorageId` on the invoice record.
6. Returns a signed URL valid for 1 hour.

**Alternative (no external service):** Use `@react-pdf/renderer` entirely in the Convex action environment (no DOM required). This is the preferred approach for simplicity.

### 14.1 PDF Invariants

- Invoice number, group name, billing date, total are printed in a machine-readable font for easy OCR / remittance matching.
- Footer of each page includes "Page 1 of 2" / "Page 2 of 2".
- The cover page's "Amount Paid" and "Check Number" lines are intentionally blank (fill-in fields for the employer).
- Page 2 shows ALL member lines, wrapping to additional pages if `memberCount > ~40` (A4/Letter page limit).

---

## 15. Adjustments

Adjustments are signed-integer-cent corrections applied to a generated invoice. Unlike the Invoice Calculator's `invoiceAdjustments` (which correct internal dispersal records), list-bill invoice adjustments change what the employer OWES.

**Examples:**
- A member terminated mid-month → `-$14.99` (prorated MO credit)
- An enrollment was missed last month → `+$14.99` (retroactive MO charge)
- Manual discount negotiated with employer → `-$50.00`

### 15.1 Adjustment Timing

Adjustments can be applied to:
- **Current invoice:** via `applyAdjustment` before payment
- **Next invoice:** as a `carriedForwardCents` field on the next generated invoice

Adjustments on a `voided` invoice have no effect (carry forward to the replacement).

---

## 16. Invariants

| ID | Rule |
|---|---|
| **LBI-01** | `subtotalCents = sum(lines[i].rateCents)` — always. |
| **LBI-02** | `totalCents = subtotalCents + adjustmentCents` — always. |
| **LBI-03** | `balanceCents = totalCents - amountPaidCents` — always. |
| **LBI-04** | `moCount + msCount + mfCount = memberCount = lines.length` |
| **LBI-05** | A voided invoice may never be updated (status transitions blocked). |
| **LBI-06** | `amountPaidCents ≥ 0` and `amountPaidCents ≤ totalCents` always. |
| **LBI-07** | Invoice numbers are globally unique and never reused (even after void). |
| **LBI-08** | Closed-period invoices (status ∈ `{paid, voided}`) are immutable — no field edits except `pdfStorageId`. |
| **LBI-09** | `billingDate ≤ coverageStart` (invoice is issued before or at coverage start). |

---

## 17. Test Fixtures — Spec §17

Vitest tests at `convex/admin/listBillInvoices.test.ts`:

| # | Fixture | What's verified |
|---|---|---|
| T1 | Empty list-bill group | `generateInvoice` produces `memberCount=0`, `totalCents=0`, status=draft |
| T2 | 1 MO primary, no deps | `tier=MO`, `rateCents=moCents`, LBI-01..04 |
| T3 | 1 MS primary (spouse dep) | `tier=MS`, `rateCents=msCents` |
| T4 | 1 MF primary (child dep) | `tier=MF`, `rateCents=mfCents` |
| T5 | 1 MF primary (spouse + child) | MF wins over MS |
| T6 | 1 primary, 1 dep with no `relationship` set | Conservative MO |
| T7 | Terminated dependent → not counted | `tier=MO` despite terminated dep in DB |
| T8 | 18 MO members at $57.95 | `totalCents=18×5795=104310`, matches image reference |
| T9 | Mixed MO/MS/MF roster | LBI-04 holds, product summary correct |
| T10 | `generateInvoice` idempotency | Second call returns existing draft, no duplicate |
| T11 | `recordPayment` full → paid | Status transitions, `balanceCents=0` |
| T12 | `recordPayment` partial | Status=partial, correct `balanceCents` |
| T13 | `applyAdjustment` negative | `totalCents` decreases, LBI-01/02/03 hold |
| T14 | `voidInvoice` blocks further mutations | Subsequent `recordPayment` throws |
| T15 | Invoice number auto-increment | Two invoices get consecutive numbers |
| T16 | Overdue detection cron | Past-due issued invoice transitions to overdue |
| T17 | `previewInvoice` matches `generateInvoice` | Same member lines, same totals |
| T18 | Rate resolution priority | Group rate overrides account default overrides dispersal default |

---

## 18. Open Decisions / Future Work

1. **Proration**: Currently out-of-scope. Mid-month enrollments and terminations are rounded to full months. A proration engine (§ TBD) will need a `proratedDays` field per line item.

2. **Email delivery**: The `issueInvoice` mutation should trigger a Resend email with the PDF attached (or a link). Integration with the Resend email system is deferred to the email-delivery sprint.

3. **ACH debit pull**: For groups with `listBill.paymentMethod = "ach"`, Ideal Health may initiate the ACH debit directly via Stripe Treasury. This requires linking a `stripeCustomerId` on the account.

4. **MS tier pricing**: Currently MS and MF share the same rate (`msCents` and `mfCents` are both specified but could be the same value). If future negotiations differentiate spouse vs. full-family, the spec already supports it.

5. **Multi-product groups**: The current model assumes one `rateLabel` per group. Groups with multiple products (e.g., dental + health combo) need a `lines[i].productId` reference and a multi-product product summary. Deferred.

6. **Employer portal**: A read-only employer-facing view of their own invoices (no Clerk admin account required) via a signed magic link. Deferred.

7. **Invoice aging email alerts**: Automated email when an invoice reaches 30 / 60 / 90 days overdue. Deferred.

---

## Appendix A — Reference Invoice Analysis

From the provided reference images (Top Notch Security, Invoice #10113):

| Field | Value | Notes |
|---|---|---|
| Group | Top Notch Security | `groups.name` |
| Org Code | 897059 | `groups.organizationCode` |
| Invoice # | 10113 | Sequential from counter |
| Billing Date | April 15, 2026 | ~2 weeks before coverage start |
| Coverage Period | May 1–31, 2026 | Full calendar month |
| Members | 18 | All MO tier |
| Product | Financial Shield (List Bill) - Member Only | `rateLabel` + tier suffix |
| Rate | $57.95 | `moCents = 5795` on this group |
| Total | $1,043.10 | 18 × $57.95 = $1,043.10 ✓ |
| Adjustments | $0.00 | No corrections this period |
| Payment Due | April 15, 2026 | Same day as billing date (immediate) |
| Invoice History | Current: $1,043.10 | No prior open balances |

**Key observation:** All 18 members are `MO`. The `MS` and `MF` tiers are not present in this particular group's invoice — the Product Summary shows only one row. The implementation must omit zero-count rows from Product Summary.
