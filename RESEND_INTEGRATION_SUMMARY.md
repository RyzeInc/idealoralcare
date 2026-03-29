# Resend Email Integration Summary

## Overview
Ideal Oral Health uses **Resend** (v6.9.3) for transactional email fulfillment. Emails are sent via Convex actions integrated with the enrollment and membership lifecycle.

---

## 1. Configuration & Environment Variables

### Location: `.env.local`

```env
RESEND_API_KEY=re_QyYUnSqQ_5XfLypAesBXGezP5Tz1TD1oy
RESEND_FROM_EMAIL=noreply@getidealoh.com
INTERNAL_API_SECRET=czY8wkNuZlHGAs78t5Fy2hbUoWoRSQjm08al+tFYFYY=
```

### Env Vars Explanation:
- **RESEND_API_KEY**: API authentication key from [resend.com](https://resend.com)
- **RESEND_FROM_EMAIL**: Sender email address (currently using default `noreply@getidealoh.com`, can be verified domain)
- **INTERNAL_API_SECRET**: Shared secret between Convex and Next.js API for PDF generation security

---

## 2. Resend Email Actions

### File: [convex/legal/emailFulfillment.ts](convex/legal/emailFulfillment.ts)

**5 Exported Email Actions:**

#### 1. `sendFulfillmentPacketEmail(args)`
**Purpose:** Send 4-page membership packet PDF + cover email

**Triggered:** After successful enrollment completion

**Flow:**
1. Calls Next.js API `/api/generate-fulfillment-pdf` to generate PDF
2. PDF is rendered server-side using `@react-pdf/renderer`
3. Sends email via Resend with PDF attachment

**Args:**
```typescript
{
  memberName: string;
  memberFirstName: string;
  memberEmail: string;
  memberId: string;
  planName: string;
  groupCode: string;
  effectiveDate: string;
  subscriberId?: string;
  term?: string;
  memberAddress?: string;
  periodicCharge?: string;
  processingFee?: string;
  memberServicesPhone?: string;
  memberWebsite?: string;
  appUrl?: string; // Override for testing/staging
}
```

**Return:** `{ success: true, emailId: string }`

---

#### 2. `sendMembershipWelcomeEmail(args)` 
**Purpose:** Welcome/onboarding email with member details

**Args:**
```typescript
{
  memberName: string;
  memberEmail: string;
  planName: string;
  effectiveDate: string;
  memberId: string;
}
```

---

#### 3. `sendMembershipConfirmationEmail(args)`
**Purpose:** Enrollment summary with billing details

**Args:**
```typescript
{
  memberName: string;
  memberEmail: string;
  memberId: string;
  planName: string;
  groupCode: string;
  effectiveDate: string;
  processingFee?: string;
  billingAmount?: string;
}
```

---

#### 4. `sendMembershipCancelledEmail(args)`
**Purpose:** Cancellation confirmation

**Args:**
```typescript
{
  memberName: string;
  memberEmail: string;
  memberId: string;
  refundAmount?: string;
}
```

---

#### 5. `sendDependentInviteEmail(args)`
**Purpose:** Family member invitation with claim link (30-day expiry)

**Args:**
```typescript
{
  dependentName: string;
  dependentEmail: string;
  primaryMemberName: string;
  planName: string;
  inviteToken: string;
  appUrl?: string;
}
```

---

## 3. Email Templates

### File: [src/email-templates/membershipEmails.ts](src/email-templates/membershipEmails.ts)

**Email Templates Defined:**
1. `membershipWelcome` - Welcome with benefits overview
2. `membershipConfirmation` - Enrollment summary with plan details
3. `membershipCancelled` - Cancellation details
4. `dependentInvite` - Family member claim invitation

All templates:
- Use HTML with inline styling
- Responsive design (max-width: 600px)
- Include branded header and footer
- Have brand colors (purple gradient, teal)
- Include contact links (phone, email)

**Helper Function:**
```typescript
getEmailTemplate(
  templateType: "welcome" | "confirmation" | "cancelled" | "dependent-invite",
  memberData: any
)
```

---

## 4. PDF Generation

### File: [src/app/api/generate-fulfillment-pdf/route.ts](src/app/api/generate-fulfillment-pdf/route.ts)

**Endpoint:** `POST /api/generate-fulfillment-pdf`

**Security:** Requires `Authorization: Bearer {INTERNAL_API_SECRET}` header

**Request Body:** FulfillmentPacketData
```typescript
{
  memberName: string;
  memberId: string;
  effectiveDate: string;
  memberFirstName: string;
  memberEmail: string;
  groupCode: string;
  planName: string;
  subscriberId?: string;
  term?: string;
  memberAddress?: string;
  periodicCharge?: string;
  processingFee?: string;
  memberServicesPhone?: string;
  memberWebsite?: string;
  logoDataUri?: string;
}
```

**Response:** 
```json
{
  "pdf": "<base64-encoded-pdf>"
}
```

**Error Handling:**
- 401: Unauthorized (missing/invalid API secret)
- 400: Missing required fields or invalid JSON
- 500: PDF generation failed

---

## 5. Email Sending Flow (Complete)

### Step 1: Trigger Point
Email actions are called from Convex mutations after enrollment completion:

```typescript
// Example from enrollment flow
await action(api.legal.emailFulfillment.sendFulfillmentPacketEmail, {
  memberName: member.fullName,
  memberFirstName: member.firstName,
  memberEmail: member.email,
  memberId: member._id,
  planName: plan.name,
  groupCode: plan.groupCode,
  effectiveDate: formatDate(effectiveDate),
  // ... other fields
});
```

### Step 2: Actions Execute
Convex actions make HTTP POST to Resend API:

```typescript
const emailResponse = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
  },
  body: JSON.stringify({
    from: "Ideal Oral Health <noreply@getidealoh.com>",
    to: args.memberEmail,
    subject: "...",
    html: htmlContent,
    attachments: [...], // For fulfillment packet
  }),
});
```

### Step 3: Response Handling
```typescript
if (!emailResponse.ok) {
  throw new Error(`Resend API error: ${emailResponse.statusText}`);
}
const emailData = await emailResponse.json();
return { success: true, emailId: emailData.id };
```

---

## 6. Resend API Integration

### Direct API Integration (No SDK)
The codebase uses **direct HTTP calls** to `https://api.resend.com/emails` rather than the Resend Node.js SDK.

**Why:** Allows fine-grained control in Convex action environment and PDF attachment handling.

### Key Headers:
```
Authorization: Bearer {RESEND_API_KEY}
Content-Type: application/json
```

### Email Body Format:
```json
{
  "from": "Sender Name <sender@domain.com>",
  "to": "recipient@example.com",
  "subject": "Subject Line",
  "html": "<html>...</html>",
  "attachments": [
    {
      "filename": "Ideal_Oral_Health_Membership_Packet.pdf",
      "content": "base64-encoded-content"
    }
  ]
}
```

---

## 7. Email File Locations

```
/Users/nellus/Documents/Repositories/idealoralcare/
├── convex/legal/emailFulfillment.ts          # ← Main email actions (5 exported functions)
├── src/email-templates/membershipEmails.ts    # ← Email templates
├── src/app/api/generate-fulfillment-pdf/route.ts  # ← PDF generation endpoint
├── src/lib/fulfillment-pdf.tsx               # ← PDF React component
└── .env.local                                 # ← Resend API key + config
```

---

## 8. Fulfillment Packet PDF

### File: [src/lib/fulfillment-pdf.tsx](src/lib/fulfillment-pdf.tsx)

**Purpose:** 4-page compliance document sent with enrollment

**Pages:**
1. Cover page with member info
2. Terms & conditions
3. Plan details & benefits
4. Cancellation policy

**Uses:** `@react-pdf/renderer` (server-side PDF generation)

---

## 9. Sending Workflow Summary

```
User completes enrollment
        ↓
Enrollment mutation stored to database
        ↓
Trigger: sendFulfillmentPacketEmail()
        ↓
Step 1: Call /api/generate-fulfillment-pdf
        ├─ Fetch logo from public/
        ├─ Render FulfillmentPacketPdf component
        ├─ Convert to PDF buffer
        └─ Return as base64
        ↓
Step 2: Call Resend API with PDF attachment
        ├─ Auth: Bearer {RESEND_API_KEY}
        ├─ Body: Email + HTML + base64 PDF
        └─ Return: { id: "email_..." }
        ↓
Email delivered to member
```

---

## 10. Testing/Configuration

### Environment Setup for Local Dev:
1. Ensure `.env.local` has valid `RESEND_API_KEY`
2. Set `NEXT_PUBLIC_APP_URL=http://localhost:3000` for local development
3. Consider setting `INTERNAL_API_SECRET` for API route security (optional in dev)

### Testing Email Sends:
```typescript
// Direct Convex action invocation in tests/components
const result = await action(api.legal.emailFulfillment.sendMembershipWelcomeEmail, {
  memberName: "Test User",
  memberEmail: "test@example.com",
  planName: "Ideal Dental Plus",
  effectiveDate: "2024-03-29",
  memberId: "100000001",
});
```

### Resend Domain Verification (Optional):
- Currently uses default sender: `noreply@getidealoh.com`
- Can verify custom domain in Resend Dashboard for higher deliverability
- Add DNS CNAME records as indicated by Resend

---

## 11. Error Handling

### Common Errors:
1. **Missing RESEND_API_KEY**
   - Fix: Add to `.env.local`
   - Warning logged: `"RESEND_API_KEY not configured..."`

2. **Invalid API Key**
   - Response: 401 Unauthorized
   - Error: `Resend API error: Unauthorized`

3. **PDF Generation Timeout**
   - Fix: Check if logo file exists at `public/ideal-oral-health-logo.png`
   - Retry with smaller PDF or increase timeout

4. **Missing Required Fields**
   - Error: `memberName, memberId, and effectiveDate are required`
   - Fix: Validate args before calling action

---

## 12. Convex API Type Definitions

### Generated Types: [convex/_generated/api.d.ts](convex/_generated/api.d.ts)

Email actions available via generated Convex API:

```typescript
import { api } from "@/convex/_generated/api";

api.legal.emailFulfillment.sendFulfillmentPacketEmail
api.legal.emailFulfillment.sendMembershipWelcomeEmail
api.legal.emailFulfillment.sendMembershipConfirmationEmail
api.legal.emailFulfillment.sendMembershipCancelledEmail
api.legal.emailFulfillment.sendDependentInviteEmail
```

---

## 13. Key Points Summary

| Aspect | Details |
|--------|---------|
| **API Provider** | Resend (v6.9.3) |
| **Integration Type** | Direct HTTP (no SDK) |
| **Authentication** | Bearer token (RESEND_API_KEY) |
| **Sender** | noreply@getidealoh.com |
| **Email Types** | 5 actions (fulfillment, welcome, confirmation, cancellation, dependent invite) |
| **Attachments** | PDF (base64-encoded) |
| **PDF Generation** | @react-pdf/renderer (server-side) |
| **Error Handling** | Try-catch with descriptive messages |
| **Testing** | Use appUrl override in actions for staging |
| **Compliance** | 4-page fulfillment packet included |

---

## Related Documentation

- [Legal Implementation Summary](LEGAL_IMPLEMENTATION_SUMMARY.md)
- [src/legal/README.md](src/legal/README.md)
- [Resend Official Docs](https://resend.com/docs)
