import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * ROUTE PROTECTION PROXY (Clerk Middleware)
 *
 * Enforces authentication at the edge for protected routes.
 * Uses Clerk's middleware to verify JWT tokens before requests reach pages.
 *
 * Route Strategy:
 * - /admin/*        → Requires authentication (admin role checked in layout)
 * - /health/dashboard/* → Requires authentication (subscription checked in layout)
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
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
