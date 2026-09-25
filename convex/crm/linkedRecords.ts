/**
 * LINKED RECORD SUMMARIES — read-only projections of the member, partner and
 * billing worlds, for display on a CRM record.
 *
 * THESE ARE DISPLAY JOINS, NEVER AUTHORISATION JOINS. The soft-link fields
 * (linkedMemberProfileId, linkedPartnerLeaderId, linkedPartnerId on contacts;
 * linkedAccountId, linkedGroupId on companies) are pointers, exactly as the
 * schema comments say. Following one here grants the VIEWER nothing they did
 * not already have — the caller is already internal staff via requireCrmUser,
 * and no CRM permission is derived from the linked record's own access rules.
 *
 * Everything returned is a narrow projection, deliberately. A CRM contact page
 * needs "this person is an active member on the Family plan" and "their agency
 * has $4,200 in approved commission" — it does not need the member's claims,
 * their dependants, a W-9, or an ACH authorisation, so none of that is read.
 */

import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireCrmUser } from "./guards";

/**
 * Commission rollup for a partner. Reads ONLY rows in the trustworthy key
 * space: the schema quarantines `legacy_code` rows (which held a raw tracking
 * code in brokerId and a hardcoded rate) as unusable for reporting, and
 * summing them here would put a fabricated number on a sales page.
 */
async function commissionRollup(
  ctx: Parameters<typeof requireCrmUser>[0],
  leaderId: string,
): Promise<{ approvedCents: number; pendingCents: number; excludedLegacyRows: number }> {
  const rows = await ctx.db
    .query("commissionPayables")
    .withIndex("by_broker", (q) => q.eq("brokerId", leaderId))
    .take(500);

  let approvedCents = 0;
  let pendingCents = 0;
  let excludedLegacyRows = 0;

  for (const row of rows) {
    if (row.keySpace !== "leader_id") {
      excludedLegacyRows++;
      continue;
    }
    if (row.status === "approved" || row.status === "paid") approvedCents += row.amount;
    else if (row.status === "pending") pendingCents += row.amount;
  }

  return { approvedCents, pendingCents, excludedLegacyRows };
}

export const contactLinkedRecords = query({
  args: { contactId: v.id("crmContacts") },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const contact = await ctx.db.get(args.contactId);
    if (!contact) return null;

    const member = contact.linkedMemberProfileId ? await ctx.db.get(contact.linkedMemberProfileId) : null;
    const leader = contact.linkedPartnerLeaderId ? await ctx.db.get(contact.linkedPartnerLeaderId) : null;
    const partner = contact.linkedPartnerId
      ? await ctx.db.get(contact.linkedPartnerId)
      : leader
        ? await ctx.db.get(leader.partnerId)
        : null;

    const commissions = leader ? await commissionRollup(ctx, leader._id) : null;

    const downloads = leader
      ? (await ctx.db
          .query("partnerResourceDownloads")
          .withIndex("by_partner", (q) => q.eq("partnerId", leader.partnerId))
          .order("desc")
          .take(5)
        ).length
      : 0;

    return {
      member: member
        ? {
            id: member._id,
            memberId: member.memberId,
            status: member.status,
            memberType: member.memberType,
            tierCode: member.tierCode,
            memberSince: member.createdAt,
          }
        : null,
      partner: partner
        ? {
            id: partner._id,
            name: partner.name,
            type: partner.type,
            status: partner.status,
            agencyCode: partner.agencyCode,
          }
        : null,
      leader: leader ? { id: leader._id, title: leader.title, isPrimary: leader.isPrimary } : null,
      commissions,
      recentDownloads: downloads,
    };
  },
});

export const companyLinkedRecords = query({
  args: { companyId: v.id("crmCompanies") },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const company = await ctx.db.get(args.companyId);
    if (!company) return null;

    const account = company.linkedAccountId ? await ctx.db.get(company.linkedAccountId) : null;
    const group = company.linkedGroupId ? await ctx.db.get(company.linkedGroupId) : null;
    const partner = company.linkedPartnerId ? await ctx.db.get(company.linkedPartnerId) : null;

    // Enrolled-member count for the linked group — the single most useful
    // number to see next to a deal ("they said 120 lives; 87 have enrolled").
    let enrolledMembers = 0;
    if (group) {
      enrolledMembers = (
        await ctx.db
          .query("memberProfiles")
          .withIndex("by_group", (q) => q.eq("groupId", group._id))
          .take(1000)
      ).filter((m) => m.status === "active").length;
    }

    return {
      account: account ? { id: account._id, name: account.name } : null,
      group: group ? { id: group._id, name: group.name, enrolledMembers } : null,
      partner: partner ? { id: partner._id, name: partner.name, type: partner.type, status: partner.status } : null,
    };
  },
});
