import { NextRequest, NextResponse } from "next/server";
import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  statementToCsv,
  statementFileBase,
} from "@/lib/vendor-statement-document";
import { VendorStatementPdf } from "@/lib/vendor-statement-pdf";
import {
  adminConvexClient,
  assembleDocument,
  fileResponse,
  parseFormat,
  pdfBuffer,
  statementSheets,
  xlsxBuffer,
} from "@/lib/vendor-statement-server";

export const runtime = "nodejs";

/**
 * GET /api/admin/vendor-statements/[statementId]/document?format=pdf|csv|xlsx
 *
 * One issued statement in the requested format. All three are built from the
 * same server-assembled payload, so the spreadsheet a vendor receives contains
 * exactly what their PDF shows — no more.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ statementId: string }> },
) {
  const authResult = await adminConvexClient();
  if ("error" in authResult) return authResult.error;
  const { convex } = authResult;

  const format = parseFormat(request.nextUrl.searchParams.get("format"));
  if (!format) {
    return NextResponse.json(
      { error: "format must be one of: pdf, csv, xlsx" },
      { status: 400 },
    );
  }

  const { statementId } = await params;
  try {
    const row = await convex.query(api.admin.vendorStatements.getStatement, {
      statementId: statementId as Id<"vendorStatements">,
    });
    if (!row) {
      return NextResponse.json({ error: "Statement not found" }, { status: 404 });
    }

    const doc = assembleDocument(row);
    const base = statementFileBase(doc);

    if (format === "csv") {
      return fileResponse(statementToCsv(doc), "csv", `${base}.csv`);
    }
    if (format === "xlsx") {
      return fileResponse(await xlsxBuffer(statementSheets(doc)), "xlsx", `${base}.xlsx`);
    }
    const element = createElement(VendorStatementPdf, { doc }) as unknown as ReactElement<DocumentProps>;
    return fileResponse(await pdfBuffer(element), "pdf", `${base}.pdf`);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Statement document generation failed";
    console.error("[vendor-statement document] failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
