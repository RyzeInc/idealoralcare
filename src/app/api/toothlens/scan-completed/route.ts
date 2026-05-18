import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

/**
 * POST /api/toothlens/scan-completed
 *
 * Webhook endpoint that Toothlens (RyzeHealth) calls after a scan session
 * finishes. Contract agreed via email (Apr–May 2026 thread w/ Upendra Shetty):
 *
 *   Auth:          Authorization: Bearer <TOOTHLENS_WEBHOOK_SECRET>
 *   Content-Type:  application/json
 *
 *   Payload:
 *     {
 *       "uid":           "6R1774117490175C",         // Toothlens UID (optional but verified)
 *       "session_id":    "sess_abc123",              // REQUIRED — matches toothlensScans.sessionId
 *       "company":       "ryzehealth",               // optional, informational
 *       "status":        "completed",                // completed | cancelled | abandoned
 *       "completed_at":  "2026-04-21T15:30:00Z",     // optional ISO-8601
 *       "report_url":    "https://.../report.pdf",   // optional
 *       "findings":      { ... }                     // optional (Toothlens not sending yet)
 *     }
 *
 *   Responses:
 *     200 OK   { ok: true, scanId }    — scan record updated
 *     400      malformed payload
 *     401      missing/invalid bearer
 *     404      session_id not found
 *     500      server misconfigured / Convex error
 *
 * Set TOOTHLENS_WEBHOOK_SECRET in env. Share with Toothlens out-of-band.
 */

export const runtime = "nodejs";

// Constant-time string compare to avoid leaking the secret via timing.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(req: NextRequest) {
  const secret = process.env.TOOTHLENS_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[toothlens-webhook] TOOTHLENS_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  if (!match) return unauthorized();
  if (!safeEqual(match[1], secret)) return unauthorized();

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sessionId: unknown = body?.session_id;
  if (typeof sessionId !== "string" || sessionId.length === 0) {
    return NextResponse.json(
      { error: "Missing required field: session_id" },
      { status: 400 },
    );
  }

  const uid = typeof body.uid === "string" ? body.uid : undefined;
  const company = typeof body.company === "string" ? body.company : undefined;
  const status = typeof body.status === "string" ? body.status : undefined;
  const reportUrl = typeof body.report_url === "string" ? body.report_url : undefined;
  const findings =
    body.findings && typeof body.findings === "object" ? body.findings : undefined;

  let completedAtMs: number | undefined;
  if (typeof body.completed_at === "string") {
    const parsed = Date.parse(body.completed_at);
    if (!Number.isNaN(parsed)) completedAtMs = parsed;
  } else if (typeof body.completed_at === "number") {
    completedAtMs = body.completed_at;
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    console.error("[toothlens-webhook] NEXT_PUBLIC_CONVEX_URL not set");
    return NextResponse.json({ error: "Convex not configured" }, { status: 500 });
  }

  const client = new ConvexHttpClient(convexUrl);

  try {
    const result = await client.mutation(
      api.healthplans.toothlens.recordScanCompletedWebhook,
      {
        sessionId,
        uid,
        company,
        status,
        completedAtMs,
        reportUrl,
        findings,
      },
    );

    if (!result.matched) {
      return NextResponse.json(
        { error: "Session not found", session_id: sessionId },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, scanId: result.scanId });
  } catch (err) {
    console.error("[toothlens-webhook] Convex mutation failed:", err);
    const msg = err instanceof Error ? err.message : String(err);
    // UID mismatch from the Convex side → surface as 409 for visibility.
    if (msg.includes("UID mismatch")) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
