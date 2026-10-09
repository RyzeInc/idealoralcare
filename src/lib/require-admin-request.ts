import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

/**
 * Gate an API route to signed-in admins. Returns a ready-to-send error
 * response, or null when the caller is an admin and the route may proceed.
 *
 *   const denied = await requireAdminRequest();
 *   if (denied) return denied;
 */
export async function requireAdminRequest(): Promise<NextResponse | null> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || "");
  const isAdmin = await convex.query(api.admin.adminUsers.isAdmin, { clerkUserId: userId }).catch(() => false);
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

/** True for a signed-in admin — for server components and layouts. */
export async function isAdminRequest(): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || "");
  return await convex.query(api.admin.adminUsers.isAdmin, { clerkUserId: userId }).catch(() => false);
}
