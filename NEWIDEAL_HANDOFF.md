# New Ideal Health — Handoff

**Commit:** `420d40f` on `main` (force-amended from the original `newideal` commit
to drop two oversized video files; safe because nothing had been pushed yet).
**Date:** 2026-05-28

---

## 1. What shipped

A complete `/newideal` consumer-facing experience for the **New Ideal Health**
white-label site (`getidealhealth.com` brand), built on the existing Convex +
Stripe foundation.

### Routes
| Path | Purpose |
|---|---|
| `/newideal` | Marketing landing page (hero, stats bar, program cards, coverage strip, CTA) |
| `/newideal/essentials` | Essentials Plan brochure page |
| `/newideal/oralcare` | Oral Care brochure page (no enrollment yet — see §4) |
| `/newideal/plans` | Catalog page with tier picker + sticky cart |
| `/newideal/checkout` | Checkout form (legal acknowledgements, payment) |
| `/newideal/success` | Post-checkout confirmation |

### Shared components
- [src/components/newideal/NewIdealChrome.tsx](src/components/newideal/NewIdealChrome.tsx) — `NewIdealHeader` + `NewIdealFooter`
- Logo: [public/newideal/logo.png](public/newideal/logo.png)

### Layout / providers
- [src/app/newideal/layout.tsx](src/app/newideal/layout.tsx) imports `@/app/health/health.css` and wraps children in `SiteThemeProvider defaultSlug="newideal"` + `CartProvider`.

---

## 2. Visual design

The landing page was redesigned to match the original Ideal Health brand:

- **Hero** — full-bleed teal-to-navy gradient (`#0c4a6e → #0369a1 → #0e7490`) with a 12%-opacity background photo and a radial teal glow.
- **Accent color** — orange `#f97316 / #fb923c` (matches the original brand bird logo).
- **Stats bar** — dark teal strip under the hero with orange numbers.
- **Program cards** — gradient-colored card headers (blue for Essentials, sky for Oral Care) with a white body containing the feature checklist.
- **Coverage strip** — dark teal section with orange-tinted icon tiles.
- **CTA** — 5 orange stars, bold headline, orange button.

All CSS variables live in [src/app/health/health.css](src/app/health/health.css).

---

## 3. Stripe + Convex wiring

### Catalog products (Convex)
Seeded by [convex/admin/seedNewIdeal.ts](convex/admin/seedNewIdeal.ts):

| Slug | Tier | Price |
|---|---|---|
| `essentials-employee` | Employee | $57.95/mo |
| `essentials-employee-spouse` | Employee + Spouse | $65.95/mo |
| `essentials-employee-child` | Employee + Child | $77.95/mo |
| `essentials-employee-family` | Employee + Family | $82.95/mo |

### Stripe products (LIVE)
The Stripe CLI script didn't work — Nellus created products manually:

| Stripe Product ID | Used by |
|---|---|
| `prod_UbJ4z3XbJjbP9s` (Ideal Essentials Plan) | All 4 `essentials-*` tiers |

The Stripe product holds 4 prices ($57.95 / $65.95 / $77.95 / $82.95 per month). The checkout API (`src/app/api/stripe/checkout/route.ts`) references the Stripe product via `price_data.product` and supplies `unit_amount` from the Convex catalog row, so a single Stripe product can serve all 4 tiers.

### Mutations available
```bash
# Seed catalog + site/account/group
npx convex run admin/seedNewIdeal:seedNewIdeal

# Attach Stripe product IDs (already run for Essentials)
npx convex run admin/seedNewIdeal:setNewIdealStripeIds \
  '{"mapping": {"essentials-employee": "prod_UbJ4z3XbJjbP9s", ...}}'

# Remove deprecated Financial Shield products (already run)
npx convex run admin/seedNewIdeal:removeFinancialShield
```

---

## 4. Decisions made this session

### Financial Shield was removed
Originally three programs (Essentials, Financial Shield, Oral Care). User confirmed scope is **Essentials Plan + Oral Care only**. The following were removed:

- `/src/app/newideal/financial-shield/` route (deleted)
- Nav + footer link
- Hero program card on `/newideal`
- "Compare with Financial Shield" cross-link on Essentials page
- "Bundle with … Financial Shield" line on Oral Care page
- `Financial Shield` group on `/newideal/plans`
- Checkout disclosure copy
- 4 `financial-shield-*` catalog products (deleted via `removeFinancialShield` mutation)
- `SHIELD_TIERS` / `SHIELD_INCLUSIONS` from the seed
- 4 shield entries from `scripts/create-newideal-stripe-products.sh`

**The Stripe product `prod_UbJ5L3icprUcAb` ("Ideal Financial Shield") is orphaned.** Archive it in the Stripe dashboard when convenient.

### Hero copy
"One membership. **Two powerful programs.**" (was "Three").

### Oral Care is brochure-only
The Oral Care page exists but has **no catalog products / no pricing / no enrollment path**. The plans page shows only Essentials tiers. To make Oral Care purchasable later:
1. Add `ORALCARE_TIERS` + `ORALCARE_INCLUSIONS` to the seed (mirror the Essentials shape)
2. Add a Stripe product + prices
3. Run `setNewIdealStripeIds` with the new mapping
4. Add an `Oral Care` entry to `PLAN_GROUPS` in `src/app/newideal/plans/page.tsx`

---

## 5. Repo hygiene fix in this commit

Two oversized video files were tracked in git and got rejected by GitHub:

- `Notes/GIH Notes/idealassets/Videos/03 - RxV2408PR Portal How-to Video Presentation FINAL.mp4` (127 MB)
- `Notes/GIH Notes/idealassets/Videos/04 - quest_select.mp4` (57 MB)

Both were `git rm --cached`'d (still present on disk) and the following lines were appended to `.gitignore`:

```
Notes/GIH Notes/idealassets/Videos/
*.mp4
```

If you ever need those videos in source control, move them to Git LFS.

---

## 6. Open items / next steps

1. **Archive `prod_UbJ5L3icprUcAb`** in Stripe dashboard.
2. **Decide on Oral Care pricing** if you want to enable enrollment for it.
3. **Test the end-to-end Essentials enrollment** against the live Stripe product:
   - `/newideal/plans` → add a tier → `/newideal/checkout` → complete payment
   - Verify the webhook creates a `subscription` row in Convex tied to the right `catalogProducts._id`
4. **Confirm `getidealhealth.com` DNS** points to the deployment and that the `newideal` site slug resolves correctly through `SiteThemeProvider`.
5. **The seed script's `branding.primaryColor` is `#1e3a5f`** but the new design uses `#0c4a6e` for hero. Either re-run seed with the updated palette or update the values in `seedNewIdeal.ts` if you want the SiteTheme branding tokens to match.

---

## 7. Useful files at a glance

| File | What it does |
|---|---|
| [src/app/newideal/page.tsx](src/app/newideal/page.tsx) | Landing page (redesigned this session) |
| [src/app/newideal/plans/page.tsx](src/app/newideal/plans/page.tsx) | Catalog + cart |
| [src/app/newideal/checkout/page.client.tsx](src/app/newideal/checkout/page.client.tsx) | Checkout form |
| [src/components/newideal/NewIdealChrome.tsx](src/components/newideal/NewIdealChrome.tsx) | Header + footer |
| [src/app/api/stripe/checkout/route.ts](src/app/api/stripe/checkout/route.ts) | Creates Stripe Checkout Session from cart |
| [convex/admin/seedNewIdeal.ts](convex/admin/seedNewIdeal.ts) | Seed + Stripe ID mapping + cleanup mutations |
| [convex/schema.ts](convex/schema.ts) | `catalogProducts.stripeProducts` shape (line ~425) |
| [scripts/create-newideal-stripe-products.sh](scripts/create-newideal-stripe-products.sh) | Stripe CLI bulk creator (didn't work — products were made manually) |
