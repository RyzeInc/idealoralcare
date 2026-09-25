# Member workspace

Open **Members → member detail → Open member workspace** in either portal. Direct routes are `/admin/members/[id]` and `/partner/members/[id]`. Each section has a shareable `?tab=` URL.

The ABC reference supplies the persistent identity header, overview cards, and section navigation. Ideal Oral Care adapts agreement and service views into coverage and benefits, and check-in history into recorded enrollment, payment, communication, and portal activity. The reference's customer data, gym-specific features, and branding are not imported.

| Section | Admins | Brokers |
| --- | --- | --- |
| Overview | Member summary, billing, household count, notes, activity | Same layout within assigned book |
| Personal & household | Contact/address editing, personal details, linked and legacy dependents, communication preferences | Contact details and dependent count |
| Coverage & agreements | Enrollment dates, benefits, agreement acceptance metadata | Coverage and agreement metadata; no signature or private address |
| Billing | Recorded subscription or employer billing arrangement | Same permitted billing facts |
| Invoices | Selected member's frozen employer invoice lines | Selected member's lines only, never employer census or group balances |
| Notes | Internal or explicitly shared notes; pin on creation | Create/read shared operational notes |
| Alerts | Create internal/shared alerts, expiration, resolve any | Create shared alerts, resolve own alerts |
| Activity history | Recorded event descriptions, search and date filters | Event types and timestamps; free-text descriptions withheld |
| Documents | Add internal/shared HTTPS document links; ID-card download | Add/read shared document links |
| Communications | Existing member email history and composer | Unavailable |
| Account & diagnostics | Existing detailed inspector, vendor IDs, account and scan information | Unavailable |

## Access and history

Every backend read and mutation resolves the authenticated viewer's scope. Agency and upline viewers retain their existing book permissions. Reps can open only members attributed to them, matching the roster index; an unrelated member ID returns no record. Legacy notes without visibility remain admin-only. Authors are derived from authenticated identity. Workspace writes create member activity records. Permanent member deletion removes owned alerts and document references too.

## Data boundaries

- This release links documents by HTTPS URL; it does not upload or scan files. The original document host controls access to the linked file.
- Individual invoice PDFs and live payment-method editing are not integrated. Existing subscription facts and payment activity remain available. No Stripe API behavior changes.
- Invoice status is the employer's invoice status, not a member's outstanding balance.
- Activity is the latest 100 recorded events, not a claim of comprehensive service usage or sign-in history. Notes, alerts, and links show the latest 200 visible records, with an explicit truncation notice. Invoice history searches the latest 100 employer invoices.
- Agreements are associated through the member's linked account. Members without an account may have no agreement records; the UI states this rather than inventing acceptance.
- Brokers see dependent counts, not dependent identities, dates of birth, home addresses, signatures, or account diagnostics.

## Rollout and validation

Deploy the additive Convex schema/functions with the frontend. The new `memberAlerts` and `memberDocuments` tables and optional note visibility require no historical data backfill. Existing notes stay private by default.

Backend regression tests cover unauthenticated access, same-agency rep isolation, revoked agency access, legacy-note privacy, activity redaction, document URL validation, authoritative authors, alert permissions, invoice projection, and owned-record cleanup. Interface tests cover loading/unavailable states, tab navigation, broker restrictions, zero-dollar coverage, form retry behavior, alert filtering, and profile editing. A production Next.js build is also required.
