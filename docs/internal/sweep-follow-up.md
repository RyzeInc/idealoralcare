# Sweep follow-up — November 1, 2026

## Implemented in the working tree

- Per-site marketing visibility, editable in Hierarchy → Sites → Edit → Marketing.
- Existing-domain landing, enrollment, broker, and authenticated scan links, available in the Enrollment tab.
- White-label referral capture after cart hydration, shared cart context across landing/plans/checkout, and separate stored carts for each white-label site.
- Brand-aware member portal, sign-in/sign-up, password reset, OAuth callback, dashboard, and logout navigation.
- Theme cleanup between brands; a missing white-label logo uses the brand name in the shared header and footer.
- Direct member dashboard tab links, including `?tab=oral-scan`, for a stable scan-tool destination.
- AssureVantage starter using the supplied transparent logo and tagline, with information-request contact separate from support. New starter sites remain Onboarding until activated.
- Group-specific Balance for Life member codes across protected member queries, packets/cards, email and staff resends; no group receives a guessed vendor access code.
- Vendor letter and original BFL app QR images moved to server-only assets. Custom-code packets carry the assigned code and original app QR images without the old IDEAL-coded appendix.
- Pipe-delimited `.csv` detection and shared 28-field preflight for intake and vendor export. Malformed intake files fail before member-change jobs are scheduled, with up to 100 issues saved for review.

## November 1 email correction and attachment review

Wellness Patriots' October 26 test was accepted: Kyle replied “Yes looks good. Thank you.” and on October 27 “The Test File came back all good.” The separate “Eligibility File Template and Format” follow-up remains unanswered in the supplied evidence. These are separate items.

The supplied folder is already accessible. Reviewed the brand images, draft presentation pages, employee HBE flyer, revised HBE FAQ, eligibility layout/guide, and fake sample/test files. Employee rosters and policy-number error files were left unopened. The restricted HBE chapter was not published or copied into the repository.

The five-row fake eligibility sample passes the new preflight. Wellness Patriots' one-row `.csv` is recognized as the 28-field pipe format; its literal `SAMPLE` ID is a test placeholder rather than a production numeric member ID. That does not reverse Kyle's recorded acceptance of the delivery/layout test.

These are local code changes. No domains, DNS records, vendor configurations, memberships, payment records, or production site records were changed. Existing marketing defaults are preserved. The controls do not replace Lyric with another benefit or change member entitlements.

## Inputs still required

| Workstream | Required evidence or decision | Next action once available |
| --- | --- | --- |
| AssureVantage / Soars / CMG | Confirmed: new sales → AssureVantage; Soars/CMG stays Ideal; Wellness Patriots sees Ideal. Still missing: existing-member policy, other-group rules, formal branding approval/palette | Use the separate supplied-artwork starter; issue explicitly branded broker links without moving legacy groups |
| Lyric replacement | Confirmed: CMG/Soars account only; retail Essentials price unchanged; reported vendor cost $5 PEPM including family. Still missing: formal approval, effective date, existing-member treatment and final vendor layout | Follow the [scoped rollout preparation](cmg-soars-hbe501-rollout.md); do not globally replace Lyric |
| Genefit Global | Known: 14-person pilot and ACA/Medicare sales-team context. Still missing: selling entity/final offer, website/brand mapping and actual TPR/reseller agreement | Review the [draft call script](genefit-pilot-call-script.md); no agreement is invented or sent |
| Clerk email delivery | Production DNS verification status and a successful sign-in email test for each domain | Repair configuration and verify delivery; code changes alone cannot confirm restoration |
| Eligibility files | Fake sample, template and format now supplied; Wellness Patriots test accepted in email. Actual failed rows and a current vendor acceptance result remain unavailable | Use new preflight; reconcile with the vendor without changing group codes or fabricating census data. Intake mailbox must be the address actually configured, not inferred from conflicting email references |
| SmartScan / AllAboard | Now identified as Joe/Sharewell's file-delivery platform. Still missing: actual failing QR destination/example | Trace authentication and redirects once the example arrives; do not claim that the external QR issue is fixed |
| Broker links | Kellie explicitly requested a new branded link. Existing examples include Kellie and Beth/100001; full affected-broker list is missing | Generate explicit brand links from existing codes. Preserve legacy Ideal links for Soars/CMG and other confirmed legacy groups |
| Payables / compensation | Invoices, payment records, commission/override agreements and statements | Reconcile actual records; do not infer paid status from local code |
| VI agreement / Florida registration | Signed document status / approved entity details and filing status | Confirm completion from the relevant records |
| Claude retirement notice | Calling application or automation and the actual provider notice | Audit and update the identified caller; no Claude/Anthropic references were found in the application source and scripts searched |

## Release and verification

Deploy the Convex schema/functions before, or together with, the frontend: the editor now sends site marketing settings and optional group BFL codes. No backfill is required for existing sites/groups; existing BFL defaults remain intact. Bundle the server-only packet assets with the frontend. Do not publish product replacements or reassign groups until the mapping and vendor terms are confirmed.

See [SOP-017](../admin/sops/SOP-017-create-configure-site.md) for the user workflow. Automated regression coverage includes brand isolation, marketing/slideshow visibility, theme cleanup, shop opt-in, broker link/referral handling, member scan entry, and existing eligibility import/intake behavior. Actual vendor delivery, live email delivery, and the original external QR failure still require end-to-end verification with their inputs.
