/**
 * SERVICE AUTH — for calls into Convex from our own servers.
 *
 * Convex functions are reachable by anyone who has the deployment URL, and
 * that URL ships in the browser bundle. Stripe/Clerk/Resend/Twilio/Toothlens
 * webhooks land on Next.js routes that verify the sender's signature and then
 * call Convex with no user session — so the Convex function itself has to
 * know the call came from our server. It does that with a shared secret,
 * CONVEX_SERVICE_SECRET, set in both the Convex and Vercel environments.
 *
 * Fails closed: with the variable unset (or too short to be a real secret),
 * no call is treated as a service call.
 */

import { v } from "convex/values";
import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";
import { requireAccess, requireAccessAction } from "./authGuards";
import type { Permission } from "./access/catalog";

/** Add to `args` of any function our servers call without a user session. */
export const serviceSecretArg = v.optional(v.string());

const MIN_SECRET_LENGTH = 32;

/** Length-independent comparison, so timing doesn't leak how much matched. */
function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export function isServiceCall(secret: string | undefined | null): boolean {
  const expected = process.env.CONVEX_SERVICE_SECRET;
  if (!expected || expected.length < MIN_SECRET_LENGTH || !secret) return false;
  return safeEqual(secret, expected);
}

export function requireServiceSecret(secret: string | undefined | null): void {
  if (!isServiceCall(secret)) throw new Error("Unauthorized");
}

/** Our server, or the member themselves, or staff who can view members. */
export async function requireServiceOrOwner(
  ctx: QueryCtx | MutationCtx,
  secret: string | undefined | null,
  customerId: string,
): Promise<void> {
  if (isServiceCall(secret)) return;
  const identity = await ctx.auth.getUserIdentity();
  if (identity && identity.subject === customerId) return;
  await requireAccess(ctx, "members.view");
}

/** Our server, or staff holding one of `needed`. */
export async function requireServiceOrAccess(
  ctx: QueryCtx | MutationCtx,
  secret: string | undefined | null,
  needed: Permission | Permission[],
): Promise<void> {
  if (isServiceCall(secret)) return;
  await requireAccess(ctx, needed);
}

export async function requireServiceOrAccessAction(
  ctx: ActionCtx,
  secret: string | undefined | null,
  needed: Permission | Permission[],
): Promise<void> {
  if (isServiceCall(secret)) return;
  await requireAccessAction(ctx, needed);
}

/** For Convex code that calls one of these functions on our own behalf. */
export function ownServiceSecret(): string | undefined {
  return process.env.CONVEX_SERVICE_SECRET;
}
