import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * ROUTE PROTECTION PROXY (Clerk Middleware)
 *
 * Enforces authentication at the edge for protected routes.
 * Uses Clerk's middleware to verify JWT tokens before requests reach pages.
 *
 * Route Strategy:
 * - /admin/*             → Requires authentication (admin role checked in layout)
 * - /health/dashboard/*  → Requires authentication (subscription + admin checked in layout)
 * - /health/checkout/*   → Public (inline auth handled on the Account step of checkout)
 * - /health/*            → Public (catalog browsing)
 * - /api/stripe/webhook  → Always public (Stripe sends unsigned POST)
 * - Everything else      → Public
 *
 * Sign-in redirect:
 * Unauthenticated users are redirected to NEXT_PUBLIC_CLERK_SIGN_IN_URL (env var)
 * which defaults to /health/sign-in. This keeps all redirects on localhost when
 * developing locally, rather than bouncing to the live Clerk-hosted sign-in page.
 */

// Routes that require authentication
const isProtectedRoute = createRouteMatcher([
  "/admin(.*)",
  "/health/dashboard(.*)",
]);

// Routes that should never be blocked (webhooks, public API)
const isPublicApiRoute = createRouteMatcher([
  "/api/stripe/webhook",
  "/api/clerk/webhook",
]);

// Read sign-in URL from env or fall back to our custom page
const SIGN_IN_URL = process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL ?? "/health/sign-in";

export default clerkMiddleware(async (auth, request) => {
  // Never block webhook endpoints
  if (isPublicApiRoute(request)) {
    return NextResponse.next();
  }

  // Enforce auth on protected routes — redirect to local sign-in page,
  // NOT to Clerk's hosted page (which would go to accounts.getidealoh.com).
  if (isProtectedRoute(request)) {
    const { userId } = await auth();
    if (!userId) {
      const signInUrl = new URL(SIGN_IN_URL, request.url);
      signInUrl.searchParams.set("redirect_url", request.url);
      return NextResponse.redirect(signInUrl);
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
