import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

/**
 * POST /api/crm/unsubscribe?token=...
 *
 * RFC 8058 one-click unsubscribe target — this is what the List-Unsubscribe
 * email header points at (not the human-facing /unsubscribe/[token] page,
 * which only handles GET). Google/Yahoo's bulk-sender rules effectively
 * require this now; without it, CRM outreach lands in spam regardless of
 * content.
 *
 * No auth: the token itself (an unguessable nanoid or a bare contact ID —
 * see convex/crm/suppressions.ts) is the only gate, matching the threat
 * model of any bearer-link unsubscribe.
 */
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return NextResponse.json({ error: "Convex not configured" }, { status: 500 });
  }

  try {
    const client = new ConvexHttpClient(convexUrl);
    const result = await client.mutation(api.crm.suppressions.unsubscribeByToken, { token });
    if (!result.ok) {
      return NextResponse.json({ error: "Invalid token" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[crm-unsubscribe] Convex mutation failed:", err);
    // 200 regardless — a mail client's one-click POST doesn't retry on
    // failure the way a webhook would, and there's nothing useful it can do
    // with an error response anyway.
    return NextResponse.json({ ok: true });
  }
}

/** GET support so a manually-clicked List-Unsubscribe link (not one-click) redirects somewhere useful instead of 405ing. */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/", req.url));
  return NextResponse.redirect(new URL(`/unsubscribe/${token}`, req.url));
}
