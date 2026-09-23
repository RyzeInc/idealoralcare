import fs from "fs";
import { PDFDocument } from "pdf-lib";

/**
 * Append existing PDF files to a rendered @react-pdf document.
 *
 * @react-pdf cannot embed pages from an existing PDF, so packets that include
 * a vendor's own brochure have to be stitched together after rendering.
 *
 * A missing or unreadable attachment is logged and skipped rather than thrown:
 * a member receiving a packet without the vendor brochure is recoverable, a
 * failed enrollment email is not.
 */
export async function mergePdfs(base: Buffer, appendPaths: string[]): Promise<Buffer> {
  if (appendPaths.length === 0) return base;

  const merged = await PDFDocument.load(base);

  for (const filePath of appendPaths) {
    try {
      if (!fs.existsSync(filePath)) {
        console.warn(`[pdf-merge] Attachment not found, skipping: ${filePath}`);
        continue;
      }
      const source = await PDFDocument.load(fs.readFileSync(filePath));
      const pages = await merged.copyPages(source, source.getPageIndices());
      for (const page of pages) merged.addPage(page);
    } catch (err) {
      console.error(`[pdf-merge] Failed to append ${filePath}, skipping:`, err);
    }
  }

  return Buffer.from(await merged.save());
}
