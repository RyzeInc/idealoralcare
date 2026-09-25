# Plan: Convert Ideal Oral Health into a White-Label Multi-Tenant Platform

## Goal
Turn the single-brand Ideal Oral Health site into a platform that hosts many rebranded
copies of the oral-health plan for multiple companies, via a phased migration (not a redesign).

## Confirmed Decisions
- **Routing:** Build a flexible resolver (domain + subdomain + path). LAUNCH with subdomains
  as default (acme.platform.com) + custom domains for serious white-label clients.
  Do NOT lead with path-based for customer-facing brands (keep path-based for internal/preview only).
- **Stripe:** Spec BOTH models. MVP default = single Stripe account + site/brand metadata.
  Add Stripe Connect (connected accounts) only when a partner must legally own the customer,
  statement descriptor, tax/compliance, refunds, disputes, and payouts.
- **Onboarding:** Internal admin-managed provisioning only (no self-service in this scope).
- **Scope:** Full conversion as a PHASED platform migration.

## Current-State Findings (verified)
- Backend ~70% multi-tenant-ready. `sites` table (convex/schema.ts L688) already has:
  slug, name, type(primary|whitelabel|channel), domain, basePath, branding{logo, colors,
  hero, customCSS, footerText}, allowedPlanIds, enrollmentDefaults{supportEmail/phone, terms...}, status.
- Hierarchy sites->accounts->groups->members already modeled with siteId scoping on accounts.
- site_resolver.ts: resolveSiteBySlug, resolveSiteByDomain, resolveHierarchyByGroupCode,
  resolveAllowedPlanIds. NOTE: resolveSiteBySlug throws on inactive — needs graceful handling.
- SiteThemeProvider.tsx exists: injects CSS vars (--brand-primary/secondary/accent, logo, favicon,
  custom CSS, doc title). BUT: defaults slug to "ideal-health", resolves slug from window path only
  (no domain/subdomain), hardcodes fallback logo + " | Modern Health Plans Made Simple" title.
- Commission system multi-tenant aware (commissionRates with optional siteId override).
- Distribution partners: PM->FMO->Agency->Broker hierarchy implemented.

## Hardcoded "Ideal" hotspots (must de-brand)
- src/lib/constants.ts (SITE_CONFIG, PARTNER_VENDOR_NAME, CARRIER_NAME, emails, URLs)
- src/lib/env.ts (PRODUCTION_URL), next.config.ts (allowedOrigins, CSP clerk domain)
- src/app/layout.tsx + every page's static `metadata` export (titles, OG, twitter @ryzeinc)
- src/components/health/NexusHealthWordmark.tsx, NexusHealthFooter.tsx (logo, address Jupiter FL)
- public/health-assets/* (NexusLogo.png etc.), fallback /ideal-oral-health-logo.png
- src/legal/*.md (MEMBERSHIP_AGREEMENT, TERMS, DISCLOSURE, MARKETING_FULFILLMENT)
- src/email-templates/membershipEmails.ts (subjects, body, links, support email, colors)
- src/lib/card-renderer.tsx, fulfillment-pdf.tsx, generate-fulfillment-pdf.ts (member card + PDFs)
- Toothlens embed hardcoded to "ryzehealth" company; RESEND_FROM_EMAIL static (getidealoh.com)

## Key gaps for true multi-tenancy
- No tenant-isolation middleware on Convex queries (cross-tenant data leak risk).
- adminUsers has no siteId scoping (platform-wide admin only).
- Email sender domain static; Toothlens company hardcoded; SFTP creds not per-group.
- Metadata is static per page (no generateMetadata using resolved site).
- Stripe single account; no per-site product/price mapping or metadata tagging yet.

## Phased Plan

### Phase 0 — Foundations & Tenant Context (no UI change)
- Add server-side tenant resolution: middleware (src/proxy.ts) reads host header ->
  resolve subdomain/custom-domain -> attach siteSlug/siteId to request (header/cookie).
- Add resolveSiteByHost query (domain OR subdomain OR fallback path), graceful when not found/inactive.
- Create a single source-of-truth `getSiteContext()` helper for server components + route handlers.
- Add siteId scoping fields where missing (adminUsers.siteId optional; platformAdmin flag).
- Define tenant-isolation pattern: every Convex query/mutation that returns tenant data must
  accept/derive siteId and filter by it. Add a withTenant() guard helper + audit existing queries.

### Phase 1 — Branding/Theming Layer (de-brand the frontend)
- Replace src/lib/constants.ts static brand values with a `BrandConfig` resolved from site record.
- Refactor SiteThemeProvider: resolve via host (subdomain/domain) not just path; remove
  ryze-health default and Ideal fallbacks (use generic platform defaults).
- Make layout.tsx use generateMetadata() pulling site name/desc/OG/favicon dynamically.
- Rename/parameterize Ideal components -> Wordmark/Footer read from useSiteTheme (logo, name,
  address, support contact, footerText).
- Convert card-renderer, fulfillment-pdf, generate-fulfillment-pdf to accept brand props (logo
  storageId/url, brand name, support, website) from site context — no hardcoded paths.
- Asset strategy: per-site logo/favicon/hero stored via Convex _storage (branding.logoStorageId).

### Phase 2 — Templated Legal & Email
- Convert src/legal/*.md into templates with {{brandName}}, {{supportEmail}}, {{website}},
  {{legalEntity}}, {{address}}, {{carrierName}} tokens; render per-site at request time.
- Store per-site legal overrides + carrier/disclosure data on site (extend enrollmentDefaults
  or new `sites.legal` object: legalEntityName, carrierName, address, termsUrl, privacyUrl).
- Parameterize email-templates: subject/body/links/support/colors from site branding.
- Resend: send "from" per-site verified domain/sender (sites.enrollmentDefaults.supportEmail or
  new sites.email.fromAddress + verified domain); platform-level API key.

### Phase 3 — Per-Tenant Integrations
- Toothlens: add sites.integrations.toothlensCompany + accessKey; dynamic embed URL + user-create.
  Document Toothlens naming rule (lowercase, no spaces/underscores); pre-register per tenant.
- DialCare/Careington eligibility: store per-group SFTP/vendor config (host, user, encrypted secret,
  group code, schedule) — new `vendorConfigs` table keyed by groupId/siteId.
- Provider network (dentaldiscountnetwork.json): shared across tenants; surfaced via member portal.
- Clerk: single app; map org/site relationship; enforce admin role + siteId scoping in admin layout.

### Phase 4 — Payments (Stripe) Multi-Tenant
- MVP default: single Stripe account; tag every Checkout Session / Customer / Subscription with
  metadata { siteId, accountId, groupId, brokerId }. Per-site product/price mapping in catalog.
- Reporting: revenue/MRR filtered by siteId in admin billing.
- Stripe Connect (deferred/optional path documented): connected account per qualifying partner;
  application fee; route webhooks by connected account; per-brand descriptor/tax/refunds/disputes/payouts.
- Webhook handler: resolve siteId from metadata/connected account; idempotent.

### Phase 5 — Backoffice Control Plane (THE "launch super easy" core)
VERIFIED current state: convex/admin/hierarchy.ts already has createSite/updateSite/getSites/
removeSite + createAccount/createGroup + setCustomPricing/setAllowedPlanIds/setGroupCapacity.
src/app/admin/hierarchy/page.tsx already has create/edit modals BUT only captures
slug/name/type/domain. So backend ~exists; the ADMIN UI + a few tables are the real gap.

Build a single "Brands" control plane that drives the ENTIRE lifecycle from the backoffice:

A. Brand Launch Wizard (src/app/admin/brands) — guided multi-step, near one-click:
   Step 1 Identity: name, slug, type(whitelabel/channel/primary), subdomain (auto), custom domain(opt).
   Step 2 Branding: upload logo/favicon/hero (Convex _storage generateUploadUrl -> logoStorageId),
     color pickers (primary/secondary/accent), hero headline/subtext, footer text, optional customCSS.
   Step 3 Plans & Pricing: visual selector of catalog products (allowedPlanIds) + per-product price
     grid (setCustomPricing: monthlyCard/ACH, annualCard/ACH).
   Step 4 Enrollment: full enrollmentDefaults form (requireGroupCode, requireEligibilityMatch,
     allowSelfEnrollment, requirePayment, autoActivate, collect* flags, welcomeMessage,
     supportEmail, supportPhone, terms/privacy URLs).
   Step 5 Legal: legalEntityName, carrierName, address, disclosure overrides (feeds Phase 2 templates).
   Step 6 Integrations: per-site Toothlens company+key, email from-address, Stripe price mapping,
     DialCare/Careington group code + SFTP (feeds Phase 3 siteIntegrations table).
   Step 7 Review & Launch: live preview + Launch Readiness Checklist (below) -> activate (status=active).

B. New `siteIntegrations` table (convex/schema.ts) + convex/admin/integrations.ts mutations:
   { siteId, toothlensCompany, toothlensAccessKey(enc), emailFromAddress, emailDomainVerified,
     stripeMode(single|connect), stripeConnectAccountId?, stripePriceMap, dialcareGroupCode,
     sftpConfigRef }. Replaces hardcoded env (RYZEHEALTH_COMPANY, RESEND_FROM_EMAIL, PROVIDER_GROUP_CODE).

C. Branding asset upload: add generateUploadUrl handler for logos/favicons/hero (pattern already
   used in convex/admin/eligibility.ts L71). Store logoStorageId; serve via storage URL.

D. Domain management: subdomain auto-provisioned (wildcard TLS). Custom domain workflow with
   status (pending->verifying->verified->active): show DNS CNAME/TXT instructions, verify check,
   activate. Add domain status fields to sites or siteIntegrations.

E. Site-scoped admin access (SECURITY): add adminUsers.siteIds[] + platformAdmin flag; add
   requireSiteAdmin(ctx, siteId) guard; scope every admin page/query by selected/assigned site.
   Platform admins get a site-switcher; tenant admins are locked to their siteIds.

F. Launch Readiness Checklist (gates the Launch button): logo set, colors set, >=1 plan + price,
   support email set, legal entity set, email domain verified, Toothlens company set (if used),
   domain verified (if custom), at least one admin assigned. Show pass/fail per item.

G. Brand cloning / templates: "Duplicate from existing brand" to prefill wizard (fast launch).

H. Scope existing admin pages (members, billing, hierarchy, brokers, commissions, eligibility,
   audit) by selected site.

I. Seed/migrate: convert current live site into first "primary" site (Ideal); backfill siteId on
   legacy rows; ensure existing data keeps working before isolation guards turn on.

### Phase 6 — Hardening & Cutover
- Tenant data-isolation audit (automated test querying as tenant A cannot read tenant B).
- next.config.ts: dynamic allowedOrigins/CSP for tenant domains (env + DB-driven allowlist).
- SEO: per-tenant sitemap/robots/OG; canonical per domain.
- Smoke-test full flow per a 2nd demo brand: subdomain -> theme -> enroll -> Stripe -> email ->
  member card/PDF -> dashboard (Toothlens/DialCare) all show correct brand.

## Relevant files
- convex/schema.ts (sites L688; add legal/email/integrations + adminUsers.siteId; vendorConfigs)
- convex/hierarchy/site_resolver.ts (add resolveSiteByHost; graceful inactive handling)
- src/proxy.ts (host-based tenant resolution middleware)
- src/components/providers/SiteThemeProvider.tsx (host resolution; drop Ideal defaults)
- src/lib/constants.ts, src/lib/env.ts, next.config.ts (de-hardcode brand/domain)
- src/app/layout.tsx + page metadata exports (generateMetadata)
- src/components/health/NexusHealthWordmark.tsx, NexusHealthFooter.tsx (dynamic)
- src/lib/card-renderer.tsx, fulfillment-pdf.tsx, generate-fulfillment-pdf.ts (brand props)
- src/legal/*.md (tokenized templates), src/email-templates/membershipEmails.ts (parameterize)
- convex/legal/emailFulfillment.ts (per-site sender), Toothlens/DialCare integration files
- src/app/api/stripe/* (metadata tagging; optional Connect), webhook route (site resolution)
- src/app/admin/* (new Brands/Sites mgmt + site scoping)

## Verification
- Automated: tenant-isolation test (A cannot read B); typecheck/build; Convex schema deploy.
- Backoffice launch test: a non-engineer creates a brand end-to-end via the Brand Launch Wizard
  (identity -> branding upload -> plans/pricing -> enrollment -> legal -> integrations -> launch)
  and the Launch Readiness Checklist gates activation. Target: brand live in minutes, no code/env edits.
- Manual: visit new brand subdomain + custom domain; verify theme, legal docs, email sender,
  member card/PDF, Toothlens embed, Stripe metadata all brand-correct.
- Regression: existing Ideal site (now "primary") unchanged for end users.

## Out of scope (this spec)
- Self-service tenant signup/billing portal for brand owners.
- Stripe Connect full implementation (documented as optional path, not built by default).
- New product/plan types beyond existing oral-health plan.
