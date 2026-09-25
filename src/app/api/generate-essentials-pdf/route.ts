import { NextRequest, NextResponse } from "next/server";
import type { EssentialsPacketData } from "@/lib/essentials-packet-pdf";
import { generateEssentialsPdfs } from "@/lib/generate-essentials-pdf";

/**
 * POST /api/generate-essentials-pdf
 *
 * Generates the Ideal Health Essentials welcome packet and a standalone
 * membership agreement. Returns both as base64.
 *
 * Request body: EssentialsPacketData (JSON)
 * Authorization: Bearer {INTERNAL_API_SECRET}
 *
 * Response: { pdf: "<base64 string>", agreementPdf: "<base64 string>" }
 *
 * NOTE: Internal callers (other API routes, webhooks) should import
 * `generateEssentialsPdfs` directly from `@/lib/generate-essentials-pdf`
 * instead of HTTP-fetching this endpoint, since Vercel Deployment Protection
 * blocks route-to-route fetches.
 */
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Internal secret guard — prevents unauthenticated PDF generation
  const secret = process.env.INTERNAL_API_SECRET;
  if (secret) {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let data: EssentialsPacketData;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    return NextResponse.json(await generateEssentialsPdfs(data));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("required")) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error("[generate-essentials-pdf] PDF generation failed:", err);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}
