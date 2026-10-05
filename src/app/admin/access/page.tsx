'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { SkeletonCard } from '@/components/admin/ui';
import { AccessAdmin } from '@/components/admin/access/AccessAdmin';

export default function AccessPage() {
  const profile = useQuery(api.admin.adminUsers.getMyAdminProfile);
  if (profile === undefined) return <SkeletonCard />;
  if (!profile?.permissions.includes('access.manage')) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Managing access needs the &quot;Manage access&quot; permission. Ask an owner if you need it.
      </div>
    );
  }
  return <AccessAdmin />;
}
