## Plan: Individual/Family Plan Full Backend Integration

The UI tier toggle on /plans exists and works, but the backend has critical gaps that would cause family plan checkout to **fail or silently charge individual pricing**. Here's what needs to be fixed:

---

**Steps**

### Phase 1: Database & Seed Data
1. **Replace TBD Stripe product IDs** in mutations.ts — swap all 4 `prod_FAMILY_*_TBD` placeholders with the real IDs you provided (`prod_UATZaCDHuecUAU`, `prod_UATZtpSjiCDdA8`, `prod_UATbPjQGVypcuM`, `prod_UATaKRi9t60PVO`)
2. **Create `fixFamilyStripeIds` migration mutation** — patches the live Convex DB with real Stripe IDs (must be run on dev + prod after deploy)

### Phase 2: Stripe API Routes
3. **Fix checkout route fallback** in route.ts — currently if DB lookup fails, it silently falls back to individual pricing ($14.99). Fix: return an error instead. Also remove the per-dependent pricing block ($9.99 × count) since family is flat-rate $24.99
4. **Fix setup-payment route** in route.ts — 100% hardcoded to individual pricing/product IDs. Add dynamic Convex DB lookup (same pattern as checkout route)

### Phase 3: Webhook Bug Fix (Critical)
5. **Add `getByStripeProductId` query** to queries.ts — reverse-lookup from Stripe product ID → Convex catalogProducts doc
6. **Fix Stripe→Convex product ID mapping** in route.ts — **BUG**: currently passes Stripe product ID (`prod_xxx`) as `productId` to `webhookActivateEntitlement`, but the schema expects a Convex document ID. Fix: use the new query to resolve the correct Convex ID before creating the entitlement

### Phase 4: Checkout UI Polish
7. **Verify plan name display** on checkout order summary in page.tsx — product name from DB includes "— Family" so it should render correctly. Ensure it's visually clear which tier the user is purchasing

### Phase 5: Dashboard Verification
8. **Verify dashboard plan name** in page.tsx — after webhook fix, `productId` in entitlements will be correct Convex IDs, so plan name resolution via `getMemberCardDataPublic` will work

---

**Relevant files**
- mutations.ts — Replace TBD Stripe IDs, add migration
- queries.ts — Add `getByStripeProductId` reverse-lookup query
- route.ts — Fix silent fallback to individual pricing, remove per-dependent legacy code
- route.ts — Add dynamic DB pricing (currently 100% hardcoded individual)
- route.ts — Fix critical Stripe→Convex product ID mapping bug
- page.tsx — Minor: verify plan name display
- page.tsx — Verify (likely no code changes needed)

**Verification**
1. Run `fixFamilyStripeIds` on dev → confirm Convex dashboard shows real Stripe IDs on family product
2. /health/plans — toggle Individual ↔ Family, verify prices ($14.99/$164.99 vs $24.99/$274.99)
3. Add family plan → /health/checkout → confirm order summary shows "Family" name + $24.99 or $274.99
4. Complete test Stripe checkout for family → confirm Stripe session uses family product ID + correct amount
5. After webhook fires → check Convex entitlements table has **Convex** `_id` (not `prod_xxx`) in productId
6. /health/dashboard → confirm plan name shows "Ideal Oral Health Plan — Family"
7. Repeat 2-6 for individual plan (regression check)

**Decisions**
- Family = flat $24.99/mo ($274.99/yr) covering primary + up to 4 dependents
- Dependents collected later in dashboard, not during checkout
- Per-dependent pricing code ($9.99/head) is legacy — will be removed
- If DB lookup fails in checkout route → return error, don't silently degrade to individual pricing

**Further Consideration**
1. **Historical entitlements**: Any subscriptions created before the webhook fix have Stripe product IDs in the `productId` field. May need a one-time data migration, or the dashboard query should handle both formats gracefully. *Recommend*: add graceful fallback now, schedule migration later.