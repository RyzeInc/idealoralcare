# SOP-004: Onboard a New Broker/Agency and Their Reps

**Purpose:** Set up a new Program Manager/FMO/Agency in the sales & commission chain, and issue tracking (rep) codes to their individual reps so enrollments get attributed correctly.

**Who can do this:** Any admin (Owner or Editor).

**Trigger:** A new agency/FMO signs on to sell the plan, or an existing agency adds a new rep.

**Prerequisites:** The agency's legal/organization name and a primary contact (name + email). This is distinct from the employer Hierarchy tree ([SOP-001](SOP-001-onboard-selfpay-employer-group.md)) — don't confuse "Account (Broker)" under Hierarchy with "Distribution Partner" here; see [guide/00-overview.md §4](../guide/00-overview.md#4-distribution-hierarchy-vocabulary).

**Related guide:** [Distribution](../guide/01-members-partners.md#distribution-adminbrokers), [Rep Codes](../guide/01-members-partners.md#rep-codes-adminrep-codes)

## Steps — new Agency/FMO

1. Go to **Brokers** (`/admin/brokers` — page titled "Distribution Management").
2. Choose the correct tab: **Program Managers** or **FMOs & Agencies**.
3. Click **Add Program Manager** / **Add FMO / Agency**.
4. Fill in: Organization Name, Type (FMO/Agency, if applicable), optional Parent Program Manager, **Primary Leader**: Full Name + Email (required), Phone, Title, optional Override/Management Fee Rate, Status, Notes.
5. Submit. The system automatically creates a primary Leader record for the contact you entered and emails them a 30-day invite link.
6. Check the resulting toast:
   - "Partner added" (invite sent) — done.
   - "Partner added — invite email failed" — the partner record was still created; you'll need to manually resend (step 8 below).

## Steps — add a rep under an existing agency, with a tracking code

7. If the agency doesn't have a **4-digit Agency Code** yet: go to **Rep Codes** (`/admin/rep-codes`) → start **Add Rep Code** → select the agency in the Agency/FMO dropdown → click **Assign 4-Digit Code** next to it → confirm.
8. Back on **Brokers**, expand the agency's card → **Leaders** panel → **Add Leader** → Name + Email (required), Phone, Title → submit. This sends its own invite email (same failure-handling as step 6 — check the toast).
9. Return to **Rep Codes** → **Add Rep Code** → select the agent (search existing Clerk users, or paste their Clerk User ID if they haven't signed up under this name yet) → select the Agency.
   - If the agency has a code (from step 7): Rep First/Last Name fields appear with a **live preview** of the auto-generated numeric code and slug — review it, then **Create Rep Code**.
   - If not: enter a code manually or click **Generate**.
10. Give the rep their resulting code and share their referral link: `https://idealhealth.com/health/plans?ref=THEIRCODE` (see `docs/internal/REP_CODE_SYSTEM.md` for the rep-facing instructions verbatim).

## Verification

- On **Brokers**, the agency card should show the correct Leader count and (once someone claims their invite) an "Active" status instead of "Pending"/"No invite."
- On **Rep Codes**, search for the new code and confirm its Agent/Agency/Status look right, and that "Uses" starts at 0.

## If something goes wrong

- **Invite email failed** — resend from the agency card's Leaders panel (the paper-plane icon next to that leader), not from Rep Codes.
- **You need to delete an agency** — the confirm dialog only says "this cannot be undone"; know before confirming that this **cascades and deletes every Leader under that partner** too, with no separate warning.
- **The rep's Commission % shows blank on Rep Codes** — this can be a genuine "no rate set yet" or a rate-matching miss across three different lookup paths; check [Commissions](../guide/03-finance.md#commissions-admincommissions) directly before assuming it's a bug (also note Commissions is currently flagged unreliable — see [guide/05-known-issues.md](../guide/05-known-issues.md)).
- **You need an audit trail of who created/removed a broker or rep code** — there currently isn't one; no audit-log entries are written for these actions (see [guide/05-known-issues.md #G3](../guide/05-known-issues.md#-structural-architectural-gaps-working-as-coded-but-incomplete-or-duplicated)). Track it manually (e.g., in the partner's Notes field) if this matters for your team.

## Related SOPs

- [SOP-005](SOP-005-review-partner-application.md) — if the agency/rep applied via the public self-registration form instead of being added manually here.
