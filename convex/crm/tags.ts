/**
 * CRM TAGS — Jon's "tags AND tag categories" (Location, Industry, ...).
 *
 * crmContactTags is the source of truth for "who has tag X"; the tagIds
 * arrays on crmContacts/crmCompanies are a denormalized cache kept in sync
 * here, and contactCount/companyCount on crmTags are display-only counters
 * reconciled nightly (never trusted for a send — segment resolution always
 * re-queries crmContactTags directly).
 */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireCrmUser, requireCrmManager } from "./guards";
import { insertActivity } from "./activities";
import { fireWorkflowTrigger } from "./workflowTriggers";

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export const listTagTree = query({
  args: { includeArchived: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const categories = await ctx.db.query("crmTagCategories").withIndex("by_order").collect();
    return await Promise.all(
      categories.map(async (category) => {
        const tags = await ctx.db.query("crmTags").withIndex("by_category", (q) => q.eq("categoryId", category._id)).collect();
        return {
          category,
          tags: args.includeArchived ? tags : tags.filter((t) => !t.isArchived),
        };
      })
    );
  },
});

export const listTags = query({
  args: { categoryId: v.optional(v.id("crmTagCategories")) },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    if (args.categoryId) {
      return await ctx.db.query("crmTags").withIndex("by_category", (q) => q.eq("categoryId", args.categoryId!)).collect();
    }
    return await ctx.db.query("crmTags").withIndex("by_archived", (q) => q.eq("isArchived", false)).collect();
  },
});

export const createTag = mutation({
  args: { categoryId: v.id("crmTagCategories"), name: v.string(), description: v.optional(v.string()), color: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    const slug = slugify(args.name);
    const existing = await ctx.db.query("crmTags").withIndex("by_category_slug", (q) => q.eq("categoryId", args.categoryId).eq("slug", slug)).first();
    if (existing) return existing._id;

    const now = Date.now();
    return await ctx.db.insert("crmTags", {
      categoryId: args.categoryId,
      name: args.name.trim(),
      slug,
      description: args.description,
      color: args.color,
      contactCount: 0,
      companyCount: 0,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      createdBy: identity.clerkUserId,
    });
  },
});

export const updateTag = mutation({
  args: { tagId: v.id("crmTags"), name: v.string(), description: v.optional(v.string()), color: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    await ctx.db.patch(args.tagId, {
      name: args.name.trim(),
      slug: slugify(args.name),
      description: args.description,
      color: args.color,
      updatedAt: Date.now(),
    });
  },
});

export const archiveTag = mutation({
  args: { tagId: v.id("crmTags"), archived: v.boolean() },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    await ctx.db.patch(args.tagId, { isArchived: args.archived, updatedAt: Date.now() });
  },
});

export const createCategory = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    color: v.string(),
    isExclusive: v.boolean(),
    isPrimaryFilter: v.boolean(),
    appliesTo: v.union(v.literal("contact"), v.literal("company"), v.literal("both")),
  },
  handler: async (ctx, args) => {
    await requireCrmManager(ctx);
    const now = Date.now();
    const count = (await ctx.db.query("crmTagCategories").collect()).length;
    return await ctx.db.insert("crmTagCategories", {
      name: args.name.trim(),
      slug: slugify(args.name),
      description: args.description,
      color: args.color,
      isExclusive: args.isExclusive,
      isPrimaryFilter: args.isPrimaryFilter,
      order: count,
      appliesTo: args.appliesTo,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateCategory = mutation({
  args: {
    categoryId: v.id("crmTagCategories"),
    name: v.string(),
    description: v.optional(v.string()),
    color: v.string(),
    isExclusive: v.boolean(),
    isPrimaryFilter: v.boolean(),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireCrmManager(ctx);
    const existing = await ctx.db.get(args.categoryId);
    if (!existing) throw new Error("Category not found");
    await ctx.db.patch(args.categoryId, {
      name: args.name.trim(),
      slug: slugify(args.name),
      description: args.description,
      color: args.color,
      isExclusive: args.isExclusive,
      isPrimaryFilter: args.isPrimaryFilter,
      order: args.order ?? existing.order,
      updatedAt: Date.now(),
    });
  },
});

export const deleteCategory = mutation({
  args: { categoryId: v.id("crmTagCategories") },
  handler: async (ctx, args) => {
    await requireCrmManager(ctx);
    const tags = await ctx.db.query("crmTags").withIndex("by_category", (q) => q.eq("categoryId", args.categoryId)).collect();
    const active = tags.filter((t) => !t.isArchived);
    if (active.length > 0) {
      throw new Error(`Category still has ${active.length} active tag(s) — archive or reassign them first`);
    }
    for (const t of tags) await ctx.db.delete(t._id);
    await ctx.db.delete(args.categoryId);
  },
});

/** Find-or-create a tag by display name within a category. Used by CSV import's "column becomes a tag" flow. */
export async function findOrCreateTag(
  ctx: MutationCtx,
  categoryId: Id<"crmTagCategories">,
  name: string,
  createdBy: string,
): Promise<Id<"crmTags">> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Tag name cannot be empty");
  const slug = slugify(trimmed);
  const existing = await ctx.db
    .query("crmTags")
    .withIndex("by_category_slug", (q) => q.eq("categoryId", categoryId).eq("slug", slug))
    .first();
  if (existing) return existing._id;

  const now = Date.now();
  return await ctx.db.insert("crmTags", {
    categoryId, name: trimmed, slug, contactCount: 0, companyCount: 0, isArchived: false,
    createdAt: now, updatedAt: now, createdBy,
  });
}

/** Exported so convex/crm/imports.ts can apply default/column-derived tags with the same single-select/exclusive-category logic every other tag write path uses. */
export async function applyOneTag(
  ctx: MutationCtx,
  entity: { contactId?: Id<"crmContacts">; companyId?: Id<"crmCompanies"> },
  tagId: Id<"crmTags">,
  actorClerkUserId: string,
) {
  const tag = await ctx.db.get(tagId);
  if (!tag) return;
  const category = await ctx.db.get(tag.categoryId);
  if (!category) return;
  const now = Date.now();

  const existingLinks = entity.contactId
    ? await ctx.db.query("crmContactTags").withIndex("by_contact_category", (q) => q.eq("contactId", entity.contactId).eq("categoryId", tag.categoryId)).collect()
    : (await ctx.db.query("crmContactTags").withIndex("by_company", (q) => q.eq("companyId", entity.companyId)).collect()).filter((l) => l.categoryId === tag.categoryId);

  if (existingLinks.some((l) => l.tagId === tagId)) return; // already applied

  if (category.isExclusive) {
    for (const link of existingLinks) {
      await ctx.db.delete(link._id);
      const oldTag = await ctx.db.get(link.tagId);
      if (oldTag) {
        await ctx.db.patch(link.tagId, {
          contactCount: entity.contactId ? Math.max(0, oldTag.contactCount - 1) : oldTag.contactCount,
          companyCount: entity.companyId ? Math.max(0, oldTag.companyCount - 1) : oldTag.companyCount,
        });
      }
      if (entity.contactId) {
        const contact = await ctx.db.get(entity.contactId);
        if (contact) await ctx.db.patch(entity.contactId, { tagIds: contact.tagIds.filter((t) => t !== link.tagId) });
      }
    }
  }

  await ctx.db.insert("crmContactTags", { tagId, categoryId: tag.categoryId, ...entity, createdAt: now, createdBy: actorClerkUserId });
  await ctx.db.patch(tagId, {
    contactCount: entity.contactId ? tag.contactCount + 1 : tag.contactCount,
    companyCount: entity.companyId ? tag.companyCount + 1 : tag.companyCount,
  });

  if (entity.contactId) {
    const contact = await ctx.db.get(entity.contactId);
    if (contact && !contact.tagIds.includes(tagId)) await ctx.db.patch(entity.contactId, { tagIds: [...contact.tagIds, tagId] });
  } else if (entity.companyId) {
    const company = await ctx.db.get(entity.companyId);
    if (company && !company.tagIds.includes(tagId)) await ctx.db.patch(entity.companyId, { tagIds: [...company.tagIds, tagId] });
  }
}

export const applyTags = mutation({
  args: { contactId: v.optional(v.id("crmContacts")), companyId: v.optional(v.id("crmCompanies")), tagIds: v.array(v.id("crmTags")) },
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    if (!args.contactId && !args.companyId) throw new Error("applyTags requires a contactId or companyId");
    for (const tagId of args.tagIds) {
      await applyOneTag(ctx, { contactId: args.contactId, companyId: args.companyId }, tagId, identity.clerkUserId);
      // Per TAG, not per call: a rule watching "Requested Proposal" must fire
      // even when that tag arrives alongside four others.
      await fireWorkflowTrigger(ctx, {
        triggerType: "tag_applied",
        targetType: args.contactId ? "contact" : "company",
        targetId: (args.contactId ?? args.companyId)!,
        tagId,
        occurrenceKey: `tag:${tagId}`,
      });
    }
    if (args.tagIds.length > 0) {
      await insertActivity(ctx, {
        contactId: args.contactId,
        companyId: args.companyId,
        activityType: "tag_added",
        title: `Tagged (${args.tagIds.length})`,
        actorType: "staff",
        actorClerkUserId: identity.clerkUserId,
        actorName: identity.name ?? identity.email ?? "Staff",
      });
    }
  },
});

export const removeTags = mutation({
  args: { contactId: v.optional(v.id("crmContacts")), companyId: v.optional(v.id("crmCompanies")), tagIds: v.array(v.id("crmTags")) },
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    if (!args.contactId && !args.companyId) throw new Error("removeTags requires a contactId or companyId");

    for (const tagId of args.tagIds) {
      const link = args.contactId
        ? await ctx.db.query("crmContactTags").withIndex("by_tag_contact", (q) => q.eq("tagId", tagId).eq("contactId", args.contactId)).first()
        : await ctx.db.query("crmContactTags").withIndex("by_tag_company", (q) => q.eq("tagId", tagId).eq("companyId", args.companyId)).first();
      if (!link) continue;
      await ctx.db.delete(link._id);
      const tag = await ctx.db.get(tagId);
      if (tag) {
        await ctx.db.patch(tagId, {
          contactCount: args.contactId ? Math.max(0, tag.contactCount - 1) : tag.contactCount,
          companyCount: args.companyId ? Math.max(0, tag.companyCount - 1) : tag.companyCount,
        });
      }
      if (args.contactId) {
        const contact = await ctx.db.get(args.contactId);
        if (contact) await ctx.db.patch(args.contactId, { tagIds: contact.tagIds.filter((t) => t !== tagId) });
      } else if (args.companyId) {
        const company = await ctx.db.get(args.companyId);
        if (company) await ctx.db.patch(args.companyId, { tagIds: company.tagIds.filter((t) => t !== tagId) });
      }
    }

    if (args.tagIds.length > 0) {
      await insertActivity(ctx, {
        contactId: args.contactId,
        companyId: args.companyId,
        activityType: "tag_removed",
        title: `Untagged (${args.tagIds.length})`,
        actorType: "staff",
        actorClerkUserId: identity.clerkUserId,
        actorName: identity.name ?? identity.email ?? "Staff",
      });
    }
  },
});

const MAX_BULK_TAG_TARGETS = 500;

export const bulkApplyTags = mutation({
  args: { contactIds: v.array(v.id("crmContacts")), tagIds: v.array(v.id("crmTags")) },
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    if (args.contactIds.length > MAX_BULK_TAG_TARGETS) throw new Error(`Bulk tagging limited to ${MAX_BULK_TAG_TARGETS} contacts at a time`);
    for (const contactId of args.contactIds) {
      for (const tagId of args.tagIds) {
        await applyOneTag(ctx, { contactId }, tagId, identity.clerkUserId);
      }
    }
  },
});

export const contactIdsForTag = query({
  args: { tagId: v.id("crmTags") },
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const links = await ctx.db.query("crmContactTags").withIndex("by_tag_contact", (q) => q.eq("tagId", args.tagId)).take(1000);
    return links.filter((l) => l.contactId).map((l) => l.contactId as Id<"crmContacts">);
  },
});
