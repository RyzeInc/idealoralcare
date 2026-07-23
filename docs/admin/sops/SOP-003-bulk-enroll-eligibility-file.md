# SOP-003: Bulk-Enroll Members from an Eligibility File

**Purpose:** Load an employer's member roster (new group onboarding, a renewal refresh, or an ongoing add/term update) via CSV/XLSX/TXT/JSON upload.

**Who can do this:** Any admin (Owner or Editor).

**Trigger:** New employer roster received, or a periodic roster update/renewal.

**Prerequisites:**
- The destination Group must already exist **with an Organization Code set** ([SOP-001](SOP-001-onboard-selfpay-employer-group.md)/[SOP-002](SOP-002-onboard-listbill-employer-group.md)) — processing will hard-refuse otherwise.
- The file itself, under 50 MB and under 10,000 primary members.

**Related guide:** [Eligibility Files](../guide/02-operations.md#eligibility-files-admineligibility)

## Steps

1. Go to **Eligibility Files** (`/admin/eligibility`).
2. **Step 1 — Choose Group**: select the destination **Organization**. Pick a **File Action** label for your own record-keeping (⚠️ this label doesn't change actual processing behavior — see the note below) — Full Replace / Additions Only / Terminations / Delta (Smart) — then **Next: Upload File**.
3. **Step 2 — Upload File**: drag-and-drop or **Choose File**. If you're unsure of the expected layout, click **Download Template** first for a sample Careington-format CSV.
4. The file auto-previews. **Step 3 — Review & Confirm** shows:
   - Summary counts (primary members, dependents, total lives, parsing issues, missing fields).
   - A 5-row sample with an Issues column.
   - A validation-errors panel (missing required fields) — you can **Download Errors (CSV)** to hand back to the employer for correction.
5. Review the counts against what you expected from the employer. If something looks badly wrong (e.g., primary count is 10x expected), click **Back** and re-check the file/Group selection before proceeding.
6. Click **Process N Members** to commit. ⚠️ Note: validation errors shown in Step 3 do **not** block this button (only an oversized file or zero primaries do) — a file with missing-field rows can still be committed. If you want a clean roster, fix the errors in the source file and re-upload rather than committing through warnings.
7. Watch the **Upload History** table below — the new file will show a progress bar, then a final status (`completed`, `completed_with_errors`, or `failed`).
8. Once completed, decide whether to provision access now or later:
   - Click **Grant Access** on the file's row → in the modal, select members flagged "Ready to Invite" (or check "Select all N ready-to-invite") → **Send invite to N member(s)**. This creates/invites their Clerk login and links a $0 employer-paid bundle where applicable.
   - Click **Backfill Deps** if you need to make sure every dependent embedded in the file has its own `memberProfiles` row (usually not needed — this runs automatically as part of processing, but is safe to re-run).

## Verification

- Open the destination Group in **Hierarchy** → the Members count breakdown should reflect the new/updated members (mostly landing in `eligible`, or `active` if this was an update to already-enrolled members).
- Spot-check 2–3 members by searching for them in **Members** (`/admin/members`).
- If this file was meant to feed Careington/DialCare, continue to [SOP-006](SOP-006-generate-deliver-vendor-files.md).

## If something goes wrong

- **"Organization … has no Organization Code (Subscriber ID)" error on processing** — go set it on the Group via Hierarchy ([SOP-001](SOP-001-onboard-selfpay-employer-group.md) step 4), then retry.
- **File shows `completed_with_errors` or `failed`** — expand the row's chevron ("Show N issue(s)") to see the row-level errors, download them as CSV, fix the source file, and either fix specific rows or use **Retry Processing** to reprocess the whole file from scratch. Re-processing is safe: the matching logic (email → Careington ID → Employee ID → SSN → name+DOB) updates existing records rather than duplicating them, so retrying won't create duplicates.
- **You expected "Terminations" to actually terminate people missing from the file, or "Delta" to only send changes** — it won't. ⚠️ The File Action selector is currently cosmetic; all four options run the identical matching/upsert logic regardless of label. See [guide/05-known-issues.md #B5](../guide/05-known-issues.md#-functionally-broken-ui-exists-doesnt-do-what-it-implies) if you need this fixed rather than worked around.
- **A "ready to invite" member's invite email seems to have bounced** — reopen **Grant Access** on that file; a bounced/complained member shows a badge and a **Resend** button in place of the checkbox.

## Related SOPs

- [SOP-001](SOP-001-onboard-selfpay-employer-group.md) / [SOP-002](SOP-002-onboard-listbill-employer-group.md) — must be done first if the Group doesn't exist yet.
- [SOP-006](SOP-006-generate-deliver-vendor-files.md) — pushing this roster on to Careington/DialCare.
- [SOP-015](SOP-015-troubleshoot-eligibility-file-errors.md) — deeper troubleshooting for a stubborn failed file.
