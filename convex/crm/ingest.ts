/**
 * INGEST — adopts rows from the marketing-site inbound tables (nexusLeads,
 * partnerRegistrations, inquiries) into the CRM as a REVIEWED ACTION, not a
 * live sync. A rep looks at a candidate and clicks "Import" — nothing here
 * runs automatically.
 *
 * contactSubmissions is deliberately excluded entirely: it's a support inbox
 * (name/email/subject/message, no phone, no company, no title), not a sales
 * lead. inquiries is filtered to inquiryType partnership/investment only —
 * "careers" inquiries are job applicants and must never enter a sales CRM.
 */

import { mutation, query } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { requireCrmUser } from "./guards";
import { insertActivity } from "./activities";
import { applyOneTag } from "./tags";
import { RELATIONSHIP_CATEGORY_SLUG } from "./lib/relationshipTags";
import { normalizeEmail, buildDedupeKey, buildContactSearchText } from "./lib/normalize";
import { DEFAULT_CONTACT_STATUS } from "./lib/contactStatus";
import { classifyJobTitle } from "./lib/jobTitles";

const SOURCE_VALIDATOR = v.union(
  v.literal("nexusLeads"),
  v.literal("inquiries"),
  v.literal("partnerRegistrations"),
  v.literal("repOnboardingSubmissions"),
  v.literal("partnerKitSubmissions"),
);

/**
 * THE FIELD ALLOW-LIST. repOnboardingSubmissions and partnerKitSubmissions are
 * onboarding/compliance records, not lead forms: between them they carry EIN,
 * agency and rep NPNs, licence numbers, E&O carrier details, W-9 status and
 * received dates, payment method, ACH authorisation status, an e-signature
 * data URL and W-9 file handles.
 *
 * None of that belongs in a sales CRM. It lives in tables with their own
 * access rules, and copying it into crmContacts would silently widen who can
 * read it to every CRM user. So ingest maps EXACTLY these four things and
 * nothing else — the shape is enforced here, and pinned by a test that asserts
 * no sensitive key ever reaches a contact row.
 */
interface IngestedPerson {
  name: string;
  email: string;
  phone?: string;
  companyName?: string;
}

function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

export const listIngestCandidates = query({
  args: { source: SOURCE_VALIDATOR },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);

    if (args.source === "nexusLeads") {
      const rows = await ctx.db.query("nexusLeads").order("desc").take(200);
      const links = await Promise.all(rows.map((r) => ctx.db.query("crmIngestLinks").withIndex("by_source", (q) => q.eq("sourceTable", "nexusLeads").eq("sourceId", r._id)).first()));
      return rows.filter((_, i) => !links[i]);
    }

    if (args.source === "partnerRegistrations") {
      const rows = await ctx.db.query("partnerRegistrations").order("desc").take(200);
      const links = await Promise.all(rows.map((r) => ctx.db.query("crmIngestLinks").withIndex("by_source", (q) => q.eq("sourceTable", "partnerRegistrations").eq("sourceId", r._id)).first()));
      return rows.filter((_, i) => !links[i]);
    }

    if (args.source === "repOnboardingSubmissions") {
      // Only approved/reviewing applications — a rejected applicant is not a
      // relationship, and a brand-new one has not been vetted yet.
      const rows = (await ctx.db.query("repOnboardingSubmissions").order("desc").take(200))
        .filter((r) => r.status === "approved" || r.status === "reviewing");
      const links = await Promise.all(
        rows.map((r) => ctx.db.query("crmIngestLinks").withIndex("by_source", (q) => q.eq("sourceTable", "repOnboardingSubmissions").eq("sourceId", r._id)).collect())
      );
      // One row holds up to two people; surface whichever slots are unclaimed.
      return rows
        .map((row, i) => {
          const claimed = new Set(links[i].map((l) => l.sourceSlot));
          const slots: string[] = [];
          if (row.primaryContactEmail && !claimed.has("primary")) slots.push("primary");
          if (row.repEmail && !claimed.has("rep")) slots.push("rep");
          return {
            _id: row._id,
            _creationTime: row._creationTime,
            availableSlots: slots,
            agencyName: row.agencyName,
            primaryContactName: row.primaryContactName,
            primaryContactEmail: row.primaryContactEmail,
            repFirstName: row.repFirstName,
            repLastName: row.repLastName,
            repEmail: row.repEmail,
            status: row.status,
          };
        })
        .filter((r) => r.availableSlots.length > 0);
    }

    if (args.source === "partnerKitSubmissions") {
      const rows = (await ctx.db.query("partnerKitSubmissions").order("desc").take(200))
        .filter((r) => r.status === "approved" || r.status === "reviewing");
      const links = await Promise.all(
        rows.map((r) => ctx.db.query("crmIngestLinks").withIndex("by_source", (q) => q.eq("sourceTable", "partnerKitSubmissions").eq("sourceId", r._id)).first())
      );
      // Projected, not returned raw: these rows carry signature and W-9 data
      // the CRM has no business displaying.
      return rows
        .map((row) => ({
          _id: row._id,
          _creationTime: row._creationTime,
          partnerAgencyName: row.partnerAgencyName,
          primaryContactName: row.primaryContactName,
          email: row.email,
          phone: row.phone,
          status: row.status,
        }))
        .filter((_, i) => !links[i]);
    }

    // inquiries — partnership/investment only, never careers/other.
    const rows = await ctx.db.query("inquiries").order("desc").take(400);
    const filtered = rows.filter((r) => r.inquiryType === "partnership" || r.inquiryType === "investment");
    const links = await Promise.all(filtered.map((r) => ctx.db.query("crmIngestLinks").withIndex("by_source", (q) => q.eq("sourceTable", "inquiries").eq("sourceId", r._id)).first()));
    return filtered.filter((_, i) => !links[i]);
  },
});

/**
 * Apply a Relationship Type tag by slug, if the category has been seeded.
 * Silent no-op when it hasn't — ingest must not fail because an optional
 * taxonomy is missing.
 */
async function applyRelationshipTag(
  ctx: MutationCtx,
  contactId: Id<"crmContacts">,
  slug: string,
  actorClerkUserId: string,
): Promise<void> {
  const category = await ctx.db
    .query("crmTagCategories")
    .withIndex("by_slug", (q) => q.eq("slug", RELATIONSHIP_CATEGORY_SLUG))
    .first();
  if (!category) return;
  const tag = await ctx.db
    .query("crmTags")
    .withIndex("by_category_slug", (q) => q.eq("categoryId", category._id).eq("slug", slug))
    .first();
  if (!tag) return;
  await applyOneTag(ctx, { contactId }, tag._id, actorClerkUserId);
}

type IngestSource =
  | "nexusLeads" | "inquiries" | "partnerRegistrations"
  | "repOnboardingSubmissions" | "partnerKitSubmissions";

async function importOne(
  ctx: MutationCtx,
  identity: { clerkUserId: string; name?: string; email?: string },
  sourceTable: IngestSource,
  sourceId: string,
  sourceSlot?: string,
): Promise<{ contactId: Id<"crmContacts">; action: "created" | "merged" | "skipped" }> {
  const existingLink = await ctx.db
    .query("crmIngestLinks")
    .withIndex("by_source", (q) => q.eq("sourceTable", sourceTable).eq("sourceId", sourceId).eq("sourceSlot", sourceSlot))
    .first();
  if (existingLink) return { contactId: existingLink.contactId, action: "skipped" };

  let person: IngestedPerson;
  let sourceDetail: string | undefined;
  let source: Doc<"crmContacts">["source"];
  /** Relationship Type tag slug, when the source implies one. */
  let relationshipSlug: string | undefined;

  if (sourceTable === "nexusLeads") {
    const row = await ctx.db.get(sourceId as Id<"nexusLeads">);
    if (!row) throw new Error("Lead not found");
    person = { name: row.name, email: row.email, companyName: row.company };
    sourceDetail = row.source;
    source = "nexus_lead";
  } else if (sourceTable === "partnerRegistrations") {
    const row = await ctx.db.get(sourceId as Id<"partnerRegistrations">);
    if (!row) throw new Error("Registration not found");
    person = { name: row.name, email: row.email, companyName: row.business, phone: row.phone };
    source = "partner_registration";
  } else if (sourceTable === "repOnboardingSubmissions") {
    const row = await ctx.db.get(sourceId as Id<"repOnboardingSubmissions">);
    if (!row) throw new Error("Application not found");
    if (row.status === "rejected") throw new Error("A rejected application must not be imported into the CRM");

    // ALLOW-LIST — name, email, phone, agency name. Nothing else is read from
    // this row: it also holds EIN, NPNs, licences, E&O, W-9 and ACH status.
    if (sourceSlot === "rep") {
      const repName = `${row.repFirstName ?? ""} ${row.repLastName ?? ""}`.trim();
      if (!repName || !row.repEmail) throw new Error("This application has no rep contact to import");
      person = { name: repName, email: row.repEmail, phone: row.repPhone, companyName: row.agencyName };
    } else {
      if (!row.primaryContactName || !row.primaryContactEmail) {
        throw new Error("This application has no primary contact to import");
      }
      person = {
        name: row.primaryContactName,
        email: row.primaryContactEmail,
        phone: row.primaryContactPhone,
        companyName: row.agencyName,
      };
    }
    sourceDetail = row.submissionType;
    source = "rep_onboarding";
    relationshipSlug = "rep-partner-lead";
  } else if (sourceTable === "partnerKitSubmissions") {
    const row = await ctx.db.get(sourceId as Id<"partnerKitSubmissions">);
    if (!row) throw new Error("Partner kit submission not found");
    if (row.status === "rejected") throw new Error("A rejected submission must not be imported into the CRM");

    // ALLOW-LIST — this row also carries signatureDataUrl and W-9 file
    // handles, which must never be copied into a CRM contact.
    person = {
      name: row.primaryContactName,
      email: row.email,
      phone: row.phone,
      companyName: row.partnerAgencyName,
    };
    sourceDetail = row.method;
    source = "partner_kit";
    // A partner-kit submitter has ALREADY signed a partner agreement — they
    // are a counterparty, not a prospect. Tagging them on the way in is what
    // keeps them out of prospect funnel metrics.
    relationshipSlug = "broker-partner";
  } else {
    const row = await ctx.db.get(sourceId as Id<"inquiries">);
    if (!row) throw new Error("Inquiry not found");
    if (row.inquiryType !== "partnership" && row.inquiryType !== "investment") {
      throw new Error("Only partnership/investment inquiries may be imported into the CRM");
    }
    person = { name: row.name, email: row.email, phone: row.phone, companyName: row.companyName };
    sourceDetail = row.inquiryType;
    source = "inquiry";
  }

  const { name, email, phone: mobilePhone, companyName } = person;
  const { firstName, lastName } = splitName(name);
  const emailLower = normalizeEmail(email);

  const match = emailLower
    ? await ctx.db.query("crmContacts").withIndex("by_email_lower", (q) => q.eq("emailLower", emailLower)).first()
    : null;

  const now = Date.now();
  let contactId: Id<"crmContacts">;
  let action: "created" | "merged";

  if (match) {
    contactId = match._id;
    action = "merged";
    const patch: Record<string, unknown> = {};
    if (!match.companyName && companyName) patch.companyName = companyName;
    if (!match.mobilePhone && mobilePhone) patch.mobilePhone = mobilePhone;
    if (Object.keys(patch).length > 0) await ctx.db.patch(contactId, { ...patch, updatedAt: now });
  } else {
    const { jobFunction, seniority } = classifyJobTitle(undefined);
    const fullName = `${firstName} ${lastName}`.trim();
    contactId = await ctx.db.insert("crmContacts", {
      firstName, lastName, fullName, jobFunction, seniority,
      companyName, email, emailLower, mobilePhone,
      status: DEFAULT_CONTACT_STATUS, statusChangedAt: now,
      dripStatus: "not_started", dripStep: 0,
      ownerClerkUserId: identity.clerkUserId,
      tagIds: [], emailOptOut: false, callOptOut: false, emailStatus: "unknown", phoneStatus: "unknown",
      source, sourceDetail,
      emailsSentCount: 0, callsMadeCount: 0, callsConnectedCount: 0,
      firstTouchAt: now, isArchived: false,
      dedupeKey: buildDedupeKey(firstName, lastName, companyName),
      searchText: buildContactSearchText({ fullName, email, companyName, mobilePhone }),
      createdAt: now, updatedAt: now, createdBy: identity.clerkUserId,
    });
    action = "created";
  }

  await ctx.db.insert("crmIngestLinks", { sourceTable, sourceId, sourceSlot, contactId, action, createdBy: identity.clerkUserId, createdAt: now });
  if (relationshipSlug) {
    await applyRelationshipTag(ctx, contactId, relationshipSlug, identity.clerkUserId);
  }
  await insertActivity(ctx, {
    contactId, activityType: "imported", title: `Adopted from ${sourceTable}${sourceSlot ? ` (${sourceSlot})` : ""}`, isTouch: false,
    actorType: "staff", actorClerkUserId: identity.clerkUserId, actorName: identity.name ?? identity.email ?? "Staff",
  });

  return { contactId, action };
}

export const importFromSource = mutation({
  args: { sourceTable: SOURCE_VALIDATOR, sourceId: v.string(), sourceSlot: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    return await importOne(ctx, identity, args.sourceTable, args.sourceId, args.sourceSlot);
  },
});

const MAX_BULK_INGEST = 500;

export const bulkImportFromSource = mutation({
  args: { sourceTable: SOURCE_VALIDATOR, sourceIds: v.array(v.string()), sourceSlot: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    if (args.sourceIds.length > MAX_BULK_INGEST) throw new Error(`Bulk import limited to ${MAX_BULK_INGEST} rows at a time`);
    const results = [];
    for (const sourceId of args.sourceIds) {
      // One bad row must not abandon the rest of the batch half-imported —
      // an application missing a rep email is a data gap, not a failure of
      // the other 200 rows the operator selected.
      try {
        results.push(await importOne(ctx, identity, args.sourceTable, sourceId, args.sourceSlot));
      } catch (error) {
        results.push({ sourceId, action: "skipped" as const, error: error instanceof Error ? error.message : String(error) });
      }
    }
    return results;
  },
});
