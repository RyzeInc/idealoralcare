/**
 * ELIGIBILITY → CLERK + ENTITLEMENT PROVISIONING
 *
 * Closes the loop on the eligibility upload pipeline:
 *
 *   Uploaded eligibility file → memberProfiles (memberType="eligible")
 *      ↓ (this module)
 *   Clerk users created (via invitation OR direct user create)
 *      ↓
 *   subscriptionBundle (employer-paid, no Stripe) + entitlements
 *      ↓
 *   Member can sign in and immediately has plan access
 *
 * Entry points:
 *   - getProvisionableMembersForFile (query) — list eligible-but-unprovisioned members
 *   - provisionEligibilityFile (action) — bulk provision Clerk + entitlements
 *   - provisionSingleMember (action) — provision one member (admin retry)
 *
 * Configuration: requires CLERK_SECRET_KEY env var on the Convex deployment.
 *
 * Provisioning mode:
 *   - "invite" (default): sends a Clerk invitation email; user sets password on first sign-in.
 *     The Clerk user_id is created when the invitation is accepted, so we link via
 *     the public_metadata.memberProfileId we attach on the invitation.
 *   - "create": creates the Clerk user immediately with a temporary password (no email).
 *     We get the user_id back synchronously and link the memberProfile right away.
 */

import { action, internalMutation, internalQuery, internalAction, query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import { requireAdmin, requireAdminAction } from "../lib/authGuards";

const BATCH_DELAY_MS = 250; // small stagger between Clerk API calls

// ─────────────────────────────────────────────────────────────────────
// QUERIES
// ─────────────────────────────────────────────────────────────────────

/**
 * List members from an eligibility file that are ready to be provisioned.
 * "Ready" = memberType "eligible", has email, no customerId yet (no Clerk link).
 */
export const getProvisionableMembersForFile = query({
  args: { fileId: v.id("eligibilityFiles") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const all = await ctx.db
      .query("memberProfiles")
      .filter((q) => q.eq(q.field("eligibilityFileId"), args.fileId))
      .collect();
    const provisionable = all.filter(
      (m) => !!m.email && !m.customerId && (m.memberType === "eligible" || m.memberType === "lead")
    );
    return {
      total: all.length,
      provisionable: provisionable.length,
      alreadyProvisioned: all.filter((m) => !!m.customerId).length,
      missingEmail: all.filter((m) => !m.email).length,
      members: provisionable.map((m) => ({
        _id: m._id,
        memberId: m.memberId,
        firstName: m.firstName,
        lastName: m.lastName,
        email: m.email,
        groupId: m.groupId,
        accountId: m.accountId,
        siteId: m.siteId,
        memberRole: (m as any).memberRole ?? "primary",
        primaryMemberId: (m as any).primaryMemberId ?? null,
        relationship: (m as any).relationship ?? null,
      })),
    };
  },
});

/**
 * Look up the right product for an employer-paid bundle.
 * Defaults to Family ($24.99 catalog) if dependents exist, Individual otherwise.
 * Both products are free for the member because the employer remits payment.
 */
async function pickEmployerProduct(ctx: any, hasDependents: boolean) {
  const slug = hasDependents ? "oral-health-family" : "oral-health-individual";
  const direct = await ctx.db
    .query("catalogProducts")
    .withIndex("by_slug", (q: any) => q.eq("slug", slug))
    .first();
  if (direct) return direct;
  // Fallback: any visible product
  const fallback = await ctx.db
    .query("catalogProducts")
    .withIndex("by_visible", (q: any) => q.eq("isVisible", true))
    .first();
  return fallback;
}

// ─────────────────────────────────────────────────────────────────────
// INTERNAL MUTATIONS
// ─────────────────────────────────────────────────────────────────────

/**
 * Link a memberProfile to a Clerk user and provision an employer-paid bundle
 * + entitlement for the appropriate plan. Idempotent on the bundle: if an
 * active employer bundle already exists for this customerId, no new bundle
 * is created (but the memberProfile is still linked).
 */
export const linkAndProvisionEmployerAccess = internalMutation({
  args: {
    memberProfileId: v.id("memberProfiles"),
    clerkUserId: v.string(),
    fileId: v.id("eligibilityFiles"),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.memberProfileId);
    if (!profile) throw new Error("Member profile not found");

    const group = await ctx.db.get(profile.groupId);
    if (!group) throw new Error("Group not found");

    const now = Date.now();
    const isDependent = (profile as any).memberRole === "dependent";

    // 1. Link Clerk user to memberProfile
    await ctx.db.patch(args.memberProfileId, {
      customerId: args.clerkUserId,
      memberType: "active",
      enrolledAt: (profile as any).enrolledAt ?? now,
      listBillStatus: (group as any).listBill?.enabled ? "active" : (profile as any).listBillStatus,
      employeeType: (profile as any).employeeType ?? ((group as any).listBill?.enabled ? "full_time" : undefined),
      updatedAt: now,
    });

    // 2. Dependents share the primary's bundle — no separate billing row
    if (isDependent) {
      await ctx.db.insert("memberActivities", {
        memberProfileId: args.memberProfileId,
        siteId: profile.siteId,
        groupId: profile.groupId,
        activityType: "enrollment_completed",
        title: "Dependent provisioned via eligibility file",
        description: `Clerk account ${args.clerkUserId} linked; access inherited from primary member's bundle`,
        actorType: "system",
        createdAt: now,
      });
      return { bundleId: null, created: false };
    }

    // 3. Skip if there is already an active bundle for this Clerk user
    const existingBundle = (await ctx.db.query("subscriptionBundles").collect()).find(
      (b) => b.customerId === args.clerkUserId && (b.status === "active" || b.status === "draft")
    );
    if (existingBundle) {
      return { bundleId: existingBundle._id, created: false };
    }

    // 3. Pick product (Family if dependents present, else Individual)
    const hasDependents = Array.isArray((profile as any).dependents) && (profile as any).dependents.length > 0;
    const product = await pickEmployerProduct(ctx, hasDependents);
    if (!product) {
      throw new Error("No catalog product available for employer-paid bundle");
    }

    // Default coverage period: 1 year from effectiveDate (or now)
    const effectiveDate = profile.effectiveDate
      ? Date.parse(profile.effectiveDate as string) || now
      : now;
    const periodEnd = effectiveDate + 365 * 24 * 60 * 60 * 1000;

    // 4. Create employer-paid bundle (no Stripe — settled via list-bill)
    const bundleId = await ctx.db.insert("subscriptionBundles", {
      customerId: args.clerkUserId,
      cadence: "monthly",
      paymentMethod: "ach", // employer remits via ACH or check
      stripeCustomerId: `employer_listbill_${profile.groupId}`,
      stripeSubscriptionId: undefined,
      status: "active",
      currentPeriodStart: effectiveDate,
      currentPeriodEnd: periodEnd,
      pricingSnapshot: {
        cadence: "monthly",
        paymentMethod: "ach",
        totalCents: 0, // member pays $0; employer is invoiced separately
        planCount: 1,
        capturedAt: now,
      },
      createdAt: now,
      updatedAt: now,
      activatedAt: now,
    });

    // 5. Create entitlement
    await ctx.db.insert("entitlements", {
      customerId: args.clerkUserId,
      bundleId,
      productId: product._id,
      periodStart: effectiveDate,
      periodEnd,
      status: "active",
      endCondition: "renew",
      createdAt: now,
      activatedAt: now,
      expiresAt: periodEnd,
      createdVia: "admin_action",
      notes: `Employer-paid (list-bill) provisioning from eligibility file ${args.fileId}`,
    });

    // 6. Activity log on the member
    await ctx.db.insert("memberActivities", {
      memberProfileId: args.memberProfileId,
      siteId: profile.siteId,
      groupId: profile.groupId,
      activityType: "enrollment_completed",
      title: "Provisioned via eligibility file",
      description: `Clerk account ${args.clerkUserId} linked, employer-paid ${product.slug} entitlement created`,
      actorType: "system",
      createdAt: now,
    });

    return { bundleId, created: true, productSlug: product.slug };
  },
});

/**
 * Mark a member as failed-to-provision and record the error on the file.
 */
export const recordProvisioningError = internalMutation({
  args: {
    fileId: v.id("eligibilityFiles"),
    memberProfileId: v.optional(v.id("memberProfiles")),
    email: v.optional(v.string()),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const file = await ctx.db.get(args.fileId);
    if (!file) return;
    const errors = file.errors ?? [];
    errors.push({
      row: -1,
      field: args.email,
      message: `Provisioning failed${args.email ? ` for ${args.email}` : ""}: ${args.message}`,
    });
    await ctx.db.patch(args.fileId, { errors });
  },
});

// ─────────────────────────────────────────────────────────────────────
// ACTIONS — Clerk REST integration
// ─────────────────────────────────────────────────────────────────────

type ProvisionResult = {
  attempted: number;
  succeeded: number;
  failed: number;
  alreadyLinked: number;
  errors: Array<{ email: string; message: string }>;
};

/**
 * Bulk provision Clerk accounts + employer entitlements for every
 * eligible-but-unlinked member that came from a given eligibility file.
 *
 * mode:
 *   - "invite": sends Clerk invitation email; member sets password on accept
 *   - "create": creates user immediately (no email); admin distributes credentials
 */
export const provisionEligibilityFile = action({
  args: {
    fileId: v.id("eligibilityFiles"),
    mode: v.optional(v.union(v.literal("invite"), v.literal("create"))),
  },
  handler: async (ctx, args): Promise<ProvisionResult> => {
    try {
      // @ts-ignore - same pattern as elsewhere to avoid deep instantiation
      await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);
    } catch (authErr: any) {
      console.error("[provisionEligibilityFile] Auth check failed:", authErr?.message ?? authErr);
      throw authErr;
    }

    const secret = process.env.CLERK_SECRET_KEY;
    if (!secret) {
      const err = new Error("CLERK_SECRET_KEY env var is not set on Convex deployment");
      console.error("[provisionEligibilityFile]", err.message);
      throw err;
    }

    const mode = args.mode ?? "invite";

    let list: any;
    try {
      list = await ctx.runQuery(
        api.admin.eligibilityProvisioning.getProvisionableMembersForFile,
        { fileId: args.fileId }
      );
    } catch (queryErr: any) {
      console.error("[provisionEligibilityFile] Query failed:", queryErr?.message ?? queryErr);
      throw new Error(`Failed to fetch provisioning members: ${queryErr?.message ?? queryErr}`);
    }

    const result: ProvisionResult = {
      attempted: list.members.length,
      succeeded: 0,
      failed: 0,
      alreadyLinked: list.alreadyProvisioned,
      errors: [],
    };

    for (const m of list.members) {
      try {
        const email: string = m.email;
        if (!email) {
          result.failed++;
          result.errors.push({ email: "(missing)", message: "No email on member" });
          continue;
        }

        let clerkUserId: string | null = null;

        // 1. Try to find an existing Clerk user with this email first
        const lookupRes = await fetch(
          `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}&limit=1`,
          { headers: { Authorization: `Bearer ${secret}` } }
        );
        if (lookupRes.ok) {
          const found: any = await lookupRes.json();
          const arr = Array.isArray(found) ? found : found.data ?? [];
          if (arr.length > 0 && arr[0].id) {
            clerkUserId = arr[0].id;
          }
        }

        // 2. If not found, either invite or create
        if (!clerkUserId) {
          if (mode === "invite") {
            // We send our own branded "Set Your Password" welcome email
            // (Resend, with Careington/DialCare compliance language) instead
            // of Clerk's default invitation email — so notify: false here.
            const inviteRes = await fetch("https://api.clerk.com/v1/invitations", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${secret}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                email_address: email,
                public_metadata: {
                  memberProfileId: m._id,
                  groupId: m.groupId,
                  source: "eligibility_file",
                  fileId: args.fileId,
                },
                notify: false,
                ignore_existing: true,
              }),
            });
            if (!inviteRes.ok) {
              const text = await inviteRes.text();
              throw new Error(`Clerk invite ${inviteRes.status}: ${text.slice(0, 240)}`);
            }
            const invitation: any = await inviteRes.json();
            const invitationUrl: string | undefined = invitation?.url;

            // Send our branded set-password welcome email via Resend.
            // We swallow email failures so a transient Resend outage doesn't
            // roll back the invitation — the admin can resend from the UI.
            if (invitationUrl) {
              const memberName =
                [m.firstName, m.lastName].filter(Boolean).join(" ").trim() ||
                email;
              const sponsorName: string | undefined =
                (await ctx.runQuery(
                  internal.admin.eligibilityProvisioning.getGroupName,
                  { groupId: m.groupId }
                )) ?? undefined;
              try {
                await ctx.runAction(
                  api.legal.emailFulfillment
                    .sendEligibilityWelcomeSetPasswordEmail,
                  {
                    memberName,
                    memberEmail: email,
                    invitationUrl,
                    sponsorName,
                  }
                );
              } catch (emailErr: any) {
                console.error(
                  `[provisionEligibilityFile] welcome email failed for ${email}:`,
                  emailErr?.message ?? emailErr
                );
              }
            } else {
              console.error(
                `[provisionEligibilityFile] Clerk invitation for ${email} returned no url; skipping welcome email`
              );
            }

            // Invitations don't yield a user_id; member will be linked when
            // they accept (via the Clerk webhook → linkInvitedMember below).
            // Record the invitation on the member so we know it's pending.
            await ctx.runMutation(internal.admin.eligibilityProvisioning.markInvited, {
              memberProfileId: m._id,
              fileId: args.fileId,
            });
            result.succeeded++;
            await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
            continue;
          }

          // mode === "create"
          const tempPassword = generateTempPassword();
          const createRes = await fetch("https://api.clerk.com/v1/users", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${secret}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email_address: [email],
              first_name: m.firstName,
              last_name: m.lastName,
              password: tempPassword,
              skip_password_checks: true,
              skip_password_requirement: false,
              public_metadata: {
                memberProfileId: m._id,
                groupId: m.groupId,
                source: "eligibility_file",
                fileId: args.fileId,
              },
            }),
          });
          if (!createRes.ok) {
            const text = await createRes.text();
            throw new Error(`Clerk create ${createRes.status}: ${text.slice(0, 240)}`);
          }
          const created: any = await createRes.json();
          clerkUserId = created?.id;
          if (!clerkUserId) throw new Error("Clerk create succeeded but returned no id");
        }

        // 3. Link + provision employer-paid bundle
        await ctx.runMutation(internal.admin.eligibilityProvisioning.linkAndProvisionEmployerAccess, {
          memberProfileId: m._id,
          clerkUserId,
          fileId: args.fileId,
        });
        result.succeeded++;
      } catch (err: any) {
        result.failed++;
        const msg = err?.message ?? String(err);
        result.errors.push({ email: m.email ?? "(unknown)", message: msg });
        await ctx.runMutation(internal.admin.eligibilityProvisioning.recordProvisioningError, {
          fileId: args.fileId,
          memberProfileId: m._id,
          email: m.email,
          message: msg,
        });
      }
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }

    // Audit-log a single bulk-provision summary entry for this run.
    try {
      const ident = await ctx.auth.getUserIdentity();
      if (ident?.subject) {
        await ctx.runMutation(
          internal.admin.eligibilityProvisioning.recordProvisioningSummary,
          {
            actorClerkUserId: ident.subject,
            fileId: args.fileId,
            mode,
            attempted: result.attempted,
            succeeded: result.succeeded,
            failed: result.failed,
            alreadyLinked: result.alreadyLinked,
          },
        );
      }
    } catch (auditErr: any) {
      // Audit logging is best-effort; never fail the provisioning run on it
      console.error("[provisionEligibilityFile] Audit logging failed:", auditErr?.message ?? auditErr);
    }

    return result;
  },
});

/**
 * Audit-log helper for the bulk provisioning action (actions cannot write to
 * the DB directly, so they invoke this internal mutation).
 */
export const recordProvisioningSummary = internalMutation({
  args: {
    actorClerkUserId: v.string(),
    fileId: v.id("eligibilityFiles"),
    mode: v.union(v.literal("invite"), v.literal("create")),
    attempted: v.number(),
    succeeded: v.number(),
    failed: v.number(),
    alreadyLinked: v.number(),
  },
  handler: async (ctx, args) => {
    const admin = await ctx.db
      .query("adminUsers")
      .withIndex("by_clerk_id", (q: any) => q.eq("clerkUserId", args.actorClerkUserId))
      .first();
    await ctx.db.insert("adminAuditLog", {
      actorClerkUserId: args.actorClerkUserId,
      actorName: admin?.name,
      actorRole: admin?.role,
      action: "provisionEligibilityFile",
      targetType: "eligibilityFiles",
      targetId: String(args.fileId),
      summary: `Bulk provision (${args.mode}) — attempted ${args.attempted}, succeeded ${args.succeeded}, failed ${args.failed}, already linked ${args.alreadyLinked}`,
      metadata: {
        mode: args.mode,
        attempted: args.attempted,
        succeeded: args.succeeded,
        failed: args.failed,
        alreadyLinked: args.alreadyLinked,
      },
      createdAt: Date.now(),
    });
  },
});

/**
 * Internal helper used by the bulk provisioning action to fetch a group's
 * display name (used as the "sponsor" line in the welcome email).
 */
export const getGroupName = internalQuery({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    return (group as any)?.name as string | undefined;
  },
});

/**
 * Record that a member has been invited (pending invitation acceptance).
 */
export const markInvited = internalMutation({
  args: {
    memberProfileId: v.id("memberProfiles"),
    fileId: v.id("eligibilityFiles"),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.memberProfileId);
    if (!profile) return;
    await ctx.db.patch(args.memberProfileId, {
      memberType: "enrolling",
      updatedAt: Date.now(),
    });
    await ctx.db.insert("memberActivities", {
      memberProfileId: args.memberProfileId,
      siteId: profile.siteId,
      groupId: profile.groupId,
      activityType: "email_sent",
      title: "Clerk invitation sent",
      description: `Invitation email sent to ${profile.email}`,
      actorType: "system",
      createdAt: Date.now(),
    });
  },
});

// ─────────────────────────────────────────────────────────────────────
// CLERK WEBHOOK HANDLER (called from /api/clerk/webhook Next.js route)
// ─────────────────────────────────────────────────────────────────────

/**
 * Called from the Clerk webhook on `user.created` to link a freshly
 * accepted invitation back to its memberProfile and provision access.
 *
 * The Next.js route is responsible for verifying the Svix signature.
 */
export const linkInvitedMember = mutation({
  args: {
    clerkUserId: v.string(),
    email: v.string(),
    publicMetadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const meta = args.publicMetadata ?? {};
    let profile: any = null;

    // Prefer explicit memberProfileId from invitation metadata
    if (meta.memberProfileId) {
      try {
        profile = await ctx.db.get(meta.memberProfileId as any);
      } catch {
        profile = null;
      }
    }

    // Fall back to email lookup across eligible/enrolling members
    if (!profile) {
      const candidates = await ctx.db
        .query("memberProfiles")
        .filter((q) =>
          q.and(
            q.eq(q.field("email"), args.email),
            q.eq(q.field("customerId"), undefined)
          )
        )
        .collect();
      profile = candidates.find(
        (m) => m.memberType === "eligible" || m.memberType === "enrolling"
      );
    }

    if (!profile) {
      return { matched: false, reason: "No matching eligible member" };
    }

    const fileId = meta.fileId ?? profile.eligibilityFileId;
    if (!fileId) {
      // Link without file context (still grant access)
      const group = await ctx.db.get(profile.groupId);
      const employer = (group as any)?.listBill?.enabled === true;
      await ctx.db.patch(profile._id, {
        customerId: args.clerkUserId,
        memberType: "active",
        listBillStatus: employer ? "active" : profile.listBillStatus,
        employeeType: profile.employeeType ?? (employer ? "full_time" : undefined),
        updatedAt: Date.now(),
      });
      return { matched: true, profileId: profile._id, provisioned: false };
    }

    // Reuse the same internal provisioning path
    const res: any = await ctx.runMutation(
      internal.admin.eligibilityProvisioning.linkAndProvisionEmployerAccess,
      {
        memberProfileId: profile._id,
        clerkUserId: args.clerkUserId,
        fileId,
      }
    );
    return { matched: true, profileId: profile._id, ...res };
  },
});

// ─────────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────────

function generateTempPassword() {
  // 16-char password with mixed case, digits, and symbols
  const chars =
    "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*";
  let out = "";
  const arr = new Uint8Array(16);
  // Use Web Crypto if available (Convex actions run on V8)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g: any = globalThis as any;
  if (g.crypto && g.crypto.getRandomValues) {
    g.crypto.getRandomValues(arr);
    for (let i = 0; i < arr.length; i++) out += chars[arr[i] % chars.length];
  } else {
    for (let i = 0; i < 16; i++) out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}
