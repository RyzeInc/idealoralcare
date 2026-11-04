# AssureVantage is the primary brand

The owner's final November 3 correction governs: AssureVantage is the new business brand on `www.assurevantage.com` only. Marketing on `getidealoh.com` is frozen at pre-session commit `43aaa07`, retaining Ideal identity. The earlier change that made both homepages AssureVantage was a misunderstanding and has been reversed. No domain forwarding from Ideal to the new homepage is configured.

The AssureVantage site is classified as `primary`. The original Ideal site/group records remain available for legacy groups, including CMG/Soars and Wellness Patriots. Their memberships, vendor access codes, prices and existing Ideal materials are not migrated by the new-brand launch. Admin site lists label those records as Legacy Ideal.

New public program links stay under `/assurevantage`: `plans` for oral savings, `essentials`, `balance-for-life`, `oralcare`, `program-plans`, `program-checkout` and `program-success`. These reuse the existing program components and billing flow. They attribute new orders to the AssureVantage hierarchy. Existing `/health` and `/newideal` paths remain the legacy experiences. On AssureVantage, `/assurevantage` redirects to its own root page, retaining referral parameters. Requests to the new `/assurevantage` pages on getidealoh.com redirect to the corresponding AssureVantage URL; shared Clerk authentication pages are exempt. Existing Ideal marketing URLs never redirect to the new brand.

The existing oral catalog, Essentials tiers, BFL and oral add-on catalog entries are offered through the main brand. The separately requested CMG/Soars benefit replacement is not activated by this marketing restoration. Legacy program pages retain their existing presentation and vendor instructions.

Member branding covers oral, Essentials and standalone BFL emails, packet PDFs and cards for AssureVantage enrollments. Essentials support remains `info@getidealhealth.com` / 844-433-2502; oral support remains `support@getidealoh.com` / (844) 679-9367. Existing vendor access codes remain in the member instructions. Branded packets use the native BFL app QR page rather than an Ideal-branded vendor appendix.

Clerk's technical primary authentication host remains getidealoh.com and assurevantage.com remains its verified satellite. This describes session transport, not business branding: the company/site is AssureVantage, and the shared account system does not require a new repository or user directory.

Deployment: deploy the updated backend and frontend, then run the internal `admin/launchSites:configureAssureVantage` setup with `{"promoteToPrimary":true}`. This is an idempotent promotion/catalog update; it does not rename or move legacy groups. Existing support, payment and vendor validation items in the email audit remain open unless separately verified.

## Historical Ideal marketing protection

The original root chooser and cards, oral-health header/slideshow/footer/wordmark, and program header/footer are isolated in `src/components/marketing/legacy-ideal`. They come directly from `43aaa07`, with only stylesheet import paths relocated. `/health/page.tsx` is restored byte-for-byte from that commit. The integrity manifest and regression tests protect these files, while host-specific tests verify original Ideal titles and destinations (`/health`, `/newideal/balance-for-life`, `/newideal`). Shared program catalog, checkout and success pages retain their original Ideal logo dimensions and unmodified product names on legacy paths. AssureVantage templates and referral propagation remain separate.

The freeze covers public marketing. Authentication, security, intake and member benefit fixes continue independently. Operational status in the email audit remains evidence-based; a marketing deployment does not close unpaid invoices, filings, signature requests or vendor incidents.
