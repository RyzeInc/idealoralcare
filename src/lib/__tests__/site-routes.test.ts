// @vitest-environment node

/**
 * The registry is only worth having if it cannot drift from the app. These
 * tests are the mechanism: they walk src/app and compare what is actually
 * routable against what src/lib/site-routes.ts claims exists, in both
 * directions.
 *
 * The reverse direction is the one that earns its keep — it is how
 * /admin/list-bill was found shipped, reachable, and absent from every nav
 * surface in the console.
 */

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  ROBOTS_DISALLOW,
  SITE_ROUTES,
  assertPrivateRoutesAreDisallowed,
  indexableRoutes,
} from "../site-routes";
import { ADMIN_NAVIGATION, CRM_NAV_ITEMS } from "../admin-nav";
import { KNOWN_ICON_NAMES } from "@/components/admin/nav-icons";

const APP_DIR = resolve(__dirname, "../../app");

/** Directory segment → URL segment, or null for segments that vanish from the URL. */
function segmentToUrl(segment: string): string | null {
  // Route groups and parallel/intercepting routes contribute no path.
  if (segment.startsWith("(") && segment.endsWith(")")) return null;
  if (segment.startsWith("@")) return null;
  // [[...slug]] and [...slug] — a catch-all, matched by prefix below.
  if (/^\[\[?\.\.\..+\]\]?$/.test(segment)) return "*";
  const dynamic = segment.match(/^\[(.+)\]$/);
  if (dynamic) return `:${dynamic[1]}`;
  return segment;
}

function collectPageRoutes(dir: string, segments: string[] = []): string[] {
  const routes: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (!statSync(full).isDirectory()) {
      if (entry === "page.tsx" || entry === "page.ts") {
        const path = segments.length === 0 ? "/" : `/${segments.join("/")}`;
        routes.push(path);
      }
      continue;
    }
    // API handlers are registered as groups, not one row per file.
    if (entry === "api") continue;
    const urlSegment = segmentToUrl(entry);
    routes.push(...collectPageRoutes(full, urlSegment === null ? segments : [...segments, urlSegment]));
  }
  return routes;
}

const registeredPaths = new Set(SITE_ROUTES.map((route) => route.path));

/**
 * A catch-all stands in for every path beneath it, so it is satisfied by any
 * registry entry under its static prefix rather than by an exact match.
 */
function isCovered(fileRoute: string): boolean {
  if (registeredPaths.has(fileRoute)) return true;
  const wildcard = fileRoute.indexOf("/*");
  if (wildcard === -1) return false;
  const prefix = fileRoute.slice(0, wildcard);
  return SITE_ROUTES.some((route) => route.path.startsWith(`${prefix}/`));
}

describe("site route registry", () => {
  const fileRoutes = collectPageRoutes(APP_DIR)
    // The white-label subtree is one registry entry (/:siteSlug) describing a
    // themed mirror of pages already documented under /health, rather than
    // twenty near-duplicate rows.
    .filter((route) => !route.startsWith("/:siteSlug"));

  it("finds the app's routes at all (guards against the walker silently breaking)", () => {
    expect(fileRoutes.length).toBeGreaterThan(50);
  });

  it("documents every page that ships", () => {
    const undocumented = fileRoutes.filter((route) => !isCovered(route)).sort();
    expect(undocumented).toEqual([]);
  });

  it("documents no page that does not ship", () => {
    // Registry-only entries are legitimate for things the App Router does not
    // produce from a page.tsx: middleware redirects and generated files.
    const notFromPages = new Set(["/:repSlug", "/:siteSlug", "/sitemap.xml", "/robots.txt"]);
    const routableOrCatchAll = (path: string) =>
      fileRoutes.some((fileRoute) => {
        if (fileRoute === path) return true;
        const wildcard = fileRoute.indexOf("/*");
        return wildcard !== -1 && path.startsWith(`${fileRoute.slice(0, wildcard)}/`);
      });

    const phantom = SITE_ROUTES.filter(
      (route) => !notFromPages.has(route.path) && !routableOrCatchAll(route.path),
    )
      .map((route) => route.path)
      .sort();
    expect(phantom).toEqual([]);
  });

  it("has no duplicate paths", () => {
    const seen = new Set<string>();
    const duplicates = SITE_ROUTES.map((route) => route.path).filter((path) => {
      if (seen.has(path)) return true;
      seen.add(path);
      return false;
    });
    expect(duplicates).toEqual([]);
  });
});

describe("generated documentation", () => {
  // docs/URL_REGISTRY.md is what gets handed to a partner. It is generated, so
  // the failure mode is not a wrong document but a stale one — someone adds a
  // route and never runs `npm run docs:urls`.
  const doc = readFileSync(resolve(__dirname, "../../../docs/URL_REGISTRY.md"), "utf8");

  it("lists every registered route", () => {
    const missing = SITE_ROUTES.filter((route) => !doc.includes(`\`${route.path}\``)).map((route) => route.path);
    expect(missing.sort()).toEqual([]);
  });

  it("matches the current robots.txt rules", () => {
    const missing = ROBOTS_DISALLOW.filter((prefix) => !doc.includes(`Disallow: ${prefix}`));
    expect(missing).toEqual([]);
  });
});

describe("crawler rules", () => {
  it("blocks every route that requires a session, and blocks nothing in the sitemap", () => {
    expect(assertPrivateRoutesAreDisallowed()).toEqual([]);
  });

  it("emits sitemap priorities inside the range the spec allows", () => {
    for (const route of indexableRoutes()) {
      expect(route.sitemap!.priority).toBeGreaterThan(0);
      expect(route.sitemap!.priority).toBeLessThanOrEqual(1);
    }
  });

  it("never lists a dynamic path as a static sitemap entry", () => {
    // A ":param" reaching sitemap.xml would emit a literal ":slug" URL.
    const dynamic = indexableRoutes()
      .filter((route) => route.path.includes(":"))
      .map((route) => route.path);
    expect(dynamic).toEqual([]);
  });

  it("writes Disallow prefixes without a trailing slash unless children-only is intended", () => {
    // "/health/plans/" is the one deliberate exception: it hides the plan
    // detail pages while leaving /health/plans indexable.
    const trailing = ROBOTS_DISALLOW.filter((prefix) => prefix.endsWith("/"));
    expect(trailing).toEqual(["/health/plans/"]);
  });
});

describe("admin navigation", () => {
  const navItems = [
    ...ADMIN_NAVIGATION.flatMap((section) => section.items),
    ...ADMIN_NAVIGATION.flatMap((section) => section.items.flatMap((item) => item.children ?? [])),
    ...CRM_NAV_ITEMS,
  ];

  it("points every entry at a registered route", () => {
    const dangling = navItems.filter((item) => !registeredPaths.has(item.href)).map((item) => item.href);
    expect([...new Set(dangling)].sort()).toEqual([]);
  });

  it("uses only icon names the icon map knows", () => {
    const unknown = navItems.filter((item) => !KNOWN_ICON_NAMES.includes(item.icon)).map((item) => item.icon);
    expect([...new Set(unknown)].sort()).toEqual([]);
  });

  it("gives every staff-facing admin page a way to reach it", () => {
    // Detail pages are reached from their index, so only top-level staff pages
    // are required to appear in a nav surface.
    const reachable = new Set(navItems.map((item) => item.href));
    const orphans = SITE_ROUTES.filter((route) => {
      if (route.area !== "Admin console" && route.area !== "CRM") return false;
      // Two segments past /admin means a detail or child page.
      if (route.path.split("/").length > (route.path.startsWith("/admin/crm") ? 4 : 3)) return false;
      if (route.path.includes(":")) return false;
      return !reachable.has(route.path);
    }).map((route) => route.path);

    expect(orphans.sort()).toEqual([]);
  });
});
