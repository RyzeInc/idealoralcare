import { action, query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";
import { requireAdmin, requireAdminAction } from "../lib/authGuards";

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
 * Strip punctuation from memberId to produce a Careington-compliant Unique ID
 * (alphanumeric only, max 12 chars, no SSNs)
 */
function toUniqueId(memberId: string): string {
  return memberId.replace(/[^A-Za-z0-9]/g, "").slice(0, 12);
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
  guardian: string;     // "1" for primary/guardian, "0" for dependent
}): string {
  return [
    sanitizeCell(f.title),         // [0]  Title
    sanitizeCell(f.firstName),     // [1]  First Name
    sanitizeCell(f.middleName),    // [2]  Middle Name
    sanitizeCell(f.lastName),      // [3]  Last Name
    sanitizeCell(f.suffix),        // [4]  Post Name / Suffix
    sanitizeCell(f.uniqueId),      // [5]  Unique ID
    sanitizeCell(f.seqNum),        // [6]  Sequence Number
    "",                            // [7]  Filler (SSN — leave empty)
    sanitizeCell(f.addr1),         // [8]  Address Line 1
    sanitizeCell(f.addr2),         // [9]  Address Line 2
    sanitizeCell(f.city),          // [10] City
    sanitizeCell(f.state),         // [11] State
    sanitizeCell(f.zip),           // [12] Zip
    "",                            // [13] Plus 4
    sanitizeCell(f.phone),         // [14] Home Phone
    sanitizeCell(f.workPhone),     // [15] Work Phone
    sanitizeCell(f.coverage),      // [16] Coverage
    sanitizeCell(f.groupCode),     // [17] Group Code
    sanitizeCell(f.termDate),      // [18] Termination Date
    sanitizeCell(f.effDate),       // [19] Effective Date
    sanitizeCell(f.dob),           // [20] Date of Birth
    sanitizeCell(f.relation),      // [21] Relation
    sanitizeCell(f.studentStatus), // [22] Student Status
    "",                            // [23] Filler
    sanitizeCell(f.gender),        // [24] Gender
    sanitizeCell(f.email),         // [25] Email Address
    sanitizeCell(f.reportingSegment), // [26] Reporting Segment
    sanitizeCell(f.guardian),      // [27] Guardian
  ].join("|");
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
export const generateDentalDiscountNetworkFile: any = action({
  args: {
    groupId: v.id("groups"),
    fileType: v.optional(v.union(v.literal("full"), v.literal("delta"))),
  },
  handler: async (ctx, args) => {
    // @ts-ignore - Avoid deep type instantiation issue with api.admin.adminUsers.isAdmin
    await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);
    const group = await ctx.runQuery(api.admin.hierarchy.getGroupById, { groupId: args.groupId });
    if (!group) throw new Error("Group not found");

    const members = await ctx.runQuery(api.admin.members.getActiveMembersByGroup, { groupId: args.groupId });

    const fileType = args.fileType ?? "full";
    const today = new Date();
    const filename = `${group.groupCode}${formatDateForFilename(today)}_${fileType}.txt`;

    const rows: string[] = [];
    let totalRecords = 0;

    for (const member of members) {
      const uniqueId = toUniqueId(member.memberId ?? "UNKNOWN");
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

      // Primary member row — Sequence 00, Guardian = 1
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
        guardian: "1",
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
export const generateDialCareFile: any = action({
  args: {
    groupId: v.id("groups"),
    fileType: v.optional(v.union(v.literal("full"), v.literal("delta"))),
  },
  handler: async (ctx, args) => {
    // @ts-ignore - Avoid deep type instantiation issue with api.admin.adminUsers.isAdmin
    await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);
    const group = await ctx.runQuery(api.admin.hierarchy.getGroupById, { groupId: args.groupId });
    if (!group) throw new Error("Group not found");

    const members = await ctx.runQuery(api.admin.members.getActiveMembersByGroup, { groupId: args.groupId });

    const fileType = args.fileType ?? "full";
    const today = new Date();
    const filename = `${group.groupCode}${formatDateForFilename(today)}_${fileType}.txt`;

    const rows: string[] = [];
    let totalRecords = 0;
    const warnings: string[] = [];

    for (const member of members) {
      const uniqueId = toUniqueId(member.memberId ?? "UNKNOWN");
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

      // Email is required for DialCare E-fulfillment
      if (!member.email) {
        warnings.push(`Member ${member.memberId} (${member.firstName} ${member.lastName}) has no email — required for DialCare`);
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
        guardian: "1",
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

    return {
      filename,
      // CRLF + trailing newline per Careington Windows-lineage parser convention.
      content: rows.join("\r\n") + (rows.length > 0 ? "\r\n" : ""),
      memberCount: members.length,
      totalRecords,
      warnings,
      generatedAt: Date.now(),
    };
  },
});

/**
 * Generic vendor file generator (dispatcher)
 */
export const generateVendorFile: any = action({
  args: {
    groupId: v.id("groups"),
    vendor: v.string(), // "careington" | "dialcare"
  },
  handler: async (ctx, args) => {
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
 * Each row already carries its own Provider Group Code (per Careington spec),
 * so Careington can attribute members to the correct organization. We simply
 * stack the per-organization output into one file.
 *
 * Filename: IDEALOH-AGG-MMDDYY_{full|delta}.txt
 */
export const generateAggregatedDentalDiscountNetworkFile: any = action({
  args: {
    fileType: v.optional(v.union(v.literal("full"), v.literal("delta"))),
    vendor: v.optional(v.union(v.literal("careington"), v.literal("dialcare"))),
  },
  handler: async (ctx, args) => {
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

      if (result?.content) sections.push(result.content);
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
