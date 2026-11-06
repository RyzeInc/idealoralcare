import { headers } from "next/headers";
import { domainSite } from "@/lib/site-domains";
import { ASSURE_URL, ASSURE_PAGES } from "@/lib/assure-content";
import { GUIDES } from "@/lib/assure-guides";
import type { MetadataRoute } from "next";
import { BLOG_POSTS } from "./health/blog/posts";
import { MARKETING_CONTENT_UPDATED, indexableRoutes } from "@/lib/site-routes";

const BASE_URL = "https://getidealoh.com";

/**
 * Derived from src/lib/site-routes.ts rather than maintained here, so a new
 * public page is one registry entry away from being indexed instead of
 * something you remember to add in two places. Routes carrying a `sitemap`
 * block are in; everything else is deliberately out, with the registry's
 * `notes` recording why.
 *
 * White-label brand sites (/:siteSlug) stay out on purpose: they are
 * near-duplicates of /health and would compete with the primary brand for the
 * same queries. They remain crawlable — see the registry entry.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (domainSite((await headers()).get("host")))
    return [
      {
        url: ASSURE_URL + "/",
        lastModified: "2026-11-06",
        changeFrequency: "weekly",
        priority: 1,
      },
      ...Object.keys(ASSURE_PAGES).map((path) => ({
        url: `${ASSURE_URL}/assurevantage/${path}`,
        lastModified: "2026-11-06",
        changeFrequency: "monthly" as const,
        priority: path === "program-plans" ? 0.9 : 0.7,
      })),
      ...Object.keys(GUIDES).map((slug) => ({
        url: `${ASSURE_URL}/assurevantage/blog/${slug}`,
        lastModified: "2026-11-06",
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })),
    ];
  const pages: MetadataRoute.Sitemap = indexableRoutes()
    // Dynamic routes cannot be emitted from a static path; each is expanded
    // from its own data source below.
    .filter((route) => !route.path.includes(":"))
    .map((route) => ({
      url: `${BASE_URL}${route.path}`,
      lastModified: MARKETING_CONTENT_UPDATED,
      changeFrequency: route.sitemap!.changeFrequency,
      priority: route.sitemap!.priority,
    }));

  // Blog posts carry their own publish date, which is a truer lastModified
  // than the shared marketing date.
  const blogPages: MetadataRoute.Sitemap = BLOG_POSTS.map((post) => ({
    url: `${BASE_URL}/health/blog/${post.slug}`,
    lastModified: post.datePublished,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...pages, ...blogPages];
}
