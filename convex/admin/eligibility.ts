import { mutation, query, action, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import { requireAdmin, requireAdminAction } from "../lib/authGuards";
import { createMemberProfile } from "../lib/memberCreation";
import * as XLSX from "xlsx";

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
const MAX_PRIMARY_RECORDS = 10000; // Hard cap on primaries per upload (Tivity-style limit)

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
  // 7 = filler (SSN placeholder per CI007)
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
  relation: 21,      // C=Child, S=Spouse, O=Other; blank for primary (seqNum 00)
  studentStatus: 22, // Y/N for dependents; blank for primary
  // 23 = filler (per CI007)
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
  title: string | undefined;
  firstName: string;
  middleName: string | undefined;
  lastName: string;
  suffix: string | undefined;
  email: string | undefined;
  phone: string | undefined;
  workPhone: string | undefined;
  dateOfBirth: string | undefined;
  effectiveDate: string | undefined;
  gender: string | undefined;
  uniqueId: string;
  seqNum: string;
  address?: { line1: string; line2?: string; city: string; state: string; postalCode: string; country: string };
  relationship?: string;
  groupCode: string;
  coverage: string;
  studentStatus: string | undefined;
} | null {
  const fields = line.split("|");
  if (fields.length < 20) return null; // Minimum fields needed

  const f = CAREINGTON_FIELD_MAP;
  const firstName = (fields[f.firstName] ?? "").trim();
  const lastName = (fields[f.lastName] ?? "").trim();
  if (!firstName || !lastName) return null;

  const title = (fields[f.title] ?? "").trim() || undefined;
  const middleName = (fields[f.middleInitial] ?? "").trim() || undefined;
  const suffix = (fields[f.suffix] ?? "").trim() || undefined;

  // Parse DOB from MMDDYYYY → ISO YYYY-MM-DD
  const rawDob = (fields[f.dob] ?? "").trim();
  let dateOfBirth: string | undefined;
  if (rawDob.length === 8) {
    const mm = rawDob.slice(0, 2);
    const dd = rawDob.slice(2, 4);
    const yyyy = rawDob.slice(4, 8);
    dateOfBirth = `${yyyy}-${mm}-${dd}`;
  }

  // Parse effective date from MMDDYYYY → ISO YYYY-MM-DD
  const rawEff = (fields[f.effDate] ?? "").trim();
  let effectiveDate: string | undefined;
  if (rawEff.length === 8) {
    const mm = rawEff.slice(0, 2);
    const dd = rawEff.slice(2, 4);
    const yyyy = rawEff.slice(4, 8);
    effectiveDate = `${yyyy}-${mm}-${dd}`;
  }

  const rawGender = (fields[f.gender] ?? "").trim().toUpperCase();
  const gender = rawGender === "M" ? "male" : rawGender === "F" ? "female" : undefined;

  const email = (fields[f.email] ?? "").trim() || undefined;
  const phone = (fields[f.homePhone] ?? "").trim().replace(/\D/g, "") || undefined;
  const workPhone = (fields[f.workPhone] ?? "").trim().replace(/\D/g, "") || undefined;

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
  const coverage = (fields[f.coverage] ?? "").trim();
  const studentStatus = (fields[f.studentStatus] ?? "").trim() || undefined;

  // Determine relationship for dependents:
  // Prefer the explicit Relation field (21): C=Child, S=Spouse, O=Other
  // Fall back to Coverage field interpretation (MS=Spouse, MD=Child)
  let relationship: string | undefined;
  if (seqNum !== "00") {
    const relation = (fields[f.relation] ?? "").trim().toUpperCase();
    const coverage = (fields[f.coverage] ?? "").trim().toUpperCase();
    if (relation === "S") relationship = "spouse";
    else if (relation === "C") relationship = "child";
    else if (relation === "O") relationship = "other";
    else if (coverage === "MS") relationship = "spouse";
    else if (coverage === "MD") relationship = "child";
    else relationship = "other";
  }

  return {
    title,
    firstName,
    middleName,
    lastName,
    suffix,
    email,
    phone,
    workPhone,
    dateOfBirth,
    effectiveDate,
    gender,
    uniqueId,
    seqNum,
    address,
    relationship,
    groupCode,
    coverage,
    studentStatus,
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
 * Parse an XLSX buffer (Ideal Sample Census format) into primary records + dependents.
 *
 * Header-driven: matches columns by lowercased/normalized header name. Recognized headers
 * include FIRSTNAME, LASTNAME, EMAIL, DATEOFBIRTH, EFFECTIVEDATE, GENDER, GROUP CODE,
 * Unique ID, Sequence Number, Coverage, ADDRESS1/2, CITY, STATE, ZIP, Home Phone, Work Phone,
 * Title, MIDDLENAME, Post Name, RELATION.
 *
 * Rows with seqNum "00" (or blank) are primaries; non-zero seqNums are dependents that
 * attach to the primary with the same Unique ID.
 */
function parseXlsxBuffer(
  buffer: ArrayBuffer,
  errors: Array<{ row: number; message: string }>
): Array<{
  title?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: string;
  email?: string;
  phone?: string;
  workPhone?: string;
  dateOfBirth?: string;
  effectiveDate?: string;
  gender?: string;
  address?: any;
  dependents?: Array<{ firstName: string; lastName: string; dateOfBirth?: string; relationship: string }>;
}> {
  const wb = XLSX.read(buffer, { type: "array", cellDates: false });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });

  const norm = (k: string) => k.toLowerCase().replace(/[\s_-]/g, "");
  const pick = (row: any, ...candidates: string[]): string => {
    for (const cand of candidates) {
      const target = norm(cand);
      for (const k of Object.keys(row)) {
        if (norm(k) === target) {
          const v = row[k];
          if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
        }
      }
    }
    return "";
  };

  // Convert various date formats (MM/DD/YYYY, MMDDYYYY, M/D/YYYY) to ISO YYYY-MM-DD
  const toIsoDate = (s: string): string | undefined => {
    if (!s) return undefined;
    const trimmed = s.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    if (/^\d{8}$/.test(trimmed)) {
      return `${trimmed.slice(4, 8)}-${trimmed.slice(0, 2)}-${trimmed.slice(2, 4)}`;
    }
    const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slash) {
      const mm = slash[1].padStart(2, "0");
      const dd = slash[2].padStart(2, "0");
      return `${slash[3]}-${mm}-${dd}`;
    }
    return undefined;
  };

  // Group by uniqueId so dependents attach to the right primary
  type Parsed = ReturnType<typeof parseRow>;
  function parseRow(row: any) {
    const firstName = pick(row, "FIRSTNAME", "first_name", "First Name");
    const lastName = pick(row, "LASTNAME", "last_name", "Last Name");
    if (!firstName || !lastName) return null;
    const seqNum = (pick(row, "Sequence Number", "SequenceNumber", "Seq", "SeqNum") || "00").padStart(2, "0");
    const uniqueId = pick(row, "Unique ID", "UniqueID", "MemberID", "Member ID");
    const coverage = pick(row, "Coverage").toUpperCase();
    const relationRaw = pick(row, "RELATION", "Relation", "Relationship").toUpperCase();
    let relationship: "spouse" | "child" | "domestic_partner" | "other" | undefined;
    if (seqNum !== "00") {
      if (relationRaw.startsWith("S")) relationship = "spouse";
      else if (relationRaw.startsWith("C")) relationship = "child";
      else if (coverage === "MS") relationship = "spouse";
      else if (coverage === "MD" || coverage === "MC") relationship = "child";
      else relationship = "other";
    }
    const genderRaw = pick(row, "GENDER", "Gender").toUpperCase();
    const gender = genderRaw.startsWith("M") ? "male" : genderRaw.startsWith("F") ? "female" : undefined;
    const addr1 = pick(row, "ADDRESS1", "Address1", "Address Line 1");
    const address = addr1 ? {
      line1: addr1,
      line2: pick(row, "ADDRESS2", "Address2", "Address Line 2") || undefined,
      city: pick(row, "CITY", "City"),
      state: pick(row, "STATE", "State"),
      postalCode: pick(row, "ZIP", "Zip", "Postal Code"),
      country: "US",
    } : undefined;
    return {
      title: pick(row, "Title") || undefined,
      firstName,
      middleName: pick(row, "MIDDLENAME", "Middle Name", "Middle Initial") || undefined,
      lastName,
      suffix: pick(row, "Post Name", "Suffix") || undefined,
      email: pick(row, "EMAIL", "Email", "Email Address") || undefined,
      phone: pick(row, "Home Phone", "Phone").replace(/\D/g, "") || undefined,
      workPhone: pick(row, "Work Phone").replace(/\D/g, "") || undefined,
      dateOfBirth: toIsoDate(pick(row, "DATEOFBIRTH", "Date of Birth", "DOB", "dateOfBirth")),
      effectiveDate: toIsoDate(pick(row, "EFFECTIVEDATE", "Effective Date")),
      termDate: toIsoDate(pick(row, "TERMDATE", "Termination Date", "Term Date")),
      groupCode: pick(row, "Group Code", "GroupCode", "GROUP CODE") || undefined,
      studentStatus: pick(row, "Student Status", "StudentStatus") || undefined,
      gender,
      address,
      uniqueId,
      seqNum,
      relationship,
    };
  }

  // Walk rows IN ORDER. seqNum "00" starts a new family group. Any non-"00"
  // row attaches to the most recent "00" row \u2014 we ignore the row's Unique ID
  // for grouping purposes because real-world census files frequently violate
  // the Careington spec (which says "dependents share the primary's Unique ID")
  // by giving each person their own ID. Grouping by row order matches how
  // census files are physically structured (family rows are always contiguous).
  type Group = { primary: Parsed; dependents: Parsed[]; primaryRow: number };
  const groupsList: Group[] = [];
  let currentGroup: Group | null = null;
  let sawNonSpecCompliantId = false;

  for (let i = 0; i < rows.length; i++) {
    const parsed = parseRow(rows[i]);
    if (!parsed) {
      // Empty row \u2014 skip silently if every cell is blank, error otherwise
      const allBlank = Object.values(rows[i] ?? {}).every(
        (v) => v === undefined || v === null || String(v).trim() === ""
      );
      if (!allBlank) {
        errors.push({ row: i + 2, message: `Row ${i + 2}: missing firstName or lastName` });
      }
      continue;
    }

    if (parsed.seqNum === "00") {
      currentGroup = { primary: parsed, dependents: [], primaryRow: i + 2 };
      groupsList.push(currentGroup);
    } else if (currentGroup) {
      // Track spec violation for a single warning at the end
      if (parsed.uniqueId && parsed.uniqueId !== currentGroup.primary!.uniqueId) {
        sawNonSpecCompliantId = true;
      }
      currentGroup.dependents.push(parsed);
    } else {
      // Non-00 row before any primary \u2014 this is a real error
      errors.push({
        row: i + 2,
        message: `Row ${i + 2}: dependent (seqNum ${parsed.seqNum}) appears before any primary (seqNum 00)`,
      });
    }
  }

  if (sawNonSpecCompliantId) {
    errors.push({
      row: -1,
      message:
        "Warning: dependents had different Unique IDs than their primary (Careington spec requires shared Unique ID). " +
        "Grouped by row order instead. Generated vendor file will use the primary's Unique ID for all family members.",
    });
  }

  const out: any[] = [];
  for (const g of groupsList) {
    const p = g.primary!;
    const deps = g.dependents
      .filter((d): d is NonNullable<Parsed> => d !== null)
      .map((d, di) => ({
        firstName: d!.firstName,
        lastName: d!.lastName,
        email: d!.email,
        phone: d!.phone,
        address: d!.address,
        gender: d!.gender,
        dateOfBirth: d!.dateOfBirth,
        relationship: (d!.relationship ?? "other") as "spouse" | "child" | "domestic_partner" | "other",
        seqNum: d!.seqNum ?? String(di + 1).padStart(2, "0"),
      }));
    out.push({
      title: p.title,
      firstName: p.firstName,
      middleName: p.middleName,
      lastName: p.lastName,
      suffix: p.suffix,
      email: p.email,
      phone: p.phone,
      workPhone: p.workPhone,
      dateOfBirth: p.dateOfBirth,
      effectiveDate: p.effectiveDate,
      gender: p.gender,
      address: p.address,
      uniqueId: p.uniqueId || undefined,
      dependents: deps.length > 0 ? deps : undefined,
    });
  }
  return out;
}

/**
 * Process eligibility file — the main pipeline action
 *
 * 1. Fetch file from Convex _storage
 * 2. Parse (pipe-delimited txt OR csv OR xlsx OR json)
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

    // Resolve accountId — the uploadEligibilityFile mutation accepts it as optional
    // but internalBatchCreateMembers requires it. Always fall back to the group's
    // accountId which is guaranteed non-null by the groups schema.
    let resolvedAccountId = file.accountId;
    const targetGroup = await ctx.runQuery(api.admin.hierarchy.getGroupById, { groupId: file.groupId });
    if (!resolvedAccountId) {
      if (!targetGroup?.accountId) throw new Error(`Group ${file.groupId} has no accountId — cannot process file`);
      resolvedAccountId = targetGroup.accountId;
    }

    // GATE: refuse to ingest if the destination Organization has no
    // organizationCode — every member created here would otherwise have a
    // missing Subscriber ID. Admins must set the Organization Code first via
    // /admin/hierarchy before re-running the file.
    if (!targetGroup?.organizationCode) {
      throw new Error(
        `Organization "${targetGroup?.name ?? file.groupId}" has no Organization Code (Subscriber ID). ` +
        `Set it via Admin → Hierarchy → Organizations before processing this eligibility file.`,
      );
    }

    // Update status → validating  AND reset counters so Re-process gives
    // accurate progress instead of accumulating from the prior failed run.
    await ctx.runMutation(api.admin.eligibility.updateFileStatus, {
      fileId: args.fileId,
      status: "validating",
    });
    await ctx.runMutation(api.admin.eligibility.resetFileCounters, {
      fileId: args.fileId,
    });

    try {
      // ── Fetch file content from Convex storage ──
      if (!file.storageId) throw new Error("No storage ID on file record");
      const blob = await ctx.storage.get(file.storageId as any);
      if (!blob) throw new Error("File not found in storage");

      // For xlsx we need the binary bytes; for everything else we read as text
      let content = "";
      let xlsxBuffer: ArrayBuffer | null = null;
      if (file.fileType === "xlsx") {
        xlsxBuffer = await blob.arrayBuffer();
        if (!xlsxBuffer.byteLength) throw new Error("File is empty");
      } else {
        content = await blob.text();
        if (!content.trim()) throw new Error("File is empty");
      }

      // ── Parse based on file type ──
      let primaryRecords: Array<{
        title?: string;
        firstName: string;
        middleName?: string;
        lastName: string;
        suffix?: string;
        email?: string;
        phone?: string;
        workPhone?: string;
        dateOfBirth?: string;
        effectiveDate?: string;
        gender?: string;
        address?: any;
        uniqueId?: string;  // Careington/DialCare Unique ID (shared across family)
        dependents?: Array<{ firstName: string; lastName: string; dateOfBirth?: string; relationship: string; seqNum?: string }>;
      }> = [];
      const errors: Array<{ row: number; message: string }> = [];

      if (file.fileType === "txt") {
        // ── Careington pipe-delimited format ──
        const lines = content.split(/\r?\n/).filter((l: string) => l.trim());

        // Walk rows IN ORDER. seqNum "00" starts a new family group; any
        // non-"00" row attaches to the most recent "00" row. We use the
        // primary's Unique ID for the whole family even if the source file
        // assigned different IDs to dependents (Careington spec requires
        // shared Unique ID; some upstream systems violate this).
        type ParsedTxt = ReturnType<typeof parseCareingtonRow>;
        type Family = { primary: NonNullable<ParsedTxt>; dependents: NonNullable<ParsedTxt>[] };
        const families: Family[] = [];
        let currentFamily: Family | null = null;
        let sawNonSpecCompliantId = false;

        for (let i = 0; i < lines.length; i++) {
          const parsed = parseCareingtonRow(lines[i]);
          if (!parsed) {
            errors.push({ row: i, message: `Could not parse row ${i + 1}: insufficient fields` });
            continue;
          }

          if (parsed.seqNum === "00") {
            currentFamily = { primary: parsed, dependents: [] };
            families.push(currentFamily);
          } else if (currentFamily) {
            if (parsed.uniqueId && parsed.uniqueId !== currentFamily.primary.uniqueId) {
              sawNonSpecCompliantId = true;
            }
            currentFamily.dependents.push(parsed);
          } else {
            errors.push({
              row: i,
              message: `Row ${i + 1}: dependent (seqNum ${parsed.seqNum}) appears before any primary (seqNum 00)`,
            });
          }
        }

        if (sawNonSpecCompliantId) {
          errors.push({
            row: -1,
            message:
              "Warning: dependents had different Unique IDs than their primary (Careington spec requires shared Unique ID). " +
              "Grouped by row order instead. Generated vendor file will use the primary's Unique ID for all family members.",
          });
        }

        // Flatten into primary records with embedded dependents
        for (const family of families) {
          const p = family.primary;
          const deps = family.dependents.map((d, di) => ({
            firstName: d.firstName,
            lastName: d.lastName,
            email: d.email,
            phone: d.phone,
            address: d.address,
            gender: d.gender,
            dateOfBirth: d.dateOfBirth,
            relationship: (d.relationship ?? "other") as "spouse" | "child" | "domestic_partner" | "other",
            seqNum: d.seqNum ?? String(di + 1).padStart(2, "0"),
          }));

          primaryRecords.push({
            title: p.title,
            firstName: p.firstName,
            middleName: p.middleName,
            lastName: p.lastName,
            suffix: p.suffix,
            email: p.email,
            phone: p.phone,
            workPhone: p.workPhone,
            dateOfBirth: p.dateOfBirth,
            effectiveDate: p.effectiveDate,
            gender: p.gender,
            address: p.address,
            uniqueId: p.uniqueId || undefined,
            dependents: deps.length > 0 ? deps : undefined,
          });
        }
      } else if (file.fileType === "csv") {
        // ── Standard CSV ──
        primaryRecords = parseCsvContent(content);
      } else if (file.fileType === "xlsx") {
        // ── Excel (.xlsx) — Ideal Sample Census format ──
        primaryRecords = parseXlsxBuffer(xlsxBuffer!, errors);
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
      if (totalRecords > MAX_PRIMARY_RECORDS) {
        await ctx.runMutation(api.admin.eligibility.updateFileStatus, {
          fileId: args.fileId,
          status: "failed",
        });
        throw new Error(
          `File has ${totalRecords} primary members which exceeds the ${MAX_PRIMARY_RECORDS} per-upload limit. ` +
          `Please split the file into smaller batches.`
        );
      }
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
          title: r.title ?? "",
          firstName: r.firstName,
          middleName: r.middleName ?? "",
          lastName: r.lastName,
          suffix: r.suffix ?? "",
          email: r.email ?? "",
          phone: r.phone ?? "",
          workPhone: r.workPhone ?? "",
          dateOfBirth: r.dateOfBirth ?? "",
          effectiveDate: r.effectiveDate ?? "",
          gender: r.gender ?? "",
          uniqueId: r.uniqueId ?? "",
          address: r.address,
          dependents: r.dependents,
        }));

        const isLastBatch = batchIdx === totalBatches - 1;

        // Schedule each batch to run sequentially via the scheduler
        await ctx.scheduler.runAfter(batchIdx * 200, internal.admin.eligibility.internalBatchCreateMembers, {
          fileId: args.fileId,
          siteId: file.siteId,
          accountId: resolvedAccountId,
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
 * Validate a parsed record against Census Template required fields.
 */
function validateRequiredFields(
  record: any,
  rowNumber: number
): Array<{ field: string; message: string }> {
  const issues: Array<{ field: string; message: string }> = [];
  if (!record.firstName) issues.push({ field: "firstName", message: `Row ${rowNumber}: First Name is required` });
  if (!record.lastName) issues.push({ field: "lastName", message: `Row ${rowNumber}: Last Name is required` });
  if (!record.uniqueId) issues.push({ field: "uniqueId", message: `Row ${rowNumber}: Unique ID is required` });
  if (!record.seqNum) issues.push({ field: "seqNum", message: `Row ${rowNumber}: Sequence Number is required` });
  if (!record.address?.line1) issues.push({ field: "address", message: `Row ${rowNumber}: Address Line 1 is required` });
  if (!record.address?.city) issues.push({ field: "city", message: `Row ${rowNumber}: City is required` });
  if (!record.address?.state) issues.push({ field: "state", message: `Row ${rowNumber}: State is required` });
  if (!record.address?.postalCode) issues.push({ field: "zip", message: `Row ${rowNumber}: Zip is required` });
  if (!record.coverage) issues.push({ field: "coverage", message: `Row ${rowNumber}: Coverage is required` });
  if (!record.groupCode) issues.push({ field: "groupCode", message: `Row ${rowNumber}: Group Code is required` });
  if (!record.effectiveDate) issues.push({ field: "effectiveDate", message: `Row ${rowNumber}: Effective Date is required` });
  if (!record.dateOfBirth) issues.push({ field: "dateOfBirth", message: `Row ${rowNumber}: Date of Birth is required` });
  if (!record.email) issues.push({ field: "email", message: `Row ${rowNumber}: Email Address is required (for e-Fulfillment)` });
  if (record.seqNum && record.seqNum !== "00") {
    if (!record.relationship) issues.push({ field: "relationship", message: `Row ${rowNumber}: Relation is required for dependents` });
  }
  return issues;
}

/**
 * Preview an uploaded eligibility file WITHOUT persisting any members.
 *
 * Parses the file using the same logic as processEligibilityFile, but only
 * returns counts, sample records, and detected issues so the admin can
 * verify before committing. Tivity-style "Step 2: Map+Preview" behavior.
 */
export const previewEligibilityFile = action({

  args: {
    storageId: v.string(),
    fileType: v.union(v.literal("csv"), v.literal("xlsx"), v.literal("txt"), v.literal("json")),
    fileName: v.string(),
  },
  handler: async (ctx, args): Promise<{
    primaryCount: number;
    dependentCount: number;
    sampleRecords: Array<{
      firstName: string;
      lastName: string;
      email?: string;
      dateOfBirth?: string;
      effectiveDate?: string;
      dependentCount: number;
      validationIssues?: number;
    }>;
    detectedColumns: string[];
    errors: Array<{ row: number; field?: string; message: string }>;
    errorCount: number;
    validationErrors: Array<{ row: number; field: string; message: string }>;
    validationErrorCount: number;
    recordsWithValidationIssues: number;
    tooLarge: boolean;
    maxRecords: number;
  }> => {
    // @ts-ignore - Avoid deep type instantiation
    await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);

    const blob = await ctx.storage.get(args.storageId as any);
    if (!blob) throw new Error("File not found in storage");

    let content = "";
    let xlsxBuffer: ArrayBuffer | null = null;
    if (args.fileType === "xlsx") {
      xlsxBuffer = await blob.arrayBuffer();
      if (!xlsxBuffer.byteLength) throw new Error("File is empty");
    } else {
      content = await blob.text();
      if (!content.trim()) throw new Error("File is empty");
    }

    const errors: Array<{ row: number; message: string }> = [];
    const validationErrors: Array<{ row: number; field: string; message: string }> = [];
    let primaryRecords: Array<any> = [];
    const detectedColumns: string[] = [];

    if (args.fileType === "txt") {
      const lines = content.split(/\r?\n/).filter((l) => l.trim());
      type ParsedTxt = ReturnType<typeof parseCareingtonRow>;
      type Family = { primary: NonNullable<ParsedTxt>; dependents: NonNullable<ParsedTxt>[]; rowNumber: number };
      const families: Family[] = [];
      let currentFamily: Family | null = null;
      let sawNonSpecCompliantId = false;
      for (let i = 0; i < lines.length; i++) {
        const parsed = parseCareingtonRow(lines[i]);
        if (!parsed) {
          errors.push({ row: i, message: `Could not parse row ${i + 1}: insufficient fields` });
          continue;
        }
        if (parsed.seqNum === "00") {
          currentFamily = { primary: parsed, dependents: [], rowNumber: i + 1 };
          families.push(currentFamily);
        } else if (currentFamily) {
          if (parsed.uniqueId && parsed.uniqueId !== currentFamily.primary.uniqueId) {
            sawNonSpecCompliantId = true;
          }
          currentFamily.dependents.push(parsed);
        } else {
          errors.push({
            row: i,
            message: `Row ${i + 1}: dependent (seqNum ${parsed.seqNum}) appears before any primary (seqNum 00)`,
          });
        }
      }
      if (sawNonSpecCompliantId) {
        errors.push({
          row: -1,
          message:
            "Warning: dependents had different Unique IDs than their primary — will be grouped by row order.",
        });
      }
      for (const family of families) {
        const p = family.primary;
        const primaryWithValidation = {
          firstName: p.firstName,
          lastName: p.lastName,
          email: p.email,
          dateOfBirth: p.dateOfBirth,
          effectiveDate: p.effectiveDate,
          address: p.address,
          coverage: p.coverage,
          groupCode: p.groupCode,
          seqNum: p.seqNum,
          uniqueId: p.uniqueId,
          relationship: p.relationship,
          studentStatus: p.studentStatus,
          dependents: family.dependents.map((d) => ({
            firstName: d.firstName,
            lastName: d.lastName,
            dateOfBirth: d.dateOfBirth,
            relationship: (d.relationship ?? "other") as any,
          })),
          _validationRowNumber: family.rowNumber,
        };
        
        // Validate primary
        const primaryValidationIssues = validateRequiredFields(p, family.rowNumber);
        primaryValidationIssues.forEach(issue => {
          validationErrors.push({ row: family.rowNumber, ...issue });
        });
        
        // Validate dependents
        family.dependents.forEach((d, depIdx) => {
          const depRow = family.rowNumber + depIdx + 1;
          const depValidationIssues = validateRequiredFields(d, depRow);
          depValidationIssues.forEach(issue => {
            validationErrors.push({ row: depRow, ...issue });
          });
        });
        
        primaryRecords.push(primaryWithValidation);
      }
      detectedColumns.push(
        "title", "firstName", "middleInitial", "lastName", "suffix", "uniqueId", "seqNum",
        "addr1", "city", "state", "zip", "homePhone", "coverage", "groupCode",
        "termDate", "effDate", "dob", "gender", "email"
      );
    } else if (args.fileType === "csv") {
      primaryRecords = parseCsvContent(content);
      const headerLine = content.split(/\r?\n/)[0] ?? "";
      detectedColumns.push(...headerLine.split(",").map((h) => h.trim()).filter(Boolean));
      // Validate CSV records
      primaryRecords.forEach((record, idx) => {
        const validationIssues = validateRequiredFields(record, idx + 2);
        validationIssues.forEach(issue => {
          validationErrors.push({ row: idx + 2, ...issue });
        });
        record._validationRowNumber = idx + 2;
      });
    } else if (args.fileType === "xlsx") {
      primaryRecords = parseXlsxBuffer(xlsxBuffer!, errors);
      // Extract detected headers
      const wb = XLSX.read(xlsxBuffer!, { type: "array", cellDates: false });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const headerRows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[];
      if (headerRows[0]) {
        detectedColumns.push(...(headerRows[0] as any[]).map((h) => String(h).trim()).filter(Boolean));
      }
      // Validate XLSX records
      primaryRecords.forEach((record, idx) => {
        const validationIssues = validateRequiredFields(record, idx + 2);
        validationIssues.forEach(issue => {
          validationErrors.push({ row: idx + 2, ...issue });
        });
        record._validationRowNumber = idx + 2;
      });
    } else if (args.fileType === "json") {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) primaryRecords = parsed;
      else if (parsed.records && Array.isArray(parsed.records)) primaryRecords = parsed.records;
      if (primaryRecords[0]) detectedColumns.push(...Object.keys(primaryRecords[0]));
      // Validate JSON records
      primaryRecords.forEach((record, idx) => {
        const validationIssues = validateRequiredFields(record, idx + 2);
        validationIssues.forEach(issue => {
          validationErrors.push({ row: idx + 2, ...issue });
        });
        record._validationRowNumber = idx + 2;
      });
    } else {
      throw new Error(`Unsupported file type: ${args.fileType}`);
    }

    const dependentCount = primaryRecords.reduce((sum, p) => sum + (p.dependents?.length ?? 0), 0);
    const recordsWithValidationIssues = new Set(
      validationErrors.map((e) => e.row)
    ).size;

    const sampleRecords = primaryRecords.slice(0, 5).map((p) => {
      const recordValidationIssues = validationErrors.filter(
        (e) => e.row === p._validationRowNumber
      ).length;
      return {
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
        dateOfBirth: p.dateOfBirth,
        effectiveDate: p.effectiveDate,
        dependentCount: p.dependents?.length ?? 0,
        validationIssues: recordValidationIssues > 0 ? recordValidationIssues : undefined,
      };
    });

    return {
      primaryCount: primaryRecords.length,
      dependentCount,
      sampleRecords,
      detectedColumns,
      errors: errors.slice(0, 50),
      errorCount: errors.length,
      validationErrors: validationErrors.slice(0, 100),
      validationErrorCount: validationErrors.length,
      recordsWithValidationIssues,
      tooLarge: primaryRecords.length > MAX_PRIMARY_RECORDS,
      maxRecords: MAX_PRIMARY_RECORDS,
    };
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
 * Reset per-file counters before (re-)processing so progress is accurate.
 */
export const resetFileCounters = mutation({
  args: { fileId: v.id("eligibilityFiles") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.fileId, {
      processedRecords: 0,
      errorRecords: 0,
      newMembers: 0,
      updatedMembers: 0,
      terminatedMembers: 0,
      errors: [],
    });
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
        title: v.string(),
        firstName: v.string(),
        middleName: v.string(),
        lastName: v.string(),
        suffix: v.string(),
        email: v.string(),
        phone: v.string(),
        workPhone: v.string(),
        dateOfBirth: v.string(),
        effectiveDate: v.string(),
        gender: v.string(),
        uniqueId: v.string(), // Careington/DialCare Unique ID (empty string if not in source file)
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

    // Count total dependents so we can reserve enough IDs for primaries + all dependents
    const totalDependents = args.records.reduce(
      (sum, r) => sum + (Array.isArray(r.dependents) ? r.dependents.length : 0),
      0
    );
    const idStart = await reserveCounterRange(ctx, "memberIdSeq", args.records.length + totalDependents);
    // depIdOffset tracks which slot in the reserved range is next for a dependent
    let depIdOffset = args.records.length;

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
        // Warn but don't hard-fail — some census imports have name+DOB only.
        // The member will be created with no contact info.
        results.errors.push({ rowIndex, message: `Row ${rowIndex + 1}: no email or phone — member created without contact info` });
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

        // Also match by Careington Unique ID (seqNum "00" = primary)
        if (!existing && record.uniqueId) {
          const sameUniqueId = await ctx.db
            .query("memberProfiles")
            .withIndex("by_careington_id", (q: any) =>
              q.eq("careingtonUniqueId", record.uniqueId)
            )
            .collect();
          existing = sameUniqueId.find((m: any) => (m.careingtonSeqNum ?? "00") === "00") ?? null;
        }

        // Normalize gender
        const genderLower = (record.gender || "").toLowerCase();
        const validGender = (["male", "female", "non_binary", "prefer_not_to_say", "other"].includes(genderLower))
          ? (genderLower as any)
          : undefined;

        // Build the embedded dependents snapshot (still kept on primary for vendor file generation)
        const dependents = Array.isArray(record.dependents) && record.dependents.length > 0
          ? record.dependents.map((d: any, di: number) => {
              const depSeqNum = d.seqNum ?? String(di + 1).padStart(2, "0");
              return {
                firstName: d.firstName,
                lastName: d.lastName,
                dateOfBirth: d.dateOfBirth || undefined,
                relationship: d.relationship || "other",
                seqNum: depSeqNum,
                toothlensMemberId: record.uniqueId ? record.uniqueId + depSeqNum : undefined,
              };
            })
          : undefined;

        let primaryProfileId: any;
        let careingtonUniqueId: string;

        if (existing) {
          // ── Update existing primary member ──
          careingtonUniqueId = record.uniqueId || (existing as any).careingtonUniqueId;
          await ctx.db.patch(existing._id, {
            title: record.title || existing.title,
            firstName: record.firstName,
            middleName: record.middleName || existing.middleName,
            lastName: record.lastName,
            suffix: record.suffix || existing.suffix,
            email: record.email || existing.email,
            phone: record.phone || existing.phone,
            workPhone: record.workPhone || existing.workPhone,
            dateOfBirth: record.dateOfBirth || existing.dateOfBirth,
            effectiveDate: record.effectiveDate || existing.effectiveDate,
            gender: validGender ?? existing.gender,
            address: record.address || existing.address,
            dependents: dependents ?? existing.dependents,
            careingtonUniqueId,
            careingtonSeqNum: "00",
            toothlensMemberId: careingtonUniqueId + "00",
            eligibilityFileId: args.fileId,
            updatedAt: now,
          });
          primaryProfileId = existing._id;
          results.updated++;
        } else {
          // ── Create new primary member with atomic counter-based ID ──
          const seqNum = idStart + i;
          const memberId = `MBR-${String(seqNum)}`;
          const year = String(new Date().getFullYear()).slice(2);
          const random = Math.random().toString(36).substring(2, 8).toUpperCase();
          const barcode = `ELG${year}${random}`;

          // If no uniqueId came from the source file, auto-generate one
          careingtonUniqueId = record.uniqueId || String(seqNum).padStart(10, "0");

          const created = await createMemberProfile(ctx, {
            groupId: args.groupId,
            memberIdOverride: memberId,
            barcodeOverride: barcode,
            title: record.title || undefined,
            firstName: record.firstName,
            middleName: record.middleName || undefined,
            lastName: record.lastName,
            suffix: record.suffix || undefined,
            email: record.email || undefined,
            phone: record.phone || undefined,
            workPhone: record.workPhone || undefined,
            dateOfBirth: record.dateOfBirth || undefined,
            effectiveDate: record.effectiveDate || undefined,
            gender: validGender,
            address: record.address,
            dependents,
            careingtonUniqueId,
            careingtonSeqNum: "00",
            memberType: "eligible",
            eligibilityFileId: args.fileId,
          });
          primaryProfileId = created._id;
          results.created++;
        }

        // ── Create/update a separate memberProfile for each dependent ──
        if (Array.isArray(record.dependents) && record.dependents.length > 0) {
          for (let di = 0; di < record.dependents.length; di++) {
            const dep = record.dependents[di] as any;
            const depSeqNum: string = dep.seqNum ?? String(di + 1).padStart(2, "0");

            // Find existing dependent profile: same Careington ID + same seqNum
            const existingWithSameUniqueId = await ctx.db
              .query("memberProfiles")
              .withIndex("by_careington_id", (q: any) =>
                q.eq("careingtonUniqueId", careingtonUniqueId)
              )
              .collect();
            let existingDep: any = existingWithSameUniqueId.find(
              (m: any) => m.careingtonSeqNum === depSeqNum
            ) ?? null;

            // Fall back to email match within the group
            if (!existingDep && dep.email) {
              existingDep = await ctx.db
                .query("memberProfiles")
                .withIndex("by_group_email", (q: any) =>
                  q.eq("groupId", args.groupId).eq("email", dep.email)
                )
                .first();
            }

            const depGenderLower = (dep.gender || "").toLowerCase();
            const depGender = (["male", "female", "non_binary", "prefer_not_to_say", "other"].includes(depGenderLower))
              ? (depGenderLower as any)
              : undefined;

            if (existingDep) {
              await ctx.db.patch(existingDep._id, {
                firstName: dep.firstName,
                lastName: dep.lastName,
                email: dep.email || existingDep.email,
                phone: dep.phone || existingDep.phone,
                address: dep.address || existingDep.address,
                dateOfBirth: dep.dateOfBirth || existingDep.dateOfBirth,
                gender: depGender ?? existingDep.gender,
                relationship: dep.relationship || existingDep.relationship,
                primaryMemberId: primaryProfileId,
                memberRole: "dependent",
                careingtonUniqueId,
                careingtonSeqNum: depSeqNum,
                toothlensMemberId: careingtonUniqueId + depSeqNum,
                eligibilityFileId: args.fileId,
                updatedAt: now,
              });
            } else {
              const depSeq = idStart + depIdOffset;
              depIdOffset++;
              const depMemberId = `MBR-${String(depSeq)}`;
              const depYear = String(new Date().getFullYear()).slice(2);
              const depRandom = Math.random().toString(36).substring(2, 8).toUpperCase();
              const depBarcode = `ELG${depYear}${depRandom}`;

              await createMemberProfile(ctx, {
                groupId: args.groupId,
                memberIdOverride: depMemberId,
                barcodeOverride: depBarcode,
                firstName: dep.firstName,
                lastName: dep.lastName,
                email: dep.email || undefined,
                phone: dep.phone || undefined,
                address: dep.address,
                dateOfBirth: dep.dateOfBirth || undefined,
                gender: depGender,
                careingtonUniqueId,
                careingtonSeqNum: depSeqNum,
                memberType: "eligible",
                memberRole: "dependent",
                relationship: dep.relationship || "other",
                primaryMemberId: primaryProfileId,
                eligibilityFileId: args.fileId,
              });
            }
          }
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

      // Collect all error objects so the UI can display them.
      // Schema shape: { row: number, field?: string, message: string }
      const allErrorObjects: Array<{ row: number; field?: string; message: string }> = [
        ...args.parseErrors.map((e) => ({ row: e.row, message: e.message })),
        ...results.errors.map((e) => ({
          row: e.rowIndex ?? -1,
          message: typeof e.message === "string"
            ? e.message
            : `${e.error ?? JSON.stringify(e)}`,
        })),
      ];

      // Carry forward any errors already saved by earlier batches.
      const existingErrors: Array<{ row: number; field?: string; message: string }> =
        updatedFile?.errors ?? [];

      await ctx.db.patch(args.fileId, {
        status: finalStatus,
        completedAt: Date.now(),
        errors: [...existingErrors, ...allErrorObjects].slice(0, 200), // cap at 200
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

          await createMemberProfile(ctx, {
            groupId: file.groupId,
            memberIdOverride: memberId,
            barcodeOverride: barcode,
            firstName: record.firstName,
            lastName: record.lastName,
            email: record.email,
            phone: record.phone,
            dateOfBirth: record.dateOfBirth,
            gender: validGender,
            memberType: "eligible",
            eligibilityFileId: args.fileId,
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
