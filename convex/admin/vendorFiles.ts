import { action, query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";
import { requireAdmin, requireAdminAction } from "../lib/authGuards";
import { PROVIDER_GROUP_CODE } from "../lib/constants";

/**
 * VENDOR FILE GENERATION
 *
 * Generate CSV files for vendor eligibility feeds:
 * - Dental Discount Network (dental discounts)
 * - Dial Care (teledentistry)
 */

/**
 * Format date as YYYY-MM-DD (used by DialCare file)
 */
function formatDateForVendor(date: Date | number): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Format date as MMDDYYYY with leading zeros — required by Careington spec
 */
function formatDateCareington(d: Date): string {
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${month}${day}${year}`;
}

/**
 * Format date as MMDDYY for the Careington filename convention
 */
function formatDateForFilename(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const year = String(d.getFullYear()).slice(2);
  return `${month}${day}${year}`;
}

/**
 * Snap an enrollment timestamp to the first of the applicable month per Careington rules:
 *   Day 1–15  → 1st of current month
 *   Day 16–EOM → 1st of next month
 */
function snapToFirstOfMonth(timestamp: number): Date {
  const d = new Date(timestamp);
  const day = d.getUTCDate();
  if (day <= 15) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  } else {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  }
}

/**
 * Derive the Careington/DialCare Unique ID from an internal memberId.
 *
 * IMPORTANT: This ID is ASSIGNED BY US (Ideal Health) and reported to Careington
 * in the outbound eligibility file. Careington does not assign it.
 *
 * Rules per Careington spec:
 * - Numeric digits only (spec preferred; max 12 characters)
 * - No punctuation or special characters (dashes, spaces, etc.)
 *
 * Only used as a fallback when careingtonUniqueId is not yet stored on the profile.
 * The same derivation logic is used in getMemberCardDataPublic (subscriptions/queries.ts)
 * so the member-facing ID always matches what we send in the eligibility file.
 */
function toUniqueId(memberId: string): string {
  return memberId.replace(/[^0-9]/g, "").slice(0, 12);
}

/**
 * Truncate a sanitized cell value to the field's Careington max length.
 * Applied after sanitizeCell so the result is never longer than the column allows.
 */
function trunc(value: string, maxLen: number): string {
  return value.slice(0, maxLen);
}

/**
 * Sanitize a cell value for the pipe-delimited file.
 *
 * Careington Eligibility Guide — Appendix A (Page 6) requires:
 *   - No #NULL! tokens (Excel artifacts) — represent missing data with empty cells.
 *   - No special characters that would corrupt the row.
 *
 * Practically that means stripping:
 *   - The literal pipe character '|' (would inject a phantom column)
 *   - Carriage returns / line feeds (would split a row in two)
 *   - The string "#NULL!" (Excel-empty-cell artifact)
 *   - Tab characters
 */
function sanitizeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (s === "#NULL!" || s === "#N/A" || s === "NULL" || s === "null" || s === "undefined") return "";
  // Strip pipes, CR/LF, tabs, and the literal #NULL! anywhere it appears
  s = s.replace(/#NULL!/g, "");
  s = s.replace(/[|\r\n\t]/g, " ");
  // Collapse runs of whitespace and trim
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/**
 * Build one pipe-delimited Careington eligibility row.
 *
 * Column order (Version CI007, 07/21/2025):
 * Title | FirstName | MiddleName | LastName | PostName | UniqueID | SeqNum |
 * Filler(SSN) | Addr1 | Addr2 | City | State | Zip | Plus4 | HomePhone | WorkPhone |
 * Coverage | GroupCode | TermDate | EffDate | DOB |
 * Relation | StudentStatus | Filler | Gender | Email | ReportingSegment | Guardian
 *
 * 28 pipe-delimited fields per row (indices 0-27).
 *
 * Every field is run through `sanitizeCell` so embedded pipes / CRLFs / #NULL!
 * artifacts can never corrupt the file (per Eligibility Guide §Appendix A).
 */
function buildCareingtonRow(f: {
  title: string;
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  uniqueId: string;
  seqNum: string;       // "00" for primary, "01"/"02"... for dependents
  addr1: string;
  addr2: string;
  city: string;
  state: string;
  zip: string;          // 5-digit, numeric only
  phone: string;        // 10-digit, numeric only
  workPhone: string;    // 10-digit, numeric only
  coverage: string;     // MF | MO | MD | MS
  groupCode: string;
  termDate: string;     // MMDDYYYY or empty
  effDate: string;      // MMDDYYYY
  dob: string;          // MMDDYYYY
  relation: string;     // empty for primary; C | S | O for dependents
  studentStatus: string;// empty for primary; Y | N for dependents
  gender: string;       // M | F | empty
  email: string;
  reportingSegment: string;
  // "1" = this person is a legal guardian/caregiver for someone else on the plan
  // (a relationship we do not currently track). Our primary members are simply
  // account holders and their dependents are simply dependents — neither is a
  // "guardian" in the Careington sense, so this must always be "0" for now.
  guardian: string;
}): string {
  return [
    trunc(sanitizeCell(f.title), 3),              // [0]  Title             max 3
    trunc(sanitizeCell(f.firstName), 15),         // [1]  First Name        max 15
    trunc(sanitizeCell(f.middleName), 1),         // [2]  Middle Name       max 1 (initial)
    trunc(sanitizeCell(f.lastName), 20),          // [3]  Last Name         max 20
    trunc(sanitizeCell(f.suffix), 4),             // [4]  Post Name/Suffix  max 4
    trunc(sanitizeCell(f.uniqueId), 12),          // [5]  Unique ID         max 12, numeric
    trunc(sanitizeCell(f.seqNum), 2),             // [6]  Sequence Number   max 2
    "",                                            // [7]  Filler (SSN — leave empty per CI007)
    trunc(sanitizeCell(f.addr1), 33),             // [8]  Address Line 1   max 33
    trunc(sanitizeCell(f.addr2), 33),             // [9]  Address Line 2   max 33
    trunc(sanitizeCell(f.city), 21),              // [10] City             max 21
    trunc(sanitizeCell(f.state), 2),              // [11] State            max 2
    trunc(sanitizeCell(f.zip), 5),                // [12] Zip              max 5, numeric
    "",                                            // [13] Plus 4 (omitted — not collected)
    trunc(sanitizeCell(f.phone), 10),             // [14] Home Phone       max 10, numeric
    trunc(sanitizeCell(f.workPhone), 10),         // [15] Work Phone       max 10, numeric
    trunc(sanitizeCell(f.coverage), 2),           // [16] Coverage         max 2 (MF/MO/MD/MS)
    trunc(sanitizeCell(f.groupCode), 10),         // [17] Group Code       max 10
    trunc(sanitizeCell(f.termDate), 8),           // [18] Term Date        max 8, MMDDYYYY
    trunc(sanitizeCell(f.effDate), 8),            // [19] Effective Date   max 8, MMDDYYYY
    trunc(sanitizeCell(f.dob), 8),                // [20] Date of Birth    max 8, MMDDYYYY
    trunc(sanitizeCell(f.relation), 1),           // [21] Relation         max 1 (C/S/O; blank=primary)
    trunc(sanitizeCell(f.studentStatus), 1),      // [22] Student Status   max 1 (Y/N; blank=primary)
    "",                                            // [23] Filler (per CI007)
    trunc(sanitizeCell(f.gender), 1),             // [24] Gender           max 1 (M/F)
    trunc(sanitizeCell(f.email), 64),             // [25] Email Address    max 64
    trunc(sanitizeCell(f.reportingSegment), 100), // [26] Reporting Seg    max 100
    trunc(sanitizeCell(f.guardian), 1),           // [27] Guardian         max 1 (0=No/1=Yes)
  ].join("|");
}

/**
 * Pre-export structural validator for Careington pipe-delimited rows.
 *
 * Runs before any file is returned to the caller and blocks the download on hard errors.
 * Checks:
 *   1. Every row has exactly 28 fields (27 pipes).
 *   2. No duplicate (UniqueID, SeqNum, GroupCode) tuple.
 *   3. Exactly one seqNum="00" primary row per (UniqueID, GroupCode) household.
 *   4. No row should be marked guardian="1" — we do not track legal-guardian
 *      relationships, so neither primary members nor dependents qualify.
 *   5. When requireEmail=true (DialCare), primary rows must have a non-empty email.
 */
function validateCareingtonRows(
  rows: string[],
  opts: { requireEmail?: boolean } = {}
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const REQUIRED_FIELDS = 28;
  const seenTuples = new Set<string>();
  const primaryCountByHousehold = new Map<string, number>();

  rows.forEach((row, idx) => {
    if (!row.trim()) return;
    const fields = row.split("|");
    const lineNum = idx + 1;

    if (fields.length !== REQUIRED_FIELDS) {
      errors.push(
        `Row ${lineNum}: expected ${REQUIRED_FIELDS} fields, found ${fields.length}`
      );
      return; // cannot safely read specific columns on a malformed row
    }

    const uniqueId  = fields[5];
    const seqNum    = fields[6];
    const groupCode = fields[17];
    const email     = fields[25];
    const guardian  = fields[27];

    // Rule: unique (UniqueID, SeqNum, GroupCode) tuple
    const tuple = `${uniqueId}|${seqNum}|${groupCode}`;
    if (seenTuples.has(tuple)) {
      errors.push(
        `Row ${lineNum}: duplicate tuple — UniqueID=${uniqueId} SeqNum=${seqNum} GroupCode=${groupCode}`
      );
    }
    seenTuples.add(tuple);

    // Count primary (seqNum=00) rows per household for the household-rule check below
    if (seqNum === "00") {
      const key = `${uniqueId}|${groupCode}`;
      primaryCountByHousehold.set(key, (primaryCountByHousehold.get(key) ?? 0) + 1);
    }

    // Rule: no row should be marked as guardian — we don't track legal-guardian
    // relationships, so this must always be "0" (primary or dependent alike).
    if (guardian === "1") {
      warnings.push(
        `Row ${lineNum}: UniqueID=${uniqueId} SeqNum=${seqNum} — marked guardian="1" but guardian should always be "0"`
      );
    }

    // Rule: DialCare/e-fulfillment requires email on primary rows
    if (opts.requireEmail && seqNum === "00" && !email) {
      errors.push(
        `Row ${lineNum}: UniqueID=${uniqueId} — primary member has no email (required for DialCare)`
      );
    }
  });

  // Rule: exactly one primary row per household
  for (const [key, count] of primaryCountByHousehold) {
    if (count > 1) {
      const [uid, gc] = key.split("|");
      errors.push(
        `Household UniqueID=${uid} GroupCode=${gc}: ${count} primary (seqNum=00) rows — expected exactly 1`
      );
    }
  }

  return { errors, warnings };
}

/**
 * Get vendor configurations
 */
export const getVendorConfigurations = query({
  handler: async (ctx) => {
    return [
      {
        vendor: "Dental Discount Network",
        lastGenerated: Date.now() - 86400000, // 1 day ago
        lastDelivered: Date.now() - 86400000,
        status: "ready" as const,
      },
      {
        vendor: "Dial Care",
        lastGenerated: Date.now() - 86400000,
        lastDelivered: null,
        status: "ready" as const,
      },
    ];
  },
});

/**
 * Get a preview of members that will be included in a vendor file for a specific group.
 * Shows which users will be added to the generation before actually generating.
 */
export const getVendorFilePreview = query({
  args: {
    groupId: v.id("groups"),
  },
  handler: async (ctx, args): Promise<any> => {
    const group: any = await ctx.runQuery(api.admin.hierarchy.getGroupById, { groupId: args.groupId });
    if (!group) throw new Error("Group not found");

    const allMembers: any[] = await ctx.runQuery(api.admin.members.getActiveMembersByGroup, { groupId: args.groupId });
    // Preview should only show primary households (same logic as the generators) to
    // avoid inflated counts from separately-stored dependent memberProfile rows.
    const members = allMembers.filter((m: any) => m.memberRole !== "dependent" && !m.primaryMemberId);

    // Build a preview of members with full dependent details
    const preview = members.map((member: any) => ({
      memberId: member.memberId,
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email,
      memberType: member.memberType,
      dependentCount: (member.dependents ?? []).length,
      totalRecords: 1 + (member.dependents ?? []).length, // primary + dependents
      dependents: (member.dependents ?? []).map((dep: any) => ({
        firstName: dep.firstName,
        lastName: dep.lastName,
        relationship: dep.relationship,
        dateOfBirth: dep.dateOfBirth,
      })),
    }));

    return {
      groupId: args.groupId,
      groupCode: group.groupCode,
      organizationName: group.name || group.slug,
      totalMembers: members.length,
      totalRecords: members.reduce((sum: number, m: any) => sum + 1 + (m.dependents ?? []).length, 0),
      members: preview,
    };
  },
});

/**
 * Generate Careington-format eligibility file (pipe-delimited .txt)
 *
 * Implements the Careington Electronic Eligibility spec (Version CI007, 07/21/2025):
 * - Pipe-delimited, no quotes
 * - Filename: {GROUPCODE}{MMDDYY}_full.txt (or _delta.txt)
 * - Dates in MMDDYYYY format with leading zeros
 * - Effective dates snapped to first of month per Careington rounding rules
 * - Dependents included with same Unique ID, incrementing sequence numbers
 * - Full file only contains active members; terminated members are termed by absence
 */
export const generateDentalDiscountNetworkFile = action({
  args: {
    groupId: v.id("groups"),
    fileType: v.optional(v.union(v.literal("full"), v.literal("delta"))),
  },
  handler: async (ctx, args): Promise<{ filename: string; content: string; memberCount: number; totalRecords: number; generatedAt: number }> => {
    // @ts-ignore - Avoid deep type instantiation issue with api.admin.adminUsers.isAdmin
    await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);
    const group = await ctx.runQuery(api.admin.hierarchy.getGroupById, { groupId: args.groupId });
    if (!group) throw new Error("Group not found");

    const allMembers = await ctx.runQuery(api.admin.members.getActiveMembersByGroup, { groupId: args.groupId });
    // Export only primary-role profiles. Dependent memberProfile rows are also stored
    // separately so they can be looked up by ID, but the exporter already emits them
    // via each primary's embedded `dependents` array. Without this filter, every
    // dependent profile would also appear as a bogus seqNum=00 primary, triggering
    // Careington's "Duplicate Policy Numbers" rejection.
    const members = allMembers.filter((m: any) => m.memberRole !== "dependent" && !m.primaryMemberId);

    const fileType = args.fileType ?? "full";
    const today = new Date();
    const filename = `${group.groupCode}${formatDateForFilename(today)}_${fileType}.txt`;

    const rows: string[] = [];
    let totalRecords = 0;

    for (const member of members) {
      // Prefer the stored Careington Unique ID (set when member was imported from eligibility file);
      // fall back to a derived ID for members enrolled directly (DTC, admin-added, etc.)
      const uniqueId = (member as any).careingtonUniqueId ?? toUniqueId(member.memberId ?? "UNKNOWN");
      const dependents = member.dependents ?? [];
      const hasDependents = dependents.length > 0;

      // Primary member coverage: MF if family on plan, MO if member only
      const coverage = hasDependents ? "MF" : "MO";

      // Effective date: use stored effectiveDate if available, else snap enrollment date to first of month
      let effDate: string;
      if (member.effectiveDate) {
        effDate = formatDateCareington(new Date(member.effectiveDate + "T00:00:00Z"));
      } else {
        const rawEff = member.enrolledAt ?? member.createdAt ?? Date.now();
        effDate = formatDateCareington(snapToFirstOfMonth(rawEff));
      }

      const dob = member.dateOfBirth
        ? formatDateCareington(new Date(member.dateOfBirth + "T00:00:00Z"))
        : "";

      const addr = member.address;
      const zip = (addr?.postalCode ?? "").replace(/\D/g, "").slice(0, 5);
      const phone = (member.phone ?? "").replace(/\D/g, "").slice(0, 10);
      const workPhone = (member.workPhone ?? "").replace(/\D/g, "").slice(0, 10);
      const gender = member.gender === "male" ? "M" : member.gender === "female" ? "F" : "";

      // Primary member row — Sequence 00, Guardian = 0 (account holder, not a legal guardian)
      rows.push(buildCareingtonRow({
        title: member.title ?? "",
        firstName: member.firstName,
        middleName: member.middleName ?? "",
        lastName: member.lastName,
        suffix: member.suffix ?? "",
        uniqueId,
        seqNum: "00",
        addr1: addr?.line1 ?? "",
        addr2: addr?.line2 ?? "",
        city: addr?.city ?? "",
        state: addr?.state ?? "",
        zip,
        phone,
        workPhone,
        coverage,
        groupCode: group.groupCode,
        termDate: "",   // active members only; terminated are absent from full file
        effDate,
        dob,
        relation: "",       // empty pipe for primary
        studentStatus: "",  // empty pipe for primary
        gender,
        email: member.email ?? "",
        reportingSegment: "",
        guardian: "0",
      }));
      totalRecords++;

      // Dependent rows — same Unique ID, sequence 01/02/..., Guardian = 0
      dependents.forEach((dep: any, idx: number) => {
        const seqNum = String(idx + 1).padStart(2, "0");
        const depDob = dep.dateOfBirth
          ? formatDateCareington(new Date(dep.dateOfBirth + "T00:00:00Z"))
          : "";

        // Coverage is the plan-level coverage type (same as primary)
        let relation: string;
        switch (dep.relationship) {
          case "spouse":
          case "domestic_partner":
            relation = "S";
            break;
          case "child":
            relation = "C";
            break;
          default:
            relation = "O";
        }

        rows.push(buildCareingtonRow({
          title: "",
          firstName: dep.firstName,
          middleName: "",
          lastName: dep.lastName,
          suffix: "",
          uniqueId,           // same as primary per Careington spec
          seqNum,
          addr1: addr?.line1 ?? "",  // use primary's address
          addr2: addr?.line2 ?? "",
          city: addr?.city ?? "",
          state: addr?.state ?? "",
          zip,
          phone,              // use primary's phone
          workPhone,
          coverage,           // same plan-level coverage as primary
          groupCode: group.groupCode,
          termDate: "",
          effDate,            // same effective date as primary
          dob: depDob,
          relation,
          studentStatus: "N", // default: not a full-time student
          gender: "",
          email: member.email ?? "",  // use primary's email
          reportingSegment: "",
          guardian: "0",
        }));
        totalRecords++;
      });
    }

    // Pre-export structural validation — block download before a bad file reaches Careington
    const validation = validateCareingtonRows(rows);
    if (validation.errors.length > 0) {
      throw new Error(
        `Careington file failed pre-export validation (${validation.errors.length} error(s)):\n` +
        validation.errors.join("\n")
      );
    }

    return {
      filename,
      // CRLF + trailing newline per Careington Windows-lineage parser convention.
      content: rows.join("\r\n") + (rows.length > 0 ? "\r\n" : ""),
      memberCount: members.length,
      totalRecords,
      generatedAt: Date.now(),
    };
  },
});

/**
 * Generate DialCare eligibility file (Careington pipe-delimited format).
 *
 * DialCare is owned by Careington and uses the same pipe-delimited spec.
 * Email is REQUIRED for DialCare/E-fulfillment plans.
 * The only difference from the Dental Discount Network file is the group code
 * (DialCare has its own Careington-assigned group code).
 */
export const generateDialCareFile = action({
  args: {
    groupId: v.id("groups"),
    fileType: v.optional(v.union(v.literal("full"), v.literal("delta"))),
  },
  handler: async (ctx, args): Promise<{ filename: string; content: string; memberCount: number; totalRecords: number; warnings: string[]; generatedAt: number }> => {
    // @ts-ignore - Avoid deep type instantiation issue with api.admin.adminUsers.isAdmin
    await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);
    const group = await ctx.runQuery(api.admin.hierarchy.getGroupById, { groupId: args.groupId });
    if (!group) throw new Error("Group not found");

    const allMembersDialCare = await ctx.runQuery(api.admin.members.getActiveMembersByGroup, { groupId: args.groupId });
    // Same primary-only filter as the DDN generator (see comment there).
    const members = allMembersDialCare.filter((m: any) => m.memberRole !== "dependent" && !m.primaryMemberId);

    const fileType = args.fileType ?? "full";
    const today = new Date();
    const filename = `${group.groupCode}${formatDateForFilename(today)}_${fileType}.txt`;

    const rows: string[] = [];
    let totalRecords = 0;
    const warnings: string[] = [];

    for (const member of members) {
      const uniqueId = (member as any).careingtonUniqueId ?? toUniqueId(member.memberId ?? "UNKNOWN");
      const dependents = member.dependents ?? [];
      const hasDependents = dependents.length > 0;
      const coverage = hasDependents ? "MF" : "MO";

      // Effective date: use stored effectiveDate if available, else snap enrollment date
      let effDate: string;
      if (member.effectiveDate) {
        effDate = formatDateCareington(new Date(member.effectiveDate + "T00:00:00Z"));
      } else {
        const rawEff = member.enrolledAt ?? member.createdAt ?? Date.now();
        effDate = formatDateCareington(snapToFirstOfMonth(rawEff));
      }

      const dob = member.dateOfBirth
        ? formatDateCareington(new Date(member.dateOfBirth + "T00:00:00Z"))
        : "";

      const addr = member.address;
      const zip = (addr?.postalCode ?? "").replace(/\D/g, "").slice(0, 5);
      const phone = (member.phone ?? "").replace(/\D/g, "").slice(0, 10);
      const workPhone = (member.workPhone ?? "").replace(/\D/g, "").slice(0, 10);
      const gender = member.gender === "male" ? "M" : member.gender === "female" ? "F" : "";

      // Email is REQUIRED for DialCare E-fulfillment — missing email is a hard error,
      // not a warning, because Careington will reject the member at eligibility check time.
      if (!member.email) {
        warnings.push(`BLOCKING: Member ${member.memberId} (${member.firstName} ${member.lastName}) has no email — required for DialCare`);
      }

      rows.push(buildCareingtonRow({
        title: member.title ?? "",
        firstName: member.firstName,
        middleName: member.middleName ?? "",
        lastName: member.lastName,
        suffix: member.suffix ?? "",
        uniqueId,
        seqNum: "00",
        addr1: addr?.line1 ?? "",
        addr2: addr?.line2 ?? "",
        city: addr?.city ?? "",
        state: addr?.state ?? "",
        zip,
        phone,
        workPhone,
        coverage,
        groupCode: group.groupCode,
        termDate: "",
        effDate,
        dob,
        relation: "",
        studentStatus: "",
        gender,
        email: member.email ?? "",
        reportingSegment: "",
        guardian: "0",
      }));
      totalRecords++;

      dependents.forEach((dep: any, idx: number) => {
        const seqNum = String(idx + 1).padStart(2, "0");
        const depDob = dep.dateOfBirth
          ? formatDateCareington(new Date(dep.dateOfBirth + "T00:00:00Z"))
          : "";

        let relation: string;
        switch (dep.relationship) {
          case "spouse":
          case "domestic_partner":
            relation = "S";
            break;
          case "child":
            relation = "C";
            break;
          default:
            relation = "O";
        }

        rows.push(buildCareingtonRow({
          title: "",
          firstName: dep.firstName,
          middleName: "",
          lastName: dep.lastName,
          suffix: "",
          uniqueId,
          seqNum,
          addr1: addr?.line1 ?? "",
          addr2: addr?.line2 ?? "",
          city: addr?.city ?? "",
          state: addr?.state ?? "",
          zip,
          phone,
          workPhone,
          coverage,
          groupCode: group.groupCode,
          termDate: "",
          effDate,
          dob: depDob,
          relation,
          studentStatus: "N",
          gender: "",
          email: member.email ?? "",
          reportingSegment: "",
          guardian: "0",
        }));
        totalRecords++;
      });
    }

    // Pre-export structural validation (requireEmail=true enforces DialCare email rule at row level)
    const dialcareValidation = validateCareingtonRows(rows, { requireEmail: true });
    const blockingWarnings = warnings.filter((w) => w.startsWith("BLOCKING:"));
    const allErrors = [...dialcareValidation.errors, ...blockingWarnings];
    if (allErrors.length > 0) {
      throw new Error(
        `DialCare file failed pre-export validation (${allErrors.length} error(s)):\n` +
        allErrors.join("\n")
      );
    }

    return {
      filename,
      // CRLF + trailing newline per Careington Windows-lineage parser convention.
      content: rows.join("\r\n") + (rows.length > 0 ? "\r\n" : ""),
      memberCount: members.length,
      totalRecords,
      warnings: [...dialcareValidation.warnings, ...warnings.filter((w) => !w.startsWith("BLOCKING:"))],
      generatedAt: Date.now(),
    };
  },
});

/**
 * Generic vendor file generator (dispatcher)
 */
export const generateVendorFile = action({
  args: {
    groupId: v.id("groups"),
    vendor: v.string(), // "careington" | "dialcare"
  },
  handler: async (ctx, args): Promise<{ filename: string; content: string; memberCount: number; totalRecords: number; generatedAt: number; warnings?: string[] }> => {
    // @ts-ignore - Avoid deep type instantiation issue with api.admin.adminUsers.isAdmin
    await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);

    if (args.vendor === "careington") {
      // Delegate to generateDentalDiscountNetworkFile for spec-compliant output
      // @ts-ignore - generateDentalDiscountNetworkFile is typed as `any` and filtered out of the API type
      return await ctx.runAction(api.admin.vendorFiles.generateDentalDiscountNetworkFile, {
        groupId: args.groupId,
      });
    }

    if (args.vendor === "dialcare") {
      // DialCare uses the same Careington pipe-delimited format
      // @ts-ignore
      return await ctx.runAction(api.admin.vendorFiles.generateDialCareFile, {
        groupId: args.groupId,
      });
    }

    throw new Error(`Unknown vendor: ${args.vendor}`);
  },
});

/**
 * Store generated vendor file metadata for tracking
 */
export const recordVendorFileGeneration = mutation({
  args: {
    groupId: v.id("groups"),
    vendor: v.string(),
    filename: v.string(),
    memberCount: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    // Create a record for audit trail
    // Note: actual file content is stored in Convex _storage or returned to caller
    return {
      recordedAt: Date.now(),
      groupId: args.groupId,
      vendor: args.vendor,
      filename: args.filename,
      memberCount: args.memberCount,
    };
  },
});

/**
 * Replace the groupCode in a pipe-delimited Careington row with the configured
 * provider group code (PROVIDER_GROUP_CODE). Field 17 (0-indexed) is the
 * groupCode in the spec.
 *
 * CRITICAL: For aggregated files, ALL users must ALWAYS use the same provider
 * group code so no per-Organization identifier leaks to the vendor.
 */
function replaceGroupCodeWithProviderCode(row: string): string {
  const fields = row.split("|");
  if (fields.length >= 18) {
    // Field 17 (0-indexed) is the groupCode
    fields[17] = PROVIDER_GROUP_CODE;
  }
  return fields.join("|");
}

// Exported solely for unit-tests in convex/admin/vendorFiles.test.ts —
// asserts the per-org and aggregated Careington outputs differ only in the
// group-code column. Production code should keep using the file-local name.
export const __testOnly_replaceGroupCodeWithProviderCode = replaceGroupCodeWithProviderCode;

// Backwards-compatible alias kept temporarily; prefer replaceGroupCodeWithProviderCode.
const replaceGroupCodeWithIDEALDO = replaceGroupCodeWithProviderCode;

/**
 * Get vendor file generation history
 */
export const getVendorFileHistory = query({
  args: {
    groupId: v.id("groups"),
    vendor: v.string(),
  },
  handler: async (ctx, args) => {
    // Placeholder: in production, query from a vendorFileGeneration table
    return {
      groupId: args.groupId,
      vendor: args.vendor,
      lastGenerated: Date.now(),
      history: [],
    };
  },
});

/**
 * Generate an AGGREGATED Careington/DialCare eligibility file across ALL active
 * organizations (groups). Used for the monthly outbound batch where Ideal Health
 * forwards one consolidated file to Careington containing every org's members.
 *
 * CRITICAL REQUIREMENT: ALL rows in aggregated files ALWAYS use groupCode "IDEALDO".
 * This ensures no user data leaves our system with any groupcode other than IDEALDO.
 * Individual org groupCodes are stripped and replaced with IDEALDO during aggregation.
 *
 * Filename: IDEALOH-AGG-MMDDYY_{full|delta}.txt
 */
export const generateAggregatedDentalDiscountNetworkFile = action({
  args: {
    fileType: v.optional(v.union(v.literal("full"), v.literal("delta"))),
    vendor: v.optional(v.union(v.literal("careington"), v.literal("dialcare"))),
  },
  handler: async (ctx, args) => {
    // PARITY GUARANTEE: This action does NOT format rows itself — it
    // delegates each organization to `generateDentalDiscountNetworkFile`
    // (or `generateDialCareFile`) and only post-processes the result by
    // replacing each line's group-code column with the provider group code
    // via `replaceGroupCodeWithProviderCode`. As a result, the per-org and
    // aggregated outputs are byte-identical except for the group-code
    // column. Do not introduce alternate row-formatting logic here.
    // @ts-ignore - Avoid deep type instantiation issue with api.admin.adminUsers.isAdmin
    await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);
    const fileType = args.fileType ?? "full";
    const vendor = args.vendor ?? "careington";

    const groups: any[] = await ctx.runQuery(api.admin.hierarchy.getAllGroups);
    const activeGroups = groups.filter((g) => g.status === "active");

    const sections: string[] = [];
    let totalMembers = 0;
    let totalRecords = 0;
    const perOrg: Array<{ organizationCode?: string; groupCode: string; name: string; memberCount: number; totalRecords: number }> = [];
    const warnings: string[] = [];

    for (const group of activeGroups) {
      const result: any = vendor === "dialcare"
        // @ts-ignore
        ? await ctx.runAction(api.admin.vendorFiles.generateDialCareFile, { groupId: group._id, fileType })
        // @ts-ignore
        : await ctx.runAction(api.admin.vendorFiles.generateDentalDiscountNetworkFile, { groupId: group._id, fileType });

      if (result?.content) {
        // CRITICAL: Replace all groupCodes with IDEALDO in aggregated files
        const lines = result.content.split("\r\n").map((line: string) => 
          line.trim() ? replaceGroupCodeWithIDEALDO(line) : line
        );
        sections.push(lines.join("\r\n"));
      }
      totalMembers += result?.memberCount ?? 0;
      totalRecords += result?.totalRecords ?? 0;
      if (Array.isArray(result?.warnings)) warnings.push(...result.warnings);
      perOrg.push({
        organizationCode: group.organizationCode,
        groupCode: group.groupCode,
        name: group.name || group.slug,
        memberCount: result?.memberCount ?? 0,
        totalRecords: result?.totalRecords ?? 0,
      });
    }

    const today = new Date();
    const filename = `IDEALOH-AGG-${formatDateForFilename(today)}_${fileType}.txt`;

    return {
      filename,
      content: sections.join(""),
      memberCount: totalMembers,
      totalRecords,
      organizationCount: activeGroups.length,
      perOrg,
      warnings,
      generatedAt: Date.now(),
    };
  },
});
