[Folder Images]
My Prompt: Analyze the enrollment flow for a person that signs up with a sales person in store at crunch fitness. The pictures are in order. Can you review the specific architecture, layouts, designs, and everything that we can see from the buildouts of these pages and prepare them for me in a in depth analysis?

ChatGPT Response: Below is what the in-store, salesperson-led enrollment flow is doing **as a UI system**, based strictly on what’s visible in your screenshots (in order). I’m going to treat this like a product teardown: **information architecture → interaction flow → page layouts/components → visual system → operational implications → friction points.**

---

## 1) High-level flow architecture (what the system *is*)

This isn’t a single “signup page.” It’s a **multi-module web app** that mixes:

* **Guest intake (kiosk-ish)**: fast capture + waivers + signature
* **Lead/guest workstation modal (staff control)**: “claim guest,” assign staff, start pass, and route into actions
* **A sales presentation + product configuration wizard**: “what makes Crunch different,” add-ons, plan compare, then a multi-step checkout (profile → recurring payment → due today → contract signature)

It’s designed for **a desk computer** where the salesperson drives most steps, with periodic “hand the mouse/tablet to guest” moments for **signature**.

---

## 2) Interaction architecture (state machine view)

### Phase A — Guest record creation / retrieval

1. **Guest Sign In landing**

   * Choice: **New guest** vs **Returning guest**
   * Big centered CTAs (built for speed, low reading)

2. **New guest intake form**

   * Minimal required PII: name, email, phone, DOB, gender
   * **DOB validation requirement** (“must match ID”)
   * **Signature pad** + **waiver agreements** (guest/tanning/communications)
   * “Are you a guest with a member?” (branching flag; likely affects attribution/referral)

3. **Guest workstation modal (staff operations)**

   * After guest exists, system surfaces a **staff-facing control hub**
   * Actions visible:

     * Select staff member → **Claim Guest**
     * Buttons: **Tour & Memberships**, **Schedule Appointment**, **Complete Registration**
     * Guest pass history + expiry
     * Choose guest pass → **Start Guest Pass**
   * This is basically a **lead routing + next-action router**.

### Phase B — Sales enablement + plan selection

4. **“What makes Crunch different?” slide**

   * A sales deck page embedded in the flow (feature tiles)
   * Navigation implies a “presentation” step before pricing

5. **Membership Add-ons**

   * Upsell cards (e.g., digital product + childcare)
   * Clear accept/decline per add-on category

6. **Membership Plans compare**

   * Tier comparison table + payment option selector + discount application
   * Shows **monthly dues + annual fee + due-today breakdown** with strikethrough promo math
   * Can’t proceed without selecting a guest (system message indicates dependency)

### Phase C — Checkout wizard (data + payments + contract)

7. **Member profile details**

   * Personal info + address + emergency contact + employer + “how heard”
   * “Take photo” action (profile image capture)

8. **Recurring payment method**

   * ACH default (checking/savings + routing/account + confirm)
   * Link to use credit/debit card instead
   * Right-side summary: monthly total + annual fee timing

9. **Payment due today**

   * Card entry for one-time transaction (even if ACH is set for recurring)
   * Order summary with promo math + final due today

10. **Contract terms + member signature**

* Checkbox to accept terms + text summary + signature pad
* Reinforces cancellation window + annual fee logic + autopay logic

---

## 3) Layout + component analysis (patterns across pages)

### Global navigation / modules

Top nav shows consistent modules:

* **Guests** (lead/guest intake)
* **Practice** (likely training/sandbox mode)
* **Language toggle**
* **Member Mgmt**
  This suggests the app is built as **separate routed sections** with shared header, not a single funnel page.

### Two distinct visual “themes”

You effectively have **two UIs** stitched together:

1. **Guest theme**: orange→red gradient background, centered hero layout, minimal chrome
2. **Membership/checkout theme**: white canvas, dense tables/forms, black header strip, more “enterprise SaaS” look

That usually implies either:

* Two different subsystems inside one product, or
* A legacy flow + a newer flow merged

### Common layout scaffolds

* **16:9 desktop-first** composition (wide, short pages; lots of horizontal space)
* **Two-column forms** (data left, summary right)
* **Bottom-right Next** pattern on wizard steps
* **Modal as a hub** (the “Claim Guest” screen is effectively a command center)

### Component inventory (what’s clearly implemented)

* Large CTA buttons (new/returning)
* Standard text inputs w/ placeholders
* Dropdown selects (gender, “how did you hear,” staff selector)
* Date picker (DOB)
* Signature pad canvas w/ Clear
* Checkbox list with “click to review & agree” links (waivers)
* Tier comparison table with collapsible rows (+ icons)
* Discount module (applied discount + “DISCOUNTS” button)
* Pricing breakdown tables with strikethrough + final numbers
* ACH masked fields + show/hide icons
* Credit card form with show/hide icon on sensitive fields
* Persistent order summary card on payment pages
* Photo capture button (camera integration)

---

## 4) Page-by-page teardown (your screenshots 1–10)

### 1) Guest Sign In (fork page)

**Design intent:** reduce choice to 2 actions, remove distractions.
**Layout:** centered logo + title + two equal-weight buttons.
**Operationally:** this is the “front door” for both walk-ins and returning leads.

**Potential issue:** no visible “staff login” or role separation here—if this is on a public-facing kiosk, the top nav implies broader access unless locked down by permissions.

---

### 2) New guest intake + waivers

**Information architecture:**

* PII capture (left/top)
* Signature + waiver confirmations (right)
* Referral attribution flag (“guest with a member?”)

**Notable design choices:**

* “Birthday must match ID” is explicit—reduces fake entries, but increases friction.
* Waivers are “click to review & agree” — good compliance posture **if** the click opens the content and is logged.

**UX friction:**

* No visible progress indicator (“Step 1 of 3”).
* The “guest with a member” question is binary; if “Yes” should likely trigger *member lookup*—not shown here.

---

### 3) Staff modal: claim + next actions + pass start

This is the most telling “architecture” page.

**It acts like a CRM mini-console:**

* Ownership: staff dropdown + claim
* Conversion actions: tour/memberships, schedule appointment, complete registration
* Utilization: guest pass history + expiry + start pass

**Why it exists:** It prevents unclaimed leads and forces attribution of the guest to a salesperson.

**Risk/friction:**

* Modal overlays the guest sign-in page, implying the funnel can “snap back” to the entry point underneath.
* If staff forget to claim, downstream attribution/commission could break.

---

### 4) “What makes Crunch different?” (embedded sales deck)

This is not a form page. It’s **sales collateral inside the funnel**.

**Layout:** large header + image tiles with labels.
**Intent:** standardize the pitch and visually sell value before showing price.

**Risk:** It’s a static grid; a salesperson will speed-click through unless it’s interactive (tap a tile → details). Not visible.

---

### 5) Membership Additions (upsell interstitial)

**Two-card choice architecture:**

* Each add-on is a “mini landing page” with:

  * value bullets
  * price
  * primary CTA (add) + secondary CTA (decline)

**Strength:** clean accept/decline is fast and reduces awkward selling.
**Weakness:** the “decline” button is as prominent as “add,” which can undercut attach rate unless salesperson frames it.

---

### 6) Membership Plans compare (tier/pricing engine)

This is the densest page.

**Structure:**

* Top: benefit comparison table
* Middle: payment option selector + discount application
* Bottom: due-today pricing math per tier + select buttons

**Key observation:** The system clearly supports **discounting and promo overrides**, and the UI communicates it via strikethrough → final.

**Friction risk:**

* This page is cognitively heavy (lots of numbers, small text).
* “No guest has been selected” indicates a hard dependency on a guest record; if the staff arrives here out of sequence, the funnel stalls.

---

### 7) Member profile details

**This is the “conversion” data page** that turns a guest into a member record.

**Data model implied:**

* Required: name, DOB, email, phone
* Optional/conditional: gender, referral source, emergency contact, employer
* Address normalized into (line1/line2/city/state/postal/country)
* Photo capture supported

**Friction risk:** employer + emergency contact can feel invasive if not clearly optional/required (not visually marked).

---

### 8) Recurring payment method (ACH default)

**Design intent:** set up autopay.

**Security pattern visible:**

* “eye” icons suggest masking/showing sensitive fields.
* Confirm account number reduces typos.

**Business intent:** ACH reduces processing fees vs card.
**UX risk:** Many users prefer card; the link is small and low emphasis.

---

### 9) Payment due today (one-time card transaction)

**Notable architecture:** You can have:

* Recurring payment method = ACH
* Due-today transaction = card
  That’s a real-world gym pattern: collect immediate funds by card while setting autopay by ACH.

**UI strength:** right-side summary makes totals explicit.
**UI risk:** promo math (strikethroughs) can look confusing or suspicious if the guest doesn’t trust the “why is it $0.02?” story.

---

### 10) Membership terms + signature

**Contract compliance page.**

* Checkbox gating (“agree to terms”)
* Short-form terms summary (autopay, 60-day cancellation logic, annual fee timing)
* Signature pad

**Risk:** The terms are text-dense and not scannable; most guests won’t read it, which can increase disputes later.

---

## 5) Design system critique (what’s working / what’s messy)

### What’s working

* Clear “fork” at the beginning (new vs returning)
* Strong attribution mechanics (claim guest)
* Dedicated upsell step (add-ons)
* Persistent price summaries on payment pages
* ACH + card split is operationally practical
* Signatures and waivers are integrated (no paper)

### What’s messy / inconsistent

* Two different themes (gradient kiosk vs white enterprise) breaks continuity
* Benefits/price table is dense; not kiosk-friendly
* Primary actions move around:

  * centered CTAs early
  * bottom-right next later
  * modal actions in the middle
* Some secondary actions are visually underweighted (e.g., switch to card)
* “Practice” being in the top nav is odd in production contexts (could confuse staff)

---

## 6) Operational implications (in-store reality)

This funnel is optimized for:

* **Speed at front desk** (guest intake)
* **Sales attribution** (claim guest)
* **Standardized pitch** (feature deck page)
* **Attach opportunities** (add-ons)
* **Controlled discounting** (promo engine)
* **Reduced payment failure** (ACH + confirm fields)
* **Legal defensibility** (waivers + terms + signatures)

Where it can fail operationally:

* Staff skipping steps and hitting “guest not selected” blockers
* Guests hesitating at invasive fields (employer/emergency contact)
* Confusion around promo math or strange due-today totals
* Long text terms increasing “I didn’t know…” disputes

---

## 7) One clarifying question (only because it changes the analysis)

Is this flow being run on a **public-facing kiosk** (guest drives) or on a **staff workstation** (staff drives and occasionally hands it over for signature)?
That determines whether the top navigation and density are “fine” (staff tool) or a serious UX/security problem (public kiosk).


My Reply: Staff drives and occasionally hands it over for signature.

ChatGPT Response: Got it — with **staff driving** and only handing over for **signatures (and ideally payment entry)**, the flow reads like a **sales workstation app** with a guest-intake “skin” up front, then a membership “checkout wizard” subsystem.

## 1) The real architecture you’re looking at (system-level)

This is not one funnel. It’s **three stitched subsystems**:

1. **Guest Intake (lead creation + legal)**

* Fast PII capture + required waivers + signature
* Optimized for speed and minimal reading (huge negative space, giant CTAs)

2. **Staff Workstation / Lead Router (ownership + actions)**

* A modal “control hub” that sits over the guest module:

  * assign/claim ownership to a staff member
  * start a guest pass
  * route into “Tour & Memberships / Schedule Appointment / Complete Registration”

3. **Membership Wizard (sales → product config → billing → contract)**

* Sales deck page (“what makes us different”)
* Add-ons upsell page
* Plan comparison + discounting engine
* Multi-step checkout (profile → recurring billing → due-today payment → contract signature)

The visual jump you see (orange gradient pages → white enterprise pages) strongly suggests **two UI frameworks or eras** merged into one workflow.

---

## 2) State machine / gating logic (what must be true to advance)

This flow behaves like a **gated state machine**, not a freeform website:

### State A — Guest exists

* **New guest** form creates a guest record
* Guest record is blocked until:

  * waiver checkboxes are checked (and likely “review” links clicked)
  * signature captured
  * required fields filled (name/email/phone/DOB/gender)

### State B — Guest is “owned” by a salesperson

* The **Claim Guest** action assigns accountability/credit
* Without claim, downstream attribution and reporting is unreliable

### State C — Guest pass (optional but operationally important)

* A guest pass can be selected and started
* UI shows guest pass history + expiry + a visit count (staff-facing operational telemetry)

### State D — Membership checkout

* Plan selection page hard-depends on a chosen guest (you can see an error message when a guest isn’t selected)
* Discounts can radically change the due-today math (your screenshots show a discount that collapses amounts to a token value)

### State E — Contract completion

* “Next” is disabled until:

  * membership terms checkbox is checked
  * member signature is captured

---

## 3) Page-by-page teardown (layouts, components, intent)

### 1) Guest Sign In (fork page)

**Layout:** centered logo + title + two equal-weight buttons.
**Intent:** reduce decision to “new vs returning” and move fast.
**UI pattern:** kiosk-style hero layout; almost no distractions.

**Staff-driven implication:** this screen is really a *routing menu* for staff, not for the guest.

---

### 2) New guest intake + waivers + signature

**Layout:** left = form rows; right = signature pad + legal checkboxes; bottom-right = wide “Finish” CTA.

**What it’s optimizing:**

* Minimal fields up front (name/email/phone/DOB/gender)
* Strong DOB validation language (“must match ID”) to reduce fake identities
* Legal compliance baked into intake (guest waiver + tanning waiver + communications waiver)

**Design notes:**

* Extreme negative space makes it feel simple, but it also hides “what’s next” (no step indicator, no progress).
* The waiver links are styled as “Click to review & agree…” — good if that click opens content and is logged; risky if it’s just text.

**Staff-driven implication:** this is a natural “handoff to guest” moment for signature + checkboxes.

---

### 3) Staff modal “guest hub” (claim + actions + pass)

This is the most revealing page architecturally.

**Layout:** centered modal card overlay:

* staff dropdown + “Claim Guest” button
* three large action buttons (Tour/Memberships, Schedule Appointment, Complete Registration)
* signature preview area
* guest pass history + expiry + pass select + “Start Guest Pass”

**What it really is:** a mini CRM console embedded in the flow:

* enforces ownership
* gives the staff a “next action” router
* exposes operational status (pass + visits)

**Staff-driven implication:** this is the moment where the system *forces salesperson accountability* before conversion.

---

### 4) “What makes Crunch different?” (sales deck page)

**Layout:** massive headline; grid of feature tiles (each tile = image + orange label).
**Intent:** a standardized pitch page inside the funnel.

**Architectural interpretation:** this is a **sales enablement interstitial**—it’s not required for data, it’s required for consistency of messaging.

**Staff-driven implication:** salesperson can skip or speed through unless tiles open deeper details (not visible here).

---

### 5) Membership Additions (upsell interstitial)

**Layout:** two huge side-by-side add-on cards with strong imagery; each has:

* value bullets
* price
* “Add to membership” vs “Decline offer”

**Intent:** attach revenue via a forced yes/no step.

**Design tradeoff:** “Decline offer” is nearly as prominent as “Add,” which speeds the process but can suppress attach rate unless staff frames it.

---

### 6) Membership Plans (tier compare + discount engine + due-today math)

This is the densest page and the core “pricing engine.”

**Layout:**

* Top: benefit comparison table (expandable categories + checkmarks)
* Middle: payment option selector (e.g., monthly/no commitment) + applied discount label + discounts button
* Bottom: “Payment due today” breakdown by tier with “Select” buttons

**What’s visible structurally:**

* 3 tiers (a premium tier tagged “Best Value,” a mid tier, a base tier)
* Monthly dues + annual fee shown per tier
* A discount mode that can:

  * waive enrollment
  * waive first month dues
  * waive prorated annual
  * alter taxes
  * reduce “due today” to a token amount (your screenshots show this behavior)

**Staff-driven implication:** this page is where staff most often loses the guest if they can’t explain the numbers fast. The UI is accurate but not psychologically reassuring.

---

### 7) Member profile step (data normalization)

**Layout:** wide two-row form grid + address section; bottom nav buttons; a “Take Photo” action.

**Data model implied:**

* Personal info (including optional “how did you hear,” employer)
* Emergency contact name/number
* Address broken into normalized components (line1/line2/city/state/postal/country)
* Photo capture stored on the member profile

**Staff-driven implication:** this is mostly staff entry, except photo capture (requires guest present).

---

### 8) Recurring payment method (ACH-first with card fallback)

**Layout:** left = ACH setup (checking/savings + routing + account + confirm); right = summary card.

**Important logic visible:**

* Monthly dues + monthly processing fee combined into a monthly total
* Annual fee billed separately on a later date
* “Use credit/debit card” is a small link (secondary)

**Business intent:** push ACH (lower cost, lower churn) while still offering card.

**Staff-driven implication:** this should be a “guest enters banking/card info” moment for trust + compliance, even if staff is driving the page.

---

### 9) Payment due today (one-time card transaction)

**Layout:** left = card form; right = itemized totals + “Total Due Today.”

**Architecture implication:** they can:

* set **recurring** to ACH
* still take **due-today** via card

That’s an operationally common gym pattern (secure the immediate transaction quickly while locking autopay).

**Staff-driven implication:** this is the other “hand to guest” moment (PCI + trust).

---

### 10) Contract terms + membership signature

**Layout:** left = terms + checkbox; right = signature canvas; “Next” disabled until requirements met.

**Contract logic visible in-page:**

* monthly auto-debit amount (dues + fees)
* cancellation-within-initial-window language that requires paying scheduled drafts in that window
* annual fee timing + non-refundable framing

**Staff-driven implication:** this is the final handoff for signature, and the wording here is what drives disputes later if the sales explanation doesn’t match.

---

## 4) UI system + design language (what’s consistent vs stitched)

### Two design systems coexist

**Guest subsystem**

* orange→red gradient background
* centered hero layouts, low density, big CTAs
* feels “kiosk-like” even if staff-operated

**Membership subsystem**

* white canvas, dense tables/forms
* black header strip + orange section headers
* looks like enterprise SaaS / admin UI

**Result:** discontinuity in perceived legitimacy (“why did the UI suddenly change?”), which matters during payment + contract steps.

### Primary action placement is inconsistent

* early: big centered buttons
* mid: modal hub with large stacked buttons
* later: bottom-right “Next” wizard controls
  That increases training burden for staff because muscle memory breaks.

---

## 5) What this flow is optimized for (and where it’s fragile)

### Optimized for

* Sales attribution (Claim Guest)
* Standardized pitch (sales deck page)
* Attach attempts (add-ons forced choice)
* Discounting/promo operations (applied discount + strikethrough math)
* Autopay reliability (ACH-first + confirm account)
* Legal defensibility (waivers + terms + signatures)

### Fragile at

* **Pricing comprehension**: dense compare table + dramatic promo math can feel “scammy” if staff can’t explain it cleanly.
* **Trust moments**: banking/card entry should be guest-entered; if staff types it, it reduces trust and increases liability.
* **Theme discontinuity**: visual jump right before payment can raise doubt.
* **Optional fields that feel mandatory** (employer/emergency contact): if staff asks awkwardly, it slows the close.

---

## 6) Staff-driven “handoff points” (where the workflow should explicitly switch control)

Based on what’s visible, the clean handoff points are:

1. **Guest waivers + signature** (Page 2)
2. **Card/bank entry** (Pages 8–9) — even if staff navigates, guest should type sensitive fields
3. **Contract signature** (Page 10)

Right now, the UI doesn’t strongly signal “now hand to guest,” which means the process relies on staff habit instead of system guidance.

---

## 7) The biggest architectural tell: discounting + token “due today”

Your screenshots show a discount state where multiple charges collapse to a token amount while still requiring payment entry and signature.

That usually indicates one of these designs:

* **Card tokenization / verification charge** (tiny amount to validate payment method)
* **Employee / promo / flex discounts** that waive most upfront costs but still require a transaction record
* **A testing/training mode** that mimics checkout without real charges (the presence of a “Practice” module makes this plausible, but the membership wizard looks real)

Operational risk: if staff can’t explain why totals look weird, guests get suspicious fast.

---

If you want the *most useful next layer*, tell me **what you’re trying to improve** (speed, close rate, fewer charge disputes, staff training simplicity, or guest trust). Then I’ll map **exact friction points → UI changes → expected operational impact** for this specific workflow.

My Reply: Can you double check that you didn't miss anything?
This was the previous context:
My Prompt: Analyze the enrollment flow for a person that signs up with a sales person in store at crunch fitness. The pictures are in order. Can you review the specific architecture, layouts, designs, and everything that we can see from the buildouts of these pages and prepare them for me in a in depth analysis?
Your Response: [ChatGPT's First Response]

ChatGPT Final Response: Yes — your earlier breakdown is basically correct, but there **are a few concrete UI/flow details in the screenshots** that weren’t explicitly called out (or need tighter wording). Biggest adds: **(1) the “EXIT / COMPLETE REGISTRATION” header context on the Plans page, (2) an explicit “no guest selected” gating state, (3) multi-location access counts + footnotes, and (4) multiple “reveal/eye” controls + reset controls that imply security + recovery mechanics.**

### What I’d add / correct from the screenshots

* **Membership Plans page has a “wizard shell” header**

  * Top-left shows **EXIT** and **COMPLETE REGISTRATION**, with **Crunch Tallahassee** in the header — that’s a strong signal this is a **contained registration flow** with an explicit abort/exit pathway (not just a generic page).

* **There’s an explicit gating/error state on Plans**

  * Bottom text: **“No guest has been selected. Tap here to select or register a guest”** → confirms a **hard dependency** between guest record selection/creation and plan selection.

* **Benefit comparison includes multi-location access counts + exclusions**

  * “Location access” shows values like **557** for the higher tiers and **1** for Base (exact meaning isn’t explained on-screen, but it’s clearly an access count).
  * Footnotes include exclusions such as **fees/taxes** and **Crunch Select / Crunch Signature location access** (so the “557” isn’t “everything everywhere”).

* **The benefit table is collapsible**

  * Those **“+” expanders** next to benefit categories indicate nested details exist, even if not expanded in the screenshots.

* **Discounting is a first-class subsystem, not a one-off coupon**

  * Plans page shows **Applied Discount: “FLEX”** plus a dedicated **DISCOUNTS** button.
  * The “due today” section uses **red strikethrough** original values with **black** discounted values per line item (not just a single total), implying a **rule-based pricing engine**.

* **Global “RESET” appears in multiple steps**

  * This isn’t just cosmetic — it suggests the flow expects **operator recovery** (start over / clear step state) without backing out entirely.

* **Bank/ACH step has multiple security & trust cues you didn’t explicitly list**

  * **Checking/Savings** selection.
  * **Routing / account / confirm account** fields each have “eye” icons (mask/unmask behavior).
  * A small **“Use Credit/Debit Card”** link indicates **ACH-first** but with a deliberate fallback path.
  * Right-side summary explicitly separates:

    * **Monthly dues** + **monthly processing fee** → monthly total
    * **Annual fee** with its own **first annual payment date**

* **Due-today card step also shows masking + address shortcut**

  * Credit card number (and at least one other field) shows an **eye** icon (again: mask/unmask).
  * **“Billing address same as Home Address”** checkbox suggests the address from the profile step is reused to reduce friction.

* **There are (at least) two distinct signature events**

  1. **Guest / waiver signature** on the orange-gradient Member Mgmt screen (waiver checkboxes + signature + Finish).
  2. **Membership agreement signature** on the white “Signature” step with **Membership Terms** link + checkbox + signature canvas + **Clear** control.

* **Guest hub modal has a couple of extra operational telemetry bits**

  * It displays **visit count** (e.g., “15 visits”) and a **guest pass expiry** label — those are operational controls, not just sales routing.

* **Add-ons page has specific monetization mechanics**

  * Crunch+ shows a **trial callout** and indicates it’s **billed separately** to the card on file.
  * Kids Crunch includes **capacity/hours** disclaimers and eligibility language (dependents on account, etc.).

* **“Practice” appears as a top-level nav mode**

  * That matters because it raises a real ambiguity: **some screenshots could be from a training/sim environment** (which would change how confidently we interpret the $0.02 due-today behavior).

---

### Assumptions

* The screenshots are from the **real** production workflow (not a demo/training environment), even though “Practice” exists in navigation.
* “FLEX” is a **discount program/promo** and not a test flag.
* The $0.02 “due today” reflects either **payment-method verification** or a **promo requiring a token transaction**, not a display bug.

### Tradeoffs / risks

* If “Practice” is a sandbox, the **discount math and $0.02 charge behavior** may not reflect real guest experience.
* Still images can’t confirm whether “RESET” is **step-only** or **full-flow destructive** (important for staff mistakes).
* The “557 location access” figure is **not self-explaining**; if staff can’t explain it, it can create distrust right at the pricing moment.

### Next best step (one action)

Do one live walk-through and write down **exactly where staff hands the device over** (waiver signature, payment entry, contract signature) and whether “Practice” was enabled—those two facts will settle the remaining ambiguities (especially the $0.02 + FLEX behavior).