# SOP-005: Review and Approve a Partner (Broker/Rep) Application

**Purpose:** Process an inbound self-registration submission from the public `/register/rep` form — review the agency/rep details, then approve (creating a live Distribution Partner) or reject.

**Who can do this:** Any admin (Owner or Editor) — note there's no owner-only gate on Approve despite it being the most consequential action in this workflow.

**Trigger:** A new submission appears in the "New" tab.

**Related guide:** [Partner Applications](../guide/01-members-partners.md#partner-applications-adminpartner-applications)

## Steps

1. Go to **Applications** (`/admin/partner-applications`).
2. Check the **New** tab for unreviewed submissions (or search by agency name, contact email/name, EIN, or NPN).
3. Click **Review** on a submission to open the detail drawer. Read the full Agency and/or Rep section: name, DBA, EIN, NPN, licenses, E&O carrier/expiration, W-9 status, ACH auth status, submitted Program Manager.
4. Optional: click **Mark Reviewing** if you want to signal to teammates this one is in progress (only available while status is "New").
5. Decide:
   - **To reject**: fill in an optional reason in the textarea, click **Reject** once (button becomes "Confirm Reject"), then click again to confirm. The drawer closes automatically.
   - **To approve**:
     - If this is a **rep-only** submission, you must first select the agency to attach them to in the "Attach Rep to Agency" dropdown — Approve is blocked with a toast until you do.
     - Optionally assign a Program Manager (agency-type submissions).
     - Click **Approve**.
6. Watch the toast carefully: it tells you whether the invite email actually sent. If it says the invite failed, note that — the partner/leader records were still created silently; you'll need to go resend manually (see below).
7. After approving, check the drawer's Approved-tab footer for the generated **Agency Code** and per-leader **rep codes**. If none appear (auto-provisioning can fail silently), click **Provision Agency Code + Rep Codes** yourself.

## Verification

- Go to **Brokers** (`/admin/brokers`) and confirm the new partner/leader now appears there.
- Go to **Rep Codes** and confirm the rep(s) from this application now have a working tracking code.
- If the invite-failure toast appeared, resend from the Brokers page's Leaders panel (see [SOP-004](SOP-004-onboard-broker-agency-and-reps.md)).

## If something goes wrong

- **You approved the wrong submission, or need to undo an approval** — there is no "un-approve" flow. The partner/leader records it created are real and permanent from this screen's perspective; you'd need to go delete/edit them directly on the Brokers page instead.
- **Approved tab shows no Agency Code/rep codes** — auto-provisioning failed silently (this is a known, logged-but-not-surfaced failure mode). Use the **Provision Agency Code + Rep Codes** button; for legacy rows with no linked partner record, you'll need to pick the matching partner from a dropdown first.
- **A rep-only submission won't let you click Approve** — you haven't selected an agency in "Attach Rep to Agency" yet; it's a required field for that submission type.

## Related SOPs

- [SOP-004](SOP-004-onboard-broker-agency-and-reps.md) — the manual equivalent of this workflow, and where to go to fix/extend what this SOP created.
