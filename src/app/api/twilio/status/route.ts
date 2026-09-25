import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

/**
 * POST /api/twilio/status
 *
 * Twilio's call status callback (statusCallback on the Dial verb, or
 * configured on the TwiML App). Signature-verified before touching Convex —
 * same split as src/app/api/resend/webhook: verify here, trust in the
 * mutation. See convex/crm/telephony.ts:recordCallStatus.
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
  const callStatus = params.CallStatus;
  if (!callSid || !callStatus) {
    return NextResponse.json({ ok: true }); // not a status event we care about
  }

  try {
    const client = new ConvexHttpClient(convexUrl);
    const result = await client.mutation(api.crm.telephony.recordCallStatus, {
      externalCallId: callSid,
      status: callStatus,
      durationSeconds: params.CallDuration ? Number(params.CallDuration) : undefined,
    });
    console.log(`[twilio-status] ${callStatus} processed`, result);
  } catch (err) {
    console.error("[twilio-status] Convex mutation failed:", err);
  }

  return NextResponse.json({ ok: true });
}
