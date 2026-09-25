'use client';

/**
 * Local Card/Field/SectionHeader trio for the CRM detail pages — copied
 * rather than sharing members/[id]/page.tsx's versions (see the CRM plan's
 * "extract vs copy" note): coupling the CRM layout to the member inspector's
 * would fight both the first time either needs to change independently.
 */

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`bg-white border border-slate-200 rounded-xl p-5 ${className}`}>{children}</div>;
}

export function SectionHeader({ icon: Icon, title, badge }: { icon: LucideIcon; title: string; badge?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Icon size={14} className="text-slate-400" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      </div>
      {badge}
    </div>
  );
}

export function Field({ label, value, mono = false }: { label: string; value?: ReactNode; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`text-sm text-slate-800 ${mono ? 'font-mono' : ''}`}>{value ?? <span className="text-slate-300">—</span>}</p>
    </div>
  );
}
