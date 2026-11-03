# AssureVantage supplied branding

Source: Jason Daniewicz's October 22 “IDEAL rebranding information” package, supplied locally on November 1. Allen's “This looks great!” is positive feedback, not a recorded formal approval.

- `Main Logo.png` is a transparent 440 × 147 RGBA image. It was copied unchanged to `public/brands/assurevantage/logo.png`.
- SHA-256: `023188d0485ea7cd33cea627054350f97aba0bdad0027dfbf801de2ff9044cc8`.
- The supplied lockup and presentation show “Better Access. Greater Value. More Peace of Mind.”
- The preset's colors are sampled/approximated from the artwork; a formal color-palette document was not present. They remain editable.
- `info@assurevantage.com` is for information requests. It is kept separate from oral member support (`support@getidealoh.com`, (844) 679-9367) and Essentials support (`info@getidealhealth.com`, 844-433-2502).
- The presentation is a draft and has not been published or used as an authoritative benefit/pricing list.
- The other `image.png` in the package is an Ideal Health logo. The Genefit folder's image is also an Ideal Health logo; neither establishes a Genefit identity.

The website editor can apply the provided artwork to a separate AssureVantage site without a custom domain. It creates that site in Onboarding. Existing Ideal sites and groups are not renamed or moved by this action. Public brand routes require an active configured site.

Confirmed brand rules from the supplied emails: new sales use AssureVantage; Soars/CMG stays Ideal; Wellness Patriots members see Ideal and include the AI scan. No broader rule for Prime QSR, Apricus, American Freight or existing-member rebranding is inferred.

## November 3 domain launch

The owner confirmed Vercel Valid Configuration and the production Clerk satellite was added and verified. Both `clerk.getidealoh.com` and `clerk.assurevantage.com` return the same public Clerk configuration IDs. The website canonical host is `www.assurevantage.com`; the Clerk satellite domain option is `assurevantage.com`, matching its verified `clerk.assurevantage.com` endpoint.

AssureVantage entry routes redirect into `/assurevantage` on the same deployment. Sign-in/account creation runs on the primary Ideal host with AssureVantage page branding and an allowlisted return to the satellite. Anonymous checkout returns to the original cart URL; member scan deep links retain their destination. Authentication on the satellite does not create a separate user directory.

Deployment-console setup is `admin/launchSites:configureAssureVantage` (internal mutation). It creates an Onboarding site from the current visible oral catalog and the primary site's enrollment defaults. `{"activate":true}` explicitly activates it after the frontend is deployed. Repeating setup preserves manual branding edits and existing sites, groups, accounts, members and product prices. Suspended/terminated sites cannot be reactivated by this helper.

Live member authentication and email delivery still require an actual account test. This configuration does not establish that the historical Clerk email-DNS warnings are resolved.
