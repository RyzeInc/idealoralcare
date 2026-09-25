import type { ReactNode } from "react";
import { AREA_STYLE, type SopMeta } from "@/lib/admin-sops";
import { MarkdownDoc } from "@/components/admin/MarkdownDoc";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-t border-slate-100 py-4">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className="mt-1 text-[15px] leading-6 text-slate-800">{children}</dd>
    </div>
  );
}

/**
 * The polished layout for a single SOP: an area-accented header with the code,
 * category tag and keyword chips, then an "at a glance" metadata card, then the
 * procedure body (with its H1 / Purpose / Who / When intro already stripped, so
 * nothing is repeated).
 */
export function SopArticle({
  meta,
  body,
  resolveHref,
}: {
  meta: SopMeta;
  body: string;
  resolveHref: (href: string) => string;
}) {
  const area = AREA_STYLE[meta.area];
  return (
    <div className="space-y-5">
      <header className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className={`h-1.5 ${area.bar}`} aria-hidden />
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-medium text-slate-600">
              {meta.code}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${area.tag}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${area.dot}`} aria-hidden />
              {meta.area}
            </span>
            {meta.tags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-500"
              >
                {t}
              </span>
            ))}
          </div>

          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{meta.title}</h1>

          <dl className="mt-5 grid grid-cols-1 gap-x-10 gap-y-0 sm:grid-cols-2">
            <Field label="Outcome">{meta.outcome}</Field>
            <Field label="When you'd do this">{meta.when}</Field>
            <Field label="How often">{meta.frequency}</Field>
            <Field label="Who can do this">{meta.who}</Field>
          </dl>
        </div>
      </header>

      <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <MarkdownDoc content={body} resolveHref={resolveHref} />
      </article>
    </div>
  );
}
