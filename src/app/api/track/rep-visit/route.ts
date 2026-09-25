import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

/**
 * POST /api/track/rep-visit
 *
 * Records that someone landed on a page carrying a rep code (`?ref=CODE`).
 * Called via `navigator.sendBeacon` on first paint, so it must be cheap,
 * unauthenticated, and never block rendering.
 *
 * The vanity-URL entry point (`/{slug}`) is recorded separately in src/proxy.ts,
 * where the redirect already resolves the code server-side. This route covers
 * the other way in: a link shared with the query parameter already attached.
 *
 * Always answers 204. A beacon cannot read a response body, and a lost visit is
 * a lost data point rather than a lost sale — so failures stay quiet instead of
 * surfacing an error nobody is listening for.
 *
 * The mutation resolves the code against `brokerTrackingCodes` and derives
 * everything it stores from that row, so a forged request can inflate a counter
 * but cannot invent a code or write arbitrary data.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      code?: string;
      siteSlug?: string;
      path?: string;
      referrer?: string;
      sessionId?: string;
    };

    if (!body?.code || typeof body.code !== "string") {
      return new NextResponse(null, { status: 204 });
    }

    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) return new NextResponse(null, { status: 204 });

    const convex = new ConvexHttpClient(convexUrl);
    await convex.mutation(api.insights.visits.recordRepLinkVisit, {
      code: body.code,
      siteSlug: typeof body.siteSlug === "string" ? body.siteSlug : undefined,
      path: typeof body.path === "string" ? body.path : undefined,
      referrer: typeof body.referrer === "string" ? body.referrer : undefined,
      sessionId: typeof body.sessionId === "string" ? body.sessionId : undefined,
      // Read from the request rather than the body so a caller cannot claim to
      // be a browser to dodge bot classification.
      userAgent: req.headers.get("user-agent") ?? undefined,
      source: "ref_param",
    });
  } catch {
    // Swallow: visit tracking is best-effort by design.
  }

  return new NextResponse(null, { status: 204 });
}
