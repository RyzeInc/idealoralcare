import { v } from "convex/values";
import {
  query,
  mutation,
  type QueryCtx,
  type MutationCtx,
} from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { resolveViewerScope, attributionInScope } from "./scope";
import { readMemberDetail } from "./roster";

const visibility = v.union(v.literal("admin"), v.literal("shared"));
const noteType = v.union(
  v.literal("general"),
  v.literal("enrollment"),
  v.literal("billing"),
  v.literal("support"),
  v.literal("follow_up"),
  v.literal("internal"),
);

async function access(ctx: QueryCtx, memberId: Id<"memberProfiles">) {
  const scope = await resolveViewerScope(ctx);
  const member = await ctx.db.get(memberId);
  if (
    !member ||
    !attributionInScope(scope, {
      repId: member.attributedRepId,
      agencyId: member.attributedAgencyId,
    })
  ) {
    throw new Error("Member not found");
  }
  const identity = await ctx.auth.getUserIdentity();
  return {
    member,
    scope,
    authorId: scope.clerkUserId,
    authorName:
      identity?.name ?? (scope.kind === "admin" ? "Administrator" : "Broker"),
  };
}

function text(value: string, max: number) {
  const result = value.trim();
  if (!result || result.length > max)
    throw new Error(`Enter between 1 and ${max} characters`);
  return result;
}

async function log(
  ctx: MutationCtx,
  memberId: Id<"memberProfiles">,
  title: string,
  actor: Awaited<ReturnType<typeof access>>,
) {
  await ctx.db.insert("memberActivities", {
    memberProfileId: memberId,
    siteId: actor.member.siteId,
    groupId: actor.member.groupId,
    activityType: title === "Member note added" ? "note_added" : "custom",
    title,
    actorType: actor.scope.kind === "admin" ? "admin" : "staff",
    actorId: actor.authorId,
    actorName: actor.authorName,
    createdAt: Date.now(),
  });
}

export const getWorkspace = query({
  args: { memberId: v.id("memberProfiles") },
  handler: async (ctx, { memberId }) => {
    const detail = await readMemberDetail(ctx, memberId);
    if (!detail) return null;
    const admin = detail.raw !== null;
    const member = await ctx.db.get(memberId);
    if (!member) return null;
    const [
      notes,
      alerts,
      documents,
      agreements,
      invoices,
      family,
      entitlements,
    ] = await Promise.all([
      ctx.db
        .query("memberNotes")
        .withIndex("by_member", (q) => q.eq("memberProfileId", memberId))
        .order("desc")
        .filter((q) =>
          admin ? q.eq(1, 1) : q.eq(q.field("visibility"), "shared"),
        )
        .take(201),
      ctx.db
        .query("memberAlerts")
        .withIndex("by_member", (q) => q.eq("memberProfileId", memberId))
        .order("desc")
        .filter((q) =>
          admin ? q.eq(1, 1) : q.eq(q.field("visibility"), "shared"),
        )
        .take(201),
      ctx.db
        .query("memberDocuments")
        .withIndex("by_member", (q) => q.eq("memberProfileId", memberId))
        .order("desc")
        .filter((q) =>
          admin ? q.eq(1, 1) : q.eq(q.field("visibility"), "shared"),
        )
        .take(201),
      member.customerId
        ? ctx.db
            .query("membershipAgreements")
            .withIndex("by_userId", (q) => q.eq("userId", member.customerId!))
            .order("desc")
            .take(100)
        : [],
      ctx.db
        .query("listBillInvoices")
        .withIndex("by_group", (q) => q.eq("groupId", member.groupId))
        .order("desc")
        .take(100),
      admin
        ? ctx.db
            .query("memberProfiles")
            .withIndex("by_primary_member", (q) =>
              q.eq("primaryMemberId", memberId),
            )
            .take(100)
        : [],
      member.customerId
        ? ctx.db
            .query("entitlements")
            .withIndex("by_customer", (q) =>
              q.eq("customerId", member.customerId!),
            )
            .take(100)
        : [],
    ]);
    const services = await Promise.all(
      entitlements.map(async (e) => ({
        id: e._id,
        name: (await ctx.db.get(e.productId))?.name ?? "Coverage benefit",
        status: e.status,
        startsAt: e.periodStart,
        endsAt: e.periodEnd,
      })),
    );
    return {
      ...detail,
      isAdmin: admin,
      viewerId: (await resolveViewerScope(ctx)).clerkUserId,
      notes: notes.slice(0, 200),
      alerts: alerts.slice(0, 200),
      documents: documents.slice(0, 200),
      truncated:
        notes.length > 200 || alerts.length > 200 || documents.length > 200,
      agreements: agreements.map((a) => ({
        id: a._id,
        planName: a.planName,
        term: a.term,
        effectiveDate: a.effectiveDate,
        status: a.status,
        signedAt: a.signatureTimestamp,
        termsAccepted: a.membershipTermsAgreed && a.termsAndConditionsAgreed,
      })),
      // Only this member's frozen lines; never send the employer's census or balance.
      invoices: invoices.flatMap((i) =>
        i.lines
          .filter((l) => l.memberProfileId === memberId)
          .map((l) => ({
            id: i._id,
            number: i.invoiceNumberDisplay,
            period: i.coveragePeriod,
            dueAt: i.paymentDueDate,
            status: i.status,
            rateCents: l.rateCents,
            product: l.productLabel,
            tier: l.tier,
          })),
      ),
      family: family.map((m) => ({
        id: m._id,
        firstName: m.firstName,
        lastName: m.lastName,
        relationship: m.relationship,
        status: m.memberType,
      })),
      services,
    };
  },
});

export const addNote = mutation({
  args: {
    memberId: v.id("memberProfiles"),
    content: v.string(),
    noteType,
    visibility,
    isPinned: v.boolean(),
  },
  handler: async (ctx, args) => {
    const actor = await access(ctx, args.memberId);
    if (
      actor.scope.kind !== "admin" &&
      (args.visibility !== "shared" || args.noteType === "internal")
    )
      throw new Error("Admin access required");
    if (args.noteType === "internal" && args.visibility !== "admin")
      throw new Error("Internal notes cannot be shared");
    const now = Date.now();
    const id = await ctx.db.insert("memberNotes", {
      memberProfileId: args.memberId,
      siteId: actor.member.siteId,
      content: text(args.content, 10000),
      noteType: args.noteType,
      visibility: args.visibility,
      isPinned: args.isPinned,
      authorId: actor.authorId,
      authorName: actor.authorName,
      createdAt: now,
      updatedAt: now,
    });
    await log(ctx, args.memberId, "Member note added", actor);
    return id;
  },
});

export const createAlert = mutation({
  args: {
    memberId: v.id("memberProfiles"),
    title: v.string(),
    severity: v.union(
      v.literal("info"),
      v.literal("warning"),
      v.literal("urgent"),
    ),
    visibility,
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const actor = await access(ctx, args.memberId);
    if (actor.scope.kind !== "admin" && args.visibility !== "shared")
      throw new Error("Admin access required");
    if (
      args.expiresAt !== undefined &&
      (!Number.isFinite(args.expiresAt) || args.expiresAt <= Date.now())
    )
      throw new Error("Expiration must be in the future");
    const id = await ctx.db.insert("memberAlerts", {
      memberProfileId: args.memberId,
      title: text(args.title, 500),
      severity: args.severity,
      visibility: args.visibility,
      expiresAt: args.expiresAt,
      authorId: actor.authorId,
      authorName: actor.authorName,
      createdAt: Date.now(),
    });
    await log(ctx, args.memberId, "Member alert created", actor);
    return id;
  },
});

export const resolveAlert = mutation({
  args: { alertId: v.id("memberAlerts") },
  handler: async (ctx, { alertId }) => {
    const alert = await ctx.db.get(alertId);
    if (!alert) throw new Error("Alert not found");
    const actor = await access(ctx, alert.memberProfileId);
    if (
      actor.scope.kind !== "admin" &&
      (alert.visibility !== "shared" || alert.authorId !== actor.authorId)
    )
      throw new Error("Only the author or an admin can resolve this alert");
    if (alert.resolvedAt) return;
    await ctx.db.patch(alertId, {
      resolvedAt: Date.now(),
      resolvedBy: actor.authorId,
    });
    await log(ctx, alert.memberProfileId, "Member alert resolved", actor);
  },
});

export const addDocument = mutation({
  args: {
    memberId: v.id("memberProfiles"),
    name: v.string(),
    url: v.string(),
    category: v.union(
      v.literal("agreement"),
      v.literal("enrollment"),
      v.literal("correspondence"),
      v.literal("other"),
    ),
    visibility,
  },
  handler: async (ctx, args) => {
    const actor = await access(ctx, args.memberId);
    if (actor.scope.kind !== "admin" && args.visibility !== "shared")
      throw new Error("Admin access required");
    const url = new URL(text(args.url, 2000));
    if (url.protocol !== "https:" || url.username || url.password)
      throw new Error(
        "Use an HTTPS document link without embedded credentials",
      );
    const id = await ctx.db.insert("memberDocuments", {
      memberProfileId: args.memberId,
      name: text(args.name, 200),
      url: url.href,
      category: args.category,
      visibility: args.visibility,
      authorId: actor.authorId,
      authorName: actor.authorName,
      createdAt: Date.now(),
    });
    await log(ctx, args.memberId, "Member document linked", actor);
    return id;
  },
});
