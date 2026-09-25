# SOP-017: Create and Configure a New White-Label Site

**Purpose:** Stand up a new **Site** (a top-level brand/tenant) and configure its appearance and integrations — logo, colors, enrollment defaults, and the outside services it connects to (Toothlens, Stripe, Careington/DialCare).

**Who can do this:** Any admin (Owner or Editor) — but coordinate with engineering, since some settings (Stripe keys, vendor codes) must line up with real external accounts. This is rare and high-impact: a Site sits above every Account, Group, and member.

**When you'd do this:** Launching a new white-label brand on the platform.

**Before you begin:** Gather these first —
- The brand **name** and the **domain** it will run on (if any).
- A **logo** image (and optionally a favicon; one can be auto-generated from the logo).
- Brand **colors** (primary / secondary / accent).
- **Toothlens** company name and access key.
- **Stripe** details if this brand bills separately (mode, and — currently CLI-only — any Connect account / price map).
- **Careington** and **DialCare** group codes for this brand.
- The legal entity name/address and carrier name.

**Related guide:** [Per-Site Integrations & Branding](../guide/02-operations.md#per-site-integrations--branding-inside-edit-site)

## Steps — create the Site

1. Go to **Hierarchy** (`/admin/hierarchy`).
2. On the **Sites** tab, click **Create Site (Carrier)**.
3. Enter Name, Slug, Type, and Domain, then submit. The new Site appears in the Sites list.

## Steps — configure it (Edit Site wizard)

4. On the new Site's row, click **Edit**. A four-tab wizard opens: **Identity**, **Branding**, **Enrollment**, **Integrations**.
5. **Branding tab**: upload a **logo** (a 64×64 favicon is auto-generated from it if you don't set one, or upload/override the favicon yourself). Set the logo display width and the primary/secondary/accent **colors**. Optionally set a hero headline/subtext, footer text, and custom CSS.
6. **Enrollment tab**: set the support email/phone and welcome message, and toggle the enrollment options (require group code, allow self-enrollment, require payment, auto-activate, collect dependents/address/phone/employee ID). Add terms/privacy URLs if you have them.
7. **Integrations tab**: enter the Toothlens company and access key, the email sender identity (from-name / from-address / reply-to), the Careington and DialCare group codes, and the legal entity/carrier information.
8. Click **Save**.

## Verification

- Re-open **Edit Site** — your branding and integration values are still there.
- If the Site has a live domain, load its public pages and confirm the logo and colors appear.

## If something goes wrong

- **Branding saved but integrations didn't, or vice versa** — Save runs two separate operations (`updateSite` for the first three tabs, `upsertIntegrations` for the Integrations tab) with no all-or-nothing guarantee. If one fails or you close the tab mid-save, re-open Edit Site and re-save the tab that didn't stick.
- **You need to set Stripe mode / Connect account / price map** — those fields exist in the backend but have no form in the Integrations tab yet; setting them requires engineering (a direct data change), not this UI.
- **A large logo upload is slow or fails** — only the auto-generated favicon is resized; a very large logo uploads as-is. Use a reasonably sized image.

## Related SOPs

- [SOP-001](SOP-001-onboard-selfpay-employer-group.md) — once the Site exists, create Accounts and Groups under it.
