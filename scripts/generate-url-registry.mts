/**
 * Renders the URL registry in both the formats it is needed in:
 *
 *   docs/URL_REGISTRY.md    — the in-repo reference, reviewable in a diff.
 *   docs/url-registry.html  — the page handed to a business partner, built
 *                             from scripts/url-registry-template.html.
 *
 *   npm run docs:urls
 *
 * Both come off one model built from src/lib/site-routes.ts and
 * src/lib/admin-nav.ts — the same two modules that produce sitemap.xml,
 * robots.txt, and the admin sidebar. Neither output is hand-editable: change
 * the registry and regenerate, or the next run overwrites you.
 *
 * Runs under bare `node --experimental-strip-types`, with no bundler and no
 * "@/" alias, which is why both imported modules are import-free. The .mts
 * extension is what tells Node this is ESM without forcing `"type": "module"`
 * on the package, which would break the CommonJS scripts alongside it.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  API_GROUPS,
  ROBOTS_DISALLOW,
  SITE_ROUTES,
  assertPrivateRoutesAreDisallowed,
  type RouteArea,
  type RouteAuth,
  type SiteRoute,
} from "../src/lib/site-routes.ts";
import { ADMIN_NAVIGATION } from "../src/lib/admin-nav.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const MD_OUT = resolve(HERE, "../docs/URL_REGISTRY.md");
const HTML_OUT = resolve(HERE, "../docs/url-registry.html");
const TEMPLATE = resolve(HERE, "./url-registry-template.html");
const BASE_URL = "https://getidealoh.com";

const AUTH_LABEL: Record<RouteAuth, string> = {
  none: "Public",
  member: "Member",
  partner: "Partner",
  staff: "Staff",
  owner: "Owner",
  webhook: "Signed webhook",
};

/**
 * Prose that belongs with the map but not in the data: the handful of things a
 * reader should know before acting on it. Written in the light markdown the
 * page's `inline()` renderer understands, so both outputs read the same.
 */
const CALLOUTS: string[] = [
  "**`/register` and `/register/partnerkit` are named backwards.** `/register` is the *signing* flow (Partner Agreement + W-9); `/register/partnerkit` is the *sign-up form* that requests the kit. Worth renaming before either URL goes on printed collateral.",
  "**`/health/plans/:slug` still serves hardcoded sample data** and is not linked from the plans page. It is deliberately excluded from the sitemap and blocked in robots.txt until it reads the live catalogue.",
  "**`/bootstrap`, `/debug/email-test`, and `/debug/employer-membership-agreement` are development utilities** that are crawl-blocked but not access-gated. Anyone with the URL can load them.",
  "**Any unreserved single-segment path is a rep vanity URL.** Adding a new top-level route means adding it to `src/lib/rep-routing/reserved.ts` as well, or a rep code can shadow it.",
  "**White-label brand sites are excluded from our sitemap on purpose** — they are near-duplicates of `/health` and would compete with the primary brand for the same search queries. They stay crawlable, so partners keep any organic traffic they earn.",
];

/**
 * The document's section order. "API" is absent on purpose — those are
 * rendered from API_GROUPS separately, not as a route table — and typing
 * AREA_BLURB against this list rather than against RouteArea is what keeps
 * that omission deliberate instead of an oversight.
 */
const AREA_ORDER = [
  "Marketing",
  "Member portal",
  "Registration",
  "White-label",
  "Partner portal",
  "Admin console",
  "CRM",
  "System",
] as const satisfies readonly RouteArea[];

const AREA_BLURB: Record<(typeof AREA_ORDER)[number], string> = {
  Marketing: "Public pages. These are the indexable surface — everything here is in `sitemap.xml` unless a note says otherwise.",
  "Member portal": "Reachable without a link but never indexed. Sign-in, checkout, and the member's own account pages.",
  Registration: "Public lead capture. These feed the Partner Kit Leads and Partner Applications queues in the admin console.",
  "White-label": "Partner-branded mirrors of the marketing and member pages, themed per site from the `sites` table.",
  "Partner portal": "Distribution partners see their own book here, and only their own book. Partners have no CRM access at all — that boundary is enforced per Convex function, not just per route.",
  "Admin console": "Internal staff only. Ordered below as the sidebar orders it.",
  CRM: "Internal staff only, gated a second time on top of the admin gate: some CRM contacts are themselves brokers.",
  System: "Operational and development endpoints.",
};

// ─── Model ─────────────────────────────────────────────────────────────────

interface Group {
  label: string | null;
  routes: SiteRoute[];
}

interface Section {
  title: string;
  blurb: string;
  groups: Group[];
}

function buildSections(): Section[] {
  const sections: Section[] = [];

  for (const area of AREA_ORDER) {
    const routes = SITE_ROUTES.filter((route) => route.area === area);
    if (routes.length === 0) continue;

    if (area !== "Admin console") {
      sections.push({ title: area, blurb: AREA_BLURB[area], groups: [{ label: null, routes }] });
      continue;
    }

    // The console is ordered by its sidebar rather than by path, because that
    // is the order the person reading this will meet the pages in.
    const groups: Group[] = [];
    const placed = new Set<string>();

    for (const navSection of ADMIN_NAVIGATION) {
      const inSection: SiteRoute[] = [];
      for (const item of navSection.items) {
        // The CRM has its own area section below.
        if (item.href.startsWith("/admin/crm")) continue;
        const route = routes.find((r) => r.path === item.href);
        if (route) {
          inSection.push(route);
          placed.add(route.path);
        }
      }
      if (inSection.length > 0) groups.push({ label: navSection.section, routes: inSection });
    }

    const extras = routes.filter((route) => !placed.has(route.path));
    if (extras.length > 0) {
      groups.push({ label: "Detail pages (reached from the pages above, not the sidebar)", routes: extras });
    }

    sections.push({ title: area, blurb: AREA_BLURB[area], groups });
  }

  return sections;
}

const sections = buildSections();
const indexable = SITE_ROUTES.filter((route) => route.sitemap);
const problems = assertPrivateRoutesAreDisallowed();

const SITEMAP_SUMMARY = `\`sitemap.xml\` lists **${indexable.length} static pages** plus one entry per blog post. Blog posts are expanded from \`src/app/health/blog/posts.ts\`, each carrying its own publish date.`;
const ORIGIN = `Generated by \`npm run docs:urls\` from \`src/lib/site-routes.ts\` and \`src/lib/admin-nav.ts\` — the same definitions that produce \`sitemap.xml\`, \`robots.txt\`, and the admin sidebar. Editing the output by hand will be overwritten.`;

// ─── Markdown ──────────────────────────────────────────────────────────────

function escapeCell(text: string): string {
  return text.replace(/\|/g, "\\|");
}

function table(routes: SiteRoute[]): string {
  const lines = ["| Path | Purpose | Access | Sitemap |", "| --- | --- | --- | --- |"];
  for (const route of routes) {
    const purpose = route.notes
      ? `${escapeCell(route.purpose)}<br><em>${escapeCell(route.notes)}</em>`
      : escapeCell(route.purpose);
    lines.push(`| \`${route.path}\` | ${purpose} | ${AUTH_LABEL[route.auth]} | ${route.sitemap ? "Yes" : "—"} |`);
  }
  return lines.join("\n");
}

function renderMarkdown(): string {
  const out: string[] = [];

  out.push("# URL Registry — Ideal Oral Health", "");
  out.push(`Every URL the platform serves, what it is for, and who can reach it. Production base URL: \`${BASE_URL}\`.`, "");
  out.push(`> ${ORIGIN}`, "");

  out.push("## Access levels", "");
  out.push("| Level | Meaning |", "| --- | --- |");
  out.push("| Public | No account required. |");
  out.push("| Member | Requires a signed-in member with an active membership. |");
  out.push("| Partner | Requires a distribution partner with a resolved scope; each partner sees only their own book. |");
  out.push("| Staff | Requires an internal `adminUsers` record. |");
  out.push("| Owner | Requires the `owner` role specifically. |");
  out.push("| Signed webhook | Machine-to-machine. Unauthenticated by design, verified by provider signature. |", "");
  out.push("Access is enforced server-side on every route *and* independently inside each Convex function. Hiding a link is never the control.", "");

  out.push("## Worth knowing", "");
  for (const callout of CALLOUTS) out.push(`- ${callout}`);
  out.push("");

  for (const section of sections) {
    out.push(`## ${section.title}`, "", section.blurb, "");
    for (const group of section.groups) {
      if (group.label) out.push(`### ${group.label}`, "");
      out.push(table(group.routes), "");
    }
  }

  out.push("## API", "");
  out.push("HTTP endpoints, grouped by integration. Every one of these is blocked in `robots.txt`; the access column is what the endpoint itself enforces.", "");
  for (const group of API_GROUPS) {
    out.push(`### ${group.title} — \`${group.prefix}\``, "");
    out.push(`${group.purpose} **Access:** ${AUTH_LABEL[group.auth]}.`, "");
    out.push("```", ...group.endpoints, "```", "");
  }

  out.push("## Search engine surface", "", SITEMAP_SUMMARY, "");
  out.push("`robots.txt` disallows:", "");
  out.push("```", ...ROBOTS_DISALLOW.map((prefix) => `Disallow: ${prefix}`), "```", "");
  out.push("A trailing slash is load-bearing: `/health/plans/` blocks the plan detail pages while leaving `/health/plans` itself indexable.", "");

  if (problems.length > 0) {
    out.push("## ⚠️ Registry problems", "");
    for (const problem of problems) out.push(`- ${problem}`);
    out.push("");
  }

  return out.join("\n");
}

// ─── HTML ──────────────────────────────────────────────────────────────────

function renderHtml(): string {
  const model = {
    brand: "Ideal Oral Health · Platform reference",
    lede: `Every route the platform serves, what it is for, and who can reach it. Production base URL: ${BASE_URL}.`,
    origin: ORIGIN,
    colophon: `${SITE_ROUTES.length} routes and ${API_GROUPS.length} API groups, generated from the codebase. ${
      problems.length > 0 ? `**${problems.length} registry problem(s) detected — see the build output.**` : "No registry inconsistencies detected."
    }`,
    sitemapSummary: SITEMAP_SUMMARY,
    stats: [
      { value: String(SITE_ROUTES.length), label: "documented routes" },
      { value: String(indexable.length), label: "in sitemap.xml" },
      { value: String(SITE_ROUTES.filter((r) => r.auth !== "none" && r.auth !== "webhook").length), label: "require a session" },
      { value: String(API_GROUPS.reduce((sum, g) => sum + g.endpoints.length, 0)), label: "API endpoints" },
    ],
    callouts: CALLOUTS,
    robots: ROBOTS_DISALLOW,
    sections: sections.map((section) => ({
      title: section.title,
      blurb: section.blurb,
      groups: section.groups.map((group) => ({
        label: group.label,
        routes: group.routes.map((route) => ({
          path: route.path,
          title: route.title,
          purpose: route.purpose,
          notes: route.notes ?? null,
          auth: AUTH_LABEL[route.auth],
          sitemap: Boolean(route.sitemap),
        })),
      })),
    })),
    api: API_GROUPS.map((group) => ({
      title: group.title,
      prefix: group.prefix,
      purpose: group.purpose,
      auth: AUTH_LABEL[group.auth],
      endpoints: group.endpoints,
    })),
  };

  // Escaping "<" is what stops a "</script>" inside any purpose or note from
  // closing the data block early.
  const json = JSON.stringify(model).replace(/</g, "\\u003c");
  const template = readFileSync(TEMPLATE, "utf8");
  if (!template.includes("__REGISTRY_DATA__")) {
    throw new Error(`${TEMPLATE} is missing its __REGISTRY_DATA__ placeholder`);
  }
  return template.replace("__REGISTRY_DATA__", json);
}

// ─── Write ─────────────────────────────────────────────────────────────────

writeFileSync(MD_OUT, renderMarkdown());
writeFileSync(HTML_OUT, renderHtml());

console.log(`Wrote ${MD_OUT}`);
console.log(`Wrote ${HTML_OUT}`);
console.log(`${SITE_ROUTES.length} routes · ${indexable.length} indexable · ${API_GROUPS.length} API groups`);

if (problems.length > 0) {
  console.error(`\n${problems.length} registry problem(s):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
