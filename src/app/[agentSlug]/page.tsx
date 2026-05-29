/**
 * Agent Slug Route
 *
 * Handles vanity URLs like:
 *   /230001          → rep code lookup
 *   /allenjackson    → slug lookup (stored or computed from name)
 *   /230001?to=essentials → hint override
 *
 * Sets a 90-day server cookie (ideal_ref) and redirects with ?ref= so the
 * cart context can hydrate the referral code on the landing page.
 */

import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { isReservedPath } from "@/lib/rep-routing/reserved";
import type { RepUrlResolution } from "../.././../convex/enrollment/agents";

interface PageProps {
  params: Promise<{ agentSlug: string }>;
  searchParams: Promise<{ to?: string }>;
}

const COOKIE_MAX_AGE = 60 * 60 * 24 * 90; // 90 days

export default async function AgentSlugPage({ params, searchParams }: PageProps) {
  const { agentSlug } = await params;
  const { to } = await searchParams;

  if (isReservedPath(agentSlug)) notFound();

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    console.error("NEXT_PUBLIC_CONVEX_URL not configured");
    notFound();
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

  if (!result) notFound();

  // Set server-side cookie — httpOnly=false so client JS can also read it for
  // the cookie-fallback in CartProvider
  const cookieStore = await cookies();
  cookieStore.set("ideal_ref", result.repCode, {
    maxAge: COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  });

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

  redirect(`${dest}?ref=${encodeURIComponent(result.repCode)}`);
}

