import { notFound } from "next/navigation";
import { BookOpen } from "lucide-react";
import { Breadcrumbs, type Crumb } from "@/components/admin/ui/Breadcrumbs";
import { MarkdownDoc } from "@/components/admin/MarkdownDoc";
import { getDoc } from "@/lib/admin-docs";

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
