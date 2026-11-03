# Email action audit — November 3, 2026

**Brand correction:** The owner's later clarification establishes AssureVantage as the main brand replacing Ideal Health. The [primary-brand rollout](primary-brand-rollout.md) supersedes this audit's earlier separate-brand interpretation. Both public domains use the same AssureVantage homepage; legacy group memberships remain intact.

This audit distinguishes implemented application behavior from business or vendor completion. The supplied email text and attachments establish the requirements; they do not establish that invoices were paid, an agreement was executed, a filing was accepted, or a vendor accepted a production file.

## Application changes and verification

- **One application, separate brand:** AssureVantage uses the shared production deployment and Clerk application. Its canonical host is `www.assurevantage.com`, entry path `/assurevantage`, and verified Clerk endpoint `clerk.assurevantage.com`. Existing Ideal links are preserved.
- **Legacy groups:** No existing sites, accounts, groups, member records, prices or entitlements are migrated. CMG/Soars and Wellness Patriots retain Ideal. No brand mapping is inferred for Prime QSR, Apricus or American Freight.
- **Member materials:** The optional site setting `memberBrandingEnabled` controls oral welcome emails, packet/agreement PDFs and member cards. It is enabled for AssureVantage in this release. It defaults off for existing sites. The owning group's site takes priority over the member profile's site; the domain a member happens to visit cannot rebrand their materials. The setting also affects later resends, which is disclosed in the editor.
- **Contacts and sender:** `info@assurevantage.com` remains an information-request contact. Oral member support stays `support@getidealoh.com` / (844) 679-9367. Branded messages keep the established `noreply@getidealoh.com` sending address and use the site display name; this does not assume that AssureVantage outbound email DNS is verified. Essentials support is not changed.
- **Direct enrollment:** The deployment setup creates an idempotent direct-sales account and group under AssureVantage. It uses the application's existing `IDEALDO` provider code, not an invented vendor identifier. Checkout checks for an active, provisionable site/account/group before creating a payment session. Existing employer groups are not reused for new direct sales.
- **Broker links:** The editor uses a site's configured custom domain, falling back to the current deployment if none is configured. Codes are retained. Live checks resolved Kellie's AssureVantage link to `/assurevantage/plans?ref=100401` and her old Ideal link to `/newideal/plans?ref=100401`. Detailed broker records remain behind internal queries; the public vanity resolver returns only an active code and destination hint.
- **Marketing controls:** Site-specific switches cover oral scan, teledentistry, dental discounts, landing sections and resource links. Shop remains a separate per-site opt-in. These controls change promotion, not purchased benefits. No vision benefit is added. Public marketing does not disclose the BFL access code or RxValet group/BIN/PCN.
- **Member codes and Zenn:** BFL defaults to the established IDEAL code; confirmed group-assigned values can be stored separately from numeric vendor IDs and flow into protected packets, cards and email. Group names alone do not assign a code. Zenn is described as part of the BFL app.
- **Eligibility:** Pipe-delimited TXT and pipe-delimited CSV use the 28-field layout. Preflight catches malformed pipe counts, missing address/city/state/ZIP/DOB and required primary email, duplicates, dependent ordering, invalid dates and placeholders. Staff review remains required before member changes. Full/delta export capabilities remain available. Production vendor acceptance, the monthly full-file delivery schedule, exact approved group codes and term-date conventions still require operational verification; the current database uses last-day-of-coverage termination semantics.
- **Scan entry and QR:** Oral email QR codes point to the enrolled site's authenticated dashboard with `tab=oral-scan`. Branded packet/card links use the member's site. This is not evidence that the missing external AllAboard QR has been repaired.
- **Partner agreement availability:** The existing `/register` signing flow referenced eight missing `/partnerkit/page-*.jpg` files; the first page also returned 404 in production. Signing now stops with a document-unavailable message instead of displaying an unseen agreement. Rep/agency registration remains available. Restoring the approved kit is required before using that signing flow.

## Every email action and remaining evidence

| Item | State after this audit | Still required |
| --- | --- | --- |
| Toothlens May–July payables | Open; no payment status inferred | Invoices, ledger/remittance or bank confirmation and reconciliation |
| VI Validation & Guarantee Agreement | Open | PandaDoc executed copy/status |
| Original Clerk email pause for Ideal/Nexus | AssureVantage satellite and public auth handoffs verified; historical delivery issue not closed | Successful actual account/code-email test and production Clerk email-DNS status for the affected domains |
| DialCare RYZEGRPS invoices | Open | Current aging statement/payment confirmation and response from the responsible contacts |
| Careington October 16 delta errors | Preventive validation implemented; incident not closed | Corrected failed rows and a current vendor acceptance result |
| Genefit website / pilot | AssureVantage landing and broker links available; [call script](genefit-pilot-call-script.md) remains a draft | Confirm selling entity/brand mapping, final offer, assigned pilot brokers, approved TPR/reseller agreement and marketing; do not invent a separate Genefit logo/domain |
| Florida company registration | Open | Approved legal entity details and actual filing/acceptance evidence |
| Seamless compensation / Ideal overrides | Open | Contract terms, commission/override statements, deposits and reconciliation |
| Wellness Patriots October 26 test | Accepted in the supplied emails | Preserve the correction: Kyle said the test was good. The separate format-thread follow-up remains unresolved |
| CMG/Soars Lyric replacement | Staged only; no live replacement | Formal approval, exact final product name, effective date, existing-versus-new-member scope and vendor roster/access instructions; follow the [scoped rollout](cmg-soars-hbe501-rollout.md) |
| AssureVantage domain | Connected to shared app; new brand isolated | Actual member sign-in/email-delivery test; formal palette/brand approval and any broader existing-member policy are still not supplied |
| SmartScan / AllAboard failure | Stable protected scan destination provided | Original QR image or decoded failing URL, plus expected authentication context |
| New broker enrollment links | Builder and Kellie's named link verified | Complete affected-broker list and explicit exceptions; preserve Ideal links for CMG/Soars and other legacy groups |
| Claude Sonnet retirement | No Anthropic/Claude/Sonnet caller found in app source or scripts searched | Identify any caller outside this repository and the actual provider retirement notice before choosing a migration |

HBE501/HBH501/Helper/Eliminator are treated as aliases under review, not multiple newly sellable products. The reported $5 PEPM is not substituted for a retail price. QuestSelect's existing member number is retained. The restricted Hospital Bill Eliminator chapter is not published. The draft presentation is not treated as an approved benefit specification. No reseller agreement, signed status, filing status or payment confirmation is manufactured.

## Verification and limits

The audit began from commit `194002b`. The full baseline run had 882 passing tests, 24 failing tests and four scheduled-function errors. Failures included missing partner-kit images, outdated family/invite test mocks, an invoice-history fixture and three undocumented routes. Route coverage was repaired and the missing-kit public flow now has a graceful stop; the missing approved documents and unrelated baseline test issues are not declared resolved.

Focused regression checks cover group/site brand isolation, opt-out behavior, branded email sender/attachments/QR, real PDF rendering and logo boundaries, broker domain links, checkout readiness and idempotent direct-sales setup. Synthetic AssureVantage and Ideal PDFs were rendered and their extracted text inspected. No live payment or member email was sent as an audit test. Public browser checks do not substitute for a real member sign-in, payment-to-provisioning test or vendor acceptance.
