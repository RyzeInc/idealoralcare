/**
 * BROKER LINKS — the narrow screen for adding and dropping link holders.
 *
 * A "link" is a rep tracking code plus its URL ending. Everything a sale needs
 * to be credited (a partner record, a person record, a code) is created here
 * in one step so the person adding a broker never has to visit Brokers, Rep
 * Codes or Hierarchy.
 *
 * These functions need only `links.manage` and return only names, contact
 * emails, link endings and member COUNTS — no commission rates, hierarchy,
 * account ids or member records.
 *
 * Counts use the shared reading of member status (lib/memberBilling.ts):
 * one per membership, dependents and demo accounts excluded; "active" means
 * on the book. Link visits are reported separately and never as sign-ups.
 */

import { mutation, query } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { requireAccess } from "../lib/authGuards";
import { recordAdminAction } from "./adminAudit";
import { SLUG_RESERVED } from "./repCodes";
import { isCountedMember, memberStanding } from "../lib/memberBilling";

const holderTypeValidator = v.union(
  v.literal("broker"),
  v.literal("rep"),
  v.literal("organization"),
  v.literal("partner"),
  v.literal("other"),
);
const landingValidator = v.union(v.literal("essentials"), v.literal("oralcare"));

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isOrgType = (type?: string) => type === "organization" || type === "partner";
const toEnding = (value: string) => value.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/^-+|-+$/g, "");

async function safeGet<T extends "partnerLeaders" | "distributionPartners">(ctx: QueryCtx, id: string | undefined) {
  if (!id) return null;
  try {
    return (await ctx.db.get(id as Id<T>)) as Doc<T> | null;
  } catch {
    return null;
  }
}

/** Why an ending can't be used, or null when it is free. */
async function endingProblem(ctx: QueryCtx, ending: string): Promise<string | null> {
  if (ending.length < 3) return "Use at least 3 letters or numbers.";
  if (ending.length > 40) return "Use 40 characters or fewer.";
  if (SLUG_RESERVED.has(ending)) return `"${ending}" is a page on the website and can't be a link ending.`;
  const site = await ctx.db.query("sites").withIndex("by_slug", (q) => q.eq("slug", ending)).first();
  if (site) return `"${ending}" is a page on the website and can't be a link ending.`;
  const bySlug = await ctx.db.query("brokerTrackingCodes").withIndex("by_slug", (q) => q.eq("slug", ending)).first();
  const byCode = await ctx.db.query("brokerTrackingCodes").withIndex("by_code", (q) => q.eq("code", ending.toUpperCase())).first();
  if (bySlug || byCode) return `"${ending}" is already someone's link.`;
  return null;
}

/** Every link holder, with only what is needed to hand a link out. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAccess(ctx, "links.manage");
    const codes = await ctx.db.query("brokerTrackingCodes").collect();
    const leaders = new Map((await ctx.db.query("partnerLeaders").collect()).map((l) => [String(l._id), l]));
    const partners = new Map((await ctx.db.query("distributionPartners").collect()).map((p) => [String(p._id), p]));

    // Credit each member to one link: the code they signed up with, else the
    // rep's link (their working one first) for members credited by group.
    const byCode = new Map(codes.map((c) => [c.code, String(c._id)]));
    const byRep = new Map<string, string>();
    for (const c of [...codes].sort((a, b) => Number(a.status === "active") - Number(b.status === "active"))) byRep.set(c.brokerId, String(c._id));
    const counts = new Map<string, { active: number; ended: number }>();
    for (const m of await ctx.db.query("memberProfiles").collect()) {
      if (!isCountedMember(m)) continue;
      const codeId = (m.attributedCode && byCode.get(m.attributedCode)) || (m.attributedRepId && byRep.get(m.attributedRepId));
      if (!codeId) continue;
      const standing = memberStanding(m);
      if (standing === "not_enrolled") continue;
      const tally = counts.get(codeId) ?? { active: 0, ended: 0 };
      tally[standing === "covered" ? "active" : "ended"]++;
      counts.set(codeId, tally);
    }

    return codes
      .map((code) => {
        const leader = leaders.get(code.brokerId);
        const partner = partners.get(code.agencyId ?? "") ?? (leader ? partners.get(String(leader.partnerId)) : undefined);
        const asOrg = isOrgType(code.holderType) && !!partner;
        const name = (asOrg ? partner!.name : leader?.name) ?? partner?.name ?? "Name not on file";
        const other = asOrg ? leader?.name : partner?.name;
        return {
          id: code._id,
          name,
          detail: other && other !== name ? other : null,
          email: leader?.email ?? partner?.contactEmail ?? null,
          holderType: code.holderType ?? null,
          code: code.code,
          ending: code.slug ?? code.code,
          landing: code.productHint === "essentials" || code.productHint === "oralcare" ? code.productHint : null,
          active: code.status === "active",
          activeMembers: counts.get(String(code._id))?.active ?? 0,
          endedMembers: counts.get(String(code._id))?.ended ?? 0,
          linkVisits: code.usageCount,
          lastUsedAt: code.lastUsedAt ?? null,
          createdAt: code.createdAt,
        };
      })
      .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
  },
});

/** Names for the "Part of" choice when adding a person. */
export const organizations = query({
  args: {},
  handler: async (ctx) => {
    await requireAccess(ctx, "links.manage");
    const partners = await ctx.db.query("distributionPartners").withIndex("by_status", (q) => q.eq("status", "active")).collect();
    return partners.map((p) => ({ id: p._id, name: p.name })).sort((a, b) => a.name.localeCompare(b.name));
  },
});

async function nextAgencyCode(ctx: MutationCtx, partner: Doc<"distributionPartners">): Promise<string> {
  if (partner.agencyCode) return partner.agencyCode;
  const used = new Set((await ctx.db.query("distributionPartners").collect()).map((p) => p.agencyCode).filter(Boolean));
  let next = 1000;
  while (used.has(String(next))) next++;
  if (next > 9999) throw new Error("No organization numbers are left. Ask an administrator.");
  await ctx.db.patch(partner._id, { agencyCode: String(next), updatedAt: Date.now() });
  return String(next);
}

/**
 * Add a person or organization and issue their link.
 *
 * Without `organizationId` the holder stands alone: an organization record is
 * created for them, which is what sales are credited to. No sign-in is created
 * and no email is sent — an administrator can invite them to the partner
 * portal later from Brokers.
 */
export const add = mutation({
  args: {
    holderType: holderTypeValidator,
    name: v.string(),
    contactName: v.optional(v.string()),
    email: v.string(),
    phone: v.optional(v.string()),
    organizationId: v.optional(v.id("distributionPartners")),
    ending: v.optional(v.string()),
    /** A code the holder asked for (e.g. "M1"). Otherwise one is numbered for them. */
    code: v.optional(v.string()),
    landing: v.optional(landingValidator),
  },
  handler: async (ctx, args) => {
    const identity = await requireAccess(ctx, "links.manage");
    const name = args.name.trim();
    const email = args.email.trim().toLowerCase();
    const personName = args.contactName?.trim() || name;
    if (!name) throw new Error("Enter a name.");
    if (name.length > 120 || personName.length > 120) throw new Error("Names must be 120 characters or fewer.");
    if (!EMAIL_RE.test(email)) throw new Error("Enter a valid email address.");
    const orgType = isOrgType(args.holderType);
    if (orgType && args.organizationId) throw new Error("An organization gets its own link; it can't be placed under another one here.");

    // One working link per person, so two links never split one person's sales.
    const sameEmail = (await ctx.db.query("partnerLeaders").collect()).filter((l) => l.email.toLowerCase() === email);
    for (const leader of sameEmail) {
      const existing = await ctx.db.query("brokerTrackingCodes").withIndex("by_broker", (q) => q.eq("brokerId", String(leader._id))).collect();
      const live = existing.find((c) => c.status === "active") ?? existing[0];
      if (live) {
        throw new Error(
          live.status === "active"
            ? `${leader.name} (${email}) already has a link ending in "${live.slug ?? live.code}".`
            : `${leader.name} (${email}) has a link that is turned off. Turn it back on instead of adding a new one.`,
        );
      }
    }

    let customCode: string | undefined;
    if (args.code?.trim()) {
      customCode = args.code.trim().toUpperCase();
      if (!/^[A-Z0-9-]{2,20}$/.test(customCode)) throw new Error("A code uses 2 to 20 letters, numbers or dashes.");
      const asEnding = customCode.toLowerCase();
      const clash =
        (await ctx.db.query("brokerTrackingCodes").withIndex("by_code", (q) => q.eq("code", customCode!)).first()) ??
        (await ctx.db.query("brokerTrackingCodes").withIndex("by_slug", (q) => q.eq("slug", asEnding)).first());
      if (clash) throw new Error(`The code "${customCode}" is already in use.`);
      if (SLUG_RESERVED.has(asEnding) || (await ctx.db.query("sites").withIndex("by_slug", (q) => q.eq("slug", asEnding)).first())) {
        throw new Error(`"${customCode}" is a page on the website and can't be a code.`);
      }
    }

    let ending: string;
    if (args.ending?.trim()) {
      ending = toEnding(args.ending);
      const problem = await endingProblem(ctx, ending);
      if (problem) throw new Error(problem);
    } else {
      const base = toEnding(name.replace(/[^a-zA-Z0-9]/g, "")).slice(0, 36) || "partner";
      ending = base.length < 3 ? `${base}link` : base;
      for (let n = 2; await endingProblem(ctx, ending); n++) {
        if (n > 500) throw new Error("Could not find a free link ending. Type one in.");
        ending = `${base}${n}`;
      }
    }

    const now = Date.now();
    let partner: Doc<"distributionPartners"> | null;
    if (args.organizationId) {
      partner = await ctx.db.get(args.organizationId);
      if (!partner || partner.status !== "active") throw new Error("That organization is not active. Pick another or leave it blank.");
    } else {
      const partnerId = await ctx.db.insert("distributionPartners", {
        name, type: "agency", contactName: personName, contactEmail: email, contactPhone: args.phone?.trim() || undefined,
        status: "active", notes: "Added from Broker Links.", createdBy: identity.clerkUserId, createdAt: now, updatedAt: now,
      });
      partner = (await ctx.db.get(partnerId))!;
    }

    const leaderId = await ctx.db.insert("partnerLeaders", {
      partnerId: partner._id, name: personName, email, phone: args.phone?.trim() || undefined,
      isPrimary: !args.organizationId, portalAccess: false, createdAt: now, updatedAt: now,
    });

    let code: string;
    let seq: number | undefined;
    if (customCode) {
      code = customCode;
    } else {
      const agencyCode = await nextAgencyCode(ctx, partner);
      const siblings = await ctx.db.query("brokerTrackingCodes").filter((q) => q.eq(q.field("agencyId"), String(partner!._id))).collect();
      seq = siblings.reduce((max, c) => Math.max(max, c.agencySeqNo ?? 0), 0) + 1;
      code = `${agencyCode}${String(seq).padStart(2, "0")}`;
      while (await ctx.db.query("brokerTrackingCodes").withIndex("by_code", (q) => q.eq("code", code)).first()) {
        seq++;
        code = `${agencyCode}${String(seq).padStart(2, "0")}`;
      }
    }

    const id = await ctx.db.insert("brokerTrackingCodes", {
      brokerId: String(leaderId), agencyId: String(partner._id), code, slug: ending, agencySeqNo: seq,
      productHint: args.landing, holderType: args.holderType, usageCount: 0, status: "active",
      createdBy: identity.clerkUserId, createdAt: now, updatedAt: now,
    });
    await recordAdminAction(ctx, identity, {
      action: "link.created", targetType: "distributionPartner", targetId: String(partner._id),
      summary: `Added ${name} with link ending "${ending}"`, metadata: { code, ending, holderType: args.holderType, leaderId },
    });
    return { id, code, ending };
  },
});

/**
 * Turn a link off (drop) or back on. Off means the link and code stop working
 * for new visitors; members already credited to the holder stay credited.
 */
export const setActive = mutation({
  args: { id: v.id("brokerTrackingCodes"), active: v.boolean() },
  handler: async (ctx, args) => {
    const identity = await requireAccess(ctx, "links.manage");
    const code = await ctx.db.get(args.id);
    if (!code) throw new Error("Link not found.");
    if ((code.status === "active") === args.active) return;
    await ctx.db.patch(args.id, { status: args.active ? "active" : "revoked", updatedAt: Date.now() });
    const leader = await safeGet<"partnerLeaders">(ctx, code.brokerId);
    await recordAdminAction(ctx, identity, {
      action: args.active ? "link.turned_on" : "link.turned_off", targetType: "distributionPartner", targetId: code.agencyId,
      summary: `Turned ${args.active ? "on" : "off"} the link "${code.slug ?? code.code}"${leader ? ` for ${leader.name}` : ""}`,
      metadata: { code: code.code },
    });
  },
});
