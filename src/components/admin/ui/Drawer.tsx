'use client';

import { useEffect, useId, useRef, ReactNode } from 'react';
import { X } from 'lucide-react';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Tailwind width class for the panel. Defaults to 'w-96'. */
  width?: 'w-80' | 'w-96' | 'w-[28rem]' | 'w-[32rem]';
  preventClose?: boolean;
  /** Footer content, pinned below the scrolling body (e.g. Save/Discard). */
  footer?: ReactNode;
}

/**
 * Right-side sliding panel with the same a11y contract as ui/Modal
 * (role="dialog", ESC, backdrop click, focus lock, body-scroll lock) — kept
 * as a sibling rather than a Modal wrapped in CSS overrides, since Modal's
 * centered-flex layout and this panel's fixed-to-edge layout would otherwise
 * fight each other on every future Modal change.
 *
 * First consumer: the CRM CallLogComposer, which must survive a `tel:`/dial
 * URI possibly handing the browser to another app mid-call — see
 * convex/crm/activities.ts:startCall / the isDraft field on crmActivities.
 */
export function Drawer({
  open, onClose, title, description, children, width = 'w-96', preventClose = false, footer,
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Latest-value refs read from event handlers/effects, never during render —
  // written in their own effect (no deps: runs after every render, before
  // the next commit's handlers can fire) rather than assigned inline, so a
  // ref write is never on the render path.
  const onCloseRef = useRef(onClose);
  const preventCloseRef = useRef(preventClose);
  useEffect(() => {
    onCloseRef.current = onClose;
    preventCloseRef.current = preventClose;
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !preventCloseRef.current) onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    const focusable = panelRef.current?.querySelector<HTMLElement>(
      'input, select, textarea, button:not([data-drawer-close])'
    );
    focusable?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex justify-end"
      onClick={() => { if (!preventClose) onClose(); }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`bg-white h-full ${width} max-w-full shadow-xl flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-slate-900">{title}</h2>
            {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
          </div>
          <button
            type="button"
            data-drawer-close
            aria-label="Close panel"
            onClick={onClose}
            disabled={preventClose}
            className="text-slate-400 hover:text-slate-600 disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>

        {footer && (
          <div className="px-6 py-4 border-t border-slate-100 flex-shrink-0">{footer}</div>
        )}
      </div>
    </div>
  );
}
