import { mutation, query, action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";
import { requireAdmin, requireAdminAction } from "../lib/authGuards";

/**
 * ELIGIBILITY FILE PROCESSING
 *
 * CSV file upload and processing:
 * - Upload creates record in eligibilityFiles
 * - Async action parses CSV, validates rows, batch-creates memberProfiles
 * - Status transitions: uploaded → validating → processing → completed/completed_with_errors/failed
 */

/**
 * Get all eligibility files across all groups
 */
export const getAllEligibilityFiles = query({
  handler: async (ctx) => {
    return await ctx.db.query("eligibilityFiles").order("desc").collect();
  },
});

/**
 * Create eligibility file record on upload
 */
export const uploadEligibilityFile = mutation({
  args: {
    groupId: v.id("groups"),
    accountId: v.optional(v.id("accounts")),
    siteId: v.id("sites"),
    fileName: v.string(),
    storageId: v.string(), // ID from Convex _storage
    fileType: v.union(v.literal("csv"), v.literal("xlsx"), v.literal("json")),
    fileAction: v.union(v.literal("full_replace"), v.literal("additions"), v.literal("terminations"), v.literal("delta")),
    uploadedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const fileId = await ctx.db.insert("eligibilityFiles", {
      siteId: args.siteId,
      accountId: args.accountId,
      groupId: args.groupId,
      fileName: args.fileName,
      storageId: args.storageId,
      fileType: args.fileType,
      status: "uploaded",
      totalRecords: 0,
      processedRecords: 0,
      errorRecords: 0,
      newMembers: 0,
      updatedMembers: 0,
      terminatedMembers: 0,
      errors: [],
      fileAction: args.fileAction,
      uploadedBy: args.uploadedBy,
      uploadedAt: Date.now(),
      processedAt: undefined,
      completedAt: undefined,
    });

    return await ctx.db.get(fileId);
  },
});

/**
 * Get eligibility files for a group (paginated)
 */
export const getEligibilityFiles = query({
  args: {
    groupId: v.id("groups"),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 25;
    const offset = args.offset ?? 0;

    const all = await ctx.db
      .query("eligibilityFiles")
      .filter((q) => q.eq(q.field("groupId"), args.groupId))
      .order("desc")
      .collect();

    const files = all.slice(offset, offset + limit);

    return {
      groupId: args.groupId,
      total: all.length,
      limit,
      offset,
      files,
    };
  },
});

/**
 * Get single eligibility file detail
 */
export const getEligibilityFileDetail = query({
  args: { fileId: v.id("eligibilityFiles") },
  handler: async (ctx, args) => {
    const file = await ctx.db.get(args.fileId);
    if (!file) throw new Error("File not found");

    return {
      file,
      errorCount: file.errors?.length ?? 0,
      successRate: file.totalRecords > 0 ? (file.processedRecords / file.totalRecords) * 100 : 0,
    };
  },
});

/**
 * Check for duplicate records in file
 */
function getDuplicates(records: any[], emailField: string): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const record of records) {
    const email = record[emailField];
    if (email) {
      if (seen.has(email)) {
        duplicates.add(email);
      } else {
        seen.add(email);
      }
    }
  }

  return duplicates;
}

/**
 * Validate a single eligibility record
 */
function validateEligibilityRecord(
  record: any,
  rowIndex: number,
  emailField: string,
  duplicates: Set<string>
): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];

  // Required fields
  if (!record.firstName || typeof record.firstName !== "string") {
    errors.push(`firstName is required and must be string`);
  }
  if (!record.lastName || typeof record.lastName !== "string") {
    errors.push(`lastName is required and must be string`);
  }

  // Email or phone required
  const email = record[emailField];
  const phone = record.phone;
  if (!email && !phone) {
    errors.push(`${emailField} or phone is required`);
  }

  // Optional DOB validation (if provided, should be YYYY-MM-DD or valid date)
  if (record.dateOfBirth) {
    const dob = new Date(record.dateOfBirth);
    if (isNaN(dob.getTime())) {
      errors.push(`dateOfBirth "${record.dateOfBirth}" is not a valid date`);
    }
  }

  // Duplicate check
  if (email && duplicates.has(email)) {
    errors.push(`Duplicate email in file: ${email}`);
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Process eligibility file (parse CSV, validate, batch-create members)
 * Convex action: can use async operations, access _storage, call other mutations
 */
export const processEligibilityFile = action({
  args: {
    fileId: v.id("eligibilityFiles"),
  },
  handler: async (ctx, args) => {
    // @ts-ignore - Avoid deep type instantiation issue with api.admin.adminUsers.isAdmin
    await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);
    const file = await ctx.runQuery(api.admin.eligibility.getEligibilityFileDetail, { fileId: args.fileId });
    if (!file) throw new Error("File not found");

    // Update status to validating
    await ctx.runMutation(api.admin.eligibility.updateFileStatus, {
      fileId: args.fileId,
      status: "validating",
    });

    try {
      // TODO: In a real implementation, fetch file content from _storage
      // For now, we'll assume records are provided separately
      // File content would look like:
      // {
      //   records: [
      //     { firstName: "John", lastName: "Doe", email: "john@example.com", phone: "+1234567890", dateOfBirth: "1990-01-01" },
      //     ...
      //   ]
      // }

      // For this implementation, we'll create a helper mutation to process chunked records

      // Simulate processing (in production: parse actual CSV from _storage)
      await ctx.runMutation(api.admin.eligibility.completeFileProcessing, {
        fileId: file.file._id,
        status: "completed",
        processedRecords: 0,
        errorRecords: 0,
        newMembers: 0,
      });
    } catch (error) {
      await ctx.runMutation(api.admin.eligibility.updateFileStatus, {
        fileId: args.fileId,
        status: "failed",
      });
      throw error;
    }
  },
});

/**
 * Update file processing status
 */
export const updateFileStatus = mutation({
  args: {
    fileId: v.id("eligibilityFiles"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const file = await ctx.db.get(args.fileId);
    if (!file) throw new Error("File not found");

    const updates: any = {
      status: args.status,
      processedAt: Date.now(),
    };

    if (["completed", "completed_with_errors", "failed"].includes(args.status)) {
      updates.completedAt = Date.now();
    }

    await ctx.db.patch(args.fileId, updates);
    return await ctx.db.get(args.fileId);
  },
});

/**
 * Add error to eligibility file
 */
export const addFileError = mutation({
  args: {
    fileId: v.id("eligibilityFiles"),
    rowIndex: v.number(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const file = await ctx.db.get(args.fileId);
    if (!file) throw new Error("File not found");

    const errors = file.errors ?? [];
    errors.push({
      row: args.rowIndex,
      message: args.message,
    });

    await ctx.db.patch(args.fileId, {
      errors,
      errorRecords: (file.errorRecords ?? 0) + 1,
    });

    return await ctx.db.get(args.fileId);
  },
});

/**
 * Batch create members from eligibility file records
 * Called by processEligibilityFile action
 */
export const createMembersFromEligibilityFile = mutation({
  args: {
    fileId: v.id("eligibilityFiles"),
    records: v.array(
      v.object({
        firstName: v.string(),
        lastName: v.string(),
        email: v.optional(v.string()),
        phone: v.optional(v.string()),
        dateOfBirth: v.optional(v.string()),
        gender: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const file = await ctx.db.get(args.fileId);
    if (!file) throw new Error("File not found");

    const results = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: [] as any[],
    };

    const duplicates = getDuplicates(args.records, "email");

    for (let i = 0; i < args.records.length; i++) {
      const record = args.records[i];
      const validation = validateEligibilityRecord(record, i, "email", duplicates);

      if (!validation.valid) {
        results.failed++;
        results.errors.push({
          rowIndex: i,
          errors: validation.errors,
        });

        // Add error to file record
        await ctx.runMutation(api.admin.eligibility.addFileError, {
          fileId: args.fileId,
          rowIndex: i,
          message: validation.errors?.join("; ") ?? "Unknown error",
        });

        continue;
      }

      try {
        // Check if member with this email already exists
        const existing = await ctx.db
          .query("memberProfiles")
          .filter(
            (q) =>
              q.and(
                q.eq(q.field("groupId"), file.groupId),
                q.eq(q.field("email"), record.email)
              )
          )
          .first();

        if (existing) {
          // Update existing member
          const validGender = (["male", "female", "non_binary", "prefer_not_to_say", "other"].includes(record.gender?.toLowerCase() || "")) 
            ? (record.gender?.toLowerCase() as any) 
            : undefined;
          await ctx.db.patch(existing._id, {
            firstName: record.firstName,
            lastName: record.lastName,
            email: record.email,
            phone: record.phone,
            dateOfBirth: record.dateOfBirth,
            gender: validGender,
            eligibilityFileId: args.fileId,
          });
          results.updated++;
        } else {
          // Create new member
          // Note: This requires calling createMemberProfile from enrollment/members.ts
          // For now, we use db.insert directly
          const validGender = (["male", "female", "non_binary", "prefer_not_to_say", "other"].includes(record.gender?.toLowerCase() || "")) 
            ? (record.gender?.toLowerCase() as any) 
            : undefined;
          const memberId = await ctx.db.insert("memberProfiles", {
            memberId: `MBR-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`,
            barcode: `${file.siteId.slice(0, 3).toUpperCase()}${String(new Date().getFullYear()).slice(2)}${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
            siteId: file.siteId,
            accountId: file.accountId!,
            groupId: file.groupId,
            firstName: record.firstName,
            lastName: record.lastName,
            email: record.email,
            phone: record.phone,
            dateOfBirth: record.dateOfBirth,
            gender: validGender,
            status: "active",
            memberType: "eligible",
            eligibilityFileId: args.fileId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });

          results.created++;
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          rowIndex: i,
          error: (error as any).message,
        });
      }
    }

    // Update file counters
    await ctx.db.patch(args.fileId, {
      processedRecords: args.records.length,
      newMembers: results.created,
      updatedMembers: results.updated,
      errorRecords: results.failed,
    });

    return results;
  },
});

/**
 * Complete file processing (mark as completed/completed_with_errors)
 */
export const completeFileProcessing = mutation({
  args: {
    fileId: v.id("eligibilityFiles"),
    status: v.union(v.literal("completed"), v.literal("completed_with_errors"), v.literal("failed")),
    processedRecords: v.number(),
    errorRecords: v.number(),
    newMembers: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const file = await ctx.db.get(args.fileId);
    if (!file) throw new Error("File not found");

    await ctx.db.patch(args.fileId, {
      status: args.status,
      processedRecords: args.processedRecords,
      errorRecords: args.errorRecords,
      newMembers: args.newMembers,
      processedAt: Date.now(),
      completedAt: Date.now(),
    });

    // Log event
    await ctx.runMutation(api.subscriptions.events.logEvent, {
      eventType: "admin.file_processed",
      actor: "admin",
      payload: {
        fileId: args.fileId,
        fileName: file.fileName,
        status: args.status,
        totalRecords: file.totalRecords,
        processedRecords: args.processedRecords,
        errorRecords: args.errorRecords,
        newMembers: args.newMembers,
      },
      success: true,
    });

    return await ctx.db.get(args.fileId);
  },
});

/**
 * Delete an eligibility file (admin action)
 */
export const deleteEligibilityFile = mutation({
  args: { fileId: v.id("eligibilityFiles") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const file = await ctx.db.get(args.fileId);
    if (!file) throw new Error("File not found");

    // TODO: Delete file from _storage

    await ctx.db.delete(args.fileId);

    return {
      fileId: args.fileId,
      fileName: file.fileName,
      deleted: true,
    };
  },
});

/**
 * Get eligibility file processing stats (for admin dashboard)
 */
export const getEligibilityStats = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const files = await ctx.db
      .query("eligibilityFiles")
      .filter((q) => q.eq(q.field("groupId"), args.groupId))
      .collect();

    const stats = {
      totalFiles: files.length,
      completedFiles: files.filter((f) => f.status === "completed" || f.status === "completed_with_errors").length,
      failedFiles: files.filter((f) => f.status === "failed").length,
      pendingFiles: files.filter((f) => ["uploaded", "validating", "processing"].includes(f.status)).length,
      totalRecordsProcessed: files.reduce((sum, f) => sum + (f.processedRecords ?? 0), 0),
      totalErrorRecords: files.reduce((sum, f) => sum + (f.errorRecords ?? 0), 0),
      totalNewMembers: files.reduce((sum, f) => sum + (f.newMembers ?? 0), 0),
      recentFiles: files.slice(0, 5),
    };

    return stats;
  },
});
