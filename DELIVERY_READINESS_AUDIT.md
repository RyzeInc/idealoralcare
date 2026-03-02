# 🚀 Delivery Readiness Audit for Ideal Health
**Date:** February 28, 2026  
**Status:** Pre-Launch Review for Non-Technical Client  
**Version:** 1.0

---

## Executive Summary

The platform is **functionally working** but requires **critical changes** before delivery to Ideal Health. The main issues fall into 5 categories:

1. **Developer Gatekeeping** - Seed/demo pages accessible without authentication
2. **Incomplete Features** - Stub implementations and mock data throughout
3. **Configuration Issues** - Hardcoded values, environment setup concerns
4. **Error Handling** - Production-unfriendly messages and console logging
5. **Documentation & Support** - Missing user-facing guidance

**Estimated effort:** 2-3 days for core fixes + 1-2 days for polish.

---

## 🔴 CRITICAL ISSUES (Must Fix Before Launch)

### 1. Developer-Gated Pages Accessible Without Authentication

**Problem:** Admin/seed pages should NOT be exposed to end users.

#### Issue 1A: Catalog Seed Page
- **Location:** `/admin/catalog-seed` - Button to reseed all product catalog data
- **Risk:** High - Ideal Health staff could accidentally nuke live product data
- **Status:** Currently protected by admin auth, BUT seed data is often needed - needs proper "Reset Data" confirmation or removal entirely

#### Issue 1B: Mock Data Placeholders
- **Locations:**
  - `/health/dashboard/admin/hierarchy/page.tsx:66` - "Form placeholder - implement field inputs"
  - `/health/dashboard/admin/hierarchy/page.tsx:129` - "Accounts list placeholder"
  - `/health/dashboard/admin/hierarchy/page.tsx:138` - "Groups list placeholder"
- **Risk:** High - Confuses administrators about what's working
- **Status:** These should show real data or be hidden

#### Issue 1C: Mock Hierarchy Queries
- **Location:** `convex/hierarchy.ts` lines 107, 148, 173
- **Current behavior:** Returns hardcoded "mock site/account/group" for Phase 1
- **Risk:** Medium - Site resolution might fail in production if real data doesn't exist
- **Action needed:** Either populate real sites or add clear error messaging

---

### 2. Missing Environment Variables & Configuration

**Problem:** `.env.local` is committed with LIVE Stripe keys (security risk).

#### Issue 2A: Sensitive Data in Git
```dotenv
STRIPE_SECRET_KEY=sk_live_... (EXPOSED)
STRIPE_WEBHOOK_SECRET=whsec_... (EXPOSED)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_... (EXPOSED)
```
- **Action:** Remove `.env.local` from git, add to `.gitignore`
- **Setup:** Provide `.env.example` with placeholder format only

#### Issue 2B: Missing Domain Configuration
- **Current:** `NEXT_PUBLIC_APP_URL=http://localhost:3001` (dev value)
- **Needed:** Actual production domain (e.g., `https://getidealoh.com`)
- **Impact:** Links in emails, redirects, and webhooks may be wrong

#### Issue 2C: Clerk Configuration in Dev
- **Current:** Using `pk_test_` keys (Clerk development environment)
- **For production:** Must switch to live Clerk API keys
- **Action:** Document the Clerk setup process for Ideal Health

---

### 3. Incomplete Backend Implementations (TODOs & Stubs)

**Problem:** Many features show blank/mock data instead of real content.

#### Critical TODOs Found:
```typescript
// Convex mutations not implemented:
- convex/admin/eligibility.ts:200 - TODO: fetch file content from storage
- convex/admin/eligibility.ts:472 - TODO: Delete file from storage
- convex/admin/notifications.ts:30 - TODO: Implement Resend API call (returns mock)
- convex/admin/vendorFiles.ts:209 - Placeholder SFTP implementation
- convex/admin/sftpDelivery.ts:27, 52, 118 - SFTP delivery not implemented
- convex/healthplans/oral.ts:169 - TODO: Integrate with Dental Discount Network API
```

#### Frontend Stubs:
```typescript
// src/components/health/DashboardTabs.tsx
- recordScanStarted = async () => { /* TODO */ };
- markScanClosed = async (args?: {...}) => { /* TODO */ };
- requestForward = async (args?: {...}) => { /* TODO */ };
// Scan history table is empty (says "TODO: Create oralScans table in Convex schema")
```

**Action:** Either complete these or remove from UI so users don't expect functionality.

---

### 4. Hardcoded Values That Should Be Dynamic

#### Issue 4A: Site Names & Support Contact
```typescript
// src/components/enrollment/ConfirmationPage.tsx
const supportEmail = site?.enrollmentDefaults?.supportEmail || 'support@idealhealth.com';
const supportPhone = site?.enrollmentDefaults?.supportPhone || '1-844-IDEAL-01';
```
- **Problem:** Fallbacks reference "Ideal Health" not the actual client organization
- **Action:** Update to generic fallbacks or require admin configuration

#### Issue 4B: Default Site Configuration
```typescript
// convex/enrollment/sessions.ts:121
if (!site) {
  const siteId = await ctx.db.insert("sites", {
    name: "Ideal Health",  // HARDCODED
    logoUrl: "/ideal-health-logo.png",  // HARDCODED
    primaryColor: "#0066CC",  // Ideal's color, not Ideal Health's
  });
}
```
- **Action:** These should come from admin configuration, not code

#### Issue 4C: Test/Mock Data Everywhere
```typescript
// convex/enrollment/seed.ts:101
// Create a sample member for testing
// convex/hierarchy.ts:107
// For Phase 1: return mock site
```
- **Action:** Clean up seed functions or clearly mark them as demo-only

---

### 5. Console Logging & Debug Output

**Problem:** Production code has development logging that exposes internals.

#### Found in 30+ locations:
```typescript
console.error("[dashboard-layout] Subscription check error:", error);
console.error("[admin-layout] Auth check error:", error);
console.error('Error saving broker:', error);
console.log(`[EventEmitter] Event emitted: ${event.eventType}`, {...});
console.log("[webhook] checkout.session.completed processed:", {...});
```

**Action:** Remove development logging from production builds OR wrap with `if (process.env.NODE_ENV === 'development')`

---

## 🟡 HIGH PRIORITY ISSUES (Should Fix Before Launch)

### 6. Authentication & Authorization

#### Issue 6A: Admin Access Endpoints
- `/admin` - Protected by Clerk auth + isAdmin check ✅ Good
- `/health/dashboard/admin` - Same protection ✅ Good
- But: `/admin/catalog-seed` allows data reset without confirmation ⚠️

#### Issue 6B: User Experience on Unauthorized Access
- No friendly error messages when subscription expires
- No clear guidance on what to do next
- Should show: "Your plan expired. Renew here: [link]"

---

### 7. Missing Real Implementation: Eligibility Files

**Location:** `/health/dashboard/admin/eligibility/page.tsx`  
**Status:** Can upload CSV, but...
- No file storage integration (TODO comment at line 200)
- No email notifications when uploaded
- No processing logic to import member data

**Action:** Either implement fully OR hide upload until ready

---

### 8. Missing Real Implementation: SFTP Delivery

**Locations:** `convex/admin/sftpDelivery.ts`, `convex/admin/vendorFiles.ts`  
**Status:** UI exists but backend just returns placeholder

**Action:** Either implement OR hide vendor file features

---

### 9. Payment Method Not Fully Integrated

**Issue:** ACH payment option exists but integration incomplete
- Can select ACH payment method
- Different pricing for ACH vs card
- But: ACH actually goes to Stripe (which doesn't natively support ACH - needs bank account integration)

**Action:** Either complete ACH integration or hide option for now

---

### 10. Missing Configuration UI for Admins

**These settings should be configurable by Ideal Health staff, but aren't:**
- Enrollment defaults (group code required? self-enroll allowed?)
- Support email/phone
- Branding colors & logo
- Terms/privacy policy URLs
- Site name and tagline

**Files affected:**
- `convex/admin/siteSettings.ts` - Settings exist but UI not exposed
- `convex/admin/hierarchy.ts` - Can create sites but no UI form

**Action:** Build admin forms for these settings OR seed initial values

---

## 🟢 MEDIUM PRIORITY ISSUES (Nice to Have Before Launch)

### 11. Error Handling Improvements

**Current:** Generic "Internal server error" messages  
**Better:** User-friendly error pages with next steps

**Examples:**
- Stripe payment fails → "Card declined. Try another card or contact support."
- Enrollment session expires → "Your session ended. Start over here."
- Database connection fails → Better than "500 error"

**Action:** Build error pages for common scenarios

---

### 12. Missing Resend Email Integration

**Location:** `convex/admin/notifications.ts:30`  
- TODO comment says "Implement Resend API call"
- Currently returns `mock_${Date.now()}` fake message ID

**Affected features:**
- Welcome emails after enrollment
- ID card generation & delivery
- Eligibility file notifications

**Action:** Either integrate Resend or remove email features from public-facing UI

---

### 13. Incomplete Dashboard Features

**Issues Found:**
- OralScan functionality has empty implementation (DashboardTabs.tsx:90-96)
- Member card generation is placeholder only (memberCards.ts:17)
- Commissions query not implemented (commissions.ts:18, 32, 45)

**Action:** Either implement or hide from users until ready

---

### 14. Documentation for End Users

**Missing:**
- How to reset password
- How to download member ID card
- How to contact support
- What to do if payment fails
- Privacy/terms should be accessible

**Action:** Add help/documentation section

---

### 15. Browser Compatibility & Mobile Testing

**No evidence of:**
- Mobile testing checklist
- Browser compatibility testing (Chrome, Safari, Firefox, Edge)
- Accessibility testing (WCAG compliance)

**Action:** Test on multiple devices/browsers before launch

---

## 📋 DETAILED IMPLEMENTATION CHECKLIST

### Phase 1: Security & Configuration (1 day)

- [ ] Remove `.env.local` from git
  ```bash
  git rm --cached .env.local
  echo ".env.local" >> .gitignore
  git add .gitignore && git commit -m "Remove sensitive env file"
  ```

- [ ] Create `.env.example` with all required variables (no real values)

- [ ] Update deployment instructions with setup process for:
  - [ ] Setting up Convex deployment (they get their own Convex project)
  - [ ] Configuring Clerk for their Clerk.com account
  - [ ] Configuring Stripe for their Stripe.com account
  - [ ] Setting environment variables on hosting platform

- [ ] Verify all security headers in `next.config.ts`:
  - [ ] Remove `*.app.github.dev` from allowedOrigins
  - [ ] Verify STS header set to production value

- [ ] Remove all `console.log/error/warn` from production code OR wrap with dev check

---

### Phase 2: Remove Developer-Gated Pages (1 day)

- [ ] Hide or remove `/admin/catalog-seed`
  - Option A: Add confirmation dialog with "Are you sure?" 
  - Option B: Remove entirely and only seed via API call during setup
  - Recommendation: Remove for production

- [ ] Update `/health/dashboard/admin/hierarchy` placeholders
  - Replace "Form placeholder" with actual empty state or hide form until implemented
  - Replace "Accounts list placeholder" with real data or "No accounts created"
  - Replace "Groups list placeholder" with real data or "No groups created"

- [ ] Fix mock data in `convex/hierarchy.ts`:
  - Line 107: Don't always return mock, check if real site exists first
  - Add error: "Site not found. Please create one in admin panel."

---

### Phase 3: Feature Completeness (2-3 days - depends on scope)

**Choose one path for each incomplete feature:**

#### Option A: Complete Implementation (if needed for launch)
- Eligibility file upload → actual CSV processing & member import
- SFTP delivery → real SFTP integration or hide
- Email notifications → integrate Resend or SendGrid
- ACH payments → complete integration or remove option

#### Option B: Hide UI Until Ready (recommended for MVP)
- Hide eligibility UI until backend ready
- Hide vendor file upload until SFTP ready  
- Hide commission reports until schema complete
- Hide ACH option until integrated

**Recommendation:** Go with Option B for faster launch. Mark these as "Coming Soon".

---

### Phase 4: Configuration & Admin Tools (1-2 days)

- [ ] Build admin form for Site Settings:
  - [ ] Site name, domain
  - [ ] Support email/phone
  - [ ] Branding (colors, logo)
  - [ ] Enrollment defaults
  - [ ] Terms/privacy URLs

- [ ] Create setup wizard for first-time use:
  - [ ] Auto-create Ideal Health site if doesn't exist
  - [ ] Guide to configure settings
  - [ ] Guide to create first admin user

- [ ] Add deployment checklist:
  - [ ] All required env vars set
  - [ ] Stripe webhooks configured
  - [ ] Clerk app configured
  - [ ] Convex deployment created
  - [ ] First admin user created

---

### Phase 5: Error Handling & UX (1-2 days)

- [ ] Add user-friendly error pages for:
  - [ ] 404 - Page not found
  - [ ] 500 - Server error (with contact support button)
  - [ ] Payment declined
  - [ ] Session expired
  - [ ] Subscription required

- [ ] Add loading states for async operations

- [ ] Add success confirmations for important actions:
  - [ ] Member enrolled successfully
  - [ ] File uploaded successfully
  - [ ] Settings saved successfully

- [ ] Test all error paths work correctly

---

### Phase 6: Documentation (1 day)

- [ ] Create admin setup guide:
  - [ ] Environment variables
  - [ ] Clerk configuration
  - [ ] Stripe configuration
  - [ ] Convex setup
  - [ ] Creating first site/account/group

- [ ] Create end-user help:
  - [ ] How to enroll
  - [ ] How to access dashboard
  - [ ] How to download ID card
  - [ ] How to contact support
  - [ ] What to do if payment fails

- [ ] Create deployment guide:
  - [ ] Where to deploy (Vercel recommended)
  - [ ] How to deploy
  - [ ] Post-deployment checklist

- [ ] Create maintenance guide:
  - [ ] How to manage users
  - [ ] How to reset data
  - [ ] How to debug common issues

---

## 🎯 RECOMMENDATIONS FOR LAUNCH

### MUST DO (Before Delivery)
1. **Remove `.env.local` from git** - Security risk (STRIPE_SECRET_KEY exposed)
2. **Hide/remove catalog-seed page** - Prevents accidental data wipe
3. **Fix mock site fallbacks** - Add proper error handling instead of returning fake data
4. **Remove console.logs** - Clean up debug output
5. **Create `.env.example`** - Document required setup
6. **Create setup guide** - How to configure for production

### SHOULD DO (Before or Shortly After)
1. **Fix placeholder UI** - Replace "Form placeholder" with real forms or clear empty states
2. **Implement email notifications** OR hide email features
3. **Hide incomplete features** - Commission reports, SFTP, ACH, scan history
4. **Build settings admin form** - Let non-developers configure site
5. **Improve error messages** - User-friendly, actionable guidance

### NICE TO HAVE (Later)
1. User documentation/help center
2. Accessibility audit (WCAG)
3. Mobile/responsive testing
4. Performance optimization
5. Analytics integration

---

## 💡 QUICK WINS (1-2 hours each)

1. **Add `.gitignore` rule for `.env.local`** → Prevent re-commit
2. **Update support contact strings** → Use dynamic config instead of "Ideal Health"
3. **Add confirmation dialog to data-destructive actions** → Prevents accidents
4. **Wrap console.logs with dev check** → Cleaner production logs
5. **Update `next.config.ts` to remove github.dev** → Already there, just verify
6. **Create basic admin form stub** → For site settings management

---

## 📊 Risk Assessment

| Issue | Severity | Impact | Effort |
|-------|----------|--------|--------|
| Exposed Stripe keys in git | CRITICAL | Security breach | 15 min |
| Mock data returned instead of error | HIGH | Silent failures | 2 hours |
| Seed page accessible | HIGH | Data loss risk | 30 min |
| Console.logs in production | MEDIUM | Information leakage | 1 hour |
| Missing email integration | MEDIUM | Notifications don't work | 4 hours |
| Placeholder UI | MEDIUM | User confusion | 4 hours |
| No settings admin form | MEDIUM | Non-devs can't config | 8 hours |
| Incomplete features visible | MEDIUM | False expectations | 2 hours |

---

## 📞 Next Steps

1. **Immediate (Today):**
   - [ ] Review this audit with team
   - [ ] Decide on feature completion strategy (complete vs. hide)
   - [ ] Rotate Stripe keys just in case
   - [ ] Remove `.env.local` from git

2. **This Week:**
   - [ ] Implement Phase 1-2 fixes (security & remove dev gates)
   - [ ] Decide on incomplete features (keep or hide)
   - [ ] Create `.env.example`

3. **Before Launch:**
   - [ ] Implement chosen features (Phase 3-4)
   - [ ] Test all critical paths
   - [ ] Create setup guide for Ideal Health
   - [ ] Document all admin procedures

4. **Post-Launch (Quick Fixes):**
   - [ ] Gather end-user feedback
   - [ ] Fix any discovered issues
   - [ ] Complete Phase 5-6 (error handling, docs)

---

## 🔗 Referenced Files

**Critical Files to Update:**
- `.env.local` - Remove from git
- `next.config.ts` - Verify production config
- `convex/hierarchy.ts` - Fix mock returns
- `src/components/enrollment/ConfirmationPage.tsx` - Update fallbacks
- All files with `TODO` comments
- All files with `console.log/error/warn`

**Files Needing New Admin Forms:**
- Admin site settings form
- Admin site creation form
- Setup wizard component

**New Documentation Needed:**
- Deployment guide
- Admin setup guide
- End-user help center

---

**Prepared:** Dylan Lewis  
**Date:** February 28, 2026  
**Status:** Ready for implementation
