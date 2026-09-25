import { pdf } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import path from "path";
import fs from "fs";
import { Readable } from "stream";
import { FulfillmentPacketPdf, MembershipAgreementPdf, FulfillmentPacketData } from "@/lib/fulfillment-pdf";

/**
 * Generate fulfillment packet + membership agreement PDFs in-process.
 * Returns base64-encoded strings. Use this from server code (API routes,
 * webhooks, etc.) instead of HTTP-fetching `/api/generate-fulfillment-pdf`,
 * since Vercel Deployment Protection blocks internal route-to-route fetches.
 */
export async function generateFulfillmentPdfs(
  data: FulfillmentPacketData
): Promise<{ pdf: string; agreementPdf: string }> {
  if (!data.memberName || !data.memberId || !data.effectiveDate) {
    throw new Error("memberName, memberId, and effectiveDate are required");
  }

  // Embed the logo as a base64 data URI for @react-pdf/renderer
  if (!data.logoDataUri) {
    const logoPath = path.join(process.cwd(), "public", "ideal-oral-health-logo.png");
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      data.logoDataUri = `data:image/png;base64,${logoBuffer.toString("base64")}`;
    }
  }

  const packetDoc = createElement(FulfillmentPacketPdf, { data }) as unknown as ReactElement<DocumentProps>;
  const packetStream = await pdf(packetDoc).toBuffer();
  const packetBuffer = await streamToBuffer(packetStream as unknown as Readable);

  const agreementDoc = createElement(MembershipAgreementPdf, { data }) as unknown as ReactElement<DocumentProps>;
  const agreementStream = await pdf(agreementDoc).toBuffer();
  const agreementBuffer = await streamToBuffer(agreementStream as unknown as Readable);

  return {
    pdf: packetBuffer.toString("base64"),
    agreementPdf: agreementBuffer.toString("base64"),
  };
}

function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}
