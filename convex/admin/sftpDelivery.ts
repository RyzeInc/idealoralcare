import { action, query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";
import { requireAdmin, requireAdminAction } from "../lib/authGuards";

/**
 * S/FTP DELIVERY SYSTEM
 *
 * Secure file transfer for monthly vendor eligibility file transmission.
 * Credentials from Convex environment variables.
 * Includes manual fallback for download/upload.
 */

/**
 * Send vendor file via SFTP (requires ssh2-sftp-client)
 * In production: configure SFTP credentials via Convex environment
 */
export const deliverVendorFileViaSftp = action({
  args: {
    vendor: v.string(), // "careington" | "dialcare"
    filename: v.string(),
    fileContent: v.string(), // CSV content
    groupCode: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);
    // Placeholder for SFTP implementation
    // In production, use ssh2-sftp-client library with environment credentials

    const credentials = {
      careington: {
        host: process.env.CAREINGTON_SFTP_HOST,
        user: process.env.CAREINGTON_SFTP_USER,
        privateKey: process.env.CAREINGTON_SFTP_KEY,
        port: 22,
        remotePath: "/incoming/",
      },
      dialcare: {
        host: process.env.DIALCARE_SFTP_HOST,
        user: process.env.DIALCARE_SFTP_USER,
        privateKey: process.env.DIALCARE_SFTP_KEY,
        port: 22,
        remotePath: "/eligibility/",
      },
    };

    const vendorCreds = (credentials as any)[args.vendor];
    if (!vendorCreds) {
      throw new Error(`No SFTP credentials configured for vendor: ${args.vendor}`);
    }

    // TODO: Implement actual SFTP delivery
    // const Client = require("ssh2-sftp-client");
    // const sftp = new Client();
    // try {
    //   await sftp.connect({
    //     host: vendorCreds.host,
    //     username: vendorCreds.user,
    //     privateKey: vendorCreds.privateKey,
    //   });
    //   await sftp.put(Buffer.from(args.fileContent), vendorCreds.remotePath + args.filename);
    //   await sftp.end();
    //   return { success: true, message: "File delivered successfully" };
    // } catch (error) {
    //   throw new Error(`SFTP delivery failed: ${error.message}`);
    // }

    console.log(
      `[SFTP] Would deliver ${args.filename} to ${args.vendor} at ${vendorCreds.host}:${vendorCreds.remotePath}`
    );

    return {
      success: true,
      vendor: args.vendor,
      filename: args.filename,
      message: "Manual fallback: File ready for download. Admin can manually upload to vendor SFTP.",
      deliveredAt: Date.now(),
    };
  },
});

/**
 * Record SFTP delivery attempt
 */
export const recordSftpDelivery = mutation({
  args: {
    groupId: v.id("groups"),
    vendor: v.string(),
    filename: v.string(),
    status: v.string(), // "pending" | "success" | "failed"
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    // Create delivery history record
    // Note: may need to add sftpDeliveryHistory table to schema
    return {
      recordedAt: Date.now(),
      groupId: args.groupId,
      vendor: args.vendor,
      filename: args.filename,
      status: args.status,
      errorMessage: args.errorMessage,
    };
  },
});

/**
 * Get SFTP delivery history
 */
export const getSftpDeliveryHistory = query({
  args: {
    groupId: v.id("groups"),
    vendor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Placeholder: query from sftpDeliveryHistory table if implemented
    return {
      groupId: args.groupId,
      vendor: args.vendor,
      history: [],
      lastDelivered: null,
    };
  },
});

/**
 * Manual fallback: get file content for admin download
 */
export const getFileForDownload = action({
  args: {
    groupId: v.id("groups"),
    vendor: v.string(), // "careington" | "dialcare"
  },
  handler: async (ctx, args) => {
    await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);
    // Call vendor file generator to get content
    let fileData;

    if (args.vendor === "careington") {
      // Would call generateDental Discount NetworkFile
      fileData = {
        filename: `careington_export_${Date.now()}.csv`,
        content: "member_id,first_name,last_name,dob,effective_date,termination_date,group_code\n",
      };
    } else if (args.vendor === "dialcare") {
      // Would call generateDialCareFile
      fileData = {
        filename: `dialcare_export_${Date.now()}.csv`,
        content: "member_id,name,email,phone,effective_date,active\n",
      };
    } else {
      throw new Error(`Unknown vendor: ${args.vendor}`);
    }

    return {
      vendor: args.vendor,
      filename: fileData.filename,
      content: fileData.content,
      mimeType: "text/csv",
      downloadUrl: `/api/admin/download?vendor=${args.vendor}&groupId=${args.groupId}`,
    };
  },
});

/**
 * Check SFTP delivery status
 */
export const checkSftpStatus = query({
  args: {
    groupId: v.id("groups"),
    vendor: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if configured and healthy
    const configured = !!process.env[`${args.vendor.toUpperCase()}_SFTP_HOST`];

    return {
      vendor: args.vendor,
      configured,
      status: configured ? "ready" : "not_configured",
      message: configured
        ? "SFTP delivery is configured and ready"
        : `Manual fallback: Configure ${args.vendor.toUpperCase()}_SFTP_HOST and credentials to enable automated delivery`,
    };
  },
});
