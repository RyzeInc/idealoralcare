'use client';

import { X } from 'lucide-react';
import { tagColorClass } from './constants';

export function TagChip({ name, color, onRemove }: { name: string; color?: string; onRemove?: () => void }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${tagColorClass(color)}`}>
      {name}
      {onRemove && (
        <button type="button" onClick={onRemove} className="hover:opacity-70" aria-label={`Remove ${name} tag`}>
          <X size={10} />
        </button>
      )}
    </span>
  );
}
