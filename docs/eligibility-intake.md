# Employer eligibility intake

Ideal accepts browser uploads, automated HTTPS uploads, and email attachments into one staff review queue. These are file delivery options; uploading never grants member access, changes coverage, or triggers vendor delivery. This is not the SFTP protocol. Partners with SFTP-only exporters still need a gateway.

## What is implemented

- `/employer/upload`: Clerk sign-in, authorized organization selection, roster date, file upload, receipt, organization submission history, and approved email address where enabled.
- `/employer/sign-in` and `/employer/sign-up`: dedicated account entry points. Contacts may use an existing Clerk account.
- `/admin/eligibility/intake` (**Operations → Employer Intake**): browser/email allowlists, per-organization aliases, expiring API credentials, preview, approval, rejection, private download, and processing through the existing importer.
- Convex HTTP actions: machine upload sessions, binary upload, receipt status, signed SES bridge, and authenticated staff downloads.
- `infra/eligibility-email`: SES/S3/Lambda receiving adapter, dependency lockfile, build and deployment scripts, CloudFormation, receipt emails, and optional operational alarms.
- `scripts/eligibility-upload.mjs`: dependency-free employer upload/status client.

## Launch browser/API uploads first

1. Confirm the existing app deployment, Clerk, and Convex accounts are configured for the personal/health information they will handle. Where PHI is involved, confirm applicable BAA coverage and settings. An AWS BAA does not cover later storage/processing in Convex or Vercel. Keep roster data out of Resend; its current security documentation says it cannot sign a BAA.
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
- Browser/API files get format/size checks, including workbook ZIP expansion limits (50 MB expanded, 1,000 entries) and rejection of encrypted/macro workbooks. These checks are **not antivirus scanning**. Email also requires the SES virus and spam verdicts to pass. No file is opened in a browser or executed. SheetJS is pinned to its maintained 0.20.3 distribution rather than the old npm release.
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

## Email deployment

Email adds an AWS receiving adapter, not an AWS Transfer Family/SFTP endpoint. Use **standard SES receipt rules**, on à-la-carte pricing, to avoid Mail Manager endpoint fees. SES receiving, S3 requests/storage, Lambda, and optional logs/alarms are usage billed; there is no SFTP server fee. Larger messages cost more and email adds setup work compared with browser intake.

Prerequisites: AWS account and authorized CLI credentials, AWS BAA for PHI, a region supporting **SES email receiving** (e.g. `us-east-1`), DNS management, Node.js 22+, and `zip`. AWS CLI credentials stay on your workstation; the app does not need AWS access keys.

1. Choose an inbound subdomain such as `intake.getidealoh.com`. **Use a subdomain so the existing business mailbox MX records remain intact.** The approved organization addresses will be generated by the admin screen, e.g. `org-<random>@intake.getidealoh.com`.
2. Generate a random 32-byte bridge secret in your password manager or with `openssl rand -hex 32`. Set that value as `ELIGIBILITY_EMAIL_BRIDGE_SECRET` on the production Convex deployment and in the deployment environment below. Do not put it in the repo, screenshots, CLI arguments, or email.
3. Set `ELIGIBILITY_INBOUND_DOMAIN=intake.getidealoh.com` on production Convex. Set the following workstation environment variables securely:

```text
AWS_REGION=us-east-1
ELIGIBILITY_INBOUND_DOMAIN=intake.getidealoh.com
ELIGIBILITY_CONVEX_SITE_URL=https://YOUR-PRODUCTION-DEPLOYMENT.convex.site
ELIGIBILITY_EMAIL_BRIDGE_SECRET=<same random value configured on Convex>
ELIGIBILITY_ALERT_EMAIL=<your operations email; optional but recommended>
```

4. Run `node infra/eligibility-email/deploy.mjs`. It installs locked dependencies, bundles/ZIPs the Lambda, creates a private encrypted artifact bucket if needed, and deploys the CloudFormation stack. The first deployment creates the identity and an empty, inactive rule set. Stack name defaults to `ideal-eligibility-email`; override with `ELIGIBILITY_EMAIL_STACK` if needed. Bridge secrets are sent through a temporary permissions-restricted parameter file with a NoEcho parameter. This command creates billable AWS resources. It does not activate the receiving rule set.
5. Add the **three DKIM CNAME records** from the stack outputs. Add the inbound subdomain’s MX record from `MXValue`, e.g. `10 inbound-smtp.us-east-1.amazonaws.com`. Use plain DNS records, not an HTTP/CDN proxy. Confirm SES domain identity verification succeeds in the chosen region. Add an appropriate DMARC TXT record for your receipt-sending subdomain; DKIM is configured by the identity. Set `ELIGIBILITY_ENABLE_RECEIPT_RULE=true` and rerun the deployment script to create the receiving rule. The script checks verification before enabling it and preserves the setting on later updates.
6. Check the account's existing active receipt rule set with `aws ses describe-active-receipt-rule-set --region us-east-1`. If another set is in use, incorporate the Ideal receiving rule into it instead of disabling existing mail routes. If no existing rules need preservation, activate the set shown in the stack outputs:

```sh
aws ses set-active-receipt-rule-set --rule-set-name ideal-eligibility-email-rules --region us-east-1
```

7. For outbound receipts to real employer contacts, obtain SES sending production access in that region or verify test recipient addresses while in the sandbox. Receiving files can work before outbound receipt access; receipt failures are logged without message contents and have a separate alarm. If an alert email was configured, confirm the SNS subscription email.
8. Enable **Email attachments** for approved senders in the admin UI. Copy their organization-specific recipient address from that screen. Inbound domain/secret settings being present does not prove AWS/DNS are live.
9. Send a fictitious attachment from an approved authenticated sender. Confirm its receipt in Ideal and receipt email. Check an unapproved sender, incorrect organization alias, failed sender authentication, duplicates, and format errors. Confirm the Lambda logs/alarms are monitored.

The receipt rule requires TLS delivery to SES. The adapter trusts SES receipt verdicts (not sender-supplied Authentication-Results headers), requires **DMARC PASS**, spam PASS, and virus PASS, accepts one From mailbox, maps SMTP envelope recipients to authorized organizations, and signs its request to Convex. There is no sender-based bypass of authentication. Some domains produce DMARC GRAY/FAIL or forwarded messages fail authentication; they must use browser/API uploads or correct their sending configuration. DMARC authenticates the sender domain, not an uncompromised individual mailbox. The allowlist and staff review remain necessary. TLS to SES does not guarantee encryption of every earlier hop in the employer's email path.

The bridge accepts at most five supported attachments and a 16 MB raw message (base64 overhead counts), with a 10 MB limit per attachment. It ignores unrelated signature images. It never follows links in message bodies or retrieves cloud-drive links. Password-protected/encrypted files cannot be processed. Send these through the upload page instead.

Unapproved email submissions do not enter the Ideal queue and receive no auto-response. Accepted submissions receive opaque receipt IDs, without roster content or attachment filenames. Partial attachment failures are noted in the receipt. Raw SES mail is deleted after handling, with a one-day S3 lifecycle fallback; transient failures keep it for retries. Operational logs contain event codes/counts only. Outages and receipt delivery failures trigger optional alarms.

## Verification performed locally

Run `npx vitest run convex/eligibilityIntake.test.ts convex/admin/eligibility.test.ts`, `npm test --prefix infra/eligibility-email`, `npm run build --prefix infra/eligibility-email`, and `npx tsc --noEmit`. These check tenant isolation, verified identity binding, revocation, expiry, idempotency, staged approval, format guards, bridge signing, and SES adapter behavior. They do not validate live DNS, IAM, SES, Clerk production settings, or production deployment. Test those with fictitious data after deployment.

The production Next.js build, targeted ESLint checks, and offline `cfn-lint` validation passed. Local HTTP checks confirmed employer/admin authentication redirects, no-store/noindex headers, the upload CSP permission, and template delivery. Rendered sign-in pages timed out locally for both the existing member sign-in and the new employer sign-in; verify interactive sign-in on the deployed host. The broader repository suite has 40 existing checkout/invite/family UI failures and scheduled-function errors reproduced against the unchanged repository. The intake/importer/route checks and isolated email adapter checks pass.

## References

- [Convex file uploads](https://docs.convex.dev/file-storage/upload-files) and [file storage security](https://docs.convex.dev/file-storage/overview).
- [AWS SES receiving](https://docs.aws.amazon.com/ses/latest/dg/receiving-email-concepts.html), [TLS receipt rules](https://docs.aws.amazon.com/ses/latest/APIReference/API_ReceiptRule.html), and [pricing](https://aws.amazon.com/ses/pricing/).
- [AWS HIPAA and BAA](https://aws.amazon.com/compliance/hipaa-compliance/), [Resend security](https://resend.com/security), and [SheetJS installation/security guidance](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/).
