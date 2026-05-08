# Invoice Calculator — Comprehensive Specification

**Status:** Living document
**Owner:** Finance Engineering (Ryze Nexus / Ideal Health)
**Audience:** Engineers, finance ops, compliance, future maintainers
**Last revised:** 2026-05-06
**Source modules:**
- [convex/lib/dispersal.ts](../../convex/lib/dispersal.ts)
- [convex/admin/invoiceCalculator.ts](../../convex/admin/invoiceCalculator.ts)
- [src/app/admin/invoice-calculator/page.tsx](../../src/app/admin/invoice-calculator/page.tsx)

---

## 1. Purpose & Scope

Authoritative tool for answering:

> **"For a given period, how much do we invoice each payer, and how must each dollar be dispersed across vendors, processors, the carrier, and the partner?"**

### Consumers

| Consumer | Primary need |
|---|---|
| **Finance / AR** | Per-employer monthly invoice amounts (list-bill payers). |
| **Finance / AP** | Vendor payable batches (Toothlens, Careington, processing rebates, partner-vendor remittance). |
| **Carrier accounting (Ryze)** | Net carrier revenue retained, after pass-throughs and partner share. |
| **Audit / compliance** | Reproducible, time-bound proof that revenue and dispersal totals reconcile to penny-level precision for any historical billing period. |

### In scope
- All active subscriptions on the Oral Care plan family (Individual `$14.99`, Family `$24.99`).
- Both self-pay (member CC/ACH via Stripe) and employer-paid (list-bill / payroll-deducted) groups.
- Per-group, per-account, per-distribution-partner, and grand-total roll-ups.
- Time-bound reporting for any month (current or historical).

### Out of scope (initially)
- Commission payouts to brokers — owned by [convex/admin/commissions.ts](../../convex/admin/commissions.ts). The calculator surfaces inputs commissions can read; it does not pay agents.
- Tax computation, regulatory premium-tax filing, or 1099/1099-K generation.
- Cash application (matching received funds against invoices). The calculator produces the *expected* numbers; reconciliation against actual receipts is a separate ledger concern (see §10).
- Refund / chargeback adjustments to historical periods (see §9).

---

## 2. Revenue Model (Source of Truth)

### 2.1 Per-member revenue rules

| Member role | Plan tier | Gross / month |
|---|---|---|
| Primary | Individual (`oral-health-individual`) | `$14.99` |
| Primary | Family (`oral-health-family`) | `$24.99` |
| Dependent (any relationship) | n/a — rides on primary's bundle | `$0.00` |
| Active primary with no paying bundle | n/a (employer-comped, pending payment, free trial) | `$0.00` (counted as `unbilledPrimaryCount`) |

**Rationale for `$0` dependents:** Family pricing already includes the entire household. Charging per-dependent would double-bill. Dependents are tracked for roster size, ID-card issuance, and Toothlens account provisioning, but generate no incremental invoice line.

### 2.2 Per-primary dispersal table (stated splits)

| Bucket | Individual ($14.99) | Family ($24.99) | Notes |
|---|---:|---:|---|
| Toothlens (AI detection license) | `$1.00` | `$1.00` | Per primary, regardless of household size. |
| Careington (network access) | `$2.00` | `$2.00` | Per primary, regardless of household size. |
| Processing (Stripe / Ryze) | `$1.00` | `$2.00` | Higher on Family because card fees scale with charge size. |
| Partner Vendor (Ideal Health) | `$6.00` | `$11.00` | Marketing, member services, brand ownership. |
| Ryze Keep (carrier residual) | `$5.00` *stated* / **$4.99 actual** | `$9.00` *stated* / **$8.99 actual** | See §2.3. |
| **Stated sum** | **$15.00** | **$25.00** | |
| **Actual gross** | **$14.99** | **$24.99** | |

### 2.3 Penny-rounding convention (CRITICAL)

The stated splits sum to round dollars (`$15` / `$25`) but the actual SKU is priced at `$14.99` / `$24.99`. The `$0.01` per-primary variance is **absorbed by Ryze Keep**, computed as the residual:

```
ryzeKeepCents = grossCents − toothlensCents − careingtonCents − processingCents − partnerVendorCents
```

| Tier | Computed Ryze Keep |
|---|---:|
| Individual | `1499 − 100 − 200 − 100 − 600` = **`499¢` ($4.99)** |
| Family | `2499 − 100 − 200 − 200 − 1100` = **`899¢` ($8.99)** |

This guarantees the **invariant** that for every primary, every period:

```
sum(splits) === grossCents
```

No rounding errors leak across periods. All math is performed in **integer cents**; never use floats for money.

---

## 3. Data Model & Derivation

### 3.1 Source tables (Convex)

| Table | Role in calculator |
|---|---|
| [`memberProfiles`](../../convex/schema.ts) | Roster. Filter: `memberType === "active"`. Classify by `memberRole` (`"primary"` vs `"dependent"`). Group via `groupId`. |
| [`subscriptionBundles`](../../convex/schema.ts) | Determines tier per primary. Filter: `status === "active"`. Tier from `pricingSnapshot.totalCents`. |
| [`groups`](../../convex/schema.ts) | Org metadata + `listBill.enabled` (employer-paid flag). |
| [`accounts`](../../convex/schema.ts) | Parent of groups. Carries `billingDetails.perMemberRateCents` and `accountType`. |
| [`distributionPartners`](../../convex/schema.ts) | Future: attribution of revenue to FMOs / agencies (see §10). |
| [`brokerTrackingCodes`](../../convex/schema.ts) | Future: per-rep attribution. |

### 3.2 Tier classification

```ts
classifyTier(bundle.pricingSnapshot.totalCents)
  1499 → "individual"
  2499 → "family"
  *    → "none"   // employer-comped $0 bundle, legacy pricing, or null
```

Bundles failing this match are intentionally excluded from revenue and counted as `unbilledPrimaryCount` so finance can investigate. Adding a new SKU price (e.g., grandfathered legacy rate) requires extending `classifyTier` *and* the dispersal table — **never silently widen the matcher**.

### 3.3 Member → tier resolution

1. Skip member if `memberType !== "active"`.
2. If `memberRole === "dependent"` → contributes `0` to all buckets, increments `dependentCount`.
3. Else (primary or legacy unset role):
   - Look up `tierByCustomer[member.customerId]` from active bundles.
   - If a customer somehow has multiple active bundles, Family wins over Individual (defensive; should not happen).
   - If no matching bundle → `unbilledPrimaryCount`.

### 3.4 Employer-paid vs self-pay classification

A group is **employer-paid** iff `group.listBill.enabled === true`. This drives:
- Which roll-up bucket the group totals land in (`employerPaid` vs `selfPay`).
- Which UI badge is shown.
- Which CSV downstream system the row feeds (E123 list-bill import vs Stripe reconciliation).

A group with `listBill.enabled` *and* members carrying paying bundles is a hybrid (e.g., FT employees on payroll deduction + PT employees on self-pay). The calculator handles this implicitly because tier comes from each member's own bundle.

---

## 4. Aggregation Hierarchy

```
Grand Total
├── Employer-Paid (listBill.enabled === true)
│   └── per-account
│       └── per-group
│           └── per-tier
└── Self-Pay (listBill.enabled !== true)
    └── per-account
        └── per-group
            └── per-tier
```

Each node carries the same `DispersalSplit` shape (`grossCents`, `toothlensCents`, `careingtonCents`, `processingCents`, `partnerVendorCents`, `ryzeKeepCents`) plus head counts:
- `activeMemberCount`
- `individualPrimaryCount`
- `familyPrimaryCount`
- `dependentCount`
- `unbilledPrimaryCount`

**Invariant:** For any node, `grossCents === sum(child.grossCents)` and the same holds for every split bucket.

---

## 5. Time-Bound Reporting

The current implementation returns a real-time snapshot. The full spec requires four reporting modes; design the storage and query layer to support all four from day one.

### 5.1 Reporting modes

| Mode | Period definition | Use case | Query input |
|---|---|---|---|
| **Live snapshot** | "Right now" — every active member × current bundle. | Operational dashboards, intra-month forecasting. | none (default) |
| **Calendar month** | UTC `[2026-05-01T00:00, 2026-06-01T00:00)`. Membership counted at end-of-day on the last day of the month. | Standard monthly invoicing, the default for AR/AP cycles. | `{ year, month }` |
| **Custom window** | Arbitrary `[start, end)` ISO range. | Mid-cycle adjustments, audits, true-ups. | `{ startMs, endMs }` |
| **As-of snapshot** | Membership state as it existed at a single instant `T`. | Audit reproduction ("show me what we billed on 2026-05-31"). | `{ asOfMs }` |

### 5.2 What "active in period P" means

A member is **billable in period P** iff there exists at least one moment `t ∈ P` where:

```
member.memberType === "active"
AND ∃ bundle: bundle.customerId === member.customerId
              AND bundle.status === "active"
              AND bundle.currentPeriodStart ≤ t < bundle.currentPeriodEnd
              AND classifyTier(bundle.pricingSnapshot.totalCents) ∈ {"individual","family"}
```

### 5.3 Pro-ration policy

For the initial release, **no pro-ration**. Any primary active for one or more days in the period is billed for the full monthly amount, matching how Stripe charges and how list-bill exports already work.

When pro-ration is required (future), the formula is:

```
prorationFactor = days_active_in_period / days_in_period
billedCents     = round_half_to_even(grossCents × prorationFactor)
```

Round at the **invoice line level**, never at the split level — apply the same factor to each bucket and re-derive Ryze Keep as the residual to preserve the §2.3 invariant.

### 5.4 Historical accuracy strategy

To make any historical period reproducible, the system must persist enough state. There are two viable architectures:

**(A) Snapshot-on-close (recommended, MVP-friendly)**
- A monthly cron at `T+1 00:05 UTC` writes one row per group per period to a new table `invoicePeriods` capturing the full `GroupBreakdown` plus the source `bundleIds` and `memberProfileIds` involved.
- All historical queries read from `invoicePeriods` exclusively. Live mode reads live tables.
- Pros: simple, cheap, immutable record.
- Cons: a missed cron run leaves a gap; corrections require a documented adjustment workflow.

**(B) Event-sourced / temporal**
- Persist every membership and bundle state transition with a `validFrom` / `validTo`. Reconstruct any `asOf` state by replay.
- Pros: perfect reproducibility, supports `as-of` mode for free.
- Cons: large schema change; rewrite of every mutation that touches `memberProfiles` or `subscriptionBundles`.

**Decision:** ship (A) first. Migrate to (B) only if audit/regulatory pressure demands it. Either way, the public Convex query signature stays the same: `getInvoiceBreakdown({ period?, asOfMs? })`.

### 5.5 Time-zone policy

All period boundaries are **UTC**. Display layer may render in `America/New_York` for human readability, but the boundary stored alongside an `invoicePeriods` row is the UTC instant. This avoids DST seam bugs at month boundaries.

---

## 6. API Surface (Convex)

### 6.1 Current (live snapshot)

```ts
api.admin.invoiceCalculator.getInvoiceBreakdown({})
```

Returns:

```ts
{
  groups: GroupBreakdown[],
  grand: TotalsBlock,
  employerPaid: PartitionBlock,
  selfPay: PartitionBlock,
}
```

See [convex/admin/invoiceCalculator.ts](../../convex/admin/invoiceCalculator.ts) for the exact TypeScript types.

### 6.2 Planned additions

| Function | Type | Purpose |
|---|---|---|
| `getInvoiceBreakdownForPeriod` | `query` | Args: `{ year, month }` or `{ startMs, endMs }`. Reads `invoicePeriods` for closed months; falls back to live for the current month. |
| `getInvoiceBreakdownAsOf` | `query` | Args: `{ asOfMs }`. Requires architecture (B) or a snapshot table indexed by `closedAt`. |
| `getGroupInvoice` | `query` | Args: `{ groupId, year, month }`. Single-group drill-down with member-level line items. |
| `closePeriod` | `internalMutation` (cron) | Locks a period: writes `invoicePeriods` rows, marks period `status: "closed"`. Idempotent. |
| `recordAdjustment` | `mutation` | Args: `{ periodId, groupId, reason, deltaCents, bucket }`. Append-only correction; does NOT mutate the closed snapshot. |
| `exportListBillCsv` | `query` | Server-side CSV generation for E123 import (current export is client-side). |
| `exportVendorPayableCsv` | `query` | Per-vendor (Toothlens, Careington, Processing, Partner Vendor) payable batches. |

### 6.3 Authorization

Every query and mutation in this module must call `await requireAdmin(ctx)` from [convex/lib/authGuards.ts](../../convex/lib/authGuards.ts). Mutations (`closePeriod`, `recordAdjustment`) must additionally write to the admin audit log via the existing audit pattern used in [convex/admin/billing.ts](../../convex/admin/billing.ts).

---

## 7. UI Specification

### 7.1 Page route

`/admin/invoice-calculator` — gated by [src/app/admin/layout.tsx](../../src/app/admin/layout.tsx).

### 7.2 Page sections (top → bottom)

1. **Breadcrumbs + title** — page identity.
2. **Period selector** *(planned)* — month picker (default = current calendar month) + "Live" toggle. Disabled on first release; current page is implicitly Live.
3. **Stat cards (4)** — Gross, Partner Vendor, Ryze Keep, Billable Primaries.
4. **Dispersal Breakdown table** — six rows (five buckets + Gross), columns: per-Individual rate, per-Family rate, employer-paid total, self-pay total, grand total. Penny-reconciliation footnote (§2.3).
5. **Filter pills** — All Groups / Employer-Paid / Self-Pay.
6. **Per-group table** — one row per group, sortable by every numeric column, with employer-paid badge, primary counts, dependent count, partner vendor share, Ryze keep, gross.
7. **CSV export** — single button, produces a row-per-group CSV scoped to the current filter.

### 7.3 Future UI extensions

- **Group drill-down**: click a group row → member-level table mirroring the existing pattern in [src/app/admin/billing/page.tsx](../../src/app/admin/billing/page.tsx).
- **Account drill-up**: roll-up by parent `account` for multi-group employers.
- **Partner attribution view**: pivot by `distributionPartner` (FMO/agency) using `groups.brokerId` + `distributionPartners.clerkUserId` join.
- **Period comparison**: side-by-side prior month vs current month with delta columns.
- **Forecast mode**: project month-end totals based on enrollment velocity.

---

## 8. CSV / Export Contracts

### 8.1 Per-group export (current)

Header (stable column order — never reorder, only append):

```
organization_code,group_code,group_name,account,billing_model,
active_members,individual_primaries,family_primaries,dependents,unbilled_primaries,
gross,toothlens,careington,processing,partner_vendor,ryze_keep
```

- Money fields formatted as `XX.XX` (dollars, 2dp) in the CSV. UI displays `$XX.XX` via `formatCurrency`.
- `billing_model` ∈ `{"employer_paid","self_pay"}`.
- Strings double-quoted; embedded quotes doubled.
- Row order: as displayed (filtered + sorted).

### 8.2 Planned: vendor payable CSV

For each pass-through vendor, export `(group_code, primary_count, per_primary_rate_cents, payable_cents, period_start, period_end)`. Toothlens and Careington are flat per-primary; Partner Vendor is tiered by Ind/Fam.

---

## 9. Adjustments, Refunds & Chargebacks

Closed periods are **immutable**. Corrections are recorded as **adjustments** in a separate append-only table:

```ts
invoiceAdjustments: defineTable({
  periodId: v.id("invoicePeriods"),       // affected period
  groupId: v.id("groups"),
  reason: v.union(
    v.literal("refund"),
    v.literal("chargeback"),
    v.literal("retroactive_term"),
    v.literal("retroactive_enrollment"),
    v.literal("misclassification"),
    v.literal("other"),
  ),
  bucket: v.union(
    v.literal("gross"),
    v.literal("toothlens"),
    v.literal("careington"),
    v.literal("processing"),
    v.literal("partnerVendor"),
    v.literal("ryzeKeep"),
  ),
  deltaCents: v.number(),                 // signed; may be negative
  appliedToPeriod: v.optional(v.string()), // YYYY-MM where the offset shows up in cash; usually current
  notes: v.string(),
  createdBy: v.string(),                  // Clerk user ID
  createdAt: v.number(),
})
```

Reporting then offers two views per period:
- **As-closed** — the original snapshot, never changes.
- **As-of-now** — closed snapshot + sum(adjustments). Use for current AR/AP balance.

Chargebacks (Stripe disputes) and ACH returns hit the bank weeks after the original charge. They post as adjustments dated to the *original* period but `appliedToPeriod` set to the period the bank reversed funds.

---

## 10. Future Extensions (roadmap, not blocking)

| # | Feature | Notes |
|---|---|---|
| 1 | Per-distribution-partner roll-up | Add `partnerId`/`brokerId` resolution; show top-N partners by gross. |
| 2 | Multi-currency | Today USD-only. If ever expanding, store currency on bundle and never mix in roll-ups. |
| 3 | Pro-ration | See §5.3. |
| 4 | Mid-period plan changes (upgrade/downgrade) | Tier reflects bundle at period end. With pro-ration, blend Ind days + Fam days. |
| 5 | Stripe payout reconciliation | Compare expected `processingCents` against Stripe's actual fee per charge; reconcile variance to "Stripe true-up" line. |
| 6 | Historical pricing | If `$14.99` / `$24.99` ever change, persist the dispersal table with each `invoicePeriods` row so old periods reproduce correctly. |
| 7 | Per-employer custom rate | `accounts.billingDetails.perMemberRateCents` already exists for billing.ts; if the calculator must honor custom rates (e.g., negotiated discount), plumb it through `classifyTier` with a per-account override. |
| 8 | Tax / regulatory premium tax | Layered on top of gross; not part of the dispersal table. |
| 9 | Direct invoice PDF generation | Render PDF per employer for AR mailing. |
| 10 | API webhooks | Notify external GL system when a period closes. |

---

## 11. Verification

### 11.1 Invariants (must hold every period, every group, forever)

| ID | Invariant | Test mechanism |
|---|---|---|
| INV-01 | `grossCents == toothlens + careington + processing + partnerVendor + ryzeKeep` | Per-row assertion in unit + integration tests. |
| INV-02 | `dependent.contribution == 0` for all six buckets | Property-based test over a synthesized roster. |
| INV-03 | `grand.X == Σ(group.X)` for every bucket and every count field | Integration test. |
| INV-04 | `grand.X == employerPaid.X + selfPay.X` | Integration test. |
| INV-05 | `unbilledPrimaryCount + individualPrimaryCount + familyPrimaryCount == active primaries` | Integration test. |
| INV-06 | Closed-period `invoicePeriods` row + `Σ adjustments` is monotonic per bucket — no silent edits | DB-level: snapshot row immutable; adjustments append-only. |
| INV-07 | Re-running `closePeriod` on a closed period is a no-op (idempotent) | Cron retry test. |
| INV-08 | Member counted in exactly one group per period | Defensive assertion; if violated, log + alert. |

### 11.2 Automated test plan

Place tests in `src/tests/admin/invoiceCalculator.spec.ts` (matches existing `vitest.config.ts` discovery).

Required test fixtures (synthesized in-memory; no external dependency):

1. **Empty database** → all totals zero, no rows, no errors.
2. **Single Individual primary, no dependents** → `gross=1499`, splits per §2.2.
3. **Single Family primary, two dependents** → `gross=2499`, `dependentCount=2`, dependents contribute `0`.
4. **One employer-paid group, one self-pay group, mixed tiers** → both partition buckets populated; INV-04 holds.
5. **Active primary with no bundle** → `unbilledPrimaryCount=1`, contributes `0` to splits.
6. **Active primary with `$0` bundle (employer-comped)** → `unbilledPrimaryCount=1` (tier="none"), contributes `0`.
7. **Member with `memberType="terminated"`** → ignored entirely.
8. **Family bundle with one primary + one dependent in separate `memberProfiles` rows** → primary contributes `2499`, dependent contributes `0`.
9. **Customer with two active bundles (defensive)** → Family wins over Individual; logged as anomaly.
10. **Penny invariant fuzz** — generate 1,000 random rosters and assert INV-01 for every group.

### 11.3 Manual verification checklist (per release)

- [ ] Load `/admin/invoice-calculator` as an admin user; non-admins are redirected.
- [ ] "Total Monthly Gross" stat card matches `(individual_count × 14.99) + (family_count × 24.99)` to the cent.
- [ ] Dispersal Breakdown table: Individual column = `$1 / $2 / $1 / $6 / $4.99 / $14.99`; Family column = `$1 / $2 / $2 / $11 / $8.99 / $24.99`.
- [ ] Footnote about `$0.01` Ryze absorption is visible.
- [ ] Filter pills update both group count and table contents; sort persists across filter changes.
- [ ] CSV export round-trips: open in Excel/Numbers, sum the `gross` column, equals the on-screen "Total Monthly Gross".
- [ ] Each row's gross equals `toothlens + careington + processing + partner_vendor + ryze_keep` (spreadsheet formula check).

### 11.4 Reconciliation against external systems

Monthly, after `closePeriod` runs:

| Compare | Against | Acceptance criterion |
|---|---|---|
| Sum of Stripe successful charges (excl. tax) for the period | `selfPay.totals.grossCents` | Variance ≤ refund/chargeback total recorded as adjustments. |
| List-bill invoices issued via E123 | `employerPaid.totals.grossCents` | Exact match (no pro-ration MVP). |
| Toothlens monthly invoice | `grand.totals.toothlensCents` | Exact match per active primary. |
| Careington eligibility-file member count × $2 | `grand.totals.careingtonCents` | Exact match. |
| Ryze bank deposit (carrier wire) | `grand.totals.ryzeKeepCents` net of bank fees | Variance ≤ bank-fee line. |
| Partner Vendor (Ideal Health) wire | `grand.totals.partnerVendorCents` | Exact match. |

Variances outside tolerance trigger the adjustment workflow (§9), never a silent edit of the closed snapshot.

### 11.5 Audit trail requirements

For every closed period, the audit log must record:
- Who triggered close (system cron or user override).
- Closed-at timestamp (ms since epoch, UTC).
- Hash of the snapshot payload (e.g., SHA-256 of canonical JSON of all `invoicePeriods` rows for the period).
- Source git SHA of the calculator code at close time (so future investigations can git-bisect).

---

## 12. Operational Runbook

### 12.1 Monthly close (target: T+1 by 06:00 UTC)

1. Cron `closePeriod({ year, month })` fires at `T+1 00:05 UTC`.
2. Cron writes `invoicePeriods` rows; on success, posts an admin audit entry and sends a Slack/email summary.
3. Finance reviews `/admin/invoice-calculator?period=YYYY-MM` (planned UI) or runs the CSV export.
4. AR generates list-bill invoices from employer-paid section.
5. AP cuts vendor payables from Toothlens/Careington/Partner-Vendor totals.
6. Ryze receives carrier-keep wire equal to `grand.totals.ryzeKeepCents` (less bank fees).

### 12.2 Common tasks

| Task | Steps |
|---|---|
| Re-issue a closed-period CSV | `/admin/invoice-calculator?period=YYYY-MM` → Export. |
| Record a refund | Use `recordAdjustment` mutation (planned UI: an "Adjustments" sub-page). |
| Investigate a tier mismatch | Cross-reference member's `customerId` against `subscriptionBundles.pricingSnapshot.totalCents`. |
| Add a new SKU | Update §2.2 table here, extend `DISPERSAL` map and `classifyTier` in [convex/lib/dispersal.ts](../../convex/lib/dispersal.ts), add tests, bump spec revision. |
| Change pricing | Same as above, **plus** ensure historical periods read their own period-stamped dispersal table (see §10 #6). Never apply new pricing retroactively. |

### 12.3 Failure modes & alerts

| Symptom | Likely cause | Response |
|---|---|---|
| `unbilledPrimaryCount` spikes | Webhook outage left bundles in a non-active state, or new SKU added without updating `classifyTier`. | Compare against Stripe; backfill bundle status; extend matcher. |
| Stripe gross > calculator gross | Charges to deleted/orphaned customers. | Reconcile against `customers` table; record adjustment if revenue is real. |
| Toothlens invoice > calculator | Toothlens billing for terminated members. | Send `terminations` file to Toothlens; record adjustment for variance. |
| Penny mismatch (INV-01 fails) | Float math leaked in somewhere. | **Stop everything.** Money math must be integer cents. Audit the regression. |
| Cron didn't run | Convex scheduler issue. | Manually invoke `closePeriod` from admin Dev Tools; document in audit log. |

---

## 13. Glossary

| Term | Meaning |
|---|---|
| **Primary** | The household subscriber; pays the bill, owns the `customerId`. |
| **Dependent** | Spouse, child, domestic partner, or other rider on a Family bundle. Always `$0` revenue. |
| **List-bill** | Group bills the employer once for all enrolled employees (payroll deduction). `groups.listBill.enabled === true`. |
| **Self-pay** | Member pays directly via Stripe (CC or ACH). |
| **Carrier** | Ryze Nexus — the regulated entity holding the discount-plan organization filings. |
| **Partner Vendor** | Ideal Health — the brand and consumer-facing operator. |
| **Pass-through** | A line item Ryze collects but immediately remits to a vendor (Toothlens, Careington). |
| **Processing** | Card / ACH fees absorbed by Ryze on behalf of the member's transaction. |
| **Ryze Keep** | The carrier's net retained margin after pass-throughs and partner share. |
| **Bundle** | A `subscriptionBundles` row — one active subscription per `customerId`. |
| **Period** | A reporting window, almost always a calendar month UTC. |
| **Closed period** | A period with an immutable `invoicePeriods` snapshot. Edits flow through adjustments only. |

---

## 14. Source-of-truth precedence

In case of any disagreement:

1. The dispersal table in [convex/lib/dispersal.ts](../../convex/lib/dispersal.ts) — code is authoritative for math.
2. This spec — authoritative for intent, contracts, and time-bound behavior.
3. The admin UI — derived; if it disagrees with code, the UI is wrong.

---

## 15. Change Log

| Date | Author | Change |
|---|---|---|
| 2026-05-06 | Initial | Spec authored alongside MVP implementation: dispersal model, live snapshot query, admin page, sidebar entry. |
