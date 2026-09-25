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
export default function sitemap(): MetadataRoute.Sitemap {
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
