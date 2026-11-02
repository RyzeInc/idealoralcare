import path from "path";
import fs from "node:fs";
import { resolveBflMemberCode } from "@/convex/lib/bflCodes";
import { ESSENTIALS_BFL_MEMBER_CODE } from "@/convex/lib/constants";

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
 * Additional RxValet, QuestSelect and HBE501 materials were supplied November 1.
 * They remain source material outside public assets. HBE501 is a proposed
 * CMG/Soars-specific replacement, not an appendix to every Essentials packet.
 */
const ASSET_DIR = path.join(process.cwd(), "server-assets", "packets", "essentials");

export const ESSENTIALS_APPENDED_DOCUMENTS = [
  {
    id: "bfl-welcome-letter",
    label: "Balance for Life — Member Support Program welcome letter",
    file: "bfl-welcome-letter.pdf",
  },
] as const;

/** Absolute paths, in the order they are appended to the packet. */
export function essentialsAppendPaths(data?: { bflMemberCode?: string }): string[] {
  // The legacy appendix prints IDEAL. Custom-code groups use the native BFL
  // instructions and card, which carry their assigned code, instead of a
  // contradictory access code. A code-free vendor appendix can be added later.
  if (resolveBflMemberCode(data) !== ESSENTIALS_BFL_MEMBER_CODE) return [];
  return ESSENTIALS_APPENDED_DOCUMENTS.map((doc) => path.join(ASSET_DIR, doc.file));
}

/** Original QR images from the supplied code-free BFL welcome letter, unmodified. */
export function bflAppQrData(data: { bflMemberCode?: string }): { bflAndroidQrDataUri?: string; bflIosQrDataUri?: string } {
  if (resolveBflMemberCode(data) === ESSENTIALS_BFL_MEMBER_CODE) return {};
  const read = (name: string) => `data:image/png;base64,${fs.readFileSync(path.join(ASSET_DIR, name)).toString("base64")}`;
  return { bflAndroidQrDataUri: read("bfl-android-qr.png"), bflIosQrDataUri: read("bfl-ios-qr.png") };
}
