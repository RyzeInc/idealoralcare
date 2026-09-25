import { NextRequest, NextResponse } from "next/server";
import { pdf } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { Readable } from "stream";
import { SubstituteW9Pdf, SubstituteW9Data } from "@/lib/w9-pdf";

/**
 * POST /api/generate-w9-pdf
 *
 * Generates a signed substitute Form W-9 PDF from posted field data.
 * This is the only place the full (unmasked) TIN transits in plaintext —
 * internal server-to-server call, gated by INTERNAL_API_SECRET, over HTTPS.
 *
 * Request body: SubstituteW9Data (JSON)
 * Response: { pdf: "<base64 string>" }
 */
export async function POST(req: NextRequest) {
  const secret = process.env.INTERNAL_API_SECRET;
  if (secret) {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let data: SubstituteW9Data;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!data.legalName || !data.tin || !data.signatureDataUrl) {
    return NextResponse.json(
      { error: "legalName, tin, and signatureDataUrl are required" },
      { status: 400 }
    );
  }

  try {
    const doc = createElement(SubstituteW9Pdf, { data }) as unknown as ReactElement<DocumentProps>;
    const stream = await pdf(doc).toBuffer();
    const buffer = await streamToBuffer(stream as unknown as Readable);
    return NextResponse.json({ pdf: buffer.toString("base64") });
  } catch (err) {
    console.error("[generate-w9-pdf] PDF generation failed:", err);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}

function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}
