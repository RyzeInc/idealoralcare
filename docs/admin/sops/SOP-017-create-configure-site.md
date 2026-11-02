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

For AssureVantage, **Use supplied AssureVantage branding** fills the separate `assurevantage` site name/slug and includes Jason's transparent logo and supplied tagline. It leaves Domain blank and creates the site in **Onboarding**. Public brand routes are unavailable until the site is active; review its configuration before activating it. The sampled colors remain editable because a formal palette was not supplied. This does not rename existing Ideal sites, move groups, or publish the draft presentation.

## Steps — configure it (Edit Site wizard)

4. On the new Site's row, click **Edit**. The wizard has five tabs: **Identity**, **Branding**, **Marketing**, **Enrollment**, **Integrations**.
5. **Branding tab**: upload a **logo** (a 64×64 favicon is auto-generated from it if you don't set one, or upload/override the favicon yourself). Set the logo display width and the primary/secondary/accent **colors**. Optionally set a hero headline/subtext, footer text, and custom CSS.
6. **Enrollment tab**: set the support email/phone and welcome message, and toggle the enrollment options (require group code, allow self-enrollment, require payment, auto-activate, collect dependents/address/phone/employee ID). Add terms/privacy URLs if you have them.
7. **Integrations tab**: enter the Toothlens company and access key, the email sender identity (from-name / from-address / reply-to), the Careington and DialCare group codes, and the legal entity/carrier information.
8. Click **Save**.

## Configure marketing and share links without a custom domain

- Leave **Domain** blank to use this deployment's `/{slug}` landing page. The primary Ideal site uses `/health`.
- Open **Marketing** to turn landing sections, service promotions, and resource links on or off for this site. Unset switches preserve the existing presentation. Some landing sections exist only on the primary Ideal page.
- Service switches control navigation, service preview cards, benefit tiles, and the corresponding slideshow images. Full plan descriptions, legal disclosures, direct service URLs, and member tools remain available. Use the separate section switches to hide a section containing more general service copy.
- A white-label site's **Shop** checkbox controls its storefront and navigation link. The platform shop switch must also be on. Shops are off by default for white-label sites.
- Existing third-party offers are still managed under **Branding → Promo links** with separate on/off and page-placement controls.
- Click **Save** before opening the public page to review changes. The switches are live settings once saved; the editor is not an unpublished draft.
- Under **Enrollment → Landing and broker links**, select a destination and an existing broker code, then copy or open the link. The URL uses the current deployment and includes `?ref=CODE` for broker attribution. Rebranding does not require replacing broker codes.
- The **Member oral scan** destination uses `/{slug}/dashboard?tab=oral-scan` (`/health/dashboard?tab=oral-scan` for Ideal). Signed-out members sign in before reaching the tab. This is the member tool; `/oral-health-scan` is the public explainer page. A scan session starts only when the member chooses to start it.
- A brand without an uploaded logo displays its name in the shared header/footer instead of the Ideal logo.
- **Branding → Information Request Email** is separate from member support and sender identity. AssureVantage's supplied `info@assurevantage.com` is an information-request contact, not a replacement for Ideal's oral-health or Essentials support contacts.

## Group-specific Balance for Life member codes

In **Organizations → Edit**, use **Balance for Life Member Code** for an explicitly assigned vendor code such as `CMG`. Blank preserves the existing `IDEAL` default. The field is separate from the provider group code, subscriber ID and six-digit Essentials group number. Group names do not automatically assign codes.

The assigned code flows to the protected member-data queries, generated welcome packets/cards, welcome email and staff resend paths. A custom-code packet uses its native BFL instructions and an app-download page with the original Android/iPhone QR images from the supplied code-free letter, instead of appending the legacy letter that prints `IDEAL`. Default-code packets keep the original letter. The vendor letter and QR images are stored as server assets so access codes are not served through an unauthenticated static URL.

White-label carts are stored separately by site on the same deployment. Opening another brand does not reuse Ideal's product selections. Referral capture waits for cart storage to load so an old cart cannot overwrite a new broker landing code.

## Verification

- Re-open **Edit Site** — your branding and integration values are still there.
- If the Site has a live domain, load its public pages and confirm the logo and colors appear.
- Open its path-based landing page too. Toggle a promotion off, save, and confirm its navigation/card/slideshow disappear for that brand while another brand remains unchanged.
- Open a broker landing link, navigate to plans and checkout, and verify the intended broker code is retained.
- Open the member scan link signed out and confirm sign-in returns to the scan tab.

## If something goes wrong

- **Branding saved but integrations didn't, or vice versa** — Save runs two separate operations (`updateSite` for the first three tabs, `upsertIntegrations` for the Integrations tab) with no all-or-nothing guarantee. If one fails or you close the tab mid-save, re-open Edit Site and re-save the tab that didn't stick.
- **You need to set Stripe mode / Connect account / price map** — those fields exist in the backend but have no form in the Integrations tab yet; setting them requires engineering (a direct data change), not this UI.
- **A large logo upload is slow or fails** — only the auto-generated favicon is resized; a very large logo uploads as-is. Use a reasonably sized image.

## Related SOPs

- [SOP-001](SOP-001-onboard-selfpay-employer-group.md) — once the Site exists, create Accounts and Groups under it.
