# Admin Quick Start Guide

Welcome to the Ideal Health platform administration panel. This guide covers day-to-day administrative tasks and configuration.

## First-Time Setup

### 1. Create Your Admin Account

When you first deploy the platform, you need to create a super-admin account:

1. **Sign Up:** Go to `/health/sign-in` and create an account (email or Google sign-in)
2. **Get Your User ID:** 
   - Log in to Clerk dashboard (https://dashboard.clerk.com)
   - Go to **Users** section
   - Find your account and copy the **User ID** (format: `user_xxxxx`)
3. **Initialize Admin:**
   - Navigate to `/admin/users` 
   - Click **Initialize First Admin**
   - Paste your User ID
   - Submit
4. **Verify:** You should now have full access to `/admin` panel

You can now create additional admin users from the `Users` page.

### 2. Understand the Site Hierarchy

The platform uses a three-level hierarchy:

```
Site (e.g., "Ideal Health")
  ├─ Account (e.g., "East Coast Insurance")
  │   ├─ Group (e.g., "Group A - Manufacturing")
  │   └─ Group (e.g., "Group B - Healthcare")
  └─ Account (e.g., "West Coast Insurance")
```

- **Site** — Your organization or brand (usually just one)
- **Account** — Insurance companies or brokers
- **Group** — Employee groups or divisions within an account

### 3. Verify Your Site Configuration

1. Go to `/admin/hierarchy`
2. Click on the **Sites** tab
3. You should see "Ideal Health" as the default site
4. Click **Edit** to customize:
   - Name
   - Domain (used for branded enrollment links)
   - Primary color (header branding)
   - Welcome message

## Daily Operations

### Managing Members

**Location:** `/admin/members`

This page shows all enrolled members and their subscription status.

#### View Member Details
1. Search by name, email, or member ID in the search box
2. Click on a member name to open their details
3. View:
   - Personal information
   - Enrollment date
   - Active subscription status
   - Plan details
   - Assigned broker

#### Edit Member Information
- Click **Edit** on the member detail page
- Update allowed fields (some are read-only in this version)
- Click **Save**

#### Remove a Member
- Open the member detail page
- Click **Cancel Membership**
- Confirm (this cannot be undone)

### Managing Brokers

**Location:** `/admin/brokers`

Brokers are representatives who help sell and manage memberships.

#### Add a Broker
1. Click **Add New Broker**
2. Enter:
   - **Name** (required)
   - **Email** (required)
   - **Phone** (optional)
   - **Commission Rate** — Percentage of subscription they earn
3. Click **Create**

#### Edit Broker Details
1. Find the broker in the list
2. Click **Edit**
3. Update information
4. Click **Save**

#### Remove a Broker
1. Click the **Delete** button (trash icon)
2. Confirm removal

#### Assign Broker to Groups
- This is done during group setup (see **Managing Groups** below)
- Members in a group inherit the assigned broker

### Managing Sites, Accounts & Groups

**Location:** `/admin/hierarchy`

Use this section to organize your enrollment structure.

#### Create a Site
- Sites are the top-level organizations
- Usually you only need one
- Created during initial setup
- Cannot be deleted from this interface (contact support if needed)

#### Create an Account
1. Go to `/admin/hierarchy`
2. Click **Accounts** tab
3. Select a Site first
4. Click **Add Account**
5. Enter account details
6. Click **Create**

#### Create a Group
1. Go to `/admin/hierarchy`
2. Click **Groups** tab
3. Select an Account first
4. Click **Add Group**
5. Enter:
   - **Group Name** (required)
   - **Group Code** (used in enrollment flow)
   - **Broker** (who manages this group)
6. Click **Create**

### Viewing Billing Information

**Location:** `/admin/billing`

This section shows financial summaries and revenue tracking.

#### Understand Billing Data
- **Total Revenue** — Sum of all active subscriptions
- **Monthly Breakdown** — Revenue by month
- **Group Summary** — Revenue by group code
- **Billing Period** — Calendar month

**Note:** Amounts are calculated daily as subscriptions change.

#### Export Billing Data
- Billing data can be exported via the export button (if available)
- Contact your account representative for historical data

### Managing Admin Users

**Location:** `/admin/users`

Control who has access to the admin panel.

#### Create a New Admin User
1. Have the user sign up at `/health/sign-in` first
2. Go to `/admin/users`
3. Click **Add Admin User**
4. Paste their Clerk User ID
5. Select permission level:
   - **Super Admin** — Full access to all features
   - **Manager** — Can manage members and brokers (in current version, same as Super Admin)
6. Click **Create**

#### Remove an Admin User
1. Find the user in the list
2. Click **Remove**
3. Confirm

**Important:** Be careful removing admin access — you need at least one super-admin.

### Managing Eligibility Files

**Location:** `/admin/eligibility`

Upload CSV files to bulk-enroll members.

#### File Format
Your CSV should have these columns (required):
- `firstName` — Member first name
- `lastName` — Member last name
- `email` — Member email address
- `dateOfBirth` — Format: YYYY-MM-DD
- `groupCode` — Must match a created group code

Optional columns:
- `employeeId` — Employee ID in your system
- `dependents` — Number of dependents (0-10)
- `phone` — Phone number

Example:
```
firstName,lastName,email,dateOfBirth,groupCode
John,Smith,john@example.com,1985-05-15,GROUP-A
Jane,Doe,jane@example.com,1990-03-22,GROUP-B
```

#### Upload File
1. Click **Upload Eligibility File**
2. Select your CSV file
3. Review the preview
4. Click **Upload**

#### Monitor Upload Progress
- The page shows upload status and any errors
- Members are enrolled as the file processes
- You'll see a completion summary

**Coming Soon:** CSV validation and error reports.

## Configuration & Settings

### Customize Your Site

Go to `/admin/hierarchy` → **Sites** tab → **Edit**

**Customizable Fields:**
- **Site Name** — Displayed on enrollment page
- **Domain** — Used for branded enrollment links
- **Primary Color** — Header background color (use hex code like `#1e3a5f`)
- **Welcome Message** — Shown to new members
- **Require Group Code** — Force members to enter a group code?
- **Allow Self-Enrollment** — Allow members without a group code?
- **Require Payment** — Make payment mandatory?
- **Auto-Activate** — Activate subscriptions immediately after payment?

**Save** your changes when done.

### Configure Enrollment Defaults

These control how the enrollment flow behaves for all members:

- **Require Group Code** — If enabled, new members must enter a valid group code
- **Require Eligibility Match** — If enabled, email must match an uploaded eligibility file
- **Allow Self-Enrollment** — Allow enrollment without group assignment
- **Require Payment** — Require payment to complete enrollment
- **Auto-Activate** — Automatically activate membership after payment

These are set per-site and can be adjusted from the **Sites** edit page.

## Features Coming Soon

The following features are in development and hidden from the current UI:

### Commission Tracking
- View broker commission calculations
- Export payroll reports
- Payment history per broker

### SFTP Vendor File Delivery
- Automatically send member files to dental networks
- Scheduled delivery
- Delivery confirmation reports

### AI Oral Scanning
- AI Oral Scanning integration for member health assessments
- Scan history and reports
- Teledentistry referrals

### Email Notifications
- Automated welcome emails
- Renewal reminders
- Payment notifications
- Member ID cards via email

### Bulk CSV Operations
- Better file validation
- Error reporting and retry
- Upload history

These features will be available in future updates. For urgent needs, contact support@getidealoh.com.

## Useful Platform URLs

**Public Pages:**
- `/health` — Landing page
- `/health/plans` — Plan listing
- `/health/enroll` — Enrollment flow
- `/health/sign-in` — Member sign-in

**Admin Pages:**
- `/admin` — Dashboard
- `/admin/members` — Member management
- `/admin/brokers` — Broker management
- `/admin/hierarchy` — Site/Account/Group setup
- `/admin/billing` — Revenue reports
- `/admin/users` — Admin access control
- `/admin/eligibility` — Bulk enrollment

## Troubleshooting

### I Can't Access `/admin` Panel

**Check these:**
1. Are you signed in? (`/health/sign-in`)
2. Are you an admin user? (Check `/admin/users` from another admin account)
3. Do you have the correct Clerk User ID set?

**Solution:**
- If you're the first admin, use `/admin/users` initialization
- If you're not listed as admin, ask another admin to add you

### Members Not Showing Up After Eligibility Upload

**Possible causes:**
1. Group code in CSV doesn't match a created group
2. Email format is incorrect
3. File upload failed silently

**Solution:**
- Verify group codes exist in `/admin/hierarchy`
- Check that emails are in correct format
- Try uploading a small test file first

### Stripe Payments Failing

**This could be:**
1. Production Stripe keys not configured
2. Webhook not reaching your server
3. Subscription plan not activated

**Solution:**
- Ask your platform administrator to check `.env` variables
- Check Stripe dashboard → Webhooks → Recent deliveries
- Verify plan is marked "active" in Stripe

### Broker Not Appearing in Dropdowns

**Possible causes:**
1. Broker hasn't been created yet
2. Broker was just created (refresh the page)

**Solution:**
- Go to `/admin/brokers` and verify broker exists
- Refresh the page in your browser
- Clear browser cache if issue persists

## Best Practices

1. **Regular Backups** — Convex auto-backs up data, but download member exports monthly
2. **Audit Admin Access** — Regularly review who has admin privileges
3. **Monitor Stripe** — Check Stripe dashboard monthly for failed payments
4. **Update Brokers** — Keep broker contact info current
5. **Document Groups** — Use clear group codes (e.g., `WEST-2024` instead of `G1`)
6. **Test Enrollment** — Each month, complete a test enrollment to ensure workflow still works

## Support & Resources

- **Platform Issues:** Email support@getidealoh.com
- **Deployment Help:** See `DEPLOYMENT_SETUP.md`
- **Stripe Account Issues:** Visit stripe.com/support
- **Clerk Authentication Issues:** Visit clerk.com/support

## Glossary

**Member** — A person enrolled in a health plan

**Broker** — Insurance representative or enrollment agent

**Group** — A division of members, often within one company

**Group Code** — A code members enter during enrollment (e.g., "WEST-2024")

**Site** — The top-level brand or organization

**Subscription** — The member's active subscription to a plan

**Stripe** — Payment processor handling all charges and refunds

**Convex** — Backend database storing all member and administrative data

---

## Appendix A: Member Status Lifecycle

Every member moves through this pipeline. Status drives billing, eligibility output, and what self-service the member sees.

| Status | Meaning |
| --- | --- |
| `lead` | Captured contact (e.g., inquiry form). No enrollment started. |
| `eligible` | Loaded via eligibility file. Has not self-enrolled yet. |
| `invited` | Sent re-enroll / activation link. Awaiting action. |
| `enrolling` | Actively in the checkout / signup flow. |
| `active` | Paid and currently entitled to benefits. Counts in billing. |
| `past_due` | Stripe payment failed; in retry window. Still entitled during grace. |
| `inactive` | No active subscription. Dormant. |
| `terminated` | Removed from program. Excluded from billing. |
| `declined` | Eligibility rejected (duplicate, invalid data, restriction). |

## Appendix B: Roles

- **Owner** — Full access including Dev Tools and admin user management. Always keep at least one.
- **Editor** — Day-to-day operator. Can manage members, hierarchy, eligibility, billing. Cannot manage other admins or use Dev Tools.

Departments (organizational tag, not a permission gate): `admin`, `program_manager`, `fmo`, `broker`.

## Appendix C: Hierarchy Vocabulary Cheat Sheet

The codebase mixes legacy and current names. They refer to the same things:

| UI Term | Legacy / Code Term |
| --- | --- |
| Site | Carrier / Whitelabel |
| Account | Broker / Distribution Partner |
| Group | Organization / Employer |

## Appendix D: Billing Concepts

- **Self-Pay** — Member pays own subscription via Stripe (default).
- **List-Bill** — Sponsor (employer) pays one consolidated invoice for many members. No member-side Stripe charges.
- **Bundle** — Subscription wrapping one or more product entitlements (e.g., Dental Discount + Toothlens AI).
- **E123** — External billing import format used by finance.
- **Past Due** — Stripe automatic retry window. Member retains entitlement during grace.

## Appendix E: Where to Find Things Quickly

| Task | Page |
| --- | --- |
| See real-time KPIs / alerts | `/admin` |
| Find a specific member | `/admin/members` (search) |
| Bulk-add members | `/admin/eligibility` |
| Investigate cross-system identity | `/admin/user-audit` |
| Refund a member | `/admin/customer-service` |
| Add a broker / employer | `/admin/hierarchy` |
| Generate vendor file (DialCare, DDN) | `/admin/vendor-files` |
| Manage list-billed groups | `/admin/list-bill` |
| Onboard a new admin | `/admin/users` |
| Branding / site config | `/admin/settings` |
| Vocabulary reference | `/admin/help` |

## Appendix F: Common Gotchas

- **Group Codes are globally unique** — not just per Account.
- **Eligibility upload is idempotent** — by `email + dateOfBirth`. Re-uploading updates rather than duplicates.
- **Termination ≠ refund** — terminating a member does not refund Stripe charges. Use Customer Service for refunds.
- **Dev Tools is owner-only and hidden from editors.**
- **First Admin Initialize** only works when there are zero admins. After that, an existing owner must invite.
