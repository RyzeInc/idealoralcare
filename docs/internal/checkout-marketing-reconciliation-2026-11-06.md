# Checkout and marketing reconciliation — November 6, 2026

The release retains the customer experience, membership photos, public unified checkout, secure-host cart transfer, verified confirmation and hydrated cart clearing from `875395d`, `8bfe3df` and `e1b7780`. It adds the following behavior to that implementation.

## Public checkout and domain continuity

The three retail offerings remain available. Review, payment method, inline account creation or sign-in, agent selection and contract review stay in the same public checkout. Shopping stays on `www.assurevantage.com`. Clerk's existing technical primary hosts the AssureVantage-branded `/assurevantage/program-checkout` and `/assurevantage/program-success` routes on `www.getidealoh.com`; this keeps supported account creation inline instead of sending visitors to a standalone login page. Existing cart restoration and return-to-shopping links carry only public catalog selections and referral attribution.

The Stripe endpoint derives success and cancellation destinations on the server. AssureVantage payment cancellation returns to its secure checkout; its receipt returns to the secure confirmation route. Caller-supplied external return URLs cannot change these destinations. Legacy and other tenant routes retain their namespaces. Local/preview validation returns to its own origin.

Every retail customer, including existing and Google-created accounts, confirms census information before signing: name, a valid date of birth and mailing address, with optional phone and gender. Signup data is suggested only for the same email; saved intake is scoped to the account. Editing intake invalidates the matching signature context. The selected payment method's actual catalog amount is shown throughout checkout. Essentials and standalone Balance for Life keep the whole cart monthly and hide the annual option.

Signed documents save before Stripe is called. Each new document records its catalog product ID in an optional field, so existing records require no migration. The server verifies the purchaser, selected products, current amount, cadence, payment method and confirmed address against the saved agreements. Missing intake or mismatched documents block payment. Existing employer enrollment workflows and original member/vendor identifiers are preserved. Intake names and supported gender values survive Stripe's member-provisioning handoff.

## Controls inside each offering

Admin → Sites, Accounts & Organizations → edit a site → Marketing controls the promotional content inside the offerings. There is no offering-availability switch.

- Essentials: virtual medical care, labs, prescription savings and the included wellbeing promotion.
- Balance for Life: counseling, live support, Zenn and wellbeing/coaching resources.
- Oral Care: oral scanning, teledentistry and dental-network promotions.

Promotional cards, service navigation, summaries, catalog bullets and relevant footer links follow these settings. Required disclosures, actual purchased benefits, agreements, prices, eligibility processing and membership availability are not changed by marketing visibility. Direct informational URLs remain available. Ideal's frozen marketing templates and hash baseline are unchanged.

## Verification and limits

Scoped regression checks cover checkout gates, document ownership/matching, intake validation, marketing visibility, both domain routes, cart transfer and confirmation, hydrated cart clearing, member/API ownership, admin sidebar behavior and legacy marketing integrity. Production builds and TypeScript checks pass; targeted lint is clean.

Browser checks cover six order combinations at 1440, 390 and 320 pixels, plus an empty cart. Public account entry stays inline, payment remains gated, and no page exceptions or horizontal overflow occurred. Browser fixtures read the public production catalog without creating accounts or making mutations. No real signup, signed customer document, payment, cancellation or vendor submission was generated. Live customer authentication and payment completion require an authorized customer session.
