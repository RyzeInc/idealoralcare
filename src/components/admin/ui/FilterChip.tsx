'use client';

/**
 * Pill-shaped filter toggle with a live count badge.
 *
 * Lifted verbatim from src/app/admin/user-audit/page.tsx (the richest
 * filtering surface in admin) so a row of these can replace a native
 * <select> anywhere a filter set is small and enumerable — the CRM contact
 * list filter rail is the first consumer beyond user-audit.
 */
export function FilterChip({ label, count, active, tone, onClick }: {
  label: string;
  count: number;
  active: boolean;
  /** Tailwind text/bg/border classes, e.g. "text-blue-700 bg-blue-50 border-blue-200". */
  tone: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-all ${
        active ? `${tone} ring-2 ring-offset-1 ring-blue-300` : `${tone} hover:brightness-95`
      }`}
    >
      {label}
      <span className="font-bold">{count}</span>
    </button>
  );
}
