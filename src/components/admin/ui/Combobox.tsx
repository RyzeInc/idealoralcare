'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search, Loader2, X } from 'lucide-react';

/**
 * Async searchable dropdown, generalized from src/components/admin/UserSelector.tsx
 * (previously the only combobox in the codebase, hardwired to the Clerk users
 * API). This version takes `loadItems` instead, so it can back the CRM's
 * CompanyPicker, OwnerPicker, TagPicker, and contact quick-search without
 * each hand-rolling its own debounce/click-outside/keyboard-nav logic.
 *
 * Kept as plain Tailwind (not the CSS-module styling UserSelector used) to
 * match every other admin component written since — see AdminSidebar.tsx and
 * the members/[id] detail page for the convention this follows.
 */
export interface ComboboxProps<T> {
  value?: T | null;
  onSelect: (item: T | null) => void;
  loadItems: (query: string) => Promise<T[]>;
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  getSecondaryLabel?: (item: T) => string | undefined;
  label?: string;
  placeholder?: string;
  /** Milliseconds to wait after the last keystroke before calling loadItems. */
  debounceMs?: number;
  /** Minimum characters before loadItems is called. 0 loads on open. */
  minChars?: number;
  allowClear?: boolean;
  disabled?: boolean;
}

export function Combobox<T>({
  value, onSelect, loadItems, getKey, getLabel, getSecondaryLabel,
  label, placeholder = 'Search…', debounceMs = 300, minChars = 0, allowClear = true, disabled = false,
}: ComboboxProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);

  // Below minChars we simply don't fetch — `visibleItems` (render-time) hides
  // whatever `items` last held rather than us clearing it here, so this stays
  // a subscribe-to-external-system effect instead of a setState-in-effect.
  useEffect(() => {
    if (!isOpen) return;
    if (query.length < minChars) return;
    const requestId = ++requestIdRef.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const results = await loadItems(query);
        // Ignore stale responses from a superseded keystroke.
        if (requestId === requestIdRef.current) {
          setItems(results);
          setActiveIndex(-1);
        }
      } catch (err) {
        if (requestId === requestIdRef.current) {
          setError(err instanceof Error ? err.message : 'Search failed');
          setItems([]);
        }
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [isOpen, query, minChars, debounceMs, loadItems]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = (item: T) => {
    setQuery('');
    setIsOpen(false);
    onSelect(item);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < items.length) handleSelect(items[activeIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      {label && <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>}

      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="min-w-0 flex-1 text-left truncate">
          {value ? (
            <span className="text-slate-900">{getLabel(value)}</span>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </span>
        <span className="flex items-center gap-1 flex-shrink-0">
          {allowClear && value && (
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => { e.stopPropagation(); onSelect(null); }}
              className="text-slate-300 hover:text-slate-500"
            >
              <X size={14} />
            </span>
          )}
          <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-40 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
          <div className="relative border-b border-slate-100">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="w-full pl-8 pr-3 py-2 text-sm outline-none"
            />
          </div>

          <div className="max-h-60 overflow-y-auto">
            {(() => {
              // Hide stale results left over from before the query dropped
              // below minChars, without needing to clear state in the effect.
              const visibleItems = query.length < minChars ? [] : items;
              return (
                <>
                  {loading && (
                    <div className="flex items-center gap-2 px-3 py-3 text-xs text-slate-400">
                      <Loader2 size={14} className="animate-spin" /> Searching…
                    </div>
                  )}
                  {!loading && error && (
                    <div className="px-3 py-3 text-xs text-red-500">{error}</div>
                  )}
                  {!loading && !error && visibleItems.length === 0 && (
                    <div className="px-3 py-3 text-xs text-slate-400">
                      {query.length < minChars
                        ? `Type ${minChars - query.length} more character${minChars - query.length === 1 ? '' : 's'}…`
                        : 'No results'}
                    </div>
                  )}
                  {!loading && visibleItems.map((item, idx) => {
                    const key = getKey(item);
                    const secondary = getSecondaryLabel?.(item);
                    const isSelected = value ? getKey(value) === key : false;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleSelect(item)}
                        onMouseEnter={() => setActiveIndex(idx)}
                        className={`w-full text-left px-3 py-2 text-sm flex flex-col ${
                          idx === activeIndex || isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-slate-900 truncate">{getLabel(item)}</span>
                        {secondary && <span className="text-xs text-slate-500 truncate">{secondary}</span>}
                      </button>
                    );
                  })}
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
