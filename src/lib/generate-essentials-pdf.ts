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
 * Generate the Essentials welcome packet + membership agreement PDFs in-process.
 * Returns base64-encoded strings. The packet has the Balance for Life welcome
 * letter appended after the generated pages — see lib/essentials-packet-assets.ts.
 *
 * Use this from server code (API routes, webhooks, etc.) instead of
 * HTTP-fetching `/api/generate-essentials-pdf`, since Vercel Deployment
 * Protection blocks internal route-to-route fetches. The Essentials twin of
 * `generateFulfillmentPdfs` in ./generate-fulfillment-pdf.ts.
 */
export async function generateEssentialsPdfs(
  data: EssentialsPacketData
): Promise<{ pdf: string; agreementPdf: string }> {
  if (!data.memberName || !data.essentialsMemberNumber || !data.effectiveDate) {
    throw new Error("memberName, essentialsMemberNumber, and effectiveDate are required");
  }

  // Embed the logo as a base64 data URI for @react-pdf/renderer
  if (!data.logoDataUri) {
    const logoPath = path.join(process.cwd(), "public", "ideal-health-logo.png");
    if (fs.existsSync(logoPath)) {
      data.logoDataUri = `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`;
    }
  }

  const packetDoc = createElement(EssentialsPacketPdf, { data }) as unknown as ReactElement<DocumentProps>;
  const packetBuffer = await mergePdfs(await toBuffer(packetDoc), essentialsAppendPaths());

  const agreementDoc = createElement(EssentialsMembershipAgreementPdf, {
    data,
  }) as unknown as ReactElement<DocumentProps>;
  const agreementBuffer = await toBuffer(agreementDoc);

  return {
    pdf: packetBuffer.toString("base64"),
    agreementPdf: agreementBuffer.toString("base64"),
  };
}

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
