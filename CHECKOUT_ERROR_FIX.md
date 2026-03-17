# Checkout Error Fix: Member Profile Linking Issue

## Problem
After checkout, the `getMyDependents` query was failing with:
```
[CONVEX Q(enrollment/dependents:getMyDependents)] Server Error
```

## Root Cause
The member profile was being created during the Stripe webhook (`webhookCreateMemberProfile`) **without the Clerk user ID** being set. This caused:

1. The member profile to be created in the database
2. The profile's `customerId` field to be `undefined` (not linked to any Clerk user)
3. When `FamilySection` component loaded and called `getMyDependents`, it searched for profiles by `customerId`
4. The query couldn't find the newly created member profile (since it had no `customerId`)
5. Server error when trying to access properties on undefined data

### Code Flow
```
User completes checkout
  ↓
Stripe → POST /api/stripe/webhook
  ↓
webhookCreateMemberProfile() called WITHOUT clerkUserId
  ↓
Member profile created with customerId = undefined
  ↓
User redirected to /health/dashboard
  ↓
FamilySection → useQuery(getMyDependents)
  ↓
Query searches: memberProfiles WHERE customerId = user123 (NOT FOUND!)
  ↓
Error: Cannot read properties of undefined
```

## Solution
Updated three member profile creation functions to properly link the Clerk user ID:

### 1. `webhookCreateMemberProfile` (Stripe webhook)
**File:** `convex/enrollment/members.ts`
- Added `customerId: v.optional(v.string())` parameter
- Sets `customerId: args.customerId` when inserting the profile

**File:** `src/app/api/stripe/webhook/route.ts`
- Now passes `customerId: clerkUserId` to the webhook function

### 2. `createMemberProfile` (authenticated users)
**File:** `convex/enrollment/members.ts`
- Changed `await requireAuth(ctx)` to `const identity = await requireAuth(ctx)`
- Now sets `customerId: identity.clerkUserId` when inserting

### 3. `internalCreateMemberProfile` (backend operations)
**File:** `convex/enrollment/members.ts`
- Added `customerId: v.optional(v.string())` parameter
- Sets `customerId: args.customerId` when inserting

## Verification
After these fixes, the flow works correctly:

```
User completes checkout
  ↓
Stripe webhook calls webhookCreateMemberProfile(customerId: user123)
  ↓
Member profile created with customerId = user123 ✓
  ↓
User sees dashboard
  ↓
FamilySection → useQuery(getMyDependents)
  ↓
Query searches: memberProfiles WHERE customerId = user123 (FOUND!) ✓
  ↓
Dependents list displays successfully
```

## Files Modified
1. `convex/enrollment/members.ts` - Updated all three member profile creation functions
2. `src/app/api/stripe/webhook/route.ts` - Added `customerId` parameter to webhook call
3. `convex/enrollment/dependents.ts` - Added error logging for debugging
4. `src/components/health/FamilySection.tsx` - Added error state handling

## Testing
After deployment, test the full checkout flow:
1. Complete a checkout to a new account
2. Verify the member profile is created with the Clerk user ID
3. Confirm the dashboard loads without errors
4. Verify the Family Members section displays correctly
