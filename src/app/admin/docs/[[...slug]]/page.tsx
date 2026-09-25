import { notFound } from "next/navigation";
import { BookOpen } from "lucide-react";
import { Breadcrumbs, type Crumb } from "@/components/admin/ui/Breadcrumbs";
import { MarkdownDoc } from "@/components/admin/MarkdownDoc";
import { SopDirectory } from "@/components/admin/docs/SopDirectory";
import { SopArticle } from "@/components/admin/docs/SopArticle";
import { getDoc } from "@/lib/admin-docs";
import { getSop, stripSopIntro } from "@/lib/admin-sops";

const SECTION_LABELS: Record<string, string> = {
  sops: "SOP Library",
  guide: "Admin Guide",
};

function extractTitle(content: string, fallback: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1] : fallback;
}

function buildCrumbs(segments: string[], title: string): Crumb[] {
  if (segments.length === 0) return [{ label: "Docs" }];

  const [section, ...rest] = segments;
  const sectionLabel = SECTION_LABELS[section] ?? section;

  if (rest.length === 0) {
    return [{ label: "Docs", href: "/admin/docs" }, { label: sectionLabel }];
  }
  return [
    { label: "Docs", href: "/admin/docs" },
    { label: sectionLabel, href: `/admin/docs/${section}` },
    { label: title },
  ];
}

export default async function AdminDocsPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const segments = slug ?? [];

  const doc = getDoc(segments);
  if (!doc) notFound();

  // The SOP Library index gets a bespoke directory (scannable table, colored
  // area tags, filter tabs) rather than the generic markdown render.
  if (segments.length === 1 && segments[0] === "sops") {
    return (
      <div className="max-w-6xl">
        <Breadcrumbs items={buildCrumbs(segments, "SOP Library")} />
        <SopDirectory />
      </div>
    );
  }

  // A single SOP gets the polished article layout (header + at-a-glance card),
  // driven by its structured metadata; the markdown body renders below it.
  if (segments.length === 2 && segments[0] === "sops") {
    const meta = getSop(segments[1]);
    if (meta) {
      return (
        <div className="max-w-4xl">
          <Breadcrumbs items={buildCrumbs(segments, meta.title)} />
          <SopArticle meta={meta} body={stripSopIntro(doc.content)} resolveHref={doc.resolveHref} />
        </div>
      );
    }
  }

  // Everything else (root index, guide chapters) uses the generic doc renderer.
  const title = extractTitle(doc.content, segments[segments.length - 1] ?? "Admin Docs");
  return (
    <div className="space-y-6 max-w-4xl">
      <Breadcrumbs items={buildCrumbs(segments, title)} />
      <header className="flex items-center gap-2 text-slate-400">
        <BookOpen size={18} />
        <span className="text-xs uppercase tracking-wider font-semibold">Admin Docs</span>
      </header>
      <div className="bg-white border border-slate-200 rounded-xl p-8">
        <MarkdownDoc content={doc.content} resolveHref={doc.resolveHref} />
      </div>
    </div>
  );
}
