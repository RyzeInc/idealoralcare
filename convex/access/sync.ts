/**
 * IMPORT EXISTING ACCOUNTS — turn the access people already have (staff
 * rows, partner people, partner contacts, employer upload grants) into
 * access profiles and roles, so packs can be reviewed and narrowed.
 *
 * Nothing changes for anyone on import: owners get the Owner pack, editors
 * the legacy console pack (plus CRM manager for the executive department),
 * partners the legacy portal pack, organization contacts the uploads pack.
 * Runs in batches; the admin page calls it until every source is done.
 */

import { mutation, query } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { importLegacyForProfile, upsertProfile, ensureBuiltInPacks } from "../lib/access/provision";
import { auditAccess, requireAccessManager } from "../lib/access/manage";

const SOURCES = ["staff", "leaders", "contacts", "grants"] as const;
type Source = (typeof SOURCES)[number];
const BATCH = 50;

export const syncStatus = query({
  args: {},
  handler: async (ctx) => {
    await requireAccessManager(ctx);
    const profiles = await ctx.db.query("accessProfiles").collect();
    const byClerk = new Set(profiles.map((p) => p.clerkUserId).filter(Boolean));
    const byEmail = new Set(profiles.map((p) => p.email));
    const staff = (await ctx.db.query("adminUsers").collect()).filter((a) => !byClerk.has(a.clerkUserId)).length;
    const leaders = (await ctx.db.query("partnerLeaders").collect()).filter((l) => l.clerkUserId && !byClerk.has(l.clerkUserId)).length;
    const contacts = (await ctx.db.query("distributionPartners").collect()).filter((p) => p.clerkUserId && !byClerk.has(p.clerkUserId)).length;
    const grants = (await ctx.db.query("eligibilityIntakeAccess").collect()).filter((g) => !byEmail.has(g.email)).length;
    return { profiles: profiles.length, notImported: { staff, leaders, contacts, grants } };
  },
});

async function importOne(ctx: MutationCtx, row: { email?: string; name?: string; phone?: string; clerkUserId?: string }) {
  if (!row.email?.includes("@")) return false;
  try {
    const profileId = await upsertProfile(ctx, {
      email: row.email,
      name: row.name ?? row.email,
      phone: row.phone,
      clerkUserId: row.clerkUserId,
      status: row.clerkUserId ? "active" : "invited",
    });
    await importLegacyForProfile(ctx, profileId);
    return true;
  } catch {
    return false;
  }
}

export const importBatch = mutation({
  args: {
    source: v.union(v.literal("staff"), v.literal("leaders"), v.literal("contacts"), v.literal("grants")),
    cursor: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireAccessManager(ctx);
    await ensureBuiltInPacks(ctx);
    let imported = 0;
    let skipped = 0;
    const count = (ok: boolean) => (ok ? imported++ : skipped++);
    const page = { numItems: BATCH, cursor: args.cursor };
    let result: { isDone: boolean; continueCursor: string };
    if (args.source === "staff") {
      const r = await ctx.db.query("adminUsers").paginate(page);
      for (const a of r.page) count(await importOne(ctx, { email: a.email, name: a.name, phone: a.phone, clerkUserId: a.clerkUserId }));
      result = r;
    } else if (args.source === "leaders") {
      const r = await ctx.db.query("partnerLeaders").paginate(page);
      for (const l of r.page) if (l.clerkUserId) count(await importOne(ctx, { email: l.email, name: l.name, phone: l.phone, clerkUserId: l.clerkUserId }));
      result = r;
    } else if (args.source === "contacts") {
      const r = await ctx.db.query("distributionPartners").paginate(page);
      for (const p of r.page) if (p.clerkUserId) count(await importOne(ctx, { email: p.contactEmail, name: p.contactName, phone: p.contactPhone, clerkUserId: p.clerkUserId }));
      result = r;
    } else {
      const r = await ctx.db.query("eligibilityIntakeAccess").paginate(page);
      for (const g of r.page) count(await importOne(ctx, { email: g.email, clerkUserId: g.clerkUserId }));
      result = r;
    }
    const next = SOURCES[SOURCES.indexOf(args.source as Source) + 1] ?? null;
    if (result.isDone && !next) {
      await auditAccess(ctx, identity, "import", "Imported existing accounts into access profiles");
    }
    return {
      imported,
      skipped,
      source: result.isDone ? next : args.source,
      cursor: result.isDone ? null : result.continueCursor,
      done: result.isDone && !next,
    };
  },
});
