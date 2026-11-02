// @vitest-environment node
import { expect, test } from "vitest";
import { existsSync, writeFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { generateEssentialsPdfs } from "../generate-essentials-pdf";
import { essentialsAppendPaths } from "../essentials-packet-assets";

test("member-only vendor appendix is bundled privately and omitted when it contradicts a custom code", () => {
  const legacy = essentialsAppendPaths();
  expect(legacy).toHaveLength(1);
  expect(legacy[0]).toContain("server-assets");
  expect(existsSync(legacy[0])).toBe(true);
  expect(existsSync("public/packet-assets/essentials/bfl-welcome-letter.pdf")).toBe(false);
  expect(essentialsAppendPaths({ bflMemberCode: "CMG" })).toEqual([]);
});

test.each(["bfl", "essentials"] as const)("renders a real custom-code %s packet and agreement", async program => {
  const result = await generateEssentialsPdfs({
    memberName: "Sample Member", memberFirstName: "Sample", memberEmail: "sample@example.com",
    essentialsMemberNumber: "100000001", essentialsGroupNumber: "123456", bflMemberCode: "CMG",
    planName: program === "bfl" ? "Balance for Life" : "Essentials", effectiveDate: "Nov 1, 2026", program,
  });
  const packet = Buffer.from(result.pdf, "base64");
  expect((await PDFDocument.load(packet)).getPageCount()).toBeGreaterThan(2);
  expect((await PDFDocument.load(Buffer.from(result.agreementPdf, "base64"))).getPageCount()).toBeGreaterThan(0);
  // Synthetic artifact for text inspection and review; no member data is used.
  writeFileSync(`/tmp/idealoralcare-cmg-${program}-sample.pdf`, packet);
}, 20000);
