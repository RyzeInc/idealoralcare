import { cache } from "react";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";

export const readPublicSite = cache(async (slug: string): Promise<Doc<"sites"> | null> => {
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL ?? "");
  const site = await convex.query(api.hierarchy.resolveSiteBySlug, { slug });
  return site && site._id !== "pending" ? site as Doc<"sites"> : null;
});
