# SOP-015: Troubleshoot an Eligibility File That Failed or Partially Failed

**Purpose:** Diagnose and recover from an eligibility file upload that shows `failed` or `completed_with_errors` in the Upload History table.

**Who can do this:** Any admin (Owner or Editor).

**When you'd do this:** A file's status in Upload History isn't a clean `completed`.

**Related guide:** [Eligibility Files](../guide/02-operations.md#eligibility-files-admineligibility)

## Steps

1. Go to **Eligibility Files** (`/admin/eligibility`) and find the file in **Upload History**.
2. Click the row's chevron / "Show N issue(s)" to expand the row-level errors.
3. Click **Download Errors (CSV)** to get a clean list to work from (also useful to hand back to the employer if the errors are theirs to fix).
4. Diagnose by error type:
   - **"Organization … has no Organization Code (Subscriber ID)"** — the whole file failed before processing any rows. Go to [Hierarchy](../guide/02-operations.md#hierarchy-adminhierarchy), open the destination Group, set its Organization Code, then come back and retry.
   - **Pipe-file preflight issues** — `.txt` and pipe-delimited `.csv` use the same 28-field checks. Missing required address/DOB/primary email, invalid dates or field counts, duplicate member sequences, and dependent household mismatches block processing before member changes are scheduled. Correct the source and re-upload. The first 100 issues are saved to the failed file's error list. Header-based employer CSV/XLSX formats still use their existing format-specific rules.
   - **A hard processing error** (file truly malformed, unsupported layout) — re-check the file's format against **Download Template**; the parser auto-detects Careington pipe-delimited, flat CSV, employer "census" CSV, and "wide" XLSX layouts, but an unusual header set can fall through to the wrong parser.
5. Fix what you can in the source file (or ask the employer to) and re-upload as a fresh file, **or** if it's a matter of a few rows and you're confident about the fix, use **Retry Processing** on the existing file entry — this resets its counters and reprocesses every row from scratch.
6. **Retry Processing is safe to use liberally** — the underlying matching logic (email → Careington Unique ID → Employee ID → SSN → normalized name+DOB, in that order, scoped to the destination group) means re-processing updates existing records rather than creating duplicates.

For pipe-delimited files, 28 fields means 27 pipes, including empty trailing fields. Dependents must follow their primary with the same Unique ID and Group Code. Do not fill blanks with `N/A` or `NULL`. New effective dates follow the October 21 guide's first-of-month convention. Termination dates are validated as real dates without converting them to the first of a month: the supplied guide describes them as the last covered day.

Careington and DialCare exports also check address, postal code, date and household fields before a file can be downloaded. Correct missing member census data rather than inventing addresses or changing vendor group codes to make a file pass. Historical mid-month activations are not rewritten by the export check.

## Verification

- After a retry or re-upload, confirm the file's status is now `completed` (not `completed_with_errors`).
- Spot-check 2–3 previously-erroring members in [Members](../guide/01-members-partners.md#members-adminmembers) to confirm their data now looks right.

## If something goes wrong

- **You're not sure why a member ended up merged into an existing profile instead of creating a new one (or vice versa)** — remember the match order above; a coincidental match on SSN or name+DOB across two people can cause an unintended merge. If you suspect this happened, use [User Lookup](../guide/04-support-system.md#user-lookup-adminuser-audit) ([SOP-011](SOP-011-investigate-member-identity-issue.md)) to inspect the resulting profile in detail and correct it manually if needed.
- **The file keeps failing the same way after multiple retries** — stop retrying and escalate; a persistent failure usually means the file's actual layout doesn't match any of the four auto-detected formats, which needs an engineering look (extending the parser), not more retries.
- **You want to delete the failed file entirely and start clean** — there's currently no working delete-file button for this (the backend mutation exists but isn't wired to the UI, and even it doesn't clean up storage). Leave the failed entry in history and just re-upload a corrected file as a new entry instead.

## Related SOPs

- [SOP-003](SOP-003-bulk-enroll-eligibility-file.md) — the normal upload flow this SOP is the failure-recovery branch of.
- [SOP-001](SOP-001-onboard-selfpay-employer-group.md) / [SOP-002](SOP-002-onboard-listbill-employer-group.md) — if the root cause is a missing Organization Code on the Group itself.
