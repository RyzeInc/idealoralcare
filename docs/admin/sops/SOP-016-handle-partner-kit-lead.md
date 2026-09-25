# SOP-016: Handle and Convert a Partner Kit Lead

**Purpose:** Work the leads that arrive when an agency or business fills out the public `/register` form asking to partner (often requesting the "partner kit"): triage them, track your outreach, and pass the serious ones on to a full application.

**Who can do this:** Any admin (Owner or Editor).

**When you'd do this:** New leads appear on the Partner Kit Leads page, or you need to record leads gathered elsewhere (a conference, a phone call).

**Before you begin:** Nothing in particular. It sits in the sidebar under **Members & Partners → Partner Kit Leads**, upstream of Partner Applications ([SOP-005](SOP-005-review-partner-application.md)).

**Related guide:** [Partner Kit Leads](../guide/01-members-partners.md#partner-kit-leads-adminpartnerkit)

## Steps — work the incoming leads

1. Go to **Partner Kit Leads** (`/admin/partnerkit`).
2. Note the **"N requested kit"** count at the top — it counts leads who specifically asked for the partner kit (your warmest ones).
3. Use the **Status** filter (All / New / Contacted / Closed) to focus. Start with **New**.
4. For each row, review Name, Business, Contact, whether they wanted the kit, and when they submitted.
5. After you reach out, set their **Status** with the inline dropdown — **Contacted** (you've made contact) or **Closed** (done, whether they moved to a full application or it's a dead end). The change saves immediately, with no confirmation and no audit-log entry; keep any record of *what* was said in your own CRM/email.

## Steps — add leads gathered elsewhere (bulk)

6. Click **Add Leads** to open the bulk-entry form (5 blank rows by default: Name / Business / Email / Phone).
7. Fill in one row per lead; empty rows are ignored. Submit — they're added with status **New**. (Bulk-added leads are always marked as *not* wanting the kit, since that box only exists on the public form.)

## Steps — export

8. Click **Export CSV** at any time to pull the current (filtered) list for a spreadsheet or email campaign.

## Verification

- A status change is reflected immediately in the row's dropdown.
- After a bulk add, the new leads appear in the table (clear the Status filter if you don't see them — they land in "New").

## If something goes wrong

- **The same person appears twice** — there is no dedupe on either intake path; someone submitting `/register` twice, or a bulk add of an existing lead, creates a second row. Close the duplicate.
- **A lead is ready to become a real partner** — point them to `/register/rep` to submit a full application, then process it with [SOP-005](SOP-005-review-partner-application.md). The two systems aren't linked in the data, so just close the lead here once they've applied.
- **You need a history of who changed a lead's status** — there isn't one; status changes aren't logged. Track outreach in your own tools.

## Related SOPs

- [SOP-005](SOP-005-review-partner-application.md) — process a lead once they submit a formal application.
- [SOP-004](SOP-004-onboard-broker-agency-and-reps.md) — add a partner by hand instead of waiting on an application.
