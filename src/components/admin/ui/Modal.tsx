'use client';

import { useEffect, useRef, ReactNode } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  /** When true, modal is rendered. */
  open: boolean;
  /** Called when user dismisses (ESC, backdrop click, or close button). */
  onClose: () => void;
  /** ARIA label/title shown in header. */
  title: string;
  /** Optional description shown beneath title. */
  description?: string;
  /** Body content. */
  children: ReactNode;
  /** Tailwind max-width class. Defaults to 'max-w-lg'. */
  size?: 'max-w-md' | 'max-w-lg' | 'max-w-xl' | 'max-w-2xl' | 'max-w-3xl' | 'max-w-4xl';
  /** Suppress backdrop click + ESC dismissal (use during in-flight async ops). */
  preventClose?: boolean;
  /** Hide the default header (caller renders its own). */
  hideHeader?: boolean;
}

/**
 * Accessible modal primitive.
 * - role="dialog", aria-modal="true", aria-labelledby
 * - ESC key closes
 * - Backdrop click closes (unless preventClose)
 * - Auto-focuses first interactive element
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = 'max-w-lg',
  preventClose = false,
  hideHeader = false,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useRef(`modal-title-${Math.random().toString(36).slice(2, 9)}`).current;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !preventClose) onClose();
    };
    document.addEventListener('keydown', onKey);
    // Auto-focus first interactive element (skip the close button)
    const focusable = dialogRef.current?.querySelector<HTMLElement>(
      'input, select, textarea, button:not([data-modal-close])'
    );
    focusable?.focus();
    // Lock body scroll
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, preventClose, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={() => { if (!preventClose) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`bg-white rounded-lg shadow-xl w-full ${size} max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        {!hideHeader && (
          <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100">
            <div>
              <h2 id={titleId} className="text-lg font-semibold text-slate-900">{title}</h2>
              {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
            </div>
            <button
              type="button"
              data-modal-close
              aria-label="Close dialog"
              onClick={onClose}
              disabled={preventClose}
              className="text-slate-400 hover:text-slate-600 disabled:opacity-40"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}
