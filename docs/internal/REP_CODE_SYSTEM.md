# Rep Code System

A **Rep Code** is a short alphanumeric string that attributes a sale to a specific sales representative (and their parent agency) when a customer signs up for Ideal Oral Health. It flows through the entire purchase pipeline without ever exposing internal organization structure to the customer.

---

## How It Works — End to End

```
Agency/Rep receives a code (e.g. "SMITH26")
          ↓
Rep shares a link:  idealhealth.com/health/plans?ref=SMITH26
          ↓
Customer opens link → code is silently captured into cart (localStorage)
          ↓
Customer reaches /health/checkout → sees "Rep Code" field pre-filled
     (or manually types their rep's code if they came in organically)
          ↓
POST /api/stripe/checkout → code is placed in Stripe session metadata
          ↓
Stripe processes payment → fires checkout.session.completed webhook
          ↓
Webhook reads code → stamps member profile with signupSource: "referral:SMITH26"
                   → attempts to assign member to rep's admin profile
                   → creates commissionPayable record (future payout)
```

---

## Hierarchy Reference

| Level | Who They Are | Their Role in This System |
|---|---|---|
| **Carrier** | You (the developer) | Build and operate the platform |
| **Program Manager** | Ideal Health | Owns the product; approves agencies |
| **FMO / Agency** | Company selling the plan | Creates reps; holds `agencyId` |
| **Rep / Agent** | Street-level salespeople | Gets a code; shares the link |
| **Customer / Member** | End consumer | Types or clicks with a Rep Code |

---

## 1. Developer Guide

### Schema

**`brokerTrackingCodes` table** — stores every active rep code:

```
{
  brokerId:    string   // Clerk user ID of the rep (links to adminUsers)
  agencyId:    string?  // Clerk user ID of the parent agency admin
  code:        string   // "SMITH26" — unique, indexed, used in ?ref= URLs
  groupId:     id?      // Optional: scope code to a specific group/deal
  siteId:      id?      // Optional: scope code to a specific site
  usageCount:  number   // Auto-incremented each time the code is used
  lastUsedAt:  number?  // Timestamp of last use
  status:      "active" | "inactive" | "revoked"
  createdBy:   string?  // Admin who generated the code
  notes:       string?
}
```

**`adminUsers` table** — reps and agency managers both live here:

```
{
  clerkUserId:    string             // Matches brokerId in brokerTrackingCodes
  email:          string
  name:           string
  departments:    ["broker", ...]    // Reps and agency managers get "broker"
  commissionRate: number?            // Their individual override rate (decimal)
}
```

**`commissionRates` table** — structured commission configuration:

```
{
  brokerId:           string   // Clerk user ID
  agencyId:           string?
  ratePercentage:     number   // e.g. 0.15 for 15%
  overridePercentage: number?  // Agency-level split
  effectiveFrom:      number   // Timestamp
  effectiveTo:        number?
  status:             "active" | "inactive" | "archived"
}
```

**`commissionPayables` table** — one record created per completed sale with a rep code:

```
{
  brokerId:            string   // The rep's Clerk user ID (or the raw code if unmatched)
  agencyId:            string?
  enrollmentSessionId: id?
  memberId:            id?
  rateApplied:         number   // 0.15 default
  amount:              number   // Cents
  period:              string   // "2026-03"
  status:              "pending" | "approved" | "paid" | "disputed" | "voided"
}
```

### Code Flow — Key Files

| File | What It Does |
|---|---|
| `src/lib/health-plans/types.ts` | `CartState.referralCode` field |
| `src/lib/health-plans/cart-context.tsx` | `setReferralCode()` persists to localStorage |
| `src/app/health/plans/page.tsx` | Reads `?ref=` from URL on load |
| `src/app/health/checkout/page.tsx` | Shows "Rep Code" UI; sends to API |
| `src/app/api/stripe/checkout/route.ts` | Accepts `referralCode`; writes to Stripe metadata |
| `src/app/api/stripe/webhook/route.ts` | Reads metadata; stamps member; creates commission record |
| `convex/subscriptions/commissions.ts` | `createCommissionPayable` / `setCommissionRate` |
| `convex/admin/members.ts` | `assignMemberToStaff` — links member to rep in admin panel |
| `convex/schema.ts` | Table definitions for all of the above |

### Stripe Metadata Fields Written at Checkout

```
brokerCode       // Set to referralCode if no explicit brokerCode was provided
referralCode     // Raw string as-entered by customer or from ?ref= URL
```

### Webhook Behavior

- If `referralCode` is present, `signupSource` on the member profile is set to `referral:{code}` instead of `stripe:{sessionId}`.
- `effectiveBrokerCode = brokerCode || referralCode` — the webhook uses whichever is present.
- `assignMemberToStaff` is called with `effectiveBrokerCode`. If no `adminUser` record matches, it silently skips (does not fail the webhook).
- `createCommissionPayable` is called at a **default 15% rate**. Override by setting a `commissionRate` row for the broker before their first sale.

### Creating a Rep Code Programmatically

```ts
await convex.mutation(api.subscriptions.commissions.setCommissionRate, {
  brokerId: "clerk_rep_xxx",
  agencyId: "clerk_agency_yyy",    // optional
  ratePercentage: 0.15,
  effectiveFrom: Date.now(),
  status: "active",
});

await ctx.db.insert("brokerTrackingCodes", {
  brokerId: "clerk_rep_xxx",
  agencyId: "clerk_agency_yyy",
  code: "SMITH26",                 // must be unique
  usageCount: 0,
  status: "active",
  createdAt: Date.now(),
  updatedAt: Date.now(),
});
```

### Current Limitations / TODOs

- `usageCount` on `brokerTrackingCodes` is **not auto-incremented** by the webhook yet — add a `ctx.db.patch` to the webhook's commission block.
- `commissionPayables` are created but payout processing is not yet wired (admin UI stub exists in `convex/admin/commissions.ts`).
- Code uniqueness is enforced by the `by_code` index but not validated at mutation level — add a uniqueness check before insert.

---

## 2. Admin Guide (Ideal Health Program Manager)

Admins manage reps, agencies, and their codes from the `/admin` panel.

### Creating a New Rep

1. Go to **Admin → Team Members → Add Member**
2. Enter the rep's name, email, and phone
3. Set **Department** to `broker`
4. Save — this creates their `adminUser` record and generates their Clerk account
5. Note their **Clerk User ID** from the user detail page — you'll need this to generate their code

### Generating a Rep Code

Currently done via the Convex dashboard or a dev-run script (admin UI is a planned feature):

1. Open the **Convex Dashboard** → Data → `brokerTrackingCodes`
2. Insert a new document:
   ```
   brokerId:   <rep's Clerk user ID>
   agencyId:   <agency's Clerk user ID>  (if applicable)
   code:       <SHORT-UNIQUE-CODE>        e.g. "SMITH26"
   usageCount: 0
   status:     "active"
   createdAt:  <current timestamp>
   updatedAt:  <current timestamp>
   ```
3. Share the code with the rep (see Rep section below)

### Revoking a Code

Set `status` to `"revoked"` on the `brokerTrackingCodes` record. Existing members already attributed to that code are unaffected. New signups using that code will still process (the webhook doesn't gate on code validity — flagging invalid codes is a planned feature).

### Viewing Member Attribution

1. Go to **Admin → Members**
2. Filter or search for a member
3. Check `signupSource` — format is `referral:SMITH26` for rep-attributed signups
4. Check `assignedStaffName` — if the rep had an `adminUser` record at time of signup, their name appears here

### Viewing Commissions

Commission payable records live in the `commissionPayables` table. The admin UI panel (`/admin/commissions`) exists as a stub. Until the UI is built, query via the Convex dashboard:

- Filter by `brokerId` to see one rep's record
- Filter by `period` (format: `"2026-03"`) for monthly reconciliation
- Filter by `status: "pending"` for unpaid commissions

---

## 3. Agency Guide (FMO / Agency Manager)

An **Agency** is an organization that contracts with Ideal Health to sell the plan through its own team of reps.

### Your Relationship to Codes

- Each of your reps gets their own unique Rep Code.
- Your `agencyId` (your Clerk user ID) is embedded in every code your reps use, so all sales from your team can be grouped and reported together.
- You do not have a single "agency-wide" code — attribution is always at the individual rep level.

### What to Give Your Reps

Each rep needs:
1. Their **Rep Code** (e.g. `SMITH26`) — provided by the admin
2. Their **referral link** (constructed as below):

```
https://idealhealth.com/health/plans?ref=SMITH26
```

That's the only thing they need to share.

### Tracking Your Team's Sales

Currently via the Convex dashboard or by requesting a report from the admin. Filter `commissionPayables` by `agencyId` to see all sales across your team in a given period.

A future agency portal will surface this natively.

---

## 4. Rep / Agent Guide

As a rep, you are a street-level salesperson. You represent your agency and sell Ideal Oral Health directly to individuals.

### Your Rep Code

You will receive a short Rep Code from your agency manager or from Ideal Health administration. It looks something like:

```
SMITH26
```

This code is yours. Every customer who signs up using it is attributed to you.

### How to Use It

**Option 1 — Share your referral link (recommended)**

Your referral link is:

```
https://idealhealth.com/health/plans?ref=YOURCODE
```

Replace `YOURCODE` with your actual code. When a customer opens this link, your code is automatically captured. They don't need to type anything.

Share this link:
- In a text message
- In an email
- On a printed flyer or business card as a QR code
- On your social media

**Option 2 — Give them your code verbally or on a card**

If a customer goes to the site on their own, they can type your code manually at checkout. On the checkout page, there is a **"Rep Code"** field just above the final purchase button. They enter your code and press Enter or click away.

### What Happens After They Sign Up

- Your code is recorded against their membership permanently.
- You will be listed as their assigned rep in the admin system.
- A commission record is created for the sale (payout timing and amount determined by your agreement with your agency).

### If a Customer Has Trouble

The Rep Code field at checkout is **optional** — a customer can complete their purchase without it. If they forgot to enter it, contact your agency manager or Ideal Health admin to manually attribute the sale after the fact (requires a Convex record update at this time).

---

## 5. Customer-Facing Behavior

This is what customers see and experience:

- **No mention of "broker," "agency," or "FMO"** — these terms are never shown.
- If they clicked a rep's referral link, the **"Rep Code"** field at checkout is pre-populated. They just see a small blue badge confirming the code.
- If they arrived organically, they see a **"Rep Code"** text input with placeholder "Enter your rep's code." It's optional and visually low-prominence.
- Entering or not entering a code does not affect their price, eligibility, or checkout experience.
