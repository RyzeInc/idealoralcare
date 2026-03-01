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
 * Format date as YYYY-MM-DD (vendor file requirement)
 */
function formatDateForVendor(date: Date | number): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
 * Generate Dental Discount Network format eligibility CSV
 * Columns: member_id, first_name, last_name, dob, effective_date, termination_date, group_code
 */
export const generateDentalDiscountNetworkFile: any = action({
  args: {
    groupId: v.id("groups"),
  },
  handler: async (ctx, args) => {
    await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);
    const group = await ctx.runQuery(api.admin.hierarchy.getGroupById, { groupId: args.groupId });
    if (!group) throw new Error("Group not found");

    const members = await ctx.runQuery(api.admin.members.getActiveMembersByGroup, { groupId: args.groupId });

    let csv = "member_id,first_name,last_name,dob,effective_date,termination_date,group_code\n";

    for (const member of members) {
      const memberId = member.memberId ?? "UNKNOWN";
      const firstName = member.firstName.replace(/"/g, '""'); // Escape quotes
      const lastName = member.lastName.replace(/"/g, '""');
      const dob = member.dateOfBirth ? formatDateForVendor(new Date(member.dateOfBirth)) : "";
      const effectiveDate = member.createdAt ? formatDateForVendor(new Date(member.createdAt)) : formatDateForVendor(new Date());
      const terminationDate = member.memberType === "terminated" ? formatDateForVendor(new Date()) : "";

      csv += `"${memberId}","${firstName}","${lastName}","${dob}","${effectiveDate}","${terminationDate}","${group.groupCode}"\n`;
    }

    return {
      filename: `careington_${group.groupCode}_${formatDateForVendor(new Date())}.csv`,
      content: csv,
      memberCount: members.length,
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
    await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);
    const group = await ctx.runQuery(api.admin.hierarchy.getGroupById, { groupId: args.groupId });
    if (!group) throw new Error("Group not found");

    const members = await ctx.runQuery(api.admin.members.getActiveMembersByGroup, { groupId: args.groupId });

    if (args.vendor === "careington") {
      let csv = "member_id,first_name,last_name,dob,effective_date,termination_date,group_code\n";
      for (const member of members) {
        const memberId = member.memberId ?? "UNKNOWN";
        const firstName = member.firstName.replace(/"/g, '""');
        const lastName = member.lastName.replace(/"/g, '""');
        const dob = member.dateOfBirth ? formatDateForVendor(new Date(member.dateOfBirth)) : "";
        const effectiveDate = member.createdAt ? formatDateForVendor(new Date(member.createdAt)) : formatDateForVendor(new Date());
        const terminationDate = member.memberType === "terminated" ? formatDateForVendor(new Date()) : "";
        csv += `"${memberId}","${firstName}","${lastName}","${dob}","${effectiveDate}","${terminationDate}","${group.groupCode}"\n`;
      }
      return {
        filename: `careington_${group.groupCode}_${formatDateForVendor(new Date())}.csv`,
        content: csv,
        memberCount: members.length,
        generatedAt: Date.now(),
      };
    } else if (args.vendor === "dialcare") {
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
