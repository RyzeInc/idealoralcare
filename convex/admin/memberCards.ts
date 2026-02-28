import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";

/**
 * MEMBER ID CARD GENERATION
 *
 * Generate PDF member ID cards with:
 * - Member name, 9-digit ID, plan name, effective date
 * - Network provider info (Dental Discount Network, Dial Care)
 * - Smart check link (Toothlens)
 * - QR code / barcode
 */

/**
 * Generate member ID card PDF (placeholder)
 * In production: use @react-pdf/renderer to create actual PDF
 */
export const generateMemberIdCardPdf: any = action({
  args: {
    memberId: v.id("memberProfiles"),
  },
  handler: async (ctx, args) => {
    const memberDetail = await ctx.runQuery(api.admin.members.getMemberDetail, { memberId: args.memberId });
    if (!memberDetail) throw new Error("Member not found");
    const member = memberDetail.member;

    // Card data
    const cardData = {
      memberName: `${member.firstName} ${member.lastName}`,
      memberId: member.memberId || "MBR-2026-00001",
      planName: "Oral Health Plan",
      effectiveDate: member.createdAt ? new Date(member.createdAt).toLocaleDateString() : new Date().toLocaleDateString(),
      networks: [
        "Dental Discount Network Dental Network",
        "Dial Care Teledentistry",
        "Toothlens Smart Checks",
      ],
      toothlensLink: `https://toothlens.com/verify?memberId=${member.memberId}`,
    };

    // In production: use @react-pdf/renderer to generate actual PDF
    // For now, return card data as JSON for frontend rendering

    const pdfContent = {
      filename: `${cardData.memberId}_IdCard.pdf`,
      cardData,
      htmlContent: `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
              .card { 
                width: 3.4in; 
                height: 2.15in; 
                border: 1px solid #333; 
                padding: 12px; 
                background: linear-gradient(135deg, #0D47A1 0%, #1565C0 100%);
                color: white;
                font-size: 10px;
              }
              .card-header { font-weight: bold; font-size: 14px; margin-bottom: 8px; }
              .card-field { margin: 4px 0; }
              .card-label { font-size: 8px; opacity: 0.9; }
              .card-value { font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="card-header">Ideal Health Oral Care</div>
              <div class="card-field">
                <div class="card-label">MEMBER NAME</div>
                <div class="card-value">${cardData.memberName}</div>
              </div>
              <div class="card-field">
                <div class="card-label">MEMBER ID</div>
                <div class="card-value">${cardData.memberId}</div>
              </div>
              <div class="card-field">
                <div class="card-label">PLAN</div>
                <div class="card-value">${cardData.planName}</div>
              </div>
              <div class="card-field">
                <div class="card-label">EFFECTIVE DATE</div>
                <div class="card-value">${cardData.effectiveDate}</div>
              </div>
              <div style="margin-top: 6px; font-size: 8px; border-top: 1px solid rgba(255,255,255,0.5); padding-top: 4px;">
                Dental Discount Network • Dial Care • Toothlens Smart Check
              </div>
            </div>
          </body>
        </html>
      `,
    };

    return pdfContent;
  },
});

/**
 * Get member card data for display/rendering
 */
export const getMemberCardData: any = action({
  args: {
    memberId: v.id("memberProfiles"),
  },
  handler: async (ctx, args) => {
    const memberDetail = await ctx.runQuery(api.admin.members.getMemberDetail, { memberId: args.memberId });
    if (!memberDetail) throw new Error("Member not found");
    const member = memberDetail.member;

    return {
      memberName: `${member.firstName} ${member.lastName}`,
      memberId: member.memberId || "MBR-2026-00001",
      email: member.email,
      planName: "Oral Health Plan",
      effectiveDate: member.createdAt ? new Date(member.createdAt).toLocaleDateString() : new Date().toLocaleDateString(),
      barcode: member.barcode,
      networks: {
        careington: {
          name: "Dental Discount Network Dental Network",
          memberUrl: "https://www.careington.com/members",
        },
        dialCare: {
          name: "Dial Care Teledentistry",
          memberUrl: "https://www.dialcare.com/members",
        },
        toothlens: {
          name: "Toothlens Smart Checks",
          memberUrl: `https://smartcheck.toothlens.com/verify?memberId=${member.memberId}`,
        },
      },
      supportPhone: "1-800-IDEAL-CARE",
      supportEmail: "support@idealoralcare.com",
    };
  },
});

/**
 * Generate card with QR code encoding member ID
 */
export const generateMemberCardWithQr: any = action({
  args: {
    memberId: v.id("memberProfiles"),
  },
  handler: async (ctx, args) => {
    const memberDetail = await ctx.runQuery(api.admin.members.getMemberDetail, { memberId: args.memberId });
    if (!memberDetail) throw new Error("Member not found");
    const member = memberDetail.member;

    const cardData = {
      memberName: `${member.firstName} ${member.lastName}`,
      memberId: member.memberId || "MBR-2026-00001",
      email: member.email,
      planName: "Oral Health Plan",
      effectiveDate: member.createdAt ? new Date(member.createdAt).toLocaleDateString() : new Date().toLocaleDateString(),
      barcode: member.barcode,
    };

    // In production: use 'qrcode' library to generate QR code data URL
    // const QRCode = require('qrcode');
    // const qrDataUrl = await QRCode.toDataURL(cardData.memberId);

    return {
      ...cardData,
      qrCode: null, // Would contain data URL in production
      qrCodeData: cardData.memberId, // Data encoded in QR
    };
  },
});
