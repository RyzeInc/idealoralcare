/**
 * GET /api/admin/list-bill-invoices/preview-sample
 *
 * Kept as a stable direct link to the sample list-bill invoice. The fixture and
 * rendering now live in the shared PDF registry, which also powers the full
 * preview UI at /debug/pdf-preview.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.redirect(
    new URL(
      "/api/debug/pdf-preview?doc=list-bill-invoice",
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    ),
  );
}
