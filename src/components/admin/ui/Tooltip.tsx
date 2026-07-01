'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Side = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  text: string;
  children: React.ReactNode;
  side?: Side;
  width?: 'sm' | 'md' | 'lg';
}

// Wider (rather than narrower) boxes wrap onto fewer lines, so tooltips read
// as short-and-wide rather than tall-and-narrow.
const MAX_WIDTH: Record<NonNullable<TooltipProps['width']>, number> = {
  sm: 240,
  md: 320,
  lg: 400,
};

const MARGIN = 8;

/**
 * Renders its bubble into a portal on document.body and positions it with
 * `position: fixed` using measured coordinates. This avoids clipping from
 * any scrollable/overflow-hidden ancestor (e.g. a modal body), which was the
 * cause of tooltips getting cut off in different spots around the app.
 */
export function Tooltip({ text, children, side = 'top', width = 'md' }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);

  const measure = useCallback(() => {
    if (triggerRef.current) setAnchorRect(triggerRef.current.getBoundingClientRect());
  }, []);

  const show = useCallback(() => {
    measure();
    setOpen(true);
  }, [measure]);
  const hide = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const reposition = () => measure();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open, measure]);

  return (
    <span
      ref={triggerRef}
      className="relative inline-flex items-center"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {open && anchorRect && typeof document !== 'undefined'
        ? createPortal(
            <TooltipBubble text={text} side={side} maxWidth={MAX_WIDTH[width]} anchorRect={anchorRect} />,
            document.body
          )
        : null}
    </span>
  );
}

function TooltipBubble({
  text,
  side,
  maxWidth,
  anchorRect,
}: {
  text: string;
  side: Side;
  maxWidth: number;
  anchorRect: DOMRect;
}) {
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ position: 'fixed', top: -9999, left: -9999, maxWidth });

  useLayoutEffect(() => {
    const el = bubbleRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();

    let top: number;
    let left: number;
    if (side === 'top') {
      top = anchorRect.top - rect.height - MARGIN;
      left = anchorRect.left + anchorRect.width / 2 - rect.width / 2;
    } else if (side === 'bottom') {
      top = anchorRect.bottom + MARGIN;
      left = anchorRect.left + anchorRect.width / 2 - rect.width / 2;
    } else if (side === 'left') {
      top = anchorRect.top + anchorRect.height / 2 - rect.height / 2;
      left = anchorRect.left - rect.width - MARGIN;
    } else {
      top = anchorRect.top + anchorRect.height / 2 - rect.height / 2;
      left = anchorRect.right + MARGIN;
    }

    // Clamp within the viewport so the bubble is never cut off at an edge.
    left = Math.min(Math.max(left, MARGIN), window.innerWidth - rect.width - MARGIN);
    top = Math.min(Math.max(top, MARGIN), window.innerHeight - rect.height - MARGIN);

    setStyle({ position: 'fixed', top, left, maxWidth });
  }, [side, maxWidth, anchorRect]);

  return (
    <div
      ref={bubbleRef}
      role="tooltip"
      className="pointer-events-none z-[9999] rounded-lg bg-slate-800 px-3 py-2 text-xs leading-snug text-white shadow-xl text-left whitespace-normal"
      style={style}
    >
      {text}
    </div>
  );
}

