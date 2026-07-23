# Operations

Covers: [Hierarchy](#hierarchy-adminhierarchy) · [Eligibility Files](#eligibility-files-admineligibility) · [Vendor Files](#vendor-files-adminvendor-files)

Permission note: plain `requireAdmin` throughout — Owner and Editor have identical access. See [00-overview.md §1](00-overview.md#1-the-permission-model-read-this-first).

---

## Hierarchy (`/admin/hierarchy`)

The sidebar calls this **"Hierarchy"**; the page itself is titled **"Brokers & Organizations."** This manages the Site → Account → Group tree described in [00-overview.md §4](00-overview.md#4-distribution-hierarchy-vocabulary) — **not** the Distribution Partners sales chain covered in [01-members-partners.md](01-members-partners.md#distribution-adminbrokers) (confusingly, both use the word "Broker" in different UI labels).

### What's on the page

Three tabs, each with its own Create button (**Create Site (Carrier)**, **Create Broker**, **Create Organization**):

- **Sites tab**: Name/Slug/Type/Domain/Status. Click the status pill to toggle active↔suspended inline.
- **Brokers (Accounts) tab**: searchable; Name/Slug, Carrier, Type, Billing Model, Status.
- **Organizations (Groups) tab**: searchable; Name, Org Code (Subscriber ID), Provider Group Code, Broker, a clickable **Members** count that expands a full status breakdown (lead/eligible/enrolling/active/inactive/terminated/declined, each drilling into a member list), Status.
- Group create/edit modal also has a **List-Bill** sub-section (enable payroll-deduction billing, payment method, due day, contact email) and a **Representative** field (rep-code attribution for commissions).

### How it works

- `createSite` / `createAccount` / `createGroup` each reject duplicate slugs at their own scope (site-wide, within-account, within-site respectively). `createAccount` and `createGroup` also verify their parent exists.
- The Organization Code ("Subscriber ID") field is required **only in the browser** — the client blocks submit with a toast if it's empty, but the underlying schema/mutation treats it as optional. The real enforcement happens downstream: [Eligibility Files](#eligibility-files-admineligibility) processing hard-refuses to run against a Group with no Organization Code. Bottom line: always set it here at Group-creation time, don't rely on a later safety net catching a missed one until you actually try to process a file.
- All reads (`getAllAccounts`, `getAllGroups`) go through `unifiedData.getHierarchy()` rather than querying tables directly, specifically to keep counts consistent with the Members/Billing tabs.

### Known limitations

- **Deletes are permanent, hard deletes with only a browser `confirm()` as a safety net.** Deleting a Site or Account that still has Groups/members underneath it is not blocked — there's no dependency check.
- The "Organization Code required" client-side check means it's possible (via a script, or a future different caller) to create a Group with no Subscriber ID; you won't find out until an eligibility file for that group fails to process.

---

## Eligibility Files (`/admin/eligibility`)

Bulk-ingest employer/organization member rosters (CSV/XLSX/TXT/JSON) into `memberProfiles`, then optionally provision Clerk logins + employer-paid plan access, and push the resulting roster to Careington.

### What's on the page

A 3-step wizard:

1. **Choose Group** — pick the destination Organization and a **File Action** (Full Replace / Additions Only / Terminations / Delta (Smart)).
2. **Upload File** — drag-and-drop or Choose File (`.csv/.xlsx/.txt/.json`, 50 MB / 10,000-primary-member cap enforced client-side). **Download Template** gives a sample Careington-layout CSV.
3. **Review & Confirm** — summary counts (primaries/dependents/total lives/parsing issues/missing fields), a sample table, a validation-errors panel with **Download Errors (CSV)**, and **Process N Members** to commit.

Below the wizard, an **Upload History** table with per-file actions (once completed): **Grant Access** (opens a modal to send invite emails to ready-to-invite members, with per-member **Resend**), **Backfill Deps**, **Preview File**, **Send to Careington**, and **Retry Processing** for failed files.

### How it works

- **Format auto-detection** handles four layouts: Careington pipe-delimited `.txt`, a simple flat CSV, an employer "census" CSV (Employee/Spouse/Child rows keyed by SSN), and a "wide" employer XLSX (one row per employee with an embedded dependent).
- **Matching/idempotency** (the core of what makes re-uploads safe) tries, per row, in this order, scoped to the destination group: (1) exact email match, (2) Careington Unique ID + sequence "00", (3) employer Employee ID, (4) normalized SSN, (5) normalized name + exact DOB. First match wins and *updates* the existing record; no match creates a new primary with a freshly-reserved sequential member ID. **This is why re-uploading the same file is safe** — it updates rather than duplicates.
- **Required-field validation** is advisory, not a hard block — a file can be committed with missing-field rows; the wizard just flags them.
- **The "File Action" selector is cosmetic.** ⚠️ Full Replace / Additions Only / Terminations / Delta (Smart) are stored on the file record and shown in history, but the actual ingestion logic runs identically no matter which one you pick — there is no true "replace everything else with nothing," no additions-only skip, and no delta diff computed anywhere. Don't rely on these options changing behavior; the matching logic above (same for every "action") is what actually determines adds vs. updates.
- **Grant Access** (`provisionEligibilityFile`, mode "invite"): for members flagged "ready to invite" (eligible/lead, has email, no existing Clerk account), creates or invites their Clerk account and links a `$0` employer-paid subscription bundle. Reports Attempted/Succeeded/Failed/Skipped.
- **Backfill Deps**: creates any dependent `memberProfiles` rows missing from a primary's embedded dependent list — idempotent, safe to re-run.
- **Preview File / Send to Careington**: both generate the same Careington pipe-delimited output for that file's own group, using the group's own group code. **Preview** always force-downloads; **Send to Careington** attempts a real SFTP push (falls back to manual download if SFTP env vars aren't configured) — this is the **only** place in the admin suite that actually triggers a live vendor SFTP delivery. See [Vendor Files](#vendor-files-adminvendor-files) below for why that page can't do it.
- **Retry Processing**: resets the file's counters and reprocesses every row from scratch. Safe because of the matching logic — it won't duplicate.
- **Processing is blocked entirely** if the destination Group has no Organization Code (see [Hierarchy](#hierarchy-adminhierarchy) above).

### Known limitations

- The File Action dropdown doesn't change behavior (see above) — document it to admins as "for your own bookkeeping/history," not as a functional switch.
- Validation errors don't block commit — a file full of incomplete rows can still be processed.
- A `deleteEligibilityFile` mutation exists but has no UI button and has a known-incomplete implementation (never actually deletes the uploaded blob from storage) — don't look for a delete-file button here.
- Per-org "Send to Careington" (this page) uses the **organization's own group code**; the aggregated monthly file (on Vendor Files) always overwrites every row to the shared `IDEALDO` code. Don't mix these up — use the right one for the right audience (see next section).

---

## Vendor Files (`/admin/vendor-files`)

Generates outbound eligibility files in the exact format each fulfillment vendor requires (Careington/Dental Discount Network, DialCare), plus an "ID Maintenance" tool for the numeric Careington Unique IDs that must stay consistent between vendor files and member ID cards.

### What's on the page

- **Select Organization** + **File Type** (Full/Delta — see gotcha below).
- **Preview** (collapsible): roster that would be included.
- **ID Maintenance panel**: an "ID Health" summary (Total/Finalized/Fallback/Collisions/Need New ID), a full ID roster table, **Preview New IDs** (dry run) → **Fix N Problematic Member(s)** (live), and separately **Preview Lock-In** → **Lock In All N Fallback IDs** (live). Both live actions are behind a `confirm()` but not otherwise sequenced — it's possible to skip straight to the live action without previewing first.
- Two vendor cards (Dental Discount Network, Dial Care): **Generate & Download**, plus a History toggle.
- **Monthly Aggregated File** card: one combined file across *all* organizations, with every row's group code rewritten to `IDEALDO`.
- **Essentials Eligibility Test Files** card: ARK / RxValet / Combined test CSVs (for vendor schema verification, not production delivery).

### How it works

- Every generated row is pre-export-validated server-side before any download happens: exactly 28 pipe-delimited fields, no duplicate identity tuples, exactly one primary per household, and (DialCare only) every primary must have a non-empty email — **a hard error blocks the download entirely** if any of these fail. This is a common real-world failure mode: an incomplete member record will block a whole file, not just skip that row.
- **The Monthly Aggregated File always overwrites every organization's group code to `IDEALDO`** before combining — this is intentional (it's the shared consolidated submission), but it means a per-org file and the aggregated file report the same members under *different* group codes. Don't send both for the same period without knowing which one the vendor actually wants.

### Known limitations — this page has more stubs than most

- ⚠️ **This page cannot actually deliver anything.** Every button here is "Generate & Download" — the file lands in your browser, and an amber "Manual Delivery" notice says as much. The real SFTP-push infrastructure (`convex/admin/sftpDelivery.ts`, `/api/admin/vendor-deliver`) exists and works, but it is only wired up to the [Eligibility Files](#eligibility-files-admineligibility) page's "Send to Careington" button — **not** to anything on this page. If you need a file actually delivered via SFTP, do it from Eligibility Files.
- ⚠️ **The vendor status cards are hardcoded stubs.** "Last Generated" and "SFTP: Configured" never reflect real state — the backing query (`getVendorConfigurations`) always returns a fixed "1 day ago / ready" regardless of what actually happened.
- ⚠️ **The "View History" toggle on each vendor card is also a stub** — it always shows "No SFTP delivery records yet," regardless of real delivery history, even though a fully-working `vendorDeliveries` table and query exist (just not wired into this page).
- **"Full" vs. "Delta" file type is cosmetic here too** — both options query the exact same active-member set; only the output filename changes. There's no diff-since-last-export logic anywhere in the codebase.
- ID Maintenance's live actions ("Fix," "Lock In") are irreversible writes gated only by a confirm dialog — always click the matching "Preview" button first even though the UI doesn't force you to.
- SFTP credentials are entirely environment-variable driven (`CAREINGTON_SFTP_*`, `DIALCARE_SFTP_*`) — there's no admin UI to view or change them.
