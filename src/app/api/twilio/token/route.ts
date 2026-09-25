import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import twilio from "twilio";

/**
 * GET /api/twilio/token
 *
 * Mints a short-lived Twilio Voice AccessToken for the in-browser softphone
 * (@twilio/voice-sdk's Device). Clerk-gated — this is a capability grant,
 * not a webhook, so unlike the /status and /recording routes it needs a
 * signed-in admin session rather than Twilio's own signature.
 *
 * NEEDS: TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET,
 * TWILIO_TWIML_APP_SID in the Next.js environment. Returns 501 with a clear
 * message until they're set — see convex/crm/telephony.ts for the full list
 * this feature needs before it does anything.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKeySid = process.env.TWILIO_API_KEY_SID;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

  if (!accountSid || !apiKeySid || !apiKeySecret || !twimlAppSid) {
    return NextResponse.json(
      { error: "Twilio Voice is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, and TWILIO_TWIML_APP_SID to enable in-browser calling." },
      { status: 501 },
    );
  }

  const { AccessToken } = twilio.jwt;
  const { VoiceGrant } = AccessToken;

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: twimlAppSid,
    incomingAllow: false, // reps place calls; the CRM doesn't route inbound calls to a browser
  });

  const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
    identity: userId,
    ttl: 3600,
  });
  token.addGrant(voiceGrant);

  return NextResponse.json({ token: token.toJwt() });
}
