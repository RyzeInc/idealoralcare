'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, SlidersHorizontal } from 'lucide-react';
import { Modal } from './Modal';

/**
 * Generic sortable, column-configurable table.
 *
 * Generalized from the DisplayColumn registry pattern in
 * src/app/admin/user-audit/page.tsx (that page is 2,109 lines and is the tool
 * people use to fix broken identities — it is deliberately NOT retrofitted
 * onto this component yet; the CRM contact/company lists are the first real
 * consumers). Each column owns its own sort key and cell renderer, so adding
 * a column never touches table plumbing.
 */
export interface DataTableColumn<T> {
  key: string;
  label: string;
  /** Shown by default when the column picker is enabled. Defaults to true. */
  defaultOn?: boolean;
  /** Always shown; cannot be hidden via the column picker. */
  fixed?: boolean;
  align?: 'left' | 'center';
  /** Omit to make the column unsortable. */
  sortValue?: (row: T) => string | number;
  render: (row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  /**
   * Enables the column-visibility picker and persists the selection under
   * this localStorage key. Omit to always show every column with no picker.
   */
  storageKey?: string;
  defaultSortKey?: string;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

function SortableTh<T>({
  column, activeKey, dir, onSort,
}: {
  column: DataTableColumn<T>;
  activeKey: string;
  dir: 'asc' | 'desc';
  onSort: (key: string) => void;
}) {
  const alignClass = column.align === 'center' ? 'text-center' : '';
  if (!column.sortValue) {
    return (
      <th className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase ${alignClass}`}>
        {column.label}
      </th>
    );
  }
  const isActive = activeKey === column.key;
  return (
    <th className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase ${alignClass}`}>
      <button
        type="button"
        onClick={() => onSort(column.key)}
        className={`inline-flex items-center gap-1 hover:text-slate-800 transition-colors ${isActive ? 'text-slate-800' : ''}`}
      >
        {column.label}
        {isActive ? (
          dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
        ) : (
          <ChevronsUpDown size={12} className="text-slate-300" />
        )}
      </button>
    </th>
  );
}

export function DataTable<T>({
  columns, rows, getRowKey, storageKey, defaultSortKey, emptyMessage = 'No results.', onRowClick,
}: DataTableProps<T>) {
  const defaultVisible = useMemo(
    () => columns.filter((c) => c.fixed || c.defaultOn !== false).map((c) => c.key),
    [columns]
  );

  const [sortKey, setSortKey] = useState<string>(defaultSortKey ?? columns[0]?.key ?? '');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  // Lazy-initialized from localStorage (read once, on mount) rather than
  // loaded via a follow-up effect — this is a synchronous read of a
  // synchronous source, so there's no external subscription to model as an
  // effect, just an initial value.
  const [visibleCols, setVisibleCols] = useState<string[]>(() => {
    if (!storageKey) return defaultVisible;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr) && arr.every((x) => typeof x === 'string')) {
          return arr;
        }
      }
    } catch { /* ignore */ }
    return defaultVisible;
  });
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(visibleCols));
    } catch { /* ignore */ }
  }, [storageKey, visibleCols]);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const toggleColumn = (key: string) =>
    setVisibleCols((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const enabledColumns = useMemo(
    () => (storageKey ? columns.filter((c) => c.fixed || visibleCols.includes(c.key)) : columns),
    [columns, storageKey, visibleCols]
  );

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return rows;
    const valueFor = col.sortValue;
    return [...rows].sort((a, b) => {
      const av = valueFor(a);
      const bv = valueFor(b);
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av) < String(bv) ? -1 * dir : String(av) > String(bv) ? 1 * dir : 0;
    });
  }, [rows, columns, sortKey, sortDir]);

  return (
    <div className="space-y-2">
      {storageKey && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowColumnPicker(true)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50"
          >
            <SlidersHorizontal size={12} /> Columns
          </button>
        </div>
      )}

      <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {enabledColumns.map((col) => (
                <SortableTh key={col.key} column={col} activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.length === 0 && (
              <tr>
                <td colSpan={enabledColumns.length} className="px-4 py-8 text-center text-sm text-slate-400">
                  {emptyMessage}
                </td>
              </tr>
            )}
            {sorted.map((row) => (
              <tr
                key={getRowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={onRowClick ? 'cursor-pointer hover:bg-slate-50' : ''}
              >
                {enabledColumns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 text-sm ${col.align === 'center' ? 'text-center' : ''}`}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {storageKey && (
        <Modal
          open={showColumnPicker}
          onClose={() => setShowColumnPicker(false)}
          title="Table Columns"
          description="Choose which data points appear as columns. Your selection is saved on this device."
          size="max-w-lg"
        >
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-500 self-center">Presets:</span>
              <button
                type="button"
                onClick={() => setVisibleCols(defaultVisible)}
                className="px-3 py-1 text-xs rounded border border-slate-300 hover:bg-slate-50"
              >
                Default
              </button>
              <button
                type="button"
                onClick={() => setVisibleCols(columns.map((c) => c.key))}
                className="px-3 py-1 text-xs rounded border border-slate-300 hover:bg-slate-50"
              >
                Show all
              </button>
              <button
                type="button"
                onClick={() => setVisibleCols(columns.filter((c) => c.fixed).map((c) => c.key))}
                className="px-3 py-1 text-xs rounded border border-slate-300 hover:bg-slate-50"
              >
                Minimal
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1 max-h-72 overflow-y-auto pr-1">
              {columns.map((col) => (
                <label
                  key={col.key}
                  className={`flex items-center gap-2 text-sm rounded px-2 py-1.5 ${
                    col.fixed ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={col.fixed || visibleCols.includes(col.key)}
                    disabled={col.fixed}
                    onChange={() => toggleColumn(col.key)}
                    className="rounded border-slate-300"
                  />
                  <span className="text-slate-700">
                    {col.label}
                    {col.fixed && <span className="text-xs text-slate-400"> (always)</span>}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="text-xs text-slate-400">
                {enabledColumns.length} column{enabledColumns.length !== 1 ? 's' : ''} shown
              </span>
              <button
                type="button"
                onClick={() => setShowColumnPicker(false)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
