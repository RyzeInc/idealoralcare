'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CRM_NAV_ITEMS, activeHref } from '@/lib/admin-nav';

/**
 * The CRM's tab strip. Reads the same list the sidebar and Cmd-K palette read,
 * so a new CRM page appears in all three at once.
 */
export function CrmSubNav() {
  const pathname = usePathname() ?? '';
  const active = activeHref(pathname, CRM_NAV_ITEMS.map((item) => item.href));

  return (
    <nav
      className="flex gap-1 border-b border-slate-200 -mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto"
      aria-label="CRM navigation"
    >
      {CRM_NAV_ITEMS.map((item) => {
        const isActive = active === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.tooltip}
            aria-current={isActive ? 'page' : undefined}
            className={`px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${
              isActive ? 'border-blue-500 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {item.shortLabel ?? item.label}
          </Link>
        );
      })}
    </nav>
  );
}
