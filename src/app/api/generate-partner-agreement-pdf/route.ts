import { NextRequest, NextResponse } from "next/server";
import { pdf } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { Readable } from "stream";
import {
  ExecutedPartnerAgreementPdf,
  type ExecutedPartnerAgreementData,
} from "@/lib/partner-agreement-pdf";
import { loadKitPages } from "@/lib/partner-kit-pages";

/**
 * POST /api/generate-partner-agreement-pdf
 *
 * Composes the executed Partner Agreement for a partner who signed online, so
 * their own signed copy can be handed back to them in the resource library.
 * Same shape as /api/generate-w9-pdf: react-pdf needs a Node runtime, which the
 * Convex action runtime is not, so rendering lives here and Convex calls in.
 *
 * The kit page images are read from `public/` on this side rather than posted
 * in — they are 3.5MB and identical on every call.
 *
 * Request body: ExecutedPartnerAgreementData minus `kitPages` (JSON)
 * Response: the PDF bytes (application/pdf), not base64 — the caller streams
 * them straight into storage.
 */

export const runtime = "nodejs";

type RequestBody = Omit<ExecutedPartnerAgreementData, "kitPages">;

export async function POST(req: NextRequest) {
  const secret = process.env.INTERNAL_API_SECRET;
  if (secret) {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let data: RequestBody;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!data.partnerAgencyName || !data.signatureDataUrl || !data.submittedAt) {
    return NextResponse.json(
      { error: "partnerAgencyName, signatureDataUrl, and submittedAt are required" },
      { status: 400 },
    );
  }

  try {
    const kitPages = await loadKitPages();
    const doc = createElement(ExecutedPartnerAgreementPdf, {
      data: { ...data, kitPages },
    }) as unknown as ReactElement<DocumentProps>;
    const stream = await pdf(doc).toBuffer();
    const buffer = await streamToBuffer(stream as unknown as Readable);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(buffer.length),
      },
    });
  } catch (err) {
    console.error("[generate-partner-agreement-pdf] PDF generation failed:", err);
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
