import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { pdf } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import path from "path";
import fs from "fs";
import {
  FulfillmentPacketPdf,
  MembershipAgreementPdf,
  MemberCardPdf,
  type FulfillmentPacketData,
} from "@/lib/fulfillment-pdf";

/**
 * GET /api/documents?type=packet|agreement|card
 *
 * Authenticated document download. Generates and streams the requested PDF
 * directly to the browser as a file download.
 *
 * Types:
 *   packet    — Full member fulfillment packet
 *   agreement — Standalone membership agreement
 *   card      — Member ID card (front & back)
 */
export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "card";
  if (!["packet", "agreement", "card"].includes(type)) {
    return NextResponse.json({ error: "Invalid type. Use packet, agreement, or card." }, { status: 400 });
  }

  // Fetch member profile from Convex
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL ?? "");
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
    // Fall back to Clerk profile data
  }

  const data: FulfillmentPacketData = {
    memberName: memberProfile?.memberName ?? user.fullName ?? "Member",
    memberFirstName: user.firstName ?? "Member",
    memberEmail: user.emailAddresses[0]?.emailAddress ?? "",
    memberId: memberProfile?.memberId ?? "—",
    groupCode: memberProfile?.groupCode ?? "IDEALDO",
    planName: memberProfile?.planName ?? "Ideal Oral Savings Plan",
    effectiveDate:
      memberProfile?.effectiveDate ??
      new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
    term: bundleData?.pricingSnapshot?.totalCents > 2000 ? "Annual" : "Monthly",
    memberServicesPhone: "support@getidealoh.com",
    memberWebsite: "getidealoh.com/health/dashboard",
  };

  // Load logo
  const logoPath = path.join(process.cwd(), "public", "ideal-oral-health-logo.png");
  if (fs.existsSync(logoPath)) {
    const logoBuffer = fs.readFileSync(logoPath);
    data.logoDataUri = `data:image/png;base64,${logoBuffer.toString("base64")}`;
  }

  const docComponents: Record<string, React.ComponentType<{ data: FulfillmentPacketData }>> = {
    packet: FulfillmentPacketPdf,
    agreement: MembershipAgreementPdf,
    card: MemberCardPdf,
  };

  const filenameMap: Record<string, string> = {
    packet: "Ideal_Oral_Health_Membership_Packet.pdf",
    agreement: "Ideal_Oral_Health_Membership_Agreement.pdf",
    card: "Ideal_Oral_Health_Member_Card.pdf",
  };

  try {
    const DocComponent = docComponents[type];
    const document = createElement(DocComponent, { data }) as unknown as ReactElement<DocumentProps>;
    const pdfInstance = pdf(document);
    const stream = await pdfInstance.toBuffer();

    const chunks: Buffer[] = [];
    for await (const chunk of stream as AsyncIterable<Buffer>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filenameMap[type]}"`,
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (err) {
    console.error(`[documents] PDF generation failed (type=${type}):`, err);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}
