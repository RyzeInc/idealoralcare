import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

/**
 * POST /api/clerk/webhook
 *
 * Receives Clerk webhook events. Currently handles `user.created` to:
 *   - Match the new Clerk user back to a pre-loaded eligibility memberProfile
 *   - Provision an employer-paid bundle + entitlement (no Stripe involved)
 *
 * Configure in Clerk dashboard:
 *   Endpoint URL:  https://<your-app>/api/clerk/webhook
 *   Subscribe to:  user.created   (and optionally user.updated)
 *   Signing key:   set CLERK_WEBHOOK_SECRET in env
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[clerk-webhook] CLERK_WEBHOOK_SECRET not set");
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
    console.error("[clerk-webhook] Signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (evt.type !== "user.created") {
    return NextResponse.json({ ok: true, ignored: evt.type });
  }

  const data = evt.data ?? {};
  const clerkUserId: string | undefined = data.id;
  const email: string | undefined =
    data.email_addresses?.find((e: any) => e.id === data.primary_email_address_id)?.email_address ??
    data.email_addresses?.[0]?.email_address;

  if (!clerkUserId || !email) {
    return NextResponse.json({ ok: true, skipped: "No id/email" });
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    console.error("[clerk-webhook] NEXT_PUBLIC_CONVEX_URL not set");
    return NextResponse.json({ error: "Convex URL not configured" }, { status: 500 });
  }

  const client = new ConvexHttpClient(convexUrl);
  try {
    const result = await client.mutation(
      api.admin.eligibilityProvisioning.linkInvitedMember,
      {
        clerkUserId,
        email,
        publicMetadata: data.public_metadata ?? {},
      }
    );
    return NextResponse.json({ ok: true, result });
  } catch (err: any) {
    console.error("[clerk-webhook] linkInvitedMember failed", err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
