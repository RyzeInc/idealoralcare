import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { isReservedPath } from "@/lib/rep-routing/reserved";

/**
 * ROUTE PROTECTION PROXY (Clerk Middleware)
 *
 * Enforces authentication at the edge for protected routes.
 * Uses Clerk's middleware to verify JWT tokens before requests reach pages.
 *
 * Route Strategy:
 * - /admin/*             → Requires authentication (admin role checked in layout)
 * - /partner/*           → Requires authentication (partner scope checked in layout)
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
  "/partner(.*)",
  "/health/dashboard(.*)",
  // White-label brand dashboards at /{siteSlug}/dashboard
  "/:siteSlug/dashboard(.*)",
]);

// Routes that should never be blocked (webhooks, public API)
const isPublicApiRoute = createRouteMatcher([
  "/api/stripe/webhook",
  "/api/clerk/webhook",
]);

// Read sign-in URL from env or fall back to our custom page
const SIGN_IN_URL = process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL ?? "/health/sign-in";

const AGENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 90; // 90 days

/**
 * Pick the landing page for a resolved vanity URL. An explicit ?to= param
 * overrides the rep code's stored productHint.
 */
function agentDestination(to: string | null, hint: string | undefined): string {
  if (to === "essentials") return "/newideal/essentials";
  if (to === "oralcare") return "/newideal/oralcare";
  if (to === "health") return "/health/plans";
  if (hint === "essentials") return "/newideal/essentials";
  if (hint === "oralcare") return "/newideal/oralcare";
  return "/newideal/plans";
}

async function tryAgentRedirect(
  slug: string,
  requestUrl: string,
  userAgent?: string,
) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) return null;
  try {
    const client = new ConvexHttpClient(convexUrl);
    const agentsApi = (api as Record<string, any>)["enrollment/agents"];
    const result = await client.query(agentsApi.resolveRepUrl, { segment: slug });
    if (!result?.repCode) return null;

    // Record the visit before redirecting. Awaited rather than fired and
    // forgotten because middleware execution ends with the response — a
    // dangling promise here is simply dropped. It is one indexed write against
    // a Convex mutation that already resolved this code, and a failure is
    // caught below and costs a data point, not the redirect.
    try {
      await client.mutation(api.insights.visits.recordRepLinkVisit, {
        code: result.repCode,
        slug,
        path: new URL(requestUrl).pathname,
        userAgent,
        source: "vanity_url",
      });
    } catch {
      // Visit tracking is best-effort; never let it break the redirect.
    }

    const dest = agentDestination(new URL(requestUrl).searchParams.get("to"), result.productHint);
    const redirect = new URL(`${dest}?ref=${encodeURIComponent(result.repCode)}`, requestUrl);
    const response = NextResponse.redirect(redirect);
    // httpOnly=false so client JS can also read it for the cookie-fallback in CartProvider
    response.cookies.set("ideal_ref", result.repCode, {
      maxAge: AGENT_COOKIE_MAX_AGE,
      path: "/",
      sameSite: "lax",
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  } catch {
    return null;
  }
}

export default clerkMiddleware(async (auth, request) => {
  // Never block webhook endpoints
  if (isPublicApiRoute(request)) {
    return NextResponse.next();
  }

  // Agent vanity-URL resolution: /{slug} (single segment, not reserved)
  // Resolves rep codes / slugs and redirects to the rep's landing page with ?ref=...
  // (/230001, /allenjackson, /230001?to=essentials)
  // Must run before Clerk so the redirect bypasses auth checks.
  const segments = request.nextUrl.pathname.split("/").filter(Boolean);
  if (segments.length === 1 && !isReservedPath(segments[0])) {
    const agentResponse = await tryAgentRedirect(segments[0], request.url, request.headers.get("user-agent") ?? undefined);
    if (agentResponse) return agentResponse;
  }

  // Enforce auth on protected routes — redirect to local sign-in page,
  // NOT to Clerk's hosted page (which would go to accounts.getidealoh.com).
  if (isProtectedRoute(request)) {
    const { userId } = await auth();
    if (!userId) {
      const signInUrl = new URL(SIGN_IN_URL, request.url);
      // A path, not request.url: the sign-in page refuses absolute URLs so an
      // attacker cannot use this parameter to bounce a newly signed-in session
      // off-site, and behind Vercel's proxy request.url does not necessarily
      // carry the host the visitor typed anyway.
      const { pathname, search } = request.nextUrl;
      signInUrl.searchParams.set("redirect_url", `${pathname}${search}`);
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
