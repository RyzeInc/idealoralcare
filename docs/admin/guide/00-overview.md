# Admin Suite Guide — Overview

This is the operator-facing companion to `ADMIN_QUICK_START.md`. It explains **every** page in the admin suite (`/admin/*`), what an admin can actually click, and — critically — how each feature works underneath (which Convex functions run, what they validate, and where the real limits are). Pair it with the [SOP library](../sops/README.md) for step-by-step procedures.

Read [`05-known-issues.md`](05-known-issues.md) before you rely on anything described as "coming soon," "stub," or flagged with a ⚠️ in this guide — several UI elements exist but don't do what their label implies.

## Guide contents

| File | Covers |
|---|---|
| [00-overview.md](00-overview.md) | This file — role model, hierarchy, dashboard, vocabulary |
| [01-members-partners.md](01-members-partners.md) | Members, Distribution (Brokers), Partner Applications, Rep Codes |
| [02-operations.md](02-operations.md) | Hierarchy, Eligibility Files, Vendor Files |
| [03-finance.md](03-finance.md) | Billing, List-Bill, List-Bill Invoices, Invoice Calculator, Commissions |
| [04-support-system.md](04-support-system.md) | Customer Service, Admin Users, User Audit, Audit Log, Site Settings, Dev Tools |
| [05-known-issues.md](05-known-issues.md) | Every bug, stub, and dead code path found while researching this guide, severity-tagged |

---

## 1. The permission model — read this first

The admin suite has two "roles" shown in the UI: **Owner** and **Editor**. The Admin Users page describes Owner as able to "manage other admins, billing, site settings" and Editor as more limited, operational access.

**In reality, that distinction is almost entirely cosmetic.** Every backend function in the admin suite (with one exception) is gated by a single helper, `requireAdmin` (`convex/lib/authGuards.ts`), which only checks:

> Does a row exist in the `adminUsers` table for this Clerk user (**any** role) — or does an **active** `distributionPartners` record exist for this Clerk user?

It never inspects the `role` field. There is no `requireOwner` helper anywhere in the codebase. Concretely, this means an **Editor** can, exactly like an Owner:
- Promote themselves (or anyone) to Owner, or delete the last remaining Owner (`/admin/users`).
- Issue Stripe refunds and cancel any member's subscription (`/admin/customer-service`).
- Edit Site Settings, permanently delete a member profile, or delete a broker/rep code.

The **one** real exception is **Dev Tools** (`/admin/dev-tools`): that page checks `role === "owner"` client-side before rendering. But most of the mutations it calls are still only `requireAdmin`-gated on the backend — the owner check is a UI convenience, not a server-side wall.

**Active Distribution Partners also count as "admin."** Any broker/agency with an active portal login satisfies `requireAdmin` too, in addition to internal `adminUsers` rows. There is no code-level restriction that keeps a logged-in partner from calling internal-admin mutations directly, beyond the fact that the UI doesn't link them there.

**Practical takeaway for SOPs:** unless a procedure explicitly says "Owner only," assume any admin — Owner or Editor — can perform it. Treat "Owner" as a title, not a security boundary, until engineering closes this gap.

### First-admin bootstrapping — two different paths, one of them risky

- **`/admin/users` → "Initialize First Admin"** — correctly gated: only works if the `adminUsers` table is completely empty.
- **`/bootstrap`** — a separate page that calls `grantFreeAccess.bootstrapFirstAdmin`. This mutation only checks whether *the calling user* is already an admin, **not** whether any admins already exist. Any signed-in Clerk user who finds this URL can insert themselves as `owner` at any time, even on a platform that already has owners, and it also grants them a free 365-day subscription. Treat this as an open item for engineering, not a documented workflow — see [05-known-issues.md](05-known-issues.md).

---

## 2. Dashboard (`/admin`)

The landing page after sign-in. Everything on it is read-only except two "Quick Actions" buttons.

**Alert feed** (only rendered if any count is non-zero): Unread Contacts, New Inquiries, Failed Eligibility Files, Stuck Enrollments — each links to the relevant page. ⚠️ The Contacts/Inquiries links point to `/admin/settings?tab=contacts` / `?tab=inquiries`, but Site Settings has no tab handling at all (see [04-support-system.md](04-support-system.md)) — clicking them lands on the plain settings form with nothing about contacts or inquiries visible.

**Summary cards**: Paying Subscribers, Active Members, Monthly Revenue, Pending Enrollments, Eligibility Files — each links to the page that owns that number (Billing or Members).

**Quick Eligibility Check** — a live search box (name/email/member ID, 2+ characters) against the member roster, capped at 25 results, for a fast lookup without leaving the dashboard.

**System Health** — six tiles (Stripe Subscriptions, Enrollment Pipeline, Eligibility Processing, Contact & Newsletter, Member Profiles, Last Activity) with an Operational/Needs Attention/Idle badge per tile, backed by `admin.members.getSystemHealth`.

**Quick Actions**:
- **Grant Free Access** — calls `admin.grantFreeAccess.grantMeFullAccess`; gives *your own* admin account a 365-day comp subscription to every plan. Useful for testing member-facing flows as yourself.
- **Sync Stripe Subscriptions** — POSTs to `/api/stripe/sync`; reconciles active Stripe subscriptions against Convex bundle records (useful after a missed webhook).
- **Create New Group**, **Upload Eligibility File**, **View Billing Summary** — plain links to Hierarchy, Eligibility, and Billing respectively.

**How it's built**: the Dashboard is the one page that has actually been migrated to the "unified data layer" (`convex/admin/unifiedData.ts`) — a single `getDashboardMetrics`-style query replaces what used to be five separate queries, specifically to keep the numbers here consistent with the Members/Billing/Hierarchy tabs. If you ever see the Dashboard disagree with another tab's count for the same thing, that's a real bug worth reporting, not expected behavior.

---

## 3. Full navigation map

From `src/components/admin/AdminSidebar.tsx` — the authoritative list of what's actually reachable, exactly as labeled in the sidebar:

| Sidebar section | Label | Route | One-line purpose |
|---|---|---|---|
| Overview | Dashboard | `/admin` | Daily snapshot, alerts, quick links |
| Members & Partners | Members | `/admin/members` | The member roster — search, edit, terminate, notes |
| Members & Partners | Brokers | `/admin/brokers` | Program Managers / FMOs / Agencies (page itself is titled "Distribution Management") |
| Members & Partners | Applications | `/admin/partner-applications` | Review broker/agency/rep self-registrations |
| Members & Partners | Rep Codes | `/admin/rep-codes` | Attribution codes for sales reps |
| Operations | Hierarchy | `/admin/hierarchy` | Site → Account → Group tree (page titled "Brokers & Organizations") |
| Operations | Eligibility Files | `/admin/eligibility` | Upload member rosters |
| Operations | Vendor Files | `/admin/vendor-files` | Generate outbound files for Careington/DialCare/DDN |
| Finance | Billing | `/admin/billing` | Self-pay revenue reporting, E123 export |
| Finance | List-Bill Invoices | `/admin/list-bill-invoices` | Itemized employer invoice generator + lifecycle |
| Finance | Invoice Calculator | `/admin/invoice-calculator` | Internal revenue/dispersal reconciliation |
| Finance | Commissions | `/admin/commissions` | ⚠️ Explicitly "Coming Soon" — read-only, numbers unreliable |
| Support | Customer Service | `/admin/customer-service` | Per-member Stripe refunds/cancellations |
| System | Admin Users | `/admin/users` | Manage admin access and roles |
| System | User Audit | `/admin/user-audit` | Cross-system (Clerk/Convex/Toothlens) identity lookup |
| System | Audit Log | `/admin/audit-log` | ⚠️ Broken — see known issues |
| System | Site Settings | `/admin/settings` | Brand/contact text fields only (no domain/logo config) |
| System | Dev Tools | `/admin/dev-tools` | Owner-only (UI-enforced) migration/seed utilities |
| Help | Help & Vocabulary | `/admin/help` | In-app glossary and workflow cheat sheet |

**Not in the sidebar at all** (reachable only by typing the URL):
- `/admin/list-bill` — records an employer's consolidated payment for payroll-deduction groups. No nav link anywhere in the app links to it.

---

## 4. Distribution hierarchy vocabulary

The platform organizes every member under a three-level tree. The UI, the database, and older comments use different names for the same things — this table reconciles them.

```
Site (Carrier)
 └─ Account (Broker)
     └─ Group (Organization / Employer)
         └─ Members
```

| UI term | Also called | What it is |
|---|---|---|
| **Site** | Carrier, Whitelabel | Top-level brand (e.g., "Ideal Health"). Usually just one. |
| **Account** | Broker, Distribution Partner | The producer/broker managing a book of business under a Site. |
| **Group** | Organization, Employer | A specific employer/association whose members enroll. Has a globally-unique **Group Code** and an **Organization Code (Subscriber ID)**. |
| **Rep Code** | Tracking Code | A code attached to an individual sales rep, independent of the Account tree, used for enrollment attribution and commissions. |

Separately, **Distribution Partners** (Program Managers / FMOs / Agencies, managed on the "Brokers" page at `/admin/brokers`) are the sales/commission chain — a *different* concept from the Site→Account→Group tree above, even though both use the word "Broker" in different places. See [01-members-partners.md](01-members-partners.md) for the distinction.

## 5. Member lifecycle

Every member moves through this status pipeline (`memberProfiles.memberType`/`status`). Status drives billing eligibility, what appears in eligibility/vendor files, and what self-service the member sees.

| Status | Meaning |
|---|---|
| `lead` | Captured contact (e.g., inquiry form). No enrollment started. |
| `eligible` | Loaded via eligibility file. Has not self-enrolled (may have no email — still billable for list-bill, see [03-finance.md](03-finance.md)). |
| `invited` | Sent a re-enroll / activation link. Awaiting action. |
| `enrolling` | Actively in the checkout / signup flow. |
| `active` | Paid (or employer-comped) and currently entitled to benefits. Counts in billing. |
| `past_due` | Stripe payment failed; in retry window. Still entitled during grace. |
| `inactive` | No active subscription. Dormant. |
| `terminated` | Removed from the program. Excluded from billing. Soft-delete only (profile still exists). |
| `declined` | Eligibility was rejected (duplicate, invalid data, restriction). |

## 6. Billing concepts glossary

| Term | Meaning |
|---|---|
| **Self-Pay** | Member pays their own subscription via Stripe (CC/ACH). Default for individual signups. |
| **List-Bill** | Employer pays one consolidated invoice covering many members (payroll deduction). `groups.listBill.enabled === true`. |
| **Bundle** | A `subscriptionBundles` row — one active Stripe subscription per customer, wrapping one or more product entitlements. |
| **Primary / Dependent** | The household subscriber (pays, owns `customerId`) vs. a rider on their bundle. Dependents are always $0 incremental revenue — Family pricing already covers the household. |
| **Past Due** | Stripe automatic retry window after a failed charge. Member keeps entitlement during the grace period. |
| **E123** | External billing import format used by finance for self-pay revenue. |
| **Toothlens / Careington / Processing / Partner Vendor / Ryze Keep** | The five buckets every dollar of gross revenue splits into — see [03-finance.md](03-finance.md) for the exact per-tier math. |

## 7. Roles & departments (as displayed in the UI — see §1 for what's actually enforced)

- **Owner** — UI implies full access including Dev Tools and admin management. In practice, backend-enforced only for the Dev Tools page render.
- **Editor** — UI implies day-to-day operator access, excluding admin/billing/settings management. In practice, backend-enforced nowhere — an Editor can do everything an Owner can except see the Dev Tools page.
- **Departments** (`admin`, `program_manager`, `fmo`, `broker`, `sales`, `hr`, `executive`) are informational tags only — they don't gate any feature.
