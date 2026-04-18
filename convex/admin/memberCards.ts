import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";
import { requireAdminAction } from "../lib/authGuards";

/** Returns the 1st of the month following the given timestamp (defaults to now). */
function firstOfNextMonth(ts?: number): string {
  const base = new Date(ts ?? Date.now());
  return new Date(base.getFullYear(), base.getMonth() + 1, 1).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * MEMBER ID CARD GENERATION
 *
 * Generate member ID card data for:
 * - PDF rendering (on frontend or via email)
 * - Wallet pass generation (Apple Wallet, Google Pay, Samsung Pay)
 * - Digital card display (dashboard)
 */

/**
 * Get member card data for PDF, wallet, or display rendering
 * Returns structured data that can be used by frontend (React PDF) or backend services
 */
export const getMemberCardData: any = action({
  args: {
    memberId: v.id("memberProfiles"),
  },
  handler: async (ctx, args) => {
    // @ts-ignore - Avoid deep type instantiation issue with api.admin.adminUsers.isAdmin
    await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);
    const memberDetail = await ctx.runQuery(api.admin.members.getMemberDetail, { memberId: args.memberId });
    if (!memberDetail) throw new Error("Member not found");
    const member = memberDetail.member;

    return {
      memberName: `${member.firstName} ${member.lastName}`,
      memberId: member.memberId || "MBR-2026-00001",
      email: member.email,
      planName: "Oral Health Plan",
      effectiveDate: firstOfNextMonth(member.createdAt),
      barcode: member.barcode,
      groupCode: "IDEALDO",
      subscriberId: member.memberId,
      networks: {
        careington: {
          name: "Dental Discount Network",
          memberUrl: "https://ryse.telemedsimplified.com",
        },
        dialCare: {
          name: "Teledentistry Program",
          memberUrl: "https://www.dialcare.com/members",
        },
        toothlens: {
          name: "AI Oral Scanning",
          memberUrl: `https://smartcheck.toothlens.com/verify?memberId=${member.memberId}`,
        },
      },
      supportPhone: "(800) IDEAL-CARE",
      supportEmail: "support@idealoralcare.com",
      memberWebsite: "www.getidealoh.com",
    };
  },
});
