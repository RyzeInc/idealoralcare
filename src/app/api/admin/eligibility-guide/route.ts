import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";

export async function GET() {
  const { userId, getToken } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const token = await getToken({ template: "convex" });
  if (!token) return new Response("Unauthorized", { status: 401 });
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  convex.setAuth(token);
  const isAdmin = await convex.query(api.admin.adminUsers.isAdmin, { clerkUserId: userId });
  if (!isAdmin) return new Response("Forbidden", { status: 403 });

  const pdf = await readFile(path.join(process.cwd(), "docs/eligibility-companion/program-manager-guide.pdf"));
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="program-manager-guide.pdf"',
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
