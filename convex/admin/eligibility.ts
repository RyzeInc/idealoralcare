import { mutation, query, action, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import { requireAdmin, requireAdminAction } from "../lib/authGuards";

/**
 * ELIGIBILITY FILE PROCESSING — PRODUCTION PIPELINE
 *
 * Supports:
 *   - Careington pipe-delimited (.txt) files
 *   - Standard CSV files (via papaparse)
 *   - JSON files
 *
 * Pipeline:
 *   1. Admin uploads → creates eligibilityFiles record
 *   2. processEligibilityFile action fetches from _storage, parses, validates
 *   3. Rows are chunked (BATCH_SIZE) and dispatched via ctx.scheduler
 *      to internalBatchCreateMembers mutations (avoids 10s mutation timeout)
 *   4. Each batch writes member records + updates file counters atomically
 *   5. After all batches, file is marked completed/completed_with_errors
 *
 * Member ID generation uses an atomic counter in the `counters` table.
 */

const BATCH_SIZE = 100; // Max records per mutation to stay within Convex limits

// ─── Field map for Careington pipe-delimited format ──────────────────────
// Column positions per sample: CAREGRPS040120_full.txt
// Title(0)|FirstName(1)|MiddleInit(2)|LastName(3)|Suffix(4)|UniqueID(5)|SeqNum(6)|
// Filler(7)|Addr1(8)|Addr2(9)|City(10)|State(11)|Zip(12)|Plus4(13)|
// HomePhone(14)|WorkPhone(15)|Coverage(16)|GroupCode(17)|TermDate(18)|
// EffDate(19)|DOB(20)|Relation(21)|StudentStatus(22)|Filler(23)|
// Gender(24)|Email(25)|ReportingSegment(26)|Guardian(27)
const CAREINGTON_FIELD_MAP = {
  title: 0,
  firstName: 1,
  middleInitial: 2,
  lastName: 3,
  suffix: 4,
  uniqueId: 5,
  seqNum: 6,
  // 7 = filler
  addr1: 8,
  addr2: 9,
  city: 10,
  state: 11,
  zip: 12,
  // 13 = plus4
  homePhone: 14,
  workPhone: 15,
  coverage: 16,
  groupCode: 17,
  termDate: 18,
  effDate: 19,
  dob: 20,
  // 21-23 = relation/student/filler
  gender: 24,
  email: 25,
  reportingSegment: 26,
  guardian: 27,
} as const;

/**
 * Generate a short-lived upload URL for Convex file storage
 */
export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

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
    fileType: v.union(v.literal("csv"), v.literal("xlsx"), v.literal("json"), v.literal("txt")),
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
 * Find duplicate values in a record array by a specified field
 */
function getDuplicates(records: any[], field: string): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const record of records) {
    const value = record[field];
    if (value) {
      if (seen.has(value)) {
        duplicates.add(value);
      } else {
        seen.add(value);
      }
    }
  }

  return duplicates;
}

/**
 * Parse a Careington pipe-delimited row into a normalized record
 */
function parseCareingtonRow(line: string): {
  firstName: string;
  lastName: string;
  email: string | undefined;
  phone: string | undefined;
  dateOfBirth: string | undefined;
  gender: string | undefined;
  uniqueId: string;
  seqNum: string;
  address?: { line1: string; line2?: string; city: string; state: string; postalCode: string; country: string };
  relationship?: string;
  groupCode: string;
} | null {
  const fields = line.split("|");
  if (fields.length < 20) return null; // Minimum fields needed

  const f = CAREINGTON_FIELD_MAP;
  const firstName = (fields[f.firstName] ?? "").trim();
  const lastName = (fields[f.lastName] ?? "").trim();
  if (!firstName || !lastName) return null;

  // Parse DOB from MMDDYYYY → ISO YYYY-MM-DD
  const rawDob = (fields[f.dob] ?? "").trim();
  let dateOfBirth: string | undefined;
  if (rawDob.length === 8) {
    const mm = rawDob.slice(0, 2);
    const dd = rawDob.slice(2, 4);
    const yyyy = rawDob.slice(4, 8);
    dateOfBirth = `${yyyy}-${mm}-${dd}`;
  }

  const rawGender = (fields[f.gender] ?? "").trim().toUpperCase();
  const gender = rawGender === "M" ? "male" : rawGender === "F" ? "female" : undefined;

  const email = (fields[f.email] ?? "").trim() || undefined;
  const phone = (fields[f.homePhone] ?? "").trim().replace(/\D/g, "") || undefined;

  const addr1 = (fields[f.addr1] ?? "").trim();
  const addr2 = (fields[f.addr2] ?? "").trim();
  const city = (fields[f.city] ?? "").trim();
  const state = (fields[f.state] ?? "").trim();
  const zip = (fields[f.zip] ?? "").trim();
  const address = addr1 ? {
    line1: addr1,
    line2: addr2 || undefined,
    city,
    state,
    postalCode: zip,
    country: "US",
  } : undefined;

  const seqNum = (fields[f.seqNum] ?? "00").trim();
  const uniqueId = (fields[f.uniqueId] ?? "").trim();
  const groupCode = (fields[f.groupCode] ?? "").trim();

  // Determine relationship for dependents (seqNum != "00")
  let relationship: string | undefined;
  if (seqNum !== "00") {
    const coverage = (fields[f.coverage] ?? "").trim().toUpperCase();
    // MS = Member + Spouse, MD = Member + Dependent/Child
    if (coverage === "MS") relationship = "spouse";
    else if (coverage === "MD") relationship = "child";
    else relationship = "other";
  }

  return {
    firstName,
    lastName,
    email,
    phone,
    dateOfBirth,
    gender,
    uniqueId,
    seqNum,
    address,
    relationship,
    groupCode,
  };
}

/**
 * Parse CSV content (comma-separated with header row)
 * Expects headers: firstName, lastName, email, phone, dateOfBirth, gender
 */
function parseCsvContent(content: string): Array<{
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
}> {
  const lines = content.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const records: Array<any> = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    const record: any = {};
    headers.forEach((h, idx) => {
      record[h] = values[idx] ?? "";
    });

    if (record.firstname || record.firstName) {
      records.push({
        firstName: record.firstname || record.firstName || "",
        lastName: record.lastname || record.lastName || "",
        email: record.email || undefined,
        phone: record.phone || undefined,
        dateOfBirth: record.dateofbirth || record.dateOfBirth || record.dob || undefined,
        gender: record.gender || undefined,
      });
    }
  }

  return records;
}

/**
 * Process eligibility file — the main pipeline action
 *
 * 1. Fetch file from Convex _storage
 * 2. Parse (pipe-delimited txt OR csv OR json)
 * 3. Validate all rows
 * 4. Schedule batched mutations via ctx.scheduler
 */
export const processEligibilityFile = action({
  args: {
    fileId: v.id("eligibilityFiles"),
  },
  handler: async (ctx, args) => {
    // @ts-ignore - Avoid deep type instantiation issue with api.admin.adminUsers.isAdmin
    await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);
    const fileDetail = await ctx.runQuery(api.admin.eligibility.getEligibilityFileDetail, { fileId: args.fileId });
    if (!fileDetail) throw new Error("File not found");
    const file = fileDetail.file;

    // Update status → validating
    await ctx.runMutation(api.admin.eligibility.updateFileStatus, {
      fileId: args.fileId,
      status: "validating",
    });

    try {
      // ── Fetch file content from Convex storage ──
      if (!file.storageId) throw new Error("No storage ID on file record");
      const blob = await ctx.storage.get(file.storageId as any);
      if (!blob) throw new Error("File not found in storage");
      const content = await blob.text();
      if (!content.trim()) throw new Error("File is empty");

      // ── Parse based on file type ──
      let primaryRecords: Array<{
        firstName: string;
        lastName: string;
        email?: string;
        phone?: string;
        dateOfBirth?: string;
        gender?: string;
        address?: any;
        dependents?: Array<{ firstName: string; lastName: string; dateOfBirth?: string; relationship: string }>;
      }> = [];
      const errors: Array<{ row: number; message: string }> = [];

      if (file.fileType === "txt") {
        // ── Careington pipe-delimited format ──
        const lines = content.split("\n").filter((l: string) => l.trim());

        // Group rows by uniqueId: seqNum "00" = primary, others = dependents
        const groupedByUniqueId = new Map<string, {
          primary: ReturnType<typeof parseCareingtonRow>;
          dependents: Array<ReturnType<typeof parseCareingtonRow>>;
        }>();

        for (let i = 0; i < lines.length; i++) {
          const parsed = parseCareingtonRow(lines[i]);
          if (!parsed) {
            errors.push({ row: i, message: `Could not parse row ${i}: insufficient fields` });
            continue;
          }

          const key = parsed.uniqueId;
          if (!groupedByUniqueId.has(key)) {
            groupedByUniqueId.set(key, { primary: null, dependents: [] });
          }
          const group = groupedByUniqueId.get(key)!;

          if (parsed.seqNum === "00") {
            group.primary = parsed;
          } else {
            group.dependents.push(parsed);
          }
        }

        // Flatten into primary records with embedded dependents
        for (const [uid, group] of groupedByUniqueId) {
          if (!group.primary) {
            errors.push({ row: -1, message: `UniqueID ${uid} has dependents but no primary (seqNum 00)` });
            continue;
          }
          const p = group.primary;
          const deps = group.dependents
            .filter((d): d is NonNullable<typeof d> => d !== null)
            .map((d) => ({
              firstName: d.firstName,
              lastName: d.lastName,
              dateOfBirth: d.dateOfBirth,
              relationship: (d.relationship ?? "other") as "spouse" | "child" | "domestic_partner" | "other",
            }));

          primaryRecords.push({
            firstName: p.firstName,
            lastName: p.lastName,
            email: p.email,
            phone: p.phone,
            dateOfBirth: p.dateOfBirth,
            gender: p.gender,
            address: p.address,
            dependents: deps.length > 0 ? deps : undefined,
          });
        }
      } else if (file.fileType === "csv") {
        // ── Standard CSV ──
        primaryRecords = parseCsvContent(content);
      } else if (file.fileType === "json") {
        // ── JSON array of records ──
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          primaryRecords = parsed;
        } else if (parsed.records && Array.isArray(parsed.records)) {
          primaryRecords = parsed.records;
        }
      } else {
        throw new Error(`Unsupported file type: ${file.fileType}`);
      }

      const totalRecords = primaryRecords.length;
      if (totalRecords === 0) {
        await ctx.runMutation(api.admin.eligibility.completeFileProcessing, {
          fileId: args.fileId,
          status: errors.length > 0 ? "completed_with_errors" : "completed",
          processedRecords: 0,
          errorRecords: errors.length,
          newMembers: 0,
        });
        return { totalRecords: 0, errors };
      }

      // Update status → processing, set total record count
      await ctx.runMutation(api.admin.eligibility.updateFileStatus, {
        fileId: args.fileId,
        status: "processing",
      });
      await ctx.runMutation(api.admin.eligibility.setTotalRecords, {
        fileId: args.fileId,
        totalRecords,
      });

      // ── Dispatch batched mutations via scheduler ──
      const totalBatches = Math.ceil(totalRecords / BATCH_SIZE);
      for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
        const start = batchIdx * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, totalRecords);
        const batchRecords = primaryRecords.slice(start, end);

        // Serialize records for the mutation args
        const serializedRecords = batchRecords.map((r) => ({
          firstName: r.firstName,
          lastName: r.lastName,
          email: r.email ?? "",
          phone: r.phone ?? "",
          dateOfBirth: r.dateOfBirth ?? "",
          gender: r.gender ?? "",
          address: r.address,
          dependents: r.dependents,
        }));

        const isLastBatch = batchIdx === totalBatches - 1;

        // Schedule each batch to run sequentially via the scheduler
        await ctx.scheduler.runAfter(batchIdx * 200, internal.admin.eligibility.internalBatchCreateMembers, {
          fileId: args.fileId,
          siteId: file.siteId,
          accountId: file.accountId!,
          groupId: file.groupId,
          records: serializedRecords,
          batchIndex: batchIdx,
          totalBatches,
          isLastBatch,
          startRowIndex: start,
          parseErrors: isLastBatch ? errors : [],
        });
      }

      return {
        totalRecords,
        totalBatches,
        parseErrors: errors.length,
        message: `Scheduled ${totalBatches} batch(es) for ${totalRecords} primary records`,
      };
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
 * Set total record count on an eligibility file (called during processing)
 */
export const setTotalRecords = mutation({
  args: {
    fileId: v.id("eligibilityFiles"),
    totalRecords: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.fileId, { totalRecords: args.totalRecords });
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
 * Get or initialize an atomic counter, returning the next N values
 * Returns the starting value; caller should use startVal + 0, startVal + 1, etc.
 */
async function reserveCounterRange(
  ctx: any,
  counterName: string,
  count: number
): Promise<number> {
  const existing = await ctx.db
    .query("counters")
    .withIndex("by_name", (q: any) => q.eq("name", counterName))
    .first();

  if (existing) {
    const start = existing.value + 1;
    await ctx.db.patch(existing._id, { value: existing.value + count });
    return start;
  } else {
    // Initialize counter — start at 100000000 for 9-digit IDs
    await ctx.db.insert("counters", { name: counterName, value: 100000000 + count });
    return 100000001;
  }
}

/**
 * Internal batched mutation: creates members in chunks
 * Called by scheduler from processEligibilityFile action.
 * NOT exposed to the public API (internalMutation).
 */
export const internalBatchCreateMembers = internalMutation({
  args: {
    fileId: v.id("eligibilityFiles"),
    siteId: v.id("sites"),
    accountId: v.id("accounts"),
    groupId: v.id("groups"),
    records: v.array(
      v.object({
        firstName: v.string(),
        lastName: v.string(),
        email: v.string(),
        phone: v.string(),
        dateOfBirth: v.string(),
        gender: v.string(),
        address: v.optional(v.any()),
        dependents: v.optional(v.any()),
      })
    ),
    batchIndex: v.number(),
    totalBatches: v.number(),
    isLastBatch: v.boolean(),
    startRowIndex: v.number(),
    parseErrors: v.array(v.object({ row: v.number(), message: v.string() })),
  },
  handler: async (ctx, args) => {
    const results = { created: 0, updated: 0, failed: 0, errors: [] as any[] };
    const now = Date.now();

    // Reserve a range of member IDs atomically
    const idStart = await reserveCounterRange(ctx, "memberIdSeq", args.records.length);

    for (let i = 0; i < args.records.length; i++) {
      const record = args.records[i];
      const rowIndex = args.startRowIndex + i;

      // Validate required fields
      if (!record.firstName || !record.lastName) {
        results.failed++;
        results.errors.push({ rowIndex, message: "firstName and lastName are required" });
        continue;
      }
      if (!record.email && !record.phone) {
        results.failed++;
        results.errors.push({ rowIndex, message: "email or phone is required" });
        continue;
      }

      try {
        // Check for existing member by email within the same group (use the new index)
        let existing = null;
        if (record.email) {
          existing = await ctx.db
            .query("memberProfiles")
            .withIndex("by_group_email", (q: any) =>
              q.eq("groupId", args.groupId).eq("email", record.email)
            )
            .first();
        }

        // Normalize gender
        const genderLower = (record.gender || "").toLowerCase();
        const validGender = (["male", "female", "non_binary", "prefer_not_to_say", "other"].includes(genderLower))
          ? (genderLower as any)
          : undefined;

        // Parse dependents if attached
        const dependents = Array.isArray(record.dependents) && record.dependents.length > 0
          ? record.dependents.map((d: any) => ({
              firstName: d.firstName,
              lastName: d.lastName,
              dateOfBirth: d.dateOfBirth || undefined,
              relationship: d.relationship || "other",
            }))
          : undefined;

        if (existing) {
          // ── Update existing member ──
          await ctx.db.patch(existing._id, {
            firstName: record.firstName,
            lastName: record.lastName,
            email: record.email || existing.email,
            phone: record.phone || existing.phone,
            dateOfBirth: record.dateOfBirth || existing.dateOfBirth,
            gender: validGender ?? existing.gender,
            address: record.address || existing.address,
            dependents: dependents ?? existing.dependents,
            eligibilityFileId: args.fileId,
            updatedAt: now,
          });
          results.updated++;
        } else {
          // ── Create new member with atomic counter-based ID ──
          const seqNum = idStart + i;
          const memberId = `MBR-${String(seqNum)}`;
          const year = String(new Date().getFullYear()).slice(2);
          const random = Math.random().toString(36).substring(2, 8).toUpperCase();
          const barcode = `ELG${year}${random}`;

          await ctx.db.insert("memberProfiles", {
            memberId,
            barcode,
            siteId: args.siteId,
            accountId: args.accountId,
            groupId: args.groupId,
            firstName: record.firstName,
            lastName: record.lastName,
            email: record.email || undefined,
            phone: record.phone || undefined,
            dateOfBirth: record.dateOfBirth || undefined,
            gender: validGender,
            address: record.address,
            dependents,
            status: "active",
            memberType: "eligible",
            eligibilityFileId: args.fileId,
            communicationPrefs: {
              emailOptIn: true,
              smsOptIn: true,
              callOptIn: true,
            },
            createdAt: now,
            updatedAt: now,
          });
          results.created++;
        }
      } catch (error) {
        results.failed++;
        results.errors.push({ rowIndex, error: (error as any).message });
      }
    }

    // ── Update file counters (additive — multiple batches contribute) ──
    const file = await ctx.db.get(args.fileId);
    if (file) {
      await ctx.db.patch(args.fileId, {
        processedRecords: (file.processedRecords ?? 0) + args.records.length,
        newMembers: (file.newMembers ?? 0) + results.created,
        updatedMembers: (file.updatedMembers ?? 0) + results.updated,
        errorRecords: (file.errorRecords ?? 0) + results.failed,
      });
    }

    // ── If last batch, finalize the file ──
    if (args.isLastBatch) {
      const updatedFile = await ctx.db.get(args.fileId);
      const totalErrors = (updatedFile?.errorRecords ?? 0) + args.parseErrors.length;
      const finalStatus = totalErrors > 0 ? "completed_with_errors" : "completed";
      await ctx.db.patch(args.fileId, {
        status: finalStatus,
        completedAt: Date.now(),
      });
    }

    return results;
  },
});

/**
 * LEGACY: Batch create members (kept for backward compatibility, uses new pipeline internally)
 * Prefer processEligibilityFile → internalBatchCreateMembers pipeline for bulk ops.
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

    // Reserve atomic IDs for this batch
    const idStart = await reserveCounterRange(ctx, "memberIdSeq", args.records.length);
    const now = Date.now();

    for (let i = 0; i < args.records.length; i++) {
      const record = args.records[i];

      // Basic validation
      if (!record.firstName || !record.lastName) {
        results.failed++;
        results.errors.push({ rowIndex: i, errors: ["firstName and lastName required"] });
        continue;
      }
      if (!record.email && !record.phone) {
        results.failed++;
        results.errors.push({ rowIndex: i, errors: ["email or phone required"] });
        continue;
      }

      try {
        // Check if member with this email already exists (use new index)
        let existing = null;
        if (record.email) {
          existing = await ctx.db
            .query("memberProfiles")
            .withIndex("by_group_email", (q: any) =>
              q.eq("groupId", file.groupId).eq("email", record.email)
            )
            .first();
        }

        const validGender = (["male", "female", "non_binary", "prefer_not_to_say", "other"].includes(record.gender?.toLowerCase() || ""))
          ? (record.gender?.toLowerCase() as any)
          : undefined;

        if (existing) {
          await ctx.db.patch(existing._id, {
            firstName: record.firstName,
            lastName: record.lastName,
            email: record.email,
            phone: record.phone,
            dateOfBirth: record.dateOfBirth,
            gender: validGender,
            eligibilityFileId: args.fileId,
            updatedAt: now,
          });
          results.updated++;
        } else {
          const seqNum = idStart + i;
          const memberId = `MBR-${String(seqNum)}`;
          const year = String(new Date().getFullYear()).slice(2);
          const random = Math.random().toString(36).substring(2, 8).toUpperCase();
          const barcode = `ELG${year}${random}`;

          await ctx.db.insert("memberProfiles", {
            memberId,
            barcode,
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
            communicationPrefs: {
              emailOptIn: true,
              smsOptIn: true,
              callOptIn: true,
            },
            createdAt: now,
            updatedAt: now,
          });
          results.created++;
        }
      } catch (error) {
        results.failed++;
        results.errors.push({ rowIndex: i, error: (error as any).message });
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
