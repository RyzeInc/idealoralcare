# Ideal Oral Health - Legal Documents & Compliance System

## Overview

This system implements comprehensive legal document handling for Ideal Oral Health membership enrollment, including:

- **Membership Agreements** - Digital agreements with signature capture
- **Terms & Conditions** - Scrollable T&C modals with mandatory acceptance
- **Disclosures** - Footer disclosures on all pages
- **Marketing/Fulfillment Language** - Accurate descriptions of Careington POS and DialCare services
- **Email Fulfillment** - Automated emails via Resend

## File Structure

```
src/
├── legal/
│   ├── DISCLOSURE.md                    # Footer disclosure content
│   ├── TERMS_AND_CONDITIONS.md          # Full T&C document
│   ├── MEMBERSHIP_AGREEMENT.md          # Template with dynamic fields
│   └── MARKETING_FULFILLMENT_LANGUAGE.md # Service descriptions
├── components/legal/
│   ├── MembershipAgreementModal.tsx    # Signature & agreement modal
│   ├── TermsAndConditionsModal.tsx     # T&C modal with scroll requirement
│   ├── CheckoutFlow.tsx                 # Manages entire checkout flow
│   ├── FooterDisclosure.tsx             # Footer component
│   └── index.ts                         # Main exports
└── email-templates/
    └── membershipEmails.ts              # Email templates

convex/
├── legal/
│   ├── membershipAgreements.ts         # Convex functions for agreements
│   └── emailFulfillment.ts             # Resend email actions
└── schema.ts                           # Updated with membershipAgreements table
```

## Key Features

### 1. Membership Agreement Modal

**Component:** `MembershipAgreementModal.tsx`

- Displays member information (ID, name, address, email)
- Shows plan details (name, code, effective date, billing info)
- Terms summary with key agreement points
- Signature pad with clear/save functionality
- Two required checkboxes for acceptance
- Scroll-to-bottom requirement before enabling "I Agree & Sign"

**Usage:**
```tsx
import { MembershipAgreementModal } from "@/components/legal";

<MembershipAgreementModal
  isOpen={showAgreement}
  onClose={() => setShowAgreement(false)}
  onAccept={(signature) => handleSignatureSave(signature)}
  memberData={{
    memberId: "CARE-1234567",
    memberName: "John Doe",
    memberAddress: "123 Main St, City, State 12345",
    email: "john@example.com",
    planName: "Ideal Dental Plus",
    groupCode: "GROUP001",
    effectiveDate: new Date().toISOString().split('T')[0],
  }}
/>
```

### 2. Terms & Conditions Modal

**Component:** `TermsAndConditionsModal.tsx`

- Full T&C content in scrollable container
- Covers purchase, renewal, termination, and cancellation conditions
- Service descriptions (Careington POS + DialCare)
- Limitations and exclusions
- Complaint procedures
- Single checkbox for acceptance
- Scroll-to-bottom requirement before enabling button
- Disabled unless scrolled to bottom

**Usage:**
```tsx
import { TermsAndConditionsModal } from "@/components/legal";

<TermsAndConditionsModal
  isOpen={showTerms}
  onClose={() => setShowTerms(false)}
  onAccept={() => handleTermsAccepted()}
/>
```

### 3. Checkout Flow Component

**Component:** `CheckoutFlow.tsx`

Manages the entire checkout legal flow:

1. **Start** - User clicks "Review & Sign Membership Agreement"
2. **Step 1** - Membership agreement modal appears (signature required)
3. **Step 2** - After signing, terms & conditions modal appears (checkbox required)
4. **Complete** - Both steps done, checkout button becomes enabled

- Shows status indicators (✓ or ○) for each requirement
- Grayed-out "Complete Enrollment" button until both steps done
- Handles back navigation between modals
- Calls `onCheckoutComplete` with all agreement data

**Usage:**
```tsx
import { CheckoutFlow } from "@/components/legal";

<CheckoutFlow
  memberData={memberData}
  onCheckoutComplete={async (agreementData) => {
    // Save to Convex and create membership
    await createMembershipAgreement(agreementData);
    // Send emails
    await sendWelcomeEmail(memberData);
  }}
  isLoading={isProcessing}
/>
```

### 4. Footer Disclosure

**Component:** `FooterDisclosure.tsx`

- Displays on every page footer
- Main insurance disclaimer
- Company contact info (phone, email, locations)
- Careington and DialCare provider info
- Links to full legal documents
- Last updated timestamp

**Usage:**
```tsx
import { FooterDisclosure } from "@/components/legal";

// In your layout or bottom of pages
<FooterDisclosure />
```

## Database Schema

### membershipAgreements Table

```typescript
{
  // Member identity
  userId: string,           // Clerk user ID
  memberId: string,         // Careington API member ID
  memberName: string,
  memberAddress: string,
  email: string,

  // Plan details
  planName: string,
  groupCode: string,
  term: string,            // "Annual", "Monthly", etc.
  effectiveDate: string,   // YYYY-MM-DD

  // Billing
  classification: string,
  paymentMode: string,
  periodicCharge: string,
  processingFee: string,

  // Agreement acceptance
  membershipTermsAgreed: boolean,
  termsAndConditionsAgreed: boolean,
  memberSignature: string, // Signature image/data
  signatureTimestamp: number,

  // Status tracking
  status: "active" | "cancelled" | "expired",
  cancelReason?: string,

  // Audit
  createdAt: number,
  lastUpdated?: number,
}
```

**Indexes:**
- `by_userId` - Find agreements by Clerk user
- `by_memberId` - Find agreements by Careington member ID
- `by_email` - Find agreements by email
- `by_status` - Query by status
- `by_date` - Sort by creation date

## Convex Functions

### membershipAgreements.ts

#### `createMembershipAgreement(args)`
Creates a new membership agreement record.

```typescript
const result = await mutation(
  api.legal.membershipAgreements.createMembershipAgreement,
  {
    userId: user.id,
    memberId: careingtonMemberId,
    memberName: "John Doe",
    memberAddress: "123 Main St, City, State 12345",
    email: "john@example.com",
    planName: "Ideal Dental Plus",
    groupCode: "GROUP001",
    membershipTermsAgreed: true,
    termsAndConditionsAgreed: true,
    memberSignature: signatureDataUrl,
    signatureTimestamp: Date.now(),
  }
);
// Returns: { success: true, agreementId: "...", effectiveDate: "YYYY-MM-DD" }
```

#### `getMembershipAgreement(agreementId)`
Retrieves a specific agreement.

```typescript
const agreement = await query(
  api.legal.membershipAgreements.getMembershipAgreement,
  { agreementId: "..." }
);
```

#### `getMembershipAgreementByUserId(userId)`
Retrieves all agreements for a user (sorted by newest first).

```typescript
const agreements = await query(
  api.legal.membershipAgreements.getMembershipAgreementByUserId,
  { userId: user.id }
);
```

#### `getMembershipAgreementByMemberId(memberId)`
Retrieves agreement for a Careington member ID.

```typescript
const agreement = await query(
  api.legal.membershipAgreements.getMembershipAgreementByMemberId,
  { memberId: "CARE-123456" }
);
```

#### `validateMembershipAgreement(agreementId)`
Validates that an agreement is complete and active.

```typescript
const validation = await query(
  api.legal.membershipAgreements.validateMembershipAgreement,
  { agreementId: "..." }
);
// Returns: { valid: true, agreement: {...} } or { valid: false, error: "..." }
```

#### `updateMembershipAgreementStatus(agreementId, status, cancelReason?)`
Updates agreement status (e.g., when member cancels).

```typescript
await mutation(
  api.legal.membershipAgreements.updateMembershipAgreementStatus,
  {
    agreementId: "...",
    status: "cancelled",
    cancelReason: "Member requested cancellation",
  }
);
```

### emailFulfillment.ts

All email functions use Resend API. Configure `RESEND_API_KEY` in `.env.local`

#### `sendMembershipWelcomeEmail(args)`
Sends welcome email after successful enrollment.

```typescript
await action(api.legal.emailFulfillment.sendMembershipWelcomeEmail, {
  memberName: "John Doe",
  memberEmail: "john@example.com",
  planName: "Ideal Dental Plus",
  effectiveDate: "2026-03-08",
  memberId: "CARE-123456",
});
```

#### `sendMembershipConfirmationEmail(args)`
Sends detailed confirmation with enrollment summary.

```typescript
await action(api.legal.emailFulfillment.sendMembershipConfirmationEmail, {
  memberName: "John Doe",
  memberEmail: "john@example.com",
  memberId: "CARE-123456",
  planName: "Ideal Dental Plus",
  groupCode: "GROUP001",
  effectiveDate: "2026-03-08",
  processingFee: "$5.00",
  billingAmount: "$29.99",
});
```

#### `sendMembershipCancelledEmail(args)`
Sends cancellation confirmation.

```typescript
await action(api.legal.emailFulfillment.sendMembershipCancelledEmail, {
  memberName: "John Doe",
  memberEmail: "john@example.com",
  memberId: "CARE-123456",
  refundAmount: "$24.99",
});
```

## Integration Guide

### Step 1: Setup Environment

Add to `.env.local`:
```env
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

Get your key from [resend.com](https://resend.com)

### Step 2: Add to Checkout Page

```tsx
import { CheckoutFlow } from "@/components/legal";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export function CheckoutPage() {
  const createAgreement = useMutation(api.legal.membershipAgreements.createMembershipAgreement);
  const sendWelcomeEmail = useMutation(api.legal.emailFulfillment.sendMembershipWelcomeEmail);
  const [isLoading, setIsLoading] = useState(false);

  const memberData = {
    memberId: careingtonMemberId,
    memberName: user.fullName,
    memberAddress: user.address,
    email: user.email,
    planName: selectedPlan.name,
    groupCode: selectedPlan.groupCode,
    effectiveDate: new Date().toISOString().split('T')[0],
  };

  const handleCheckoutComplete = async (agreementData) => {
    setIsLoading(true);
    try {
      // 1. Create membership agreement in Convex
      const result = await createAgreement({
        userId: user.id,
        memberId: memberData.memberId,
        memberName: memberData.memberName,
        memberAddress: memberData.memberAddress,
        email: memberData.email,
        planName: memberData.planName,
        groupCode: memberData.groupCode,
        membershipTermsAgreed: agreementData.membershipTermsSigned,
        termsAndConditionsAgreed: agreementData.termsAndConditionsAgreed,
        memberSignature: agreementData.memberSignature,
        signatureTimestamp: Date.now(),
      });

      // 2. Send welcome email
      await sendWelcomeEmail({
        memberName: memberData.memberName,
        memberEmail: memberData.email,
        planName: memberData.planName,
        effectiveDate: result.effectiveDate,
        memberId: memberData.memberId,
      });

      // 3. Redirect to success
      router.push("/enrollment/success");
    } catch (error) {
      console.error("Checkout failed:", error);
      alert("There was an error processing your enrollment. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h1>Complete Your Enrollment</h1>
      <CheckoutFlow
        memberData={memberData}
        onCheckoutComplete={handleCheckoutComplete}
        isLoading={isLoading}
      />
    </div>
  );
}
```

### Step 3: Add Footer to Layout

```tsx
import { FooterDisclosure } from "@/components/legal";

export function Layout({ children }) {
  return (
    <div>
      <main>{children}</main>
      <FooterDisclosure />
    </div>
  );
}
```

### Step 4: Create Legal Pages (Optional)

- `/legal/disclosure` - Full disclosure page
- `/legal/terms-conditions` - Full T&C page
- `/legal/marketing-language` - Service descriptions

View the markdown files in `src/legal/` for content.

## Email Configuration

### From Address

Currently configured as: `Ideal Oral Health <noreply@getidealoh.com>`

To use this, you need to:
1. Verify the domain in [Resend Dashboard](https://resend.com)
2. Add DNS records as instructed

Or use Resend's default domain:
```
Ideal Oral Health <onboarding@resend.dev>
```

## Field Mapping Reference

### Membership Agreement Dynamic Fields

| Template Field | Data Source | Example |
|---|---|---|
| `{{memberId}}` | Careington API | `CARE-1234567` |
| `{{memberName}}` | Clerk user profile | `John Doe` |
| `{{memberAddress}}` | Enrollment form | `123 Main St...` |
| `{{planName}}` | Plan selection | `Ideal Dental Plus` |
| `{{groupCode}}` | Plan metadata | `GROUP001` |
| `{{term}}` | Plan config | `Annual` |
| `{{effectiveDate}}` | Current date | `2026-03-08` |
| `{{classification}}` | Plan metadata | `Standard` |
| `{{paymentMode}}` | Checkout state | `Credit Card` |
| `{{periodicCharge}}` | Plan pricing | `$29.99` |
| `{{processingFee}}` | Config/TBD | `$5.00` |

## Testing Checklist

- [ ] Membership agreement modal displays correctly
- [ ] Signature pad captures signature
- [ ] Both checkboxes required before enabling button
- [ ] Must scroll to bottom to see "I Agree & Sign"
- [ ] Terms & conditions modal shows full content
- [ ] Must scroll to bottom to check acceptance box
- [ ] Checkout button disabled until both modals completed
- [ ] Checkout button re-enables after completing flow
- [ ] Welcome email sends with correct member data
- [ ] Confirmation email shows billing details
- [ ] Footer disclosure appears on all pages
- [ ] Contact links work (phone, email)

## Company Information (Already Configured)

**Ideal Oral Health**
- Phone: 801-820-0010
- Email: info@getidealoh.com
- Locations:
  - Northeast: 116 S. Main St, Wallingford CT 06492
  - Southern: 800 S Gay St STE 700, Knoxville TN 37929
  - Texas: 1200 E Ridge Rd STE 1, McAllen TX 78503

**Service Partners**
- Careington: (800) 290-0523, www.careington.com
- DialCare: (855) 335-2255, dialcare.com

## Updates & Maintenance

### Updating Legal Documents

1. Edit markdown files in `src/legal/`
2. Changes auto-reflect in:
   - Footer disclosure
   - Related pages
   - Email templates use same content

### Updating Contact Information

Update in multiple places:
1. `FooterDisclosure.tsx` - Display component
2. `membershipEmails.ts` - Email templates
3. `src/legal/*.md` - Document files

### Processing Fee Changes

Once hardcoded (currently TBD):

1. Update in agreement creation function
2. Update in email templates
3. Update in modal component display

---

_Last Updated: March 2026_
