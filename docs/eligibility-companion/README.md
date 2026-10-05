# Eligibility companion guides

Prepared October 5, 2026 against Ideal v0.17.5. The current email intake is Google Workspace, with organization-specific plus-addresses.

## Choose the right guide

| Audience | Printable PDF | Offline browser version | Editable text |
| --- | --- | --- | --- |
| Program Manager / authorized Ideal staff | [Program Manager guide](program-manager-guide.pdf) | [Program Manager HTML](program-manager-guide.html) | [Program Manager Markdown](program-manager-guide.md) |
| Employer, broker or payroll contact | [Organization guide](organization-guide.pdf) | [Organization HTML](organization-guide.html) | [Organization Markdown](organization-guide.md) |

**Send the Organization guide and [blank CSV template](eligibility-template.csv) to organizations. Keep the Program Manager guide internal.** The HTML files embed their logo and vector illustrations and can be read without an internet connection. Links to the live portal require internet access.

For a single attachment, use the [Organization onboarding kit](organization-onboarding-kit.zip), which contains only the organization PDF, HTML, editable text, blank template and its visual aids. It excludes the internal Program Manager guide. Complete and save the PDF fields before sharing a customized copy; the generated kit starts with blank fields.

The Organization PDF has six fillable fields on page 1: organization, approved sender, assigned recipient, Program Manager/support contact, submission schedule, and review turnaround. Complete these in a PDF viewer that supports forms and save a copy for that organization. Browser HTML also has editable fields; print/save as PDF after filling them. HTML field entries are not persisted on reload. A newly downloaded Organization PDF has blank fields; Ideal must supply these details before distribution.

The example email alias in the illustrations is fictitious. Always supply the organization's actual assigned address. Use a subject such as "[Organization] eligibility submission instructions"; do not include member data or credentials in the handoff email.

## Visual aids

Every illustrated screen is clearly labeled, uses fictitious data, and follows the current interface labels. These are instructional illustrations, not screenshots of live organizations.

- [Shared intake workflow](assets/workflow.svg)
- [Organization submission journey](assets/organization-workflow.svg)
- [Annotated employer portal](assets/portal-walkthrough.svg)
- [Authorize a contact](assets/access-walkthrough.svg)
- [Queue and preview](assets/review-walkthrough.svg)
- [Family roster example](assets/family-example.svg)
- [Approved sender and assigned inbox](assets/email-routing.svg)

The guides preserve the distinction between receipt, approval, processing, member invitations, and vendor delivery. They also explain that roster omissions and the Term Date field do not automatically terminate members.

## Source checks

The content was checked against:

- `src/app/employer/upload/page.tsx`: portal fields, receipt copy, format limits and history.
- `src/app/admin/eligibility/intake/page.tsx`: exact access/review/approval/processing controls.
- `convex/eligibilityIntake.ts`: scoped authorization, queue filters, approval gates, retention and deduplication.
- `convex/admin/eligibility.ts`: supported census layout, matching, processing and termination limitations.
- `src/app/admin/eligibility/page.tsx`: Grant Access and invitation controls.
- `infra/eligibility-gmail/Code.gs`: plus-address routing, five-minute trigger, attachment limits, sender checks, receipt behavior and message handling.
- `public/eligibility-template.csv`: the employer-facing CSV headers.

These guides describe the checked-in behavior; they do not certify production deployment, mailbox availability, or data-handling compliance. The Program Manager should confirm each enabled route with fictitious data before onboarding a new organization.

Internal references: [engineering setup](../eligibility-intake.md), [bulk enrollment](../admin/sops/SOP-003-bulk-enroll-eligibility-file.md), [vendor delivery](../admin/sops/SOP-006-generate-deliver-vendor-files.md), [member status](../admin/sops/SOP-009-terminate-member.md), and [import troubleshooting](../admin/sops/SOP-015-troubleshoot-eligibility-file-errors.md).

## Rebuild the deliverables

The source model and layout are in `scripts/build-eligibility-companion-guides.py`. Its generated `guide-content.json`, Markdown, HTML, SVG and PDF outputs should be regenerated together when behavior or instructions change.

Use Python 3 with `reportlab` and `svglib`, then run from the repository root:

```sh
python scripts/build-eligibility-companion-guides.py
```

The generator uses Arial from `/System/Library/Fonts/Supplemental` on macOS. On another platform, set `IDEAL_GUIDE_FONT_DIR` to a folder containing `Arial.ttf` and `Arial Bold.ttf`. Generated PDFs use embedded fonts; recipients do not need these packages or fonts.

The build validates that every PDF page fits inside its content area. No production services are contacted. The documents can be used offline.

## Website downloads

The generator also copies the organization PDF, HTML, ZIP and CSV into `public/guides/eligibility/` for deployment. Share `/guides/eligibility/organization-guide.pdf` or `/guides/eligibility/organization-onboarding-kit.zip` on the Ideal website.

The internal Program Manager PDF is served only through `/api/admin/eligibility-guide`, which checks Clerk sign-in and the staff admin record. Both downloads are linked from `/admin/docs`. The Program Manager materials must not be copied to `public/`.
