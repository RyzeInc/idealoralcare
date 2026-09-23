import { NextRequest, NextResponse } from "next/server";
import { pdf } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import path from "path";
import fs from "fs";
import { Readable } from "stream";
import {
  EssentialsPacketPdf,
  EssentialsMembershipAgreementPdf,
  type EssentialsPacketData,
} from "@/lib/essentials-packet-pdf";
import { essentialsAppendPaths } from "@/lib/essentials-packet-assets";
import { mergePdfs } from "@/lib/pdf-merge";

/**
 * POST /api/generate-essentials-pdf
 *
 * Generates the Ideal Health Essentials welcome packet and a standalone
 * membership agreement. Returns both as base64.
 *
 * The packet has the Balance for Life welcome letter appended after the
 * generated pages — see lib/essentials-packet-assets.ts.
 *
 * Request body: EssentialsPacketData (JSON)
 * Authorization: Bearer {INTERNAL_API_SECRET}
 *
 * Response: { pdf: "<base64 string>", agreementPdf: "<base64 string>" }
 */
export const runtime = "nodejs";

async function toBuffer(document: ReactElement<DocumentProps>): Promise<Buffer> {
  const stream = await pdf(document).toBuffer();
  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const nodeStream = stream as unknown as Readable;
    nodeStream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    nodeStream.on("end", () => resolve(Buffer.concat(chunks)));
    nodeStream.on("error", reject);
  });
}

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

  if (!data.memberName || !data.essentialsMemberNumber || !data.effectiveDate) {
    return NextResponse.json(
      {
        error:
          "memberName, essentialsMemberNumber, and effectiveDate are required",
      },
      { status: 400 },
    );
  }

  // Load the logo as a base64 data URI so @react-pdf/renderer can embed it
  if (!data.logoDataUri) {
    const logoPath = path.join(process.cwd(), "public", "ideal-health-logo.png");
    if (fs.existsSync(logoPath)) {
      data.logoDataUri = `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`;
    }
  }

  try {
    const packetDoc = createElement(EssentialsPacketPdf, {
      data,
    }) as unknown as ReactElement<DocumentProps>;
    const packetBuffer = await mergePdfs(await toBuffer(packetDoc), essentialsAppendPaths());

    const agreementDoc = createElement(EssentialsMembershipAgreementPdf, {
      data,
    }) as unknown as ReactElement<DocumentProps>;
    const agreementBuffer = await toBuffer(agreementDoc);

    return NextResponse.json({
      pdf: packetBuffer.toString("base64"),
      agreementPdf: agreementBuffer.toString("base64"),
    });
  } catch (err) {
    console.error("[generate-essentials-pdf] PDF generation failed:", err);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}
