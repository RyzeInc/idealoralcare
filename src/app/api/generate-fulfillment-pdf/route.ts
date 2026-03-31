import { NextRequest, NextResponse } from "next/server";
import { pdf } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import path from "path";
import fs from "fs";
import { Readable } from "stream";
import { FulfillmentPacketPdf, MembershipAgreementPdf, FulfillmentPacketData } from "@/lib/fulfillment-pdf";

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
    // Generate fulfillment packet PDF
    const packetDoc = createElement(
      FulfillmentPacketPdf,
      { data }
    ) as unknown as ReactElement<DocumentProps>;
    const packetInstance = pdf(packetDoc);
    const packetStream = await packetInstance.toBuffer();
    const packetBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const nodeStream = packetStream as unknown as Readable;
      nodeStream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      nodeStream.on("end", () => resolve(Buffer.concat(chunks)));
      nodeStream.on("error", reject);
    });

    // Generate standalone membership agreement PDF
    const agreementDoc = createElement(
      MembershipAgreementPdf,
      { data }
    ) as unknown as ReactElement<DocumentProps>;
    const agreementInstance = pdf(agreementDoc);
    const agreementStream = await agreementInstance.toBuffer();
    const agreementBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const nodeStream = agreementStream as unknown as Readable;
      nodeStream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      nodeStream.on("end", () => resolve(Buffer.concat(chunks)));
      nodeStream.on("error", reject);
    });

    return NextResponse.json({
      pdf: packetBuffer.toString("base64"),
      agreementPdf: agreementBuffer.toString("base64"),
    });
  } catch (err) {
    console.error("[generate-fulfillment-pdf] PDF generation failed:", err);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}
