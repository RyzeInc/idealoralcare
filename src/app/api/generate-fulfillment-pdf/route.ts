import { NextRequest, NextResponse } from "next/server";
import { pdf } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import path from "path";
import fs from "fs";
import { FulfillmentPacketPdf, FulfillmentPacketData } from "@/lib/fulfillment-pdf";

/**
 * POST /api/generate-fulfillment-pdf
 *
 * Generates a member fulfillment packet PDF and returns it as base64.
 *
 * Request body: FulfillmentPacketData (JSON)
 * Authorization: Bearer {INTERNAL_API_SECRET}
 *
 * Response: { pdf: "<base64 string>" }
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

  // Required field validation
  if (!data.memberName || !data.memberId || !data.effectiveDate) {
    return NextResponse.json(
      { error: "memberName, memberId, and effectiveDate are required" },
      { status: 400 }
    );
  }

  // Load the logo as a base64 data URI so @react-pdf/renderer can embed it
  if (!data.logoDataUri) {
    const logoPath = path.join(process.cwd(), "public", "ideal-oral-health-logo.png");
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      data.logoDataUri = `data:image/png;base64,${logoBuffer.toString("base64")}`;
    }
  }

  try {
    const document = createElement(
      FulfillmentPacketPdf,
      { data }
    ) as unknown as ReactElement<DocumentProps>;
    const pdfInstance = pdf(document);
    // toBuffer() returns a ReadableStream<Uint8Array> in @react-pdf/renderer v4
    const stream = await pdfInstance.toBuffer();
    const chunks: Uint8Array[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reader = (stream as any).getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value as Uint8Array);
    }
    const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    const base64 = buffer.toString("base64");

    return NextResponse.json({ pdf: base64 });
  } catch (err) {
    console.error("[generate-fulfillment-pdf] PDF generation failed:", err);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}
