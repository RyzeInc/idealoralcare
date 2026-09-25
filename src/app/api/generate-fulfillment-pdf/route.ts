import { NextRequest, NextResponse } from "next/server";
import { FulfillmentPacketData } from "@/lib/fulfillment-pdf";
import { generateFulfillmentPdfs } from "@/lib/generate-fulfillment-pdf";

/**
 * POST /api/generate-fulfillment-pdf
 *
 * Generates a member fulfillment packet PDF and a standalone membership agreement PDF.
 * Returns both as base64.
 *
 * Request body: FulfillmentPacketData (JSON)
 * Authorization: Bearer {INTERNAL_API_SECRET}
 *
 * Response: { pdf: "<base64 string>", agreementPdf: "<base64 string>" }
 *
 * NOTE: Internal callers (other API routes, webhooks) should import
 * `generateFulfillmentPdfs` directly from `@/lib/generate-fulfillment-pdf`
 * instead of HTTP-fetching this endpoint, since Vercel Deployment Protection
 * blocks route-to-route fetches.
 */
export async function POST(req: NextRequest) {
  // Internal secret guard — prevents unauthenticated PDF generation
  const secret = process.env.INTERNAL_API_SECRET;
  if (secret) {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let data: FulfillmentPacketData;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const result = await generateFulfillmentPdfs(data);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("required")) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error("[generate-fulfillment-pdf] PDF generation failed:", err);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}
