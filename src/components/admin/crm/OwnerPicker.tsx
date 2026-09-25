'use client';

import { Combobox } from '@/components/admin/ui';

interface ClerkUser { id: string; email: string; name: string }

/** Reuses /api/clerk/users (the same source UserSelector.tsx uses) — staff owners are Clerk users, not a CRM table. */
export function OwnerPicker({ value, valueName, onSelect }: {
  value: string | null;
  valueName?: string;
  onSelect: (user: ClerkUser | null) => void;
}) {
  const selected: ClerkUser | null = value ? { id: value, email: '', name: valueName ?? value } : null;

  return (
    <Combobox<ClerkUser>
      value={selected}
      onSelect={onSelect}
      loadItems={async (term) => {
        const url = new URL('/api/clerk/users', window.location.origin);
        if (term) url.searchParams.set('search', term);
        url.searchParams.set('limit', '20');
        const res = await fetch(url.toString());
        if (!res.ok) throw new Error('Failed to load users');
        const data = await res.json();
        return data.users as ClerkUser[];
      }}
      getKey={(u) => u.id}
      getLabel={(u) => u.name || u.email}
      getSecondaryLabel={(u) => (u.name ? u.email : undefined)}
      placeholder="Assign owner…"
    />
  );
}
