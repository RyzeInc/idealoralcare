import path from "node:path";
import { ADMIN_DOCS } from "./admin-docs-content";

// Reads markdown docs for the in-app SOP Library / admin guide viewer at
// /admin/docs/**, keyed the same way as ADMIN_DOCS (see admin-docs-content.ts):
// "" is the root index, "sops" is the SOP Library index, "sops/SOP-001-..."
// is a single SOP, etc. Content lives in memory (compiled into the bundle),
// not on disk, so there's nothing here that can go missing at deploy time.

export type AdminDoc = {
  content: string;
  resolveHref: (href: string) => string;
};

export function getDoc(segments: string[]): AdminDoc | null {
  const key = segments.join("/");
  const entry = ADMIN_DOCS[key];
  if (!entry) return null;
  return { content: entry.content, resolveHref: (href) => resolveHref(entry.dir, href) };
}

/**
 * Resolves a relative markdown link (e.g. "../guide/02-operations.md#anchor",
 * "SOP-002-....md", "guide/00-overview.md") against the current doc's directory
 * key into an /admin/docs/** route. Non-relative links (http(s), mailto, pure
 * anchors) pass through unchanged, as does anything that doesn't resolve to a
 * known doc.
 */
export function resolveHref(currentDocDir: string, href: string): string {
  if (/^([a-z][a-z0-9+.-]*:|#)/i.test(href)) return href;

  const hashIndex = href.indexOf("#");
  const pathPart = hashIndex === -1 ? href : href.slice(0, hashIndex);
  const hashPart = hashIndex === -1 ? "" : href.slice(hashIndex);
  if (!pathPart) return href;

  const targetPath = path.posix.normalize(path.posix.join(currentDocDir, pathPart));
  if (targetPath.startsWith("..") || !targetPath.endsWith(".md")) return href;

  const key = targetPath.replace(/\.md$/, "").replace(/(^|\/)README$/, "");
  return key in ADMIN_DOCS ? `/admin/docs${key ? `/${key}` : ""}${hashPart}` : href;
}

export type SopSummary = { slug: string; title: string };

export function listSops(): SopSummary[] {
  return Object.entries(ADMIN_DOCS)
    .filter(([key]) => /^sops\/SOP-\d+/.test(key))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, { content }]) => {
      const slug = key.slice("sops/".length);
      const titleMatch = content.match(/^#\s+(.+)$/m);
      return { slug, title: titleMatch ? titleMatch[1].replace(/^SOP-\d+:\s*/, "") : slug };
    });
}
