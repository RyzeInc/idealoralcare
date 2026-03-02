# DELIVERY ACTION PLAN - Priority Tasks

**Target:** Launch-ready within 2-3 days  
**Scope:** Remove developer gatekeeping, secure sensitive data, hide incomplete features

---

## 🔴 PHASE 1: SECURITY (TODAY - 2 hours)

### 1. Remove `.env.local` from Git Tracking
```bash
cd /Users/desel/Documents/idealoralcare
git rm --cached .env.local
echo ".env.local" >> .gitignore
git add .gitignore
git commit -m "Remove .env.local with live Stripe keys from git history"
```

**Why:** The file contains:
- `STRIPE_SECRET_KEY=sk_live_...` (LIVE PRODUCTION KEY!)
- `STRIPE_WEBHOOK_SECRET=whsec_...`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...`

**Action after:** 
- Contact Stripe support to rotate keys
- Regenerate Clerk and other service keys
- Only store `.env.local` on production server, not in git

### 2. Create `.env.example` (Template Only)
Copy `.env.local` → `.env.example` but replace all real values with `YOUR_VALUE_HERE`

```
# Example of what should be in .env.example
CONVEX_DEPLOYMENT=dev:your-deployment
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_KEY
CLERK_SECRET_KEY=sk_test_YOUR_KEY

STRIPE_SECRET_KEY=sk_live_YOUR_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_KEY

NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_APP_DOMAIN=getidealoh.com
NEXT_PUBLIC_APP_URL=https://getidealoh.com
```

### 3. Fix next.config.ts - Remove Dev Origins
Already done correctly: `*.app.github.dev` only added in development mode. ✅

---

## 🔴 PHASE 2: REMOVE DEVELOPER GATES (2-3 hours)

### 4. Remove Catalog Seed Page
**Location:** `/src/app/admin/catalog-seed/page.tsx`

**Option A (Recommended for MVP):** Delete the entire file
```bash
rm /Users/desel/Documents/idealoralcare/src/app/admin/catalog-seed/page.tsx
```

Remove from admin navigation:
- File: `/src/app/admin/layout.tsx` - Delete the line:
  `{ label: "Catalog Seed", href: "/admin/catalog-seed", icon: Package },`
- File: `/src/app/health/dashboard/admin/layout.tsx` - Same line to delete

**Why:** This page lets admins accidentally nuke the entire product catalog with one click. Too dangerous.

### 5. Fix Hierarchy Admin - Replace Placeholders
**File:** `/src/app/health/dashboard/admin/hierarchy/page.tsx`

**Change 1 (Line 66):**
```typescript
// BEFORE:
<p className="text-slate-600 mb-6">Form placeholder - implement field inputs</p>

// AFTER: Remove the form entirely or add this message:
<p className="text-slate-600 mb-6 text-sm italic">Site form coming soon. Contact support to manage sites.</p>
```

**Change 2 (Line 129):**
```typescript
// BEFORE:
<p>Accounts list placeholder</p>

// AFTER:
<p className="text-slate-500">No accounts created yet. Create one in the form above.</p>
```

**Change 3 (Line 138):**
```typescript
// BEFORE:
<p>Groups list placeholder</p>

// AFTER:
<p className="text-slate-500">No groups created yet. Create one in the form above.</p>
```

### 6. Fix Mock Site Fallbacks in Backend
**File:** `/convex/hierarchy.ts`

**Lines 107-128** (getSiteById):
```typescript
// BEFORE:
// For Phase 1: return mock site
if (siteId === "site_dtc_001" || siteId === "") {
  return { _id: "site_dtc_001", name: "Ideal Health DTC", ... };
}

// AFTER:
const site = await ctx.db.get(siteId);
if (!site) {
  throw new Error("Site not found");
}
return site;
```

**Lines 148-170** (getAccountById):
```typescript
// BEFORE:
// For Phase 1: return mock account
if (accountId === "acct_dtc_001" || accountId === "") {
  return { _id: "acct_dtc_001", ... };
}

// AFTER:
const account = await ctx.db.get(accountId);
if (!account) {
  throw new Error("Account not found");
}
return account;
```

**Lines 173-196** (getGroupById):
```typescript
// BEFORE:
// For Phase 1: return mock group
if (groupId === "grp_dtc_001" || groupId === "") {
  return { _id: "grp_dtc_001", ... };
}

// AFTER:
const group = await ctx.db.get(groupId);
if (!group) {
  throw new Error("Group not found");
}
return group;
```

**Why:** Mock returns hide real problems. Better to fail loudly than silently return fake data.

---

## 🟡 PHASE 3: CLEAN UP DEBUG OUTPUT (1-2 hours)

### 7. Remove Console Statements from Production Code

**Files with console.logs to clean:**
1. `/src/components/admin/BrokersAdmin.tsx` - Lines 129, 146
2. `/src/lib/event-emitter.ts` - Lines 26, 32, 39
3. `/src/components/admin/EnrollmentLauncher.tsx` - Line 107
4. `/src/components/health/DashboardTabs.tsx` - Line 122
5. `/src/components/forms/ContactForm.tsx` - Line 88
6. `/src/components/forms/SmartInquiryForm.tsx` - Line 256
7. All API route files in `/src/app/api/`

**Option A (Clean):** Remove all console statements
**Option B (Safer):** Wrap with development check:
```typescript
if (process.env.NODE_ENV === 'development') {
  console.error("[module] Error:", error);
}
```

**Recommendation:** Use Option B for error tracking but remove verbose logs.

---

## 🟢 PHASE 4: HIDE INCOMPLETE FEATURES (2-4 hours)

### 8. Hide Commission Reports (Not Yet Implemented)

**File:** `/src/app/admin/layout.tsx` - Remove from navigation:
```typescript
// DELETE THIS LINE:
{ label: "Commissions", href: "/admin/commissions", icon: BarChart3 },
```

Also delete from `/src/app/health/dashboard/admin/layout.tsx`

### 9. Hide SFTP/Vendor Files (Not Yet Implemented)

**File:** `/src/app/admin/layout.tsx` - Remove from navigation:
```typescript
// DELETE THIS LINE:
{ label: "Vendor Files", href: "/admin/vendor-files", icon: BarChart3 },
```

Also delete from `/src/app/health/dashboard/admin/layout.tsx`

**Message for Ideal Health:** "Coming soon - will automate member file delivery to vendor systems"

### 10. Hide Eligibility File Upload (Backend Not Complete)

**File:** `/src/app/admin/eligibility/page.tsx`

Replace the upload UI with:
```tsx
<div className="bg-blue-50 border border-blue-200 rounded p-4">
  <p className="text-blue-900 font-semibold">Eligibility Files (Coming Soon)</p>
  <p className="text-blue-800 text-sm">This feature will allow bulk member uploads via CSV. Current implementation is not ready for production.</p>
  <p className="text-blue-700 text-xs mt-2">Contact support@idealhealth.com for manual enrollment assistance.</p>
</div>
```

### 11. Hide OralScan Dashboard Features (Not Implemented)

**File:** `/src/components/health/DashboardTabs.tsx`

The "Record Scan", "View Reports", "Request Forward" tabs are empty. Either:
- **Option A:** Hide them entirely
- **Option B:** Show "Coming Soon" message

Recommended: Hide until Toothlens integration is complete.

---

## 📋 PHASE 5: QUICK CONFIGURATION FIXES (1-2 hours)

### 12. Update Support Contact Template
**File:** `/src/components/enrollment/ConfirmationPage.tsx` - Lines 18-20

```typescript
// BEFORE:
const supportEmail = site?.enrollmentDefaults?.supportEmail || 'support@idealhealth.com';
const supportPhone = site?.enrollmentDefaults?.supportPhone || '1-844-IDEAL-01';

// AFTER:
const supportEmail = site?.enrollmentDefaults?.supportEmail || 'support@getidealoh.com';
const supportPhone = site?.enrollmentDefaults?.supportPhone || '(888) YOUR-PHONE';
```

### 13. Update Default Branding Colors
**File:** `/convex/enrollment/sessions.ts` - Lines 124-126

```typescript
// BEFORE:
primaryColor: "#0066CC",  // Ideal's blue
secondaryColor: "#14b8a6",  // teal

// AFTER:
primaryColor: "#1e3a5f",  // Neutral navy
secondaryColor: "#14b8a6",  // teal
```

---

## 🎯 FINAL QUALITY CHECKLIST

### 14. Run Build & Test Locally
```bash
npm run build
npm run dev
```

**Test these paths:**
1. ✅ `/health` - Landing page loads
2. ✅ `/health/enroll` - Enrollment flow works
3. ✅ `/admin` - Admin panel shows (after login + admin role)
4. ✅ Missing pages - `/admin/commissions`, `/admin/vendor-files` should 404
5. ✅ `/admin/catalog-seed` should 404
6. ✅ No console.errors in browser console

### 15. Verify Environment Variables Are Complete

Required for production:
```
✅ CONVEX_DEPLOYMENT
✅ NEXT_PUBLIC_CONVEX_URL
✅ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
✅ CLERK_SECRET_KEY
✅ STRIPE_SECRET_KEY
✅ STRIPE_WEBHOOK_SECRET
✅ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
✅ NEXT_PUBLIC_APP_URL
✅ NEXT_PUBLIC_APP_DOMAIN
```

---

## 📦 DEPLOYMENT PACKAGE

Create a file: `/DEPLOYMENT_SETUP.md`

```markdown
# Deployment Setup Guide for Ideal Health

## Pre-Deployment: What's Included

This is a Next.js + Convex + Clerk + Stripe application.

### What IS Included
- ✅ Public landing page (/health)
- ✅ Enrollment flow
- ✅ Member dashboard
- ✅ Admin panel (sites, accounts, groups, members, billing)
- ✅ Payment processing (Stripe)

### What's NOT Yet Complete (Hidden from Users)
- ⏳ OralScan integration (Toothlens)
- ⏳ Commission tracking
- ⏳ SFTP file delivery
- ⏳ CSV eligibility upload
- ⏳ Email notifications (Resend)

## Required Accounts

Before deploying, you need:
1. [Convex.dev](https://convex.dev) - Backend database
2. [Clerk.com](https://clerk.com) - Authentication
3. [Stripe.com](https://stripe.com) - Payment processing
4. [Vercel.com](https://vercel.com) - Hosting (recommended)

## Setup Steps

### 1. Clone & Setup
```bash
git clone <repo>
cd idealoralcare
npm install
```

### 2. Create Convex Project
```bash
npx convex deploy
# This creates your own Convex deployment
# Note the deployment URL
```

### 3. Get Secrets from Services

**Clerk:**
1. Create account at clerk.com
2. Create new Application
3. Copy Publishable Key and Secret Key

**Stripe:**
1. Create account at stripe.com (enable Live mode)
2. Go to Developers → API Keys
3. Copy Secret Key and Publishable Key
4. Create Webhook endpoint pointing to `/api/stripe/webhook`
5. Copy webhook signing secret

### 4. Create .env.local
```
CONVEX_DEPLOYMENT=your-deployment-from-step-2
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...

STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

NEXT_PUBLIC_APP_DOMAIN=getidealoh.com
NEXT_PUBLIC_APP_URL=https://getidealoh.com
```

### 5. Deploy to Vercel
```bash
npm run build  # Test locally
# Push to GitHub
# Connect to Vercel
```

### 6. Post-Deployment
- [ ] Set .env.local on Vercel
- [ ] Configure Clerk to use your domain
- [ ] Configure Stripe webhook to live domain
- [ ] Create first admin user via /admin/users
- [ ] Test enrollment flow end-to-end
- [ ] Verify emails work (send test)
- [ ] Check error pages work

## Getting Help

Email: support@getidealoh.com
```

---

## ✅ COMPLETION TRACKING

| Phase | Task | Effort | Status |
|-------|------|--------|--------|
| 1 | Remove .env.local from git | 15m | ⏳ TODO |
| 1 | Create .env.example | 15m | ⏳ TODO |
| 2 | Delete catalog-seed page | 15m | ⏳ TODO |
| 2 | Fix hierarchy placeholders | 30m | ⏳ TODO |
| 2 | Fix mock site returns | 1h | ⏳ TODO |
| 3 | Remove console.logs | 1h | ⏳ TODO |
| 4 | Hide incomplete features | 1h | ⏳ TODO |
| 5 | Update config strings | 30m | ⏳ TODO |
| 5 | Test build & verify | 1h | ⏳ TODO |
| 5 | Create deployment guide | 1h | ⏳ TODO |

**Total Estimated Time:** 6-8 hours for all phases

---

## 🚀 FINAL SIGN-OFF

Once all items are complete:
1. ✅ No `.env.local` in git
2. ✅ No developer-gated pages accessible
3. ✅ No mock data returned instead of errors
4. ✅ No console.logs in production
5. ✅ Incomplete features hidden with "Coming Soon" message
6. ✅ Deployment guide created
7. ✅ Build passes without warnings
8. ✅ Manual testing on live paths complete

**System is ready for delivery to Ideal Health.**
