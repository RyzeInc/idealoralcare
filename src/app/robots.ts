import { headers } from "next/headers";
import { domainSite } from "@/lib/site-domains";
import { ASSURE_URL } from "@/lib/assure-content";
import type { MetadataRoute } from "next";
import { ROBOTS_DISALLOW } from "@/lib/site-routes";

/**
 * Disallow rules come from src/lib/site-routes.ts, where a test asserts that
 * every route requiring a session is covered by one of them.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  if (domainSite((await headers()).get("host")))
    return {
      rules: [
        {
          userAgent: "*",
          allow: "/",
          disallow: [
            ...ROBOTS_DISALLOW,
            ...[
              "sign-in",
              "sign-up",
              "forgot-password",
              "sso-callback",
              "dashboard",
              "manage-plans",
              "claim-invite",
              "program-checkout",
              "checkout",
              "program-success",
              "enroll",
            ].map((path) => `/assurevantage/${path}`),
          ],
        },
      ],
      sitemap: `${ASSURE_URL}/sitemap.xml`,
    };
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
