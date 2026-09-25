import { action, internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";
import { requireAdmin, requireAdminAction } from "./lib/authGuards";
import { sendViaResend } from "./lib/resend";
import { getBaseUrl } from "./lib/env";

/**
 * PARTNER PIPELINE — Lead → Application (self-serve invite)
 *
 * Turns a Partner Kit Lead (partnerRegistrations) into a Partner Application
 * by emailing the lead a prefilled /register/rep link. When they submit, the
 * application (repOnboardingSubmissions) auto-links back to the lead — see the
 * `leadToken` handling in convex/repOnboarding.ts:submit.
 */

const makeToken = () =>
  `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;

// ─── invite email ──────────────────────────────────────────────────────

const INVITE_SUBJECT = "Complete your Ideal Oral Health partner application";

/**
 * Pure renderer for the Partner Application invite email. Shared by the real
 * send, the test send, and the dev-tools preview so the "debug" view always
 * matches exactly what recipients get.
 */
export function renderApplicationInviteEmail(opts: {
  recipientName: string;
  business?: string;
  applyUrl: string;
}): { subject: string; html: string } {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <div style="background: linear-gradient(135deg, #0066CC 0%, #14b8a6 100%); color: white; padding: 24px 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">Complete Your Partner Application</h1>
        <p style="margin: 10px 0 0 0; font-size: 15px; opacity: 0.9;">Ideal Oral Health</p>
      </div>
      <div style="padding: 32px; background: #f9fafb; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px;">Hi ${opts.recipientName},</p>
        <p style="font-size: 15px; line-height: 1.6;">
          Thanks for your interest in partnering with <strong>Ideal Oral Health</strong>${
            opts.business ? ` on behalf of <strong>${opts.business}</strong>` : ""
          }.
          To move forward, please complete your broker / agency application. We've
          pre-filled what we already have — it only takes a few minutes.
        </p>
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; margin: 24px 0; text-align: center;">
          <a href="${opts.applyUrl}"
            style="display: inline-block; padding: 14px 32px; background: #0066CC; color: white; font-weight: 700; font-size: 16px; text-decoration: none; border-radius: 8px;">
            Complete My Application
          </a>
          <p style="font-size: 12px; color: #9ca3af; margin: 16px 0 0 0;">This link expires in 30 days.</p>
        </div>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="font-size: 13px; color: #6b7280; line-height: 1.5;">
          Questions? Contact us at
          <a href="mailto:support@getidealoh.com" style="color: #0066CC;">support@getidealoh.com</a>.
        </p>
      </div>
    </div>`;
  return { subject: INVITE_SUBJECT, html };
}

async function dispatchApplicationInviteEmail(opts: {
  recipientName: string;
  recipientEmail: string;
  business?: string;
  applyUrl: string;
}): Promise<{ ok: boolean; error?: string; html: string; subject: string }> {
  const { subject, html } = renderApplicationInviteEmail(opts);
  const result = await sendViaResend({
    to: opts.recipientEmail,
    subject,
    html,
    category: "partner-invite",
  });
  return { ok: result.success, error: result.error, html, subject };
}

// ─── internal: stamp the lead as invited ───────────────────────────────

export const _markLeadInvited = internalMutation({
  args: {
    leadId: v.id("partnerRegistrations"),
    inviteToken: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.leadId, {
      inviteToken: args.inviteToken,
      inviteStatus: "pending",
      invitedAt: Date.now(),
      status: "invited",
    });
  },
});

// ─── public query: prefill the /register/rep form from an invite token ──

export const getLeadByInviteToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const lead = await ctx.db
      .query("partnerRegistrations")
      .withIndex("by_invite_token", (q) => q.eq("inviteToken", args.token))
      .first();
    if (!lead) return null;
    // Only expose the safe prefill fields — this is an unauthenticated query.
    return {
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      business: lead.business,
      inviteStatus: lead.inviteStatus ?? null,
    };
  },
});

// ─── admin action: send a Partner Application invite to a lead ──────────

export const sendApplicationInvite = action({
  args: { leadId: v.id("partnerRegistrations") },
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: boolean; inviteSent: boolean; error?: string }> => {
    // @ts-ignore — isAdmin query reference
    const identity = await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);

    // @ts-ignore
    const lead: any = await ctx.runQuery(api.partnerPipeline.getLeadById, {
      leadId: args.leadId,
    });
    if (!lead) throw new Error("Lead not found");

    const token = makeToken();
    await ctx.runMutation(internal.partnerPipeline._markLeadInvited, {
      leadId: args.leadId,
      inviteToken: token,
    });

    const applyUrl = `${getBaseUrl()}/register/rep?leadToken=${token}`;
    const emailResult = await dispatchApplicationInviteEmail({
      recipientName: lead.name,
      recipientEmail: lead.email,
      business: lead.business,
      applyUrl,
    });

    await ctx.runMutation(internal.admin.adminAudit.record, {
      actorClerkUserId: identity.clerkUserId,
      action: "partner_lead.invite_sent",
      targetType: "partnerRegistrations",
      targetId: args.leadId,
      summary: `Sent Partner Application invite to ${lead.email}${
        emailResult.ok ? "" : " (email delivery failed)"
      }`,
      // Full rendered email is stored so it can be reviewed from the audit log
      // and the Dev Tools debug view.
      metadata: {
        applyUrl,
        emailOk: emailResult.ok,
        error: emailResult.error,
        to: lead.email,
        subject: emailResult.subject,
        emailHtml: emailResult.html,
      },
    });

    return { ok: true, inviteSent: emailResult.ok, error: emailResult.error };
  },
});

// ─── debug: preview the invite email without sending ───────────────────

export const previewApplicationInviteEmail = query({
  args: {
    name: v.optional(v.string()),
    business: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const applyUrl = `${getBaseUrl()}/register/rep?leadToken=EXAMPLE_TOKEN`;
    return renderApplicationInviteEmail({
      recipientName: args.name?.trim() || "there",
      business: args.business?.trim() || undefined,
      applyUrl,
    });
  },
});

// ─── debug: send a test invite email to an arbitrary address ───────────

export const sendTestApplicationInvite = action({
  args: {
    to: v.string(),
    name: v.optional(v.string()),
    business: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: boolean; error?: string; to: string; subject: string; html: string; baseUrl: string }> => {
    // @ts-ignore — isAdmin query reference
    const identity = await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);

    const to = args.to.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) {
      throw new Error("Please provide a valid destination email address.");
    }

    const baseUrl = getBaseUrl();
    const applyUrl = `${baseUrl}/register/rep?leadToken=TEST_TOKEN`;
    const emailResult = await dispatchApplicationInviteEmail({
      recipientName: args.name?.trim() || "there",
      recipientEmail: to,
      business: args.business?.trim() || undefined,
      applyUrl,
    });

    await ctx.runMutation(internal.admin.adminAudit.record, {
      actorClerkUserId: identity.clerkUserId,
      action: "partner_lead.invite_test",
      targetType: "partnerRegistrations",
      summary: `Sent TEST Partner Application invite to ${to}${emailResult.ok ? "" : " (delivery failed)"}`,
      metadata: {
        to,
        subject: emailResult.subject,
        emailOk: emailResult.ok,
        error: emailResult.error,
        baseUrl,
        emailHtml: emailResult.html,
      },
    });

    return {
      ok: emailResult.ok,
      error: emailResult.error,
      to,
      subject: emailResult.subject,
      html: emailResult.html,
      baseUrl,
    };
  },
});

// ─── helper query for the action (single lead) ─────────────────────────

export const getLeadById = query({
  args: { leadId: v.id("partnerRegistrations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.leadId);
  },
});

// ─── retroactive backfill — link historical leads / applications / kits ─
//
// Matches existing records by email (case-insensitive) and populates the
// pipeline link fields that were added after these rows already existed:
//   • application.sourceLeadId              (+ lead.convertedToApplicationId / status)
//   • kit.matchedApplicationId              (+ application.partnerKitSubmissionId)
//   • kit.matchedLeadId
// Idempotent: only fills a link when it is currently empty. Pass dryRun to
// preview counts without writing.

export const backfillPipelineLinks = mutation({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const dryRun = args.dryRun === true;
    const now = Date.now();

    const [apps, kits, leads] = await Promise.all([
      ctx.db.query("repOnboardingSubmissions").collect(),
      ctx.db.query("partnerKitSubmissions").collect(),
      ctx.db.query("partnerRegistrations").collect(),
    ]);

    const norm = (e?: string | null) => (e ? e.trim().toLowerCase() : "");

    // email → earliest lead (the original registration)
    const leadByEmail = new Map<string, any>();
    for (const l of [...leads].sort((a, b) => a.createdAt - b.createdAt)) {
      const key = norm(l.email);
      if (key && !leadByEmail.has(key)) leadByEmail.set(key, l);
    }

    // email → earliest application (keyed by both contact + rep email)
    const appByEmail = new Map<string, any>();
    for (const a of [...apps].sort((x, y) => x.createdAt - y.createdAt)) {
      for (const key of [norm(a.primaryContactEmail), norm(a.repEmail)]) {
        if (key && !appByEmail.has(key)) appByEmail.set(key, a);
      }
    }

    const summary = {
      dryRun,
      applicationsLinkedToLead: 0,
      leadsMarkedConverted: 0,
      kitsLinkedToApplication: 0,
      kitsLinkedToLead: 0,
    };

    // 1. Applications → source lead (+ close the loop on the lead)
    for (const app of apps) {
      if (app.sourceLeadId) continue;
      const lead = leadByEmail.get(norm(app.primaryContactEmail)) ?? leadByEmail.get(norm(app.repEmail));
      if (!lead) continue;
      summary.applicationsLinkedToLead++;
      if (!dryRun) await ctx.db.patch(app._id, { sourceLeadId: lead._id, updatedAt: now });
      if (!lead.convertedToApplicationId) {
        summary.leadsMarkedConverted++;
        if (!dryRun) {
          await ctx.db.patch(lead._id, {
            convertedToApplicationId: app._id,
            inviteStatus: "claimed",
            status: "converted",
          });
        }
      }
    }

    // 2. Kits → application (both directions) and → lead
    for (const kit of kits) {
      const key = norm(kit.email);
      if (!key) continue;

      const app = appByEmail.get(key);
      if (app && !kit.matchedApplicationId) {
        summary.kitsLinkedToApplication++;
        if (!dryRun) await ctx.db.patch(kit._id, { matchedApplicationId: app._id, updatedAt: now });
        if (!app.partnerKitSubmissionId && !dryRun) {
          await ctx.db.patch(app._id, { partnerKitSubmissionId: kit._id, updatedAt: now });
        }
      }

      const lead = leadByEmail.get(key);
      if (lead && !kit.matchedLeadId) {
        summary.kitsLinkedToLead++;
        if (!dryRun) await ctx.db.patch(kit._id, { matchedLeadId: lead._id, updatedAt: now });
      }
    }

    return summary;
  },
});
