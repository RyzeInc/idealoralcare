// @vitest-environment node
/**
 * THE EXECUTED AGREEMENT ACTUALLY RENDERS.
 *
 * This document is composed rather than uploaded, so a silent render failure
 * would leave partners with a permanently "being prepared" agreement and no
 * error anywhere obvious. Rendering the real kit images end-to-end is the only
 * thing that catches a bad image path or an unsupported style.
 */

import { describe, test, expect } from "vitest";
import { pdf } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { Readable } from "stream";
import {
  ExecutedPartnerAgreementPdf,
  AGREEMENT_PAGE_INDEX,
} from "./partner-agreement-pdf";
import { loadKitPages, KIT_PAGE_COUNT } from "./partner-kit-pages";

// A 1x1 transparent PNG — stands in for the drawn signature.
const SIGNATURE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (c) => chunks.push(Buffer.from(c)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

async function render(kitPages: string[]) {
  const doc = createElement(ExecutedPartnerAgreementPdf, {
    data: {
      partnerAgencyName: "Smoke Test Agency LLC",
      dba: "SmokeTest",
      primaryContactName: "Dana Signer",
      email: "dana@example.com",
      phone: "555-0100",
      npnLicenseInfo: "NPN 1234567",
      effectiveDate: "01/15/2026",
      signatureDataUrl: SIGNATURE,
      printedName: "Dana Signer",
      title: "Managing Partner",
      signedDate: "01/15/2026",
      submittedAt: 1768500000000,
      submittedFromIp: "203.0.113.7",
      kitPages,
    },
  }) as unknown as ReactElement<DocumentProps>;
  const stream = await pdf(doc).toBuffer();
  return await streamToBuffer(stream as unknown as Readable);
}

describe("executed partner agreement PDF", () => {
  test("renders every kit page plus the execution record", async () => {
    const kitPages = await loadKitPages();
    expect(kitPages).toHaveLength(KIT_PAGE_COUNT);
    expect(kitPages[AGREEMENT_PAGE_INDEX]).toMatch(/^data:image\/jpeg;base64,/);

    const buffer = await render(kitPages);

    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    // The kit images dominate the size; a document this large could only have
    // embedded them.
    expect(buffer.length).toBeGreaterThan(1_000_000);
    // Kit pages + the execution record page.
    const pageCount = buffer.toString("latin1").match(/\/Type\s*\/Page[^s]/g)?.length ?? 0;
    expect(pageCount).toBe(KIT_PAGE_COUNT + 1);
  }, 120_000);

  test("optional fields left blank do not break the render", async () => {
    const kitPages = await loadKitPages();
    const doc = createElement(ExecutedPartnerAgreementPdf, {
      data: {
        partnerAgencyName: "Bare Minimum LLC",
        primaryContactName: "Sam Signer",
        email: "sam@example.com",
        signatureDataUrl: SIGNATURE,
        submittedAt: 1768500000000,
        kitPages,
      },
    }) as unknown as ReactElement<DocumentProps>;
    const stream = await pdf(doc).toBuffer();
    const buffer = await streamToBuffer(stream as unknown as Readable);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  }, 120_000);
});
