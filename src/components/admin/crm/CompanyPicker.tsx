'use client';

import { useConvex } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Combobox } from '@/components/admin/ui';
import type { Doc } from '@/convex/_generated/dataModel';

export function CompanyPicker({ value, onSelect }: {
  value: Doc<'crmCompanies'> | null;
  onSelect: (company: Doc<'crmCompanies'> | null) => void;
}) {
  const convex = useConvex();
  return (
    <Combobox<Doc<'crmCompanies'>>
      value={value}
      onSelect={onSelect}
      loadItems={(term) => convex.query(api.crm.companies.quickSearchCompanies, { term })}
      getKey={(c) => c._id}
      getLabel={(c) => c.name}
      getSecondaryLabel={(c) => [c.city, c.state].filter(Boolean).join(', ') || undefined}
      minChars={2}
      placeholder="Search companies…"
    />
  );
}
