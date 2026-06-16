import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get user from Clerk
    const clerkRes = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
    });

    if (!clerkRes.ok) {
      return Response.json({ error: "Failed to fetch user" }, { status: 500 });
    }

    const user = await clerkRes.json();
    const email = user.email_addresses?.[0]?.email_address || user.email;

    if (!email) {
      return Response.json({ redirect: "/health/dashboard" });
    }

    // Check for pending admin invite
    const invite = await convex.query(api.admin.adminUsers.getPendingInviteByEmail, {
      email,
    });

    if (invite?.token) {
      return Response.json({
        redirect: `/health/claim-invite?token=${encodeURIComponent(invite.token)}&source=admin`,
      });
    }

    return Response.json({ redirect: "/health/dashboard" });
  } catch (error) {
    console.error("Post-signup check error:", error);
    return Response.json({ redirect: "/health/dashboard" });
  }
}
