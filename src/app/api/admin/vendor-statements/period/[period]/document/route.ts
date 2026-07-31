import { NextRequest, NextResponse } from "next/server";
import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { api } from "@/convex/_generated/api";
import {
  periodBundleFileBase,
  periodStatementsToCsv,
} from "@/lib/vendor-statement-document";
import { VendorStatementBundlePdf } from "@/lib/vendor-statement-pdf";
import {
  adminConvexClient,
  assembleDocument,
  fileResponse,
  parseFormat,
  pdfBuffer,
  periodSheets,
  xlsxBuffer,
} from "@/lib/vendor-statement-server";

export const runtime = "nodejs";

/**
 * GET /api/admin/vendor-statements/period/[period]/document?format=pdf|csv|xlsx
 *
 * Every live statement for one coverage month in a single file: a PDF with one
 * statement per page, a workbook with a rollup sheet plus one sheet per
 * recipient, or a flat CSV keyed by recipient.
 *
 * This is the internal reconciliation view of the whole month — it is not the
 * file you send to an individual vendor. Per-recipient documents come from
 * /api/admin/vendor-statements/[statementId]/document.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ period: string }> },
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

  const { period } = await params;
  if (!/^\d{4}-\d{2}$/.test(period)) {
    return NextResponse.json({ error: "Invalid coverage month" }, { status: 400 });
  }

  try {
    const rows = await convex.query(api.admin.vendorStatements.listStatements, {
      period,
      limit: 100,
    });
    const live = rows.filter((row) => row.status !== "voided");
    if (live.length === 0) {
      return NextResponse.json(
        { error: `No statements have been generated for ${period}` },
        { status: 404 },
      );
    }

    // Re-read each statement individually so member detail is hydrated from
    // the frozen close rows the same way the single-statement route does.
    const docs = [];
    for (const row of live) {
      const full = await convex.query(api.admin.vendorStatements.getStatement, {
        statementId: row._id,
      });
      if (full) docs.push(assembleDocument(full));
    }
    docs.sort((a, b) => a.vendorName.localeCompare(b.vendorName));

    const base = periodBundleFileBase(docs, period);
    if (format === "csv") {
      return fileResponse(periodStatementsToCsv(docs), "csv", `${base}.csv`);
    }
    if (format === "xlsx") {
      return fileResponse(
        await xlsxBuffer(periodSheets(docs, period)),
        "xlsx",
        `${base}.xlsx`,
      );
    }
    const element = createElement(VendorStatementBundlePdf, {
      docs,
      period,
    }) as unknown as ReactElement<DocumentProps>;
    return fileResponse(await pdfBuffer(element), "pdf", `${base}.pdf`);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Statement bundle generation failed";
    console.error("[vendor-statement period document] failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
