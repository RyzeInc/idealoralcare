import path from "path";

/**
 * Documents appended verbatim after the generated Essentials packet pages.
 *
 * Only material we cannot faithfully reproduce belongs here. The Balance for
 * Life welcome letter qualifies because it carries App Store and Google Play QR
 * codes whose underlying URLs are not documented anywhere we have access to.
 *
 * Everything else Benefits Horizon supplied (the Lyric how-to sheets, the
 * telehealth overview, the Essentials Benefits Guide) is reproduced natively in
 * essentials-packet-pdf.tsx so the packet reads as one document and each fact
 * appears exactly once.
 *
 * Still outstanding, to be added here once supplied:
 *   - RxValet "$0 COMPLETE PREM Formulary Brochure 2025"
 *   - "2025 QuestSelect Member Info"
 *   - HBE_501 Hospital Bill Helper
 */
const ASSET_DIR = path.join(process.cwd(), "public", "packet-assets", "essentials");

export const ESSENTIALS_APPENDED_DOCUMENTS = [
  {
    id: "bfl-welcome-letter",
    label: "Balance for Life — Member Support Program welcome letter",
    file: "bfl-welcome-letter.pdf",
  },
] as const;

/** Absolute paths, in the order they are appended to the packet. */
export function essentialsAppendPaths(): string[] {
  return ESSENTIALS_APPENDED_DOCUMENTS.map((doc) => path.join(ASSET_DIR, doc.file));
}
