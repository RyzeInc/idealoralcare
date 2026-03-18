Here's the full implementation plan:

---

## Plan: Member Portal & Pricing Updates v0.7

Overhaul the member portal dashboard (UI/UX from partner notes) and update pricing/fulfillment (from meeting decisions). 6 phases across portal navigation, membership card, How It Works modal, plan management, pricing, and fulfillment.

---

### Phase 1: Dashboard Navigation & Layout (no dependencies)

**Step 1 — Logo + Dashboard → Overview link**
- **File:** DashboardTabs.tsx
- Wrap the logo image + "Dashboard" heading in a clickable element that calls `setActiveTab('overview')`. Currently static/non-interactive.

**Step 2 — Rename "Browse Plans" → "Manage Plans"**
- **File:** OverviewTab.tsx (sidebar quick action), OverviewTab.tsx (header link), OverviewTab.tsx (empty state CTA)
- All three instances of "Browse Plans" / "Browse More" become "Manage Plans" and point to `/health/manage-plans`.

**Step 3 — Remove "Compare Plans" quick action**
- **File:** OverviewTab.tsx
- Remove entirely. Functionality absorbed into the new Manage Plans page (Step 6).

---

### Phase 2: Active Membership Card (no dependencies)

**Step 4 — Replace "Your Active Plans" box with Membership ID Card**
- **File:** OverviewTab.tsx
- When `hasSubscriptions` is true: replace the subscription list with the existing `MemberIdCard` component from MemberIdCard.tsx. Rename heading to "Your Membership Card".
- Wire with real member data (name, memberId, barcode, plan, effective date, networks). The dashboard page (page.tsx) needs to pass member profile data — the `getCustomerDashboard` query (currently a TODO) must be implemented/enabled.
- Connect the existing `onDownload` callback to the fulfillment PDF endpoint (`/api/generate-fulfillment-pdf`).
- Empty state (no subscription) keeps same design, CTA updated to "Manage Plans".

---

### Phase 3: How It Works Modal (no dependencies)

**Step 5 — Convert "How It Works" from page link to modal popup**
- **File:** OverviewTab.tsx — change `<Link>` to `<button>` that opens modal
- **New file:** `src/components/health/HowItWorksModal.tsx`

**Modal structure** (per partner's spec):
1. **Header:** "How To Use Your Program" + intro paragraph
2. **Three-card layout:**
   - **AI Dental Scan** — 3-step how-it-works, "Best for" bullets, CTA: "Start Scan" → `onTabChange('oral-scan')`
   - **Teledentistry** — 3-step how-it-works, "Best for" bullets, CTA: "Talk to a Dentist" → `onTabChange('teledentistry')`
   - **Dental Discount Network** — 3-step how-it-works, "Best for" bullets, CTA: "Find a Provider" → `onTabChange('provider-search')`
3. **"Best Way to Use Your Program"** — ordered steps: Scan → Teledentistry → Provider
4. **Need Help? box** — support email/phone/hours, FAQ link
5. **FAQ accordion** — 7 questions (scan, teledentistry, network, member ID, benefits timing, eligible services, etc.)
6. **Compliance disclaimer** — "not insurance" language

- Glassmorphism design, responsive (desktop + mobile), scrollable with backdrop overlay.
- Pass `onTabChange` prop so CTAs navigate to correct dashboard tabs and close the modal.
- The existing /health/how-it-works page stays for unauthenticated visitors.

---

### Phase 4: Plan Management Page (conceptually depends on Steps 2-3)

**Step 6 — Create consolidated Manage Plans page**
- **New file:** `src/app/health/manage-plans/page.tsx`
- Replaces both "Browse Plans" and "Compare Plans" for authenticated members. Includes:
  - Current plan summary (name, renewal date, price, status)
  - Upgrade/Downgrade (Individual ↔ Family tier)
  - Plan details (inclusions, exclusions from catalog)
  - Cancel plan (with confirmation, respecting easy-cancellation legislation)
  - Compare view (side-by-side individual vs family)
  - Browse/add future plans
- Data from `api.subscriptions.queries.getCustomerDashboard` + `api.catalog.queries`
- Existing `/health/plans` and `/health/compare` remain intact for unauthenticated/pre-enrollment users.

---

### Phase 5: Pricing Restructure (independent, backend + frontend)

**Step 7 — Update pricing in catalog**
- **File:** products.ts + Convex DB records
- New prices: Individual $14.99/mo, Family $24.99/mo. Annual = ×11 (buy 11 get 1 free): $164.89/yr and $274.89/yr. ACH = same price as card.
- **Recommendation:** Create two separate catalog products (`oral-health-individual` and `oral-health-family`) rather than complex tier logic on one product.

**Step 8 — Update annual discount messaging**
- **Files:** StickyCart.tsx, CadenceModal.tsx, plans page
- Change "Save ~17%" / "Save 15%" badges to "1 Month Free" / "Buy 11, Get 1 Free"

**Step 9 — Normalize ACH pricing**
- Same files as Step 8 + products.ts
- Set `monthlyACHCents = monthlyCardCents`, `annualACHCents = annualCardCents`. Remove "Save with ACH" badges. Keep ACH as a payment option.

**Step 10 — Update Compare page hardcoded data**
- **File:** page.tsx
- Update Oral Health from $29.99 to $14.99 individual. Add family tier entry at $24.99.

**Step 11 — Update checkout for family tier**
- **Files:** [checkout page](src/app/health/checkout/page.tsx), [Stripe checkout route](src/app/api/stripe/checkout/route.ts)
- Checkout selects the correct Stripe product (individual vs family) instead of base + per-dependent add-on. Requires new Stripe products/prices to be created first.

---

### Phase 6: Fulfillment & Welcome Kit (lower priority, independent)

**Step 12 — Zip code → nearest providers in fulfillment PDF**
- **Files:** [fulfillment-pdf.tsx](src/lib/fulfillment-pdf.tsx), [emailFulfillment.ts](convex/legal/emailFulfillment.ts)
- If Careington API ready: pull nearest providers by zip. If not: placeholder with "Find providers at [URL]" + member zip.

**Step 13 — Welcome kit PDF to 3-5 pages**
- **File:** [fulfillment-pdf.tsx](src/lib/fulfillment-pdf.tsx)
- Page 1: "How To Use Your Program" cover letter. Page 2: White-labeled membership card. Page 3: Schedule of Benefits. Page 4 (optional): FAQ + disclaimers.

**Step 14 — Apple/Google Wallet (research only)**
- No code changes. Research `.pkpass` generation (passkit-generator npm) and Google Wallet API. Document findings for future sprint.

---

### Verification

1. Click logo+Dashboard heading → resets to Overview tab (no page reload)
2. Active member sees `MemberIdCard` with correct data; PDF download works
3. How It Works modal opens from quick action, 3-card layout renders, CTA buttons switch tabs, FAQ accordion works, mobile-responsive
4. Manage Plans page: view current plan, upgrade/downgrade/cancel options functional
5. Pricing displays: $14.99/mo individual, $24.99/mo family, $164.89/yr, $274.89/yr; no ACH discount; annual says "1 Month Free"
6. Checkout creates correct Stripe session for individual vs family tier
7. Fulfillment PDF: 3-5 pages, "How to Use" cover letter, white-labeled card
8. **Regression:** Existing enrollment flow works; unauthenticated `/health/plans` and `/health/compare` pages unaffected

---

### Decisions

- **ACH:** Keep as payment method, same price as card (no discount)
- **Annual discount:** Buy 11 get 1 free (not 2 months)
- **Family tier:** Unlimited dependents under flat $24.99/mo
- **Browse + Compare Plans → Manage Plans** for authenticated members; originals stay for pre-enrollment
- **How It Works:** Modal for dashboard, standalone page persists for non-members
- **Apple/Android Wallet:** Research only this round
- **Careington API provider lookup:** Zip-based placeholder if API not ready

### Further Considerations

1. **Stripe product creation** — New family tier requires new Stripe products/prices (manual Dashboard task or API script) before checkout changes go live.
2. **`getCustomerDashboard` query** — Currently disabled (TODO in codebase). Must be implemented to power the membership card and manage plans with real subscription data. This is a prerequisite for Steps 4 and 6.
3. **Effective date logic** — Meeting discussed avoiding mid-month effective dates. Not scoped here but noted as a near-term follow-up affecting webhook processing in stripe/webhook/route.ts.