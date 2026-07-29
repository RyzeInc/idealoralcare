import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { pdf } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { Readable } from "stream";
import path from "path";
import fs from "fs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  MemberCardPdf,
  MemberCardsPdf,
  type FulfillmentPacketData,
} from "@/lib/fulfillment-pdf";
import { resolveMemberFacingId } from "@/lib/admin-format";

export const runtime = "nodejs";

/**
 * GET /api/admin/members/[memberId]/id-card
 *
 * Streams the member's ID card as a PDF. If the member has dependents,
 * the PDF includes a front/back page pair for each dependent as well,
 * sharing the family's subscriber/group IDs but each carrying its own
 * name and Toothlens account link.
 *
 * Auth: Clerk-authenticated admin (verified via Convex isAdmin query).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> },
) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || "");
  const token = await getToken({ template: "convex" });
  if (token) convex.setAuth(token);

  const isAdmin = await convex.query(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    api.admin.adminUsers.isAdmin as any,
    { clerkUserId: userId },
  );
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 });
  }

  const { memberId } = await params;

  let cardData: any;
  let memberDetail: any;
  try {
    [cardData, memberDetail] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      convex.action((api as any).admin.memberCards.getMemberCardData, {
        memberId: memberId as Id<"memberProfiles">,
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      convex.query((api as any).admin.members.getMemberDetail, {
        memberId: memberId as Id<"memberProfiles">,
      }),
    ]);
  } catch (err) {
    console.error("[id-card] Failed to load member data:", err);
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const member = memberDetail.member;

  let logoDataUri: string | undefined;
  const logoPath = path.join(process.cwd(), "public", "ideal-oral-health-logo.png");
  if (fs.existsSync(logoPath)) {
    logoDataUri = `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`;
  }

  const primary: FulfillmentPacketData = {
    memberName: cardData.memberName,
    memberFirstName: member.firstName ?? "Member",
    memberEmail: cardData.email ?? "",
    memberId: cardData.memberId,
    subscriberId: cardData.subscriberId,
    groupCode: cardData.groupCode,
    planName: cardData.planName,
    effectiveDate: cardData.effectiveDate,
    memberServicesPhone: cardData.supportPhone,
    memberWebsite: cardData.memberWebsite,
    networks: cardData.networks,
    logoDataUri,
  };

  // Dependents share the family's Careington/DialCare unique ID, but each gets
  // its own Toothlens account link (toothlensMemberId = uniqueId + seqNum).
  const familyUniqueId = resolveMemberFacingId(member.memberId, member.careingtonUniqueId);
  const dependents: FulfillmentPacketData[] = (member.dependents ?? []).map((dep: any) => {
    const toothlensId = dep.toothlensMemberId ?? `${familyUniqueId}${dep.seqNum ?? ""}`;
    return {
      ...primary,
      memberName: `${dep.firstName} ${dep.lastName}`,
      memberFirstName: dep.firstName,
      memberEmail: "",
      networks: {
        ...cardData.networks,
        toothlens: {
          ...cardData.networks.toothlens,
          memberUrl: `https://selfcheck.toothlens.com/ai/idealhealth?uid=${toothlensId}`,
        },
      },
    };
  });

  const people = [primary, ...dependents];
  const safeName = cardData.memberName.replace(/[^a-z0-9]+/gi, "_");
  const filename =
    dependents.length > 0
      ? `Ideal_Oral_Health_ID_Cards_${safeName}_Family.pdf`
      : `Ideal_Oral_Health_ID_Card_${safeName}.pdf`;

  try {
    const doc =
      people.length > 1
        ? createElement(MemberCardsPdf, { people })
        : createElement(MemberCardPdf, { data: primary });
    const instance = pdf(doc as unknown as ReactElement<DocumentProps>);
    const stream = await instance.toBuffer();
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const nodeStream = stream as unknown as Readable;
      nodeStream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      nodeStream.on("end", () => resolve(Buffer.concat(chunks)));
      nodeStream.on("error", reject);
    });

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[id-card] PDF generation failed:", err);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}
