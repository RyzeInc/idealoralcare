### Direct answer

Design it like a **guided shopping experience**: a clean catalog with **plan comparison + bundles + trust cues**, a persistent **cart**, and a checkout flow that forces **cadence selection (monthly vs annual)** and **payment method (Card vs ACH discount)** before you ever hit Stripe.

---

### Assumptions

* Self-serve checkout (no sales rep required)
* Plans are understandable without medical underwriting
* You want “app-subscription simple” UX
* You’re selling multiple plan types (dental, wellness, chronic support, etc.)
* You want users to cancel individual plans at period end

---

## Recommended site structure (what the user sees)

### 1) Landing page

* One sentence value prop (non-insurance, subscription-based, immediate access)
* 3–5 benefit bullets (coverage type, savings type, support type)
* Trust strip (secure payments, cancel anytime, no hidden fees, support contact)

CTA → **Browse Plans**

---

### 2) Catalog page (the core)

**Left/center: plans**
**Right: sticky cart**

**Catalog controls**

* Search + filters:

  * Category (Dental / Wellness / Chronic / Vision / Rx / Telehealth)
  * “Best for” (Families / Individuals / Seniors / Fitness / Chronic)
  * Price range
* Toggle: **Monthly / Annual (save X%)**

  * This is a hard lock: changing it converts the cart or forces choice.

**Plan cards (each card shows only what matters)**

* Plan name + category tag
* Price (with cadence) + small “ACH saves $2/mo” note
* 3 key inclusions (not a paragraph)
* “Who it’s for”
* Buttons:

  * **Add**
  * **Compare**
  * “Details”

**Trust cues everywhere**

* “Not insurance” disclosure in a consistent location
* Cancellation policy (“access until end of billing period”)
* What happens after purchase (“we create your account instantly”)

---

### 3) Plan details page (optional, but recommended)

* Clear sections:

  * What you get
  * What you don’t get (avoid misinterpretation)
  * How to use it (activation steps, app access, support)
  * FAQ + disclosures
* Add-ons shown as “Recommended with this plan”

  * Dental → add Vision / Rx savings / Wellness coaching
  * Chronic support → add Telehealth / Labs discounts

---

### 4) Compare view (high conversion)

* Table comparing 3–5 plans max
* Rows should be “meaningful outcomes,” not fine print:

  * Access type, support type, discounts, household members, etc.
* “Add to cart” buttons on each column

---

### 5) Checkout flow (where Stripe steps in at the end)

**Step 1: Account**

* Email, password OR magic link
* Minimal fields

**Step 2: Billing choices**

* Cadence confirmed (monthly or annual)
* Payment method:

  * Card
  * **Pay by bank (ACH) — save $2/month**
* Show “What you’ll pay today” + “Renews on…”

**Step 3: Review**

* List of plans (line items)
* Total today
* Recurring total
* Cancellation policy
* Then → Stripe Checkout / Elements

---

## Backend model (what you store)

You need three tables/concepts:

1. **CatalogProduct**

* slug, title, category, description
* monthlyPriceCard, monthlyPriceACH
* annualPriceCard, annualPriceACH
* eligibility/disclosure text

2. **SubscriptionBundle**

* customerId
* cadence (monthly/annual)
* stripeCustomerId
* stripeSubscriptionId
* status

3. **Entitlements**

* customerId
* productId
* status: active | cancel_at_period_end | expired
* periodStart / periodEnd
* sourceSubscriptionItemId

This is what enables “cancel one plan but keep access until period end.”

---

### Tradeoffs / risks

* If you don’t lock cadence early, users will build mixed carts and you’ll have checkout chaos.
* Too much plan text kills conversions; keep detail pages for depth.
* “Non-insurance” needs consistent disclosure placement to avoid confusion and charge disputes.
* ACH discount is great, but bank verification friction can reduce checkout completion.


Below is a complete **page-by-page user flow** for a self-serve non-insurance plan catalog with **one cadence per customer (monthly OR annual)**, **ACH discount**, **one consolidated invoice**, **immediate activation**, and **plan-level cancel-at-period-end**.

---

### Assumptions

* Users buy plans like “apps” (simple subscription commerce)
* Pricing is public
* Plans are non-insurance and must be clearly disclosed
* One account = one active subscription bundle
* Users can add/remove plans; changes take effect next renewal (no proration)

---

## Full user flow, page by page

## 0) Entry points (how they arrive)

**Sources:** ads, SEO, partner link, “recommended plan” deep link, QR code.

**Routing rules**

* Deep link to a plan detail page is allowed.
* If they add to cart from a deep link, they’re taken back into the catalog with cart open.

---

## 1) Home page

**Goal:** explain “what this is” in 10 seconds and drive to catalog.

**Sections**

1. Hero

   * Headline: “Health plans you can start today — not insurance.”
   * Subheadline: “Pick what you need. Cancel anytime. Keep access through your paid period.”
   * Primary CTA: **Browse Plans**
   * Secondary CTA: **How it works**
2. Category tiles (4–6)

   * Dental / Wellness / Chronic Support / Vision / Rx Savings / Telehealth
3. “How it works” strip (3 steps)

   * Choose plans → Checkout → Immediate access + monthly/annual renewal
4. Trust strip

   * Secure payments, support, cancel policy, disclosure
5. FAQ preview
6. Footer disclosure block (“Not insurance”, limitations, contact)

---

## 2) How it works page

**Goal:** remove doubt, prevent “insurance expectations,” explain lifecycle.

**Sections**

* What these plans are / aren’t (two-column)
* What happens after you pay (immediate account creation + activation)
* Billing rules:

  * One cadence per account
  * No proration
  * Cancel plan → active until period end
  * ACH discount explanation (“Pay by bank to save $2/mo”)
* Support & disputes policy
* CTA: **Browse Plans**

---

## 3) Catalog page (primary conversion page)

**Layout:**
Left: filters + results
Right: sticky cart drawer

### 3A) First-time modal (only on first visit)

* “Choose billing cadence”

  * **Monthly**
  * **Annual (save X%)**
* Small note: “You can change cadence later by ending current cycle and switching.”

**Cadence becomes a session-level lock**.

### 3B) Filters (left rail)

* Category
* “Best for” (Individuals/Families/Seniors/Fitness/Chronic)
* Price range
* “Includes” tags (telehealth, coaching, discounts, etc.)

### 3C) Plan cards (grid/list)

Each card shows:

* Name + category tag
* Price based on cadence
* Toggle note: “Pay by bank (ACH) saves $2/mo”
* 3 bullets: inclusions
* “Best for”
* Buttons:

  * **Add**
  * **Details**
  * **Compare**

### 3D) Recommendation rails (inside catalog)

As user scrolls or adds:

* “Commonly paired with…”
* “If you chose X, consider Y…”

### 3E) Sticky cart (right)

Cart shows:

* Selected cadence (Monthly/Annual) with “Change” link
* Payment method selector:

  * Card (standard price)
  * **Pay by bank (save $2/mo)**
* Line items (plans)

  * Each shows:

    * name
    * price
    * remove icon
* Totals:

  * **Due today**
  * **Renews on [date]**
  * **Recurring total**
* CTA: **Checkout**
* Small policy lines:

  * “Cancel a plan anytime—keeps access through period end.”
  * “Not insurance.”

### 3F) Guardrails on cadence changes

If cart not empty and user clicks “Change cadence”:

* Modal:

  * “Switching cadence will replace your cart prices.”
  * Options:

    * Switch + update prices
    * Cancel

---

## 4) Compare page

**Goal:** reduce indecision for similar plans.

* Select up to 4 plans
* Table:

  * rows = outcomes (not fine print)
  * “Add” buttons per column
* Persistent cart on right remains visible

CTA: **Checkout**

---

## 5) Plan detail page

**Goal:** answer objections and clarify non-insurance.

**Sections**

1. Summary + price
2. “What you get” (bulleted)
3. “What you don’t get” (bulleted)
4. “How to use it” (steps)
5. Recommended add-ons (1–4)
6. FAQs
7. Disclosures

Buttons:

* **Add to cart**
* “Back to catalog”

---

## 6) Account creation / Sign in

Triggered by clicking Checkout.

**Page options**

* Email + password
* Magic link (optional)
* “Continue as guest” (not recommended if you’re provisioning accounts)

You should push: **Create account now** because activation is immediate and ongoing.

---

## 7) Checkout review (your page, before Stripe)

**Goal:** confirm everything and reduce charge disputes.

Shows:

* Cadence (Monthly/Annual)
* Payment method selection (Card vs ACH discount)
* Full list of plans
* Total due today
* Renewal date and recurring total
* Disclosures + cancellation policy checkbox:

  * “I understand this is not insurance.”
  * “I understand canceling keeps access until period end.”

CTA: **Proceed to secure payment**

---

## 8) Stripe Checkout (payment collection)

**Stripe’s job:** collect payment + create subscription + attempt charge.

User sees:

* Total due today
* Recurring total
* Payment method (card or ACH)
* Confirmation

---

## 9) Payment processing state page (your “handoff” screen)

**Goal:** handle async edge cases smoothly.

States:

* **Success (instant)** → “Activating your plans…”
* **Requires action** (3DS) → prompt
* **ACH verification pending** (if applicable) → clear message:

  * If you allow immediate activation: “Activated now; bank confirmation may take a few days.”
  * If you require verification: “Activation starts once bank is confirmed.”

---

## 10) Success page (post-payment)

**Goal:** immediate gratification + next steps.

Shows:

* “You’re active”
* Plans activated (badges)
* Renewal date
* Buttons:

  * **Go to Dashboard**
  * “Download receipt”
  * “Manage plans”

---

## 11) Member dashboard (home)

**Goal:** central hub for access and management.

Top section:

* Status: Active
* Cadence
* Next renewal date
* Payment method
* Billing history link

Plans section (cards or table):
Each plan shows:

* Status: Active / Cancels on [date]
* “How to use” link
* “Get started” button
* “Cancel plan” button

Add plans:

* “Browse more plans” → returns to catalog with cadence locked

Support strip:

* Chat / email / phone
* “Report an issue”

---

## 12) Manage plans page (focused management)

**Goal:** plan-level changes with no proration.

Actions:

* Add new plan (effective next renewal if you want no proration)
* Cancel plan:

  * Confirmation modal:

    * “You’ll keep access until [date].”
  * Result: plan shows “Cancels on [date]”
* Reactivate plan (if within current period):

  * “Restore for next renewal” or “restore immediately next cycle”

**Important UI note:**
Since there is no proration, the clean rule is:

* **Adds** take effect **next renewal**
* **Cancels** take effect **end of period**
  (You can still *show* the price impact immediately, but label it “starts next billing cycle.”)

---

## 13) Billing page

Shows:

* Invoice history
* Current subscription summary
* Update payment method
* Switch cadence (monthly ↔ annual)

**Switch cadence flow**

* User selects new cadence
* System message:

  * “Your new cadence will start on [date] after your current period ends.”
* Optional: allow “Switch now” (but that implies proration; you said no proration, so default to switch-at-renewal)

---

## 14) Cancellation (full account)

If they cancel all plans:

* They’re effectively canceling the subscription bundle at period end.
* Dashboard shows:

  * “All plans cancel on [date]. You keep access until then.”

---

### Tradeoffs / risks

* If you allow adding plans mid-cycle with no proration, you must clearly message “starts next renewal” or you’ll trigger charge disputes.
* ACH discount is great, but bank verification adds friction—expect lower conversion unless the savings is visible early.
* “Not insurance” must be consistent on every step to reduce misunderstandings and payment disputes.

**visual UI reference images** for the full flow, not AI art files or code. Below is a **page-by-page visual set** you can hand to a designer or use as direct inspiration. These are **style-aligned reference images** (clean, healthcare-adjacent, SaaS-simple, trust-forward).

I’m structuring this exactly to match the flow we designed. See contents of /public/health-assets/Catalog Flow/Reference Images/

---

## 1) Home / Entry Page (Trust + Direction)

**Visual goals**

* Calm, credible, not insurance-looking
* White space, soft gradients, restrained color
* No “urgent sales” energy

---

## 2) How It Works Page (Expectation Setting)

**Visual goals**

* Step-based layout (icons + short copy)
* Heavy emphasis on clarity
* Repeated “Not insurance” disclosure placement

---

## 3) Plan Catalog (Core Experience)

**Visual goals**

* Card-based plans
* Category tags
* Visible pricing
* Obvious “Add” actions

---

## 4) Persistent Cart (Right Rail)

**Visual goals**

* Always visible
* Cadence selector (Monthly / Annual)
* Payment method toggle (Card vs ACH Discount)
* Clear totals + renewal date

---

## 5) Plan Detail Page (Depth Without Overwhelm)

**Visual goals**

* Sectioned layout
* “What you get / What you don’t”
* Add-ons surfaced as recommendations
* Strong trust & compliance tone

---

## 6) Compare Plans View (Decision Accelerator)

**Visual goals**

* Outcome-focused rows
* 3–5 plans max
* Direct “Add to cart” from table

---

## 7) Account Creation (Minimal Friction)

**Visual goals**

* Few fields
* Friendly tone
* No dark patterns

---

## 8) Checkout Review (Before Payment)

**Visual goals**

* Everything summarized
* No surprises
* Clear policy acknowledgments

---

## 9) Payment Collection (Stripe-style UX)

**Visual goals**

* Security cues
* Simple fields
* ACH discount visibly reinforced

---

## 10) Success / Activation Page

**Visual goals**

* Immediate reassurance
* Clear next steps
* “Go to dashboard” CTA

---

## 11) Member Dashboard (Control Center)

**Visual goals**

* Status clarity
* Plan list with actions
* Billing visibility without stress

---

## 12) Manage Plans (Cancel-at-Period-End UX)

**Visual goals**

* Calm cancellation language
* “Active until [date]” badges
* Re-add / restore options

---

## 13) Billing & Invoices

**Visual goals**

* Transparency
* Downloadable receipts
* Payment method updates

---

## 14) Full Account Cancellation State

**Visual goals**

* Respectful tone
* No scare tactics
* Clear access end date

---

### What this gives you

* A **complete visual language** for Nexus-style non-insurance plans
* Consistent expectations across legal, billing, and UX
* A layout Stripe integrates into *without* owning your product logic


## **What You're Creating**

You're building a **digital marketplace for non-insurance health and wellness plans** that combines:

1. **A retail-style catalog UX** where users can browse, compare, and "add to cart" like e-commerce
2. **Subscription-based access** to various health-related services (dental, wellness, chronic condition support, etc.)
3. **A simplified enrollment flow** that feels like buying an app subscription (no medical underwriting, instant access)
4. **An architectural foundation** where:
   - Stripe handles only billing
   - Your system manages catalog, entitlements, and access
   - Users have exactly one subscription bundle (monthly OR annual) with multiple plan line items
   - No proration, cancel-at-period-end, immediate activation

## **What You're Selling**

### **Core Product**
- **Non-insurance health/wellness plans** (8+ categories like dental, vision, telehealth, chronic support, wellness coaching, Rx savings)
- **Subscription access** to services, discounts, or digital tools
- **Immediate activation** upon payment (no waiting periods)

### **Key Characteristics**
1. **Not insurance** but health-adjacent benefits
2. **Fixed-price subscriptions** (monthly or annual)
3. **Bundled offerings** (users can add multiple plans to one subscription)
4. **Self-serve enrollment** (no sales reps required)
5. **Transparent pricing** (visible, with ACH discount option)

### **Target Audience**
- Individuals/families seeking supplemental health benefits
- People who want simple, digital-first health solutions
- Customers who understand this is NOT traditional health insurance
- Those willing to pay for convenience and immediate access

### **Value Proposition**
- **Simplicity**: "Add to cart" enrollment vs. complex insurance applications
- **Flexibility**: Mix-and-match plans based on needs
- **Accessibility**: No medical underwriting, instant activation
- **Cost predictability**: Fixed monthly/annual pricing
- **Transparency**: Clear cancellation policies (access until period end)

### **Business Model**
- **Recurring revenue** via subscriptions
- **Volume-based** (more plans = higher MRR per customer)
- **Low-touch sales** (primarily self-serve)
- **High retention focus** (cancel-at-period-end reduces churn friction)

## **The "Why" Behind Your Questions**

You're asking about **Stripe vs. enterprise processors** because you're thinking ahead about:
- **Scale**: What works at 1,000 customers vs. 100,000
- **Compliance**: Navigating "non-insurance" regulations
- **Flexibility**: Need to adapt plans/pricing without technical debt
- **User experience**: Making enrollment feel simple while handling complex backend logic

## **What Makes This Unique**

You're **NOT** creating:
- Traditional health insurance
- A complex benefits administration platform
- A broker/marketplace for third-party insurance
- A claims processing system

You **ARE** creating:
- A consumer-friendly gateway to health services
- A subscription model for health benefits
- A tech-enabled alternative to confusing health plans
- A system that prioritizes UX over legacy insurance complexity

## **Critical Success Factors (Based on Our Discussion)**

1. **Clear communication**: "Not insurance" must be unmistakable
2. **Architectural separation**: Billing (Stripe) ≠ product logic (your system)
3. **Simple rules**: One cadence, no proration, cancel-at-period-end
4. **Trust through transparency**: No hidden fees, clear cancellation
5. **Scalable foundation**: Can handle 8 plans today, 80 tomorrow


**Am I correct?** This is Ideal Health or a similar digital-first health benefits platform that makes supplemental health services as easy to buy as Netflix.