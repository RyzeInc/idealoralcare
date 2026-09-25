# SOP-004: Onboard a New Broker/Agency and Their Reps

**Purpose:** Set up a new Program Manager/FMO/Agency in the sales & commission chain, and issue tracking (rep) codes to their individual reps so enrollments get attributed correctly.

**Who can do this:** Any admin (Owner or Editor).

**When you'd do this:** A new agency/FMO signs on to sell the plan, or an existing agency adds a new rep.

**Before you begin:** The agency's legal/organization name and a primary contact (name + email). This is distinct from the employer Hierarchy tree ([SOP-001](SOP-001-onboard-selfpay-employer-group.md)) — don't confuse an **Account** (the Hierarchy tier that owns Groups) with a **Broker** (a sales/commission partner, this page); see [guide/00-overview.md §4](../guide/00-overview.md#4-hierarchy-vocabulary).

**Related guide:** [Brokers](../guide/01-members-partners.md#brokers-adminbrokers), [Rep Codes](../guide/01-members-partners.md#rep-codes-adminrep-codes)

## How brokers get into the system

There are three ways, and all of them end in the same broker workspace:

1. **Manually, here** (this SOP) — you onboard them from **Brokers → Onboard broker**.
2. **Self-registration** — they submit `/register/rep`, then you approve it on **Partner Applications** ([SOP-005](SOP-005-review-partner-application.md)).
3. **Partner Kit** — they sign the Partner Kit and you approve it as a partner from **Partner Kit Leads**.

## Steps — onboard a new Program Manager, FMO or Agency

1. Go to **Brokers** (`/admin/brokers`) and search first to confirm they aren't already on file (search covers name, contact, email, agency code and NPN; set Status to *All statuses* to include inactive ones).
2. Click **Onboard broker**.
3. **Organization**: name, type, upline partner (leave *Independent* if nobody earns an override on them), NPN.
4. **Agreement**: effective date (defaults to today), override/management fee %, status. Choose *Inactive* to set them up before they should have access.
5. **Primary contact**: full name and email are required; title and phone are optional.
6. **Portal access**: pick what the primary contact can see — *Producer* (own book), *Agency manager* (whole organization), *Upline leader* (organization + downline), or *No portal access*. Leave **Email a 30-day portal invite now** ticked unless you want to send it later.
7. Add internal **profile notes** if useful, then submit. You land on the new broker's workspace.
8. Check the toast. "Invite email failed" means the broker was still saved; resend from **Team & access** (paper-plane icon).

## Steps — finish setup from the broker workspace

The **Overview** tab's onboarding checklist shows what's left; each open item links to the tab that fixes it.

9. **Team & access → Add team member** for each additional person (name + email required, choose their access role). Each gets their own invite.
10. **Rep codes → Assign agency code & issue rep codes**. This assigns the 4-digit agency code if missing and issues one numbered rep code (e.g. `100001`) plus a vanity link to every team member who doesn't have one. Run it again after adding people.
11. Copy each person's referral link from the Rep codes table (copy icon) and send it to them.
12. For a partner that sits under this one, use **Downline → Onboard downline partner**; the upline is pre-filled.

## Verification

- The Overview checklist shows every required step complete once someone has accepted their invite.
- **Team & access** shows *Connected* for anyone who accepted, and the **Report data access** panel lists the organizations each role can read.
- **Activity** records who created the broker, who was invited, and every later change.

## If something goes wrong

- **Invite expired** — resend from Team & access; it issues a fresh 30-day link.
- **"Sign in with the email address this invitation was sent to"** — the person signed in with a different email. Either they sign in with the invited address, or you correct the email on their team record (only possible before they connect) and resend.
- **Someone should stop seeing data** — set their access role to *No portal access* (immediate), or set the organization's status to Inactive to cut off the whole team.
- **Delete is disabled** — the partner still has a downline. Reassign those partners' upline first, or set this one Inactive instead.
- **The rep's Commission % shows blank on Rep Codes** — this can be a genuine "no rate set yet" or a rate-matching miss; check [Commissions](../guide/03-finance.md#commissions-admincommissions) directly (also note Commissions is currently flagged unreliable — see [guide/05-known-issues.md](../guide/05-known-issues.md)).

## Related SOPs

- [SOP-005](SOP-005-review-partner-application.md) — if the agency/rep applied via the public self-registration form instead of being added manually here.
