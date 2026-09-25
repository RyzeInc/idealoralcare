'use client';

import { Loader2 } from 'lucide-react';

/**
 * Thin "Load more" footer for a Convex usePaginatedQuery list.
 *
 * The codebase has zero uses of usePaginatedQuery today — every existing
 * admin list `.collect()`s the full table and slices client-side (see
 * src/app/admin/members/page.tsx). The CRM contact list is the first surface
 * that can't get away with that (cold-list imports can run into the
 * thousands), so this exists to make server-side pagination as easy to drop
 * in as the old PAGE_SIZE-slice pattern was.
 */
export interface LoadMoreProps {
  status: 'LoadingFirstPage' | 'CanLoadMore' | 'LoadingMore' | 'Exhausted';
  loadMore: (numItems: number) => void;
  pageSize?: number;
  label?: string;
}

export function LoadMore({ status, loadMore, pageSize = 25, label = 'Load more' }: LoadMoreProps) {
  if (status === 'LoadingFirstPage' || status === 'Exhausted') return null;

  return (
    <div className="flex justify-center py-4">
      <button
        type="button"
        onClick={() => loadMore(pageSize)}
        disabled={status === 'LoadingMore'}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === 'LoadingMore' && <Loader2 size={14} className="animate-spin" />}
        {status === 'LoadingMore' ? 'Loading…' : label}
      </button>
    </div>
  );
}
