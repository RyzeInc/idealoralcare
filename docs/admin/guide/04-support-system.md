# Support & System

Covers: [Customer Service](#customer-service-admincustomer-service) · [Admin Users](#admin-users-adminusers) · [User Audit](#user-audit-adminuser-audit) · [Audit Log](#audit-log-adminaudit-log) · [Site Settings](#site-settings-adminsettings) · [Dev Tools](#dev-tools-admindev-tools)

Permission note: read [00-overview.md §1](00-overview.md#1-the-permission-model-read-this-first) before this file — it matters more here than anywhere else in the suite, since this is where admin access itself is managed.

---

## Customer Service (`/admin/customer-service`)

**Purpose**: the per-member Stripe billing desk — look up any member, inspect their subscription, cancel it, issue a refund, or log a support note.

### What's on the page

- Header stats: MRR, Active Paid Members, Past Due, Cancelled This Month.
- **Member Lookup** search (name/email/member ID).
- Member panel: identity + subscription card (status, amount, cadence, payment method, period end).
- **Cancel Subscription** → choose "Cancel at period end" or "Cancel immediately" → Confirm.
- **Invoice History** (lazy-loaded) — per-invoice **Refund** link (only where the invoice is paid and has a real charge) opening a modal: Amount (blank = full refund), Reason (customer request / duplicate / fraudulent), optional internal note.
- **Add Support Note**.

### How it works

- **Cancel immediately**: calls Stripe's cancel API directly; Convex state update and the cancellation email are both deferred to the `customer.subscription.deleted` webhook — there's a short async delay before the member's entitlements actually revoke.
- **Cancel at period end**: calls Stripe's update API, but *also* eagerly patches the Convex bundle status and sends the cancellation email immediately, rather than waiting for a webhook.
- **Refund**: calls Stripe's refund API directly (optional partial amount, reason code), then logs to the admin audit trail.

### Known limitations

- ⚠️ **Issuing a refund does not touch Convex membership state at all** — no entitlement revocation, no subscription cancellation, nothing. It is purely a Stripe-side monetary action plus an audit log entry. A code comment claims a webhook will "sync" this, but no such webhook handler exists (`charge.refunded` isn't handled anywhere). **If you refund a member and also want to end their membership, you must separately click Cancel Subscription** — refunding does not do that for you.
- No department/role restriction on who can issue refunds or cancel subscriptions — any admin can, contrary to what the Admin Users "Role Guide" copy implies about Editors only "viewing" billing.

---

## Admin Users (`/admin/users`)

**Purpose**: manage who has admin-portal access, at what role, and onboard the very first admin. **Read [00-overview.md §1](00-overview.md#1-the-permission-model-read-this-first) first** — the role distinction managed here is not actually enforced by the backend except on the Dev Tools page.

### What's on the page

- **Initialize First Admin** (only shown when zero admins exist), **Add Existing User**, **Invite Admin**.
- A descriptive "Role Guide" (Owner vs. Editor) — accurate as *stated intent*, not as *enforced behavior*.
- Current admins table: Role is an inline dropdown that changes immediately, no confirmation. **Remove** has a confirm dialog.
- Pending Invitations table: Resend / Cancel.

### How it works

- **Invite Admin**: creates a 30-day-expiry invite record, then calls Clerk's Invitations API to email the person a sign-up link. If email delivery fails, the invite record still exists and can be resent.
- **Add Existing User**: searches Clerk's user directory directly and adds them immediately — no invite/email step.
- **Change role**: fires immediately on dropdown change, no confirmation, logged to the audit trail.
- **Remove**: confirm dialog → immediate delete, logged to the audit trail.
- **Initialize First Admin**: only rendered when the admin list is empty; server-side re-checks that zero admins exist before inserting you as `owner`.

### Known limitations

- ⚠️ **There is no "keep at least one owner" or "keep at least one admin" safeguard anywhere.** Any admin (owner or editor) can demote the last owner, remove the last admin entirely, or promote anyone (including themselves) to owner. Be deliberate about who has access — the system will not stop you from locking yourself out or handing out owner broadly.
- ⚠️ **A separate, less-safe bootstrap path exists at `/bootstrap`**, outside this page, that does not check whether admins already exist — see [00-overview.md §1](00-overview.md#1-the-permission-model-read-this-first) and [05-known-issues.md](05-known-issues.md). Do not treat `/bootstrap` as a documented workflow; it's a standing gap.
- The Clerk-user search used by "Add Existing User" hits an API route that only checks "is this person signed in," not "is this person an admin" — it's protected in practice only by sitting behind the admin layout, not by its own permission check.
- Role changes have no confirmation step even though they're as consequential as removal (which does have one) — be careful with the inline dropdown.

---

## User Audit (`/admin/user-audit`)

**Purpose**: cross-system identity reconciliation — merges Clerk, Convex (`memberProfiles`), and Toothlens records into one table so you can spot orphaned/incomplete accounts, validate census data, and — unlike the plain Members page — directly edit *any* field or permanently delete a record.

### What's on the page

- **Refresh Clerk**, **Columns** (persisted picker), **Export CSV** (with Standard / All Columns / Payroll Audit presets — Payroll Audit includes SSN; a warning banner appears whenever SSN is part of an export).
- 7 stat-card filters: All / Active (Both) / Linked-No-Sub / Clerk Only / Convex Only / Missing Census / Toothlens.
- Search + filters (system presence, member status, subscription status, Toothlens presence, terminated-hidden toggle).
- Click a row to expand a full cross-system detail panel (identity, personal, contact, address, vendor IDs, employer/payroll incl. an SSN reveal/hide toggle, status, hierarchy, Clerk account, subscription/entitlements, Toothlens, dependents, census-validation summary).
- Inside the expanded panel: **Edit all fields** (the full field set — everything the plain Members page's inline edit does *not* expose) and **Delete permanently**.

### How it works

- **Edit all fields**: same underlying mutation as the Members page's edit, just with every field exposed instead of five.
- **Delete permanently**: a `confirm()` dialog that explicitly warns the profile, activity log, and notes are removed entirely, **but the Stripe subscription and Clerk/Toothlens accounts are not affected.** An audit-log entry is written before the delete.

### Known limitations

- ⚠️ **This is the only place a member profile can be permanently, irreversibly deleted** (the Members page only soft-deletes/terminates). Since deleting here doesn't touch Stripe, **cancel the member's Stripe subscription from [Customer Service](#customer-service-admincustomer-service) first** if you're removing them for real — otherwise you can end up with an active Stripe charge running against no corresponding Convex record.
- No department/role restriction — any admin can hard-delete any member profile.
- The "Payroll Audit" export preset includes SSN by default — handle exported files accordingly.

---

## Audit Log (`/admin/audit-log`)

**Purpose (intended)**: a system-wide, append-only viewer of admin-initiated actions — role changes, removals, refunds, cancellations, deletions — for compliance and troubleshooting.

### ⚠️ This page is currently non-functional for its actual purpose

Audit entries **are** being written correctly under the hood every time an admin does something consequential (role change, refund, member deletion, etc.) — the write path is solid. But the query this page uses to *read* them maps the data to field names that don't match the real schema. **The practical result: every real row on this page renders with blank/"—" for When, Actor, Target, and Summary.** Only the row count and the Action-type badge display correctly.

Additionally, the **Action** dropdown filter and **Actor (Clerk User ID)** text filter on this page don't do anything — only the Limit selector actually re-queries.

**What this means for you today:** don't rely on this page to answer "who did X and when." If you need to investigate a specific admin action, you currently need someone with direct Convex/database access to query the `adminAuditLog` table properly (a correctly-built query, `adminAudit.listRecent`, already exists in the backend and supports the filters this page's UI wants — it's just not the one the page calls). This is flagged in detail in [05-known-issues.md](05-known-issues.md) as a fix worth prioritizing, since it undermines the compliance/audit purpose of the whole page.

---

## Site Settings (`/admin/settings`)

**Purpose**: edit a small set of global site/brand text fields. Despite the sidebar tooltip describing this as "brand, domain, and site-wide configuration," the actual scope is much narrower.

### What's on the page

One form, three sections:
- **General**: Site Name, Tagline, Description.
- **Contact**: Contact Email, Support Email.
- **Social Links**: Twitter/X, LinkedIn, GitHub.

**Save Settings** is the only action.

### Known limitations

- ⚠️ **There is no domain, logo, favicon, or theme/color configuration anywhere on this page or in its backend schema** — only the 8 text fields listed above exist. If you need to change the enrollment domain or header color described in older onboarding docs, that capability doesn't currently exist here (check with engineering before assuming it's just hidden somewhere).
- ⚠️ **The Dashboard's "Unread Contacts" and "New Inquiries" alert tiles link to `/admin/settings?tab=contacts` and `?tab=inquiries`**, implying tabs for viewing contact-form submissions and newsletter inquiries. **Those tabs don't exist.** Clicking either alert lands on the plain settings form with no contacts/inquiries content visible anywhere. If you need to see actual contact-form submissions, this page currently can't show them to you.
- The read query backing this form (`siteSettings.get`) has no server-side auth check of its own — it relies entirely on the admin layout gate.

---

## Dev Tools (`/admin/dev-tools`)

**Purpose**: a one-page console of migration/seed/diagnostic utilities so an Owner can run common maintenance tasks without going into the Convex dashboard directly. **This is the only page in the entire admin suite with any real access restriction** — it renders an "Owner Access Required" screen (naming current owners to contact) for anyone whose role isn't `owner`.

### What's on the page

- **Migrate Toothlens Users**, **Seed Catalog Products**, **Link My Admin as Member**, **Backfill Subscriber IDs** (Dry Run / Apply), **Backfill Vendor IDs** (Dry Run / Apply), **Deduplicate Member Profiles** (by Clerk User ID, Dry Run / Apply).

### How it works

- The backfill/deduplicate tools all support a dry-run pass first — always run dry-run before apply, since the results tell you exactly what will change.
- **Backfill Subscriber IDs** populates a member's subscriber ID from their group's Organization Code.
- **Backfill Vendor IDs** deterministically derives missing Careington/Toothlens vendor IDs — idempotent, safe to re-run.
- **Deduplicate Member Profiles** keeps the one profile matching the active subscription (or most recently updated) for a given customer and terminates the rest.

### Known limitations

- ⚠️ **The "Owner Access Required" gate is a client-side-only check.** Most of the underlying mutations this page calls are only `requireAdmin`-gated on the backend (owner-or-editor, same as everywhere else) — two of them (**Seed Catalog Products**, **Link My Admin as Member**) have **no server-side auth check at all**. In practice this is low-risk (you'd need direct API access to the Convex deployment to exploit it), but the page's own stated security model ("owner-only") isn't fully backed by the server for every tool listed on it.
- Several backend files grouped near Dev Tools in the codebase are **not actually wired into this page's UI** and shouldn't be expected to appear here: `seedNewIdeal.ts` (CLI-only), `repAttributionBackfill.ts` (orphaned, unreferenced anywhere), `coreValues.ts` and `ventures.ts` (full CRUD modules with no admin page or public page using them at all — likely leftover from a removed or not-yet-built feature), and most of `grantFreeAccess.ts`'s exports (CLI-only aside from the Dashboard's "Grant Free Access" button and the `/bootstrap` path). If you're looking for "where do I manage Core Values / Ventures content," the answer today is: nowhere in the UI.
- A handful of `_debug*`/`_migration*` functions in `devTools.ts` are one-off, incident-specific remediations (explicitly commented as tied to a specific historical bug) — they're CLI-only by design and aren't meant to become general-purpose SOP steps.
