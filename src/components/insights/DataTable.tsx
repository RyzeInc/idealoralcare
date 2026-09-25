"use client";

import { ReactNode, useMemo, useState } from "react";
import { ChevronDown, ChevronsUpDown, ChevronUp, Download, Search } from "lucide-react";
import { downloadCsvFromObjects } from "@/lib/export-csv";

/**
 * The shared data table.
 *
 * Replaces the hand-rolled table + SortIcon + pagination + CSV blob repeated
 * across six admin pages. Sorting and paging are LOCAL to the rows handed in —
 * the roster does both server-side and passes one page at a time, because a
 * scoped portal must never ship a whole book to the browser just to slice it.
 */

export interface Column<T> {
  key: string;
  header: string;
  /** Cell renderer. */
  cell: (row: T) => ReactNode;
  /** Sort/export value. Omit to make the column unsortable. */
  value?: (row: T) => string | number | null | undefined;
  align?: "left" | "right";
  className?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: string;
  /** Enables the local search box. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Enables CSV export of the currently visible rows. */
  exportFilename?: string;
  /** Local pagination. Omit when the caller pages server-side. */
  pageSize?: number;
  /** Server-side sorting: when provided, header clicks call back instead. */
  onSort?: (key: string, dir: "asc" | "desc") => void;
  sortKey?: string;
  sortDir?: "asc" | "desc";
  onRowClick?: (row: T) => void;
  toolbar?: ReactNode;
}

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ChevronsUpDown size={12} className="text-slate-300" />;
  return dir === "asc" ? (
    <ChevronUp size={12} className="text-blue-600" />
  ) : (
    <ChevronDown size={12} className="text-blue-600" />
  );
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty = "Nothing to show.",
  searchable,
  searchPlaceholder = "Search…",
  exportFilename,
  pageSize,
  onSort,
  sortKey,
  sortDir = "asc",
  onRowClick,
  toolbar,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [localSort, setLocalSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const [page, setPage] = useState(0);

  const activeSortKey = onSort ? sortKey : localSort?.key;
  const activeSortDir = onSort ? sortDir : (localSort?.dir ?? "asc");

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return rows;
    const needle = query.trim().toLowerCase();
    return rows.filter((row) =>
      columns.some((c) => {
        const v = c.value?.(row);
        return v != null && String(v).toLowerCase().includes(needle);
      }),
    );
  }, [rows, query, searchable, columns]);

  const sorted = useMemo(() => {
    if (onSort || !localSort) return filtered;
    const col = columns.find((c) => c.key === localSort.key);
    if (!col?.value) return filtered;
    const dir = localSort.dir === "desc" ? -1 : 1;
    return [...filtered].sort((a, b) => {
      const av = col.value!(a);
      const bv = col.value!(b);
      // Missing values sort last in both directions — blank is unknown, not zero.
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return dir * (av - bv);
      return dir * String(av).localeCompare(String(bv));
    });
  }, [filtered, localSort, columns, onSort]);

  const totalPages = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const current = Math.min(page, totalPages - 1);
  const visible = pageSize ? sorted.slice(current * pageSize, (current + 1) * pageSize) : sorted;

  const handleSort = (key: string) => {
    const col = columns.find((c) => c.key === key);
    if (!col?.value && !onSort) return;
    const nextDir = activeSortKey === key && activeSortDir === "asc" ? "desc" : "asc";
    if (onSort) onSort(key, nextDir);
    else setLocalSort({ key, dir: nextDir });
    setPage(0);
  };

  return (
    <div className="space-y-3">
      {(searchable || exportFilename || toolbar) && (
        <div className="flex flex-wrap items-center gap-2">
          {searchable && (
            <div className="relative flex-1 min-w-[200px]">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
                placeholder={searchPlaceholder}
                className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          )}
          {toolbar}
          {exportFilename && (
            <button
              type="button"
              onClick={() =>
                downloadCsvFromObjects(
                  exportFilename,
                  columns
                    .filter((c) => c.value)
                    .map((c) => ({ header: c.header, value: c.value! })),
                  sorted,
                )
              }
              className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-blue-600 border border-slate-300 rounded-lg px-3 py-2 transition-colors"
            >
              <Download size={14} />
              Export
            </button>
          )}
        </div>
      )}

      <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`px-4 py-2.5 text-xs font-semibold text-slate-700 whitespace-nowrap ${
                    c.align === "right" ? "text-right" : "text-left"
                  }`}
                >
                  {c.value || onSort ? (
                    <button
                      type="button"
                      onClick={() => handleSort(c.key)}
                      className="inline-flex items-center gap-1 hover:text-blue-600"
                    >
                      {c.header}
                      <SortIcon active={activeSortKey === c.key} dir={activeSortDir} />
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-slate-400">
                  {empty}
                </td>
              </tr>
            ) : (
              visible.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={onRowClick ? "cursor-pointer hover:bg-slate-50 transition-colors" : ""}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={`px-4 py-2.5 text-sm text-slate-700 ${
                        c.align === "right" ? "text-right tabular-nums" : ""
                      } ${c.className ?? ""}`}
                    >
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pageSize && sorted.length > pageSize && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">
            Showing {current * pageSize + 1}–{Math.min((current + 1) * pageSize, sorted.length)} of{" "}
            {sorted.length.toLocaleString()}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={current === 0}
              className="px-3 py-1.5 border border-slate-300 rounded-md disabled:opacity-40 hover:bg-slate-50 transition-colors"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={current >= totalPages - 1}
              className="px-3 py-1.5 border border-slate-300 rounded-md disabled:opacity-40 hover:bg-slate-50 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
