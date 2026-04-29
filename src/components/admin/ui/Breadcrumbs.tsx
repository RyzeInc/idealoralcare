'use client';

import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (!items || items.length === 0) return null;
  const crumbs: Crumb[] = [{ label: 'Admin', href: '/admin' }, ...items];
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center flex-wrap gap-1 text-xs text-slate-500">
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <li key={`${c.label}-${i}`} className="flex items-center gap-1">
              {i === 0 && <Home size={12} className="text-slate-400" aria-hidden />}
              {c.href && !isLast ? (
                <Link href={c.href} className="hover:text-slate-700 hover:underline">
                  {c.label}
                </Link>
              ) : (
                <span className={isLast ? 'font-medium text-slate-700' : ''} aria-current={isLast ? 'page' : undefined}>
                  {c.label}
                </span>
              )}
              {!isLast && <ChevronRight size={12} className="text-slate-300" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
