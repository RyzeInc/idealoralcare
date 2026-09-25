# Preventative Care Shop — Design

## Purpose

A curated, publicly browsable catalog of preventative oral- and self-care
products that Ideal does not sell, stock, or ship. Every item links out to a
third-party merchant through an affiliate link. Revenue is commission on
referred sales.

The shop is a **retail surface that sits beside the plan catalog, never inside
it**. It is not a plan, not a benefit, not an entitlement, and not a reason to
enroll. See "Hard rules" below — those constraints drive most of the design.

Implementation: `convex/shop/`, `src/app/health/shop/`,
`src/app/[siteSlug]/shop/`, `src/app/admin/shop/`, `src/app/api/shop/`.

## What this is not

1. Not a storefront. No cart, no Stripe checkout, no inventory, no shipping,
   no returns, no sales-tax nexus. The merchant owns the transaction.
2. Not part of `catalogProducts`. Plans are entitlements with eligibility,
   disclosure text, and Stripe mappings. Shop items are outbound links. They
   share no lifecycle and must not share a table.
3. Not part of `nexusProducts`. That table is the B2B partner portal's vendor
   showcase. Overloading it would mix a consumer retail catalog into partner
   sales collateral.

## Hard rules

These are not preferences. Each one closes a specific legal exposure.

### 1. The shop is identical for members and non-members

No member-only pricing, no member-only products, no member discount codes, no
"unlocked by your plan" framing anywhere in the UI or copy.

Ideal sells dental **discount** plans — explicitly not insurance, with
membership agreements and disclosure text carried on every
`catalogProducts` row. Offering goods of value that are contingent on, or
priced by, plan enrollment is the shape of an unlawful inducement under state
insurance rebating/inducement statutes. If a Medicare- or Medicaid-eligible
person ever enrolls, the federal beneficiary-inducement analysis applies too.

An identical public experience makes the question moot: nothing is being given
in exchange for enrollment because enrollment changes nothing.

### 2. No therapeutic or health claims in product copy

Descriptions state what a thing *is*, not what it *cures*. "Nano-hydroxyapatite
toothpaste, fluoride-free" is fine. "Prevents cavities", "reverses gingivitis",
"treats periodontal disease" are not — those are disease claims that convert a
cosmetic into an unapproved drug claim and are independently actionable as
deceptive advertising.

Admin copy fields must be reviewed on this basis before a product goes visible.

### 3. No personalization from clinical data

`toothlensScans` holds AI oral-scan findings. Do not use it — or any member
health data — to select, rank, or recommend shop products. Recommendation
driven by clinical findings is a use of health information that the current
member-facing consent and privacy posture does not cover, and it edges the
shop back toward being a treatment recommendation.

MVP recommendation logic is category and editorial order only.

### 4. Physical goods people use at home — nothing else

The shop stocks things a person actually uses: toothbrushes, floss, paste,
rinse, water flossers, whitening, kids' gear. That is the entire scope.

Explicitly excluded are affiliate programs for *savings plans and services* —
dental discount plans, at-home lab panels, and the like. Several pay very well
(dental plan programs run 30%), but they sell against `catalogProducts` and one
of them is a vendor we already buy fulfillment from. Promoting them means
paying ourselves a commission to lose a plan sale.

`assertUsableAffiliateUrl` in `convex/shop/admin.ts` blocks the known ones by
domain so this can't be added by accident later. It is a scope guard, not a
judgment about the merchants.

### 5. Disclosure is on-page, above the links, and unconditional

FTC: a disclosure must be noticed, read, and understood without any user
action — no scrolling, hovering, clicking, or expanding to reveal it. It goes
on the same page as the links and before the first product.

"Affiliate link" alone is **not** adequate per current FTC guidance. "Paid
link" adjacent to the link is adequate. The shop uses a persistent banner at
the top of the grid plus a per-card marker.

### 6. Per-site opt-out

White-label partners inherit our pages. Some will have their own compliance
posture that forbids affiliate retail. `sites.shopEnabled` defaults to false;
the shop renders only where a site has explicitly turned it on.

### 7. One switch takes the whole shop down

Affiliate retail is the surface most likely to need to go dark at short
notice — a network terminating us, a merchant recalling a product, counsel
wanting the paid links gone while something is reviewed. That has to be one
click by an admin, not a deploy.

`shopSettings` (single row, key `"main"`) is that switch, flipped from the admin
Shop page. Off means: `/health/shop` 404s, every tenant shop 404s regardless of
its own `shopEnabled`, and **every public query in `convex/shop/queries.ts`
returns nothing**. Gating the data and not merely the route is the rule — a
route-only gate leaves the products one client call away.

Nothing is unpublished. Categories and products keep their own `isVisible`
state and the shop returns exactly as it was. Both flips are audited.

Its default is the inverse of rule 6's, deliberately: absent means **on**. The
shop was live before the switch existed, so a missing row is "nobody has touched
this", not "off". A false-by-default would have taken the storefront down the
moment this shipped. Rule 6 defaults closed because a partner site never had a
shop to lose; this one defaults open because ours did.

## Economics

There are three ways to monetize the same toothbrush, and the naive one is the
worst by an order of magnitude.

### Tier 1 — plain Amazon Associates: 3%

The base fixed rate for Health & Personal Care. A $40 electric brush earns
about $1.20. Additional terms that bite:

- **24-hour cookie**, and no credit on subscribe-and-save reorders after it —
  which is exactly the repeat behavior this category produces.
- **Requirement 6** prohibits Special Links in "any printed material, mailing,
  SMS, MMS, email or attachment to email, or other document." That rules out
  the welcome email, the member ID card PDF, and statements. (Third-party blogs
  claim an April 2026 carve-out for opted-in email; Amazon's own Participation
  Requirements page still carries the prohibition. Treat email as prohibited
  until Amazon says otherwise.)
- As of April 14 2026, purchases referred through **any paid or boosted
  advertisement** are disqualified regardless of keywords. No paid acquisition
  can point at an Amazon-linked page.
- New accounts are withdrawn automatically without **3 qualifying sales (three
  separate orders) in 180 days**, and a rejected Associates ID is not
  reinstated. Do not apply before the shop has traffic.

Use this tier only for long-tail items no better program covers.

### Tier 2 — brand-funded commission on Amazon: 13–28%

The same Amazon checkout, with a brand paying to be there.

- **Amazon Creator Connections** — brands layer 10–50% *on top of* the base
  Associates rate, campaigns running 30–365 days. A 10% campaign on a Health
  item nets 13% all in. Requires an Associates account in good standing, so
  Tier 1's 180-day trap still gates entry.
- **Levanta** — free to join, no commitments, runs on the Amazon Attribution
  API with direct brand relationships. Publishes Health & Wellness at 25%,
  averages ~20%, reaches 50%. Single monthly payout across all brands.

This tier is the strategic center of the shop. It pays like a direct program
while converting like Amazon, which matters more than the rate: a shopper who
already has an Amazon account and saved card converts far better than one
facing an unfamiliar DTC checkout.

Unverified and worth confirming before relying on it: Levanta runs on Amazon
Attribution rather than the Associates program, so the Associates paid-traffic
and email prohibitions may not apply to it. Do not assume they don't.

### Tier 3 — direct with the brand: 8–25%

Best margin control and longest windows, weakest conversion, most relationships
to manage.

| Merchant | Rate | Window | Platform |
|---|---|---|---|
| Oracoat (XyliMelts) | 25% | 90d | Direct |
| Smileactives | 20% | 28d | CJ Affiliate |
| Remi | 16% | 30d | ShareASale → Awin |
| Snow | 15% | — | ShareASale → Awin |
| Georganics | 10% | 30d | AWIN |
| GLO Science | 10% | 30d | ShareASale → Awin |
| Spotlight Oral Care | 10% | — | ShareASale → Awin |
| Sentinel Mouthguards | 10% | 45d | ShareASale → Awin |
| AuraGlow | 8% | 30d | CJ Affiliate |
| BURST | undisclosed | 30d | Impact (+ Creator Connections, TikTok Shop) |
| Waterpik | undisclosed | 45d | FlexOffers |
| Boka | undisclosed | — | Direct |

Most brands disclose rates only after approval, so treat the table as a
pipeline, not a forecast. BURST is the template worth copying: it runs Impact
for direct-to-site, Creator Connections for Amazon, and TikTok Shop
simultaneously, across toothbrushes, floss, paste, whitening, and water
flossers — the whole category map. Rates come from `affiliate@burstoralcare.com`.

ShareASale is migrating into Awin; new accounts launch on Awin, so apply there.

### Direction — Amazon-only, Levanta first

Build network-agnostic — `merchant` and `network` are per-product fields with
no special-casing, so any product can be repointed between tiers without a
migration. But **ship v1 pointing entirely at Amazon.**

Every brand worth carrying (Boka, BURST, Quip, Waterpik, GuruNanda, Cocofloss)
already sells on Amazon, so going direct means managing six relationships to
reach the same products. One merchant means one account, one link format, one
payout, one tax form — and Amazon's checkout converts far better than an
unfamiliar DTC cart, which outweighs a few points of rate. Tier 2 removes the
only real objection: 25% on Health & Wellness through Levanta, not 3%.

Sequence:

1. **Levanta first.** Free, minutes to join, no Associates dependency, best
   published rate for this category.
2. **Associates once the shop has traffic** — covers whatever Levanta's brand
   roster doesn't, and unlocks Creator Connections.
3. **Skip Awin, CJ, FlexOffers, and direct brand programs for v1.** Revisit
   only for a proven volume driver whose direct rate is materially better.

Never point paid traffic at an Amazon-linked page (Tier 1, Apr 2026 term).

**Do not try to shortcut the 180-day / 3-sale gate.** Amazon disqualifies
"orders for products to be used by you, your friends, your relatives, or your
associates" and matches shipping addresses, cards, device IDs, and IPs.
Arranging purchases to clear the threshold is among the fastest routes to
permanent termination, a terminated Associates ID is never reinstated, and
losing it forfeits Creator Connections access for good. The sequence above
avoids the problem entirely: Levanta needs no Associates account, and once
there is organic traffic the three orders arrive on their own.

Every merchant reviews the live site before approving, so the shop and its
disclosure must ship before the applications go out. The existing
`/health/blog` content is a real asset for approval — reviewers check content
depth and topical relevance, and a bare affiliate grid gets rejected.

## Data model

Three new tables, defined inline in `convex/schema.ts` alongside every other
table. The network union lives in `convex/shop/constants.ts` and is imported by
the schema, so the validator and the admin dropdown share one source of truth.

(A separate `convex/shop/tables.ts` was the first instinct, but
`convex/catalog/products.ts` shows how that goes wrong here — it exports a
table definition that `schema.ts` never imports, so it is dead code that reads
authoritative.)

### shopCategories

Editorial grouping — "Daily Care", "Interdental", "Whitening", "Kids",
"Dry Mouth". Mirrors the shape of `nexusCategories` so the admin UI feels the
same: `name`, `slug`, `description`, `icon` (Lucide name), `order`,
`isVisible`, timestamps.

Indexes: `by_slug`, `by_visible`, `by_order`.

### shopProducts

- **Identity** — `categoryId`, `name`, `slug`, `brand`
- **Copy** — `shortDescription` (card), `description` (detail),
  `highlights: string[]`
- **Imagery** — `imageUrl` or `imageStorageId` (Convex storage)
- **Affiliate** — `affiliateUrl` (the fully tagged destination),
  `merchant` (display name, e.g. "Amazon", "Boka"),
  `network` (`"amazon" | "shareasale" | "cj" | "impact" | "awin" |
  "flexoffers" | "levanta" | "direct" | "other"`),
  `commissionRate` (optional, percent, internal only — never rendered),
  `cookieWindowDays` (optional, internal only)
- **Price display** — `priceCents` + `priceCapturedAt`. A *snapshot for
  display only*, always rendered as "about $X" with an "price at merchant"
  qualifier, because we do not control merchant pricing. Amazon's terms
  prohibit displaying stale scraped prices as current; the qualifier and the
  captured-at stamp are how we stay honest. No automated price scraping in MVP.
- **Merchandising** — `order`, `isVisible`, `isFeatured`
- **Counters** — `clickCount`, `lastClickedAt` (denormalized for admin lists)
- **Audit** — `createdAt`, `updatedAt`, `createdBy`, `updatedBy`

Indexes: `by_category`, `by_slug`, `by_visible`, `by_featured`, `by_order`,
`by_network`.

### shopClicks

Append-only outbound-click log. This is the only attribution data we control —
affiliate networks report conversions but not our own funnel.

`productId`, `productSlug` (denormalized so the row survives product deletion),
`siteSlug` (which tenant), `network`, `clerkUserId` (optional — recorded when a
logged-in member clicks, for funnel analysis only, never for personalization),
`referrerPath`, `createdAt`.

Indexes: `by_product`, `by_created`, `by_site`.

No IP or user-agent storage. There is no product need for it and it is
needless PII.

### sites.shopEnabled

`v.optional(v.boolean())`. Absent or false means the shop 404s for that site.
Per hard rule 6.

### shopSettings

The storefront kill switch, per hard rule 7. Single document, `key: "main"`:
`isEnabled`, `updatedAt`, `updatedBy`. Index: `by_key`.

**A missing row means enabled.** `resolveShopEnabled()` in
`convex/shop/queries.ts` is the one place that decides this; read the switch
through `readShopEnabled()` rather than querying the table, so the default can
never drift between call sites.

## Surfaces

| Route | Purpose |
|---|---|
| `src/app/health/shop/page.tsx` | Public storefront. No auth. `force-dynamic`, because a kill switch resolved at build time would only take effect on the next deploy. 404s when the switch is off; fails **open** on a Convex error — it is our own live page, and the queries gate the data anyway. |
| `src/app/[siteSlug]/shop/page.tsx` | Tenant storefront. **Not** a bare re-export like `[siteSlug]/plans` — it resolves the site server-side and 404s unless `shopEnabled` is true, failing closed if the lookup errors. |
| `src/app/admin/shop/page.tsx` | Storefront switch + category and product CRUD (`ShopAdmin.tsx`). |
| `src/app/api/shop/click/route.ts` | Click beacon. |

All categories render on one page, each as its own section anchored by slug.
A per-category route is not built; add it if a category outgrows the section.

Styling reuses `health.css` glassmorphism (`glass-card`) so the shop reads as
part of the same brand without new design tokens.

Nav: a "Shop" entry in `HealthHeader` — a top-level item, deliberately *not*
inside the Services dropdown, because Services are plan benefits and the shop
must never read as one. It disappears when the switch is off, so the nav never
points at a 404; while the switch is still loading the link renders, since on is
the ordinary case and a link that blinks in on every page load is worse. Admin entry sits in the Finance group of
`AdminSidebar.tsx`.

## Click tracking

The card renders the **real tagged `affiliateUrl`** as a normal `<a href>` with
`target="_blank" rel="sponsored noopener noreferrer"`. `rel="sponsored"` is the
correct signal for paid links and protects the site's SEO standing.

Attribution is recorded by a fire-and-forget `navigator.sendBeacon` to
`/api/shop/click` on click, which writes a `shopClicks` row and bumps the
product counters.

**Deliberately not a redirect.** A `/api/shop/click/[id]` → 302 pattern is
tempting because it guarantees capture, but routing affiliate traffic through
an intermediate hop is link cloaking under several networks' terms — including
Amazon's — and risks the account. Losing the small fraction of clicks where the
beacon fails is the correct trade.

## Out of scope for MVP

Automated price/availability refresh via PA-API or network feeds; conversion
import from network reports; A/B testing of curation; member wishlists;
editorial/blog integration; any recommendation engine.

## Open questions

1. Which networks do we hold approved accounts on today? Nothing ships until at
   least one is live and we have a tagged URL to seed.
2. Does legal want to review the disclosure banner copy before launch? Assume
   yes.
3. Should `/health/shop` be indexable? Default yes — organic traffic is the
   point — but it needs a decision from whoever owns SEO, since a thin
   affiliate catalog can drag on domain quality if it stays small.
