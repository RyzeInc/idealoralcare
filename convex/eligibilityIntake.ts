import { v } from "convex/values";
import {
  action,
  query,
  mutation,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id, Doc } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import {
  requireAuth,
  requireAuthAction,
  requireStaffAdmin,
  requireAdminAction,
} from "./lib/authGuards";
import {
  fail,
  inboundDomain,
  MAX_SESSIONS_PER_HOUR,
  SESSION_TTL_MS,
  secretToken,
  sha256,
  normalizeEmail,
  validateMetadata,
} from "./lib/eligibilityIntake";

const metadataArgs = {
  fileName: v.string(),
  fileBytes: v.number(),
  sourceDate: v.optional(v.string()),
};
export type UploadTicket = {
  uploadToken: string;
  expiresAt: number;
  uploadUrl: string;
};
async function audit(
  ctx: MutationCtx,
  actor: string,
  action: string,
  targetId: string,
) {
  await ctx.db.insert("adminAuditLog", {
    actorClerkUserId: actor,
    action: `eligibility_intake.${action}`,
    targetType: "eligibilityIntake",
    targetId,
    summary: `Eligibility intake: ${action.replaceAll("_", " ")}`,
    createdAt: Date.now(),
  });
}

function ticket(token: string): UploadTicket {
  const site = process.env.CONVEX_SITE_URL;
  if (!site) fail("UNAVAILABLE", "The upload endpoint is not configured.");
  return {
    uploadToken: token,
    expiresAt: Date.now() + SESSION_TTL_MS,
    uploadUrl: `${site}/eligibility/upload`,
  };
}
async function activeGroup(ctx: MutationCtx | QueryCtx, groupId: Id<"groups">) {
  const group = await ctx.db.get(groupId);
  if (!group || group.status !== "active")
    fail("FORBIDDEN", "This organization is not accepting submissions.");
  const account = await ctx.db.get(group.accountId);
  const site = await ctx.db.get(group.siteId);
  if (
    !account ||
    !["active", "onboarding"].includes(account.status) ||
    !site ||
    site.status !== "active"
  )
    fail("FORBIDDEN", "This organization is not accepting submissions.");
  return group;
}
async function ensureRoute(
  ctx: MutationCtx,
  groupId: Id<"groups">,
  alias: string,
) {
  if (
    !(await ctx.db
      .query("eligibilityIntakeRoutes")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .first())
  ) {
    await ctx.db.insert("eligibilityIntakeRoutes", { groupId, alias });
  }
}
async function checkSessionAccess(
  ctx: MutationCtx,
  session: Doc<"eligibilityUploadSessions">,
) {
  await activeGroup(ctx, session.groupId);
  if (session.accessId) {
    const access = await ctx.db.get(session.accessId);
    if (
      !access?.active ||
      access.groupId !== session.groupId ||
      (session.source === "browser"
        ? !access.browserEnabled || access.clerkUserId !== session.actor
        : !access.emailEnabled || access.email !== session.actor)
    )
      fail("FORBIDDEN", "Upload access has been revoked.");
  } else if (session.keyId) {
    const key = await ctx.db.get(session.keyId);
    if (
      !key?.active ||
      key.groupId !== session.groupId ||
      key.expiresAt <= Date.now()
    )
      fail("FORBIDDEN", "Upload access has been revoked.");
  } else fail("FORBIDDEN", "Upload access is missing.");
}
async function insertSession(
  ctx: MutationCtx,
  args: Omit<
    Doc<"eligibilityUploadSessions">,
    | "_id"
    | "_creationTime"
    | "createdAt"
    | "expiresAt"
    | "state"
    | "receiptId"
    | "fileType"
  >,
) {
  await activeGroup(ctx, args.groupId);
  const metadata = validateMetadata(
    args.fileName,
    args.fileBytes,
    args.sourceDate,
  );
  const recent = await ctx.db
    .query("eligibilityUploadSessions")
    .withIndex("by_group_created", (q) =>
      q.eq("groupId", args.groupId).gte("createdAt", Date.now() - 3600000),
    )
    .take(MAX_SESSIONS_PER_HOUR);
  if (recent.length >= MAX_SESSIONS_PER_HOUR)
    fail("RATE_LIMITED", "Too many submissions. Try again in an hour.");
  return ctx.db.insert("eligibilityUploadSessions", {
    ...args,
    ...metadata,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
    state: "pending",
  });
}

// Staff pre-authorize addresses. Browser access is bound to a Clerk ID only
// after a server-to-server check of verified email addresses, never JWT email alone.
export const claimBrowserAccess = action({
  args: {},
  handler: async (ctx): Promise<number> => {
    const identity = await requireAuthAction(ctx);
    const secret = process.env.CLERK_SECRET_KEY;
    if (!secret) fail("UNAVAILABLE", "Employer sign-in is not configured.");
    const response = await fetch(
      `https://api.clerk.com/v1/users/${encodeURIComponent(identity.clerkUserId)}`,
      { headers: { Authorization: `Bearer ${secret}` } },
    );
    if (!response.ok)
      fail("UNAVAILABLE", "Could not verify your account. Try again.");
    const user = await response.json();
    if (user.id !== identity.clerkUserId)
      fail("FORBIDDEN", "Could not verify your account.");
    const emails: string[] = (user.email_addresses ?? [])
      .filter(
        (e: { verification?: { status?: string } }) =>
          e.verification?.status === "verified",
      )
      .map((e: { email_address: string }) => normalizeEmail(e.email_address));
    return ctx.runMutation(internal.eligibilityIntake.bindVerifiedEmails, {
      clerkUserId: identity.clerkUserId,
      emails,
    });
  },
});
export const bindVerifiedEmails = internalMutation({
  args: { clerkUserId: v.string(), emails: v.array(v.string()) },
  handler: async (ctx, args) => {
    let count = 0;
    for (const email of args.emails) {
      const grants = await ctx.db
        .query("eligibilityIntakeAccess")
        .withIndex("by_email", (q) => q.eq("email", email))
        .collect();
      for (const grant of grants) {
        if (
          grant.active &&
          grant.browserEnabled &&
          (!grant.clerkUserId || grant.clerkUserId === args.clerkUserId)
        ) {
          await ctx.db.patch(grant._id, {
            clerkUserId: args.clerkUserId,
            updatedAt: Date.now(),
          });
          count++;
        }
      }
    }
    return count;
  },
});
export const myOrganizations = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireAuth(ctx);
    const grants = await ctx.db
      .query("eligibilityIntakeAccess")
      .withIndex("by_clerk", (q) => q.eq("clerkUserId", identity.clerkUserId))
      .collect();
    const result = [];
    for (const grant of grants) {
      if (!grant.active || !grant.browserEnabled) continue;
      const group = await ctx.db.get(grant.groupId);
      const account = group && (await ctx.db.get(group.accountId));
      const site = group && (await ctx.db.get(group.siteId));
      if (
        !group ||
        group.status !== "active" ||
        !account ||
        !["active", "onboarding"].includes(account.status) ||
        site?.status !== "active"
      )
        continue;
      const route = await ctx.db
        .query("eligibilityIntakeRoutes")
        .withIndex("by_group", (q) => q.eq("groupId", group._id))
        .first();
      result.push({
        groupId: group._id,
        name: group.name,
        emailAddress:
          grant.emailEnabled &&
          route &&
          inboundDomain() &&
          process.env.ELIGIBILITY_EMAIL_BRIDGE_SECRET
            ? `${route.alias}@${inboundDomain()}`
            : null,
      });
    }
    return Array.from(new Map(result.map((r) => [r.groupId, r])).values());
  },
});
export const mySubmissions = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const grants = await ctx.db
      .query("eligibilityIntakeAccess")
      .withIndex("by_clerk", (q) => q.eq("clerkUserId", identity.clerkUserId))
      .collect();
    if (
      !grants.some(
        (g) => g.groupId === args.groupId && g.active && g.browserEnabled,
      )
    )
      fail("FORBIDDEN", "Organization access required.");
    await activeGroup(ctx, args.groupId);
    const rows = await ctx.db
      .query("eligibilitySubmissions")
      .withIndex("by_group_created", (q) => q.eq("groupId", args.groupId))
      .order("desc")
      .take(30);
    return Promise.all(
      rows.map(async (row) => ({
        receiptId: row._id,
        fileName: row.fileName,
        source: row.source,
        createdAt: row.createdAt,
        status: row.status,
        reviewNote: row.reviewNote,
        processingStatus: row.eligibilityFileId
          ? (await ctx.db.get(row.eligibilityFileId))?.status
          : undefined,
      })),
    );
  },
});
export const createBrowserSession = action({
  args: { groupId: v.id("groups"), ...metadataArgs },
  handler: async (ctx, args): Promise<UploadTicket> => {
    const identity = await requireAuthAction(ctx);
    const token = secretToken("nxu_");
    const result = ticket(token); // fail closed before creating a session if HTTP hosting isn't configured
    await ctx.runMutation(internal.eligibilityIntake.beginBrowser, {
      ...args,
      clerkUserId: identity.clerkUserId,
      tokenHash: await sha256(token),
    });
    return result;
  },
});
export const beginBrowser = internalMutation({
  args: {
    groupId: v.id("groups"),
    clerkUserId: v.string(),
    tokenHash: v.string(),
    ...metadataArgs,
  },
  handler: async (ctx, { clerkUserId, ...args }) => {
    const grants = await ctx.db
      .query("eligibilityIntakeAccess")
      .withIndex("by_clerk", (q) => q.eq("clerkUserId", clerkUserId))
      .collect();
    const grant = grants.find(
      (g) => g.groupId === args.groupId && g.active && g.browserEnabled,
    );
    if (!grant) fail("FORBIDDEN", "Organization upload access required.");
    return insertSession(ctx, {
      ...args,
      source: "browser",
      actor: clerkUserId,
      accessId: grant._id,
    });
  },
});
export const beginMachine = internalMutation({
  args: { keyHash: v.string(), tokenHash: v.string(), ...metadataArgs },
  handler: async (ctx, { keyHash, ...args }) => {
    const key = await ctx.db
      .query("eligibilityIntakeKeys")
      .withIndex("by_hash", (q) => q.eq("tokenHash", keyHash))
      .first();
    if (!key?.active || key.expiresAt <= Date.now())
      fail("UNAUTHORIZED", "Invalid or expired upload credential.");
    return insertSession(ctx, {
      ...args,
      groupId: key.groupId,
      source: "api",
      actor: key.label,
      keyId: key._id,
    });
  },
});
export const beginEmail = internalMutation({
  args: {
    sender: v.string(),
    recipients: v.array(v.string()),
    messageId: v.string(),
    tokenHash: v.string(),
    dmarc: v.string(),
    spam: v.string(),
    virus: v.string(),
    ...metadataArgs,
  },
  handler: async (
    ctx,
    { sender, recipients, messageId, dmarc, spam, virus, ...args },
  ) => {
    if (dmarc !== "PASS" || spam !== "PASS" || virus !== "PASS")
      fail("FORBIDDEN", "Email authentication or scanning failed.");
    const domain = inboundDomain();
    if (!domain) fail("UNAVAILABLE", "Email intake is not configured.");
    if (!messageId || messageId.length > 200 || recipients.length > 30)
      fail("BAD_REQUEST", "Invalid email metadata.");
    const email = normalizeEmail(sender);
    const grants = await ctx.db
      .query("eligibilityIntakeAccess")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect();
    const groups = new Map<string, Doc<"eligibilityIntakeAccess">>();
    for (const recipient of recipients) {
      const address = normalizeEmail(recipient);
      const [alias, receivedDomain] = address.split("@");
      if (receivedDomain !== domain) continue;
      const route = await ctx.db
        .query("eligibilityIntakeRoutes")
        .withIndex("by_alias", (q) => q.eq("alias", alias))
        .first();
      const grant =
        route &&
        grants.find(
          (g) => g.groupId === route.groupId && g.active && g.emailEnabled,
        );
      if (grant) groups.set(grant.groupId, grant);
    }
    if (groups.size !== 1)
      fail(
        "FORBIDDEN",
        "Use the approved address for exactly one organization.",
      );
    const grant = [...groups.values()][0];
    return insertSession(ctx, {
      ...args,
      groupId: grant.groupId,
      actor: email,
      source: "email",
      accessId: grant._id,
      externalId: messageId,
    });
  },
});
export const claimUpload = internalMutation({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("eligibilityUploadSessions")
      .withIndex("by_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .first();
    if (!session || session.expiresAt <= Date.now())
      fail("UNAUTHORIZED", "Upload session expired. Start another upload.");
    await checkSessionAccess(ctx, session);
    if (session.state === "completed") return session;
    if (session.state !== "pending")
      fail(
        "CONFLICT",
        "This upload session has already been used. Start another upload.",
      );
    await ctx.db.patch(session._id, { state: "receiving" });
    return session;
  },
});
export const finishUpload = internalMutation({
  args: {
    sessionId: v.id("eligibilityUploadSessions"),
    storageId: v.id("_storage"),
    sha256: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (
      !session ||
      session.state !== "receiving" ||
      session.expiresAt <= Date.now()
    )
      fail("CONFLICT", "Upload session is no longer valid.");
    await checkSessionAccess(ctx, session);
    const matching = await ctx.db
      .query("eligibilitySubmissions")
      .withIndex("by_group_hash", (q) =>
        q
          .eq("groupId", session.groupId)
          .eq("sha256", args.sha256)
          .eq("sourceDate", session.sourceDate),
      )
      .order("desc")
      .take(50);
    const prior = matching.find(
      (row) =>
        row.sourceDate === session.sourceDate &&
        !["expired", "rejected"].includes(row.status),
    );
    if (prior && !["expired", "rejected"].includes(prior.status)) {
      await ctx.db.patch(session._id, {
        state: "completed",
        receiptId: prior._id,
      });
      return { receiptId: prior._id, duplicate: true };
    }
    const receiptId = await ctx.db.insert("eligibilitySubmissions", {
      groupId: session.groupId,
      storageId: args.storageId,
      fileName: session.fileName,
      fileType: session.fileType,
      fileBytes: session.fileBytes,
      sha256: args.sha256,
      sourceDate: session.sourceDate,
      source: session.source,
      submittedBy: session.actor,
      externalId: session.externalId,
      createdAt: Date.now(),
      status: "submitted",
    });
    await ctx.db.patch(session._id, { state: "completed", receiptId });
    return { receiptId, duplicate: false };
  },
});
export const failUpload = internalMutation({
  args: { sessionId: v.id("eligibilityUploadSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (session?.state === "receiving")
      await ctx.db.patch(session._id, { state: "failed" });
  },
});
export const machineStatus = internalQuery({
  args: { keyHash: v.string(), receiptId: v.id("eligibilitySubmissions") },
  handler: async (ctx, args) => {
    const key = await ctx.db
      .query("eligibilityIntakeKeys")
      .withIndex("by_hash", (q) => q.eq("tokenHash", args.keyHash))
      .first();
    if (!key?.active || key.expiresAt <= Date.now())
      fail("UNAUTHORIZED", "Invalid upload credential.");
    await activeGroup(ctx, key.groupId);
    const row = await ctx.db.get(args.receiptId);
    if (!row || row.groupId !== key.groupId)
      fail("FORBIDDEN", "Receipt is unavailable.");
    return {
      receiptId: row._id,
      status: row.status,
      processingStatus: row.eligibilityFileId
        ? (await ctx.db.get(row.eligibilityFileId))?.status
        : null,
      receivedAt: row.createdAt,
    };
  },
});

export const adminConfiguration = query({
  args: {},
  handler: async (ctx) => {
    await requireStaffAdmin(ctx);
    const access = await ctx.db.query("eligibilityIntakeAccess").collect();
    const keys = await ctx.db.query("eligibilityIntakeKeys").collect();
    const routes = await ctx.db.query("eligibilityIntakeRoutes").collect();
    return {
      access,
      keys: keys.map((key) => ({
        _id: key._id,
        groupId: key.groupId,
        label: key.label,
        prefix: key.prefix,
        active: key.active,
        expiresAt: key.expiresAt,
        expired: key.expiresAt <= Date.now(),
      })),
      routes: routes.map((r) => ({
        ...r,
        address: inboundDomain() ? `${r.alias}@${inboundDomain()}` : null,
      })),
      apiBase: process.env.CONVEX_SITE_URL ?? null,
      emailConfigured:
        !!inboundDomain() && !!process.env.ELIGIBILITY_EMAIL_BRIDGE_SECRET,
      browserConfigured: !!process.env.CLERK_SECRET_KEY,
    };
  },
});
export const saveAccess = action({
  args: {
    groupId: v.id("groups"),
    email: v.string(),
    browserEnabled: v.boolean(),
    emailEnabled: v.boolean(),
  },
  handler: async (ctx, args): Promise<Id<"eligibilityIntakeAccess">> => {
    const actor = await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);
    return ctx.runMutation(internal.eligibilityIntake.upsertAccess, {
      ...args,
      email: normalizeEmail(args.email),
      alias: secretToken("org-").slice(0, 28),
      actor: actor.clerkUserId,
    });
  },
});
export const upsertAccess = internalMutation({
  args: {
    groupId: v.id("groups"),
    email: v.string(),
    browserEnabled: v.boolean(),
    emailEnabled: v.boolean(),
    alias: v.string(),
    actor: v.string(),
  },
  handler: async (ctx, { alias, actor, ...args }) => {
    await activeGroup(ctx, args.groupId);
    if (!args.browserEnabled && !args.emailEnabled)
      fail("BAD_REQUEST", "Enable at least one submission method.");
    await ensureRoute(ctx, args.groupId, alias);
    const existing = (
      await ctx.db
        .query("eligibilityIntakeAccess")
        .withIndex("by_email", (q) => q.eq("email", args.email))
        .collect()
    ).find((g) => g.groupId === args.groupId);
    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        active: true,
        updatedAt: Date.now(),
      });
      await audit(ctx, actor, "save_access", existing._id);
      return existing._id;
    }
    const id = await ctx.db.insert("eligibilityIntakeAccess", {
      ...args,
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: actor,
    });
    await audit(ctx, actor, "save_access", id);
    return id;
  },
});
export const revokeAccess = mutation({
  args: { accessId: v.id("eligibilityIntakeAccess") },
  handler: async (ctx, args) => {
    const actor = await requireStaffAdmin(ctx);
    await ctx.db.patch(args.accessId, { active: false, updatedAt: Date.now() });
    await audit(ctx, actor.clerkUserId, "revoke_access", args.accessId);
  },
});
export const issueKey = action({
  args: {
    groupId: v.id("groups"),
    label: v.string(),
    expiresInDays: v.number(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ token: string; keyId: Id<"eligibilityIntakeKeys"> }> => {
    const actor = await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);
    if (
      !args.label.trim() ||
      args.label.length > 100 ||
      !Number.isInteger(args.expiresInDays) ||
      args.expiresInDays < 1 ||
      args.expiresInDays > 365
    )
      fail("BAD_REQUEST", "Use a label and an expiry between 1 and 365 days.");
    const token = secretToken("nxi_");
    const keyId = await ctx.runMutation(internal.eligibilityIntake.insertKey, {
      groupId: args.groupId,
      label: args.label.trim(),
      tokenHash: await sha256(token),
      prefix: token.slice(0, 12),
      expiresAt: Date.now() + args.expiresInDays * 86400000,
      actor: actor.clerkUserId,
      alias: secretToken("org-").slice(0, 28),
    });
    return { token, keyId };
  },
});
export const insertKey = internalMutation({
  args: {
    groupId: v.id("groups"),
    label: v.string(),
    tokenHash: v.string(),
    prefix: v.string(),
    expiresAt: v.number(),
    actor: v.string(),
    alias: v.string(),
  },
  handler: async (ctx, { actor, alias, ...args }) => {
    await activeGroup(ctx, args.groupId);
    await ensureRoute(ctx, args.groupId, alias);
    const id = await ctx.db.insert("eligibilityIntakeKeys", {
      ...args,
      active: true,
      createdAt: Date.now(),
      createdBy: actor,
    });
    await audit(ctx, actor, "issue_key", id);
    return id;
  },
});
export const revokeKey = mutation({
  args: { keyId: v.id("eligibilityIntakeKeys") },
  handler: async (ctx, args) => {
    const actor = await requireStaffAdmin(ctx);
    await ctx.db.patch(args.keyId, { active: false });
    await audit(ctx, actor.clerkUserId, "revoke_key", args.keyId);
  },
});
export const adminInbox = query({
  args: { pendingOnly: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requireStaffAdmin(ctx);
    const rows = args.pendingOnly
      ? await ctx.db
          .query("eligibilitySubmissions")
          .withIndex("by_status_created", (q) => q.eq("status", "submitted"))
          .order("asc")
          .take(100)
      : await ctx.db
          .query("eligibilitySubmissions")
          .withIndex("by_created")
          .order("desc")
          .take(100);
    return Promise.all(
      rows.map(async (r) => ({
        ...r,
        groupName:
          (await ctx.db.get(r.groupId))?.name ?? "Organization unavailable",
        processingStatus: r.eligibilityFileId
          ? (await ctx.db.get(r.eligibilityFileId))?.status
          : null,
      })),
    );
  },
});
export const adminSubmission = query({
  args: { receiptId: v.id("eligibilitySubmissions") },
  handler: async (ctx, args) => {
    await requireStaffAdmin(ctx);
    const row = await ctx.db.get(args.receiptId);
    if (!row) fail("BAD_REQUEST", "Submission not found.");
    return row;
  },
});
export const previewSubmission = action({
  args: { receiptId: v.id("eligibilitySubmissions") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    primaryCount: number;
    dependentCount: number;
    errorCount: number;
    validationErrorCount: number;
    tooLarge: boolean;
    errors: { row: number; message: string }[];
    validationErrors: { row: number; field: string; message: string }[];
    sampleRecords: { firstName: string; lastName: string }[];
  }> => {
    await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);
    const row = await ctx.runQuery(api.eligibilityIntake.adminSubmission, args);
    if (!row.storageId) fail("BAD_REQUEST", "File is no longer available.");
    return ctx.runAction(api.admin.eligibility.previewEligibilityFile, {
      storageId: row.storageId,
      fileType: row.fileType,
      fileName: row.fileName,
    });
  },
});
export const approveSubmission = action({
  args: {
    receiptId: v.id("eligibilitySubmissions"),
    acknowledgeValidationWarnings: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<Id<"eligibilityFiles">> => {
    const actor = await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);
    const preview = await ctx.runAction(
      api.eligibilityIntake.previewSubmission,
      { receiptId: args.receiptId },
    );
    if (!preview.primaryCount || preview.tooLarge || preview.errorCount)
      fail(
        "BAD_REQUEST",
        "Correct parsing errors or file size before approval.",
      );
    if (preview.validationErrorCount && !args.acknowledgeValidationWarnings)
      fail(
        "BAD_REQUEST",
        "Review and explicitly acknowledge missing-field warnings before approval.",
      );
    return ctx.runMutation(internal.eligibilityIntake.approve, {
      receiptId: args.receiptId,
      warningsAcknowledged:
        !!preview.validationErrorCount && !!args.acknowledgeValidationWarnings,
      actor: actor.clerkUserId,
    });
  },
});
export const approve = internalMutation({
  args: {
    receiptId: v.id("eligibilitySubmissions"),
    actor: v.string(),
    warningsAcknowledged: v.boolean(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.receiptId);
    if (row?.status === "approved" && row.eligibilityFileId)
      return row.eligibilityFileId;
    if (!row || row.status !== "submitted" || !row.storageId)
      fail("CONFLICT", "Submission is no longer awaiting review.");
    const group = await activeGroup(ctx, row.groupId);
    if (!group.organizationCode)
      fail(
        "BAD_REQUEST",
        "Set this organization's Organization Code before approval.",
      );
    const fileId = await ctx.db.insert("eligibilityFiles", {
      siteId: group.siteId,
      accountId: group.accountId,
      groupId: group._id,
      sourceDate: row.sourceDate?.replaceAll("-", ""),
      fileName: row.fileName,
      fileType: row.fileType,
      storageId: row.storageId,
      status: "uploaded",
      totalRecords: 0,
      processedRecords: 0,
      errorRecords: 0,
      newMembers: 0,
      updatedMembers: 0,
      terminatedMembers: 0,
      errors: [],
      fileAction: "additions",
      uploadedBy: row.submittedBy,
      uploadedAt: row.createdAt,
    });
    await ctx.db.patch(row._id, {
      status: "approved",
      reviewedBy: args.actor,
      reviewedAt: Date.now(),
      eligibilityFileId: fileId,
      validationWarningsAcknowledged: args.warningsAcknowledged,
    });
    await audit(
      ctx,
      args.actor,
      args.warningsAcknowledged
        ? "approve_with_validation_warnings"
        : "approve_submission",
      row._id,
    );
    return fileId;
  },
});
export const claimProcessing = internalMutation({
  args: { receiptId: v.id("eligibilitySubmissions"), actor: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.receiptId);
    if (row?.status !== "approved" || !row.eligibilityFileId)
      fail("BAD_REQUEST", "Approve the submission first.");
    await activeGroup(ctx, row.groupId);
    const file = await ctx.db.get(row.eligibilityFileId);
    if (!file || !["uploaded", "failed"].includes(file.status))
      fail("CONFLICT", "Processing has already started.");
    await ctx.db.patch(file._id, { status: "validating" });
    await audit(ctx, args.actor, "start_processing", row._id);
    return file._id;
  },
});
export const processApproved = action({
  args: { receiptId: v.id("eligibilitySubmissions") },
  handler: async (ctx, args): Promise<void> => {
    const actor = await requireAdminAction(ctx, api.admin.adminUsers.isAdmin);
    const fileId = await ctx.runMutation(
      internal.eligibilityIntake.claimProcessing,
      { ...args, actor: actor.clerkUserId },
    );
    try {
      await ctx.runAction(api.admin.eligibility.processEligibilityFile, {
        fileId,
      });
    } catch (error) {
      await ctx.runMutation(api.admin.eligibility.updateFileStatus, {
        fileId,
        status: "failed",
      });
      throw error;
    }
  },
});
export const rejectSubmission = mutation({
  args: { receiptId: v.id("eligibilitySubmissions"), note: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireStaffAdmin(ctx);
    const row = await ctx.db.get(args.receiptId);
    if (row?.status !== "submitted")
      fail("CONFLICT", "Submission is no longer awaiting review.");
    if (!args.note.trim() || args.note.length > 500)
      fail(
        "BAD_REQUEST",
        "Enter a reason under 500 characters, without member details.",
      );
    await ctx.db.patch(row._id, {
      status: "rejected",
      reviewedBy: actor.clerkUserId,
      reviewedAt: Date.now(),
      reviewNote: args.note.trim(),
    });
    await audit(ctx, actor.clerkUserId, "reject_submission", row._id);
    await ctx.scheduler.runAfter(0, internal.eligibilityIntake.purgeRejected, {
      receiptId: row._id,
    });
  },
});
export const purgeRejected = internalMutation({
  args: { receiptId: v.id("eligibilitySubmissions") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.receiptId);
    if (row?.status === "rejected" && row.storageId) {
      await ctx.storage.delete(row.storageId);
      await ctx.db.patch(row._id, { storageId: undefined });
    }
  },
});
export const cleanup = internalMutation({
  args: {},
  handler: async (ctx) => {
    const sessions = await ctx.db
      .query("eligibilityUploadSessions")
      .withIndex("by_expiry", (q) => q.lt("expiresAt", Date.now() - 86400000))
      .take(200);
    for (const session of sessions) await ctx.db.delete(session._id);
    const rows = await ctx.db
      .query("eligibilitySubmissions")
      .withIndex("by_status_created", (q) =>
        q.eq("status", "submitted").lt("createdAt", Date.now() - 30 * 86400000),
      )
      .take(50);
    for (const row of rows) {
      if (row.storageId) await ctx.storage.delete(row.storageId);
      await ctx.db.patch(row._id, { storageId: undefined, status: "expired" });
    }
  },
});
