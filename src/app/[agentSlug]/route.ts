/**
 * Agent Slug Route Handler
 *
 * Handles vanity URLs like:
 *   /230001          → rep code lookup
 *   /allenjackson    → slug lookup (stored or computed from name)
 *   /230001?to=essentials → hint override
 *
 * Sets a 90-day cookie (ideal_ref) and redirects with ?ref= so the
 * cart context can hydrate the referral code on the landing page.
 *
 * Implemented as a Route Handler (not a Server Component) because
 * Next.js 15+ only allows cookies().set() in Route Handlers and Server Actions.
 */

import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { isReservedPath } from "@/lib/rep-routing/reserved";
import type { RepUrlResolution } from "../.././../convex/enrollment/agents";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 90; // 90 days

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentSlug: string }> }
) {
  const { agentSlug } = await params;
  const to = request.nextUrl.searchParams.get("to") ?? undefined;

  if (isReservedPath(agentSlug)) {
    return new NextResponse(null, { status: 404 });
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    console.error("NEXT_PUBLIC_CONVEX_URL not configured");
    return new NextResponse(null, { status: 404 });
  }

  const client = new ConvexHttpClient(convexUrl);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agentsApi = (api as any)["enrollment/agents"];

  let result: RepUrlResolution | null = null;
  try {
    result = await client.query(agentsApi.resolveRepUrl, { segment: agentSlug });
  } catch (error) {
    console.error("Error resolving rep URL:", error);
  }

  if (!result) {
    return new NextResponse(null, { status: 404 });
  }

  // Determine destination — explicit ?to= param overrides productHint
  const hint = result.productHint;
  const dest =
    to === "essentials"   ? "/newideal/essentials" :
    to === "oralcare"     ? "/newideal/oralcare"   :
    to === "health"       ? "/health/plans"        :
    hint === "essentials" ? "/newideal/essentials" :
    hint === "oralcare"   ? "/newideal/oralcare"   :
    hint === "plans"      ? "/newideal/plans"      :
    "/newideal/plans";

  const redirectUrl = new URL(
    `${dest}?ref=${encodeURIComponent(result.repCode)}`,
    request.url
  );

  const response = NextResponse.redirect(redirectUrl);

  // Set cookie — httpOnly=false so client JS can also read it for
  // the cookie-fallback in CartProvider
  response.cookies.set("ideal_ref", result.repCode, {
    maxAge: COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
