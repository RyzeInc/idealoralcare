import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

/**
 * POST /api/twilio/voice
 *
 * The TwiML App's Voice URL — Twilio calls this the instant a rep's browser
 * places a call via Device.connect({ params: { To } }). Returns TwiML
 * dialing the number the client requested, with the configured caller ID.
 *
 * Signature-verified the same way src/app/api/resend/webhook does with
 * Svix: Twilio signs every webhook request, and skipping verification here
 * would let anyone POST arbitrary TwiML instructions to this endpoint.
 *
 * NEEDS: TWILIO_AUTH_TOKEN (signature verification), TWILIO_CALLER_ID (a
 * number purchased on the Twilio account).
 */
export async function POST(req: NextRequest) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const callerId = process.env.TWILIO_CALLER_ID;
  if (!authToken || !callerId) {
    return new NextResponse("Twilio Voice is not configured", { status: 501 });
  }

  const bodyText = await req.text();
  const params = Object.fromEntries(new URLSearchParams(bodyText));
  const signature = req.headers.get("x-twilio-signature");
  const url = req.nextUrl.toString();

  if (!signature || !twilio.validateRequest(authToken, signature, url, params)) {
    return new NextResponse("Invalid signature", { status: 403 });
  }

  const to = params.To;
  const { VoiceResponse } = twilio.twiml;
  const response = new VoiceResponse();

  if (!to) {
    response.say("No number was provided to dial.");
  } else {
    // Recording is deliberately OFF — two-party-consent rules vary by state,
    // and enabling it needs a per-state consent map before it's safe to turn
    // on. See convex/crm/telephony.ts.
    const dial = response.dial({ callerId, answerOnBridge: true });
    dial.number(to);
  }

  return new NextResponse(response.toString(), { headers: { "Content-Type": "text/xml" } });
}
