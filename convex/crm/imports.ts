/**
 * CSV IMPORT — mapping happens client-side (CsvMapper); this module only
 * ever receives rows already shaped to known contact fields, plus optional
 * "this column becomes a tag" values. Dedupe runs per-row, in a fixed order,
 * against live indexes — no separate within-file Set is needed because
 * Convex mutation writes are visible to reads later in the SAME handler, so
 * a duplicate two rows (or two chunks) apart still resolves to the row
 * created by the earlier one.
 */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { requireCrmUser, requireCrmManager } from "./guards";
import { insertActivity } from "./activities";
import { applyOneTag, findOrCreateTag } from "./tags";
import { buildDerivedFields } from "./contacts";
import { normalizeEmail, normalizePhoneE164, buildDedupeKey } from "./lib/normalize";
import { DEFAULT_CONTACT_STATUS } from "./lib/contactStatus";
import { recordAdminAction } from "../admin/adminAudit";

const ROW_VALIDATOR = v.object({
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  /** Fallback when the source only had one "name" column. Split server-side on the last space if first/last aren't given. */
  fullName: v.optional(v.string()),
  jobTitle: v.optional(v.string()),
  companyName: v.optional(v.string()),
  email: v.optional(v.string()),
  mobilePhone: v.optional(v.string()),
  officePhone: v.optional(v.string()),
  city: v.optional(v.string()),
  state: v.optional(v.string()),
  linkedinUrl: v.optional(v.string()),
  /** Populated client-side wherever the user mapped an extra column to a tag category. */
  extraTagValues: v.optional(v.array(v.object({ categoryId: v.id("crmTagCategories"), value: v.string() }))),
});

export const createBatch = mutation({
  args: {
    filename: v.string(),
    entity: v.union(v.literal("contact"), v.literal("company")),
    columnMapping: v.any(),
    defaultTagIds: v.array(v.id("crmTags")),
    defaultOwnerClerkUserId: v.optional(v.string()),
    defaultSourceDetail: v.optional(v.string()),
    dedupeStrategy: v.union(
      v.literal("skip_existing"), v.literal("fill_blanks_only"), v.literal("update_existing"), v.literal("create_duplicates"),
    ),
    totalRows: v.number(),
    storageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    const now = Date.now();
    return await ctx.db.insert("crmImportBatches", {
      filename: args.filename,
      entity: args.entity,
      columnMapping: args.columnMapping,
      defaultTagIds: args.defaultTagIds,
      defaultOwnerClerkUserId: args.defaultOwnerClerkUserId,
      defaultSourceDetail: args.defaultSourceDetail,
      dedupeStrategy: args.dedupeStrategy,
      status: "importing",
      totalRows: args.totalRows,
      processedRows: 0,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      errors: [],
      storageId: args.storageId,
      createdBy: identity.clerkUserId,
      createdAt: now,
    });
  },
});

const CONTACT_FIELD_KEYS = ["jobTitle", "companyName", "email", "mobilePhone", "officePhone", "city", "state", "linkedinUrl"] as const;

export const commitChunk = mutation({
  args: { batchId: v.id("crmImportBatches"), rows: v.array(ROW_VALIDATOR) },
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    const batch = await ctx.db.get(args.batchId);
    if (!batch) throw new Error("Import batch not found");

    let created = 0, updated = 0, skipped = 0;
    const errors: { row: number; message: string }[] = [];

    for (const [idx, row] of args.rows.entries()) {
      try {
        const firstName = row.firstName ?? (row.fullName ? row.fullName.trim().split(/\s+/)[0] : undefined);
        const lastName = row.lastName ?? (row.fullName ? row.fullName.trim().split(/\s+/).slice(1).join(" ") : undefined);
        if (!firstName && !lastName && !row.email) {
          skipped++;
          continue;
        }

        const emailLower = normalizeEmail(row.email);
        const mobilePhoneE164 = normalizePhoneE164(row.mobilePhone);
        const dedupeKey = buildDedupeKey(firstName, lastName, row.companyName);

        let match: Doc<"crmContacts"> | null = null;
        if (emailLower) {
          match = await ctx.db.query("crmContacts").withIndex("by_email_lower", (q) => q.eq("emailLower", emailLower)).first();
        }
        if (!match && mobilePhoneE164 && lastName) {
          const candidates = await ctx.db.query("crmContacts").withIndex("by_mobile_e164", (q) => q.eq("mobilePhoneE164", mobilePhoneE164)).collect();
          match = candidates.find((c) => c.lastName.toLowerCase() === lastName.toLowerCase()) ?? null;
        }
        if (!match && dedupeKey) {
          match = await ctx.db.query("crmContacts").withIndex("by_dedupe_key", (q) => q.eq("dedupeKey", dedupeKey)).first();
        }
        if (match && batch.dedupeStrategy === "create_duplicates") match = null;

        let contactId: Id<"crmContacts">;
        const now = Date.now();

        if (match) {
          if (batch.dedupeStrategy === "skip_existing") {
            contactId = match._id;
            skipped++;
          } else {
            const incoming: Record<string, string | undefined> = {
              jobTitle: row.jobTitle, companyName: row.companyName, email: row.email,
              mobilePhone: row.mobilePhone, officePhone: row.officePhone, city: row.city,
              state: row.state, linkedinUrl: row.linkedinUrl,
            };
            const patch: Record<string, unknown> = {};
            for (const key of CONTACT_FIELD_KEYS) {
              const value = incoming[key];
              if (value === undefined) continue;
              const current = (match as unknown as Record<string, unknown>)[key];
              if (batch.dedupeStrategy === "update_existing" || !current) patch[key] = value;
            }
            if (Object.keys(patch).length > 0) {
              const mergedForDerive = { ...match, ...patch } as Doc<"crmContacts">;
              const derived = buildDerivedFields(mergedForDerive);
              await ctx.db.patch(match._id, {
                ...patch,
                fullName: derived.fullName, jobFunction: derived.jobFunction, seniority: derived.seniority,
                emailLower: derived.emailLower, mobilePhoneE164: derived.mobilePhoneE164,
                officePhoneE164: derived.officePhoneE164, dedupeKey: derived.dedupeKey, searchText: derived.searchText,
                updatedAt: now,
              });
            }
            contactId = match._id;
            updated++;
          }
        } else {
          const derived = buildDerivedFields({
            firstName: firstName ?? "", lastName: lastName ?? "", jobTitle: row.jobTitle,
            companyName: row.companyName, email: row.email, mobilePhone: row.mobilePhone, officePhone: row.officePhone,
          });
          contactId = await ctx.db.insert("crmContacts", {
            firstName: firstName ?? "", lastName: lastName ?? "", fullName: derived.fullName,
            jobTitle: row.jobTitle, jobFunction: derived.jobFunction, seniority: derived.seniority,
            companyName: row.companyName,
            email: row.email, emailLower: derived.emailLower,
            mobilePhone: row.mobilePhone, mobilePhoneE164: derived.mobilePhoneE164,
            officePhone: row.officePhone, officePhoneE164: derived.officePhoneE164,
            linkedinUrl: row.linkedinUrl, city: row.city, state: row.state,
            status: DEFAULT_CONTACT_STATUS, statusChangedAt: now,
            dripStatus: "not_started", dripStep: 0,
            ownerClerkUserId: batch.defaultOwnerClerkUserId,
            tagIds: [],
            emailOptOut: false, callOptOut: false, emailStatus: "unknown", phoneStatus: "unknown",
            source: "csv_import", sourceDetail: batch.defaultSourceDetail, importBatchId: args.batchId,
            emailsSentCount: 0, callsMadeCount: 0, callsConnectedCount: 0,
            firstTouchAt: now, isArchived: false,
            dedupeKey: derived.dedupeKey, searchText: derived.searchText,
            createdAt: now, updatedAt: now, createdBy: identity.clerkUserId,
          });
          created++;
          await insertActivity(ctx, {
            contactId, activityType: "imported", title: "Imported from CSV", isTouch: false,
            actorType: "system", actorName: "CSV Import",
          });
        }

        // Member-collision guard: never cold-email an existing customer. Only
        // the suppression exists afterward — no flag is stored on the contact
        // itself, so the cold-prospecting surface never learns "this is a
        // member" by inference. See the CRM plan's compliance note on this.
        if (emailLower) {
          const isMember = await ctx.db.query("memberProfiles").withIndex("by_email", (q) => q.eq("email", emailLower)).first();
          const suppression = await ctx.db.query("crmSuppressions").withIndex("by_scope_value", (q) => q.eq("scope", "email").eq("value", emailLower)).first();
          if (isMember && !suppression) {
            await ctx.db.insert("crmSuppressions", { value: emailLower, scope: "email", reason: "member", createdAt: now });
          }
          if (isMember || suppression) {
            await ctx.db.patch(contactId, { emailOptOut: true, emailStatus: "unsubscribed" });
          }
        }

        for (const tagId of batch.defaultTagIds) {
          await applyOneTag(ctx, { contactId }, tagId, identity.clerkUserId);
        }
        for (const extra of row.extraTagValues ?? []) {
          if (!extra.value.trim()) continue;
          const tagId = await findOrCreateTag(ctx, extra.categoryId, extra.value, identity.clerkUserId);
          await applyOneTag(ctx, { contactId }, tagId, identity.clerkUserId);
        }
      } catch (err) {
        errors.push({ row: idx, message: err instanceof Error ? err.message : String(err) });
      }
    }

    await ctx.db.patch(args.batchId, {
      processedRows: batch.processedRows + args.rows.length,
      createdCount: batch.createdCount + created,
      updatedCount: batch.updatedCount + updated,
      skippedCount: batch.skippedCount + skipped,
      errorCount: batch.errorCount + errors.length,
      errors: [...(batch.errors ?? []), ...errors].slice(0, 100),
    });

    return { created, updated, skipped, errors };
  },
});

export const finalizeBatch = mutation({
  args: { batchId: v.id("crmImportBatches") },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    await ctx.db.patch(args.batchId, { status: "completed", completedAt: Date.now() });
  },
});

export const getBatch = query({
  args: { batchId: v.id("crmImportBatches") },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    return await ctx.db.get(args.batchId);
  },
});

export const listBatches = query({
  args: {},
  handler: async (ctx) => {
    await requireCrmUser(ctx);
    return await ctx.db.query("crmImportBatches").withIndex("by_created").order("desc").take(50);
  },
});

/**
 * Deletes only contacts nobody has worked yet: zero non-"imported"
 * activities and never patched since creation. Anything a rep has touched —
 * a call, a note, a tag — is a real record now regardless of where it came
 * from, and rollback refuses those rather than silently keeping them while
 * claiming a full rollback happened.
 */
export const rollbackImport = mutation({
  args: { batchId: v.id("crmImportBatches") },
  handler: async (ctx, args) => {
    const identity = await requireCrmManager(ctx);
    const batch = await ctx.db.get(args.batchId);
    if (!batch) throw new Error("Import batch not found");

    const contacts = await ctx.db.query("crmContacts").withIndex("by_import_batch", (q) => q.eq("importBatchId", args.batchId)).collect();
    let deleted = 0, kept = 0;

    for (const contact of contacts) {
      if (contact.updatedAt !== contact.createdAt) {
        kept++;
        continue;
      }
      const activities = await ctx.db.query("crmActivities").withIndex("by_contact", (q) => q.eq("contactId", contact._id)).collect();
      const hasRealActivity = activities.some((a) => a.activityType !== "imported");
      if (hasRealActivity) {
        kept++;
        continue;
      }
      for (const a of activities) await ctx.db.delete(a._id);
      const tagLinks = await ctx.db.query("crmContactTags").withIndex("by_contact", (q) => q.eq("contactId", contact._id)).collect();
      for (const l of tagLinks) await ctx.db.delete(l._id);
      await ctx.db.delete(contact._id);
      deleted++;
    }

    await ctx.db.patch(args.batchId, { status: "rolled_back" });
    await recordAdminAction(ctx, identity, {
      action: "crm.import.rollback",
      targetType: "crmImportBatches",
      targetId: args.batchId,
      summary: `Rolled back import "${batch.filename}": deleted ${deleted}, kept ${kept} (already worked)`,
    });
    return { deleted, kept };
  },
});
