# Handoff: Building Monthly Statements for Toothlens & Partner Vendor (Ideal Health)

Written after the List-Bill Invoice gating/aging-history fixes (2026-07-01).
Everything below is either (a) a pattern already proven correct that the new
statements should reuse, or (b) a bug class we just found and fixed in one
place that almost certainly also exists in the code these statements will be
built on top of.

## 1. Where "money owed to a vendor" already lives

Don't build a new data model. The Invoice Calculator (`convex/admin/invoiceCalculator.ts`,
spec at [docs/internal/INVOICE_CALCULATOR_SPEC.md](INVOICE_CALCULATOR_SPEC.md))
already computes exactly this, per calendar month, per group:

- **Toothlens** → `toothlensCents` bucket (flat $1/primary/month, both tiers).
- **Partner Vendor (Ideal Health)** → `partnerVendorCents` bucket ($6 individual /
  $11 family per primary/month). This is the bucket the user means by
  "Partner Vendor/Broker (Ideal)" — see `convex/lib/dispersal.ts` header comment.
- Read via `getVendorPayables({ period, vendor: "toothlens" | "partnerVendor" })`
  → returns `{ rows: VendorRow[], totalCents }`, one row per group.
- `commissionPayables` (separate table) is for actual human brokers/reps
  (`partnerLeaders`/`distributionPartners`), not Toothlens/Ideal. Only relevant
  if "Broker" in the request also means real sales-rep commission statements —
  confirm with the user which is meant if ambiguous.

## 2. ⚠️ Critical: `computeLiveBreakdown` has no system-entry gating

This is the same class of bug we just fixed in `listBillInvoices.buildInvoiceLines`
(commit adding `existedByPeriodEnd`), and it is **not yet fixed here**.

`computeLiveBreakdown` (invoiceCalculator.ts) — used both for the live dashboard
**and** by `closePeriod`/`closePeriodManual` to produce the permanent frozen
`invoicePeriods` snapshot — includes every `memberProfile` with
`memberType ∈ {active, enrolling}` for a group, with **no check at all** against
`effectiveDate` or `createdAt`. It just asks "is this member currently active/enrolling
right now," not "did this member exist as of the period being closed."

Concretely: `closePreviousMonth` runs on the 1st of the month at 00:05 UTC and
closes the month that just ended (e.g. closes June on July 1). If a new
eligibility file for July is uploaded/processed any time before that cron fires
(or an admin manually adds a member early on the 1st), those members get
permanently baked into **June's** frozen snapshot — inflating what Toothlens and
Ideal Health are owed for a month those members weren't even active for. Unlike
the list-bill "Refresh Lines" safety valve, **there is no refresh path for a
closed `invoicePeriods` row** — the only correction mechanism is the manual,
append-only `recordAdjustment` log, which requires a human to notice the
discrepancy first.

**Recommendation before shipping vendor statements:** port the same fix pattern
we used in listBillInvoices —
```ts
function existedByPeriodEnd(createdAt: number, periodEndMs: number): boolean {
  return createdAt <= periodEndMs;
}
```
applied inside `computeLiveBreakdown`'s member loop, gated on `periodEndMs` for
the period actually being closed (computeLiveBreakdown currently has no concept
of "as of end of period X" at all — it's always "as of right now" — so this
needs a parameter threaded through, not just a field check). Add regression
tests mirroring `listBillInvoices.test.ts` T1c (late-`createdAt` primary/dependent
exclusion) before trusting any statement generated from this path.

## 3. The other proven pattern to reuse: closed-period snapshots are already immutable — use them, don't recompute live

Unlike the list-bill aging table (which we just had to retrofit with an
`asOfDate` parameter because it was always computed live), the Invoice
Calculator already does point-in-time correctness right **at the read layer**:
`getVendorPayables` reads from the frozen `invoicePeriods` table for any period
that's already closed, and only falls back to `computeLiveBreakdown` for the
current/open period. `listClosedPeriods` tells you which periods are safe.

**For the new statements:** generate them only from closed periods
(`getVendorPayables({ period: "2026-06", vendor: ... })` where `"2026-06"` is
already in `listClosedPeriods`), never from `"live"`. If a user requests a
statement for the still-open current month, surface a warning ("this period
hasn't closed yet — numbers may still change") rather than silently generating
a PDF from live data that will disagree with itself if regenerated tomorrow.
This is the exact mistake the list-bill PDF's "Invoice History" section made
(computed live every time, so an old invoice's PDF changed depending on when
you reprinted it) — don't reintroduce it here.

## 4. Other conventions from this session worth carrying over

- **Never call the Stripe API with a synthetic ID.** Comp/free-access bundles
  use `stripeSubscriptionId: "free_<timestamp>"` and
  `stripeCustomerId: "free_local_<clerkUserId>"` (`grantFreeAccess.ts`) — these
  are not real Stripe objects. If a statement ever needs to cross-reference
  Stripe payment/payout status, filter to `startsWith("sub_")`/real customer
  IDs first. (We hit this exact bug building the Stripe↔Convex reconciliation
  cron this session and had to revert 4 wrongly-cancelled bundles.)
- **Never let a "refresh"/recompute touch a financially-locked record.**
  `listBillInvoices` only allows line-item refresh on
  `draft/issued/overdue` status with `amountPaidCents === 0`
  (`REFRESHABLE_STATUSES`); anything already paid/partial requires an explicit
  adjustment instead. `commissionPayables` and `invoiceAdjustments` already
  follow this append-only-correction philosophy — keep it for vendor
  statements too. Once a statement has been sent to Toothlens/Ideal, treat it
  as immutable; corrections are a new adjustment row, not a silent recompute.
- **One-off migration/diagnostic mutations are a repo convention, not a code
  smell here.** Pattern: `internalMutation`/`internalQuery` named
  `_migration...` or `_debug...`, actor stamped `"system:data-migration"` or
  `"system"` in the relevant audit/event log, run via
  `npx convex run <path> '<json>' --prod`. Reuse this for any vendor-statement
  backfill (e.g. retroactively generating statements for already-closed past
  periods) instead of a bespoke script.
- **Always typecheck (`npx tsc --noEmit -p convex/tsconfig.json`), run
  `npx vitest run convex` (not bare `npx vitest run` — picks up unrelated
  failing frontend tests), and `npx convex deploy -y` in that order** before
  considering a backend change done. Frontend-only files (PDF templates,
  Next.js API routes) need a separate app deploy (git push) — `convex deploy`
  does not touch them.

## 5. Known, already-documented gaps (don't rediscover these)

From [FINANCE_PLATFORM_EVALUATION.md](FINANCE_PLATFORM_EVALUATION.md) §3.3/§3.4/§4
(pre-existing assessment, still accurate as of this session):
- No per-vendor statement PDF/export exists yet for Toothlens or Partner
  Vendor — this is genuinely new work, not a fix.
- No payout **batch** entity, no remittance/export (ACH/check) file, no
  vendor-bill reconciliation against what was actually paid out.
- The dispersal model (`convex/lib/dispersal.ts`) is hard-coded to two tiers
  and five buckets for the Ryze/Ideal Oral Care economics specifically — it
  is not a general ledger. If Toothlens or Ideal ever need a *different* split
  model (e.g. a different product line), this table needs to grow, not just
  the statement layer.

## 6. Suggested shape for the new statement documents

Mirror the list-bill invoice PDF work exactly (same libraries, same route
pattern):
- A `@react-pdf/renderer` template (cf. `src/lib/list-bill-invoice-pdf.tsx`)
  taking a plain data object — one per vendor (Toothlens, Partner Vendor) —
  built from `getVendorPayables` rows: period, per-group member counts,
  per-group cents owed, grand total.
- A Next.js route (cf.
  `src/app/api/admin/list-bill-invoices/[invoiceId]/group-pdf/route.ts`) that
  authenticates admin via Clerk + `isAdmin`, fetches the data server-side, and
  streams the PDF — gated to only accept periods present in
  `listClosedPeriods` (see §3).
- Reuse `computeAgingBucket`-style thinking only if these vendors are ever
  invoiced with a payment-due-date/balance concept; today `getVendorPayables`
  is a pure "amount earned this period" figure, not an open-balance/aging
  concept, so it's simpler than the list-bill case.
