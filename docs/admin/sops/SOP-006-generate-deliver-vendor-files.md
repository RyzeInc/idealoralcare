# SOP-006: Generate and Deliver Vendor Eligibility Files (Careington/DialCare/DDN)

**Purpose:** Get an organization's (or the whole platform's) member roster to a downstream fulfillment vendor in the exact file format they require.

**Who can do this:** Any admin (Owner or Editor).

**Trigger:** New members enrolled since the last vendor send; a scheduled monthly send; a specific employer's onboarding needs their roster pushed immediately.

**Related guide:** [Eligibility Files](../guide/02-operations.md#eligibility-files-admineligibility), [Vendor Files](../guide/02-operations.md#vendor-files-adminvendor-files)

**⚠️ Read this first: there are two different places to "generate" a vendor file, and only one of them can actually deliver it.**

| If you want to... | Go to | Because... |
|---|---|---|
| **Actually deliver** a file via SFTP to a vendor, for **one organization** | **Eligibility Files** → that file's row → **Send to Careington** | This is the only button in the entire admin suite wired to a real SFTP push. |
| Just **download** a file to send manually, for one org or a monthly aggregate across all orgs | **Vendor Files** page | Every button here only downloads to your browser — none of them push anywhere, regardless of what the vendor cards' status text implies. |

## Steps — deliver one organization's roster via SFTP (Careington)

1. Go to **Eligibility Files** (`/admin/eligibility`).
2. Find the relevant completed upload in the **Upload History** table (this must be a file already processed for that organization — see [SOP-003](SOP-003-bulk-enroll-eligibility-file.md) if you haven't uploaded one yet).
3. Click **Preview File** first — this force-downloads the pipe-delimited file so you can sanity-check it (the toast confirms the expected pipe-count/line-ending structure) before anything goes out the door.
4. Click **Send to Careington** → confirm the native dialog.
5. The system generates the file, and — if SFTP credentials are configured for Careington — pushes it live. If SFTP isn't configured, it silently falls back to a manual download instead; check the resulting toast/behavior to know which happened.

## Steps — generate a per-organization or monthly aggregated file for manual delivery (any vendor)

6. Go to **Vendor Files** (`/admin/vendor-files`).
7. Select the **Organization** (skip this if you want the "all organizations" aggregate instead — see step 10).
8. Optionally expand the **Preview** section to check the roster before generating.
9. Click **Generate & Download** on the Dental Discount Network or Dial Care card. The browser downloads a `.txt` file. If the file has a structural problem (see troubleshooting below), the download will not happen at all — you'll get an error instead.
10. For the **Monthly Aggregated File** (all organizations combined, every row's group code rewritten to the shared `IDEALDO` code): use the separate **Monthly Aggregated File** card instead of a per-org generation. Do not send both a per-org file and the aggregate for the same period without knowing which one the vendor actually wants — they report different group codes for the same members.
11. Deliver the downloaded file to the vendor via your normal secure channel (email/portal/manual SFTP client) — the amber "Manual Delivery" notice on this page is accurate; there is no automated send from here.

## Verification

- For an SFTP send from Eligibility Files: there's no working "delivery history" view on the Vendor Files page (it's a stub — see below), so confirm success from the toast at send time, or ask your SFTP-side contact/vendor to confirm receipt.
- For a manual download: re-open the file and spot-check a few rows against what you expect (correct group code, correct member count).

## If something goes wrong

- **"Generate & Download" throws an error and nothing downloads** — the pre-export validator caught a real problem: a malformed row, a duplicate member/sequence/group-code combination, more than one primary in a household, or (DialCare specifically) a primary member with no email on file. Fix the underlying member record (often via [Members](../guide/01-members-partners.md#members-adminmembers) or by re-processing the eligibility file) and try again.
- **You're looking for "delivery history" or "last generated" info on the Vendor Files page and it looks wrong/empty** — it is. Both the vendor-status cards and the "View History" toggle are hardcoded stubs that don't reflect real state (see [guide/05-known-issues.md #B7/#B8](../guide/05-known-issues.md)). Don't use this page to answer "when did we last actually send this."
- **You picked "Full" vs. "Delta" and expected different content** — they produce the identical roster; only the filename differs. There's no real delta/diff logic anywhere (see [guide/05-known-issues.md #B6](../guide/05-known-issues.md)).
- **ID Maintenance panel shows collisions or "Need New ID" members** — click **Preview New IDs** (dry run) to see exactly what will change before clicking **Fix N Problematic Member(s)**. Same pattern for **Preview Lock-In** → **Lock In All N Fallback IDs**. These live actions are irreversible; always preview first even though the UI doesn't force you to.

## Related SOPs

- [SOP-003](SOP-003-bulk-enroll-eligibility-file.md) — must happen before there's anything to send.
