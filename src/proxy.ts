import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { isReservedPath } from "@/lib/rep-routing/reserved";
import { memberSignInPath } from "@/lib/site-links";
import { domainClerkOptions, domainEntryPath, domainSite, marketingRedirectOrigin } from "@/lib/site-domains";

/**
 * ROUTE PROTECTION PROXY (Clerk Middleware)
 *
 * Enforces authentication at the edge for protected routes.
 * Uses Clerk's middleware to verify JWT tokens before requests reach pages.
 *
 * Route Strategy:
 * - /admin/*             → Requires authentication (admin role checked in layout)
 * - /partner/*           → Requires authentication (partner scope checked in layout)
 * - /employer/*          → Requires authentication (org access checked in Convex), except sign-in/sign-up
 * - /health/dashboard/*  → Requires authentication (subscription + admin checked in layout)
 * - /health/checkout/*   → Public (inline auth handled on the Account step of checkout)
 * - /health/*            → Public (catalog browsing)
 * - /api/stripe/webhook  → Always public (Stripe sends unsigned POST)
 * - Everything else      → Public
 *
 * Sign-in redirect:
 * Unauthenticated users are redirected to /employer/sign-in for employer routes,
 * or NEXT_PUBLIC_CLERK_SIGN_IN_URL (env var), which defaults to /health/sign-in.
 * This keeps all redirects on localhost when developing locally, rather than
 * bouncing to the live Clerk-hosted sign-in page.
 */

// Routes that require authentication
const isProtectedRoute = createRouteMatcher([
  "/admin(.*)",
  "/debug(.*)",
  "/partner(.*)",
  "/employer(.*)",
  "/health/dashboard(.*)",
  // White-label brand dashboards at /{siteSlug}/dashboard
  "/:siteSlug/dashboard(.*)",
]);

// Sign-in pages sit at portal-shaped URLs but must remain reachable before a
// session exists. Check these before the broader /employer guard.
const isAuthRoute = createRouteMatcher([
  "/employer/sign-in(.*)",
  "/employer/sign-up(.*)",
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
function agentDestination(to: string | null, hint: string | null | undefined): string {
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
  siteSlug?: string,
) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) return null;
  try {
    const client = new ConvexHttpClient(convexUrl);
    const result = await client.query(api.enrollment.agents.resolveRepLink, { segment: slug });
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

    const to = new URL(requestUrl).searchParams.get("to");
    const mainDestination = to === "essentials" || (!to && result.productHint === "essentials")
      ? "/assurevantage/essentials"
      : to === "oralcare" || to === "health" || (!to && result.productHint === "oralcare")
        ? "/assurevantage/plans" : "/";
    const dest = siteSlug === "assurevantage" ? mainDestination : siteSlug ? `/${encodeURIComponent(siteSlug)}/plans` : agentDestination(to, result.productHint);
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

const authenticateRequest = clerkMiddleware(async (auth, request) => {
  // Never block webhook endpoints
  if (isPublicApiRoute(request)) {
    return NextResponse.next();
  }

  const site = domainSite(request.nextUrl.hostname);

  if (isAuthRoute(request)) {
    return NextResponse.next();
  }

  // Agent vanity-URL resolution: /{slug} (single segment, not reserved)
  // Resolves rep codes / slugs and redirects to the rep's landing page with ?ref=...
  // (/230001, /allenjackson, /230001?to=essentials)
  // Must run before Clerk so the redirect bypasses auth checks.
  const segments = request.nextUrl.pathname.split("/").filter(Boolean);
  if (segments.length === 1 && !isReservedPath(segments[0]) && segments[0] !== site?.slug) {
    const agentResponse = await tryAgentRedirect(segments[0], request.url, request.headers.get("user-agent") ?? undefined, site?.slug);
    if (agentResponse) return agentResponse;
  }

  // Enforce auth on protected routes — redirect to local sign-in page,
  // NOT to Clerk's hosted page (which would go to accounts.getidealoh.com).
  if (isProtectedRoute(request)) {
    const authState = await auth();
    const { userId } = authState;
    if (!userId) {
      if (site) {
        return authState.redirectToSignIn({ returnBackUrl: new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, site.origin).href });
      }
      const signInPath = request.nextUrl.pathname.startsWith("/employer")
        ? "/employer/sign-in"
        : memberSignInPath(request.nextUrl.pathname, SIGN_IN_URL);
      const signInUrl = new URL(signInPath, request.url);
      // A path, not request.url: the sign-in page refuses absolute URLs so an
      // attacker cannot use this parameter to bounce a newly signed-in session
      // off-site, and behind Vercel's proxy request.url does not necessarily
      // carry the host the visitor typed anyway.
      const { pathname, search } = request.nextUrl;
      signInUrl.searchParams.set("redirect_url", `${pathname}${search}`);
      return NextResponse.redirect(signInUrl);
    }
  }
}, request => domainClerkOptions(request.nextUrl.hostname));

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (isPublicApiRoute(request)) return NextResponse.next();
  const marketingOrigin = marketingRedirectOrigin(request.nextUrl.hostname, request.nextUrl.pathname);
  if (marketingOrigin) {
    return NextResponse.redirect(new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, marketingOrigin));
  }
  // Resolve the entry route before Clerk starts a cross-domain session sync.
  const entryPath = domainEntryPath(request.nextUrl.hostname, request.nextUrl.pathname);
  if (entryPath) {
    const target = request.nextUrl.clone();
    target.pathname = entryPath;
    return NextResponse.redirect(target);
  }
  return authenticateRequest(request, event);
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
