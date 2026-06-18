'use client';

interface TooltipProps {
  text: string;
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  width?: 'sm' | 'md' | 'lg';
}

const WIDTH: Record<NonNullable<TooltipProps['width']>, string> = {
  sm: 'max-w-[160px]',
  md: 'max-w-[220px]',
  lg: 'max-w-[300px]',
};

export function Tooltip({ text, children, side = 'top', width = 'md' }: TooltipProps) {
  const pos =
    side === 'top'    ? 'bottom-full left-1/2 -translate-x-1/2 mb-2' :
    side === 'bottom' ? 'top-full left-1/2 -translate-x-1/2 mt-2' :
    side === 'left'   ? 'right-full top-1/2 -translate-y-1/2 mr-2' :
                        'left-full top-1/2 -translate-y-1/2 ml-2';

  const arrow =
    side === 'top'    ? 'top-full left-1/2 -translate-x-1/2 border-t-slate-800' :
    side === 'bottom' ? 'bottom-full left-1/2 -translate-x-1/2 border-b-slate-800' :
    side === 'left'   ? 'left-full top-1/2 -translate-y-1/2 border-l-slate-800' :
                        'right-full top-1/2 -translate-y-1/2 border-r-slate-800';

  return (
    <span className="group/tip relative inline-flex items-center">
      {children}
      <span
        className={`pointer-events-none absolute ${pos} ${WIDTH[width]} rounded-lg bg-slate-800 px-2.5 py-2 text-xs leading-snug text-white opacity-0 shadow-xl transition-opacity duration-150 group-hover/tip:opacity-100 z-[60] text-left whitespace-normal`}
      >
        {text}
        <span className={`absolute border-4 border-transparent ${arrow}`} />
      </span>
    </span>
  );
}
