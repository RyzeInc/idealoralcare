# Security Agent 1 — Next.js Route Protection & Headers

**Scope**: All files under `src/` and `next.config.ts`  
**Goal**: Create the frontend security layer — middleware, admin authorization, subscription gating, security headers  
**Dependencies**: None (fully independent)

---

## Task List

| # | Task | File | Severity |
|---|---|---|---|
| 1 | Create Clerk middleware for route protection | `src/middleware.ts` (NEW) | CRITICAL |
| 2 | Add admin role verification to admin layout | `src/app/admin/layout.tsx` | CRITICAL |
| 3 | Add subscription gating to dashboard layout | `src/app/health/dashboard/layout.tsx` | HIGH |
| 4 | Add security headers + tighten allowedOrigins | `next.config.ts` | MEDIUM |

---

## Task 1: Create `src/middleware.ts`

**Problem**: No middleware exists. All routes are publicly accessible. Clerk's `clerkMiddleware()` is not used anywhere.

**Solution**: Create `src/middleware.ts` at the project root's `src/` directory with Clerk middleware.

### File to Create: `src/middleware.ts`

```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * ROUTE PROTECTION MIDDLEWARE
 *
 * Enforces authentication at the edge for protected routes.
 * Uses Clerk's middleware to verify JWT tokens before requests reach pages.
 *
 * Route Strategy:
 * - /admin/*        → Requires authentication (admin role checked in layout)
 * - /health/dashboard/* → Requires authentication
 * - /health/checkout/*  → Requires authentication
 * - /health/*        → Public (catalog browsing)
 * - /api/stripe/webhook → Public (Stripe sends raw POST)
 * - Everything else  → Public
 */

// Routes that require authentication
const isProtectedRoute = createRouteMatcher([
  "/admin(.*)",
  "/health/dashboard(.*)",
  "/health/checkout(.*)",
]);

// Routes that should never be blocked (webhooks, public API)
const isPublicApiRoute = createRouteMatcher([
  "/api/stripe/webhook",
]);

export default clerkMiddleware(async (auth, request) => {
  // Never block webhook endpoints
  if (isPublicApiRoute(request)) {
    return NextResponse.next();
  }

  // Enforce auth on protected routes
  if (isProtectedRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
```

### How It Works
- `clerkMiddleware` intercepts every request matching the `config.matcher` pattern
- `auth.protect()` redirects unauthenticated users to the Clerk sign-in page
- The webhook route is explicitly excluded so Stripe can POST without auth headers
- The `matcher` regex skips static assets for performance

### Clerk Package Requirement
This uses `@clerk/nextjs` v5+ APIs (`clerkMiddleware`, `createRouteMatcher`). Verify the installed version:
```bash
npm ls @clerk/nextjs
```
If on v4, use `authMiddleware` instead (different API).

---

## Task 2: Update `src/app/admin/layout.tsx` — Add Admin Role Check

**Problem**: The current layout only checks `if (!userId)` — any logged-in user (including regular members) can access the entire admin portal.

**Current Code** (lines 78-81):
```typescript
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/health");
  }
  // ... renders admin UI for ANY authenticated user
```

**Solution**: After verifying authentication, query the Convex `adminUsers` table to check if the current user has an admin record. If not, redirect to `/health`.

### Changes to Make

Replace the `AdminLayout` function (starting from `export default async function AdminLayout`) with:

```typescript
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  // Must be authenticated
  if (!userId) {
    redirect("/health");
  }

  // Must be an admin — verify against adminUsers table in Convex
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || "");
  const isAdmin = await convex.query(api.admin.adminUsers.isAdmin, {
    clerkUserId: userId,
  });

  if (!isAdmin) {
    redirect("/health");
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
```

### New Imports Required
Add these imports at the top of the file:
```typescript
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
```

### Why This Approach
- Uses the existing `adminUsers.isAdmin` Convex query which looks up the user's `clerkUserId` in the `adminUsers` table
- Server-side check (not client-side) — cannot be bypassed via browser devtools
- `ConvexHttpClient` is used for server-side Convex calls in server components
- Falls back to `/health` if not admin — user sees the public catalog, not an error page

---

## Task 3: Update `src/app/health/dashboard/layout.tsx` — Add Subscription Gating

**Problem**: The dashboard only checks authentication. Any logged-in user (even without a paid plan) can access the member dashboard.

**Current Code** (full file, 25 lines):
```typescript
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/health");
  }

  return <>{children}</>;
}
```

**Solution**: After auth check, query Convex for the user's active subscription bundle. If no active bundle exists, redirect to the plans/catalog page.

### Replace the Entire File With:

```typescript
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

/**
 * HEALTH DASHBOARD LAYOUT
 *
 * PROTECTED - Requires authentication + active subscription
 * Users see their active plans, account settings, etc.
 * Redirects to /health (catalog) if not authenticated
 * Redirects to /health#plans if authenticated but no active subscription
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  // Must be authenticated to see dashboard
  if (!userId) {
    redirect("/health");
  }

  // Must have an active subscription bundle
  try {
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || "");
    const bundle = await convex.query(api.subscriptions.queries.getCustomerBundle, {
      customerId: userId,
    });

    if (!bundle || bundle.status === "cancelled") {
      // Authenticated but no active plan — send to catalog
      redirect("/health#plans");
    }
  } catch (error) {
    console.error("[dashboard-layout] Error checking subscription:", error);
    // On error, allow access rather than locking out paid users
    // The dashboard page itself will handle empty states gracefully
  }

  return <>{children}</>;
}
```

### Important Note on IDOR
This currently passes `userId` (from Clerk auth) as `customerId` to `getCustomerBundle`. **Agent 2** will be changing this query to derive `customerId` from `ctx.auth.getUserIdentity()` instead of accepting it as an argument. Once Agent 2's changes land, this layout call should be updated to pass no `customerId` argument (the query will self-identify). For now, passing the server-derived `userId` is safe since it comes from `auth()`, not from user input.

---

## Task 4: Update `next.config.ts` — Security Headers + Tighten Origins

**Problem**: No security headers configured. `allowedOrigins` includes wildcard `*.app.github.dev`.

**Current Code** (full file, 16 lines):
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "localhost:3001",
        "*.app.github.dev",
      ],
    },
  },
};

export default nextConfig;
```

### Replace the Entire File With:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "localhost:3001",
        // Remove *.app.github.dev in production deploys
        ...(process.env.NODE_ENV === "development" ? ["*.app.github.dev"] : []),
      ],
    },
  },

  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://challenges.cloudflare.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.clerk.com https://img.clerk.com",
              "font-src 'self' data:",
              "connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://*.clerk.accounts.dev https://api.stripe.com",
              "frame-src https://*.clerk.accounts.dev https://js.stripe.com https://challenges.cloudflare.com",
              "worker-src 'self' blob:",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

### Header Explanations
| Header | Purpose |
|---|---|
| `X-Frame-Options: DENY` | Prevents clickjacking — page cannot be embedded in iframes |
| `X-Content-Type-Options: nosniff` | Prevents MIME-type sniffing attacks |
| `Referrer-Policy` | Controls how much referrer info is shared with external sites |
| `Strict-Transport-Security` | Forces HTTPS for 1 year including subdomains |
| `Permissions-Policy` | Disables unused browser features (camera, mic, geolocation) |
| `Content-Security-Policy` | Controls which scripts/styles/frames/connections are allowed |

### CSP Notes
- The CSP allows Clerk's authentication UI, Convex WebSocket connections, and Stripe's payment frames
- `'unsafe-inline'` and `'unsafe-eval'` are unfortunately needed for Clerk and Next.js — can be tightened further with nonces in a future iteration
- The `connect-src` allows `*.convex.cloud` for both HTTPS and WSS (WebSocket) connections
- Adjust `https://*.clerk.accounts.dev` to match your actual Clerk domain in production

---

## Files Summary

| File | Action | Lines Changed |
|---|---|---|
| `src/middleware.ts` | **CREATE** | ~50 lines |
| `src/app/admin/layout.tsx` | **EDIT** | ~15 lines changed (admin check + imports) |
| `src/app/health/dashboard/layout.tsx` | **REPLACE** | Full file rewrite (~40 lines) |
| `next.config.ts` | **REPLACE** | Full file rewrite (~60 lines) |

---

## Testing Instructions

1. **Middleware test**: Open incognito browser → navigate to `/admin` → should redirect to Clerk sign-in
2. **Admin role test**: Log in as a regular member → navigate to `/admin` → should redirect to `/health`
3. **Admin access test**: Log in as an admin (has record in `adminUsers` table) → `/admin` loads normally
4. **Dashboard auth test**: Open incognito → navigate to `/health/dashboard` → should redirect to `/health`
5. **Dashboard subscription test**: Log in as user without active bundle → should redirect to `/health#plans`
6. **Dashboard paid test**: Log in as user with active bundle → dashboard loads normally
7. **Security headers test**: `curl -I http://localhost:3000/` → verify all 7 headers present
8. **CSP test**: Open browser console on any page → no CSP violation errors for normal functionality
9. **Webhook still works**: Send test Stripe webhook event → receives `200 OK` (not blocked by middleware)
10. **Static assets**: Verify images, CSS, JS still load (not blocked by CSP or middleware matcher)
