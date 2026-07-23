# SOP-013: Re-enroll a Termed List-Bill Employee

**Purpose:** Handle a full-time employee who's termed off an employer's list-bill (payroll deduction) plan but wants to continue coverage on their own, self-pay basis.

**Who can do this:** Any admin (Owner or Editor).

**Trigger:** Employer eligibility file marks someone termed, or an employee is manually termed from list-bill, and they've since asked to keep their coverage.

**Related guide:** [List-Bill](../guide/03-finance.md#list-bill-adminlist-bill), [Members](../guide/01-members-partners.md#members-adminmembers)

## Steps — via the List-Bill page

1. Go to `/admin/list-bill` (⚠️ no sidebar link — bookmark it or navigate by URL).
2. Open the relevant employer group and switch to the **Termed Members** tab.
3. Find the employee. If they have an email on file, click **Send Re-enrollment Link**. If the button is greyed out/disabled, they have no email on record — you'll need to add one first (see [SOP-011](SOP-011-investigate-member-identity-issue.md)'s "Edit all fields" via User Audit, or the Members page's inline edit) before a link can be sent.
4. Confirm the toast reports success.

## Steps — equivalent path via the Members page

5. Alternatively, open **Members** → search for the person → open their detail drawer.
6. In the **List-Bill (FT)** section, if their `listBillStatus` is already `termed`, you'll see the same **Send Re-enrollment Link** button (disabled under the same no-email condition as above).
7. (If they haven't been termed yet but need to be, for some other operational reason, this is also where you'd click **Term from List-Bill** — confirm this is actually what you intend, since it flips them to `inactive` and generates a re-enrollment token as a side effect.)

## What happens after the link is sent

- The member receives an email with a link valid for 30 days that lets them self-enroll on a self-pay basis, independent of their former employer's list-bill group.

## Verification

- Re-check the member's status after they complete self-enrollment — they should move off `terminated`/`inactive` and into the normal self-pay `enrolling`/`active` pipeline, now billed via Stripe rather than list-bill.
- If they report not receiving the email, re-send — there's no separate "resend" distinct from clicking the same button again.

## If something goes wrong

- **The button is disabled and there's no visible reason** — it's almost always the missing-email case; check their profile for an email address first.
- **You need to actively term someone off list-bill and there's no obvious "term" button on this page** — that action is on the **Members** page instead (**Term from List-Bill**, in the member's List-Bill section), not on the List-Bill page itself.
- **You can't find this page at all** — it's not in the sidebar; navigate directly to `/admin/list-bill`.

## Related SOPs

- [SOP-002](SOP-002-onboard-listbill-employer-group.md) — the group-level list-bill setup this employee originally belonged to.
- [SOP-009](SOP-009-terminate-member.md) — general member status changes, if this employee's situation is broader than a simple re-enrollment.
