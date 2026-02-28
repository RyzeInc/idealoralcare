Plan: 3-Agent Build-Out for Ideal Health Oral Care Platform
TL;DR — Three coding agents split the remaining work by domain: (1) Core platform, white-label system, and shared infrastructure; (2) All three enrollment/checkout flows with Stripe; (3) Operations — admin, vendor files, CSV eligibility, and member services. The codebase has significant scaffolding already but critical gaps: no Stripe SDK installed, a missing types file that breaks the enrollment wizard, pricing set 3x too high, and zero vendor/file-operations code. Both enrollment UIs are kept — the self-serve catalog flow for DTC individuals, the enrollment wizard for broker-assisted and group routes. A dynamic white-label system replaces all hardcoded Ryze/Nexus branding. Single product: Oral Health Plan @ $15/mo ($13 ACH).

Agent 1: Core Platform — Schema, White-Label, Shared Infrastructure
Purpose: Fix every blocker, establish the single-product catalog, build the dynamic white-label system, and lay the shared backend foundations that Agents 2 and 3 depend on.

Domain boundaries: schema.ts, catalog, hierarchy, subscriptions, lib, package.json, layout.tsx, health.css

Steps:

Fix compilation blockers — Create the missing @/lib/enrollment/types module that EnrollmentProvider.tsx imports (EnrollmentWizardState, EnrollmentAction, DEFAULT_ENROLLMENT_CONFIG, SiteContext, etc.). Add nanoid to package.json dependencies (imported in enrollment.ts but not installed). Install stripe and @stripe/stripe-js packages.

Consolidate to single product — Update products.ts seed data: one Oral Health Plan at $15/month ($13/month ACH). Remove or archive the Vision Care ($14.99), Telehealth ($19.99), and Wellness GLP ($99.99) products. Update pricing-calculator.ts to reflect $15/$13 pricing with ACH discount logic.

Build dynamic white-label branding system — The sites table in schema.ts already has branding fields (logo, colors, fonts). Create a SiteThemeProvider component that resolves the current site via site-resolver.ts (by slug or custom domain), extracts branding config, and injects CSS custom properties at runtime. Wire this into layout.tsx. Replace every hardcoded "Ryze Health" / "Nexus Health" reference across the codebase with dynamic site name from context.

Update site seed data — In the enrollment seed file seed.ts, update the ryze-health site to be ideal-health with placeholder Ideal Health branding (neutral navy/teal palette from the Crunch analysis notes). Add a default Ideal Health account and DTC group.

Add commission tracking to schema — Add commissionRates and commissionPayables tables to schema.ts with fields for broker ID, rate percentage, enrollment reference, status (pending/paid), and payout period. Add basic CRUD mutations. This was explicitly discussed in both meetings and is needed for the broker flow.

Wire up event logging — The events table exists in the schema but has no mutations. Create logEvent mutation in events.ts that other agents can call for audit trail (enrollment started, payment completed, entitlement activated, etc.).

Connect the dual context systems — Reconcile the three overlapping state systems: HealthPlansContext (HealthPlansContext.tsx), CartProvider (in src/lib/health-plans/cart-context.tsx), and EnrollmentProvider. Ensure the cart context syncs to Convex cartSessions (mutations already exist in cart_mutations.ts) rather than only using localStorage.

Update the landing page — Replace hardcoded product references on page.tsx with the single Oral Health Plan. Update hero, pricing section, and plan cards to reflect $15/$13 pricing.

Agent 2: Enrollment Flows & Stripe Checkout (All 3 Routes)
Purpose: Complete all three enrollment paths — DTC self-serve, broker-assisted, and group — wired to real Stripe payment processing, member profile creation, and entitlement activation.

Domain boundaries: plans, checkout, enroll, enrollment, enrollment, new src/app/api/stripe/ routes, sign-in, sign-up

Steps:

Create Stripe API routes — New src/app/api/stripe/checkout/route.ts that creates a Stripe Checkout Session (subscription mode, $15/mo or $13/mo ACH). New src/app/api/stripe/webhook/route.ts that handles checkout.session.completed, invoice.paid, and customer.subscription.deleted events. On success: call Convex mutations to activate entitlements, create member profile with auto-generated 9-digit member ID, and log events.

Complete DTC self-serve flow — This is the /health/plans → /health/checkout path for individuals paying directly. Update page.tsx to pull the single Oral Health Plan from Convex catalog (instead of mock products). In page.tsx, replace the // TODO: Implement Stripe checkout placeholder with a real redirect to Stripe Checkout. Preserve the existing ACH savings display and terms/disclosures UI. Post-payment: redirect to dashboard with confirmation.

Complete broker-assisted enrollment wizard — This is the /health/enroll path. The 5-step wizard UI already exists in enrollment (EligibilityStep, PlanSelectionStep, PersonalInfoStep, PaymentStep, ReviewStep). Fix compilation by using the types file Agent 1 creates. Wire each step to Convex enrollment sessions (sessions.ts). Add broker attribution: accept ?agent=CODE or ?broker=CODE query parameter on the enroll URL, store it on the enrollment session's assignedStaffId field (already in schema), and pass it through to commission creation on payment. Add a broker "claim" interstitial at the start (modeled after Crunch's in-store staff claim flow — salesperson enters their code before the member proceeds).

Add group enrollment entry point — New route at /health/enroll/group (or query param ?group=CODE). On load, call resolveHierarchyByGroupCode from site-resolver.ts to validate the group code, resolve the account/site hierarchy, apply custom pricing, and check capacity. If valid, funnel the member into the enrollment wizard with the group context pre-filled (steps are the same, but pricing and plan options are filtered by group's allowedPlanIds). On successful payment, associate the member with the group in memberProfiles.

Entitlement activation — On successful Stripe webhook, create an entitlements record in Convex (entitlements.ts) with status active, the member's plan, start/end dates, and Stripe subscription ID. The dashboard should read from this to gate feature access.

Member ID generation — On enrollment completion, use nanoid (or deterministic format) to generate a 9-digit member ID as discussed in the Feb 9 meeting. Store on memberProfiles.memberId.

Post-enrollment redirect — After successful payment, redirect to /health/dashboard with a success banner. Ensure Clerk auth is required (already enforced in dashboard/layout.tsx).

Agent 3: Operations — Admin, Vendor Files, CSV, Member Services
Purpose: Build the operational backend: group/account admin management, CSV eligibility file processing, vendor file generation and delivery, member ID cards, email notifications, and commission reporting.

Domain boundaries: dashboard, admin, new admin pages, enrollment (eligibility files), new src/app/api/ routes for file operations

Steps:

Group/account admin UI — Create admin pages (under a protected /health/dashboard/admin/ or similar route) for: creating and managing sites, accounts, and groups from schema.ts; setting custom pricing per account/group; managing allowedPlanIds; viewing group member rosters and enrollment status; setting group capacity limits. Use the existing admin patterns in admin (Clerk org role checking with org:admin).

CSV eligibility file upload and processing — The eligibilityFiles table is already defined in schema.ts with status, totalRecords, processedRecords, errorRecords, etc. Build: a file upload UI in the admin dashboard; a Convex mutation that parses the CSV, validates member records, and batch-creates memberProfiles entries associated with the correct group; error reporting for malformed rows; status tracking (pending → processing → completed/failed).

Vendor eligibility file generation — Create Convex actions that query active members and generate vendor-specific CSV files: Careington format (for POS dental discounts), Dial Care format (for teledentistry eligibility). The Feb 9 meeting noted specific formatting requirements and date format considerations (YYYY-MM-DD). Output downloadable CSVs from an admin action or scheduled job.

S/FTP file delivery — Implement secure file transfer for vendor eligibility files. The Feb 9 meeting discussed monthly S/FTP transmissions. Use a Node.js SSH2/SFTP library. Create a Convex scheduled action that runs monthly, generates the vendor files, and delivers them. Store delivery status and history. Note: the Feb 9 meeting acknowledged this may need specialized expertise — implement with clear error handling and manual fallback (admin can download and upload manually).

List-bill invoice scaffolding — Per Feb 9 meeting, group billing "stays on E123 for now." Build the bridge: a Convex query that calculates per-group member counts and total amounts due; an exportable invoice summary (CSV or simple PDF) that can be imported into E123; a scheduled monthly job to generate these. Don't build a full billing system — just the data feed E123 needs.

Member ID card generation — Create a simple member card view/PDF with: member name, 9-digit member ID, plan name, effective date, Careington network info, Dial Care access info, Toothlens smart check link. Make it downloadable from the dashboard and emailable.

Email notification system — Implement transactional emails (using Convex actions + a service like Resend or SendGrid) for: welcome/enrollment confirmation, payment receipt, member ID card delivery, monthly eligibility reminders for group admins. Keep templates simple — the meetings didn't promise anything fancy.

Commission reporting — Build on the commission tables Agent 1 creates. Add: a query that calculates commissions per broker per period based on their rate and active enrollments; a simple admin report view; exportable CSV for payroll integration. The Feb 27 meeting discussed American Fidelity requiring agency-level overrides — support tiered commission structures (agent rate + agency override).

Dashboard enhancements — Update page.tsx to pull real data: active entitlements from Convex, member profile info, plan details. The Oral Scan and Teledentistry tabs should link out to Toothlens Smart Check and Dial Care portals respectively (these are external services — don't build custom integrations, just provide authenticated deep links). The Feb 27 meeting confirmed "the Truvo app is the delivery vehicle" — if a web dashboard link-out suffices for now, do that.

Verification
Agent 1 done when: npm run build succeeds with no type errors; the site renders with dynamic branding from Convex; only the single $15/$13 Oral Health Plan appears in the catalog; no Ryze/Nexus references remain.
Agent 2 done when: A test user can complete enrollment through all 3 routes (DTC, broker URL, group code) and reach a real Stripe Checkout page; webhook processes payment and creates active entitlement + member profile with 9-digit ID; user lands on authenticated dashboard post-payment.
Agent 3 done when: Admin can create a group, upload a CSV of members, and see them enrolled; vendor eligibility CSVs can be generated and downloaded; a member can view/download their ID card from the dashboard; commission report shows correct calculations for test enrollments.
Decisions
Keep both enrollment UIs: Self-serve catalog flow (/health/plans → /health/checkout) for DTC; enrollment wizard (/health/enroll) for broker-assisted and group. Reduces throwaway work and serves different user journeys.
Single product only: $15/month, $13/month with ACH. All other plans removed. Don't add plan tiers or add-ons unless Ideal requests them.
White-label is dynamic, not static: Branding reads from Convex sites table at runtime. This future-proofs for other distributors without rebuilding.
Vendor file delivery has a manual fallback: S/FTP is built but admin can also manually download CSVs. The Feb 9 meeting acknowledged this is a specialized area.
Toothlens and Dial Care are link-outs, not embedded: Dashboard provides authenticated links to external services. No custom API integrations — those "await Carrington's integration" per Feb 27 meeting.
List-bill stays on E123: We only build the data bridge (member counts + amounts as exportable summaries). No invoice payment collection.
No over-delivery on: marketing automation, referral programs, multi-language, advanced analytics, gamification, complex discount engines, custom Toothlens/DialCare integrations — none of these were discussed in meetings.