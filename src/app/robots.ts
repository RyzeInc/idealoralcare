import type { MetadataRoute } from "next";
import { ROBOTS_DISALLOW } from "@/lib/site-routes";

/**
 * Disallow rules come from src/lib/site-routes.ts, where a test asserts that
 * every route requiring a session is covered by one of them.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [...ROBOTS_DISALLOW],
      },
    ],
    sitemap: "https://getidealoh.com/sitemap.xml",
  };
}
