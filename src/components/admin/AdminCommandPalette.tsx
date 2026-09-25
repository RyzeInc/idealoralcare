'use client';

/**
 * CMD-K PALETTE — search and jump from anywhere in the admin console.
 *
 * Supersedes the CRM-scoped palette this replaced. That one only mounted
 * inside /admin/crm, so the fastest way to reach a contact from the Members
 * page was to navigate into the CRM first and then search — and the other
 * twenty-odd admin pages had no keyboard route at all. Mounting one palette at
 * the admin layout fixes both, and avoids the double Cmd-K binding two
 * palettes would have caused.
 *
 * Open state is owned by AdminShell so the toolbar button and the Cmd-K
 * binding drive the same switch.
 *
 * Two result groups:
 *   Records — CRM contacts and companies, only for CRM staff. Fetched
 *     imperatively through `useConvex().query` rather than `useQuery`: the term
 *     changes on every keystroke, and a subscription per keystroke is the wrong
 *     shape for a read that should be superseded rather than watched. `seq`
 *     stops a slow early response from overwriting a fast later one.
 *   Go to — every navigation destination the viewer is allowed to see,
 *     matched against labels, tooltips, and the keyword aliases in
 *     src/lib/admin-nav.ts, so "churn" finds Insights and "csv" finds Import.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useConvex, useQuery } from 'convex/react';
import { useAuth } from '@clerk/nextjs';
import { Command } from 'cmdk';
import { Building2, CornerDownLeft, Search, User } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import { matchesQuery, navDestinations } from '@/lib/admin-nav';
import { navIcon } from './nav-icons';

interface Hit {
  id: string;
  label: string;
  sublabel?: string;
  href: string;
  kind: 'contact' | 'company';
}

const RECORD_ICONS = { contact: User, company: Building2 };

export function AdminCommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const convex = useConvex();
  const { isLoaded } = useAuth();

  const profile = useQuery(api.admin.adminUsers.getMyAdminProfile, isLoaded ? {} : 'skip');
  const isCrmStaff = useQuery(api.crm.access.isCrmStaff, isLoaded ? {} : 'skip') ?? false;

  const [term, setTerm] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const seq = useRef(0);

  const destinations = useMemo(
    () =>
      navDestinations({
        isOwner: profile?.role === 'owner',
        isStaff: profile !== null && profile !== undefined,
      }),
    [profile],
  );

  const search = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      if (!isCrmStaff || trimmed.length < 2) {
        setHits([]);
        return;
      }
      const mine = ++seq.current;
      try {
        const [contacts, companies] = await Promise.all([
          convex.query(api.crm.contacts.quickSearchContacts, { term: trimmed, limit: 5 }),
          convex.query(api.crm.companies.quickSearchCompanies, { term: trimmed, limit: 5 }),
        ]);
        if (mine !== seq.current) return;

        setHits([
          ...contacts.map((c) => ({
            id: c._id,
            label: c.fullName,
            sublabel: [c.jobTitle, c.companyName].filter(Boolean).join(' · ') || undefined,
            href: `/admin/crm/contacts/${c._id}`,
            kind: 'contact' as const,
          })),
          ...companies.map((c) => ({
            id: c._id,
            label: c.name,
            sublabel: [c.city, c.state].filter(Boolean).join(', ') || undefined,
            href: `/admin/crm/companies/${c._id}`,
            kind: 'company' as const,
          })),
        ]);
      } catch {
        if (mine === seq.current) setHits([]);
      }
    },
    [convex, isCrmStaff],
  );

  useEffect(() => {
    const timer = setTimeout(() => void search(term), 150);
    return () => clearTimeout(timer);
  }, [term, search]);

  const go = (href: string) => {
    onOpenChange(false);
    setTerm('');
    setHits([]);
    router.push(href);
  };

  const matchedDestinations = destinations.filter((item) => matchesQuery(item, item.section, term));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
      <button
        type="button"
        aria-label="Close command palette"
        className="absolute inset-0 bg-slate-900/30"
        onClick={() => onOpenChange(false)}
      />
      <Command
        label="Admin command palette"
        className="relative w-full max-w-lg bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
        shouldFilter={false}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onOpenChange(false);
        }}
      >
        <div className="flex items-center gap-2 px-3 border-b border-slate-200">
          <Search size={14} className="text-slate-400" aria-hidden />
          <Command.Input
            autoFocus
            value={term}
            onValueChange={setTerm}
            placeholder={isCrmStaff ? 'Search contacts and companies, or jump to a page…' : 'Jump to a page…'}
            className="flex-1 py-3 text-sm outline-none placeholder:text-slate-400"
          />
          <kbd className="text-xs text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">esc</kbd>
        </div>

        <Command.List className="max-h-80 overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-sm text-slate-400">
            No matches.
          </Command.Empty>

          {hits.length > 0 && (
            <Command.Group heading="Records" className="text-xs text-slate-400 px-2 py-1">
              {hits.map((hit) => {
                const Icon = RECORD_ICONS[hit.kind];
                return (
                  <Command.Item
                    key={hit.id}
                    value={hit.id}
                    onSelect={() => go(hit.href)}
                    className="flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer text-sm text-slate-700 data-[selected=true]:bg-slate-100"
                  >
                    <Icon size={13} className="text-slate-400 flex-shrink-0" aria-hidden />
                    <span className="flex-1 truncate">{hit.label}</span>
                    {hit.sublabel && (
                      <span className="text-xs text-slate-400 truncate max-w-[45%]">{hit.sublabel}</span>
                    )}
                  </Command.Item>
                );
              })}
            </Command.Group>
          )}

          {matchedDestinations.length > 0 && (
            <Command.Group heading="Go to" className="text-xs text-slate-400 px-2 py-1">
              {matchedDestinations.map((item) => {
                const Icon = navIcon(item.icon);
                return (
                  <Command.Item
                    key={item.href}
                    value={item.href}
                    onSelect={() => go(item.href)}
                    className="flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer text-sm text-slate-700 data-[selected=true]:bg-slate-100 group"
                  >
                    <Icon size={13} className="text-slate-400 flex-shrink-0" aria-hidden />
                    <span className="flex-1 truncate">{item.label}</span>
                    <span className="text-xs text-slate-400 truncate max-w-[40%]">{item.section}</span>
                    <CornerDownLeft
                      size={11}
                      aria-hidden
                      className="text-slate-300 opacity-0 group-data-[selected=true]:opacity-100"
                    />
                  </Command.Item>
                );
              })}
            </Command.Group>
          )}
        </Command.List>
      </Command>
    </div>
  );
}
