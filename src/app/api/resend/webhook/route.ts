import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

/**
 * POST /api/resend/webhook
 *
 * Receives Resend email delivery events (Resend signs webhooks with Svix).
 * Handles: email.delivered, email.bounced, email.complained, email.failed
 *
 * Configure in Resend dashboard:
 *   Endpoint URL:  https://<your-app>/api/resend/webhook
 *   Subscribe to:  email.delivered, email.bounced, email.complained, email.failed
 *   Signing key:   set RESEND_WEBHOOK_SECRET in env
 */
export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[resend-webhook] RESEND_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  const body = await req.text();
  let evt: any;
  try {
    const wh = new Webhook(secret);
    evt = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
  } catch (err) {
    console.error("[resend-webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const eventType: string = evt.type;
  const data = evt.data ?? {};

  // Resend webhook payload: data.email_id is the email ID
  const resendEmailId: string | undefined = data.email_id;
  if (!resendEmailId) {
    // Not an email event we care about
    return NextResponse.json({ ok: true });
  }

  // Only act on delivery-related events
  const trackedEvents = new Set([
    "email.delivered",
    "email.bounced",
    "email.complained",
    "email.failed",
    "email.opened",
    "email.clicked",
  ]);
  if (!trackedEvents.has(eventType)) {
    return NextResponse.json({ ok: true });
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    console.error("[resend-webhook] NEXT_PUBLIC_CONVEX_URL not set");
    return NextResponse.json({ error: "Convex not configured" }, { status: 500 });
  }

  const client = new ConvexHttpClient(convexUrl);

  try {
    const result = await client.mutation(
      api.admin.eligibilityProvisioning.recordEmailDeliveryEvent,
      {
        resendEmailId,
        eventType,
        bounceType: data.bounce?.type ?? undefined,
        bounceMessage: data.bounce?.message ?? undefined,
      }
    );
    console.log(`[resend-webhook] ${eventType} processed`, result);
  } catch (err) {
    console.error("[resend-webhook] Convex mutation failed:", err);
    // Return 200 so Resend doesn't retry — we log but don't crash
  }

  return NextResponse.json({ ok: true });
}
