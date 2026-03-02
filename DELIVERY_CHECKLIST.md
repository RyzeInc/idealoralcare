# DELIVERY READINESS CHECKLIST

**Project:** Ideal Health Oral Care Platform  
**Target Date:** Launch to non-technical client  
**Prepared:** February 28, 2026

---

## 🔴 CRITICAL (MUST COMPLETE)

### Security
- [ ] Remove `.env.local` from git
  - Command: `git rm --cached .env.local`
  - Add to `.gitignore`: `echo ".env.local" >> .gitignore`
  - Commit: `git commit -m "Remove sensitive env file"`
  
- [ ] Create `.env.example` with placeholder values only
  - No real API keys
  - Has all required variables documented
  
- [ ] Rotate/revoke all exposed credentials
  - [ ] Stripe keys (`sk_live_...`)
  - [ ] Stripe webhook secret
  - [ ] Clerk API keys
  - [ ] Document new keys in secure place (not git)

- [ ] Verify next.config.ts security
  - [ ] `allowedOrigins` doesn't include production domains in dev mode
  - [ ] STS header configured for production
  - [ ] CSP headers properly set

### Developer Gates Removed
- [ ] Delete `/src/app/admin/catalog-seed/page.tsx`
  - File: DELETE entirely
  - Navigation: Remove from `/src/app/admin/layout.tsx`
  - Navigation: Remove from `/src/app/health/dashboard/admin/layout.tsx`

- [ ] Fix `/src/app/health/dashboard/admin/hierarchy/page.tsx`
  - [ ] Line 66: Replace "Form placeholder" with actual form or empty state
  - [ ] Line 129: Replace "Accounts list placeholder" with "No accounts" message
  - [ ] Line 138: Replace "Groups list placeholder" with "No groups" message

- [ ] Fix `/convex/hierarchy.ts` mock data
  - [ ] Line 107: Remove hardcoded mock site, throw error instead
  - [ ] Line 148: Remove hardcoded mock account, throw error instead
  - [ ] Line 173: Remove hardcoded mock group, throw error instead

### Configuration Fixed
- [ ] Update fallback email in `/src/components/enrollment/ConfirmationPage.tsx`
  - [ ] `supportEmail` default: change to generic (e.g., `support@platform.example.com`)
  - [ ] `supportPhone` default: change to generic (e.g., `(888) SUPPORT`)

- [ ] Update initial site colors (if auto-created)
  - Ensure uses neutral colors, not Ideal-specific branding

---

## 🟡 HIGH PRIORITY (SHOULD COMPLETE)

### Code Quality
- [ ] Remove all `console.log()` statements from production code
  - [ ] `/src/lib/event-emitter.ts` - Lines 26, 32, 39
  - [ ] `/src/components/admin/BrokersAdmin.tsx` - Lines 129, 146
  - [ ] `/src/components/admin/EnrollmentLauncher.tsx` - Line 107
  - [ ] All files in `/src/app/api/`
  - [ ] Search: `grep -r "console\." src/` to find all

- [ ] Wrap remaining debug `console.error()` with dev check
  ```typescript
  if (process.env.NODE_ENV === 'development') {
    console.error("...", error);
  }
  ```

- [ ] No TODO comments in user-facing code
  - [ ] Search: `grep -r "TODO" src/` to find unfinished work
  - [ ] Either complete or hide feature

### Feature Completeness
- [ ] Hide incomplete features from UI

  **Commission Reports:**
  - [ ] Remove from `/src/app/admin/layout.tsx` navigation
  - [ ] Remove from `/src/app/health/dashboard/admin/layout.tsx` navigation
  - [ ] Mark as "Coming Soon" in admin help text

  **Vendor Files / SFTP:**
  - [ ] Remove from `/src/app/admin/layout.tsx` navigation
  - [ ] Remove from `/src/app/health/dashboard/admin/layout.tsx` navigation
  - [ ] Mark as "Coming Soon" in admin help text

  **Eligibility CSV Upload:**
  - [ ] In `/src/app/admin/eligibility/page.tsx`, replace upload UI with:
    ```tsx
    <div className="bg-blue-50 border border-blue-200 rounded p-4">
      <p className="font-semibold">Eligibility Files (Coming Soon)</p>
      <p className="text-sm">This feature will support CSV uploads...</p>
    </div>
    ```

  **OralScan Features:**
  - [ ] In `/src/components/health/DashboardTabs.tsx`, hide scan-related tabs
  - [ ] Show message: "OralScan features coming in next update"

  **ACH Payment Option:**
  - [ ] Verify Stripe ACH integration complete OR hide option
  - [ ] Currently shows as selectable but may not work

### Error Handling
- [ ] Test each error condition for good user messaging
  - [ ] Payment declined
  - [ ] Session expired  
  - [ ] Database connection error
  - [ ] Unauthorized access attempt
  - [ ] Enrollment step fails

- [ ] No generic "Internal server error" to users
  - Provide actionable next step: "Contact support: ___"

### Documentation Started
- [ ] Create `.env.example` with all required vars documented
- [ ] Create `DEPLOYMENT_SETUP.md` guide for Ideal Health
- [ ] Create `ADMIN_QUICK_START.md` for initial setup

---

## 🟢 MEDIUM PRIORITY (NICE TO HAVE)

### Admin Tools
- [ ] Admin form to edit site settings
  - [ ] Site name, domain
  - [ ] Brand colors
  - [ ] Support email/phone
  - [ ] Logo upload
  - [ ] Enrollment defaults

- [ ] Admin form to create sites/accounts/groups
  - [ ] Currently UI shows "Form placeholder"
  - [ ] Need actual input forms

- [ ] Admin user management visible and working
  - [ ] Add/remove admin users
  - [ ] Change admin roles

### Email Integration
- [ ] Email notifications working (optional for MVP)
  - [ ] Welcome email after enrollment
  - [ ] ID card generation
  - [ ] Eligibility file upload confirmation

- [ ] OR clearly mark as "Coming Soon"
  - [ ] Don't let UI suggest emails are sent if not

### Deployment Guide
- [ ] Document how to:
  - [ ] Set up Convex deployment
  - [ ] Configure Clerk app
  - [ ] Configure Stripe account
  - [ ] Deploy to hosting (Vercel recommended)
  - [ ] Configure environment variables
  - [ ] Create first admin user

- [ ] Post-deployment checklist:
  - [ ] All env vars set correctly
  - [ ] Stripe webhooks working
  - [ ] Clerk authentication working
  - [ ] Test enrollment end-to-end

### Testing & QA
- [ ] Manual testing checklist completed
  - [ ] Landing page loads
  - [ ] Enrollment flow works
  - [ ] Payment processing works
  - [ ] Admin panel accessible
  - [ ] No 404s on main paths
  - [ ] No console errors

- [ ] Build completes without errors
  ```bash
  npm run build
  ```

- [ ] No TypeScript errors
  ```bash
  npx tsc --noEmit
  ```

---

## 📋 TRACKING

### Phase 1: Security (Est. 1-2 hours)
- [ ] Remove .env.local
- [ ] Create .env.example
- [ ] Rotate credentials
- [ ] Verify security config
- **Status:** [  ] Not Started | [  ] In Progress | [  ] Complete

### Phase 2: Remove Dev Gates (Est. 2-3 hours)
- [ ] Delete catalog-seed page
- [ ] Fix hierarchy placeholders
- [ ] Fix mock data returns
- [ ] Update config strings
- **Status:** [  ] Not Started | [  ] In Progress | [  ] Complete

### Phase 3: Code Cleanup (Est. 1-2 hours)
- [ ] Remove console.logs
- [ ] Hide incomplete features
- [ ] Fix error messages
- **Status:** [  ] Not Started | [  ] In Progress | [  ] Complete

### Phase 4: Testing (Est. 2-3 hours)
- [ ] Build passes
- [ ] Manual testing complete
- [ ] No console errors
- **Status:** [  ] Not Started | [  ] In Progress | [  ] Complete

### Phase 5: Documentation (Est. 2-4 hours) - OPTIONAL
- [ ] .env.example complete
- [ ] Setup guide written
- [ ] Admin quick-start written
- **Status:** [  ] Not Started | [  ] In Progress | [  ] Complete

---

## Blockers & Questions

### Before Starting
- [ ] Do we hide incomplete features or complete them?
- [ ] Does Ideal Health staff need to configure settings, or do we set up for them?
- [ ] What's the deployment target? (Vercel? Self-hosted? Other?)
- [ ] Who's responsible for ongoing support?

### During Implementation
- [ ] Any features that can't be hidden or removed?
- [ ] Any existing integrations that would break?
- [ ] Any third-party services that need reconfiguration?

### After Launch
- [ ] Who provides technical support?
- [ ] How do we handle bugs/issues?
- [ ] When do we complete "Coming Soon" features?

---

## Sign-Off

### Ready for Delivery When:
- [  ] All 🔴 CRITICAL items complete
- [  ] All 🟡 HIGH PRIORITY items complete
- [  ] Build passes without warnings
- [  ] Manual testing complete
- [  ] No console errors or debug output
- [  ] Setup guide provided to Ideal Health

### Reviewer Sign-Off:
- [ ] Technical Lead: __________________ Date: ______
- [ ] Product Manager: ________________ Date: ______
- [ ] Ideal Health Sponsor: ___________ Date: ______

---

## Timeline Estimate

**Scenario 1: Quick Fix (Minimum to Launch)**
- Phase 1 (Security): 1-2 hours
- Phase 2 (Dev gates): 2-3 hours
- Phase 3 (Code cleanup): 1-2 hours
- Phase 4 (Testing): 1-2 hours
- **Total: 5-9 hours (1 day)**

**Scenario 2: Polished (Recommended)**
- All of Scenario 1: 5-9 hours
- Phase 5 (Documentation): 2-4 hours
- Admin tools (basic): 4-6 hours
- **Total: 11-19 hours (2-3 days)**

**Scenario 3: Production Ready (Full Polish)**
- All of Scenario 2: 11-19 hours
- Admin settings form: 4-8 hours
- Email integration: 2-4 hours
- Additional testing: 2-4 hours
- **Total: 19-35 hours (3-5 days)**

---

## Notes

- Ideal Health is non-technical - they cannot debug or fix issues
- Every visible UI element should either work perfectly or say "Coming Soon"
- No placeholders, debug output, or broken forms should be visible
- Configuration should be possible through UI, not code editing
- Setup guide is critical - they'll need to deploy themselves

---

Last Updated: February 28, 2026  
Next Review: Before final deployment
