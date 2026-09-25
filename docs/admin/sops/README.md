# Admin SOP Library

Step-by-step procedures for the tasks admins actually perform. Each one names exactly which buttons to click and in what order, and how to confirm it worked. No prior experience is assumed — if you can read and follow a numbered list, you can do these.

For the reasoning behind a step, or what a screen means beyond the immediate task, follow the linked [guide](../guide/00-overview.md) section.

**Before your first task**, read two things: the [glossary](#the-words-youll-see) below (two minutes), and [guide/00-overview.md §1](../guide/00-overview.md#1-the-permission-model-read-this-first) on the permission model — every procedure's "Who can do this" line assumes you know that Owner vs. Editor is mostly a label, not an enforced restriction.

---

## The words you'll see

The admin app reuses a handful of terms throughout. Here is what each one means.

| Term | Meaning |
|---|---|
| **Site** (Carrier) | The brand at the top of the tree — e.g. "Ideal Health." Usually just one. |
| **Account** | The middle tier of the tree: a company or producer that owns one or more employer Groups under a Site. (Formerly also called "Broker" — no longer.) |
| **Group** (Organization / Employer) | One specific employer or association whose members enroll. Each has a unique **Group Code**. |
| **Broker** | A sales/commission partner — Program Managers, FMOs, agencies who resell the plans. A separate system from the Account tree; managed on the **Brokers** page. |
| **Rep Code** | A tracking code for one salesperson, so a completed sale is credited to them for commission. |
| **Member** | A person in a plan, moving through a status pipeline (lead → eligible → active → terminated, and so on). |
| **Primary / Dependent** | The **Primary** owns and pays for the plan. **Dependents** (spouse, children) are covered on it at no extra charge. |
| **Self-Pay** | The member pays their own subscription through Stripe. |
| **List-Bill** | The employer pays one combined bill for all its members (payroll deduction), rather than each member paying. |
| **Eligibility File** | A spreadsheet an employer sends listing who should be covered. You upload it to create or update members in bulk. |
| **Vendor File** | A file we generate and send outward to a fulfillment partner (Careington, DialCare) listing who is covered. |
| **Careington / DialCare / Toothlens** | Outside partners: Careington (dental discount network), DialCare (teledentistry), Toothlens (AI oral scan). |
| **Comp / Free access** | Giving a member a plan at $0 (testing, VIP, or employer-paid) rather than charging them. |

---

## Find your task

**Setting up something new**

| To do this… | Follow |
|---|---|
| Create a new white-label Site (branding, integrations) | [SOP-017](SOP-017-create-configure-site.md) |
| Onboard an employer whose members pay for themselves | [SOP-001](SOP-001-onboard-selfpay-employer-group.md) |
| Onboard an employer who pays one combined bill (payroll deduction) | [SOP-002](SOP-002-onboard-listbill-employer-group.md) |
| Load a roster of members from a spreadsheet | [SOP-003](SOP-003-bulk-enroll-eligibility-file.md) |
| Bring on a new broker/agency and their reps | [SOP-004](SOP-004-onboard-broker-agency-and-reps.md) |
| Create a tracking code for a salesperson | [SOP-018](SOP-018-manage-rep-codes.md) |

**Everyday member and partner work**

| To do this… | Follow |
|---|---|
| Terminate a member or correct their status | [SOP-009](SOP-009-terminate-member.md) |
| Refund a payment or cancel a paid subscription | [SOP-010](SOP-010-refund-or-cancel-subscription.md) |
| Grant a member free/comp access | [SOP-019](SOP-019-grant-free-comp-access.md) |
| Re-enroll an employee who came off list-bill | [SOP-013](SOP-013-reenroll-termed-listbill-employee.md) |
| Follow up on a partner-kit request from the website | [SOP-016](SOP-016-handle-partner-kit-lead.md) |
| Review and approve a broker/agency/rep application | [SOP-005](SOP-005-review-partner-application.md) |

**Money**

| To do this… | Follow |
|---|---|
| Generate an employer's list-bill invoice and record payment | [SOP-007](SOP-007-generate-listbill-invoice-record-payment.md) |
| Close a month in Revenue & Dispersal / record an adjustment | [SOP-008](SOP-008-close-invoice-calculator-period-adjustment.md) |
| Run the end-of-month finance reconciliation | [SOP-014](SOP-014-monthly-finance-reconciliation-checklist.md) |
| Generate and send files to Careington / DialCare | [SOP-006](SOP-006-generate-deliver-vendor-files.md) |

**Fixing problems**

| To do this… | Follow |
|---|---|
| An eligibility file failed or looks wrong | [SOP-015](SOP-015-troubleshoot-eligibility-file-errors.md) |
| A person's login/identity/records look broken across systems | [SOP-011](SOP-011-investigate-member-identity-issue.md) |
| Add, remove, or change an admin user | [SOP-012](SOP-012-manage-admin-users.md) |

---

## Full index

| SOP | Task | Primary pages |
|---|---|---|
| [SOP-001](SOP-001-onboard-selfpay-employer-group.md) | Onboard a new self-pay employer group | Hierarchy |
| [SOP-002](SOP-002-onboard-listbill-employer-group.md) | Onboard a new list-bill (payroll deduction) employer group | Hierarchy, List-Bill Invoices |
| [SOP-003](SOP-003-bulk-enroll-eligibility-file.md) | Bulk-enroll members from an eligibility file | Eligibility Files |
| [SOP-004](SOP-004-onboard-broker-agency-and-reps.md) | Onboard a new broker/agency and their reps | Brokers, Rep Codes |
| [SOP-005](SOP-005-review-partner-application.md) | Review and approve a partner (broker/rep) application | Partner Applications |
| [SOP-006](SOP-006-generate-deliver-vendor-files.md) | Generate and deliver vendor eligibility files (Careington/DialCare/DDN) | Eligibility Files, Vendor Files |
| [SOP-007](SOP-007-generate-listbill-invoice-record-payment.md) | Generate a list-bill invoice and record employer payment | List-Bill Invoices |
| [SOP-008](SOP-008-close-invoice-calculator-period-adjustment.md) | Close a monthly Revenue & Dispersal period / record an adjustment | Revenue & Dispersal |
| [SOP-009](SOP-009-terminate-member.md) | Terminate a member / change member status | Members |
| [SOP-010](SOP-010-refund-or-cancel-subscription.md) | Process a refund or cancel a member's subscription | Customer Service |
| [SOP-011](SOP-011-investigate-member-identity-issue.md) | Investigate a member/identity issue across systems | User Lookup, Member Inspector |
| [SOP-012](SOP-012-manage-admin-users.md) | Add, remove, or change an admin user's role (incl. first-admin setup) | Admin Users |
| [SOP-013](SOP-013-reenroll-termed-listbill-employee.md) | Re-enroll a termed list-bill employee | List-Bill, Members |
| [SOP-014](SOP-014-monthly-finance-reconciliation-checklist.md) | Monthly finance reconciliation checklist | Billing, List-Bill Invoices, Revenue & Dispersal |
| [SOP-015](SOP-015-troubleshoot-eligibility-file-errors.md) | Troubleshoot an eligibility file that failed or partially failed | Eligibility Files |
| [SOP-016](SOP-016-handle-partner-kit-lead.md) | Handle and convert a Partner Kit lead | Partner Kit Leads |
| [SOP-017](SOP-017-create-configure-site.md) | Create and configure a new white-label Site (branding + integrations) | Hierarchy |
| [SOP-018](SOP-018-manage-rep-codes.md) | Create and manage Rep Codes | Rep Codes |
| [SOP-019](SOP-019-grant-free-comp-access.md) | Grant free/comp access to a member | Dashboard, Members |

---

## How each procedure is laid out

Every SOP follows the same shape, so once you have read one you can read them all:

- **Purpose** — one sentence on what it accomplishes.
- **Who can do this** — reflects what the backend actually allows today, not what the role labels imply.
- **When you'd do this** — the situation that calls for it.
- **Before you begin** — what to have in hand first.
- **Steps** — numbered, in order. Button labels appear in **bold**, exactly as shown in the product.
- **Verification** — how to confirm the task worked, since many confirmations here are a brief pop-up ("toast") with no other record.
- **If something goes wrong** — the common snags and how to resolve them.
- **Related SOPs** — where to go next.

Where a screen does something surprising — a button that doesn't do what its label implies, a known bug — the step says so plainly and links to [guide/05-known-issues.md](../guide/05-known-issues.md).
