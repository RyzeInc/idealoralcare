import fs from "node:fs";
import path from "node:path";

// Server-only: reads markdown docs from docs/admin/ for the in-app SOP
// Library / admin guide viewer at /admin/docs/**. Route segments mirror
// the docs/admin/ directory structure 1:1 (README.md -> directory index).
const DOCS_ROOT = path.join(process.cwd(), "docs", "admin");

function isInsideDocsRoot(candidate: string): boolean {
  return candidate === DOCS_ROOT || candidate.startsWith(DOCS_ROOT + path.sep);
}

function resolveDocFile(segments: string[]): string | null {
  const relDir = segments.length ? path.join(...segments) : "";
  const asFile = path.join(DOCS_ROOT, `${relDir}.md`);
  const asIndex = path.join(DOCS_ROOT, relDir, "README.md");

  if (isInsideDocsRoot(asFile) && fs.existsSync(asFile)) return asFile;
  if (isInsideDocsRoot(asIndex) && fs.existsSync(asIndex)) return asIndex;
  return null;
}

export type AdminDoc = {
  content: string;
  filePath: string;
  /** Resolves a markdown link's href (relative to this doc) to an /admin/docs/** app path. */
  resolveHref: (href: string) => string;
};

export function getDoc(segments: string[]): AdminDoc | null {
  const filePath = resolveDocFile(segments);
  if (!filePath) return null;
  const content = fs.readFileSync(filePath, "utf-8");
  const dir = path.dirname(filePath);
  return { content, filePath, resolveHref: (href) => resolveHref(dir, href) };
}

/**
 * Resolves a relative markdown link (e.g. "../guide/02-operations.md#anchor",
 * "SOP-002-....md", "guide/00-overview.md") against the current doc's directory
 * into an /admin/docs/** route. Non-relative links (http(s), mailto) pass through.
 */
export function resolveHref(currentDocDir: string, href: string): string {
  if (/^([a-z][a-z0-9+.-]*:|#)/i.test(href)) return href; // absolute URL, mailto, or pure anchor

  const hashIndex = href.indexOf("#");
  const pathPart = hashIndex === -1 ? href : href.slice(0, hashIndex);
  const hashPart = hashIndex === -1 ? "" : href.slice(hashIndex);

  if (!pathPart) return href;

  const absTarget = path.resolve(currentDocDir, pathPart);
  if (!isInsideDocsRoot(absTarget) || !absTarget.endsWith(".md")) {
    // Outside the docs tree or not a markdown file — leave unresolved.
    return href;
  }

  let relPath = path.relative(DOCS_ROOT, absTarget).replace(/\.md$/, "");
  relPath = relPath === "README" ? "" : relPath.replace(/(^|\/)README$/, "");
  const routeSegments = relPath.split(path.sep).filter(Boolean).join("/");

  return `/admin/docs${routeSegments ? `/${routeSegments}` : ""}${hashPart}`;
}

export type SopSummary = { slug: string; title: string };

export function listSops(): SopSummary[] {
  const dir = path.join(DOCS_ROOT, "sops");
  return fs
    .readdirSync(dir)
    .filter((f) => /^SOP-\d+.*\.md$/.test(f))
    .sort()
    .map((f) => {
      const slug = f.replace(/\.md$/, "");
      const content = fs.readFileSync(path.join(dir, f), "utf-8");
      const titleMatch = content.match(/^#\s+(.+)$/m);
      return { slug, title: titleMatch ? titleMatch[1].replace(/^SOP-\d+:\s*/, "") : slug };
    });
}
