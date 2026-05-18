import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import SftpClient from "ssh2-sftp-client";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export const runtime = "nodejs"; // ssh2 requires native Node bindings

/**
 * POST /api/admin/vendor-deliver
 *
 * Pushes an already-generated vendor eligibility file (stored in Convex
 * vendorDeliveries) to the vendor's SFTP endpoint.
 *
 * Body:
 *   { deliveryId: string }
 *
 * Auth: requires Clerk-authenticated admin (verified via Convex isAdmin query).
 *
 * SFTP credentials come from process.env on the Next.js server:
 *   CAREINGTON_SFTP_HOST, CAREINGTON_SFTP_USER, CAREINGTON_SFTP_KEY,
 *   CAREINGTON_SFTP_PASSWORD (optional), CAREINGTON_SFTP_PORT (default 22),
 *   CAREINGTON_SFTP_PATH (default "/incoming/")
 *   DIALCARE_SFTP_*  same shape
 */
export async function POST(req: NextRequest) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || "");
  const token = await getToken({ template: "convex" });
  if (token) convex.setAuth(token);

  // Admin gate (mirrors the pattern used in the Stripe admin routes)
  const isAdmin = await convex.query(
    api.admin.adminUsers.isAdmin as any,
    { clerkUserId: userId }
  );
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { deliveryId } = body;
  if (!deliveryId) {
    return NextResponse.json({ error: "deliveryId is required" }, { status: 400 });
  }

  // 1. Fetch delivery + file content via Convex
  const delivery: any = await convex.query(
    api.admin.sftpDelivery.getDeliveryById as any,
    { deliveryId: deliveryId as Id<"vendorDeliveries"> }
  );
  if (!delivery) {
    return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
  }
  if (delivery.method !== "sftp") {
    return NextResponse.json(
      { error: `Delivery method is "${delivery.method}", not "sftp"` },
      { status: 400 }
    );
  }
  if (delivery.status === "delivered") {
    return NextResponse.json({ ok: true, alreadyDelivered: true, delivery });
  }

  // 2. Re-download file content from Convex storage via the action
  let fileResult: any;
  try {
    fileResult = await convex.action(
      api.admin.sftpDelivery.downloadDeliveredFile as any,
      { deliveryId: deliveryId as Id<"vendorDeliveries"> }
    );
  } catch (err: any) {
    await markFailed(convex, deliveryId, `Could not load file: ${err?.message ?? err}`);
    return NextResponse.json(
      { error: `Could not load file from storage: ${err?.message ?? err}` },
      { status: 500 }
    );
  }
  const content: string = fileResult.content;

  // 3. Resolve SFTP credentials based on vendor
  const env = sftpEnvFor(delivery.vendor);
  if (!env.host || !env.user || (!env.privateKey && !env.password)) {
    const msg = `SFTP credentials missing for ${delivery.vendor}. Set ${env.prefix}_SFTP_HOST/_USER/_KEY (or _PASSWORD).`;
    await markFailed(convex, deliveryId, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // 4. Mark uploading
  await convex.mutation(
    api.admin.sftpDelivery.markDeliveryStatus as any,
    {
      deliveryId: deliveryId as Id<"vendorDeliveries">,
      status: "uploading",
    }
  );

  // 5. SFTP push
  const sftp = new SftpClient();
  const remotePath = (env.remotePath ?? "/incoming/") + delivery.filename;
  const startedAt = Date.now();
  try {
    const connectOpts: any = {
      host: env.host,
      port: env.port ?? 22,
      username: env.user,
    };
    if (env.privateKey) connectOpts.privateKey = env.privateKey;
    if (env.password) connectOpts.password = env.password;

    await sftp.connect(connectOpts);
    await sftp.put(Buffer.from(content, "utf8"), remotePath);
  } catch (err: any) {
    try { await sftp.end(); } catch { /* ignore */ }
    const msg = err?.message ?? String(err);
    await markFailed(convex, deliveryId, msg);
    return NextResponse.json(
      { ok: false, error: `SFTP push failed: ${msg}` },
      { status: 502 }
    );
  }
  try { await sftp.end(); } catch { /* ignore */ }

  // 6. Mark delivered
  await convex.mutation(
    api.admin.sftpDelivery.markDeliveryStatus as any,
    {
      deliveryId: deliveryId as Id<"vendorDeliveries">,
      status: "delivered",
    }
  );

  return NextResponse.json({
    ok: true,
    deliveryId,
    filename: delivery.filename,
    bytes: delivery.fileBytes,
    sha256: delivery.fileSha256,
    host: env.host,
    remotePath,
    durationMs: Date.now() - startedAt,
  });
}

async function markFailed(
  convex: ConvexHttpClient,
  deliveryId: string,
  errorMessage: string
) {
  try {
    await convex.mutation(
      api.admin.sftpDelivery.markDeliveryStatus as any,
      {
        deliveryId: deliveryId as Id<"vendorDeliveries">,
        status: "failed",
        errorMessage,
      }
    );
  } catch (err) {
    console.error("[vendor-deliver] markFailed callback failed", err);
  }
}

function sftpEnvFor(vendor: "careington" | "dialcare") {
  const prefix = vendor === "careington" ? "CAREINGTON" : "DIALCARE";
  return {
    prefix,
    host: process.env[`${prefix}_SFTP_HOST`],
    user: process.env[`${prefix}_SFTP_USER`],
    privateKey: process.env[`${prefix}_SFTP_KEY`],
    password: process.env[`${prefix}_SFTP_PASSWORD`],
    port: process.env[`${prefix}_SFTP_PORT`]
      ? Number(process.env[`${prefix}_SFTP_PORT`])
      : 22,
    remotePath:
      process.env[`${prefix}_SFTP_PATH`] ||
      (vendor === "careington" ? "/incoming/" : "/eligibility/"),
  };
}
