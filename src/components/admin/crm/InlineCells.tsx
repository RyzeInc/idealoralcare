'use client';

/**
 * Editable cells for the contact list.
 *
 * The list is a navigation surface — clicking a row opens the contact — so
 * every control in here stops click propagation. Without that, changing a
 * dropdown would also navigate away from the list you were triaging, which is
 * the exact round-trip this whole feature exists to remove.
 *
 * Native <select> rather than a styled popover on purpose: it is keyboard- and
 * screen-reader-correct for free, it does not need a portal to escape the
 * table's overflow container, and on a touch device it gets the platform
 * picker.
 */

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useToast } from '@/components/admin/ui';

const TONE_CLASSES: Record<string, string> = {
  success: 'bg-green-100 text-green-800 border-green-200',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  danger: 'bg-red-100 text-red-800 border-red-200',
  info: 'bg-blue-100 text-blue-800 border-blue-200',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  pending: 'bg-purple-100 text-purple-800 border-purple-200',
};

export interface InlineSelectOption {
  value: string;
  label: string;
}

export function InlineSelect({
  value, options, onChange, tone = 'neutral', emptyLabel, ariaLabel, title,
}: {
  value: string | undefined;
  options: readonly InlineSelectOption[];
  onChange: (next: string) => Promise<unknown>;
  tone?: string;
  /** Provide to allow clearing the field; omit to force a choice. */
  emptyLabel?: string;
  ariaLabel: string;
  title?: string;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const handleChange = async (next: string) => {
    setSaving(true);
    try {
      await onChange(next);
    } catch (err) {
      toast.fromError(err, 'Could not save that change');
    } finally {
      setSaving(false);
    }
  };

  return (
    <select
      aria-label={ariaLabel}
      title={title}
      value={value ?? ''}
      disabled={saving}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        e.stopPropagation();
        void handleChange(e.target.value);
      }}
      className={`max-w-[11rem] truncate rounded-full border px-2 py-0.5 text-[11px] font-medium outline-none cursor-pointer hover:brightness-95 focus:ring-2 focus:ring-blue-300 disabled:opacity-50 ${
        TONE_CLASSES[tone] ?? TONE_CLASSES.neutral
      }`}
    >
      {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/**
 * Copy-to-clipboard, for getting an address out of the list without opening
 * the contact. `navigator.clipboard` is undefined on insecure origins, so the
 * optional call matches the existing CopyableField on the detail page.
 */
export function CopyButton({
  value, label, size = 12, className = '',
}: {
  value: string;
  label: string;
  size?: number;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className={`text-slate-300 hover:text-slate-600 ${className}`}
    >
      {copied ? <Check size={size} className="text-green-600" /> : <Copy size={size} />}
    </button>
  );
}
