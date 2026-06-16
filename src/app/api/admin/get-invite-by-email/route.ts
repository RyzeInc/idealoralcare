import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  if (!email) {
    return Response.json({ error: "Missing email parameter" }, { status: 400 });
  }

  try {
    const invite = await convex.query(api.admin.adminUsers.getPendingInviteByEmail, {
      email,
    });

    if (!invite) {
      return Response.json({ token: null }, { status: 200 });
    }

    return Response.json(invite, { status: 200 });
  } catch (error) {
    console.error("Error fetching admin invite:", error);
    return Response.json({ error: "Failed to fetch invite" }, { status: 500 });
  }
}
