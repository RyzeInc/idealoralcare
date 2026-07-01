# Finance Platform — Comprehensive Evaluation & Gap Analysis

**Date:** 2026-06-30
**Status:** Evaluation only — no code changes made
**Trigger:** Can we reproduce the Trustmark "List Bill Report" from data we already
hold, and is the Admin → Finance section comprehensive/flexible enough to serve
many employers with different preferred billing methods (employer-paid vs
employee-deduction list bill), plus drive Careington eligibility, provisioning,
invoicing, statements, multi-format eligibility ingestion, and partner payouts.

---

## 0. TL;DR

| Capability | Verdict | Notes |
|---|---|---|
| Reproduce Trustmark **field set** (SSN, Emp #, Name, Location, Dept, Amount, Eff. Date) | 🟡 Mostly | Fields are captured + in column registry, **but only the CSV export renders them — the PDF is fixed-column** |
| Reproduce Trustmark **employee-vs-employer deduction split** | 🔴 No | We model a single premium per member; no cost-share concept anywhere |
| Reproduce Trustmark **per-member Expected vs Remitted reconciliation + reason codes** | 🔴 No | Payment is tracked at the invoice level only |
| Reproduce Trustmark **location-grouped subtotals** | 🔴 No | Invoice lines are a flat list sorted by last name |
| Flexible eligibility ingestion (many formats) | 🟡 Partial | 5 formats, but detection + column synonyms are hard-coded; no admin-defined mapping |
| Careington outbound eligibility file | 🟢 Yes | `vendorFiles.ts` produces the pipe-delimited file |
| User provisioning (Clerk + entitlements) | 🟢 Yes | `eligibilityProvisioning.ts` |
| Invoices to be paid to us (list bill) | 🟡 Partial | Solid lifecycle/aging; missing cost-share, reconciliation, grouping |
| Statements (account-level) | 🔴 No | Only per-invoice PDF + aging summary; no statement-of-account |
| Partner payouts | 🟡 Partial | Read-only payable reports exist; no payout batches, remittance files, or vendor-bill reconciliation |
| Internal revenue dispersal | 🟢 Yes | `invoiceCalculator.ts` is well-built (immutable period snapshots, INV-01 invariant) |
| **List-bill billing model coherence** | 🔴 **Fragmented** | **Two parallel systems** (`billing.ts`+`listBillPayments` vs `listBillInvoices.ts`) and **3+ rate sources** disagree — see §3.0 |
| Outbound vendor eligibility (Careington/DialCare/DDN/Essentials) | 🟡 Partial | 4 separate **hard-coded** generators; new vendor/format = code |
| External billing feed (E123) | 🟡 Partial | `billing.ts` emits a CSV feed for **E123**; coexists with native invoices — boundary undefined |

**Bottom line:** The plumbing is good and the data model already captures most of
the *raw fields* Trustmark uses. The gaps are **structural billing concepts**
(employee/employer cost-share, per-member remittance reconciliation, reason codes,
location grouping) and **flexibility surfaces** (admin-defined eligibility mapping,
effective-dated multi-product rates, a unified reporting/export hub). None of these
exist today; they require schema + logic additions, not just UI polish.

---

## 1. The Trustmark "Preferred Method" — Decoded

Source file: `2026.05 ZL005 Trustmark Invoice.xlsx` (single sheet, 86 rows). It is a
**carrier-issued List Bill Report** for client *Soar Restaurants II, LLC (9235)* —
i.e. exactly the employee-deduction list-bill scenario the request calls out.

### 1.1 Document anatomy

```
TRUSTMARK VOLUNTARY BENEFITS                 ← carrier header
Dept 91791 / 75 Remittance Drive / Chicago   ← remittance block
ClientServicesVB@trustmarkbenefits.com       ← contact

LIST BILL REPORT AS OF 04/30/2026            ← report title + "as of" date
Soar Restaurants II, LLC(9235)               ← client name + carrier group #
Payment Due Date: 05/25/2026
Deduction Period: 04/01/2026 - 04/30/2026
Invoice Number: 00923505252026               ← composite: group(9235)+dueDate(05252026)

REASON CODE DESCRIPTIONS:
  T  - Terminated Employee     L  - Leave Of Absence     EC - Employee Cancel
  N  - No Record Of Employee   O  - Other Reason
```

### 1.2 Column set (the detail grid)

| # | Header | Our source field | Status |
|---|---|---|---|
| A | EMPLOYEE SSN | `memberProfiles.ssn` | ✅ captured (census parser) |
| B | EMPLOYEE NUMBER | `memberProfiles.groupMemberId` | ✅ captured |
| C | EMPLOYEE NAME (Last, First) | `lastName` / `firstName` | ✅ |
| D | LOCATION | `memberProfiles.location` | ✅ captured |
| E | DEPARTMENT | `memberProfiles.department` | ✅ captured |
| F | TOTAL EMPLOYEE DEDUCTION **EXPECTED** | — | ❌ no cost-share split |
| G | TOTAL EMPLOYEE DEDUCTION **REMITTED** | — | ❌ no per-member remittance |
| H | TOTAL EMPLOYER DEDUCTION **EXPECTED** | — | ❌ no cost-share split |
| I | TOTAL EMPLOYER DEDUCTION **REMITTED** | — | ❌ no per-member remittance |
| J | TOTAL AMOUNT BILLED | `lines[].rateCents` / `monthlyPremiumCents` | ✅ |
| K | REASON CODE | — | ❌ no per-member reason code |
| L | CHANGE EFFECTIVE DATE | `memberProfiles.effectiveDate` | ✅ captured |

### 1.3 Structure beyond columns

- **Grouped by LOCATION** (`Soar 2`, `SOAR II`, `Soar IV`, `SOAR VI`, `Soar V`,
  `SOAR`) with a `Total For: <location>` subtotal after each group. → ❌ we render
  a flat list.
- **File Total** + footer counters (`NUMBER OF ITEMS ON REPORT`,
  `TOTAL DEDUCTION EXPECTED`, `TOTAL DEDUCTION REMITTED`). → 🟡 we have totals but
  not the expected/remitted dichotomy.
- **Per-member premiums are arbitrary amounts** (e.g. $107.51, $166.81, $31.57),
  not flat tier rates — these are voluntary-benefit sums per employee. → ✅ our
  `monthlyPremiumCents` override already supports arbitrary per-member amounts.

> Important nuance: in this Soar report the employer contribution columns are all
> $0 — it is a 100% employee-deduction (voluntary) bill. The *expected vs remitted*
> columns are how the carrier reconciles what payroll **should** deduct against what
> the employer **actually** remitted, member by member, tagging discrepancies with
> reason codes. That reconciliation loop is the heart of "list bill" and is the
> single biggest thing we do not model.

---

## 2. Can we generate this invoice from data we already have?

**Partially — about 7 of the 12 columns, and none of the reconciliation structure.**

### 2.1 What already works in our favor

- The census/eligibility parser (`convex/admin/eligibility.ts → parseCensusCsv`)
  already captures **SSN, Employee #, Location, Department, Effective Date, per-member
  premium, and tier code** from a Soar-style file and stores them on
  `memberProfiles`.
- The **invoice column registry** (`convex/admin/listBillInvoices.ts →
  INVOICE_COLUMN_REGISTRY`) already defines `ssn`, `groupMemberId` (Employee #),
  `employeeName`, `location`, `department`, `effectiveDate`, `tierCode`, and
  `rate` — and these are admin-toggleable per group via `groups.listBill.invoiceColumns`.
- The invoice **lines snapshot** (`listBillInvoices.lines[]`) already persists
  `ssn`, `location`, `department`, `effectiveDate`, `groupMemberId`,
  `monthlyPremiumCents`, and `tierCode`.

So the **CSV export** of a list-bill invoice can already approximate the Trustmark
column layout for a group like Soar.

### 2.2 What blocks a true match

1. **The PDF renderer ignores the column registry.**
   `src/app/api/admin/list-bill-invoices/[invoiceId]/group-pdf/route.ts` hard-maps
   only `memberId, lastName, firstName, productLabel, rateCents`. SSN, Location,
   Department, Employee #, and Effective Date are dropped on the PDF even though
   they exist on the line. → The "preferred invoice" as a *document* can't be
   produced today; only the CSV can.

2. **No employee/employer cost-share.** There is exactly one amount per member
   (`rateCents`). Columns F–I (employee vs employer, each expected vs remitted)
   cannot be derived. This needs a contribution-split model on the rate and/or
   per-member.

3. **No per-member remittance reconciliation.** Payment is tracked only at the
   invoice level (`amountPaidCents`, `balanceCents`, aging buckets). There is no
   "this employee's expected $X, remitted $Y" ledger, so columns G/I and the
   `TOTAL DEDUCTION REMITTED` footer are impossible without new structure.

4. **No reason codes.** We have `listBillStatus` (`active|termed|converted`) but
   not carrier-style change/discrepancy codes (T/L/EC/N/O) per member per period.

5. **No location grouping/subtotals** in the invoice builder
   (`buildInvoiceLines` sorts flat by last name).

6. **Invoice numbering** is a plain sequential counter
   (`counters["listBillInvoiceSeq"]`), not the composite `group#+dueDate` format —
   cosmetic and easily configurable, low priority.

---

## 3. Module-by-module evaluation (Admin → Finance)

The Finance section (`src/components/admin/AdminSidebar.tsx`) has four entries:
**Billing, List-Bill Invoices, Invoice Calculator, Commissions**. Eligibility/Vendor
Files live under **Operations**. Here is the comprehensiveness read on each.

### 3.0 ⚠️ Critical structural finding — TWO parallel list-bill systems + 3 rate sources

This is the single biggest reason the Finance area "feels not fully fleshed out."
There are **two independent implementations of list-bill billing** that do not share
a model, plus **at least three disagreeing rate sources**:

| | Legacy system | New system |
|---|---|---|
| **Code** | `convex/admin/billing.ts` | `convex/admin/listBillInvoices.ts` |
| **Table** | `listBillPayments` | `listBillInvoices` |
| **Unit** | member **count × flat rate** | per-member **tier (MO/MS/MF)** or premium override |
| **Rate** | `account.billingDetails.perMemberRateCents` (default **$15.00**); `getSiteBillingSummary` **hardcodes $15.00** | `groups.listBill.rates` → `account.customPricing[0]` → dispersal **$14.99/$24.99** |
| **Output** | `generateListBillInvoiceCsv` (E123 feed: group_code, member_count, rate, total) | per-invoice PDF + configurable-column CSV, full lifecycle/aging |
| **Payment** | `recordListBillPayment` (`listBillPayments`) | `recordPayment` (`listBillInvoices`) |
| **Audience** | external **E123** import | native employer-facing invoice |

**Consequences**
1. The same group can be represented in **both** tables with **different totals**
   (flat $15 vs tiered $14.99/$24.99) — there is no reconciliation between them.
2. **Three rate sources** (`billingDetails.perMemberRateCents`, `customPricing`,
   dispersal constants) means "the rate for a group" has no single answer.
3. `billing.ts` list-bill paths **bypass the `unifiedData` layer** that the rest of
   the billing reads use for consistency — so even the read models can diverge.
4. The **E123 boundary is undefined**: it's unclear whether E123 or our native
   `listBillInvoices` is the system of record for "invoices paid to us."

**Spec implication:** before adding Trustmark-style features, the two systems must be
**reconciled to one** (recommend: `listBillInvoices` becomes the system of record;
`listBillPayments` is migrated/retired; E123 becomes an *export target* of the new
model, not a parallel computation). This is a prerequisite, not an enhancement.


### 3.1 Billing (`/admin/billing`) — 🟡 thin

- **Is:** a summary of *Stripe-collected* billable revenue for E123 import; self-pay
  only. Explicitly excludes list-bill members.
- **Also hosts the legacy list-bill system** (§3.0): `getListBillMonthlySummary`,
  `recordListBillPayment`, `getListBillPaymentHistory`, `generateListBillInvoiceCsv`
  — a flat member-count × $15 model writing to `listBillPayments`, and an
  `generateBillingCsv` feed for the external **E123** system.
- **Gaps:** it is a read-only roll-up (for self-pay) plus a *second* list-bill
  engine (§3.0). No payment-method mix, no failed-payment/dunning view, no
  refunds/chargebacks surface, no link to Stripe disputes. Hardcoded $15 rates in
  `getSiteBillingSummary` and the $15 default in `getListBillMonthlySummary`
  disagree with the $14.99/$24.99 dispersal and any `customPricing`.

### 3.2 List-Bill Invoices (`/admin/list-bill-invoices`) — 🟡 good bones, missing list-bill essentials

- **Strong:** full lifecycle (`draft → issued → paid/partial/overdue → voided/disputed`),
  idempotent generation per `(group, period)`, frozen line snapshots, aging buckets
  (`computeAgingBucket`), per-group invoice column config, replacement/void chain,
  audit logging, monthly cron generation + overdue sweep.
- **Rate resolution** (`resolveRates`): group rates → account `customPricing` →
  dispersal defaults, with optional per-member premium override. Good baseline.
- **Gaps (ranked):**
  1. No **employee/employer cost-share** → cannot serve true list bill (§1.2 F–I).
  2. No **per-member remittance reconciliation** / reason codes (§1.3).
  3. No **location/department grouping + subtotals**.
  4. **PDF ≠ configurable columns** (§2.2 #1). Two divergent renderers (CSV honors
     the registry, PDF does not).
  5. **Effective-dated rates ignored.** `groups.listBill.rates.effectiveFrom`
     exists in schema but `resolveRates` never consults it — rate history can't be
     applied to back-period invoices.
  6. **Single product per group.** `customPricing[0]` only; a group buying more
     than one product/plan can't be billed for both on one invoice.
  7. **Tier code captured but unused for pricing.** `tierCode` ("EMP/ESP/ECH") is
     stored but rate is derived from dependent-count classification, not the
     employer's actual tier code → can disagree with the employer's own tiering.
  8. **Dual data model:** legacy `listBillPayments` coexists with `listBillInvoices`
     (documented as intentional, but it is latent tech debt / reconciliation risk).

### 3.3 Invoice Calculator (`/admin/invoice-calculator`) — 🟢 the strongest module

- Immutable monthly period snapshots (`invoicePeriods`), append-only corrections
  (`invoiceAdjustments`), enforced split invariant (INV-01:
  `gross == sum(splits)`), period-stamped pricing for historical reproducibility,
  payload hashing + git SHA provenance, per-vendor payable rollups
  (`getVendorPayables`). This is genuinely well-engineered.
- **Gaps:** the dispersal table is **hard-coded** to two tiers ($14.99 / $24.99) and
  five buckets (Toothlens/Careington/Processing/PartnerVendor/Ryze) in
  `convex/lib/dispersal.ts`. It cannot model a different revenue split for a
  different carrier/product, nor arbitrary per-member premiums (the list-bill
  $107.51-style amounts don't map into the fixed tier buckets). It is purpose-built
  for the Ryze/Ideal Health Oral Care economics, not a general ledger.

### 3.4 Commissions (`/admin/commissions`) — 🟡 partial

- `commissionPayables` has a real lifecycle (`pending → approved → paid → disputed/voided`),
  rates with agency overrides, period bucketing.
- **Gaps:** no payout **batch** entity, no remittance/export (ACH/check) file, no
  statement to the broker, no clawback automation on member cancellation beyond a
  `voided` status.

### 3.5 Eligibility ingestion (`/admin/eligibility`, Operations) — 🟡 functional, not flexible

- **Supports:** Careington pipe-delimited (`.txt`, fixed positional map), employer
  **census CSV** (header-driven via `pickCol` synonym lists + `isCensusCsv`
  heuristic), simple flat CSV, XLSX (Ideal census layout), JSON. Batched writes,
  member-ID counter, dependents grouped into families, delta/full/add/term actions.
- **Gaps:**
  1. **No admin-defined column mapping.** New employer layouts require a developer
     to extend `pickCol(...)` synonym lists or the positional map. There is no
     stored per-group/per-account **mapping template** to onboard a novel file
     without code.
  2. **Heuristic format detection** (`isCensusCsv`) is brittle; an unexpected header
     set silently falls through to the flat parser and may mis-ingest.
  3. **No employee/employer contribution columns** parsed (consistent with §2.2 #2).
  4. **No validation/preview-and-confirm** step surfaced for arbitrary files (errors
     are collected but mapping is not previewed before commit).
  5. **No fixed-width / EDI 834** support — common for larger carriers/TPAs.

### 3.6 Vendor / outbound files (`/admin/vendor-files`, Operations) — 🟢 for Careington, 🟡 generally

- `vendorFiles.ts` generates Careington pipe-delimited eligibility, DialCare CSV,
  and Dental Discount Network files, with SFTP delivery tracking
  (`vendorDeliveries`), SHA-256, date snapping rules, ID derivation. Solid.
- **A separate pipeline** `convex/admin/essentialsEligibility.ts` generates the
  **Essentials** product's outbound eligibility in **three** more formats — ARK,
  RxValet, and Combined (adds GroupID/PersonCode/CoverageType/Organization), with
  its own `coverageType` (EE/ES/EC/EF) logic and CSV escaping. So there are **four
  hard-coded outbound generators across two files**, each duplicating CSV/escaping
  helpers (`csvCell`, `toCsvRow`, `sanitizeCell`).
- **Reference specs on disk:** `Notes/sample eligibility files/` (Careington
  `SampleFile_CAREGRPS040120_full.txt`, `Ideal - Sample Census File.xlsx`) and
  `Notes/DialCare_Eligibility_File_Guide_Pipe_Efulfill_07212025.md`.
- **Gaps:** outbound formats are **hard-coded per vendor**; adding a new fulfillment
  partner needs code. No generic "outbound mapping template" mirror of the inbound
  gap; duplicated CSV helpers should be consolidated.

---

## 4. The seven workflows in the request — coverage matrix

| Workflow | Where it lives | Coverage | Key gap |
|---|---|---|---|
| **Careington eligibility** (outbound) | `vendorFiles.ts` (+ `essentialsEligibility.ts`, `careingtonEnrollments`), `vendorDeliveries` | 🟢 | 4 hard-coded generators; new vendor/format = code |
| **User provisioning** (Clerk + entitlements) | `eligibilityProvisioning.ts` | 🟢 | Dependents only auto-linked via primary invite |
| **Invoices paid to us** (list bill) | `listBillInvoices.ts` **and** `billing.ts`/`listBillPayments` **and** E123 feed | 🔴 | **Two engines + E123, 3 rate sources** (§3.0); plus cost-share, reconciliation, grouping, PDF columns |
| **Statements** | `getGroupAgingSummary`, group-pdf | 🔴 | No account statement (opening/closing balance over range) |
| **Ingest many eligibility formats** | `eligibility.ts` | 🟡 | No admin-defined mapping; no fixed-width/834 |
| **Pay out partners** | `getVendorPayables`, `commissionPayables`, `commissions.ts`, `distributionPartners.ts` | 🟡 | No payout batches / remittance files / vendor-bill reconciliation |
| **Take it from all directions** (DB persistence) | `memberProfiles`, `eligibilityFiles`, `careingtonEnrollments` | 🟢 | Solid normalized core |

---

## 5. Root-cause themes (what's actually missing)

Five structural concepts, not a pile of UI tweaks:

1. **Cost-share / contribution model.** A member's premium needs to decompose into
   *employee* and *employer* portions (and ideally per coverage line) so
   employer-paid, employee-deduction, and split-cost groups all flow through one
   model. This unblocks Trustmark columns F–I and the employer-paid vs
   employee-deduction distinction.

2. **Per-member remittance ledger.** A `(invoice, member, period)` row tracking
   *expected* vs *remitted* with a **reason code** enum. This unblocks columns G/I/K,
   the footer reconciliation, and real list-bill operations (handling the employer
   who pays a different amount than billed).

3. **Configurable mapping templates (inbound + outbound).** A stored, admin-editable
   field-map per group/account/vendor so new eligibility layouts and new fulfillment
   partners onboard without code. Turns ingestion from "developer ticket" into "admin
   task."

4. **Effective-dated, multi-product rate book.** Replace single-product
   `customPricing[0]` + ignored `effectiveFrom` with a rate table keyed by
   `(group/account, product, tier, effectiveFrom)`, honored by both `resolveRates`
   and back-period regeneration.

5. **Reporting/statement layer.** A unified export/report surface: account
   statements (opening balance → charges → payments → closing), partner payout
   batches with remittance files, and vendor-bill reconciliation (what
   Careington/Toothlens actually invoiced us vs what the calculator computed).

6. **System consolidation (prerequisite, §3.0).** Collapse the two list-bill
   engines into one system of record, unify the 3 rate sources behind the rate book
   (#4), and make E123 / Essentials / vendor files **export targets** of that single
   model rather than parallel computations. Without this, every report below can
   produce two different "truths" for the same group.

---

## 6. Recommended sequencing (if/when we proceed — not started)

Phased so each step is independently shippable and testable.

- **P0 — Make the document match the data we already have.**
  Wire the PDF renderer to the per-group `invoiceColumns` registry (it already
  exists for CSV). Add optional **location grouping + subtotals** and the
  expected/remitted/reason-code columns as *display-only* placeholders. Low risk,
  immediate visible win toward the Trustmark layout. (No schema change.)

- **P1 — Cost-share + per-member remittance ledger.**
  Add `employeeCents`/`employerCents` to rate config and invoice lines; add a
  `listBillMemberRemittances` table (expected/remitted/reasonCode). Unblocks true
  list bill and Trustmark F–K. (Schema + logic.)

- **P2 — Mapping templates for eligibility ingestion.**
  Stored per-group field map + a preview/confirm UI; keep current parsers as
  built-in templates. Optionally add fixed-width / 834. (Schema + UI.)

- **P3 — Effective-dated, multi-product rate book.**
  Generalize `resolveRates`; honor `effectiveFrom`; support >1 product per group.

- **P4 — Reporting/statement + payout batches.**
  Account statements, partner payout batches + remittance export, vendor-bill
  reconciliation against the Invoice Calculator.

---

## 7. Evidence index (files read for this evaluation)

- Trustmark format: `2026.05 ZL005 Trustmark Invoice.xlsx` (Downloads)
- List-bill engine: `convex/admin/listBillInvoices.ts`
- Revenue dispersal: `convex/admin/invoiceCalculator.ts`, `convex/lib/dispersal.ts`
- Schema: `convex/schema.ts` (`groups.listBill`, `memberProfiles`,
  `listBillInvoices`, `listBillPayments`, `invoicePeriods`, `invoiceAdjustments`,
  `eligibilityFiles`, `vendorDeliveries`, `careingtonEnrollments`,
  `commissionPayables`)
- Ingestion: `convex/admin/eligibility.ts`, `convex/admin/eligibilityProvisioning.ts`
- Outbound: `convex/admin/vendorFiles.ts`, `convex/admin/essentialsEligibility.ts`
- Legacy/feed billing: `convex/admin/billing.ts` (`listBillPayments`, E123 CSV),
  `convex/admin/unifiedData.ts` (read consolidation layer)
- Partner payouts: `convex/admin/commissions.ts`, `convex/admin/distributionPartners.ts`
- CSV safety: `convex/lib/sanitize.ts` (`toCsvRow`/`sanitizeCsvValue`)
- Vendor format refs: `Notes/sample eligibility files/` (Careington full txt, Ideal
  census xlsx), `Notes/DialCare_Eligibility_File_Guide_Pipe_Efulfill_07212025.md`
- UI: `src/components/admin/AdminSidebar.tsx`,
  `src/app/admin/list-bill-invoices/**`,
  `src/app/api/admin/list-bill-invoices/[invoiceId]/group-pdf/route.ts`,
  `src/app/admin/billing/page.tsx`
- Existing specs: `docs/internal/LIST_BILL_INVOICE_SPEC.md`,
  `docs/internal/INVOICE_CALCULATOR_SPEC.md`

---

# Part II — Total Spec: Unified Reporting & Billing Architecture

> Purpose: directly answer the broader request — "generate reports that work for
> Careington eligibility, user provisioning, invoices paid to us, statements,
> ingesting many eligibility formats, and paying out partners — from all
> directions." This part defines the **target model** and a **report catalog**.
> Nothing here is implemented yet.

## 8. Target architecture (one model, many exports)

```
                         ┌──────────────────────────────┐
  INBOUND (any format)   │   CANONICAL DATA (today)      │   OUTBOUND (exports)
                         │                              │
 Careington pipe .txt ─┐ │  memberProfiles              │ ┌─ Careington elig (SFTP)
 Soar/Trustmark census┐│ │  + contributions (NEW)       │ │  DialCare / DDN
 Ideal census .xlsx   ├┼▶│  groups / accounts           │─┼─ Essentials ARK/RxValet
 Flat CSV / JSON      ┘│ │  rateBook (NEW)              │ │  E123 billing feed
 Fixed-width / 834 (NEW)│ │  listBillInvoices (SoR)      │ │  Partner payout remittance (NEW)
                         │  + memberRemittances (NEW)   │ └─ Account statements (NEW)
   via MAPPING TEMPLATE  │  invoicePeriods (dispersal)  │   via MAPPING TEMPLATE
        (NEW)            │  commission/vendor payables  │        (NEW)
                         └──────────────────────────────┘
```

Two new cross-cutting primitives make every direction work without per-customer
code:

- **Mapping templates** (`fieldMappingTemplates`, NEW) — a stored, admin-editable
  field map keyed by `(direction: in|out, target, version)`. Inbound: maps arbitrary
  columns → canonical member fields incl. **employee/employer contribution**.
  Outbound: maps canonical fields → a vendor's column order/labels/format. The
  current hard-coded parsers and generators become *built-in default templates*.
- **Rate book** (`rateBook`, NEW) — effective-dated rows keyed by
  `(scope, productId, tier|tierCode, effectiveFrom)` carrying
  `totalCents`, `employeeCents`, `employerCents`, `rateLabel`. Single source of
  truth consumed by invoices, dispersal, and statements.

## 9. New/changed data model (proposal)

```ts
// 9.1 Contribution split — on memberProfiles AND on invoice lines
contribution: {
  totalCents: number,        // = employeeCents + employerCents
  employeeCents: number,     // payroll-deducted portion
  employerCents: number,     // employer-paid portion
  source: "eligibility_file" | "rate_book" | "manual",
}

// 9.2 listBillMemberRemittances (NEW) — per-member expected vs remitted
{
  invoiceId, groupId, memberProfileId, coveragePeriod,
  expectedEmployeeCents, expectedEmployerCents, expectedTotalCents,
  remittedEmployeeCents, remittedEmployerCents, remittedTotalCents,
  reasonCode: "T"|"L"|"EC"|"N"|"O"|"OK",   // Terminated/Leave/EmpCancel/NoRecord/Other
  changeEffectiveDate?: string,
  // → unblocks Trustmark cols F–L + the expected/remitted footer
}

// 9.3 rateBook (NEW) — replaces customPricing[0] + ignored effectiveFrom
{ scope:{accountId?,groupId?}, productId, tierCode, effectiveFrom,
  totalCents, employeeCents, employerCents, rateLabel }

// 9.4 fieldMappingTemplates (NEW) — inbound + outbound
{ direction:"in"|"out", target:"careington"|"dialcare"|"ddn"|"essentials"|"e123"|"census"|...,
  fileFormat:"csv"|"xlsx"|"pipe"|"fixed"|"834"|"json", version,
  fields:[{ canonical, source, transform?, maxLen?, required? }], builtIn:boolean }

// 9.5 payoutBatches (NEW) — partner/vendor remittance
{ payeeType:"broker"|"vendor", payeeId, period, lineIds:[...],
  method:"ach"|"check"|"wire", totalCents,
  status:"draft"|"approved"|"sent"|"reconciled", remittanceFileStorageId? }

// 9.6 statements (NEW) — account/group statement of account
{ scope:{accountId|groupId}, periodStart, periodEnd,
  openingBalanceCents, charges:[...], payments:[...], adjustments:[...],
  closingBalanceCents, pdfStorageId }
```

## 10. Report catalog (the seven directions, concretely)

Each report = a server query/action producing a typed dataset + a renderer (CSV,
PDF, or SFTP file). All share the canonical model so totals reconcile.

| # | Report | Direction | Input | Output | Status today | Needs |
|---|---|---|---|---|---|---|
| R1 | **Careington/DialCare/DDN eligibility** | OUT | canonical members | pipe/CSV via SFTP | 🟢 exists (hard-coded) | move to mapping template |
| R2 | **Essentials eligibility** (ARK/RxValet/Combined) | OUT | canonical members | CSV | 🟢 exists (hard-coded) | merge into R1 template engine |
| R3 | **Provisioning report** (who got Clerk + entitlements, who failed/missing email) | INTERNAL | eligibility file | table/CSV | 🟡 partial (`getProvisionableMembersForFile`) | add failure/exception report + dependent linkage status |
| R4 | **List-bill invoice** (Trustmark layout) | OUT (employer) | canonical + rateBook + remittances | PDF + CSV, location-grouped, EE/ER split, reason codes | 🟡 CSV partial / PDF fixed | §9.1/9.2 + PDF honors columns + grouping |
| R5 | **E123 billing feed** | OUT (system) | listBillInvoices (SoR) | CSV | 🟡 separate computation | derive from R4 model, not flat $15 |
| R6 | **Account/group statement** | OUT (employer) | invoices + payments + adjustments | PDF | 🔴 none | §9.6 statements table + renderer |
| R7 | **Internal dispersal & vendor payables** | INTERNAL | invoicePeriods | table/CSV | 🟢 exists | generalize dispersal beyond 2 tiers |
| R8 | **Partner/broker payout + remittance** | OUT (partner) | commissionPayables | batch + ACH/check file | 🟡 payables only | §9.5 payoutBatches + remittance file |
| R9 | **Vendor-bill reconciliation** (what Careington/Toothlens billed us vs computed) | INTERNAL | vendor invoices + invoicePeriods | variance table | 🔴 none | ingest vendor bills + compare |
| R10 | **Eligibility ingestion result** (new/updated/termed/errors per file) | INTERNAL | eligibilityFiles | table | 🟢 exists | add mapping-preview + per-row diagnostics |

## 11. Acceptance criteria (definition of "comprehensive")

- **AC-1 (one truth):** for any `(group, period)`, R4, R5, R6, and R7 reconcile to
  the cent; no group is computed by two engines.
- **AC-2 (Trustmark parity):** R4 reproduces the reference layout — header/remit
  block, location grouping + subtotals, EE/ER expected vs remitted, reason codes,
  file total, item count — from stored data, as **both** PDF and CSV.
- **AC-3 (onboard without code):** a brand-new employer eligibility layout and a
  brand-new vendor outbound format can each be added by an admin via a mapping
  template, with a preview-and-confirm step, no deploy.
- **AC-4 (cost models):** employer-paid, 100% employee-deduction (Soar/Trustmark),
  and split-cost groups all flow through the same contribution model.
- **AC-5 (payouts close the loop):** partner payouts produce an approved batch + a
  remittance file, and vendor bills can be reconciled against computed payables.
- **AC-6 (auditability):** every report is reproducible for a closed period from
  immutable snapshots (extend the `invoicePeriods` discipline to list-bill).

## 12. Revised sequencing (supersedes §6 where they conflict)

- **P0 — Consolidation + PDF parity (prerequisite).** Pick `listBillInvoices` as
  SoR; make `billing.ts`/E123 read from it; wire PDF to the column registry; add
  location grouping. (Mostly logic; unblocks AC-1 partially + AC-2 partially.)
- **P1 — Contribution model + per-member remittance ledger** (§9.1/9.2). → AC-2,
  AC-4, R4/R5.
- **P2 — Rate book** (§9.3). → AC-1, effective-dated/multi-product.
- **P3 — Mapping templates, inbound then outbound** (§9.4). → AC-3, R1/R2/R10.
- **P4 — Statements + payout batches + vendor reconciliation** (§9.5/9.6). → AC-5,
  R6/R8/R9.

## 13. Open questions for the client (need answers before P0 build)

1. **E123 vs native invoices:** which is the system of record for "invoices paid to
   us"? Does E123 stay, or do we replace its feed with native invoices?
2. **Contribution data source:** will employers always send EE/ER split in the
   eligibility file (like a future Soar/Trustmark feed), or do we derive it from a
   configured employer-contribution rule per group?
3. **Reason codes:** do we adopt Trustmark's exact set (T/L/EC/N/O) or a superset?
4. **Statement cadence/recipients:** per-group monthly? per-account rollup? who
   receives them and through what channel (email/SFTP/portal)?
5. **Partner remittance rails:** are payouts ACH (which bank/file format —
   NACHA?), check, or wire? This determines the R8 remittance format.
6. **Carrier scope:** is this Oral Care only, or must the same engine serve
   Essentials and future carriers (drives how general the rate book/dispersal must
   be)?

