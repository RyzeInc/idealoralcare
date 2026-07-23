# Members & Partners

Covers: [Members](#members-adminmembers) · [Distribution / "Brokers"](#distribution-adminbrokers) · [Partner Applications](#partner-applications-adminpartner-applications) · [Rep Codes](#rep-codes-adminrep-codes)

Permission note: every action in this file is gated by plain `requireAdmin` — Owner and Editor have identical access to every button described below, including permanent deletes. See [00-overview.md §1](00-overview.md#1-the-permission-model-read-this-first).

---

## Members (`/admin/members`)

**Purpose**: the master roster of everyone in the system — leads, eligible-but-unenrolled, active, terminated, etc. This is where day-to-day support/ops work happens: look someone up, change their status, add a case note, terminate them.

### What's on the page

- **Top bar**: Export CSV, Add Member.
- **Census-completeness tiles**: Total Members / Missing Census Fields (click to filter) / Complete Records.
- **Filters**: search (name/email/member ID), status dropdown, organization dropdown, and a **Terminated hidden / Showing terminated** toggle — terminated members are hidden by default.
- **Row actions**: View (opens detail drawer), Edit/Change Status (pencil), Terminate (trash).
- **Bulk actions**: select multiple rows → **Bulk Status Change**.
- **Detail drawer** (click a row): profile fields, a **View Full Details** link to the read-only Member Inspector (`/admin/members/[id]`), inline Edit (name/email/phone/DOB only — see gotcha), **Download ID Card** (⚠️ broken, see below), entitlements, Notes (typed: General/Enrollment/Billing/Support/Follow Up), Activity Timeline.
- **List-Bill section** (only for full-time employees): **Term from List-Bill**, or if already termed, **Send Re-enrollment Link**.

### How it works

- **Change status**: `updateMemberStatus` — writes an activity log entry and an admin-audit entry.
- **Bulk status change**: `bulkUpdateMemberStatus` — tolerant of individual failures; the toast reports "N of M succeeded."
- **Terminate**: `removeMember` — a **soft delete** (flips `memberType`/`status` to `terminated`, logged). A separate `hardDeleteMember` mutation does exist and permanently deletes the profile + activities + notes, but no button on this page calls it — it's only reachable from the [User Audit](04-support-system.md#user-audit-adminuser-audit) page.
- **Add Member**: `createAdminMember` — requires Group, First Name, Last Name.
- **Edit profile** (drawer): `updateMemberProfile` — the inline form only exposes First/Last/Email/Phone/DOB, even though the mutation itself supports far more fields (address, gender, vendor IDs, SSN). Anything beyond those five fields currently has to be edited from [User Audit's](04-support-system.md#user-audit-adminuser-audit) "Edit all fields" panel instead.
- **Add note**: `addMemberNote` — appears in the drawer's Notes list and is logged as an activity.
- **Term from List-Bill**: `termListBillMember` — sets `listBillStatus: "termed"`, generates a re-enrollment token, flips the member to `inactive`.
- **Send Re-enrollment Link**: `sendReenrollmentLink` — verifies the member is termed and has an email, then emails a 30-day re-enrollment link via Gmail SMTP.

### Known limitations

- ⚠️ **"Download ID Card" is broken.** It calls a function name (`admin/memberCards:generateMemberIdCardPdf`) that doesn't exist anywhere in `convex/admin/memberCards.ts` — clicking it will error. Don't rely on it; there's no working ID-card export from this page today.
- Apple/Google/Samsung wallet-pass generation is fully built server-side (`convex/admin/walletPasses.ts`) but not wired into any page — effectively unreachable/"coming soon."
- The census-completeness field list is duplicated in three places in the codebase (frontend, `userAudit.ts`, `eligibility.ts`) — if one is ever updated, check the others.
- `hardDeleteMember` exists but isn't reachable from this page (see User Audit instead) — that's intentional; don't look for a permanent-delete button here.

The **Member Inspector** (`/admin/members/[id]`) is a separate, read-only deep-dive page: full profile, dependents (with their Careington/Toothlens vendor IDs), subscription/entitlements, Toothlens scan history, and a live Clerk account panel (sign-in history, verified emails, OAuth accounts, ban status). No mutation buttons live here — it's for looking, not changing.

---

## Distribution (`/admin/brokers`)

The sidebar calls this **"Brokers"**; the page itself is titled **"Distribution Management."** This is *not* the Site/Account/Group hierarchy (that's [Hierarchy](02-operations.md#hierarchy-adminhierarchy)) — it's the separate sales/commission chain: Program Managers → FMOs/Agencies → their Leader contacts.

> Note for anyone reading the source: `src/components/admin/BrokersAdmin.tsx` exists in the repo but is **not** imported anywhere — the live page renders `DistributionAdmin.tsx` instead. Don't document screenshots from the unused file.

### What's on the page

- Two tabs: **Program Managers**, **FMOs & Agencies**.
- **Add Program Manager** / **Add FMO / Agency** (label follows active tab) — Organization Name, Type (FMO/Agency), optional Parent Program Manager, Primary Leader (Name/Email required, Phone, Title), Override/Management Fee Rate, Status, Notes.
- Each partner card: Edit, Delete, override rate, enrollment/member stats, an expandable **Leaders** panel (Add Leader, per-leader send/resend invite, Edit, Remove).

### How it works

- **Add a partner**: the `add` action creates the `distributionPartners` row **and** an auto-generated primary `partnerLeaders` record, then emails a 30-day invite link. If the email fails to send, the partner/leader records are still created — the toast says so explicitly ("invite email failed — resend manually") and you have to go back to the card's Leader panel to resend by hand.
- **Delete a partner**: `remove` — a `confirm()` dialog, then a hard delete that **cascades to delete every Leader under that partner**, with no separate warning about the cascade.
- **Resend/send invite**: `sendLeaderInvite` — generates a fresh 30-day token and re-sends the same HTML template.
- **Claiming an invite** (downstream, not on this page): `claimInvite` links the invitee's Clerk account and auto-grants them free platform access as a side effect.

### Known limitations

- Deleting a partner cascades to all its leaders with only a generic confirm — no leader-count warning.
- None of the read queries here (`getAllWithStats`, `getAll`, `getLeadersByPartner`) have a server-side auth check; access relies entirely on the `/admin` layout gate.
- No audit-log entries are written for any Distribution mutation (create/update/delete partner or leader) — there's no built-in history of who added or removed a broker.

---

## Partner Applications (`/admin/partner-applications`)

Review queue for public self-registration submissions from the `/register/rep` form, before they become live Distribution Partners. Despite the page name, there's no file literally called `partnerApplications.ts` in the backend — submissions live in `convex/repOnboarding.ts` (table `repOnboardingSubmissions`).

### What's on the page

- Status filter tabs: All / New / Reviewing / Approved / Rejected, each with a live count.
- Search (agency name, contact/rep email, name, EIN, NPN).
- Table → **Review** opens a drawer with full Agency and/or Rep details (licenses, E&O carrier, W-9 status, ACH auth, etc.).
- Pending-submission footer: optional Program Manager assignment, required "Attach Rep to Agency" for rep-only submissions, optional rejection reason, and **Mark Reviewing** / **Reject** (two-step: click again to confirm) / **Approve**.
- Approved-submission footer: shows generated Agency Code + rep tracking codes, or a **Provision Agency Code + Rep Codes** button for legacy rows.

### How it works

- **Approve** (`repOnboarding.approve`): creates the `distributionPartners` row (+ primary Leader for agency submissions), sends the leader an invite email (non-fatal if it fails), creates the rep's Leader record attached to the chosen agency, and **automatically attempts** `repCodes.provisionCodesForPartner` — silently logged (not surfaced) if that auto-provisioning fails.
- **Reject**: `repOnboarding.reject` — sets status to rejected, stores the reason in notes.
- **Manual code provisioning**: `provisionCodesForPartner` — idempotent; assigns/reuses a 4-digit agency code and creates one tracking code per Leader, skipping any Leader that already has one.

### Known limitations

- **Approval is not reversible in this UI.** There's no "un-approve" or edit-after-approve — the only follow-up action is code provisioning.
- If the invite email fails during Approve, the partner/leader are still created silently — you have to notice the toast wording and go resend from the [Distribution](#distribution-adminbrokers) page yourself.
- Auto-provisioning of codes on approval can fail silently (caught and logged, not surfaced) — check the Approved tab afterward; if no code is shown, use "Provision Agency Code + Rep Codes" manually.
- No owner-only gate on Approve, despite it being the most consequential action in this section (creates real partner/leader records and fires emails).

---

## Rep Codes (`/admin/rep-codes`)

Manages the individual tracking codes (and vanity URL slugs) that attribute a completed sale to a specific rep and their agency, for commission purposes. See also `docs/internal/REP_CODE_SYSTEM.md` in the repo for the full end-to-end flow (link capture → checkout → Stripe metadata → webhook attribution).

### What's on the page

- Stat tiles: Total Codes, Active, Total Uses, Revoked.
- **Add Rep Code**: pick an agent (search existing Clerk users, or paste a Clerk User ID manually), optionally pick an Agency/FMO.
  - If the agency **already has** a 4-digit agency code: the form switches to Rep First/Last Name fields and shows a live preview of the auto-generated numeric code (`{agencyCode}{seq}`) and vanity slug.
  - If not (or unaffiliated): enter a code manually, or click **Generate** for a random `REP-XXXXXX`.
- **Assign 4-Digit Code** — inline button next to an agency with none yet.
- Table: Code, URL Slug, Agent, Agency (+ code badge), Uses, Commission %, Status, and row actions (Edit, Revoke/Reactivate, Delete). Expand a row for its enrollment drill-down.
- **Backfill Slugs** button — bulk-generates missing slugs for existing active codes.

### How it works

- **Create**: `repCodes.create`. Code uniqueness is enforced case-insensitively; slug uniqueness is checked against both slugs and codes, plus a reserved-word blocklist (`admin`, `api`, `login`, `checkout`, `enroll`, etc.) to avoid routing collisions.
- **Assign 4-Digit Code**: `assignAgencyCode` — idempotent (returns the existing code if one's already set); otherwise finds the next unused 4-digit number starting at 1000.
- **Revoke/Reactivate**: flips `status` — existing attributed enrollments are unaffected either way.
- **Delete**: `remove` — permanent, no soft-delete. Historical enrollments keep their record in `enrollmentSessions`, but the code/slug/commission linkage is gone.

### Known limitations

- **Editing a slug can only add or change one — it cannot be cleared once set.** This is an intentional gap in the current code (a comment notes the "unset" action doesn't exist yet), not a UI mistake.
- Deleting a rep code is permanent and irreversible.
- No audit-log entries are written for Rep Code mutations (create/update/revoke/delete).
- The "Commission" column can show `—` even for a rate that legitimately exists, because rate lookup tries three different matching paths (current Leader ID, legacy Clerk-ID form, agency-level rate) — don't assume a blank means no rate was ever set without checking [Commissions](03-finance.md#commissions-admincommissions) directly.
