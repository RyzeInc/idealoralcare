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
import {
  EssentialsPacketPdf,
  EssentialsMembershipAgreementPdf,
  EssentialsMemberCardPdf,
  essentialsCoverageLabel,
  isEssentialsSlug,
  type EssentialsPacketData,
} from "@/lib/essentials-packet-pdf";
import { essentialsAppendPaths } from "@/lib/essentials-packet-assets";
import { mergePdfs } from "@/lib/pdf-merge";
import { PROVIDER_GROUP_CODE } from "@/lib/constants";

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
 *
 * The program is inferred from the member's catalog product: an Essentials
 * member gets the Essentials packet, card and agreement from the same three
 * type values, so callers never have to know which program they are on.
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

  // Load logo once — each program uses its own mark.
  function logoDataUri(fileName: string): string | undefined {
    const logoPath = path.join(process.cwd(), "public", fileName);
    if (!fs.existsSync(logoPath)) return undefined;
    return `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`;
  }

  if (isEssentialsSlug(memberProfile?.productSlug)) {
    const essentialsData: EssentialsPacketData = {
      memberName: memberProfile?.memberName ?? user.fullName ?? "Member",
      memberFirstName: user.firstName ?? "Member",
      memberEmail: user.emailAddresses[0]?.emailAddress ?? "",
      essentialsMemberNumber: memberProfile?.essentialsMemberNumber ?? "—",
      essentialsGroupNumber: memberProfile?.essentialsGroupNumber ?? "—",
      planName: memberProfile?.planName ?? "Essentials Plan",
      coverageType: essentialsCoverageLabel(memberProfile?.productSlug),
      effectiveDate:
        memberProfile?.effectiveDate ??
        new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
      term: bundleData?.pricingSnapshot?.totalCents > 100000 ? "Annual" : "Monthly",
      logoDataUri: logoDataUri("ideal-health-logo.png"),
    };

    const essentialsDocs = {
      packet: EssentialsPacketPdf,
      agreement: EssentialsMembershipAgreementPdf,
      card: EssentialsMemberCardPdf,
    } as const;

    const essentialsFilenames = {
      packet: "Ideal_Health_Essentials_Welcome_Packet.pdf",
      agreement: "Ideal_Health_Essentials_Membership_Agreement.pdf",
      card: "Ideal_Health_Essentials_Member_Card.pdf",
    } as const;

    try {
      const key = type as keyof typeof essentialsDocs;
      const document = createElement(essentialsDocs[key], {
        data: essentialsData,
      }) as unknown as ReactElement<DocumentProps>;
      const stream = await pdf(document).toBuffer();

      const chunks: Buffer[] = [];
      for await (const chunk of stream as AsyncIterable<Buffer>) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      let buffer: Buffer = Buffer.concat(chunks);
      if (key === "packet") buffer = await mergePdfs(buffer, essentialsAppendPaths());

      return new NextResponse(buffer as unknown as BodyInit, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${essentialsFilenames[key]}"`,
          "Cache-Control": "private, no-cache",
        },
      });
    } catch (err) {
      console.error(`[documents] Essentials PDF generation failed (type=${type}):`, err);
      return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
    }
  }

  const data: FulfillmentPacketData = {
    memberName: memberProfile?.memberName ?? user.fullName ?? "Member",
    memberFirstName: user.firstName ?? "Member",
    memberEmail: user.emailAddresses[0]?.emailAddress ?? "",
    memberId: memberProfile?.memberId ?? "—",
    subscriberId: memberProfile?.subscriberId ?? memberProfile?.memberId,
    groupCode: memberProfile?.groupCode ?? PROVIDER_GROUP_CODE,
    planName: memberProfile?.planName ?? "Ideal Oral Savings Plan",
    effectiveDate:
      memberProfile?.effectiveDate ??
      new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
    term: bundleData?.pricingSnapshot?.totalCents > 2000 ? "Annual" : "Monthly",
    memberServicesPhone: "(844) 679-9367",
    memberWebsite: "www.getidealoh.com",
    networks: memberProfile?.networks,
  };

  data.logoDataUri = logoDataUri("ideal-oral-health-logo.png");

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
