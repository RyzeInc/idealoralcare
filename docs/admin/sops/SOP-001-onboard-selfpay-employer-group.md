# SOP-001: Onboard a New Self-Pay Employer Group

**Purpose:** Set up a new employer/organization whose members will each pay their own subscription via Stripe (the default, non-payroll-deduction path).

**Who can do this:** Any admin (Owner or Editor).

**Trigger:** A new employer/broker relationship is ready to start enrolling members.

**Prerequisites:**
- Know which **Site** (almost always the one existing "Ideal Health" site) and which **Account** (broker) this group belongs to. If the Account doesn't exist yet, create it first (Step 2).
- Have the employer's desired Group Name and a unique code in mind for both the **Group Code** (used in the enrollment flow / eligibility files) and the **Organization Code / Subscriber ID**.

**Related guide:** [Hierarchy](../guide/02-operations.md#hierarchy-adminhierarchy)

## Steps

1. Go to **Hierarchy** (`/admin/hierarchy`) — sidebar label "Hierarchy," page header "Brokers & Organizations."
2. Confirm the parent **Account (Broker)** exists:
   - Click the **Brokers** tab and search for it.
   - If it doesn't exist: click **Create Broker**, pick the Carrier (Site), enter a unique Slug, choose a Broker Type and Billing Model, and submit.
3. Click the **Organizations** tab → **Create Organization**.
4. Fill in the form:
   - **Carrier** → the Site.
   - **Broker** → the Account you confirmed/created in step 2 (the dropdown filters to that carrier).
   - **Organization Name** → the employer's display name. Typing a name auto-suggests a slug-style Organization Code — you can accept or overwrite it.
   - **Organization Code (Subscriber ID)** — **required**. The form will warn you client-side if you leave it blank ("Members enrolled here will be missing their Subscriber ID"). Do not skip this — leaving it unset won't fail here, but it will hard-block eligibility processing later (SOP-003) with an error pointing you back to this exact screen.
   - **Provider Group Code** — defaults to `IDEALDO`; leave as-is unless this employer specifically needs a different one.
   - Leave **List-Bill** disabled (unchecked) for a self-pay group — see [SOP-002](SOP-002-onboard-listbill-employer-group.md) if this employer is actually paying via payroll deduction instead.
   - Optional: Max Members, Effective/Termination dates, a **Representative** (rep code) if this enrollment should be attributed to a specific sales rep for commissions.
5. Click **Create**.
6. Confirm the new Group appears in the Organizations table with the correct Org Code and Broker.

## Verification

- Open the new Group's row → the **Members** count should show `0` with the full status breakdown available (lead/eligible/enrolling/active/…).
- If you're about to bulk-enroll via eligibility file, do a one-row test upload first (see [SOP-003](SOP-003-bulk-enroll-eligibility-file.md)) before sending the employer's full roster.

## If something goes wrong

- **"Organization Code required" toast won't let you submit** — you missed the Org Code field; scroll back up and fill it in.
- **You created the group without an Org Code somehow, and eligibility processing later fails** with an error about "no Organization Code" — go back to this Group's **Edit** action on the Organizations tab and set it, then retry the eligibility upload.
- **Wrong Broker selected** — you can Edit the Group afterward to fix it; this doesn't cascade-delete anything.

## Related SOPs

- [SOP-002](SOP-002-onboard-listbill-employer-group.md) — if this is actually a payroll-deduction (list-bill) employer instead.
- [SOP-003](SOP-003-bulk-enroll-eligibility-file.md) — next step once the group exists: load their roster.
- [SOP-004](SOP-004-onboard-broker-agency-and-reps.md) — if the broker/agency itself also needs to be set up in the separate Distribution/commission chain.
