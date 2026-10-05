# Employer eligibility intake

Ideal accepts browser uploads, automated HTTPS uploads, and email attachments into one staff review queue. These are file delivery options; uploading never grants member access, changes coverage, or triggers vendor delivery. This is not the SFTP protocol. Partners with SFTP-only exporters still need a gateway.

For nontechnical training and organization onboarding, see the [illustrated companion guides](eligibility-companion/README.md). This document remains the engineering setup reference.

## What is implemented

- `/employer/upload`: Clerk sign-in, authorized organization selection, roster date, file upload, receipt, organization submission history, and approved email address where enabled.
- `/employer/sign-in` and `/employer/sign-up`: dedicated account entry points. Contacts may use an existing Clerk account.
- `/admin/eligibility/intake` (**Operations → Employer Intake**): browser/email allowlists, per-organization aliases, expiring API credentials, preview, approval, rejection, private download, and processing through the existing importer.
- Convex HTTP actions: machine upload sessions, binary upload, receipt status, signed email bridge, and authenticated staff downloads.
- `infra/eligibility-gmail/Code.gs`: Google Apps Script that runs inside the shared eligibility Workspace mailbox and forwards authenticated attachments to the matching site's signed Convex bridge. Every site's repository keeps the same copy.
- `scripts/eligibility-upload.mjs`: dependency-free employer upload/status client.

## Launch browser/API uploads first

1. Confirm the existing app deployment, Clerk, and Convex accounts are configured for the personal/health information they will handle. Where PHI is involved, confirm applicable BAA coverage and settings. A Google Workspace BAA does not cover later storage/processing in Convex or Vercel. Keep roster data out of Resend; its current security documentation says it cannot sign a BAA.
2. On the **production Convex deployment**, set `CLERK_SECRET_KEY` to the production key for the same Clerk application already used by Ideal. Employer authorization checks verified email addresses directly with Clerk before binding access to a Clerk user ID. The existing Convex JWT template/auth configuration is reused.
3. Set `ELIGIBILITY_PORTAL_ORIGINS` on Convex to the exact allowed website origins, separated by commas. Defaults are `https://getidealoh.com,https://www.getidealoh.com`. Add `http://localhost:3000` or a preview origin only for its corresponding development/preview backend.
4. Deploy the backend with your usual `npx convex deploy` workflow, then deploy the Next.js app to Vercel using the matching production `NEXT_PUBLIC_CONVEX_URL` and Clerk keys. Code generation alone does not deploy the backend. Convex's built-in `CONVEX_SITE_URL` supplies the HTTP action endpoint ending in `.convex.site`; it is different from the browser/client `.convex.cloud` endpoint.
5. Ensure Clerk permits employer account creation and verifies email addresses. If your application restricts sign-ups, arrange Clerk invitations for these contacts. Public account creation by itself grants no upload access. Keep existing member/admin redirects unchanged.
6. In **Employer Intake → Upload access**, authorize each named contact for the correct organization. Browser and email permissions can be enabled separately. Organizations, their accounts, and sites must be active (accounts can also be onboarding). Configure the organization’s Organization Code before approving a roster.
7. Share `https://getidealoh.com/employer/upload`. A contact signs in with a verified approved address; Ideal binds the grant to that Clerk identity. Grant additional organizations explicitly for brokers. Revocation takes effect for pending sessions as well as future uploads.
8. Use a fictitious roster to check that the contact sees only its organization, gets a receipt, and cannot view staff pages or another organization’s submissions. Check staff preview, approval, rejection, and processing before real files.

No new Vercel environment variable is required for browser intake. Backend-generated upload tickets provide the upload endpoint. Google Analytics and rep visit tracking are excluded from the intake pages; raw filenames/member information are not placed in navigation URLs.

## Files and review

- CSV, XLSX, TXT, JSON; UTF-8 for text; maximum **10 MB** per file. Send larger rosters as batches preserving primary/dependent families.
- `/eligibility-template.csv` is a blank employer census template supported by the existing CSV parser. Use one row per covered person. Set Covered Member Relationship to Employee, Spouse, or Child, and repeat the employee's name and DOB on every family row. DOB can identify the family without collecting SSNs; an Employee ID is recommended for stable re-upload matching. Existing importer formats, including Careington XLSX/TXT layouts, remain supported. Use the Organization Code and format agreed with Ideal; templates do not set these automatically.
- Browser/API files get format/size checks, including workbook ZIP expansion limits (50 MB expanded, 1,000 entries) and rejection of encrypted/macro workbooks. These checks are **not antivirus scanning**. Email additionally relies on Gmail malware blocking and spam filtering. No file is opened in a browser or executed. SheetJS is pinned to its maintained 0.20.3 distribution rather than the old npm release.
- Preview is staff-only and uses the existing parser. Empty files, parsing errors, and oversized record counts block approval. Missing-field warnings require explicit staff acknowledgement and are recorded on the submission and in the audit log. Such files can still have members who cannot be provisioned or fulfilled by vendors.
- **Approve** creates a linked `eligibilityFiles` record. **Process approved file** separately starts the importer. The action claims the file atomically before starting, preventing duplicate processing from repeated clicks. Failed imports can be retried from the queue. Processing status and subsequent member provisioning/vendor delivery remain in Eligibility Files.
- Importing updates/adds matching members. Vendor IDs belonging to another organization are rejected rather than updating that organization's family; dependent matches are also organization/family scoped. Importing does **not** terminate members omitted from a full roster. Do not use intake as automatic full replacement/termination until those existing importer behaviors are implemented.
- Rejection notes are visible to employer users; never enter member details in them.
- Rejected source attachments are deleted; unreviewed submissions expire and their files are deleted after 30 days. Expired session records are cleaned hourly. Approved sources are shared with the existing eligibility file record and are not deleted by intake cleanup; set an approved-file retention policy appropriate for your operations.
- Same organization + exact file SHA-256 + roster date yields the existing receipt while it is pending/approved. The same bytes may be submitted again after rejection/expiry or for a different roster date. Different organizations never share receipts/files. Repeating an email/HTTP request cannot import members twice because receipt creation does not run the importer.
- Limit: 60 upload sessions per organization per hour. Sessions expire after 15 minutes, are single-use, and become invalid when the originating access grant/API key is revoked. Failed/expired sessions require a new session.

## Automated HTTPS uploads

Create a credential in **Upload access** with a descriptive label and expiry (1–365 days; default 90). Copy it once into the employer's secret store. Only its SHA-256 digest is stored in Ideal. A key is scoped to one organization; submitted organization IDs cannot broaden that scope. Rotate by creating a replacement, updating the export job, and revoking the old key.

Set these environment variables in the employer's job configuration, keeping the key out of source code and logs:

```text
ELIGIBILITY_API_BASE=https://YOUR-PRODUCTION-DEPLOYMENT.convex.site
ELIGIBILITY_API_KEY=<credential from Employer Intake>
```

```sh
node scripts/eligibility-upload.mjs ./roster.csv 2026-10-04
node scripts/eligibility-upload.mjs --status RECEIPT_ID
```

API contract for other clients:

| Endpoint | Authentication | Body/result |
| --- | --- | --- |
| `POST /eligibility/sessions` | `X-Eligibility-Key` | JSON `{ "fileName": "roster.csv", "fileBytes": 12345, "sourceDate": "2026-10-04" }`; returns `uploadUrl`, `uploadToken`, expiry. Date is optional. |
| `POST /eligibility/upload` | `X-Upload-Token` | Raw file bytes, not multipart/form-data. Returns `receiptId` and `duplicate`. |
| `POST /eligibility/status` | `X-Eligibility-Key` | JSON `{ "receiptId": "..." }`; returns review status and processing status for that key’s organization only. |

A 201/200 receipt means received, not approved/processed. On an uncertain network outcome, rerunning the file upload is safe; checksum deduplication returns the prior receipt. Clients should back off on 429 and 5xx errors. Avoid sending file bodies through a Vercel function; they go directly to Convex HTTP actions.

## Email intake (Google Workspace)

Email runs on the existing Google Workspace account; no AWS, extra domain, or DNS change is needed.

- **Mailbox:** one dedicated Workspace *user* serves every site (currently `eligibility@nexusoralhealth.com`). Add `eligibility@getidealoh.com` to it as an alias (Admin console → Users → the mailbox → Alternate email addresses), so no extra paid user is needed. getidealoh.com must be in the same Workspace account. Not a Google Group: Apps Script can only read a user mailbox, and Groups rewrite the From of DMARC-strict senders ("X via eligibility"), which breaks the sender allowlist. Do not use it for human mail; everything in its Inbox is processed and then trashed.
- **Send mail as:** in the mailbox's Gmail settings (Accounts → Send mail as), add `eligibility@getidealoh.com` so Ideal receipts come from Ideal's address. `setup()` refuses to finish until every site address can be sent from.
- **Addresses:** each organization gets `eligibility+org-<random>@getidealoh.com`, shown in **Employer Intake** once email is enabled for a contact. Gmail delivers plus-addresses to the mailbox automatically.
- **Convex settings (production):** `ELIGIBILITY_INBOUND_ADDRESS=eligibility@getidealoh.com` and `ELIGIBILITY_EMAIL_BRIDGE_SECRET` (64 hex chars).
- **Site entry:** run `ELIGIBILITY_CONVEX_SITE_URL=https://<production-deployment>.convex.site scripts/setup-eligibility-email.sh`. It sets both Convex variables and writes the `SITE_IDEAL` script property value (address, brand, portal link, `.convex.site` URL and secret) to the Desktop. The committed `Code.gs` holds no site settings or secrets.
- **Script install:** signed in as the mailbox, open the eligibility project at script.google.com (create it the first time), paste `Code.gs`, add each site's `SITE_` value under Project Settings → Script properties, then run `setup()` and authorize. `setup()` checks every site's send-as address and secret against its Convex deployment, then installs a 5-minute trigger.
- **Rotation:** re-run the setup script, replace `SITE_IDEAL` with the new value, and run `setup()` again.
- **Adding a site:** add its domain to the Workspace account, add `eligibility@<domain>` as a mailbox alias and send-as address, run that site's setup script, add its `SITE_` property, and run `setup()` again. No script change is needed.

Each message goes to the site whose domain appears in Google's topmost `Delivered-To`. If that site does not recognize the sender and organization, the script asks the other sites with the same plus-tag, in case Google reports the mailbox's primary domain instead of the alias. A refusal stores nothing and organization tags are random per site, so at most one site accepts; a refusing site sees only the sender, recipient, file name and size.

The script trusts only Google's topmost `Authentication-Results` (`mx.google.com`) and requires `dmarc=pass`; spam never reaches the Inbox and Gmail blocks malware before delivery. The recipient is Google's topmost `Delivered-To`. It accepts one From mailbox, at most five CSV/XLSX/TXT/JSON attachments of 10 MB each, and never follows links. Unapproved senders, wrong aliases, and failed authentication are trashed with no reply. Accepted mail gets an opaque receipt from the accepting site's address (no filenames or member data). Convex outages leave mail in the Inbox for the next run. Trashed mail is purged by Gmail after 30 days.

Messages sent from inside the Workspace account (any of its domains) may lack Google's authentication header and are refused; test from an outside address. DMARC authenticates the sender domain, not an uncompromised mailbox, so the allowlist and staff review remain necessary.

For PHI, accept the Google Workspace BAA (Admin console → Account → Account settings → Legal and compliance) and confirm Gmail and Apps Script are on Google's covered-services list. The shared mailbox holds every site's submissions, so the BAA must cover each site's data.

## Verification performed locally

Run `npx vitest run convex/eligibilityIntake.test.ts convex/admin/eligibility.test.ts`, `npx vitest run infra/eligibility-gmail`, and `npx tsc --noEmit`. These check tenant isolation, verified identity binding, revocation, expiry, idempotency, staged approval, format guards, bridge signing, and the Gmail script's authentication/forwarding logic against fakes. They do not validate the live mailbox, Clerk production settings, or production deployment. Test those with fictitious data after deployment.

The production Next.js build and targeted ESLint checks passed. Local HTTP checks confirmed employer/admin authentication redirects, no-store/noindex headers, the upload CSP permission, and template delivery. Rendered sign-in pages timed out locally for both the existing member sign-in and the new employer sign-in; verify interactive sign-in on the deployed host. The broader repository suite has 40 existing checkout/invite/family UI failures and scheduled-function errors reproduced against the unchanged repository. The intake/importer/route checks and Gmail script checks pass.

## References

- [Convex file uploads](https://docs.convex.dev/file-storage/upload-files) and [file storage security](https://docs.convex.dev/file-storage/overview).
- [Apps Script GmailApp](https://developers.google.com/apps-script/reference/gmail/gmail-app) and [Google Workspace HIPAA](https://support.google.com/a/answer/3407054).
- [Resend security](https://resend.com/security), and [SheetJS installation/security guidance](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/).
