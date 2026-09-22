/**
 * GET /api/debug/pdf-preview
 *
 * Renders any PDF the system can generate from fixture data — no real member,
 * invoice, or statement required, and nothing is emailed.
 *
 *   /api/debug/pdf-preview                      → JSON list of available documents
 *   /api/debug/pdf-preview?doc=member-card      → the PDF, inline
 *   /api/debug/pdf-preview?doc=member-card&download=1  → the PDF, as a download
 *
 * Fixture data only — this route never reads member records.
 */

import { NextRequest, NextResponse } from "next/server";
import { pdf } from "@react-pdf/renderer";
import { Readable } from "stream";
import { PDF_DOCUMENTS, isPdfDocumentId, listPdfDocuments } from "@/lib/pdf-registry";

export const runtime = "nodejs";

async function renderToBuffer(docId: keyof typeof PDF_DOCUMENTS): Promise<Buffer> {
  const instance = pdf(PDF_DOCUMENTS[docId].build());
  const stream = await instance.toBuffer();

  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const nodeStream = stream as unknown as Readable;
    nodeStream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    nodeStream.on("end", () => resolve(Buffer.concat(chunks)));
    nodeStream.on("error", reject);
  });
}

export async function GET(req: NextRequest) {
  const docId = req.nextUrl.searchParams.get("doc");

  if (!docId) {
    return NextResponse.json({ documents: listPdfDocuments() });
  }

  if (!isPdfDocumentId(docId)) {
    return NextResponse.json(
      { error: `Unknown document: ${docId}`, available: listPdfDocuments().map((d) => d.id) },
      { status: 404 },
    );
  }

  const entry = PDF_DOCUMENTS[docId];
  const asDownload = req.nextUrl.searchParams.get("download") === "1";

  try {
    const buffer = await renderToBuffer(docId);

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${asDownload ? "attachment" : "inline"}; filename="${entry.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error(`[pdf-preview] ${docId} failed to render:`, err);
    return NextResponse.json(
      { error: "PDF generation failed", document: docId, detail: String(err) },
      { status: 500 },
    );
  }
}
