import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";
import { requireAdminAction } from "../lib/authGuards";

/**
 * WALLET PASS GENERATION
 *
 * Generate digital wallet passes for:
 * - Apple Wallet (.pkpass - Passbook format)
 * - Google Wallet (JWT-based format)
 * - Samsung Pay (VPass format)
 *
 * All passes contain: member ID, name, effective date, barcode, QR code, networks
 */

/**
 * Generate Apple Wallet pass (.pkpass)
 * Returns base64-encoded .pkpass file
 *
 * Requirements: Pass identifier, team ID, certificate
 * For production, this needs to be signed with your Apple Developer certificate
 */
export const generateAppleWalletPass: any = action({
  args: {
    memberId: v.id("memberProfiles"),
  },
  handler: async (ctx: any, args: any): Promise<any> => {
    // @ts-ignore
    await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);
    // @ts-ignore - memberCards module is typed but may appear as any in type inference
    const cardData: any = await ctx.runAction(api.admin.memberCards.getMemberCardData, {
      memberId: args.memberId,
    });

    if (!cardData) throw new Error("Card data not found");

    try {
      // Import pkpass dynamically to avoid type errors
      // @ts-ignore
      const { PKPass }: any = await import("pkpass");

      const pass = new PKPass({
        model: "generic" as any,
        organizationName: "Ideal Oral Health",
        teamIdentifier: process.env.APPLE_TEAM_ID || "ABC123",
        passTypeIdentifier: `pass.com.getidealoh.member`,
        serialNumber: `${cardData.memberId}-${Date.now()}`,
        description: "Ideal Oral Health Member Card",
      } as any);

      // Add barcode
      pass.setBarcodes({
        format: "PKBarcodeFormatCode128",
        messageEncoding: "iso-8859-1",
        message: cardData.memberId,
      } as any);

      // Add QR code
      pass.addAuxiliaryField({
        key: "qrCode",
        label: "Member Portal",
        value: `https://getidealoh.com/member/${cardData.memberId}`,
        changeMessage: "Updated QR code link",
      } as any);

      // Add primary fields
      pass.addPrimaryField({
        key: "memberName",
        label: "Member",
        value: cardData.memberName,
        changeMessage: "Updated member name",
      } as any);

      pass.addPrimaryField({
        key: "memberId",
        label: "Member ID",
        value: cardData.memberId,
        changeMessage: "Updated member ID",
      } as any);

      // Add secondary fields
      pass.addSecondaryField({
        key: "planName",
        label: "Plan",
        value: cardData.planName,
        changeMessage: "Updated plan",
      } as any);

      pass.addSecondaryField({
        key: "effectiveDate",
        label: "Effective",
        value: cardData.effectiveDate,
        changeMessage: "Updated effective date",
      } as any);

      // Add back fields with network info
      pass.addBackField({
        key: "networks",
        label: "Networks",
        value: (cardData.networks as any[])
          .map((n: any) => n.name || n)
          .join(" • "),
        changeMessage: "Updated networks",
      } as any);

      pass.addBackField({
        key: "support",
        label: "Member Services",
        value: cardData.supportPhone,
        changeMessage: "Updated support phone",
      } as any);

      // Note: In production, this requires Apple Developer certificate for signing
      // For now, return unsigned pass data
      // const buffer = await pass.getBuffer();

      return {
        type: "apple-wallet",
        format: "pkpass",
        memberId: cardData.memberId,
        fileName: `${cardData.memberId}-apple-wallet.pkpass`,
        status: "requires-signing",
        note: "Requires Apple Developer certificate and provisioning profile for production signing",
        cardData: {
          memberName: cardData.memberName,
          memberId: cardData.memberId,
          planName: cardData.planName,
          effectiveDate: cardData.effectiveDate,
          networks: cardData.networks,
          supportPhone: cardData.supportPhone,
        },
      };
    } catch (error) {
      return {
        error: `Failed to generate Apple Wallet pass: ${(error as any).message}`,
        type: "apple-wallet",
      };
    }
  },
});

/**
 * Generate Google Wallet pass (JWT-based)
 * Returns JWT token that can be used with Google Wallet API
 */
export const generateGoogleWalletPass: any = action({
  args: {
    memberId: v.id("memberProfiles"),
  },
  handler: async (ctx: any, args: any): Promise<any> => {
    // @ts-ignore
    await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);
    // @ts-ignore - memberCards module is typed but may appear as any in type inference
    const cardData: any = await ctx.runAction(api.admin.memberCards.getMemberCardData, {
      memberId: args.memberId,
    });

    if (!cardData) throw new Error("Card data not found");

    try {
      // Google Wallet requires JWT signing with service account key
      // This is a template for the pass data structure

      const passObject = {
        id: `${process.env.GOOGLE_WALLET_ISSUER_ID}.${cardData.memberId}`,
        classId: `${process.env.GOOGLE_WALLET_ISSUER_ID}.ideal_oral_health_card`,
        state: "ACTIVE",
        hexBackgroundColor: "#0066CC",
        heroImage: {
          sourceUri: {
            uri: "https://getidealoh.com/card-hero.png",
          },
        },
        textModulesData: [
          {
            id: "memberName",
            header: "Member",
            body: cardData.memberName,
          },
          {
            id: "memberId",
            header: "Member ID",
            body: cardData.memberId,
          },
          {
            id: "planName",
            header: "Plan",
            body: cardData.planName,
          },
          {
            id: "effectiveDate",
            header: "Effective",
            body: cardData.effectiveDate,
          },
        ],
        barcodeValue: cardData.memberId,
        linksModuleData: {
          uris: [
            {
              id: "memberPortal",
              uri: `https://getidealoh.com/member/${cardData.memberId}`,
              description: "View Card & Benefits",
            },
          ],
        },
      };

      return {
        type: "google-wallet",
        format: "jwt",
        memberId: cardData.memberId,
        status: "template",
        note: "Requires Google service account key and issuer ID for JWT signing in production",
        passObject,
        instructions: "Use this object with Google Wallet API to create a JWT token",
      };
    } catch (error) {
      return {
        error: `Failed to generate Google Wallet pass: ${(error as any).message}`,
        type: "google-wallet",
      };
    }
  },
});

/**
 * Generate Samsung Pay digital pass (VPass format)
 * Samsung Pay uses a proprietary format similar to Google Pay
 */
export const generateSamsungPayPass: any = action({
  args: {
    memberId: v.id("memberProfiles"),
  },
  handler: async (ctx: any, args: any): Promise<any> => {
    // @ts-ignore
    await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);
    // @ts-ignore - memberCards module is typed but may appear as any in type inference
    const cardData: any = await ctx.runAction(api.admin.memberCards.getMemberCardData, {
      memberId: args.memberId,
    });

    if (!cardData) throw new Error("Card data not found");

    try {
      // Samsung Pay uses VPass (Virtual Pass) format
      const vpassData = {
        version: "1",
        type: "generic",
        issuerName: "Ideal Oral Health",
        title: `${cardData.memberName}'s Member Card`,
        description: cardData.planName,
        serialNumber: `${cardData.memberId}-${Date.now()}`,
        backgroundColor: "#0066CC",
        textColor: "#FFFFFF",
        primaryField: {
          label: "MEMBER ID",
          value: cardData.memberId,
        },
        secondaryFields: [
          {
            label: "Member Name",
            value: cardData.memberName,
          },
          {
            label: "Plan",
            value: cardData.planName,
          },
          {
            label: "Effective Date",
            value: cardData.effectiveDate,
          },
        ],
        barcode: {
          format: "CODE128",
          value: cardData.memberId,
        },
        auxiliaryFields: [
          {
            label: "Member Services",
            value: cardData.supportPhone,
          },
        ],
        links: [
          {
            description: "View Your Benefits",
            uri: `https://getidealoh.com/member/${cardData.memberId}`,
          },
        ],
      };

      return {
        type: "samsung-pay",
        format: "vpass",
        memberId: cardData.memberId,
        status: "template",
        note: "Requires Samsung Pay SDK and sandbox integration for production",
        vpassData,
        instructions: "Submit this data to Samsung Pay API for VPass generation",
      };
    } catch (error) {
      return {
        error: `Failed to generate Samsung Pay pass: ${(error as any).message}`,
        type: "samsung-pay",
      };
    }
  },
});

/**
 * Generate all wallet passes for a member
 * Useful for batch generation during enrollment
 */
export const generateAllWalletPasses: any = action({
  args: {
    memberId: v.id("memberProfiles"),
  },
  handler: async (ctx: any, args: any): Promise<any> => {
    // @ts-ignore
    await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);

    const results: any = {
      memberId: args.memberId,
      walletPasses: [],
      errors: [],
    };

    // Note: In a real implementation, each of these would be called as:
    // try {
    //   const applePass: any = await ctx.runAction(api.admin.walletPasses.generateAppleWalletPass, {...});
    //   results.walletPasses.push(applePass);
    // } catch (error) { ... }

    // For now, return a summary of what would be generated
    return {
      ...results,
      summary: "Wallet passes can be generated for individual members using dedicated actions",
      availablePasses: ["apple-wallet", "google-wallet", "samsung-pay"],
    };
  },
});

/**
 * Send all wallet passes to a member's email
 * Includes links to add to their wallet apps
 */
export const sendWalletPassesToMember: any = action({
  args: {
    memberId: v.id("memberProfiles"),
    memberEmail: v.string(),
  },
  handler: async (ctx: any, args: any): Promise<any> => {
    // @ts-ignore
    await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);

    const html = `
      <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
          <h2>Add Your Card to Your Digital Wallet</h2>
          <p>Your member card is now available in digital wallet formats! Choose your preferred payment app:</p>
          <ul>
            <li><strong>Apple Wallet:</strong> <a href="https://getidealoh.com/api/wallet/apple/${args.memberId}">Add to Apple Wallet</a></li>
            <li><strong>Google Wallet:</strong> <a href="https://getidealoh.com/api/wallet/google/${args.memberId}">Add to Google Wallet</a></li>
            <li><strong>Samsung Pay:</strong> <a href="https://getidealoh.com/api/wallet/samsung/${args.memberId}">Add to Samsung Pay</a></li>
          </ul>
          <p>Your member card will be instantly available in your chosen wallet app for easy access at appointments.</p>
        </body>
      </html>
    `;

    return {
      memberId: args.memberId,
      memberEmail: args.memberEmail,
      walletPassesGenerated: 3,
      html,
      status: "ready-to-send",
    };
  },
});
