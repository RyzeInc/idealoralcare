import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import { ConvexError } from "convex/values";
import {
  MAX_UPLOAD_BYTES,
  SESSION_TTL_MS,
  fail,
  secretToken,
  sha256,
  validateFileBytes,
  validateMetadata,
  verifyBridgeSignature,
} from "./lib/eligibilityIntake";

const http = httpRouter();
const paths = [
  "/eligibility/sessions",
  "/eligibility/upload",
  "/eligibility/status",
  "/eligibility/email/prepare",
  "/eligibility/download",
];

function response(request: Request, data: unknown, status = 200) {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    Vary: "Origin",
  });
  const origin = request.headers.get("Origin");
  const allowed = (
    process.env.ELIGIBILITY_PORTAL_ORIGINS ??
    "https://getidealoh.com,https://www.getidealoh.com"
  )
    .split(",")
    .map((s) => s.trim());
  if (origin && allowed.includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, X-Upload-Token, X-Eligibility-Key, Authorization",
    );
    headers.set("Access-Control-Max-Age", "600");
  }
  return new Response(JSON.stringify(data), { status, headers });
}
function errorResponse(request: Request, error: unknown) {
  let value: unknown = error instanceof ConvexError ? error.data : undefined;
  // Nested Convex calls may serialize error data before rethrowing it.
  for (let i = 0; i < 3 && typeof value === "string"; i++) {
    try {
      value = JSON.parse(value);
    } catch {
      value = undefined;
    }
  }
  const data =
    value && typeof value === "object"
      ? (value as { code?: string; message?: string })
      : {};
  const statuses: Record<string, number> = {
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    CONFLICT: 409,
    RATE_LIMITED: 429,
    UNAVAILABLE: 503,
  };
  const status = statuses[data.code ?? ""] ?? 500;
  return response(
    request,
    {
      error: data.message ?? "Could not complete the intake request.",
      code: data.code ?? "INTERNAL_ERROR",
    },
    status,
  );
}
export async function readBounded(
  request: Request,
  limit: number,
): Promise<Uint8Array<ArrayBuffer>> {
  if (!request.body) fail("BAD_REQUEST", "A request body is required.");
  const length = request.headers.get("Content-Length");
  if (length && (!/^\d+$/.test(length) || Number(length) > limit))
    fail("BAD_REQUEST", "Request is too large.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        fail("BAD_REQUEST", "Request is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
async function smallJSON(request: Request) {
  const text = new TextDecoder().decode(await readBounded(request, 8192));
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    fail("BAD_REQUEST", "Send a JSON object.");
  }
  if (!data || typeof data !== "object" || Array.isArray(data))
    fail("BAD_REQUEST", "Send a JSON object.");
  return { text, data };
}
function metadata(data: Record<string, unknown>) {
  if (
    typeof data.fileName !== "string" ||
    typeof data.fileBytes !== "number" ||
    (data.sourceDate !== undefined && typeof data.sourceDate !== "string")
  )
    fail(
      "BAD_REQUEST",
      "Provide fileName, fileBytes, and an optional sourceDate.",
    );
  const { fileName, fileBytes, sourceDate } = validateMetadata(
    data.fileName,
    data.fileBytes,
    data.sourceDate as string | undefined,
  );
  return { fileName, fileBytes, sourceDate };
}
async function keyHash(request: Request) {
  const key = request.headers.get("X-Eligibility-Key");
  if (!key || !/^nxi_[a-f0-9]{64}$/.test(key))
    fail("UNAUTHORIZED", "An upload credential is required.");
  return sha256(key);
}
function sessionTicket(request: Request, token: string) {
  return {
    uploadUrl: `${new URL(request.url).origin}/eligibility/upload`,
    uploadToken: token,
    expiresAt: Date.now() + SESSION_TTL_MS,
    maxBytes: MAX_UPLOAD_BYTES,
  };
}

http.route({
  path: "/eligibility/sessions",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const hash = await keyHash(request);
      const { data } = await smallJSON(request);
      const token = secretToken("nxu_");
      await ctx.runMutation(internal.eligibilityIntake.beginMachine, {
        ...metadata(data),
        keyHash: hash,
        tokenHash: await sha256(token),
      });
      return response(request, sessionTicket(request, token), 201);
    } catch (error) {
      return errorResponse(request, error);
    }
  }),
});

http.route({
  path: "/eligibility/upload",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    let sessionId: Id<"eligibilityUploadSessions"> | undefined;
    let storageId: Id<"_storage"> | undefined;
    try {
      const token = request.headers.get("X-Upload-Token");
      if (!token || !/^nxu_[a-f0-9]{64}$/.test(token))
        fail("UNAUTHORIZED", "An upload session is required.");
      const session = await ctx.runMutation(
        internal.eligibilityIntake.claimUpload,
        { tokenHash: await sha256(token) },
      );
      if (session.state === "completed")
        return response(request, {
          receiptId: session.receiptId,
          duplicate: true,
        });
      sessionId = session._id;
      const bytes = await readBounded(request, session.fileBytes);
      if (bytes.byteLength !== session.fileBytes)
        fail("BAD_REQUEST", "File size differs from the upload session.");
      validateFileBytes(bytes, session.fileType);
      storageId = await ctx.storage.store(
        new Blob([bytes], { type: "application/octet-stream" }),
      );
      if (session.fileType === "xlsx")
        await ctx.runAction(internal.eligibilityIntakeFiles.validateWorkbook, {
          storageId,
        });
      const result = await ctx.runMutation(
        internal.eligibilityIntake.finishUpload,
        {
          sessionId: session._id,
          storageId,
          sha256: await sha256(bytes.buffer),
        },
      );
      if (result.duplicate) await ctx.storage.delete(storageId);
      storageId = undefined; // accepted storage is owned by the submission, never delete it on response failure
      return response(
        request,
        {
          ...result,
          status: "received",
          message:
            "Received for review. Member eligibility has not been changed.",
        },
        201,
      );
    } catch (error) {
      if (storageId) await ctx.storage.delete(storageId);
      if (sessionId)
        await ctx.runMutation(internal.eligibilityIntake.failUpload, {
          sessionId,
        });
      return errorResponse(request, error);
    }
  }),
});

http.route({
  path: "/eligibility/status",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const hash = await keyHash(request);
      const { data } = await smallJSON(request);
      if (typeof data.receiptId !== "string")
        fail("BAD_REQUEST", "Provide a receiptId.");
      return response(
        request,
        await ctx.runQuery(internal.eligibilityIntake.machineStatus, {
          keyHash: hash,
          receiptId: data.receiptId as Id<"eligibilitySubmissions">,
        }),
      );
    } catch (error) {
      return errorResponse(request, error);
    }
  }),
});

// Only the SES adapter holds the bridge secret. No public caller can attest
// email authentication results, sender identity, or envelope recipients.
http.route({
  path: "/eligibility/email/prepare",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const { text, data } = await smallJSON(request);
      if (
        !(await verifyBridgeSignature(
          text,
          request.headers.get("X-Intake-Timestamp"),
          request.headers.get("X-Intake-Signature"),
          process.env.ELIGIBILITY_EMAIL_BRIDGE_SECRET,
        ))
      )
        fail("UNAUTHORIZED", "Invalid email bridge signature.");
      if (
        typeof data.sender !== "string" ||
        !Array.isArray(data.recipients) ||
        !data.recipients.every((r: unknown) => typeof r === "string") ||
        typeof data.messageId !== "string" ||
        typeof data.dmarc !== "string" ||
        typeof data.spam !== "string" ||
        typeof data.virus !== "string"
      )
        fail("BAD_REQUEST", "Invalid email metadata.");
      const token = secretToken("nxu_");
      await ctx.runMutation(internal.eligibilityIntake.beginEmail, {
        ...metadata(data),
        sender: data.sender,
        recipients: data.recipients,
        messageId: data.messageId,
        dmarc: data.dmarc,
        spam: data.spam,
        virus: data.virus,
        tokenHash: await sha256(token),
      });
      return response(request, sessionTicket(request, token), 201);
    } catch (error) {
      return errorResponse(request, error);
    }
  }),
});

http.route({
  path: "/eligibility/download",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) fail("UNAUTHORIZED", "Staff sign-in is required.");
      const clerkUserId = identity.tokenIdentifier.split("|").pop()!;
      if (!(await ctx.runQuery(api.admin.adminUsers.isAdmin, { clerkUserId })))
        fail("FORBIDDEN", "Staff access is required.");
      const { data } = await smallJSON(request);
      if (typeof data.receiptId !== "string")
        fail("BAD_REQUEST", "Provide a receiptId.");
      const row = await ctx.runQuery(api.eligibilityIntake.adminSubmission, {
        receiptId: data.receiptId as Id<"eligibilitySubmissions">,
      });
      if (!row.storageId)
        fail("BAD_REQUEST", "The file is no longer available.");
      const file = await ctx.storage.get(row.storageId);
      if (!file) fail("BAD_REQUEST", "The file is no longer available.");
      const headers = response(request, {}).headers;
      headers.set("Content-Type", "application/octet-stream");
      headers.set(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(row.fileName)}`,
      );
      return new Response(file, { headers });
    } catch (error) {
      return errorResponse(request, error);
    }
  }),
});

for (const path of paths)
  http.route({
    path,
    method: "OPTIONS",
    handler: httpAction(async (_ctx: ActionCtx, request: Request) =>
      response(request, {}),
    ),
  });
export default http;
