/**
 * VENDOR FILE DELIVERY ORCHESTRATOR
 *
 * Bridges the inbound eligibility upload pipeline to outbound vendor delivery
 * (Careington / DialCare). The actual SFTP work is delegated to the Node action
 * in `sftpNode.ts` because `ssh2-sftp-client` requires the Node runtime.
 *
 * Configuration via Convex env vars:
 *   CAREINGTON_SFTP_HOST, CAREINGTON_SFTP_USER,
 *   CAREINGTON_SFTP_KEY  (PEM-encoded private key),  optional CAREINGTON_SFTP_PASSWORD,
 *   CAREINGTON_SFTP_PORT (default 22),
 *   CAREINGTON_SFTP_PATH (default "/incoming/")
 *
 *   DIALCARE_SFTP_HOST, DIALCARE_SFTP_USER, DIALCARE_SFTP_KEY,
 *   DIALCARE_SFTP_PORT, DIALCARE_SFTP_PATH (default "/eligibility/")
 *
 * Vendor identifier ("careington" | "dialcare") is what the orchestrator uses
 * internally; the legacy "dental_discount_network" label is kept as a
 * synonym for "careington" since DDN is a Careington product line.
 */

import { action, query, mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import { requireAdmin, requireAdminAction } from "../lib/authGuards";

type VendorKey = "careington" | "dialcare";

const VENDOR_LABELS: Record<VendorKey, string> = {
  careington: "Careington (Dental Discount Network)",
  dialcare: "DialCare (E-fulfillment)",
};

function envFor(vendor: VendorKey) {
  const prefix = vendor === "careington" ? "CAREINGTON" : "DIALCARE";
  return {
    host: process.env[`${prefix}_SFTP_HOST`],
    user: process.env[`${prefix}_SFTP_USER`],
    privateKey: process.env[`${prefix}_SFTP_KEY`],
    password: process.env[`${prefix}_SFTP_PASSWORD`],
    port: process.env[`${prefix}_SFTP_PORT`] ? Number(process.env[`${prefix}_SFTP_PORT`]) : 22,
    remotePath:
      process.env[`${prefix}_SFTP_PATH`] ||
      (vendor === "careington" ? "/incoming/" : "/eligibility/"),
  };
}

// ─── SHA-256 in pure JS (works in V8 actions via Web Crypto) ─────────
async function sha256Hex(content: string): Promise<string> {
  const enc = new TextEncoder();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g: any = globalThis as any;
  const buf = await g.crypto.subtle.digest("SHA-256", enc.encode(content));
  const bytes = new Uint8Array(buf);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

// ─────────────────────────────────────────────────────────────────────
// QUERIES
// ─────────────────────────────────────────────────────────────────────

/**
 * Snapshot of vendor configuration + last delivery for the dashboard.
 */
export const getVendorStatus = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const vendors: VendorKey[] = ["careington", "dialcare"];
    const result = [] as any[];
    for (const v of vendors) {
      // We can't read process.env in a query context directly without a workaround,
      // but Convex queries DO have access to process.env at runtime.
      const env = envFor(v);
      const last = await ctx.db
        .query("vendorDeliveries")
        .withIndex("by_vendor", (q) => q.eq("vendor", v))
        .order("desc")
        .first();
      result.push({
        vendor: v,
        label: VENDOR_LABELS[v],
        sftpConfigured: !!env.host && !!env.user && (!!env.privateKey || !!env.password),
        sftpHost: env.host ?? null,
        remotePath: env.remotePath,
        lastDelivery: last
          ? {
              _id: last._id,
              filename: last.filename,
              status: last.status,
              createdAt: last.createdAt,
              deliveredAt: last.deliveredAt,
              memberCount: last.memberCount,
              method: last.method,
            }
          : null,
      });
    }
    return result;
  },
});

/**
 * Delivery history for the admin UI.
 */
export const getDeliveryHistory = query({
  args: {
    groupId: v.optional(v.id("groups")),
    vendor: v.optional(v.union(v.literal("careington"), v.literal("dialcare"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = args.limit ?? 25;
    let rows;
    if (args.groupId) {
      rows = await ctx.db
        .query("vendorDeliveries")
        .withIndex("by_group", (q) => q.eq("groupId", args.groupId!))
        .order("desc")
        .take(limit);
    } else if (args.vendor) {
      rows = await ctx.db
        .query("vendorDeliveries")
        .withIndex("by_vendor", (q) => q.eq("vendor", args.vendor!))
        .order("desc")
        .take(limit);
    } else {
      rows = await ctx.db
        .query("vendorDeliveries")
        .withIndex("by_created")
        .order("desc")
        .take(limit);
    }
    return rows;
  },
});

// ─────────────────────────────────────────────────────────────────────
// MUTATIONS
// ─────────────────────────────────────────────────────────────────────

export const createDeliveryRecord = internalMutation({
  args: {
    groupId: v.id("groups"),
    vendor: v.union(v.literal("careington"), v.literal("dialcare")),
    fileType: v.union(v.literal("full"), v.literal("delta")),
    filename: v.string(),
    fileBytes: v.number(),
    fileSha256: v.string(),
    storageId: v.optional(v.string()),
    memberCount: v.number(),
    rowCount: v.number(),
    method: v.union(v.literal("sftp"), v.literal("manual_download")),
    sftpHost: v.optional(v.string()),
    sftpRemotePath: v.optional(v.string()),
    triggeredBy: v.optional(v.string()),
    sourceEligibilityFileId: v.optional(v.id("eligibilityFiles")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("vendorDeliveries", {
      groupId: args.groupId,
      vendor: args.vendor,
      vendorLabel: VENDOR_LABELS[args.vendor],
      fileType: args.fileType,
      filename: args.filename,
      fileBytes: args.fileBytes,
      fileSha256: args.fileSha256,
      storageId: args.storageId,
      memberCount: args.memberCount,
      rowCount: args.rowCount,
      method: args.method,
      status: args.method === "manual_download" ? "delivered" : "pending",
      sftpHost: args.sftpHost,
      sftpRemotePath: args.sftpRemotePath,
      triggeredBy: args.triggeredBy,
      sourceEligibilityFileId: args.sourceEligibilityFileId,
      createdAt: Date.now(),
      deliveredAt: args.method === "manual_download" ? Date.now() : undefined,
    });
  },
});

export const markDeliveryStatus = mutation({
  args: {
    deliveryId: v.id("vendorDeliveries"),
    status: v.union(
      v.literal("uploading"),
      v.literal("delivered"),
      v.literal("failed")
    ),
    errorMessage: v.optional(v.string()),
  },
  // NOTE: No requireAdmin here — this is called from the Next.js
  // /api/admin/vendor-deliver route which performs the admin check itself.
  // This follows the same pattern as `markCancelAtPeriodEnd` and other
  // mutations consumed by Next.js API routes via ConvexHttpClient.
  handler: async (ctx, args) => {
    const patch: any = { status: args.status };
    if (args.status === "delivered") patch.deliveredAt = Date.now();
    if (args.errorMessage) patch.errorMessage = args.errorMessage;
    await ctx.db.patch(args.deliveryId, patch);
  },
});

// ─────────────────────────────────────────────────────────────────────
// ORCHESTRATOR ACTION
// ─────────────────────────────────────────────────────────────────────

type DeliveryResult = {
  deliveryId: string;
  filename: string;
  bytes: number;
  sha256: string;
  memberCount: number;
  rowCount: number;
  method: "sftp" | "manual_download";
  status: "delivered" | "failed" | "pending";
  content?: string; // returned for manual_download mode so the UI can save it
  error?: string;
};

/**
 * One-shot: generate the Careington/DialCare file for a group and either
 * (a) push it via SFTP, or (b) stash + return the content for the admin
 * to download manually.
 *
 * The file content is generated by `vendorFiles.generateDentalDiscountNetworkFile`
 * (Careington) or `vendorFiles.generateDialCareFile` (DialCare). Both already
 * produce the exact pipe-delimited spec.
 */
export const generateAndSendVendorFile = action({
  args: {
    groupId: v.id("groups"),
    vendor: v.union(v.literal("careington"), v.literal("dialcare")),
    fileType: v.optional(v.union(v.literal("full"), v.literal("delta"))),
    method: v.optional(v.union(v.literal("sftp"), v.literal("manual_download"))),
    sourceEligibilityFileId: v.optional(v.id("eligibilityFiles")),
  },
  handler: async (ctx, args): Promise<DeliveryResult> => {
    // @ts-ignore - same pattern as the rest of the codebase
    const identity = await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);

    const fileType = args.fileType ?? "full";
    const method = args.method ?? "sftp";

    // 1. Generate the file
    let gen: any;
    if (args.vendor === "careington") {
      gen = await ctx.runAction(
        (api.admin.vendorFiles as any).generateDentalDiscountNetworkFile,
        { groupId: args.groupId, fileType }
      );
    } else {
      gen = await ctx.runAction(
        (api.admin.vendorFiles as any).generateDialCareFile,
        { groupId: args.groupId, fileType }
      );
    }

    if (!gen?.content) {
      throw new Error("Vendor file generation returned no content");
    }
    const content: string = gen.content;
    const filename: string = gen.filename;
    const memberCount: number = gen.memberCount ?? 0;
    const rowCount: number = gen.totalRecords ?? content.split("\n").filter((l) => l.trim()).length;
    const sha256 = await sha256Hex(content);
    const bytes = new TextEncoder().encode(content).byteLength;

    // 2. Stash file in Convex storage so we keep an audit copy
    let storageId: string | undefined;
    try {
      const blob = new Blob([content], { type: "text/plain" });
      const id = await ctx.storage.store(blob);
      storageId = id as string;
    } catch (err) {
      console.warn("[vendor-delivery] storage.store failed", err);
    }

    // 3. SFTP env (only inspected if we're actually pushing)
    const env = envFor(args.vendor);
    const sftpAvailable = !!env.host && !!env.user && (!!env.privateKey || !!env.password);

    const effectiveMethod: "sftp" | "manual_download" =
      method === "sftp" && sftpAvailable ? "sftp" : "manual_download";

    // 4. Create delivery record (status="pending" if SFTP, "delivered" if manual)
    const deliveryId: string = await ctx.runMutation(
      internal.admin.sftpDelivery.createDeliveryRecord,
      {
        groupId: args.groupId,
        vendor: args.vendor,
        fileType,
        filename,
        fileBytes: bytes,
        fileSha256: sha256,
        storageId,
        memberCount,
        rowCount,
        method: effectiveMethod,
        sftpHost: effectiveMethod === "sftp" ? env.host : undefined,
        sftpRemotePath: effectiveMethod === "sftp" ? env.remotePath + filename : undefined,
        triggeredBy: identity?.clerkUserId,
        sourceEligibilityFileId: args.sourceEligibilityFileId,
      }
    );

    // 5. If manual mode (or SFTP not configured), return content for download
    if (effectiveMethod === "manual_download") {
      return {
        deliveryId: deliveryId,
        filename,
        bytes,
        sha256,
        memberCount,
        rowCount,
        method: "manual_download",
        status: "delivered",
        content,
        error: method === "sftp" && !sftpAvailable
          ? `SFTP not configured for ${args.vendor}. Falling back to manual download.`
          : undefined,
      };
    }

    // 6. SFTP push happens out-of-band via the Next.js route /api/admin/vendor-deliver,
    //    which has the Node runtime to use ssh2-sftp-client (native bindings).
    //    Return the deliveryId + content so the caller can immediately POST to that route.
    return {
      deliveryId,
      filename,
      bytes,
      sha256,
      memberCount,
      rowCount,
      method: "sftp",
      status: "pending",
      content, // returned so the Next.js route doesn't need to re-fetch
    };
  },
});

/**
 * Re-download a previously-generated file from Convex storage so admins
 * can grab the exact bytes that were sent (for audit / re-sending).
 */
export const downloadDeliveredFile = action({
  args: { deliveryId: v.id("vendorDeliveries") },
  // NOTE: No admin gate — consumed by /api/admin/vendor-deliver which gates itself.
  handler: async (ctx, args): Promise<{ filename: string; content: string }> => {
    const delivery: any = await ctx.runQuery(api.admin.sftpDelivery.getDeliveryById, {
      deliveryId: args.deliveryId,
    });
    if (!delivery) throw new Error("Delivery not found");
    if (!delivery.storageId) throw new Error("File content not stashed for this delivery");
    const blob = await ctx.storage.get(delivery.storageId);
    if (!blob) throw new Error("Stored file not found");
    const content = await blob.text();
    return { filename: delivery.filename, content };
  },
});

export const getDeliveryById = query({
  args: { deliveryId: v.id("vendorDeliveries") },
  // NOTE: No admin gate — consumed by /api/admin/vendor-deliver which gates itself.
  handler: async (ctx, args) => {
    return await ctx.db.get(args.deliveryId);
  },
});
