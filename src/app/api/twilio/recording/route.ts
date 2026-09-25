import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

/**
 * POST /api/twilio/recording
 *
 * Twilio's recording-status callback. Only relevant once recording is
 * actually enabled on the Dial verb in src/app/api/twilio/voice/route.ts —
 * which it currently is not (two-party-consent rules vary by state; see
 * convex/crm/telephony.ts). Wired now so enabling recording later is a
 * one-line change in the voice route, not a new endpoint.
 */
export async function POST(req: NextRequest) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    return new NextResponse("Twilio Voice is not configured", { status: 501 });
  }

  const bodyText = await req.text();
  const params = Object.fromEntries(new URLSearchParams(bodyText));
  const signature = req.headers.get("x-twilio-signature");
  const url = req.nextUrl.toString();

  if (!signature || !twilio.validateRequest(authToken, signature, url, params)) {
    return new NextResponse("Invalid signature", { status: 403 });
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return NextResponse.json({ error: "Convex not configured" }, { status: 500 });
  }

  const callSid = params.CallSid;
  const recordingUrl = params.RecordingUrl;
  if (!callSid || !recordingUrl) {
    return NextResponse.json({ ok: true });
  }

  try {
    const client = new ConvexHttpClient(convexUrl);
    const result = await client.mutation(api.crm.telephony.attachRecording, {
      externalCallId: callSid,
      recordingUrl,
    });
    console.log("[twilio-recording] processed", result);
  } catch (err) {
    console.error("[twilio-recording] Convex mutation failed:", err);
  }

  return NextResponse.json({ ok: true });
}
