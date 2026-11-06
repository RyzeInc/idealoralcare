# AssureVantage customer experience refresh — November 6, 2026

Implements the customer-facing findings in [the November 5 audit](customer-experience-audit-2026-11-05.md), against baseline `264c2a2`. Admin pages and their systems are outside this work.

## Experience and content

- One AssureVantage header, service navigation, member entry, cart and footer across the homepage, benefit pages, membership selection, help, guides and account flows.
- Shared typography, spacing, imagery, colors, responsive layouts and keyboard focus treatment. Navigation and content reflow at 320 CSS pixels.
- Dedicated explanations, included services, access steps, limitations and FAQs for virtual medical care, labs, prescription savings, Balance for Life, oral screening, teledentistry and dental discounts. Seven corresponding guides add practical detail.
- Homepage, comparison table, FAQs and enrollment selection explain the same product relationships: Essentials includes virtual care, labs, prescription savings and Balance for Life. Balance for Life is also available alone. Oral Care is purchased separately.
- Prices come from the current catalog. No Stripe prices, vendor identifiers, employer groups or membership benefits are changed. Existing CMG/Soars benefit configurations remain scoped to their groups.
- Removed unsupported statistics, mismatched provider counts, universal immediate-activation promises and inconsistent counseling limits from AssureVantage copy. Effective-date instructions point to the member's recorded date and welcome materials. Counseling copy uses the supplied per-life-event terms.
- Help distinguishes general AssureVantage inquiries from existing program-specific member support contacts. Public marketing does not publish vendor group codes or access credentials.

## Customer flows

- Saved cart, monthly-only rules, tier choices and Balance for Life deduplication retain the existing checkout engines. An empty checkout offers membership discovery before requiring authentication.
- Sign-up offers actual account creation. Password reset opens the reset form and preserves the original destination. Billing and employer upload entry keep AssureVantage branding through the existing Clerk primary-domain handoff.
- Missing invitations show an actionable invalid-invitation state. Protected billing pages redirect to sign-in before querying member data.
- Enrollment confirmation checks the signed-in purchaser's Stripe session. It distinguishes payment received, payment processing and unverified status without falsely declaring benefits active. Membership provisioning remains in the existing webhook.
- Member home displays purchased programs, program-specific documents, actual effective dates and provider access instructions. Oral tools remain available to members with Oral Care; dependents do not receive subscription-owner billing controls.
- A private member-benefits endpoint derives ownership from the Clerk session, restricts returned fields and uses no-store responses. Product-specific document downloads verify ownership. Fetch errors and delayed account provisioning have recovery/help states.
- Member cards prefer the recorded effective date. Cancellation correspondence uses the member's enrolled group brand.

## Search and legacy boundaries

AssureVantage has its own public sitemap, canonical URLs, page descriptions, social preview image and private-page indexing rules. Titles survive client hydration. Old guide links redirect to relevant replacements.

The public marketing on getidealoh.com stays at its historical identity and enrollment destinations. Frozen marketing templates and their hash baseline are unchanged. Other tenant pages retain their existing content. The Ideal social preview generator and discovery URLs retain their legacy branch. Shared functional account fixes do not migrate Ideal marketing.

## Validation

- Production Next.js build, including TypeScript and all 148 generated static pages.
- 187 focused regression tests across 24 files, covering domain isolation, frozen marketing, discovery, cart and checkout, authentication routing, API ownership, member views, PDFs and backend behavior. Additional UI regression checks after lint fixes.
- Local browser sweep: 36 desktop paths and 12 mobile checks; follow-up accessibility/reflow checks on six changed routes at 1440, 390 and 320 pixels. Fixed the discovered sign-in contrast, inline-link affordance and billing sign-in route issues. Final 18 targeted checks had no page exceptions, horizontal overflow or automated WCAG-tagged axe violations.
- Browser cart journey: standalone Balance for Life removed when Essentials is selected; Essentials plus individual Oral Care totals $73.94 monthly; selection persists across pages; broker referral survives the review link.
- Built-server responses verified that AssureVantage and Ideal render distinct homepages and their own working social preview images.
- Convex production deployment completed without index deletions or schema changes.

These checks do not constitute a live member login, purchase, cancellation or vendor-service test. No production membership, payment, eligibility submission or outbound customer message was created for validation. Approved broker agreements and missing source attachments were not fabricated. The prior audit records baseline test-suite failures; this document reports the focused release checks, not a claim that the entire repository test suite passes.
