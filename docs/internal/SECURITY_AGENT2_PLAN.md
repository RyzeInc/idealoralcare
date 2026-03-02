# Security Agent 2 — Convex Backend Auth & Access Control

**Scope**: All files under `convex/`  
**Goal**: Add authentication and authorization checks to every Convex query and mutation that handles sensitive data  
**Dependencies**: None (fully independent)

---

## Task List

| # | Task | Files | Severity |
|---|---|---|---|
| 1 | Create shared auth guard helpers | `convex/lib/authGuards.ts` (NEW) | CRITICAL |
| 2 | Fix `convex/auth.ts` stub | `convex/auth.ts` | HIGH |
| 3 | Lock down `convex/admin/adminUsers.ts` | `convex/admin/adminUsers.ts` | CRITICAL |
| 4 | Lock down `convex/admin/members.ts` | `convex/admin/members.ts` | CRITICAL |
| 5 | Lock down `convex/admin/hierarchy.ts` | `convex/admin/hierarchy.ts` | CRITICAL |
| 6 | Lock down `convex/admin/eligibility.ts` | `convex/admin/eligibility.ts` | CRITICAL |
| 7 | Lock down `convex/admin/billing.ts` | `convex/admin/billing.ts` | CRITICAL |
| 8 | Lock down `convex/admin/vendorFiles.ts` | `convex/admin/vendorFiles.ts` | CRITICAL |
| 9 | Lock down `convex/admin/sftpDelivery.ts` | `convex/admin/sftpDelivery.ts` | CRITICAL |
| 10 | Lock down `convex/admin/notifications.ts` | `convex/admin/notifications.ts` | CRITICAL |
| 11 | Lock down `convex/admin/siteSettings.ts` | `convex/admin/siteSettings.ts` | CRITICAL |
| 12 | Lock down `convex/admin/teamMembers.ts` | `convex/admin/teamMembers.ts` | CRITICAL |
| 13 | Lock down `convex/admin/commissions.ts` | `convex/admin/commissions.ts` | CRITICAL |
| 14 | Lock down `convex/admin/memberCards.ts` | `convex/admin/memberCards.ts` | CRITICAL |
| 15 | Lock down `convex/admin/navigation.ts` | `convex/admin/navigation.ts` | CRITICAL |
| 16 | Lock down `convex/admin/ventures.ts` | `convex/admin/ventures.ts` | CRITICAL |
| 17 | Lock down `convex/admin/coreValues.ts` | `convex/admin/coreValues.ts` | CRITICAL |
| 18 | Fix IDOR in `convex/subscriptions/queries.ts` | `convex/subscriptions/queries.ts` | HIGH |
| 19 | Lock down `convex/subscriptions/mutations.ts` | `convex/subscriptions/mutations.ts` | CRITICAL |
| 20 | Lock down `convex/subscriptions/entitlements.ts` | `convex/subscriptions/entitlements.ts` | CRITICAL |
| 21 | Protect `convex/subscriptions/events.ts` | `convex/subscriptions/events.ts` | HIGH |
| 22 | Protect `convex/catalog/mutations.ts` | `convex/catalog/mutations.ts` | HIGH |
| 23 | Add auth to `convex/enrollment/members.ts` | `convex/enrollment/members.ts` | MEDIUM |
| 24 | Protect admin queries in `convex/contacts.ts` | `convex/contacts.ts` | HIGH |
| 25 | Protect admin queries in `convex/inquiries.ts` | `convex/inquiries.ts` | HIGH |
| 26 | Protect admin queries in `convex/newsletter.ts` | `convex/newsletter.ts` | HIGH |

---

## Task 1: Create `convex/lib/authGuards.ts` (NEW FILE)

This is the foundation all other tasks depend on. Create a reusable module with auth checking helpers.

### File: `convex/lib/authGuards.ts`

```typescript
/**
 * AUTH GUARDS
 *
 * Centralized authentication and authorization helpers for Convex functions.
 * Every sensitive query/mutation should call one of these at the top of its handler.
 *
 * Pattern:
 *   const identity = await requireAuth(ctx);       // Any logged-in user
 *   const identity = await requireAdmin(ctx);      // Must be in adminUsers table
 *   await requireSelf(ctx, customerId);            // Must match the authenticated user
 */

import type { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";

type AnyCtx = QueryCtx | MutationCtx;

export interface AuthIdentity {
  /** Clerk token identifier (e.g., "https://clerk.your-domain.com|user_xxx") */
  tokenIdentifier: string;
  /** Clerk user ID extracted from tokenIdentifier (e.g., "user_xxx") */
  clerkUserId: string;
  /** User's email from Clerk */
  email?: string;
  /** User's name from Clerk */
  name?: string;
}

/**
 * Extract Clerk user ID from the tokenIdentifier
 * tokenIdentifier format: "https://domain.clerk.accounts.dev|user_xxxxx"
 */
function extractClerkUserId(tokenIdentifier: string): string {
  const parts = tokenIdentifier.split("|");
  return parts[parts.length - 1];
}

/**
 * Require authentication — throws if user is not logged in.
 * Returns the user's identity with Clerk user ID extracted.
 */
export async function requireAuth(ctx: AnyCtx): Promise<AuthIdentity> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthorized: Authentication required");
  }

  return {
    tokenIdentifier: identity.tokenIdentifier,
    clerkUserId: extractClerkUserId(identity.tokenIdentifier),
    email: identity.email ?? undefined,
    name: identity.name ?? undefined,
  };
}

/**
 * Require admin role — throws if user is not in the adminUsers table.
 * First checks authentication, then verifies admin status.
 * Returns the admin's identity.
 */
export async function requireAdmin(ctx: AnyCtx): Promise<AuthIdentity> {
  const identity = await requireAuth(ctx);

  const admin = await (ctx as QueryCtx).db
    .query("adminUsers")
    .withIndex("by_clerk_id", (q: any) => q.eq("clerkUserId", identity.clerkUserId))
    .first();

  if (!admin) {
    throw new Error("Unauthorized: Admin role required");
  }

  return identity;
}

/**
 * Require that the authenticated user matches the given customerId.
 * Used to prevent IDOR — users can only access their own data.
 * Admins bypass this check.
 */
export async function requireSelf(ctx: AnyCtx, customerId: string): Promise<AuthIdentity> {
  const identity = await requireAuth(ctx);

  if (identity.clerkUserId !== customerId) {
    // Check if admin — admins can access any user's data
    const admin = await (ctx as QueryCtx).db
      .query("adminUsers")
      .withIndex("by_clerk_id", (q: any) => q.eq("clerkUserId", identity.clerkUserId))
      .first();

    if (!admin) {
      throw new Error("Unauthorized: You can only access your own data");
    }
  }

  return identity;
}

/**
 * Get the authenticated user's Clerk ID, or null if not authenticated.
 * Non-throwing version for optional auth contexts.
 */
export async function getAuthenticatedUserId(ctx: AnyCtx): Promise<string | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return extractClerkUserId(identity.tokenIdentifier);
}

/**
 * Require authentication for Convex actions (different context type).
 * Actions use ctx.auth differently but the pattern is the same.
 */
export async function requireAuthAction(ctx: ActionCtx): Promise<AuthIdentity> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthorized: Authentication required");
  }

  return {
    tokenIdentifier: identity.tokenIdentifier,
    clerkUserId: extractClerkUserId(identity.tokenIdentifier),
    email: identity.email ?? undefined,
    name: identity.name ?? undefined,
  };
}

/**
 * Require admin for Convex actions.
 * Actions can't directly query the DB, so this checks via ctx.runQuery.
 * The caller must pass in the isAdmin query reference.
 */
export async function requireAdminAction(
  ctx: ActionCtx,
  isAdminQuery: any
): Promise<AuthIdentity> {
  const identity = await requireAuthAction(ctx);

  const isAdmin = await ctx.runQuery(isAdminQuery, {
    clerkUserId: identity.clerkUserId,
  });

  if (!isAdmin) {
    throw new Error("Unauthorized: Admin role required");
  }

  return identity;
}
```

### Key Design Decisions
- **`extractClerkUserId`**: Clerk's `tokenIdentifier` format is `"https://domain.clerk.accounts.dev|user_xxxxx"`. We extract just the `user_xxx` part to match against the `adminUsers.clerkUserId` field.
- **`requireSelf` with admin bypass**: Admins can view any user's data; regular users can only view their own.
- **Separate action helpers**: Convex `action` handlers have a different context type that can't directly access `ctx.db`. They need `ctx.runQuery` to check admin status.
- **Non-throwing `getAuthenticatedUserId`**: For queries where auth is optional (e.g., public queries that show different data to logged-in users).

---

## Task 2: Fix `convex/auth.ts` Stub

**Problem**: `getUserRole` always returns `"customer"`, `isUserAdmin` always returns `false`. They're useless stubs.

**Solution**: Rewrite to actually query the `adminUsers` table.

### Replace the Entire File With:

```typescript
/**
 * AUTH FUNCTIONS
 *
 * Server-side auth functions for Convex.
 * These are exported as Convex queries that can be called from the client
 * or from other Convex functions via ctx.runQuery.
 *
 * For internal use in mutation/query handlers, use convex/lib/authGuards.ts instead.
 */

import { query } from "./_generated/server";
import { v } from "convex/values";
import type { QueryCtx } from "./_generated/server";

/**
 * Get current user's role based on adminUsers table lookup
 */
export const getUserRole = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx: QueryCtx, args: { userId: string }) => {
    const admin = await ctx.db
      .query("adminUsers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", args.userId))
      .first();

    return {
      userId: args.userId,
      role: admin ? (admin.role === "owner" ? "admin" : "editor") : "customer",
    };
  },
});

/**
 * Check if user is admin (has any record in adminUsers table)
 */
export const isUserAdmin = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx: QueryCtx, args: { userId: string }) => {
    const admin = await ctx.db
      .query("adminUsers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", args.userId))
      .first();

    return !!admin;
  },
});
```

---

## Task 3: Lock Down `convex/admin/adminUsers.ts`

**Critical**: The `add`, `updateRole`, `remove` mutations currently have zero auth. Anyone can add themselves as admin owner.

### Pattern to Apply

Add `import { requireAdmin } from "../lib/authGuards";` at the top, then add `await requireAdmin(ctx);` as the first line in these handlers:
- `getAll` (query)
- `getByClerkId` (query)  
- `add` (mutation)
- `updateRole` (mutation)
- `remove` (mutation)

**Leave `isAdmin` query UNPROTECTED** — this is used by the admin layout check and must work for any authenticated user.

**Special case: `initializeFirstAdmin`** — keep this unprotected BUT add a guard: it should only work when zero admins exist (it already checks this, which is correct). Optionally, add `requireAuth` so at least the caller must be logged in.

### Example — `add` mutation after fix:

```typescript
export const add = mutation({
  args: {
    clerkUserId: v.string(),
    email: v.string(),
    name: v.string(),
    role: v.union(v.literal("owner"), v.literal("editor")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx); // ← ADD THIS LINE

    const existing = await ctx.db
      .query("adminUsers")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();
    // ... rest unchanged
```

### Example — `getAll` query after fix:

```typescript
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx); // ← ADD THIS LINE
    return await ctx.db.query("adminUsers").collect();
  },
});
```

---

## Tasks 4-17: Lock Down All `convex/admin/*` Files

Apply the same pattern to every file in `convex/admin/`. The rule is simple:

### For Queries and Mutations (use `requireAdmin`):

```typescript
import { requireAdmin } from "../lib/authGuards";

// At the top of every handler:
handler: async (ctx, args) => {
  await requireAdmin(ctx);
  // ... rest of existing handler code
},
```

### For Actions (use `requireAdminAction`):

Actions have a different context type. For files that use `action()`:

```typescript
import { requireAdminAction } from "../lib/authGuards";
import { api } from "../_generated/api";

// At the top of every action handler:
handler: async (ctx, args) => {
  await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);
  // ... rest of existing handler code
},
```

### File-by-File Guide

| File | Functions to Protect | Type | Guard |
|---|---|---|---|
| `adminUsers.ts` | `getAll`, `getByClerkId`, `add`, `updateRole`, `remove` | query/mutation | `requireAdmin` |
| `adminUsers.ts` | `isAdmin` | query | **LEAVE UNPROTECTED** (needed for layout checks) |
| `adminUsers.ts` | `initializeFirstAdmin` | mutation | `requireAuth` only (bootstrap case) |
| `members.ts` | `getAllMembers`, `getMemberRoster`, `getMembersByStatus`, `getMemberDetail`, `updateMemberStatus`, `searchMembers`, `getActiveMembersByGroup`, ALL functions | query/mutation | `requireAdmin` |
| `hierarchy.ts` | `createSite`, `updateSite`, `removeSite`, `createAccount`, `updateAccount`, `removeAccount`, `createGroup`, `updateGroup`, `removeGroup`, ALL query/mutations | query/mutation | `requireAdmin` |
| `eligibility.ts` | `getAllEligibilityFiles`, `uploadEligibilityFile`, `getEligibilityFiles`, `processEligibilityFile`, ALL functions | query/mutation/action | `requireAdmin` / `requireAdminAction` |
| `billing.ts` | `getAllGroupBillingSummaries`, `getGroupBillingSummary`, `generateBillingCsv` | query/action | `requireAdmin` / `requireAdminAction` |
| `vendorFiles.ts` | `getVendorConfigurations`, `generateDentalDiscountNetworkFile`, `generateDialCareFile`, ALL functions | query/action | `requireAdmin` / `requireAdminAction` |
| `sftpDelivery.ts` | `deliverVendorFileViaSftp`, ALL functions | action | `requireAdminAction` |
| `notifications.ts` | `sendWelcomeEmail`, `sendPaymentReceiptEmail`, ALL functions | action | `requireAdminAction` |
| `siteSettings.ts` | `update`, `initializeDefaults` | mutation | `requireAdmin` |
| `siteSettings.ts` | `get` | query | **LEAVE UNPROTECTED** (public site settings) |
| `teamMembers.ts` | `create`, `update`, `remove`, `reorder`, `toggleVisibility` | mutation | `requireAdmin` |
| `teamMembers.ts` | `getAll` | query | `requireAdmin` |
| `teamMembers.ts` | `getVisible` | query | **LEAVE UNPROTECTED** (public display) |
| `commissions.ts` | ALL functions | query | `requireAdmin` |
| `memberCards.ts` | `generateMemberIdCardPdf`, `getMemberCardData` | action | `requireAdminAction` |
| `navigation.ts` | `create`, `update`, `remove`, `reorder`, `toggleVisibility` | mutation | `requireAdmin` |
| `navigation.ts` | `getAll` | query | `requireAdmin` |
| `navigation.ts` | `getVisible` | query | **LEAVE UNPROTECTED** (public display) |
| `ventures.ts` | `create`, `update`, `remove`, `reorder`, `toggleVisibility` | mutation | `requireAdmin` |
| `ventures.ts` | `getAll` | query | `requireAdmin` |
| `ventures.ts` | `getVisible`, `getByCategory`, `getBySlug`, `getById` | query | **LEAVE UNPROTECTED** (public display) |
| `coreValues.ts` | `create`, `update`, `remove`, `reorder`, `toggleVisibility` | mutation | `requireAdmin` |
| `coreValues.ts` | `getAll` | query | `requireAdmin` |
| `coreValues.ts` | `getVisible` | query | **LEAVE UNPROTECTED** (public display) |

### Public vs Protected Decision Rule

- **Queries that serve the public website** (like `getVisible` for team members, navigation, ventures, core values) must stay unprotected — they power the public-facing pages.
- **Queries that return ALL records** including hidden/draft ones (like `getAll`) should require admin.
- **All mutations** that modify data should require admin.
- **All actions** that send emails, deliver files, or generate documents should require admin.

---

## Task 18: Fix IDOR in `convex/subscriptions/queries.ts`

**Problem**: All queries accept `customerId` as a client-supplied argument. Any caller can read anyone's subscription data.

**Solution**: For member-facing queries, derive `customerId` from `ctx.auth.getUserIdentity()`. For admin-facing queries, use `requireAdmin` guard.

### Strategy

Add two versions of key queries:
1. **Member-facing** (no `customerId` arg — derived from auth): `getMyBundle`, `getMyEntitlements`, `myHasAccess`, `getMyDashboard`
2. **Admin-facing** (accepts `customerId` arg, requires admin): Keep existing names but add `requireAdmin`

### Example — `getCustomerBundle` refactored:

```typescript
import { requireAuth, requireAdmin, requireSelf } from "../lib/authGuards";

/**
 * Get the CURRENT USER's subscription bundle (member-facing)
 * customerId is derived from auth — no IDOR possible
 */
export const getMyBundle = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireAuth(ctx);

    const bundle = await ctx.db
      .query("subscriptionBundles")
      .withIndex("by_customer", (q) =>
        q.eq("customerId", identity.clerkUserId)
      )
      .filter((q) => q.neq(q.field("status"), "cancelled"))
      .first();

    return bundle;
  },
});

/**
 * Get ANY customer's bundle (admin-facing)
 */
export const getCustomerBundle = query({
  args: {
    customerId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx); // Only admins can look up other users

    const bundle = await ctx.db
      .query("subscriptionBundles")
      .withIndex("by_customer", (q) =>
        q.eq("customerId", args.customerId)
      )
      .filter((q) => q.neq(q.field("status"), "cancelled"))
      .first();

    return bundle;
  },
});
```

Apply the same pattern to:
- `getCustomerEntitlements` → add `getMyEntitlements` (auth-derived) + protect original with `requireAdmin`
- `hasAccess` → add `myHasAccess` (auth-derived) + protect original with `requireAdmin`
- `getCustomerDashboard` → add `getMyDashboard` (auth-derived) + protect original with `requireAdmin`
- `getEntitlement` → add `requireSelf` check (if the entitlement's `customerId` matches the caller)

### Update Agent 1's Dashboard Layout

After creating `getMyBundle`, Agent 1's dashboard layout should call `api.subscriptions.queries.getMyBundle` with no arguments (instead of passing `customerId`). **Both approaches are safe** since Agent 1 derives `customerId` from server-side `auth()`, but the `getMyBundle` approach is cleaner. Coordinate timing.

---

## Task 19: Lock Down `convex/subscriptions/mutations.ts`

**Problem**: `createBundle`, `activateEntitlement`, `cancelEntitlement`, `cancelBundle`, `extendEntitlementPeriod` are all callable by anyone.

**Solution**: Most of these should only be callable by:
1. The Stripe webhook handler (system/internal calls)
2. Admin users

Since the webhook calls via `ConvexHttpClient` (no Clerk auth context), we need an **internal token** pattern or accept that webhook mutations are called without auth but with known metadata.

### Recommended Approach

For mutations called by webhooks:
- Add `requireAdmin(ctx)` check
- Add an `internalMutation` variant for webhook use (Convex `internalMutation` functions are not callable from clients)

```typescript
import { mutation, internalMutation } from "../_generated/server";
import { requireAdmin } from "../lib/authGuards";

// Public version — admin only
export const createBundle = mutation({
  args: { ... },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await _createBundle(ctx, args);
  },
});

// Internal version — for webhook use (not exposed to clients)
export const internalCreateBundle = internalMutation({
  args: { ... },
  handler: async (ctx, args) => {
    return await _createBundle(ctx, args);
  },
});

// Shared implementation
async function _createBundle(ctx: any, args: any) {
  // ... existing handler code
}
```

Apply this pattern to:
- `createBundle` → `internalCreateBundle`
- `activateEntitlement` → `internalActivateEntitlement`
- `extendEntitlementPeriod` → `internalExtendEntitlementPeriod`
- `logEvent` → `internalLogEvent`

For member-callable mutations:
- `cancelEntitlement` → add `requireSelf(ctx, customerId)` — users can cancel their own
- `cancelBundle` → add `requireSelf(ctx, customerId)` — users can cancel their own

**Important**: After creating `internalMutation` variants, **Agent 3** will need to update the webhook route to use `api.subscriptions.mutations.internalCreateBundle` instead of `api.subscriptions.mutations.createBundle`. Include this in your notes.

---

## Task 20: Lock Down `convex/subscriptions/entitlements.ts`

Same pattern as mutations. Protect all functions:

| Function | Guard |
|---|---|
| `activateEntitlement` | `requireAdmin` + `internalMutation` variant |
| `scheduleEntitlementCancellation` | `requireSelf` (user can cancel own) or `requireAdmin` |
| `suspendEntitlement` | `requireAdmin` + `internalMutation` variant |
| `revokeEntitlement` | `requireAdmin` |
| `reactivateEntitlement` | `requireAdmin` |
| `expireEntitlement` | `requireAdmin` + `internalMutation` variant (cron job) |

---

## Task 21: Protect `convex/subscriptions/events.ts`

| Function | Guard |
|---|---|
| `logEvent` | `internalMutation` variant (for webhook/system use) + `requireAdmin` for public |
| `getRecentEvents` | `requireAdmin` |
| Any other read queries | `requireAdmin` |

---

## Task 22: Protect `convex/catalog/mutations.ts`

| Function | Guard |
|---|---|
| `seedInitialData` | `requireAdmin` |
| `reseedData` / `clearAndReseed` | `requireAdmin` |

Catalog **read** queries (in `convex/catalog/queries.ts`) should remain public — they power the public catalog browsing experience.

---

## Task 23: Add Auth to `convex/enrollment/members.ts`

| Function | Guard | Reason |
|---|---|---|
| `createMemberProfile` | `requireAuth` | User must be logged in to create their own profile |
| `updateMemberProfile` | `requireSelf` or `requireAdmin` | Users update their own; admins update anyone's |
| Read queries | `requireAuth` for self-queries, `requireAdmin` for listing all | Prevent unauthorized data access |

**Note**: `createMemberProfile` is called by the webhook handler during checkout. Create an `internalMutation` variant for webhook use, similar to Task 19.

---

## Task 24-26: Protect Admin Queries in `contacts.ts`, `inquiries.ts`, `newsletter.ts`

### `convex/contacts.ts`
| Function | Guard |
|---|---|
| `submitContactForm` | **LEAVE UNPROTECTED** (public form) |
| `getContactSubmissions` | `requireAdmin` |
| `updateContactStatus` | `requireAdmin` |

### `convex/inquiries.ts`
| Function | Guard |
|---|---|
| `submitInquiry` | **LEAVE UNPROTECTED** (public form) |
| `getInquiries` | `requireAdmin` |
| `updateInquiryStatus` | `requireAdmin` |

### `convex/newsletter.ts`
| Function | Guard |
|---|---|
| `subscribe` | **LEAVE UNPROTECTED** (public form) |
| `unsubscribe` | **LEAVE UNPROTECTED** (public action) |
| `getActiveSubscribers` | `requireAdmin` |
| `getSubscriberCount` | `requireAdmin` |

---

## Implementation Order

1. **Task 1** first — create `convex/lib/authGuards.ts` (everything else depends on this)
2. **Task 2** — fix `convex/auth.ts`
3. **Tasks 3-17** — lock down all `convex/admin/*` files (can be done in any order)
4. **Tasks 18-22** — fix IDOR and protect subscriptions/catalog
5. **Tasks 23-26** — protect remaining files

---

## Testing

After implementation, run `npx convex dev` and verify:
1. Open Convex dashboard → try calling `admin.members.getAllMembers` without auth → should throw "Unauthorized"
2. Call `admin.adminUsers.add` without auth → should throw
3. Call `subscriptions.queries.getMyBundle` while authenticated → should return the logged-in user's bundle
4. Call `subscriptions.queries.getCustomerBundle` as non-admin with another user's ID → should throw
5. Call `contacts.getContactSubmissions` without auth → should throw
6. Call `contacts.submitContactForm` without auth → should succeed (it's public)
7. All `getVisible` queries (teamMembers, ventures, coreValues, navigation) → should still work without auth
8. Verify `npx convex deploy` succeeds with no type errors

---

## Notes for Other Agents

- **Agent 1**: After Task 18 lands, the dashboard layout can optionally switch from `getCustomerBundle({ customerId })` to `getMyBundle({})`. Both are safe since Agent 1 derives userId from server-side auth.
- **Agent 3**: After Task 19 lands, the webhook route should import `internal` API references instead of `api` for mutations. Specifically:
  - `api.subscriptions.mutations.createBundle` → `internal.subscriptions.mutations.internalCreateBundle`
  - `api.subscriptions.mutations.activateEntitlement` → `internal.subscriptions.mutations.internalActivateEntitlement`
  - `api.subscriptions.mutations.logEvent` → `internal.subscriptions.mutations.internalLogEvent`
  - Import using `import { internal } from "@/convex/_generated/api";`
