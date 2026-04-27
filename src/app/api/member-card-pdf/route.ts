import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { pdf } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import path from "path";
import fs from "fs";
import { MemberCardPdf, type FulfillmentPacketData } from "@/lib/fulfillment-pdf";

/**
 * GET /api/member-card-pdf
 *
 * Member-facing PDF download. Uses Clerk auth to fetch the logged-in user's
 * profile and generates a fulfillment packet PDF returned as a download.
 */
export async function GET() {
  const user = await currentUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Fetch member profile from Convex using the verified Clerk userId
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || "");
  let memberProfile: any = null;
  let bundleData: any = null;

  try {
    memberProfile = await convex.query(
      api.subscriptions.queries.getMemberCardDataPublic as any,
      { customerId: user.id }
    );
    bundleData = await convex.query(
      api.subscriptions.queries.getCustomerBundlePublic,
      { customerId: user.id }
    );
  } catch {
    // Continue with fallback data from Clerk profile
  }

  // Build fulfillment data from member profile or fall back to Clerk user info
  const data: FulfillmentPacketData = {
    memberName: memberProfile?.memberName ?? user.fullName ?? "Member",
    memberFirstName: user.firstName ?? "Member",
    memberEmail: user.emailAddresses[0]?.emailAddress ?? "",
    memberId: memberProfile?.memberId ?? "—",
    groupCode: "IDEALDO",
    planName: memberProfile?.planName ?? "Ideal Oral Savings Plan",
    effectiveDate: memberProfile?.effectiveDate ?? new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    term: bundleData?.pricingSnapshot?.totalCents > 2000 ? "Annual" : "Monthly",
    memberServicesPhone: "(800) 290-0523",
    memberWebsite: "getidealoh.com/health/dashboard",
  };

  // Load logo as base64 data URI
  const logoPath = path.join(process.cwd(), "public", "ideal-oral-health-logo.png");
  if (fs.existsSync(logoPath)) {
    const logoBuffer = fs.readFileSync(logoPath);
    data.logoDataUri = `data:image/png;base64,${logoBuffer.toString("base64")}`;
  }

  try {
    const document = createElement(
      MemberCardPdf,
      { data }
    ) as unknown as ReactElement<DocumentProps>;

    const pdfInstance = pdf(document);
    const stream = await pdfInstance.toBuffer();
    const chunks: Buffer[] = [];
    for await (const chunk of stream as AsyncIterable<Buffer>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    // Generate filename: IdealOralHealthCard-membername-memberid.pdf
    const sanitizedName = data.memberName.replace(/[^a-zA-Z0-9-]/g, "").replace(/\s+/g, "");
    const sanitizedId = data.memberId.replace(/[^a-zA-Z0-9-]/g, "");
    const filename = `IdealOralHealthCard-${sanitizedName}-${sanitizedId}.pdf`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (err) {
    console.error("[member-card-pdf] PDF generation failed:", err);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}
