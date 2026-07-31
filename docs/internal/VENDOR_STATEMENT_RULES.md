# Vendor Monthly Statement Rules

## Purpose

A vendor statement reports what one partner earned for one completed UTC
calendar month across self-pay and employer/list-bill groups. It is a
remittance statement, not a member retail invoice.

It is the vendor-side mirror of the employer-side list-bill invoice and carries
the same machinery: sequential numbering (`VS-#####`), a draft → issued →
partial → paid lifecycle, void with an un-void, void-and-reissue with a
forward pointer to the replacement, remittance tracking, an internal memo that
is never printed, and a full admin audit trail.

Implementation: `convex/admin/vendorStatements.ts`,
`src/app/admin/vendor-statements/`, `src/lib/vendor-statement-*.ts(x)`,
`src/app/api/admin/vendor-statements/`.

## The coverage month

1. A coverage month runs from `00:00:00.000` on the 1st through
   `23:59:59.999` UTC on its last day. A plan purchased at 9:00 PM on May 31
   is May revenue and every partner is paid for it on the May statement.
2. Midnight on the 1st of the following month belongs to the following month.
   The gates in `invoiceCalculator.ts` (`existedAsOf`, `isEffectiveAsOf`) are
   therefore exclusive of the period's `endMs`, so no member is counted in two
   consecutive months.
3. Statements print the inclusive window ("May 1, 2026 – May 31, 2026"). The
   half-open `endMs` is arithmetic, never a displayed date.

## Historical cutoff

1. A statement may only be generated for a month that has been closed into
   `invoicePeriods`.
2. Statement generation reads only that immutable close. There is no live
   fallback anywhere in the path — a May statement generated in July is still
   a May statement.
3. Member-level lines are not copied onto the statement row. They are hydrated
   at read time from the `invoicePeriods` rows recorded in `sourcePeriodIds`,
   so a printed document can never drift from the close it claims to report.
   The close's `payloadHash` values are stored on the statement for audit.
4. Closes created before frozen member lines shipped remain aggregate-only.
   Those statements print authoritative totals and say so; the system never
   reconstructs their detail from current data.
5. Corrections to a closed month are append-only `invoiceAdjustments`. A
   statement freezes the `adjustmentIds` in effect when it was cut. An
   adjustment recorded afterwards does **not** silently move an issued
   document — it is surfaced on the statement as unapplied, and the fix is to
   void and reissue.

## Recipient disclosure

`VENDOR_POLICY` in `convex/admin/vendorStatements.ts` is the only place these
rules live. Fields a recipient may not see are never assembled into the
payload, so no downstream renderer — PDF, CSV, XLSX, or the admin UI — can
leak them.

| Recipient | Member identity | Own fee | Employer group / organization | Individual vs. Family | Retail premium | Other vendors' splits |
|---|---|---|---|---|---|---|
| Toothlens | Yes | Yes | No | No | No | No |
| Careington | Yes | Yes | No | No | No | No |
| Ideal Health | Yes | Yes | No | Yes, as its own remittance rate class | No | No |
| Ryze (internal) | Yes | Yes | Yes | Yes | Yes | Yes |

Notes:

- Toothlens and Careington are paid one flat amount per covered primary. Plan
  tier would disclose household composition while explaining nothing about
  what they are owed, so it is omitted.
- Which employer sponsors a given member is not part of any external
  recipient's compensation, so group code, group name, and organization code
  appear only on the internal Ryze statement.
- Documents never announce what was withheld. A field a recipient may not see
  is simply absent — no "hidden", no "not disclosed", no empty column.

## Counting and money

- Dependents never create their own payable statement line.
- Each billable primary creates one statement line.
- All money is stored and summed as integer cents; exports emit dollars as
  numbers so spreadsheets can total them without parsing.
- Toothlens and Careington amounts are flat across both plan tiers.
- Ideal and Ryze amounts use the tier frozen at close.
- A statement's subtotal comes from the frozen group totals, not from summing
  the hydrated member lines, so legacy aggregate-only closes still balance.
- Statement totals include only adjustments in the recipient's own bucket
  (`toothlens`, `careington`, `partnerVendor`, `ryzeKeep`).

## Generating

- **Whole month** — `generateStatementsForPeriod` cuts a draft for every
  recipient in one pass. Recipients that already have a live (non-voided)
  statement are skipped, so it is safe to re-run after adding a recipient or
  voiding a bad document. The month is validated before any statement number
  is allocated.
- **Single recipient** — `generateStatement`, with `previewStatement` backing
  a live preview so an admin sees the figures before a number is burned.
- Both are idempotent per (recipient, month).

## Documents

Every statement is available as a branded PDF, CSV, or XLSX, built from one
server-assembled payload so the three agree by construction.

| Route | Contents |
|---|---|
| `/api/admin/vendor-statements/[statementId]/document?format=pdf\|csv\|xlsx` | One recipient's statement. This is what the partner receives. |
| `/api/admin/vendor-statements/period/[period]/document?format=pdf\|csv\|xlsx` | Every live statement for a coverage month — PDF one per page, XLSX with a rollup sheet plus one sheet per recipient, CSV flat and keyed by recipient. Internal reconciliation copy. |

The PDF shares the list-bill invoice's logo, palette, rules, and remit block
(`src/lib/list-bill-invoice-pdf.tsx`), and watermarks DRAFT and VOID. Payee
identity comes from `VENDOR_STATEMENT_REMIT_*`, falling back to
`LIST_BILL_REMIT_*`.
