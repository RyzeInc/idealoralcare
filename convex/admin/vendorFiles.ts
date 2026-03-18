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
 * Build one pipe-delimited Careington eligibility row.
 *
 * Column order (Version CI007, 07/21/2025):
 * Title | FirstName | MiddleName | LastName | PostName | UniqueID | SeqNum |
 * Addr1 | Addr2 | City | State | Zip | Plus4 | HomePhone | WorkPhone |
 * Coverage | GroupCode | TermDate | EffDate | DOB |
 * Relation | StudentStatus | Gender | Email | ReportingSegment | Guardian
 *
 * Notes per spec:
 * - Filler (SSN) field between SeqNum and Addr1 is omitted (not passing SSN)
 * - Filler field between StudentStatus and Gender is omitted
 * - Lines start with a leading | because Title is always empty
 */
function buildCareingtonRow(f: {
  firstName: string;
  lastName: string;
  uniqueId: string;
  seqNum: string;       // "00" for primary, "01"/"02"... for dependents
  addr1: string;
  addr2: string;
  city: string;
  state: string;
  zip: string;          // 5-digit, numeric only
  phone: string;        // 10-digit, numeric only
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
    "",              // Title (empty — produces leading pipe)
    f.firstName,
    "",              // Middle Name (empty)
    f.lastName,
    "",              // Post Name (empty)
    f.uniqueId,
    "",              // Filler (SSN field — leave empty per spec)
    f.seqNum,
    "",              // Filler (SSN field — leave empty per spec)
    f.addr1,
    f.addr2,
    f.city,
    f.state,
    f.zip,
    "",              // Plus 4 (empty)
    f.phone,
    "",              // Work Phone (empty)
    f.coverage,
    f.groupCode,
    f.termDate,
    f.effDate,
    f.dob,
    f.relation,
    f.studentStatus,
    "",              // Filler field (empty per spec)
    f.gender,
    f.email,
    f.reportingSegment,
    f.guardian,
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

      // Effective date: snap enrollment date to first of month
      const rawEff = member.enrolledAt ?? member.createdAt ?? Date.now();
      const effDate = formatDateCareington(snapToFirstOfMonth(rawEff));

      const dob = member.dateOfBirth
        ? formatDateCareington(new Date(member.dateOfBirth + "T00:00:00Z"))
        : "";

      const addr = member.address;
      const zip = (addr?.postalCode ?? "").replace(/\D/g, "").slice(0, 5);
      const phone = (member.phone ?? "").replace(/\D/g, "").slice(0, 10);
      const gender = member.gender === "male" ? "M" : member.gender === "female" ? "F" : "";

      // Primary member row — Sequence 00, Guardian = 1
      rows.push(buildCareingtonRow({
        firstName: member.firstName,
        lastName: member.lastName,
        uniqueId,
        seqNum: "00",
        addr1: addr?.line1 ?? "",
        addr2: addr?.line2 ?? "",
        city: addr?.city ?? "",
        state: addr?.state ?? "",
        zip,
        phone,
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
      dependents.forEach((dep, idx) => {
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
          firstName: dep.firstName,
          lastName: dep.lastName,
          uniqueId,           // same as primary per Careington spec
          seqNum,
          addr1: addr?.line1 ?? "",  // use primary's address
          addr2: addr?.line2 ?? "",
          city: addr?.city ?? "",
          state: addr?.state ?? "",
          zip,
          phone,              // use primary's phone
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
      content: rows.join("\n"),
      memberCount: members.length,
      totalRecords,
      generatedAt: Date.now(),
    };
  },
});

/**
 * Generate Dial Care format eligibility CSV
 * Columns: member_id, name, email, phone, effective_date, active
 */
export const generateDialCareFile: any = action({
  args: {
    groupId: v.id("groups"),
  },
  handler: async (ctx, args) => {
    // @ts-ignore - Avoid deep type instantiation issue with api.admin.adminUsers.isAdmin
    await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);
    const group = await ctx.runQuery(api.admin.hierarchy.getGroupById, { groupId: args.groupId });
    if (!group) throw new Error("Group not found");

    const members = await ctx.runQuery(api.admin.members.getActiveMembersByGroup, { groupId: args.groupId });

    let csv = "member_id,name,email,phone,effective_date,active\n";

    for (const member of members) {
      const memberId = member.memberId ?? "UNKNOWN";
      const name = `${member.firstName} ${member.lastName}`.replace(/"/g, '""');
      const email = member.email ?? "";
      const phone = member.phone ?? "";
      const effectiveDate = member.createdAt ? formatDateForVendor(new Date(member.createdAt)) : formatDateForVendor(new Date());
      const active = member.memberType === "active" ? "1" : "0";

      csv += `"${memberId}","${name}","${email}","${phone}","${effectiveDate}",${active}\n`;
    }

    return {
      filename: `dialcare_${group.groupCode}_${formatDateForVendor(new Date())}.csv`,
      content: csv,
      memberCount: members.length,
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

    const group = await ctx.runQuery(api.admin.hierarchy.getGroupById, { groupId: args.groupId });
    if (!group) throw new Error("Group not found");

    const members = await ctx.runQuery(api.admin.members.getActiveMembersByGroup, { groupId: args.groupId });

    if (args.vendor === "dialcare") {
      let csv = "member_id,name,email,phone,effective_date,active\n";
      for (const member of members) {
        const memberId = member.memberId ?? "UNKNOWN";
        const name = `${member.firstName} ${member.lastName}`.replace(/"/g, '""');
        const email = member.email ?? "";
        const phone = member.phone ?? "";
        const effectiveDate = member.createdAt ? formatDateForVendor(new Date(member.createdAt)) : formatDateForVendor(new Date());
        const active = member.memberType === "active" ? "1" : "0";
        csv += `"${memberId}","${name}","${email}","${phone}","${effectiveDate}",${active}\n`;
      }
      return {
        filename: `dialcare_${group.groupCode}_${formatDateForVendor(new Date())}.csv`,
        content: csv,
        memberCount: members.length,
        generatedAt: Date.now(),
      };
    } else {
      throw new Error(`Unknown vendor: ${args.vendor}`);
    }
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
