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

Disclosure has two halves, both in `convex/admin/vendorStatements.ts`:

- **`VENDOR_IDENTITY`** — the non-negotiable facts. Which dispersal bucket pays
  a recipient, which adjustment bucket lands on their statement, what they are
  called. These describe the revenue model, not a preference, and are not
  configurable.
- **The disclosure profile** — what a recipient is *shown*. Configurable per
  recipient at `/admin/vendor-statements/disclosure`, stored in
  `vendorStatementDisclosureProfiles`, falling back to `DEFAULT_DISCLOSURE`
  when no row is saved.

The resolved combination is still the single gate. Fields a recipient may not
see are never assembled into the payload, so no downstream renderer — PDF, CSV,
XLSX, or the admin UI — can leak them.

### Configurable settings

| Setting | Options | Notes |
|---|---|---|
| Covered primary detail | on / off | Off yields a totals-only statement; the totals still reconcile. |
| Employer group | never / list-bill only / every group | "List-bill only" names the employer for employer-group members and renders everyone else as **Direct enrollment**, so a partner sees the employer business without the shape of the self-pay book. |
| Individual / Family rate class | on / off | Discloses household composition. |
| Rep / broker attribution | on / off | Rep name, code, email, agency. |
| Full revenue split | on / off | **Refused for any external recipient** — server-side, not just hidden in the UI. It would disclose what other partners are paid. |
| Itemized adjustments | on / off | Off still shows the net adjustment in the totals. |

### Two rules that make editing safe

1. **Statements freeze their profile.** Every statement stores the disclosure
   it was cut under in `vendorStatements.disclosure`, and `getStatement` reads
   that frozen copy — never today's profile. Changing settings shapes future
   statements and cannot reshape one already sent. To apply new settings to a
   month already statemented, reissue it.
2. **`fullSplit` is refused for external recipients** in
   `updateDisclosureProfile`, so no amount of configuration can leak one
   partner's economics to another.

Every profile change is written to the admin audit log with a field-by-field
before → after summary.

### Starting defaults

These are what a recipient gets before anyone edits their profile:

| Recipient | Member identity | Own fee | Rep / broker | Employer group | Individual vs. Family | Retail premium | Other vendors' splits |
|---|---|---|---|---|---|---|---|
| Toothlens | Yes | Yes | No | No | No | No | No |
| Careington | Yes | Yes | No | No | No | No | No |
| Ideal Health | Yes | Yes | Yes | List-bill employers only | Yes, as its own remittance rate class | No | No |
| Ryze (internal) | Yes | Yes | Yes | Every group | Yes | Yes | Yes |

Notes:

- Toothlens and Careington are paid one flat amount per covered primary. Plan
  tier would disclose household composition while explaining nothing about
  what they are owed, so it is omitted.
- Which employer sponsors a given member is not part of a flat-fee
  recipient's compensation, so employer identity is off for them by default.
- Ideal Health pays its downstream reps out of its own remittance, so it sees
  the member, the rep credited with that member, and — for members who came in
  through an employer — which employer that was, since reps are paid on
  employer business. Self-pay members read as "Direct enrollment". A recipient
  with no payout obligation sees none of this.
- Documents never announce what was withheld. A field a recipient may not see
  is simply absent — no "hidden", no "not disclosed", no empty column.

## Rep / broker attribution

`convex/lib/repAttribution.ts` is the shared resolver, used by both the member
detail screen and the close:

1. **Member-level (Scenario A)** — the rep on the member's `enrollmentSessions`
   row. A completed session beats an abandoned one; among equals the newest
   wins.
2. **Group-level (Scenario B)** — the rep on the member's `groups` row.
   Eligibility-file and list-bill members never run an enrollment session, so
   this is the only signal they have.

Member-level wins: a rep who personally enrolled someone inside another rep's
group is still the one who sold it.

Attribution is frozen onto `invoicePeriods.memberLines` at close, so a
statement reprinted after a book of business moves still names whoever earned
that month. Rep identity is reference data for routing a payout, not an input
to the statement's arithmetic, so closes written before the fields existed fall
back to the current attribution of record rather than showing blanks. Which
happened is always reported as `attributionBasis`:

| Basis | Meaning |
|---|---|
| `frozen` | Recorded at close. Reproducible forever. |
| `current` | The close predates frozen attribution; today's records were used. |
| `mixed` | Some rows frozen, some current. |

The statement, the exports, and the admin screen all state the basis. A payout
run should treat anything other than `frozen` as needing a second look.

## Internal verification

`getStatementVerification` is the "are these numbers right?" view: every
member's complete dispersal across all five buckets, the recipient's own column
called out, and five reconciliation checks —

1. Statement subtotal matches the closed books.
2. Member lines add up to the subtotal.
3. Every member's split adds back to their gross (INV-01).
4. Total equals subtotal plus adjustments.
5. Balance equals total less remittances.

It is deliberately a **separate query** from `getStatement`. Recipient
documents are built only from `getStatement`, so nothing in the verification
view can reach a partner regardless of how the export routes are called. Its
exports are spreadsheet-only and carry `INTERNAL-ONLY` in the file name.

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
| `…/document?variant=verification&format=csv\|xlsx` | The internal payables audit for that statement. Spreadsheet only. |
| `/api/admin/vendor-statements/period/[period]/document?format=pdf\|csv\|xlsx` | Every live statement for a coverage month — PDF one per page, XLSX with a rollup sheet plus one sheet per recipient, CSV flat and keyed by recipient. Internal reconciliation copy. |

## File names

Every download names who it is for, what it is, why (which coverage month, and
what state the document is in), and when it was produced:

```
Toothlens_Remittance-Statement_Coverage-2026-05_VS-10001_ISSUED_generated-2026-07-30.pdf
└ who     └ what                └ why ─────────────────────────┘ └ when
```

- `Coverage-YYYY-MM` is the month being paid for. `generated-YYYY-MM-DD` is
  when the file was produced. These differ on every reprint, and confusing them
  is the mistake the naming exists to prevent.
- Status is in the name so a `DRAFT` or `VOIDED` copy sitting in a downloads
  folder can never be mistaken for the live document.
- The verification export swaps in `Statement-Verification` and appends
  `INTERNAL-ONLY`.
- The whole-month bundle names the payer, the scope, the recipient count, and
  `INTERNAL-RECONCILIATION`.

Builders live in `src/lib/vendor-statement-document.ts`
(`statementFileBase`, `periodBundleFileBase`) and are covered by tests.

The PDF shares the list-bill invoice's logo, palette, rules, and remit block
(`src/lib/list-bill-invoice-pdf.tsx`), and watermarks DRAFT and VOID. Payee
identity comes from `VENDOR_STATEMENT_REMIT_*`, falling back to
`LIST_BILL_REMIT_*`.
