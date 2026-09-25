import { readFile } from "fs/promises";
import path from "path";

/**
 * The Partner Kit pages, as data URIs, in order.
 *
 * Server-only — reads from `public/`. These are the same images /register
 * shows the signer, which is what lets the executed agreement reproduce the
 * instrument rather than paraphrase it.
 */

export const KIT_PAGE_COUNT = 8;

/** Cached across warm invocations — the pages never change between requests. */
let kitPagesPromise: Promise<string[]> | null = null;

export function loadKitPages(): Promise<string[]> {
  if (!kitPagesPromise) {
    kitPagesPromise = Promise.all(
      Array.from({ length: KIT_PAGE_COUNT }, async (_, i) => {
        const file = path.join(process.cwd(), "public", "partnerkit", `page-${i + 1}.jpg`);
        const bytes = await readFile(file);
        return `data:image/jpeg;base64,${bytes.toString("base64")}`;
      }),
    ).catch((err) => {
      // Don't cache a failure — a missing file should be retried, not sticky.
      kitPagesPromise = null;
      throw err;
    });
  }
  return kitPagesPromise;
}
