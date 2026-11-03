// @vitest-environment node
import { expect, test } from "vitest";
import { writeFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { generateFulfillmentPdfs } from "../generate-fulfillment-pdf";
import { memberLogoDataUri } from "../member-logo";

test.each([false, true])("renders real oral PDFs with opted-in branding: %s", async branded => {
  const brand = branded ? { name: "AssureVantage", portalUrl: "https://www.assurevantage.com/assurevantage/dashboard", logoUrl: "/brands/assurevantage/logo.png" } : undefined;
  const result = await generateFulfillmentPdfs({ memberName: "Sample Member", memberFirstName: "Sample", memberEmail: "sample@example.test", memberId: "100000001", groupCode: "TEST", planName: branded ? "AssureVantage Savings Plan" : "Ideal Oral Savings Plan", effectiveDate: "Nov 1, 2026", brand });
  const packet = await PDFDocument.load(Buffer.from(result.pdf, "base64"));
  const agreement = await PDFDocument.load(Buffer.from(result.agreementPdf, "base64"));
  expect(packet.getAuthor()).toBe(branded ? "AssureVantage" : "Ideal Oral Health");
  expect(packet.getPageCount()).toBeGreaterThanOrEqual(7);
  expect(agreement.getAuthor()).toBe(packet.getAuthor());
  writeFileSync(`/tmp/idealoralcare-${branded ? "assure" : "ideal"}-oral-sample.pdf`, Buffer.from(result.pdf, "base64"));
  writeFileSync(`/tmp/idealoralcare-${branded ? "assure" : "ideal"}-agreement-sample.pdf`, Buffer.from(result.agreementPdf, "base64"));
}, 20000);

test("PDF logo loading cannot read outside public or fetch an arbitrary host", () => {
  expect(memberLogoDataUri({ name: "Other", logoUrl: "/../package.json" })).toBeUndefined();
  expect(memberLogoDataUri({ name: "Other", logoUrl: "http://127.0.0.1/private.png" })).toBeUndefined();
  expect(memberLogoDataUri({ name: "Other" })).toBeUndefined();
  expect(memberLogoDataUri({ logoUrl: "/brands/assurevantage/logo.png" })).toMatch(/^data:image\/png;base64,/);
});
