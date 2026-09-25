/**
 * SITE ROUTE REGISTRY — the single source of truth for "what URLs exist here".
 *
 * Three things read this file, which is the point: they used to be three
 * hand-maintained lists that drifted apart.
 *
 *   1. src/app/sitemap.ts  — emits every route carrying a `sitemap` block.
 *   2. src/app/robots.ts   — emits ROBOTS_DISALLOW.
 *   3. scripts/generate-url-registry.ts — renders docs/URL_REGISTRY.md, the
 *      partner-facing map of the platform.
 *
 * It also carries the admin console's routes, which src/lib/admin-nav.ts
 * cross-checks: a nav entry pointing at a path that isn't registered here (or
 * an admin page nobody can navigate to) fails
 * src/lib/__tests__/site-routes.test.ts. That test is how /admin/list-bill was
 * found orphaned — reachable, shipped, and absent from the sidebar.
 *
 * DELIBERATELY IMPORT-FREE. The doc generator runs under plain
 * `node --experimental-strip-types`, which has no bundler and no "@/" alias,
 * so a single import here would break `npm run docs:urls`.
 *
 * Dynamic segments are written `:param` (not `[param]`) so the paths read the
 * same way in the generated document as they do in a URL bar.
 */

export type RouteArea =
  | "Marketing"
  | "Member portal"
  | "Registration"
  | "White-label"
  | "Partner portal"
  | "Admin console"
  | "CRM"
  | "System"
  | "API";

/**
 * What the platform requires of the visitor. This is the *enforced* level, not
 * the intended audience — `/health/checkout` is `none` because checkout takes
 * payment before it takes an account (auth happens inline on the Account step).
 */
export type RouteAuth =
  | "none"
  | "member"
  | "partner"
  | "staff"
  | "owner"
  | "webhook";

export type ChangeFrequency = "daily" | "weekly" | "monthly" | "yearly";

export interface SiteRoute {
  /** Canonical path with `:param` for dynamic segments. */
  path: string;
  title: string;
  purpose: string;
  area: RouteArea;
  auth: RouteAuth;
  /**
   * Presence of this block is what puts a route in sitemap.xml. Absence is a
   * deliberate exclusion, and `notes` should say why for anything a reader
   * would expect to find there.
   */
  sitemap?: { priority: number; changeFrequency: ChangeFrequency };
  notes?: string;
}

/**
 * Marketing copy's last substantive edit. Bump this when page *content*
 * changes — not on every deploy.
 *
 * Previously the sitemap stamped `new Date()` at request time, which told
 * crawlers that all sixteen pages changed every time the sitemap was fetched.
 * A signal that is always "just now" is a signal search engines learn to
 * discard, so this is a real date rather than a live one.
 */
export const MARKETING_CONTENT_UPDATED = "2026-09-08";

export const SITE_ROUTES: SiteRoute[] = [
  // ─── Marketing (public, indexable) ──────────────────────────────────────
  {
    path: "/",
    title: "Root",
    purpose: "Plan chooser: routes visitors to the Oral Savings Plans (/health) or the Essentials membership (/newideal).",
    area: "Marketing",
    auth: "none",
    notes: "Excluded from the sitemap so /health stays the single canonical entry point for search.",
  },
  {
    path: "/health",
    title: "Home",
    purpose: "Primary brand landing page: hero, value props, plan entry points.",
    area: "Marketing",
    auth: "none",
    sitemap: { priority: 1.0, changeFrequency: "weekly" },
  },
  {
    path: "/health/plans",
    title: "Plans",
    purpose: "Plan catalogue with pricing and cadence selection. Accepts ?ref= for rep attribution.",
    area: "Marketing",
    auth: "none",
    sitemap: { priority: 0.9, changeFrequency: "weekly" },
  },
  {
    path: "/health/plans/:slug",
    title: "Plan detail",
    purpose: "Long-form detail for a single plan: inclusions, exclusions, FAQ.",
    area: "Marketing",
    auth: "none",
    notes:
      "Held back from the sitemap: still served from hardcoded MOCK_PRODUCTS and not linked from /health/plans. Add to the sitemap once it reads the live catalogue.",
  },
  {
    path: "/health/compare",
    title: "Compare plans",
    purpose: "Side-by-side plan comparison table.",
    area: "Marketing",
    auth: "none",
    sitemap: { priority: 0.8, changeFrequency: "monthly" },
  },
  {
    path: "/health/how-it-works",
    title: "How it works",
    purpose: "Explains the membership model end to end.",
    area: "Marketing",
    auth: "none",
    sitemap: { priority: 0.8, changeFrequency: "monthly" },
  },
  {
    path: "/health/discount",
    title: "Dental discount network",
    purpose: "Careington network savings — the discount side of the product.",
    area: "Marketing",
    auth: "none",
    sitemap: { priority: 0.8, changeFrequency: "monthly" },
  },
  {
    path: "/health/teledentistry",
    title: "Teledentistry",
    purpose: "24/7 virtual dental consults.",
    area: "Marketing",
    auth: "none",
    sitemap: { priority: 0.8, changeFrequency: "monthly" },
  },
  {
    path: "/health/oral-health-scan",
    title: "AI oral health scan",
    purpose: "Toothlens SmileScan explainer and entry point.",
    area: "Marketing",
    auth: "none",
    sitemap: { priority: 0.8, changeFrequency: "monthly" },
  },
  {
    path: "/newideal",
    title: "Essentials home",
    purpose: "Landing page for the Ideal Health Essentials membership (telehealth, Rx, labs, mental health) alongside Oral Care.",
    area: "Marketing",
    auth: "none",
    notes: "The /newideal pages were never in the sitemap; add them here once Essentials is ready to be indexed.",
  },
  {
    path: "/newideal/plans",
    title: "Essentials plans",
    purpose: "Plan chooser for Essentials and Oral Care. Default landing page for rep vanity URLs (/{code}).",
    area: "Marketing",
    auth: "none",
  },
  {
    path: "/newideal/essentials",
    title: "Essentials plan",
    purpose: "Essentials membership detail and the four coverage tiers. Rep links land here with ?to=essentials.",
    area: "Marketing",
    auth: "none",
  },
  {
    path: "/newideal/oralcare",
    title: "Oral Care plan",
    purpose: "Oral Care plan detail in the Essentials-branded chrome. Rep links land here with ?to=oralcare.",
    area: "Marketing",
    auth: "none",
  },
  {
    path: "/newideal/checkout",
    title: "Essentials checkout",
    purpose: "Stripe checkout for Essentials and Oral Care, with the signed membership agreement persisted at signing.",
    area: "Member portal",
    auth: "none",
    notes: "Intentionally public — authentication happens inline, as on /health/checkout.",
  },
  {
    path: "/newideal/success",
    title: "Essentials checkout success",
    purpose: "Post-payment confirmation for the /newideal checkout.",
    area: "Member portal",
    auth: "none",
  },
  {
    path: "/health/dental",
    title: "Dental care",
    purpose: "Dental-specific landing page for paid and organic search.",
    area: "Marketing",
    auth: "none",
    sitemap: { priority: 0.7, changeFrequency: "monthly" },
  },
  {
    path: "/health/faq",
    title: "FAQ",
    purpose: "Common member questions before purchase.",
    area: "Marketing",
    auth: "none",
    sitemap: { priority: 0.7, changeFrequency: "monthly" },
  },
  {
    path: "/health/shop",
    title: "Preventative care shop",
    purpose: "Affiliate storefront for preventative-care products. Outbound links, not plans.",
    area: "Marketing",
    auth: "none",
    sitemap: { priority: 0.6, changeFrequency: "weekly" },
    notes:
      "404s when the global shop kill switch is off (shop.queries.isEnabled). Listed anyway — the switch is an operational pause, not a decision to deindex.",
  },
  {
    path: "/health/blog",
    title: "Blog index",
    purpose: "Editorial and SEO content hub.",
    area: "Marketing",
    auth: "none",
    sitemap: { priority: 0.7, changeFrequency: "weekly" },
  },
  {
    path: "/health/blog/:slug",
    title: "Blog post",
    purpose: "Individual article. Enumerated in the sitemap from BLOG_POSTS.",
    area: "Marketing",
    auth: "none",
    notes: "Expanded per post by src/app/sitemap.ts; each post's own publish date is its lastModified.",
  },
  {
    path: "/health/enroll",
    title: "Enrollment wizard",
    purpose: "Guided enrollment: flow selection, broker attribution, member details.",
    area: "Marketing",
    auth: "none",
    sitemap: { priority: 0.7, changeFrequency: "monthly" },
  },
  {
    path: "/health/terms",
    title: "Terms of service",
    purpose: "Member terms.",
    area: "Marketing",
    auth: "none",
    sitemap: { priority: 0.3, changeFrequency: "yearly" },
  },
  {
    path: "/health/privacy",
    title: "Privacy policy",
    purpose: "Privacy notice.",
    area: "Marketing",
    auth: "none",
    sitemap: { priority: 0.3, changeFrequency: "yearly" },
  },

  // ─── Member portal & auth (reachable, never indexed) ────────────────────
  {
    path: "/health/sign-in",
    title: "Sign in",
    purpose: "Clerk-backed sign-in, hosted on our domain rather than Clerk's.",
    area: "Member portal",
    auth: "none",
  },
  {
    path: "/health/sign-up",
    title: "Sign up",
    purpose: "Account creation.",
    area: "Member portal",
    auth: "none",
  },
  {
    path: "/health/forgot-password",
    title: "Forgot password",
    purpose: "Password reset request.",
    area: "Member portal",
    auth: "none",
  },
  {
    path: "/health/sso-callback",
    title: "SSO callback",
    purpose: "OAuth return URL. Never linked directly.",
    area: "Member portal",
    auth: "none",
  },
  {
    path: "/health/claim-invite",
    title: "Claim invite",
    purpose: "Redeems an emailed invite for a group-enrolled employee.",
    area: "Member portal",
    auth: "none",
    notes: "Tokenised link sent by email; the token is the gate, not a session.",
  },
  {
    path: "/health/checkout",
    title: "Checkout",
    purpose: "Stripe checkout for a selected plan and cadence.",
    area: "Member portal",
    auth: "none",
    notes: "Intentionally public — the Account step authenticates inline so a visitor never loses their cart to a sign-in redirect.",
  },
  {
    path: "/health/dashboard",
    title: "Member dashboard",
    purpose: "Membership status, ID card, scan history, benefits.",
    area: "Member portal",
    auth: "member",
  },
  {
    path: "/health/manage-plans",
    title: "Manage plans",
    purpose: "Change, add, or cancel plans; open the Stripe billing portal.",
    area: "Member portal",
    auth: "member",
  },
  {
    path: "/health/admin-redirect",
    title: "Post-signup router",
    purpose: "Lands a freshly signed-up user on the right portal (member, partner, or admin).",
    area: "Member portal",
    auth: "member",
    notes: "Transient — calls /api/admin/post-signup-check and forwards.",
  },

  // ─── Registration / lead capture (public) ──────────────────────────────
  {
    path: "/register",
    title: "Partner kit — agreement & W-9",
    purpose: "Sign the Partner Agreement and W-9, or upload completed forms.",
    area: "Registration",
    auth: "none",
    sitemap: { priority: 0.4, changeFrequency: "yearly" },
    notes:
      "Naming is inverted against /register/partnerkit: this is the signing flow, that one is the sign-up form. Worth renaming before either URL is printed on collateral.",
  },
  {
    path: "/register/partnerkit",
    title: "Partner registration",
    purpose: "Agency and business registration form requesting the partner kit.",
    area: "Registration",
    auth: "none",
    sitemap: { priority: 0.5, changeFrequency: "monthly" },
    notes: "Feeds Admin → Partner Kit Leads.",
  },
  {
    path: "/register/rep",
    title: "Broker / agency / rep registration",
    purpose: "Onboarding submission for brokers, agencies, and front-line reps.",
    area: "Registration",
    auth: "none",
    sitemap: { priority: 0.5, changeFrequency: "monthly" },
    notes: "Feeds Admin → Partner Applications.",
  },
  {
    path: "/:repSlug",
    title: "Rep vanity URL",
    purpose:
      "Any unreserved single-segment path resolves against the rep-code table, records the visit, and redirects to /health/plans?ref=CODE with a 90-day attribution cookie.",
    area: "Registration",
    auth: "none",
    notes:
      "Handled in src/proxy.ts, ahead of auth. Reserved segments are listed in src/lib/rep-routing/reserved.ts — adding a top-level route means adding it there too, or a rep slug can shadow it.",
  },

  // ─── White-label brand sites ───────────────────────────────────────────
  {
    path: "/:siteSlug",
    title: "White-label brand site",
    purpose:
      "Partner-branded mirror of the marketing and member pages, themed per site from the Convex `sites` table.",
    area: "White-label",
    auth: "none",
    notes:
      "Mirrors: /, /plans, /compare, /how-it-works, /discount, /teledentistry, /oral-health-scan, /dental, /faq, /shop, /blog, /blog/:slug, /enroll, /checkout, /dashboard, /manage-plans, /claim-invite, /sign-in, /sign-up, /forgot-password, /sso-callback, /terms, /privacy. Deliberately absent from our sitemap — near-duplicates of /health would compete with the primary brand. Left crawlable so partners keep any organic traffic they earn.",
  },

  // ─── Partner portal ────────────────────────────────────────────────────
  {
    path: "/partner",
    title: "Partner overview",
    purpose: "Book-of-business summary for the signed-in partner.",
    area: "Partner portal",
    auth: "partner",
  },
  {
    path: "/partner/members",
    title: "Partner members",
    purpose: "Every member the partner is credited for.",
    area: "Partner portal",
    auth: "partner",
  },
  {
    path: "/partner/production",
    title: "Production",
    purpose: "Funnel, lead sources, and follow-ups.",
    area: "Partner portal",
    auth: "partner",
  },
  {
    path: "/partner/retention",
    title: "Retention",
    purpose: "Cohorts, churn, and revenue movement.",
    area: "Partner portal",
    auth: "partner",
  },
  {
    path: "/partner/downline",
    title: "Downline",
    purpose: "Sub-agencies and reps beneath this partner.",
    area: "Partner portal",
    auth: "partner",
    notes: "Hidden for reps, who have no downline.",
  },
  {
    path: "/partner/groups",
    title: "Groups",
    purpose: "Employer accounts and participation rates.",
    area: "Partner portal",
    auth: "partner",
  },
  {
    path: "/partner/watchlist",
    title: "Watchlist",
    purpose: "Accounts and members needing action today.",
    area: "Partner portal",
    auth: "partner",
  },
  {
    path: "/partner/resources",
    title: "Partner resources",
    purpose: "Marketing material, partner kit, collateral, and forms.",
    area: "Partner portal",
    auth: "partner",
  },

  // ─── Admin console ─────────────────────────────────────────────────────
  {
    path: "/admin",
    title: "Admin dashboard",
    purpose: "Daily snapshot: alerts, activity feed, system health, quick links.",
    area: "Admin console",
    auth: "staff",
  },
  {
    path: "/admin/insights",
    title: "Insights",
    purpose: "Whole-book performance: growth, revenue, retention, data health.",
    area: "Admin console",
    auth: "staff",
  },
  {
    path: "/admin/members",
    title: "Members",
    purpose: "Every person in a plan, at any lifecycle stage.",
    area: "Admin console",
    auth: "staff",
  },
  {
    path: "/admin/members/:id",
    title: "Member detail",
    purpose: "Single member: subscription, dependents, scans, billing, audit trail.",
    area: "Admin console",
    auth: "staff",
  },
  {
    path: "/admin/brokers",
    title: "Brokers",
    purpose: "Program managers, FMOs, and agencies reselling the plans.",
    area: "Admin console",
    auth: "staff",
  },
  {
    path: "/admin/rep-codes",
    title: "Rep codes",
    purpose: "Attribution codes and the vanity URLs that resolve to them.",
    area: "Admin console",
    auth: "staff",
  },
  {
    path: "/admin/partnerkit",
    title: "Partner kit leads",
    purpose: "Inbound registrations from /register/partnerkit.",
    area: "Admin console",
    auth: "staff",
  },
  {
    path: "/admin/partner-applications",
    title: "Partner applications",
    purpose: "Review broker, agency, and rep onboarding submissions from /register/rep.",
    area: "Admin console",
    auth: "staff",
  },
  {
    path: "/admin/resources",
    title: "Resources",
    purpose: "Manage the collateral that partners download.",
    area: "Admin console",
    auth: "staff",
  },
  {
    path: "/admin/hierarchy",
    title: "Hierarchy",
    purpose: "Sites → accounts → organizations. Also where a site's branding, domain, and integrations are edited.",
    area: "Admin console",
    auth: "staff",
  },
  {
    path: "/admin/eligibility",
    title: "Eligibility files",
    purpose: "Upload and reconcile employer member rosters.",
    area: "Admin console",
    auth: "staff",
  },
  {
    path: "/admin/vendor-files",
    title: "Vendor files",
    purpose: "Generate and download outbound vendor files for manual delivery.",
    area: "Admin console",
    auth: "staff",
  },
  {
    path: "/admin/list-bill",
    title: "List-bill management",
    purpose: "Payroll-deduction groups and monthly employer remittance.",
    area: "Admin console",
    auth: "staff",
  },
  {
    path: "/admin/billing",
    title: "Billing",
    purpose: "Subscription billing and group invoices.",
    area: "Admin console",
    auth: "staff",
  },
  {
    path: "/admin/list-bill-invoices",
    title: "List-bill invoices",
    purpose: "Group-paid roster invoices.",
    area: "Admin console",
    auth: "staff",
  },
  {
    path: "/admin/list-bill-invoices/:groupId",
    title: "Group invoice history",
    purpose: "Invoice history for one list-bill group.",
    area: "Admin console",
    auth: "staff",
  },
  {
    path: "/admin/list-bill-invoices/invoice/:invoiceId",
    title: "Invoice detail",
    purpose: "Single list-bill invoice with line items and payment status.",
    area: "Admin console",
    auth: "staff",
  },
  {
    path: "/admin/vendor-statements",
    title: "Vendor statements",
    purpose: "Locked monthly remittance statements for Toothlens, Careington, Ideal, and Ryze.",
    area: "Admin console",
    auth: "staff",
  },
  {
    path: "/admin/vendor-statements/:statementId",
    title: "Vendor statement detail",
    purpose: "One locked statement with its document and line detail.",
    area: "Admin console",
    auth: "staff",
  },
  {
    path: "/admin/vendor-statements/activity",
    title: "Vendor statement activity",
    purpose: "Cross-vendor history of generation, locking, and delivery.",
    area: "Admin console",
    auth: "staff",
  },
  {
    path: "/admin/vendor-statements/disclosure",
    title: "Vendor disclosure settings",
    purpose: "Controls which columns each vendor sees on their statement.",
    area: "Admin console",
    auth: "staff",
  },
  {
    path: "/admin/invoice-calculator",
    title: "Revenue & dispersal",
    purpose: "Per-member revenue and dispersal breakdown by group and partner.",
    area: "Admin console",
    auth: "staff",
  },
  {
    path: "/admin/commissions",
    title: "Commissions",
    purpose: "Agent commission reporting.",
    area: "Admin console",
    auth: "staff",
    notes: "Coming soon — figures are not yet reliable.",
  },
  {
    path: "/admin/shop",
    title: "Shop admin",
    purpose: "Affiliate products, ordering, and the storefront kill switch.",
    area: "Admin console",
    auth: "staff",
  },
  {
    path: "/admin/customer-service",
    title: "Customer service",
    purpose: "Member lookup and issue resolution.",
    area: "Admin console",
    auth: "staff",
  },
  {
    path: "/admin/communications",
    title: "Communications",
    purpose: "Send or re-send member email one at a time or en masse, with the full send log.",
    area: "Admin console",
    auth: "staff",
  },
  {
    path: "/admin/users",
    title: "Admin users",
    purpose: "Invite teammates and manage admin access.",
    area: "Admin console",
    auth: "staff",
  },
  {
    path: "/admin/user-audit",
    title: "User lookup",
    purpose: "Reconcile one person across Clerk, Convex, and Toothlens; repair or delete identity records.",
    area: "Admin console",
    auth: "staff",
  },
  {
    path: "/admin/audit-log",
    title: "Audit log",
    purpose: "Append-only, system-wide trail of admin actions.",
    area: "Admin console",
    auth: "staff",
  },
  {
    path: "/admin/settings",
    title: "Site settings",
    purpose: "Global site text: name, contact details, social links.",
    area: "Admin console",
    auth: "staff",
    notes: "Branding, domain, and integrations live under Hierarchy → Edit Site, not here.",
  },
  {
    path: "/admin/dev-tools",
    title: "Dev tools",
    purpose: "Developer and maintenance utilities.",
    area: "Admin console",
    auth: "owner",
  },
  {
    path: "/admin/docs/sops",
    title: "SOP library",
    purpose: "Step-by-step procedures for recurring admin tasks.",
    area: "Admin console",
    auth: "staff",
  },
  {
    path: "/admin/docs/guide",
    title: "Admin guide",
    purpose: "Narrative operator guide to the console.",
    area: "Admin console",
    auth: "staff",
  },
  {
    path: "/admin/docs/:section/:slug",
    title: "Doc article",
    purpose: "A single SOP or guide chapter, compiled from docs/admin/**.",
    area: "Admin console",
    auth: "staff",
  },
  {
    path: "/admin/help",
    title: "Help & vocabulary",
    purpose: "Terminology and common workflows for new operators.",
    area: "Admin console",
    auth: "staff",
  },

  // ─── CRM (internal staff only) ─────────────────────────────────────────
  {
    path: "/admin/crm",
    title: "CRM home",
    purpose: "Pipeline summary and today's work.",
    area: "CRM",
    auth: "staff",
    notes:
      "The whole /admin/crm tree is gated twice — once in the route layout and once per Convex function — because some CRM contacts are themselves brokers. Distribution partners never reach it.",
  },
  { path: "/admin/crm/deals", title: "Pipeline", purpose: "Deal board by stage.", area: "CRM", auth: "staff" },
  { path: "/admin/crm/deals/:id", title: "Deal detail", purpose: "One deal: stage history, contacts, activity.", area: "CRM", auth: "staff" },
  { path: "/admin/crm/contacts", title: "Contacts", purpose: "Prospect and customer contacts.", area: "CRM", auth: "staff" },
  { path: "/admin/crm/contacts/:id", title: "Contact detail", purpose: "One contact: touch history, emails, calls, notes.", area: "CRM", auth: "staff" },
  { path: "/admin/crm/companies", title: "Companies", purpose: "Prospect organizations and their deal stage.", area: "CRM", auth: "staff" },
  { path: "/admin/crm/companies/:id", title: "Company detail", purpose: "One company: people, deals, activity.", area: "CRM", auth: "staff" },
  { path: "/admin/crm/tags", title: "Tags", purpose: "Tag taxonomy for contacts and companies.", area: "CRM", auth: "staff" },
  { path: "/admin/crm/segments", title: "Segments", purpose: "Saved filters used to target campaigns.", area: "CRM", auth: "staff" },
  { path: "/admin/crm/workflows", title: "Workflows", purpose: "Automation rules and sequences.", area: "CRM", auth: "staff" },
  { path: "/admin/crm/workflows/:id", title: "Workflow detail", purpose: "One workflow's steps and run history.", area: "CRM", auth: "staff" },
  { path: "/admin/crm/campaigns", title: "Campaigns", purpose: "Outbound email campaigns.", area: "CRM", auth: "staff" },
  { path: "/admin/crm/campaigns/new", title: "New campaign", purpose: "Compose and schedule a campaign.", area: "CRM", auth: "staff" },
  { path: "/admin/crm/campaigns/:id", title: "Campaign detail", purpose: "One campaign: recipients, sends, engagement.", area: "CRM", auth: "staff" },
  {
    path: "/admin/crm/drip",
    title: "Drip campaigns",
    purpose: "Multi-phase outreach tracks and who is enrolled on each.",
    area: "CRM",
    auth: "staff",
    notes:
      "A drip campaign is the track (e.g. five broker emails); a campaign under /admin/crm/campaigns is one blast within it. Enrollment, not the blast's recipient list, is what records who is on a track and at which phase.",
  },
  { path: "/admin/crm/drip/:id", title: "Drip campaign detail", purpose: "One track: phase breakdown, members, and bulk phase moves.", area: "CRM", auth: "staff" },
  { path: "/admin/crm/import", title: "Import", purpose: "CSV import for contacts and companies.", area: "CRM", auth: "staff" },
  { path: "/admin/crm/inbox", title: "Inbox", purpose: "Inbound replies and unhandled conversations.", area: "CRM", auth: "staff" },
  { path: "/admin/crm/analytics", title: "CRM analytics", purpose: "Pipeline conversion and outbound performance.", area: "CRM", auth: "staff" },
  {
    path: "/admin/crm/settings",
    title: "CRM settings",
    purpose: "Pipeline stages, sending identities, and compliance settings.",
    area: "CRM",
    auth: "staff",
  },

  // ─── System / operational ──────────────────────────────────────────────
  {
    path: "/unsubscribe/:token",
    title: "Unsubscribe",
    purpose: "One-click unsubscribe for CRM email recipients.",
    area: "System",
    auth: "none",
    notes:
      "Public by necessity — the recipient has no account. The token is the only gate. Must stay reachable: CAN-SPAM requires it.",
  },
  {
    path: "/bootstrap",
    title: "Bootstrap first admin",
    purpose: "One-time setup that grants the first signed-in user admin access.",
    area: "System",
    auth: "member",
    notes: "Setup utility. Should be removed or hard-gated once the first admin exists in an environment.",
  },
  {
    path: "/debug/email-test",
    title: "Email test harness",
    purpose: "Renders and sends transactional email templates against a test address.",
    area: "System",
    auth: "none",
    notes: "Development aid. Blocked in robots.txt; not otherwise gated.",
  },
  {
    path: "/debug",
    title: "Debug tools index",
    purpose: "Index of the development-only preview and test harnesses.",
    area: "System",
    auth: "none",
    notes: "Development aid. Blocked in robots.txt; not otherwise gated.",
  },
  {
    path: "/debug/email-preview",
    title: "Email template preview",
    purpose: "Renders every template in the email registry from fixture data, without sending.",
    area: "System",
    auth: "none",
    notes: "Development aid. Blocked in robots.txt; not otherwise gated.",
  },
  {
    path: "/debug/pdf-preview",
    title: "PDF document preview",
    purpose: "Renders any PDF the system can generate from fixture data — no real member or invoice needed.",
    area: "System",
    auth: "none",
    notes: "Development aid. Blocked in robots.txt; not otherwise gated.",
  },
  {
    path: "/debug/employer-membership-agreement",
    title: "Agreement preview",
    purpose: "Renders the employer membership agreement PDF for proofreading.",
    area: "System",
    auth: "none",
    notes: "Development aid. Blocked in robots.txt; not otherwise gated.",
  },
  {
    path: "/sitemap.xml",
    title: "Sitemap",
    purpose: "Generated from this registry by src/app/sitemap.ts.",
    area: "System",
    auth: "none",
  },
  {
    path: "/robots.txt",
    title: "Robots",
    purpose: "Generated from ROBOTS_DISALLOW by src/app/robots.ts.",
    area: "System",
    auth: "none",
  },
];

/**
 * HTTP endpoints. Grouped rather than enumerated one-per-row — the registry is
 * a map for people, and thirty webhook rows would bury the twelve that matter.
 */
export interface ApiGroup {
  prefix: string;
  title: string;
  purpose: string;
  auth: RouteAuth;
  endpoints: string[];
}

export const API_GROUPS: ApiGroup[] = [
  {
    prefix: "/api/stripe",
    title: "Stripe",
    purpose: "Checkout, subscription changes, refunds, and the billing portal.",
    auth: "member",
    endpoints: [
      "POST /api/stripe/checkout",
      "POST /api/stripe/change-plan",
      "POST /api/stripe/cancel",
      "POST /api/stripe/setup-payment",
      "POST /api/stripe/billing-portal",
      "GET  /api/stripe/member-invoices",
      "POST /api/stripe/sync",
      "POST /api/stripe/admin-cancel  (staff)",
      "POST /api/stripe/admin-refund  (staff)",
      "POST /api/stripe/webhook       (unauthenticated by design — Stripe-signed)",
    ],
  },
  {
    prefix: "/api/clerk",
    title: "Clerk identity",
    purpose: "User directory reads and identity webhook intake.",
    auth: "staff",
    endpoints: [
      "GET    /api/clerk/users",
      "GET    /api/clerk/users/:id",
      "DELETE /api/clerk/users/:id",
      "POST   /api/clerk/webhook  (unauthenticated by design — Svix-signed)",
    ],
  },
  {
    prefix: "/api/admin",
    title: "Admin operations",
    purpose: "Server-side admin utilities: PDF generation, invite lookup, vendor delivery.",
    auth: "staff",
    endpoints: [
      "GET  /api/admin/get-invite-by-email",
      "GET  /api/admin/post-signup-check",
      "GET  /api/admin/members/:memberId/id-card",
      "GET  /api/admin/list-bill-invoices/:invoiceId/group-pdf",
      "GET  /api/admin/list-bill-invoices/preview-sample",
      "POST /api/admin/vendor-deliver",
      "GET  /api/admin/vendor-statements/:statementId/document",
      "GET  /api/admin/vendor-statements/period/:period/document",
    ],
  },
  {
    prefix: "/api/crm",
    title: "CRM public endpoints",
    purpose: "Endpoints reachable by email recipients, who have no account.",
    auth: "none",
    endpoints: ["GET /api/crm/unsubscribe"],
  },
  {
    prefix: "/api/twilio",
    title: "Twilio voice",
    purpose: "Click-to-call from the CRM: token minting, call control, recordings.",
    auth: "staff",
    endpoints: [
      "GET  /api/twilio/token",
      "POST /api/twilio/voice      (Twilio-signed)",
      "POST /api/twilio/status     (Twilio-signed)",
      "POST /api/twilio/recording  (Twilio-signed)",
    ],
  },
  {
    prefix: "/api/documents",
    title: "Documents & PDFs",
    purpose: "Generates member cards, agreements, W-9s, and fulfillment paperwork.",
    auth: "member",
    endpoints: [
      "GET/POST /api/documents",
      "POST     /api/member-card-pdf",
      "POST     /api/generate-partner-agreement-pdf",
      "POST     /api/generate-w9-pdf",
      "POST     /api/generate-fulfillment-pdf",
    ],
  },
  {
    prefix: "/api/toothlens",
    title: "Toothlens",
    purpose: "Scan completion callback from the SmileScan provider.",
    auth: "webhook",
    endpoints: ["POST /api/toothlens/scan-completed"],
  },
  {
    prefix: "/api/resend",
    title: "Resend",
    purpose: "Email delivery, open, click, and bounce events.",
    auth: "webhook",
    endpoints: ["POST /api/resend/webhook"],
  },
  {
    prefix: "/api/shop",
    title: "Shop",
    purpose: "Affiliate outbound click tracking.",
    auth: "none",
    endpoints: ["POST /api/shop/click"],
  },
  {
    prefix: "/api/track",
    title: "Attribution",
    purpose: "Records rep-link visits for attribution reporting.",
    auth: "none",
    endpoints: ["POST /api/track/rep-visit"],
  },
  {
    prefix: "/api/test-email",
    title: "Email test",
    purpose: "Development-only send used by /debug/email-test.",
    auth: "none",
    endpoints: ["POST /api/test-email"],
  },
];

/**
 * robots.txt Disallow prefixes.
 *
 * robots.txt matching is a plain string prefix — nothing more — and the
 * trailing slash therefore carries real meaning:
 *
 *   "/admin"         blocks /admin AND /admin/anything
 *   "/health/plans/" blocks /health/plans/:slug but NOT /health/plans
 *
 * The previous list wrote every entry with a trailing slash, which meant
 * `Disallow: /health/dashboard/` blocked nothing at all: Next serves the
 * canonical URL without the trailing slash, so /health/dashboard never matched
 * the rule that was supposed to hide it. Slashes below are load-bearing —
 * present only where children are blocked but the parent is not.
 *
 * Every route requiring a session must fall under one of these prefixes;
 * `assertPrivateRoutesAreDisallowed` proves it, so adding a private page
 * without covering it here fails the test rather than quietly landing in
 * search results.
 */
export const ROBOTS_DISALLOW: string[] = [
  "/admin",
  "/partner",
  "/api",
  "/debug",
  "/bootstrap",
  "/unsubscribe",
  "/health/dashboard",
  "/health/manage-plans",
  "/health/checkout",
  "/health/sign-in",
  "/health/sign-up",
  "/health/forgot-password",
  "/health/sso-callback",
  "/health/claim-invite",
  "/health/admin-redirect",
  // Children only — /health/plans itself is a primary landing page.
  "/health/plans/",
];

/** Routes that are public *and* indexable — the sitemap's contents. */
export function indexableRoutes(): SiteRoute[] {
  return SITE_ROUTES.filter((route) => route.sitemap !== undefined);
}

/** Mirrors robots.txt semantics exactly: a Disallow entry is a string prefix. */
function isDisallowed(path: string): boolean {
  return ROBOTS_DISALLOW.some((prefix) => path.startsWith(prefix));
}

/**
 * Two invariants worth failing a build over, returned as messages rather than
 * thrown so the caller decides whether it's a test failure or a warning.
 */
export function assertPrivateRoutesAreDisallowed(): string[] {
  const problems: string[] = [];

  for (const route of SITE_ROUTES) {
    // A page requiring a session must never be crawlable.
    if (route.auth !== "none" && route.auth !== "webhook" && !isDisallowed(route.path)) {
      problems.push(`${route.path} requires auth "${route.auth}" but no robots.txt rule blocks it`);
    }
    // ...and nothing blocked may claim a place in the sitemap.
    if (route.sitemap && isDisallowed(route.path)) {
      problems.push(`${route.path} is in the sitemap but blocked by robots.txt`);
    }
  }

  return problems;
}
