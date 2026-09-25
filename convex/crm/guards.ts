/**
 * CRM ACCESS CONTROL — internal sales only.
 *
 * `requireStaffAdmin` (convex/lib/authGuards.ts) already excludes distribution
 * partners as of the broker-insights migration (commit 171948a) — /admin no
 * longer admits them at all, and `convex/insights/scope.ts` is where a
 * partner's OWN book gets narrowed for the /partner portal.
 *
 * The CRM does not reuse that partner-scoped pattern. There is no
 * partner-scoped slice of a prospect list that makes sense, for two reasons:
 *
 *   1. The prospect list, touch history and pipeline are the company's most
 *      sensitive commercial asset, and distribution partners sell competing
 *      products.
 *   2. Some CRM contacts ARE brokers. A partner reading their own record with
 *      a rep's candid notes on it is a business incident, not a bug.
 *
 * So the CRM guards are a thin, explicitly-named wrapper around
 * `requireStaffAdmin` rather than a shared partner/staff guard — the name at
 * each call site should say "this is sales data" on its own.
 *
 * If brokers ever need a CRM, it is a separate `/partner/crm` surface with its
 * own `ownerPartnerId` column and viewer-scope filtering — a project, not a
 * permission change.
 */

import type { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";
import { requireStaffAdmin, requireAuthAction, type AuthIdentity } from "../lib/authGuards";
import { internal } from "../_generated/api";

type AnyCtx = QueryCtx | MutationCtx;

export interface CrmIdentity extends AuthIdentity {
  isManager: boolean;
}

async function loadAdminUser(ctx: AnyCtx, clerkUserId: string) {
  return await (ctx as QueryCtx).db
    .query("adminUsers")
    .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", clerkUserId))
    .first();
}

/**
 * Require internal staff. Every CRM query/mutation/action should call this
 * (or `requireCrmManager`) first — do not call `requireStaffAdmin` or
 * `requireAdmin` directly in convex/crm/**, even though they'd technically
 * work, so a grep for "requireCrm" finds every CRM-gated function.
 */
export async function requireCrmUser(ctx: AnyCtx): Promise<CrmIdentity> {
  const identity = await requireStaffAdmin(ctx);
  const admin = await loadAdminUser(ctx, identity.clerkUserId);
  const isManager =
    admin?.role === "owner" || !!admin?.departments?.includes("executive");
  return { ...identity, isManager };
}

/**
 * Require a CRM manager: owner, or staff whose `departments` includes
 * "executive". Required for anything destructive or bulk: merge/delete
 * contacts, bulk ops over 500 rows, tag CATEGORY CRUD, campaign approval +
 * send, suppression removal, import rollback.
 */
export async function requireCrmManager(ctx: AnyCtx): Promise<CrmIdentity> {
  const identity = await requireCrmUser(ctx);
  if (!identity.isManager) {
    throw new Error("Unauthorized: CRM manager role required");
  }
  return identity;
}

/**
 * Action-context equivalent — actions can't touch ctx.db, so the staff/manager
 * check runs via ctx.runQuery(internal.crm.access.checkCrmAccessById), the
 * same indirection convex/lib/authGuards.ts:requireAdminAction uses.
 */
export async function requireCrmUserAction(ctx: ActionCtx): Promise<CrmIdentity> {
  const identity = await requireAuthAction(ctx);
  const { isStaff, isManager } = await ctx.runQuery(internal.crm.access.checkCrmAccessById, { clerkUserId: identity.clerkUserId });
  if (!isStaff) throw new Error("Unauthorized: Admin role required");
  return { ...identity, isManager };
}

export async function requireCrmManagerAction(ctx: ActionCtx): Promise<CrmIdentity> {
  const identity = await requireCrmUserAction(ctx);
  if (!identity.isManager) throw new Error("Unauthorized: CRM manager role required");
  return identity;
}
