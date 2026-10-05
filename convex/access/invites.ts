/**
 * INVITATIONS — create accounts for people and let them claim their access.
 *
 * An admin invites someone by email with one or more roles. They get a
 * single-use link (only its SHA-256 is stored) that expires in 14 days.
 * Opening it, they sign in or create a Clerk account; claiming then checks
 * that the Clerk account owns the invited email address — verified through
 * Clerk's API, not taken from the session token alone — before linking the
 * account and turning the roles on.
 */

import { action, internalMutation, mutation, query } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { requireAuthAction } from "../lib/authGuards";
import { getBaseUrl } from "../lib/env";
import { sendViaResend } from "../lib/resend";
import { EMAIL_TEMPLATES } from "../lib/emailTemplates";
import { PARTNER_ROLES, ROLE_INFO } from "../lib/access/catalog";
import {
  ensureBuiltInPacks,
  importLegacyForProfile,
  normalizeAccessEmail,
  provisionProfile,
  provisionRole,
  upsertProfile,
} from "../lib/access/provision";
import {
  assertCanChange,
  assertCanGrantPacks,
  auditAccess,
  describeRole,
  requireAccessManager,
  sha256Hex,
  validateRoleSpec,
} from "../lib/access/manage";
import { roleSpecValidator } from "./people";

export const INVITE_DAYS = 14;

function newToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sendInviteEmail(to: string, name: string, roles: string[], token: string) {
  const claimUrl = `${getBaseUrl()}/access/claim?token=${token}`;
  const { subject, html } = EMAIL_TEMPLATES["access-invite"].render({
    recipientName: name,
    roles,
    claimUrl,
    expiresInDays: INVITE_DAYS,
  });
  const result = await sendViaResend({ to, subject, html, category: "access-invite" });
  return { sent: result.success, error: result.error, claimUrl };
}

async function roleSummaries(ctx: MutationCtx, profileId: Id<"accessProfiles">) {
  const roles = await ctx.db
    .query("accessRoles")
    .withIndex("by_profile", (q) => q.eq("profileId", profileId))
    .collect();
  return await Promise.all(roles.filter((r) => r.status === "active").map((r) => describeRole(ctx, r)));
}

/**
 * Create (or extend) a person and their roles. Someone who has already
 * signed in gets the roles straight away; anyone else gets an invitation.
 */
export const _createInvitation = internalMutation({
  args: {
    email: v.string(),
    name: v.string(),
    phone: v.optional(v.string()),
    roles: v.array(roleSpecValidator),
    tokenHash: v.string(),
  },
  handler: async (ctx, args) => {
    const { identity, access } = await requireAccessManager(ctx);
    if (!args.roles.length) throw new Error("Give this person at least one role.");
    await ensureBuiltInPacks(ctx);
    const email = normalizeAccessEmail(args.email);
    const existing = await ctx.db
      .query("accessProfiles")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (existing) await assertCanChange(ctx, access, existing);
    if (existing?.status === "suspended") throw new Error("This person is suspended. Reactivate them before adding roles.");

    const profileId = existing?._id ?? (await upsertProfile(ctx, { email, name: args.name, phone: args.phone, status: "invited", actor: identity.clerkUserId }));
    const profile = (await ctx.db.get(profileId))!;
    const roles = [...(await ctx.db.query("accessRoles").withIndex("by_profile", (q) => q.eq("profileId", profileId)).collect())];
    const now = Date.now();
    const created: Id<"accessRoles">[] = [];
    for (const spec of args.roles) {
      const packs = await validateRoleSpec(ctx, spec, profile, roles);
      assertCanGrantPacks(access, packs);
      const roleId = await ctx.db.insert("accessRoles", {
        profileId,
        role: spec.role,
        partnerId: spec.partnerId,
        leaderId: spec.leaderId,
        groupId: spec.groupId,
        label: spec.label?.trim() || undefined,
        title: spec.title?.trim() || undefined,
        packIds: packs.map((p) => p._id),
        status: "active",
        createdBy: identity.clerkUserId,
        createdAt: now,
        updatedAt: now,
      });
      roles.push((await ctx.db.get(roleId))!);
      created.push(roleId);
    }

    const warnings: string[] = [];
    const needsInvite = profile.status === "invited";
    if (!needsInvite) {
      for (const roleId of created) {
        const warning = await provisionRole(ctx, roleId, identity.clerkUserId);
        if (warning) warnings.push(warning);
      }
    } else {
      await ctx.db.patch(profileId, {
        inviteTokenHash: args.tokenHash,
        inviteExpiry: now + INVITE_DAYS * 24 * 60 * 60 * 1000,
        invitedAt: now,
        invitedBy: identity.clerkUserId,
        updatedAt: now,
      });
    }
    const summaries = await Promise.all(created.map(async (id) => describeRole(ctx, (await ctx.db.get(id))!)));
    await auditAccess(ctx, identity, needsInvite ? "invite.create" : "role.add", `${needsInvite ? "Invited" : "Added roles for"} ${email}: ${summaries.join("; ")}`, { type: "accessProfiles", id: String(profileId) });
    return { profileId, needsInvite, name: profile.name, email, roles: await roleSummaries(ctx, profileId), warnings };
  },
});

export const invitePerson = action({
  args: {
    email: v.string(),
    name: v.string(),
    phone: v.optional(v.string()),
    roles: v.array(roleSpecValidator),
    sendEmail: v.boolean(),
  },
  handler: async (ctx, args): Promise<{
    profileId: Id<"accessProfiles">;
    invited: boolean;
    emailSent: boolean;
    emailError?: string;
    claimUrl?: string;
    warnings: string[];
  }> => {
    const token = newToken();
    const result = await ctx.runMutation(internal.access.invites._createInvitation, {
      email: args.email,
      name: args.name,
      phone: args.phone,
      roles: args.roles,
      tokenHash: await sha256Hex(token),
    });
    if (!result.needsInvite) {
      return { profileId: result.profileId, invited: false, emailSent: false, warnings: result.warnings };
    }
    if (!args.sendEmail) {
      return { profileId: result.profileId, invited: true, emailSent: false, claimUrl: `${getBaseUrl()}/access/claim?token=${token}`, warnings: result.warnings };
    }
    const email = await sendInviteEmail(result.email, result.name, result.roles, token);
    return {
      profileId: result.profileId,
      invited: true,
      emailSent: email.sent,
      emailError: email.error,
      // Only shown when the email did not go out, so the admin can pass it on.
      claimUrl: email.sent ? undefined : email.claimUrl,
      warnings: result.warnings,
    };
  },
});

export const _refreshInvitation = internalMutation({
  args: { profileId: v.id("accessProfiles"), tokenHash: v.string() },
  handler: async (ctx, args) => {
    const { identity, access } = await requireAccessManager(ctx);
    const profile = await ctx.db.get(args.profileId);
    if (!profile) throw new Error("Person not found");
    if (profile.status !== "invited") throw new Error("This person has already accepted their invitation.");
    await assertCanChange(ctx, access, profile);
    const now = Date.now();
    await ctx.db.patch(profile._id, {
      inviteTokenHash: args.tokenHash,
      inviteExpiry: now + INVITE_DAYS * 24 * 60 * 60 * 1000,
      invitedAt: now,
      invitedBy: identity.clerkUserId,
      updatedAt: now,
    });
    await auditAccess(ctx, identity, "invite.resend", `Sent a new invitation link to ${profile.email}`, { type: "accessProfiles", id: String(profile._id) });
    return { email: profile.email, name: profile.name, roles: await roleSummaries(ctx, profile._id) };
  },
});

/** Issue a fresh link (the old one stops working) and email it, or return it to copy. */
export const resendInvite = action({
  args: { profileId: v.id("accessProfiles"), sendEmail: v.boolean() },
  handler: async (ctx, args): Promise<{ emailSent: boolean; emailError?: string; claimUrl?: string }> => {
    const token = newToken();
    const result = await ctx.runMutation(internal.access.invites._refreshInvitation, {
      profileId: args.profileId,
      tokenHash: await sha256Hex(token),
    });
    if (!args.sendEmail) return { emailSent: false, claimUrl: `${getBaseUrl()}/access/claim?token=${token}` };
    const email = await sendInviteEmail(result.email, result.name, result.roles, token);
    return { emailSent: email.sent, emailError: email.error, claimUrl: email.sent ? undefined : email.claimUrl };
  },
});

export const revokeInvite = mutation({
  args: { profileId: v.id("accessProfiles") },
  handler: async (ctx, args) => {
    const { identity, access } = await requireAccessManager(ctx);
    const profile = await ctx.db.get(args.profileId);
    if (!profile || profile.status !== "invited") throw new Error("No pending invitation for this person.");
    await assertCanChange(ctx, access, profile);
    await ctx.db.patch(profile._id, { inviteTokenHash: undefined, inviteExpiry: undefined, updatedAt: Date.now() });
    await auditAccess(ctx, identity, "invite.revoke", `Cancelled the invitation link for ${profile.email}`, { type: "accessProfiles", id: String(profile._id) });
    return null;
  },
});

async function profileForToken(ctx: { db: QueryCtx["db"] }, token: string): Promise<Doc<"accessProfiles"> | null> {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const hash = await sha256Hex(token);
  return await ctx.db
    .query("accessProfiles")
    .withIndex("by_invite_token", (q) => q.eq("inviteTokenHash", hash))
    .first();
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 2)}${"•".repeat(Math.max(1, local.length - 2))}@${domain}`;
}

/** What an invitation link is for, shown on the claim page before sign-in. */
export const getInvitation = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const profile = await profileForToken(ctx, args.token);
    if (!profile || profile.status !== "invited") return { state: "invalid" as const };
    if (!profile.inviteExpiry || profile.inviteExpiry < Date.now()) return { state: "expired" as const };
    const roles = await ctx.db
      .query("accessRoles")
      .withIndex("by_profile", (q) => q.eq("profileId", profile._id))
      .collect();
    return {
      state: "valid" as const,
      name: profile.name,
      email: maskEmail(profile.email),
      roles: await Promise.all(roles.filter((r) => r.status === "active").map((r) => describeRole(ctx, r))),
    };
  },
});

/** Where a newly claimed person should land first. */
function homeFor(roles: Doc<"accessRoles">[]): string {
  const active = roles.filter((r) => r.status === "active");
  if (active.some((r) => r.role === "staff")) return "/admin";
  if (active.some((r) => PARTNER_ROLES.includes(r.role))) return "/partner";
  if (active.some((r) => r.role === "organization")) return "/employer/upload";
  return "/access";
}

export const _claim = internalMutation({
  args: { token: v.string(), clerkUserId: v.string(), verifiedEmails: v.array(v.string()) },
  handler: async (ctx, args) => {
    const profile = await profileForToken(ctx, args.token);
    if (!profile || profile.status !== "invited") throw new Error("This invitation link is not valid. Ask for a new one.");
    if (!profile.inviteExpiry || profile.inviteExpiry < Date.now()) throw new Error("This invitation has expired. Ask for a new one.");
    if (!args.verifiedEmails.includes(profile.email)) {
      throw new Error(`Sign in with ${maskEmail(profile.email)} (verified) to accept this invitation.`);
    }
    const linked = await ctx.db
      .query("accessProfiles")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();
    if (linked && linked._id !== profile._id) {
      throw new Error("Your account already has access under another email. Ask an admin to add these roles to it.");
    }
    const now = Date.now();
    await ctx.db.patch(profile._id, {
      clerkUserId: args.clerkUserId,
      status: "active",
      claimedAt: now,
      inviteTokenHash: undefined,
      inviteExpiry: undefined,
      updatedAt: now,
    });
    // Bring along anything this account already had (staff, partner, uploads).
    await importLegacyForProfile(ctx, profile._id);
    const warnings = await provisionProfile(ctx, profile._id, args.clerkUserId);
    await auditAccess(ctx, { clerkUserId: args.clerkUserId }, "invite.claim", `${profile.email} accepted their invitation`, { type: "accessProfiles", id: String(profile._id) });
    const roles = await ctx.db
      .query("accessRoles")
      .withIndex("by_profile", (q) => q.eq("profileId", profile._id))
      .collect();
    return { home: homeFor(roles), warnings, roles: roles.filter((r) => r.status === "active").map((r) => ROLE_INFO[r.role].label) };
  },
});

/**
 * Accept an invitation as the signed-in user. Email ownership is checked
 * against Clerk's record of verified addresses when the Clerk secret is
 * configured; otherwise the session's verified email is used.
 */
export const claimInvitation = action({
  args: { token: v.string() },
  handler: async (ctx, args): Promise<{ home: string; warnings: string[]; roles: string[] }> => {
    const identity = await requireAuthAction(ctx);
    const verifiedEmails = await verifiedEmailsFor(identity.clerkUserId);
    const fallback = await ctx.auth.getUserIdentity();
    const emails =
      verifiedEmails ??
      (fallback?.email && fallback.emailVerified !== false ? [fallback.email.trim().toLowerCase()] : []);
    return await ctx.runMutation(internal.access.invites._claim, {
      token: args.token,
      clerkUserId: identity.clerkUserId,
      verifiedEmails: emails,
    });
  },
});

async function verifiedEmailsFor(clerkUserId: string): Promise<string[] | null> {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) return null;
  const response = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(clerkUserId)}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (!response.ok) throw new Error("Could not verify your account. Try again.");
  const user = await response.json();
  if (user.id !== clerkUserId) throw new Error("Could not verify your account.");
  return (user.email_addresses ?? [])
    .filter((e: { verification?: { status?: string } }) => e.verification?.status === "verified")
    .map((e: { email_address: string }) => e.email_address.trim().toLowerCase());
}
