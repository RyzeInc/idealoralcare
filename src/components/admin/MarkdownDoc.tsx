import Link from "next/link";
import Markdown, { type ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import type { ComponentPropsWithoutRef } from "react";

// The project doesn't ship @tailwindcss/typography, so the old `prose` classes
// were dead no-ops and the docs rendered unstyled. Instead we style each markdown
// element explicitly below — restrained, generously spaced, comfortable to read.

type MdProps<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithoutRef<T> & ExtraProps;

/** Drop the mdast `node` react-markdown injects so it isn't spread onto the DOM. */
function clean<T extends object>(props: T & ExtraProps): T {
  const { node: _node, ...rest } = props;
  void _node;
  return rest as T;
}

export function MarkdownDoc({
  content,
  resolveHref,
  className = "",
}: {
  content: string;
  resolveHref: (href: string) => string;
  className?: string;
}) {
  return (
    <div className={`text-slate-700 ${className}`}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug]}
        components={{
          a: (props: MdProps<"a">) => <DocLink {...props} resolveHref={resolveHref} />,
          h1: (props: MdProps<"h1">) => (
            <h1 className="mt-2 mb-4 text-2xl font-semibold tracking-tight text-slate-900" {...clean(props)} />
          ),
          h2: (props: MdProps<"h2">) => (
            <h2
              className="mt-10 mb-3 scroll-mt-24 border-b border-slate-100 pb-2 text-lg font-semibold tracking-tight text-slate-900 first:mt-0"
              {...clean(props)}
            />
          ),
          h3: (props: MdProps<"h3">) => (
            <h3 className="mt-7 mb-2 scroll-mt-24 text-[15px] font-semibold text-slate-800" {...clean(props)} />
          ),
          p: (props: MdProps<"p">) => (
            <p className="my-3 text-[15px] leading-7 text-slate-700" {...clean(props)} />
          ),
          ul: (props: MdProps<"ul">) => (
            <ul className="my-3 list-disc space-y-1.5 pl-5 text-[15px] leading-7 text-slate-700 marker:text-slate-400" {...clean(props)} />
          ),
          ol: (props: MdProps<"ol">) => (
            <ol
              className="my-3 list-decimal space-y-2 pl-5 text-[15px] leading-7 text-slate-700 marker:font-semibold marker:text-slate-400"
              {...clean(props)}
            />
          ),
          li: (props: MdProps<"li">) => <li className="pl-1 [&>ul]:mt-1.5 [&>ol]:mt-1.5" {...clean(props)} />,
          strong: (props: MdProps<"strong">) => <strong className="font-semibold text-slate-900" {...clean(props)} />,
          blockquote: (props: MdProps<"blockquote">) => (
            <blockquote
              className="my-4 rounded-r-md border-l-2 border-slate-300 bg-slate-50 px-4 py-2 text-[15px] text-slate-600 [&>p]:my-1.5"
              {...clean(props)}
            />
          ),
          hr: (props: MdProps<"hr">) => <hr className="my-8 border-slate-100" {...clean(props)} />,
          code: (props: MdProps<"code"> & { className?: string }) => {
            const { className: codeClass, ...rest } = clean(props);
            const isBlock = /\blanguage-/.test(codeClass ?? "");
            if (isBlock) return <code className={codeClass} {...rest} />;
            return (
              <code
                className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px] text-slate-800"
                {...rest}
              />
            );
          },
          pre: (props: MdProps<"pre">) => (
            <pre
              className="my-4 overflow-x-auto rounded-lg bg-slate-900 p-4 font-mono text-[13px] leading-6 text-slate-100"
              {...clean(props)}
            />
          ),
          table: (props: MdProps<"table">) => (
            <div className="my-5 overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full border-collapse text-sm" {...clean(props)} />
            </div>
          ),
          thead: (props: MdProps<"thead">) => <thead className="bg-slate-50" {...clean(props)} />,
          th: (props: MdProps<"th">) => (
            <th
              className="border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              {...clean(props)}
            />
          ),
          td: (props: MdProps<"td">) => (
            <td className="border-b border-slate-100 px-3 py-2 align-top text-[14px] leading-6 text-slate-700" {...clean(props)} />
          ),
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}

function DocLink({
  href,
  node,
  resolveHref,
  ...rest
}: ComponentPropsWithoutRef<"a"> & { resolveHref: (href: string) => string; node?: unknown }) {
  void node; // react-markdown injects the mdast node; discard so it isn't spread onto the DOM element
  if (!href) return <a {...rest} />;

  const resolved = resolveHref(href);
  const isExternal = /^[a-z][a-z0-9+.-]*:/i.test(resolved) && !resolved.startsWith("mailto:");
  const cls = "font-medium text-blue-600 underline-offset-2 hover:text-blue-700 hover:underline";

  if (isExternal) {
    return <a href={resolved} target="_blank" rel="noopener noreferrer" className={cls} {...rest} />;
  }
  return <Link href={resolved} className={cls} {...rest} />;
}
