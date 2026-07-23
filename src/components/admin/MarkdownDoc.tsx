import Link from "next/link";
import Markdown, { type ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import type { ComponentPropsWithoutRef } from "react";

export function MarkdownDoc({
  content,
  resolveHref,
}: {
  content: string;
  resolveHref: (href: string) => string;
}) {
  return (
    <div className="prose prose-slate max-w-none prose-headings:font-semibold prose-a:text-blue-600 hover:prose-a:text-blue-700 prose-code:before:content-none prose-code:after:content-none">
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug]}
        components={{
          a: (props: ComponentPropsWithoutRef<"a"> & ExtraProps) => (
            <DocLink {...props} resolveHref={resolveHref} />
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

  if (isExternal) {
    return <a href={resolved} target="_blank" rel="noopener noreferrer" {...rest} />;
  }
  return <Link href={resolved} {...rest} />;
}
