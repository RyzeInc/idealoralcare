# Parallel Agent Gameplan — Delivery Readiness

**Date:** March 2, 2026  
**Goal:** Make the platform client-ready for Ideal Health (non-technical)  
**Strategy:** 4 agents working in parallel with zero file conflicts  
**Estimated Time:** 4–6 hours total (agents run simultaneously)

---

## Architecture: Why 4 Agents

Each agent owns a **distinct slice of the codebase** so they can run simultaneously without merge conflicts.

| Agent | Domain | Files Touched | Est. Time |
|-------|--------|---------------|-----------|
| **Agent 1** | Security & Environment | `.env*`, `.gitignore`, `next.config.ts`, `README.md` | 1–2 hrs |
| **Agent 2** | Frontend UI Cleanup | `src/app/admin/**`, `src/components/health/DashboardTabs.tsx` | 2–3 hrs |
| **Agent 3** | Backend & Code Quality | `convex/**`, `src/lib/**`, `src/app/api/**`, `src/components/admin/**`, `src/components/forms/**`, `src/components/enrollment/ConfirmationPage.tsx`, `src/components/providers/SiteThemeProvider.tsx` | 2–3 hrs |
| **Agent 4** | Documentation & Deployment | New files only: `DEPLOYMENT_SETUP.md`, `ADMIN_QUICK_START.md`, cleanup old `AGENT*` / `SECURITY*` / `DELIVERY*` markdown files | 1–2 hrs |

### Dependency Rules
- **No agent edits another agent's files.** File ownership is strict.
- **Agent 4 starts immediately** — it only creates new files and reads (never edits) existing code.
- **No sequential dependencies.** All 4 agents launch at the same time.
- **After all 4 finish:** One final `npm run build` validation pass.

---

## Agent 1: Security & Environment Hardening

**Owner:** `.env*`, `.gitignore`, `next.config.ts`, `README.md`  
**Goal:** Remove exposed secrets, harden production config, ensure environment is properly documented.

### Tasks

#### 1.1 Remove `.env.local` from Git History
```bash
# .gitignore already has .env*.local — but verify .env.local isn't tracked
git rm --cached .env.local 2>/dev/null  # Safe even if not tracked
git commit -m "chore: ensure .env.local is not tracked"
```
> **Context:** `.env.local` contains LIVE Stripe keys (`sk_live_...`), Clerk keys, and Convex deployment info. The `.gitignore` already has `.env*.local` — verify it's actually excluded from the repo.

#### 1.2 Rewrite `.env.example` as a Clean Template
Replace the current `.env.example` (which is a markdown doc with instructions) with a proper dotenv template:

**Create `/Users/desel/Documents/idealoralcare/.env.example`:**
```dotenv
# ─── Convex Backend ────────────────────────────────────────
CONVEX_DEPLOYMENT=dev:your-deployment-name
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud

# ─── Clerk Authentication ──────────────────────────────────
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_XXXXXXXXXXXX
CLERK_SECRET_KEY=sk_live_XXXXXXXXXXXX

# ─── Stripe Payments ──────────────────────────────────────
STRIPE_SECRET_KEY=sk_live_XXXXXXXXXXXX
STRIPE_PUBLISHABLE_KEY=pk_live_XXXXXXXXXXXX
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_XXXXXXXXXXXX
STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXXXXXX

# ─── Application ──────────────────────────────────────────
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_APP_DOMAIN=getidealoh.com
NEXT_PUBLIC_APP_URL=https://getidealoh.com
```

#### 1.3 Verify & Harden `next.config.ts`
The file is already well-configured. Verify:
- [x] `*.app.github.dev` only in development ✅ (already conditional)
- [x] Security headers present (HSTS, CSP, X-Frame-Options) ✅
- [ ] **Add production domain to `allowedOrigins`:**

**Edit `next.config.ts`** — add the production domain to `allowedOrigins`:
```typescript
allowedOrigins: [
  "localhost:3000",
  "localhost:3001",
  "getidealoh.com",        // ← ADD
  "www.getidealoh.com",    // ← ADD
  ...(process.env.NODE_ENV === "development" ? ["*.app.github.dev"] : []),
],
```

#### 1.4 Update `README.md`
Replace the single-line README with a professional overview:
```markdown
# Ideal Health Oral Care Platform

Health plan enrollment, member management, and administration platform.

## Quick Start

1. Copy `.env.example` to `.env.local` and fill in your API keys
2. `npm install`
3. `npx convex deploy`
4. `npm run dev`

See [DEPLOYMENT_SETUP.md](DEPLOYMENT_SETUP.md) for full setup guide.
See [ADMIN_QUICK_START.md](ADMIN_QUICK_START.md) for admin configuration.
```

### Files Owned by Agent 1
```
.env.example          (rewrite)
.gitignore            (verify only — already correct)
next.config.ts        (add production domains)
README.md             (rewrite)
```

### Acceptance Criteria
- [ ] `.env.local` not in git index
- [ ] `.env.example` is a clean dotenv template with no real keys
- [ ] `next.config.ts` has production domain in allowedOrigins
- [ ] `README.md` is professional and links to setup docs
- [ ] `npm run build` still passes

---

## Agent 2: Frontend UI Cleanup

**Owner:** All files under `src/app/admin/`, `src/components/health/DashboardTabs.tsx`, `src/app/health/dashboard/layout.tsx`, `src/app/health/dashboard/page.tsx`  
**Goal:** Remove developer-facing pages, hide incomplete features, replace placeholders with polished empty states.

### Tasks

#### 2.1 Delete Catalog Seed Page
```bash
rm -rf /Users/desel/Documents/idealoralcare/src/app/admin/catalog-seed/
```
This is a developer-only page that lets admins nuke the product catalog. Must go.

#### 2.2 Clean Up Admin Layout Navigation
**File:** `src/app/admin/layout.tsx`

Remove these items from `ADMIN_NAVIGATION`:
- `{ label: "Catalog Seed", href: "/admin/catalog-seed", icon: Package }` — **DELETE** (page removed)
- `{ label: "Vendor Files", href: "/admin/vendor-files", icon: BarChart3 }` — **DELETE** (SFTP not implemented)
- `{ label: "Commissions", href: "/admin/commissions", icon: BarChart3 }` — **DELETE** (tables not created)

Also remove the `Package` import from lucide-react since it's no longer used.

**Result navigation should be:**
```typescript
const ADMIN_NAVIGATION = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Sites & Accounts", href: "/admin/hierarchy", icon: Building2 },
  { label: "Members", href: "/admin/members", icon: Users },
  { label: "Brokers", href: "/admin/brokers", icon: Briefcase },
  { label: "Eligibility Files", href: "/admin/eligibility", icon: FileText },
  { label: "Billing", href: "/admin/billing", icon: DollarSign },
  { label: "Admin Users", href: "/admin/users", icon: ShieldCheck },
];
```

#### 2.3 Fix Hierarchy Page Placeholders
**File:** `src/app/admin/hierarchy/page.tsx`

**Change 1:** Replace the create modal placeholder (line ~66):
```tsx
// BEFORE:
<p className="text-slate-600 mb-6">Form placeholder - implement field inputs</p>

// AFTER:
<p className="text-slate-500 mb-6 text-sm">
  To create or modify sites, accounts, or groups, please contact your platform administrator.
</p>
```

**Change 2:** Replace AccountsList placeholder (line ~129):
```tsx
// BEFORE:
<p>Accounts list placeholder</p>
<p className="text-sm">Select a site to view/manage accounts</p>

// AFTER:
<p className="font-medium text-slate-600">No accounts configured yet</p>
<p className="text-sm mt-1">Accounts will appear here once created during enrollment setup.</p>
```

**Change 3:** Replace GroupsList placeholder (line ~138):
```tsx
// BEFORE:
<p>Groups list placeholder</p>
<p className="text-sm">Select an account to view/manage groups</p>

// AFTER:
<p className="font-medium text-slate-600">No groups configured yet</p>
<p className="text-sm mt-1">Groups will appear here once created during enrollment setup.</p>
```

#### 2.4 Add "Coming Soon" Banners to Incomplete Pages
**File:** `src/app/admin/commissions/page.tsx` — Replace the dependency warning:
```tsx
// Replace the amber AlertCircle box that references "Agent 1" with:
<div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
  <AlertCircle className="text-blue-600 flex-shrink-0" size={20} />
  <div>
    <p className="text-sm font-semibold text-blue-900">Commission Tracking — Coming Soon</p>
    <p className="text-sm text-blue-800 mt-1">
      Broker commission tracking and payroll exports will be available in a future update.
      For commission inquiries, contact your account representative.
    </p>
  </div>
</div>
```

**File:** `src/app/admin/vendor-files/page.tsx` — Add to top of content:
```tsx
// Replace the hardcoded group selector dropdown with:
<div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3 mb-6">
  <AlertCircle className="text-blue-600 flex-shrink-0" size={20} />
  <div>
    <p className="text-sm font-semibold text-blue-900">Vendor File Delivery — Coming Soon</p>
    <p className="text-sm text-blue-800 mt-1">
      Automated vendor file generation and SFTP delivery will be available in a future update.
    </p>
  </div>
</div>
```

#### 2.5 Fix DashboardTabs — Hide Incomplete Scan Features  
**File:** `src/components/health/DashboardTabs.tsx`

Remove the `'oral-scan'` and `'teledentistry'` tabs from the TABS array. Keep only:
```typescript
const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <HeartPulse size={16} /> },
  { id: 'provider-search', label: 'Provider Search', icon: <Search size={16} /> },
];
```

Update the `TabId` type to remove unused values:
```typescript
type TabId = 'overview' | 'provider-search';
```

Remove the unused imports: `Scan`, `Video`

Remove or hide the tab content blocks for `oral-scan` and `teledentistry` (the `{activeTab === 'oral-scan' && ...}` and `{activeTab === 'teledentistry' && ...}` blocks).

Also remove the unused state and callbacks related to scanning:
- `scannerActive`, `sessionId`, `convexScanId`, `forwardingIds`, `showMobileOverlay`, `isMounted`
- `openScan`, `closeScan`, `handleForwardToTeledentist`, `getToothlensUid`
- `recordScanStarted`, `markScanClosed`, `requestForward`, `scanHistory`

> **Important:** The component is ~2000 lines. Keep `overview` and `provider-search` intact. Remove everything related to scanning.

#### 2.6 Clean Up Admin Dashboard Quick Actions
**File:** `src/app/admin/page.tsx`

Remove or update Quick Actions that link to hidden pages:
- Change "Generate Vendor Files" action to say "Coming Soon" or remove it
- Keep: "Create New Group", "Upload Eligibility File"

#### 2.7 Fix Dashboard Layout Console Statement
**File:** `src/app/health/dashboard/layout.tsx` (line 66)
```typescript
// BEFORE:
console.error("[dashboard-layout] Subscription check error:", error);

// AFTER: (remove the console.error)
// Error handling still works — the catch block redirects to plans page
```

**File:** `src/app/health/dashboard/page.tsx` (line 51)
```typescript
// BEFORE:
console.error("[dashboard] Error fetching subscription data:", error);

// AFTER: (remove — the catch block handles gracefully)
```

### Files Owned by Agent 2
```
src/app/admin/catalog-seed/        (DELETE directory)
src/app/admin/layout.tsx           (edit nav + remove console.error)
src/app/admin/hierarchy/page.tsx   (fix placeholders)
src/app/admin/commissions/page.tsx (add Coming Soon)
src/app/admin/vendor-files/page.tsx (add Coming Soon)
src/app/admin/page.tsx             (fix Quick Actions)
src/app/admin/eligibility/page.tsx (no change needed — upload UI is functional enough)
src/components/health/DashboardTabs.tsx (remove scan tabs + TODO stubs)
src/app/health/dashboard/layout.tsx (remove console.error)
src/app/health/dashboard/page.tsx  (remove console.error)
```

### Acceptance Criteria
- [ ] `/admin/catalog-seed` returns 404
- [ ] Admin sidebar has no "Catalog Seed", "Vendor Files", or "Commissions" links
- [ ] Hierarchy page shows polished empty states, not "placeholder" text
- [ ] Commission & Vendor pages show "Coming Soon" banner
- [ ] Dashboard tabs only show Overview + Provider Search
- [ ] No `console.error` in dashboard layout/page
- [ ] No reference to "Agent 1", "Agent 2", "Agent 3" in any UI text
- [ ] `npm run build` passes

---

## Agent 3: Backend & Code Quality Cleanup

**Owner:** `convex/**` (except `convex/_generated/`), `src/lib/**`, `src/app/api/**`, `src/components/admin/BrokersAdmin.tsx`, `src/components/admin/EnrollmentLauncher.tsx`, `src/components/forms/**`, `src/components/enrollment/ConfirmationPage.tsx`, `src/components/providers/SiteThemeProvider.tsx`  
**Goal:** Fix mock data returns, clean console statements, update hardcoded strings, ensure backend behaves correctly in production.

### Tasks

#### 3.1 Fix Mock Hierarchy Queries — `convex/hierarchy.ts`
This file returns **hardcoded fake data** instead of querying the database. The `resolveSiteBySlug` query at the top is the critical one used by enrollment and site theming. We need to make it query real data with a graceful fallback.

**Rewrite the entire file.** Key changes:

**`resolveSiteBySlug`** — Query real database first, keep the DTC fallback but only if no DB result:
```typescript
export const resolveSiteBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const normalizedSlug = slug || "ideal-health";
    
    // Try database first
    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q: any) => q.eq("slug", normalizedSlug))
      .first();
    
    if (site) return site;

    // Legacy slug support
    if (normalizedSlug === "ryze-health") {
      const legacySite = await ctx.db
        .query("sites")
        .withIndex("by_slug", (q: any) => q.eq("slug", "ideal-health"))
        .first();
      if (legacySite) return legacySite;
    }

    // Return a sensible default for DTC (the enrollment/sessions.ts auto-creates the real site)
    return {
      _id: "pending" as any,
      name: "Ideal Health",
      slug: normalizedSlug,
      type: "primary" as const,
      status: "active" as const,
      enrollmentDefaults: {
        requireGroupCode: false,
        requireEligibilityMatch: false,
        allowSelfEnrollment: true,
        collectPhone: true,
        collectAddress: true,
        collectEmployeeId: false,
        collectDependents: false,
        requirePayment: true,
        autoActivate: true,
      },
      allowedPlanIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  },
});
```

**`resolveAccountBySite`** — Query database:
```typescript
handler: async (ctx, { siteId }) => {
  const account = await ctx.db
    .query("accounts")
    .filter((q) => q.eq(q.field("siteId"), siteId))
    .first();
  return account || null;
},
```

**`resolveGroupBySiteAndAccount`** — Query database:
```typescript
handler: async (ctx, { siteId, accountId }) => {
  const group = await ctx.db
    .query("groups")
    .filter((q) => q.eq(q.field("accountId"), accountId))
    .first();
  return group || null;
},
```

**`getSite`, `getAccount`, `getGroup`** — Query database, return null if not found (no more hardcoded responses):
```typescript
// getSite
handler: async (ctx, { siteId }) => {
  if (!siteId) return null;
  try {
    return await ctx.db.get(siteId as any);
  } catch {
    return null;
  }
},
```

#### 3.2 Update Hardcoded Strings in `src/components/enrollment/ConfirmationPage.tsx`
```typescript
// BEFORE (lines 25-27):
const supportEmail = site?.enrollmentDefaults?.supportEmail || 'support@idealhealth.com';
const supportPhone = site?.enrollmentDefaults?.supportPhone || '1-844-IDEAL-01';
const welcomeMessage = site?.enrollmentDefaults?.welcomeMessage || 'Welcome to Ideal Health';

// AFTER:
const supportEmail = site?.enrollmentDefaults?.supportEmail || 'support@getidealoh.com';
const supportPhone = site?.enrollmentDefaults?.supportPhone || '';
const welcomeMessage = site?.enrollmentDefaults?.welcomeMessage || 'Welcome to Ideal Health';
```

#### 3.3 Update Auto-Bootstrap Defaults in `convex/enrollment/sessions.ts`
Lines ~127-152 — update the DTC site auto-creation defaults:
```typescript
// Change in the auto-created site:
name: "Ideal Health",              // ← keep
primaryColor: "#1e3a5f",           // ← change from "#0066CC"
supportEmail: "support@getidealoh.com",  // ← change from "support@idealhealth.com"
```

#### 3.4 Clean Console Statements in `src/lib/event-emitter.ts`
```typescript
// Line 26: REMOVE
console.warn("[EventEmitter] Mutation function not available, logging event only", event);

// Line 32-35: REMOVE
console.log(`[EventEmitter] Event emitted: ${event.eventType}`, { ... });

// Line 39: KEEP but wrap
// console.error is acceptable for actual errors — but don't leak event data
```

**New version of the emit method:**
```typescript
async emit(event: Omit<SystemEvent, "_id" | "createdAt">): Promise<SystemEvent> {
  try {
    if (!this.mutationFn) {
      return event as SystemEvent;
    }
    const result = await this.mutationFn("subscriptions.events.create", event);
    return result;
  } catch (error) {
    throw error;
  }
}
```

#### 3.5 Clean Console Statements in API Routes
**File:** `src/app/api/stripe/webhook/route.ts` — This has ~25 console statements. For webhooks, server-side logging is actually useful. Strategy:
- **KEEP** `console.error` for actual errors (these only show in server logs, not browser)
- **REMOVE** `console.log` for success paths (lines 188, 240, 262, 297, 356, 403)
- **REMOVE** `console.warn` for non-critical warnings (lines 60, 156, 170, 279, 303, 362)

**File:** `src/app/api/stripe/checkout/route.ts`:
- Line 97: REMOVE `console.warn` (fallback works fine)
- Line 154: KEEP `console.error` (actual error)

**File:** `src/app/api/stripe/setup-payment/route.ts`:
- Line 133: KEEP `console.error` (actual error)

**File:** `src/app/api/clerk/users/route.ts`:
- Lines 46, 86: KEEP `console.error` (server-side API route errors are fine)

#### 3.6 Clean Console Statements in Components
**File:** `src/components/admin/BrokersAdmin.tsx`:
- Line 129: REMOVE `console.error('Error saving broker:', error);`
- Line 146: REMOVE `console.error('Error deleting broker:', error);`

**File:** `src/components/admin/EnrollmentLauncher.tsx`:
- Line 107: REMOVE `console.error('Error creating lead:', err);`

**File:** `src/components/forms/ContactForm.tsx`:
- Line 88: REMOVE `console.error("Failed to submit contact form:", error);`

**File:** `src/components/forms/SmartInquiryForm.tsx`:
- Line 256: REMOVE `console.error("Failed to submit inquiry:", error);`

**File:** `src/components/providers/SiteThemeProvider.tsx`:
- Line 16: This is inside a JSDoc comment — leave it (it's documentation, not executable)

#### 3.7 Clean Console Statements in Convex Backend
**File:** `convex/enrollment/seed.ts` — Lines 22, 61, 83, 99, 134, 261:
- REMOVE all `console.log` — these are seed functions, logging pollutes production
- KEEP `console.warn` on line 22 (missing products warning is useful)

**File:** `convex/admin/eligibility.ts` — Line 211:
- REMOVE `console.log("Processing eligibility file:", ...)`

**File:** `convex/admin/notifications.ts` — Lines 25, 52:
- Line 25: KEEP `console.warn("RESEND_API_KEY not configured...")` — useful operational warning
- Line 52: REMOVE `console.log(\`[Email] Would send to...\`)` — verbose mock output

**File:** `convex/admin/sftpDelivery.ts` — Line 68:
- REMOVE `console.log(...)` — placeholder code

**File:** `convex/admin/members.ts` — Line 467:
- KEEP `console.warn(...)` — useful for debugging assignment failures

**File:** `convex/subscriptions/webhookActions.ts` — Line 55:
- REMOVE `console.log(...)` — success path

### Files Owned by Agent 3
```
convex/hierarchy.ts                          (rewrite mock queries)
convex/enrollment/sessions.ts                (update hardcoded defaults)
convex/enrollment/seed.ts                    (clean console.logs)
convex/admin/eligibility.ts                  (clean console.log)
convex/admin/notifications.ts                (clean console.log)
convex/admin/sftpDelivery.ts                 (clean console.log)
convex/admin/members.ts                      (no change — keep warning)
convex/subscriptions/webhookActions.ts        (clean console.log)
src/lib/event-emitter.ts                     (remove verbose logging)
src/app/api/stripe/webhook/route.ts          (remove success/info logs)
src/app/api/stripe/checkout/route.ts         (remove warn)
src/app/api/clerk/users/route.ts             (no change — keep errors)
src/app/api/stripe/setup-payment/route.ts    (no change — keep error)
src/components/admin/BrokersAdmin.tsx         (remove console.errors)
src/components/admin/EnrollmentLauncher.tsx   (remove console.error)
src/components/forms/ContactForm.tsx          (remove console.error)
src/components/forms/SmartInquiryForm.tsx     (remove console.error)
src/components/enrollment/ConfirmationPage.tsx (update support strings)
src/components/providers/SiteThemeProvider.tsx (no change — comment only)
```

### Acceptance Criteria
- [ ] `convex/hierarchy.ts` queries real database — no hardcoded fake data
- [ ] No `console.log` in production code paths
- [ ] `console.error` only in actual error handlers (server-side only)
- [ ] No "support@idealhealth.com" or "1-844-IDEAL-01" in code
- [ ] Convex deployment still works (`npx convex deploy`)
- [ ] `npm run build` passes

---

## Agent 4: Documentation & Deployment Guides

**Owner:** New files only — does NOT edit any existing source code.  
**Goal:** Create all documentation Ideal Health needs, clean up developer-facing markdown files.

### Tasks

#### 4.1 Create `DEPLOYMENT_SETUP.md`
Professional deployment guide covering:

```markdown
# Deployment Setup Guide

## What This Platform Is
A health plan enrollment and member management platform built with:
- **Next.js** — Web framework (hosted on Vercel)
- **Convex** — Real-time database & backend
- **Clerk** — User authentication
- **Stripe** — Payment processing

## Required Accounts
1. **Vercel** (vercel.com) — Hosting
2. **Convex** (convex.dev) — Database
3. **Clerk** (clerk.com) — Authentication
4. **Stripe** (stripe.com) — Payments

## Step-by-Step Setup

### 1. Environment Variables
Copy `.env.example` to `.env.local` and fill in:
| Variable | Where to Get It |
|----------|----------------|
| `CONVEX_DEPLOYMENT` | Convex dashboard after `npx convex deploy` |
| `NEXT_PUBLIC_CONVEX_URL` | Convex dashboard → Settings → URL |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk dashboard → API Keys |
| `CLERK_SECRET_KEY` | Clerk dashboard → API Keys |
| `STRIPE_SECRET_KEY` | Stripe dashboard → Developers → API Keys |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe dashboard → Developers → API Keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe dashboard → Webhooks → Signing secret |
| `NEXT_PUBLIC_APP_DOMAIN` | Your domain (e.g., `getidealoh.com`) |
| `NEXT_PUBLIC_APP_URL` | Full URL (e.g., `https://getidealoh.com`) |

### 2. Convex Setup
- Create project at convex.dev
- Run `npx convex deploy` from project root
- This creates tables and deploys backend functions

### 3. Clerk Setup
- Create application at clerk.com
- Enable Email + Google sign-in methods
- Set redirect URLs to your domain
- Copy API keys to .env.local

### 4. Stripe Setup
- Enable live mode at stripe.com
- Copy API keys to .env.local
- Create webhook endpoint: `https://yourdomain.com/api/stripe/webhook`
- Subscribe to events:
  - `checkout.session.completed`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
  - `customer.subscription.deleted`

### 5. Deploy to Vercel
- Push code to GitHub
- Connect repo in Vercel dashboard
- Add all environment variables from `.env.local`
- Deploy

### 6. Post-Deployment
- [ ] Verify landing page loads at your domain
- [ ] Test enrollment flow end-to-end
- [ ] Create first admin user at `/admin/users`
- [ ] Seed product catalog (one-time setup)

## Platform URLs
| Page | URL | Description |
|------|-----|-------------|
| Landing Page | `/health` | Public marketing page |
| Plans | `/health/plans` | Plan comparison & checkout |
| Enrollment | `/health/enroll` | Member enrollment flow |
| Member Dashboard | `/health/dashboard` | Authenticated member area |
| Admin Panel | `/admin` | Admin management (requires admin role) |
| Sign In | `/health/sign-in` | Member authentication |
```

#### 4.2 Create `ADMIN_QUICK_START.md`
```markdown
# Admin Quick Start Guide

## First-Time Setup

### 1. Create Your Admin Account
1. Go to `/health/sign-in` and create an account (or sign in with Google)
2. Navigate to `/admin/users`
3. Click "Initialize First Admin" and enter your Clerk User ID
   - Find your Clerk User ID in the Clerk dashboard → Users
4. You now have super-admin access

### 2. Verify the Product Catalog
- Go to `/admin` → check that "Active Members" and "Billing" cards show data
- The oral health plan should already be seeded in the catalog

### 3. Configure Your Site
- Go to `/admin/hierarchy` → Sites tab
- Your default "Ideal Health" site should appear
- Edit to update name, domain, and branding

## Daily Operations

### Managing Members
- `/admin/members` — View all enrolled members
- Search by name, email, or member ID
- Click a member to see details, subscription status, and plan

### Managing Brokers
- `/admin/brokers` — Add/remove broker representatives
- Set commission rates per broker
- Assign brokers to enrollment groups

### Billing Overview
- `/admin/billing` — View group billing summaries
- Monthly totals by group code

### Eligibility Files
- `/admin/eligibility` — Upload CSV files for bulk member enrollment
- Status tracking for each uploaded file

## Features Coming Soon
- **Commission Tracking** — Broker payout reports and exports
- **Vendor File Delivery** — Automated SFTP delivery to dental networks
- **AI Oral Scanning** — Toothlens integration for member dashboard
- **Email Notifications** — Automated welcome emails and ID cards

## Getting Help
- Email: support@getidealoh.com
- For technical issues, contact your platform administrator
```

#### 4.3 Clean Up Developer Markdown Files
**DELETE** (or move to a `/docs/internal/` folder) these developer-facing files that should not be visible to Ideal Health:
```
AGENT2_COMPLETION_STATUS.md
AGENT2_COMPLETION_SUMMARY.md
AGENT2_IMPLEMENTATION.md
AGENT3_COMPLETION_STATUS.md
AGENT3_FINALIZATION.md
SECURITY_AGENT1_PLAN.md
SECURITY_AGENT2_PLAN.md
SECURITY_AGENT3_PLAN.md
SECURITY_SWEEP_OVERVIEW.md
FRONTEND_BUILD_SUMMARY.md
DELIVERY_READINESS_AUDIT.md
DELIVERY_ACTION_PLAN.md
DELIVERY_EXECUTIVE_SUMMARY.md
DELIVERY_CHECKLIST.md
CLIENT_DOCUMENTATION.md
clerkelements.md
```

**Recommended:** Move to `docs/internal/` so they're preserved but not cluttering the root:
```bash
mkdir -p docs/internal
mv AGENT*.md SECURITY*.md FRONTEND*.md DELIVERY*.md CLIENT*.md clerkelements.md docs/internal/
```

#### 4.4 Clean Up Notes Directory
The `Notes/` directory contains meeting notes and internal planning docs. Either:
- Move to `docs/internal/notes/`
- Or add to `.gitignore` if it shouldn't be in the repo

### Files Owned by Agent 4
```
DEPLOYMENT_SETUP.md       (CREATE)
ADMIN_QUICK_START.md      (CREATE)
docs/internal/            (CREATE directory, MOVE old markdown files)
```
> Agent 4 does NOT edit any `.ts`, `.tsx`, `.css`, or config files.

### Acceptance Criteria
- [ ] `DEPLOYMENT_SETUP.md` exists with complete setup instructions
- [ ] `ADMIN_QUICK_START.md` exists with admin guide
- [ ] Root directory is clean — no `AGENT*`, `SECURITY*`, `DELIVERY*` markdown files
- [ ] Old docs preserved in `docs/internal/`
- [ ] No technical jargon in user-facing docs (no "Convex mutation", "webhook", etc.)

---

## Post-Agent Validation

After all 4 agents complete, run this final check:

```bash
# 1. Build passes
npm run build

# 2. No .env.local in git
git status | grep ".env.local"  # Should show nothing

# 3. No "placeholder" text in UI code
grep -r "placeholder" src/app/admin/ --include="*.tsx" | grep -v "placeholder=" | grep -v ".module.css"
# Should only find input placeholder attributes, not UI text

# 4. No "Agent 1/2/3" references in code
grep -ri "agent [0-9]" src/ --include="*.tsx" --include="*.ts"
# Should return 0 results

# 5. Console.log count should be minimal
grep -rn "console\.log" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".next" | wc -l
# Target: 0 (or <5 if keeping strategic server-side logs)

# 6. No developer markdown in root
ls *.md
# Should only show: README.md, DEPLOYMENT_SETUP.md, ADMIN_QUICK_START.md
```

---

## File Ownership Matrix

This table ensures **zero file conflicts** between agents:

| File/Directory | Agent 1 | Agent 2 | Agent 3 | Agent 4 |
|---|:---:|:---:|:---:|:---:|
| `.env*`, `.gitignore` | ✅ | | | |
| `next.config.ts` | ✅ | | | |
| `README.md` | ✅ | | | |
| `src/app/admin/**` | | ✅ | | |
| `src/components/health/DashboardTabs.tsx` | | ✅ | | |
| `src/app/health/dashboard/**` | | ✅ | | |
| `convex/**` (non-generated) | | | ✅ | |
| `src/lib/**` | | | ✅ | |
| `src/app/api/**` | | | ✅ | |
| `src/components/admin/**` | | | ✅ | |
| `src/components/forms/**` | | | ✅ | |
| `src/components/enrollment/ConfirmationPage.tsx` | | | ✅ | |
| `src/components/providers/SiteThemeProvider.tsx` | | | ✅ | |
| `DEPLOYMENT_SETUP.md` (new) | | | | ✅ |
| `ADMIN_QUICK_START.md` (new) | | | | ✅ |
| `docs/internal/` (new) | | | | ✅ |
| `AGENT*.md`, `SECURITY*.md`, etc. | | | | ✅ |

---

## Summary

| Agent | Scope | Key Deliverable | Est. Time |
|-------|-------|-----------------|-----------|
| 1 | Security | Clean env, hardened config | 1–2 hrs |
| 2 | Frontend | No dev gates, polished empty states | 2–3 hrs |
| 3 | Backend | Real DB queries, no console noise | 2–3 hrs |
| 4 | Documentation | Setup guide, admin guide, clean root | 1–2 hrs |

**Total calendar time:** ~3 hours (parallel) + 30 min validation  
**Total work hours:** ~8 hours across all agents
