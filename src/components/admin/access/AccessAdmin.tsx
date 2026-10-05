'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Breadcrumbs } from '@/components/admin/ui';
import { PeopleTab } from './PeopleTab';
import { PacksTab } from './PacksTab';
import { PreviewTab } from './PreviewTab';
import { ImportTab } from './ImportTab';

const TABS = [
  { id: 'people', label: 'People' },
  { id: 'packs', label: 'Access packs' },
  { id: 'preview', label: 'Preview & demo' },
  { id: 'import', label: 'Import existing' },
] as const;
type Tab = (typeof TABS)[number]['id'];

/**
 * Access & Roles: who can sign in, which roles they hold, and what each role's
 * access packs let them do. Requires the "Manage access" permission; every
 * function behind it checks that and the anti-escalation rules itself.
 */
export function AccessAdmin() {
  const [tab, setTab] = useState<Tab>('people');
  const ensureBuiltIns = useMutation(api.access.packs.ensureBuiltIns);
  const packs = useQuery(api.access.packs.listPacks);
  const targets = useQuery(api.access.people.linkTargets);

  useEffect(() => {
    void ensureBuiltIns({}).catch(() => {});
  }, [ensureBuiltIns]);

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Access & Roles' }]} />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Access &amp; Roles</h1>
          <p className="mt-1 text-slate-500">
            Invite staff, partners, brokers, reps, carriers and organization contacts; give each person one or more roles; and decide what each role can do with access packs.
          </p>
        </div>
        <Link href="/admin/users" className="text-xs text-slate-500 hover:text-slate-700 hover:underline">
          Legacy staff list
        </Link>
      </div>
      <div className="mb-5 flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === t.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'people' && <PeopleTab packs={packs} targets={targets} />}
      {tab === 'packs' && <PacksTab packs={packs} />}
      {tab === 'preview' && <PreviewTab packs={packs} />}
      {tab === 'import' && <ImportTab />}
    </div>
  );
}
