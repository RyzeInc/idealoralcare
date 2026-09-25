# Members & Partners

Covers: [Members](#members-adminmembers) · [Brokers](#brokers-adminbrokers) · [Partner Applications](#partner-applications-adminpartner-applications) · [Rep Codes](#rep-codes-adminrep-codes) · [Partner Kit Leads](#partner-kit-leads-adminpartnerkit)

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
- **Detail drawer** (click a row): profile fields, an **Open member workspace** link to the Member Workspace (`/admin/members/[id]`), inline Edit (name/email/phone/DOB only — see gotcha), **Download ID Card**, entitlements, Notes (typed: General/Enrollment/Billing/Support/Follow Up), Activity Timeline.
- **List-Bill section** (only for full-time employees): **Term from List-Bill**, or if already termed, **Send Re-enrollment Link**.

### How it works

- **Change status**: `updateMemberStatus` — writes an activity log entry and an admin-audit entry.
- **Bulk status change**: `bulkUpdateMemberStatus` — tolerant of individual failures; the toast reports "N of M succeeded."
- **Terminate**: `removeMember` — a **soft delete** (flips `memberType`/`status` to `terminated`, logged). A separate `hardDeleteMember` mutation does exist and permanently deletes the profile + activities + notes, but no button on this page calls it — it's only reachable from the [User Lookup](04-support-system.md#user-lookup-adminuser-audit) page.
- **Add Member**: `createAdminMember` — requires Group, First Name, Last Name.
- **Edit profile** (drawer): `updateMemberProfile` — the inline form only exposes First/Last/Email/Phone/DOB, even though the mutation itself supports far more fields (address, gender, vendor IDs, SSN). Anything beyond those five fields currently has to be edited from [User Lookup's](04-support-system.md#user-lookup-adminuser-audit) "Edit all fields" panel instead.
- **Add note**: `addMemberNote` — appears in the drawer's Notes list and is logged as an activity.
- **Term from List-Bill**: `termListBillMember` — sets `listBillStatus: "termed"`, generates a re-enrollment token, flips the member to `inactive`.
- **Send Re-enrollment Link**: `sendReenrollmentLink` — verifies the member is termed and has an email, then emails a 30-day re-enrollment link via Gmail SMTP.

### Known limitations

- **Download ID Card** uses the authenticated `/api/admin/members/[memberId]/id-card` PDF route. It is available from the drawer and the workspace Documents section.
- Apple/Google/Samsung wallet-pass generation is fully built server-side (`convex/admin/walletPasses.ts`) but not wired into any page — effectively unreachable/"coming soon."
- The census-completeness field list is duplicated in three places in the codebase (frontend, `userAudit.ts`, `eligibility.ts`) — if one is ever updated, check the others.
- `hardDeleteMember` exists but isn't reachable from this page (see User Lookup instead) — that's intentional; don't look for a permanent-delete button here.

The **Member Workspace** (`/admin/members/[id]`) now provides an overview and detailed sections for personal information, household, coverage, agreements, billing, invoices, notes, alerts, activity, and documents. It includes contact/address editing, saved notes, and alerts. The original inspector remains under **Account & diagnostics**, and email history/composition is under **Communications**. Brokers have a scoped workspace at `/partner/members/[id]`. See the [member workspace guide](../member-workspace.md) for permissions and current integration boundaries.

---

## Brokers (`/admin/brokers`)

This is the **sales/commission chain**: Program Managers → FMOs/Agencies → their Leader contacts. It is *not* the Site/Account/Group hierarchy (that's [Hierarchy](02-operations.md#hierarchy-adminhierarchy)) — even though the Hierarchy tree has its own middle tier. The two are separate systems that both involve partners: **Brokers** here = the commission chain; **Accounts** in Hierarchy = who owns which Group. Backend table: `distributionPartners`.

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
- No audit-log entries are written for any Brokers-page mutation (create/update/delete partner or leader) — there's no built-in history of who added or removed a broker.

---

## Partner Applications (`/admin/partner-applications`)

Review queue for public self-registration submissions from the `/register/rep` form, before they become live Brokers. Despite the page name, there's no file literally called `partnerApplications.ts` in the backend — submissions live in `convex/repOnboarding.ts` (table `repOnboardingSubmissions`). In the sidebar this page sits in **Members & Partners** (alongside [Partner Kit Leads](#partner-kit-leads-adminpartnerkit)) — see the nav map in [00-overview.md §3](00-overview.md#3-full-navigation-map).

### Public entry point (`/register/rep`)

A longer, unauthenticated formal-application form (`src/app/register/rep/page.client.tsx`) than [`/register`](#public-entry-point-register) — this is the real licensing/onboarding submission, not a general-interest lead. A **Submission Type** selector (Broker/Agency Only, Front-Line Rep Only, or Both) conditionally reveals two field groups:

- **Agency**: Agency Name*, DBA, EIN, Agency NPN, Primary Contact Name*/Email*/Phone, Program Manager, Physical/Mailing Address, Agency Licenses (free text), E&O Carrier + Expiration, requested Compensation Tier, Agency Effective Date/Status, W-9 Status + Received Date, Preferred Payment Method, ACH Authorization Status. (* = required when Agency or Both is selected.)
- **Rep**: First/Last Name*, Email*, Phone, Rep NPN, Assigned Agency (free text, not a lookup), Rep Licenses (free text), Rep Effective Date/Status, Writing Number. (* = required when Rep or Both is selected.)

On submit, `repOnboarding.submit` does real server-side validation before inserting — this is a step up from `/register`'s form, which has no backend validation at all beyond the args' basic types: it trims and drops empty strings, enforces the required-presence rules above based on `submissionType`, validates email format (both agency and rep email), validates EIN and NPN format (normalizing EIN to `XX-XXXXXXX`), and normalizes phone numbers. It does **not** dedupe against an existing submission for the same agency/rep — resubmitting creates a second row with status `new`, same as `/register`.

⚠️ **Until this session, this page had zero links from anywhere in the app** — no nav, no footer, no link from `/register` itself — reachable only by typing the URL. It's now linked from the bottom of [`/register`](#public-entry-point-register) ("Already a licensed broker, agency, or rep ready to onboard?"), but there's still no link to it from the main site nav/footer if you want broader discoverability.

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
- If the invite email fails during Approve, the partner/leader are still created silently — you have to notice the toast wording and go resend from the [Brokers](#brokers-adminbrokers) page yourself.
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

---

## Partner Kit Leads (`/admin/partnerkit`)

In the sidebar it sits in the **Members & Partners** section — see the nav map in [00-overview.md §3](00-overview.md#3-full-navigation-map).

**Purpose**: review queue for public partner/agency inquiries submitted via `/register` — separate from, and upstream of, [Partner Applications](#partner-applications-adminpartner-applications). This page captures the initial "we're interested" contact; Partner Applications is the formal licensing/onboarding submission that may follow later. Backed by `convex/contacts.ts` and the `partnerRegistrations` table (not `repOnboardingSubmissions`).

### Public entry point (`/register`)

A short, unauthenticated lead-capture form (`src/app/register/PartnerRegistrationForm.tsx`): Full Name, Email, Phone, Business/Agency Name (all required), and a "Send me the Partner Kit" checkbox (`wantsPartnerKit`) — that checkbox is the only thing that distinguishes a kit request from a general inquiry, and it's what the admin page's "N requested kit" pill counts. On submit it calls `contacts.submitPartnerRegistration` and redirects to `/health` after a few seconds.

- **Linked from**: two "Schedule a Demo" buttons (`src/app/health/page.tsx`, `src/app/health/dental/page.tsx`) and the `AscendConferencePopup` component. ⚠️ The button label says "Schedule a Demo" but the destination is this partner-registration form, not a scheduling tool — a copy/link mismatch worth fixing if it causes confused submissions.
- Below the form, a link to [`/register/rep`](#public-entry-point-registerrep) points anyone who's already a licensed broker/agency/rep straight at the formal application instead of the general-interest form.

### What's on the page

- A "N requested kit" stat pill, counting rows where `wantsPartnerKit` is true.
- **Add Leads** — a bulk-entry modal (5 blank rows by default: Name/Business/Email/Phone) for manually keying in leads collected outside the web form (e.g., a trade show sign-up sheet).
- **Export CSV** — Name/Email/Phone/Business/Wants Partner Kit/Status/Submitted.
- Status filter (All / New / Contacted / Closed).
- Table: Name, Business, Contact, Partner Kit (yes/no), Submitted, Status (inline dropdown).

### How it works

- **Public submission**: `contacts.submitPartnerRegistration` — the `/register` page's form, unauthenticated. Always creates a new row with `status: "new"`; there's no dedupe against an existing email/phone.
- **Bulk Add Leads**: `contacts.bulkAddPartnerRegistrations` — same, but admin-authenticated and always sets `wantsPartnerKit: false` regardless of what's typed (the bulk form has no field for it, since it's for leads collected in person, not through the kit-request form).
- **Status change**: `contacts.updatePartnerRegistrationStatus` — fires immediately on dropdown change, no confirmation, no audit-log entry.

### Known limitations

- No dedupe on either submission path — the same person filling out `/register` twice (or a bulk-add re-entering a lead already on the list) creates a second row rather than updating the first.
- No audit-log entries for status changes, same gap as Rep Codes and Brokers elsewhere in this file.
- No link from a Partner Kit Leads row to a corresponding [Partner Applications](#partner-applications-adminpartner-applications) submission if the lead later formally applies — the two flows aren't connected in the data model, only in intent.
