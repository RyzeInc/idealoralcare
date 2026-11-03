# AssureVantage is the primary brand

The owner's November 3 clarification supersedes the earlier interpretation of AssureVantage as a separate white-label partner. AssureVantage replaces Ideal Health as the main public brand. Both `www.assurevantage.com/` and `www.getidealoh.com/` render the same shared three-program chooser: Oral Savings, Balance for Life and Essentials. The original layout, program descriptions and starting prices are retained with AssureVantage identity.

The AssureVantage site is classified as `primary`. The original Ideal site/group records remain available for legacy groups, including CMG/Soars and Wellness Patriots. Their memberships, vendor access codes, prices and existing Ideal materials are not migrated by changing the public homepage. Admin site lists label those records as Legacy Ideal.

New public program links stay under `/assurevantage`: `plans` for oral savings, `essentials`, `balance-for-life`, `oralcare`, `program-plans`, `program-checkout` and `program-success`. These reuse the existing program components and billing flow. They attribute new orders to the AssureVantage hierarchy. Existing `/health` and `/newideal` paths remain the legacy experiences. `/assurevantage` itself redirects to the shared root page, retaining referral parameters.

The existing oral catalog, Essentials tiers, BFL and oral add-on catalog entries are offered through the main brand. The product replacement proposed for CMG/Soars is still unapproved and is not activated by this change. Legacy program pages retain their existing presentation and vendor instructions.

Member branding covers oral, Essentials and standalone BFL emails, packet PDFs and cards for AssureVantage enrollments. Essentials support remains `info@getidealhealth.com` / 844-433-2502; oral support remains `support@getidealoh.com` / (844) 679-9367. Existing vendor access codes remain in the member instructions. Branded packets use the native BFL app QR page rather than an Ideal-branded vendor appendix.

Clerk's technical primary authentication host remains getidealoh.com and assurevantage.com remains its verified satellite. This describes session transport, not business branding: the company/site is AssureVantage, and the shared account system does not require a new repository or user directory.

Deployment: deploy the updated backend and frontend, then run the internal `admin/launchSites:configureAssureVantage` setup with `{"promoteToPrimary":true}`. This is an idempotent promotion/catalog update; it does not rename or move legacy groups. Existing support, payment and vendor validation items in the email audit remain open unless separately verified.
