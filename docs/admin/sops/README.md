# Admin SOP Library

Concrete, step-by-step procedures for the tasks admins actually perform. Each SOP names exactly which buttons to click and in what order. For *why* a step works the way it does, or what a screen means beyond the immediate task, follow the linked [guide](../guide/00-overview.md) section.

Before your first task, read [guide/00-overview.md §1](../guide/00-overview.md#1-the-permission-model-read-this-first) once — every SOP's "Who can do this" line assumes you already know that Owner vs. Editor is mostly a label, not an enforced restriction.

## Index

| SOP | Task | Primary pages involved |
|---|---|---|
| [SOP-001](SOP-001-onboard-selfpay-employer-group.md) | Onboard a new self-pay employer group | Hierarchy |
| [SOP-002](SOP-002-onboard-listbill-employer-group.md) | Onboard a new list-bill (payroll deduction) employer group | Hierarchy, List-Bill Invoices |
| [SOP-003](SOP-003-bulk-enroll-eligibility-file.md) | Bulk-enroll members from an eligibility file | Eligibility Files |
| [SOP-004](SOP-004-onboard-broker-agency-and-reps.md) | Onboard a new broker/agency and their reps | Distribution ("Brokers"), Rep Codes |
| [SOP-005](SOP-005-review-partner-application.md) | Review and approve a partner (broker/rep) application | Partner Applications |
| [SOP-006](SOP-006-generate-deliver-vendor-files.md) | Generate and deliver vendor eligibility files (Careington/DialCare/DDN) | Eligibility Files, Vendor Files |
| [SOP-007](SOP-007-generate-listbill-invoice-record-payment.md) | Generate a list-bill invoice and record employer payment | List-Bill Invoices |
| [SOP-008](SOP-008-close-invoice-calculator-period-adjustment.md) | Close a monthly Invoice Calculator period / record an adjustment | Invoice Calculator |
| [SOP-009](SOP-009-terminate-member.md) | Terminate a member / change member status | Members |
| [SOP-010](SOP-010-refund-or-cancel-subscription.md) | Process a refund or cancel a member's subscription | Customer Service |
| [SOP-011](SOP-011-investigate-member-identity-issue.md) | Investigate a member/identity issue across systems | User Audit, Member Inspector |
| [SOP-012](SOP-012-manage-admin-users.md) | Add, remove, or change an admin user's role (incl. first-admin setup) | Admin Users |
| [SOP-013](SOP-013-reenroll-termed-listbill-employee.md) | Re-enroll a termed list-bill employee | List-Bill, Members |
| [SOP-014](SOP-014-monthly-finance-reconciliation-checklist.md) | Monthly finance reconciliation checklist | Billing, List-Bill Invoices, Invoice Calculator, Commissions |
| [SOP-015](SOP-015-troubleshoot-eligibility-file-errors.md) | Troubleshoot an eligibility file that failed or partially failed | Eligibility Files |

## Conventions used in every SOP

- **Who can do this** reflects what the backend actually allows today (per [guide §00 §1](../guide/00-overview.md#1-the-permission-model-read-this-first)), not what the UI's role labels imply.
- Steps reference the exact button label shown in the product, in **bold**.
- A ⚠️ inline means: this is a place the SOP would normally warn you the code is doing something unusual — cross-reference [guide/05-known-issues.md](../guide/05-known-issues.md) if you hit unexpected behavior here.
- "Verification" tells you how to confirm the task actually worked, since several confirmations in this app are toast-only with no other feedback.
