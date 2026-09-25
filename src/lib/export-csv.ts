/**
 * CSV export.
 *
 * Extracted from six near-identical hand-rolled copies across /admin
 * (members, billing, invoice-calculator, vendor-statements, ...). Each had
 * subtly different escaping; this is the one that handles the cases that
 * actually bite: embedded quotes, commas, newlines, and leading characters
 * Excel would otherwise interpret as a formula.
 */

/** Values Excel/Sheets would evaluate as a formula if left unquoted. */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  const raw = value instanceof Date ? value.toISOString() : String(value);
  // Prefix-guard against CSV injection: a cell starting with = or + is executed
  // on open in most spreadsheet apps, which is a real vector when the content
  // came from a member-supplied name field.
  const safe = FORMULA_PREFIX.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((r) => r.map(escapeCell).join(",")).join("\r\n");
}

/** Build a CSV and hand it to the browser as a download. */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: unknown[][],
): void {
  const csv = toCsv(headers, rows);
  // BOM so Excel opens UTF-8 names (accents, ñ) correctly rather than as mojibake.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Convenience: derive rows from objects using an explicit column spec. */
export function downloadCsvFromObjects<T>(
  filename: string,
  columns: Array<{ header: string; value: (row: T) => unknown }>,
  rows: T[],
): void {
  downloadCsv(
    filename,
    columns.map((c) => c.header),
    rows.map((row) => columns.map((c) => c.value(row))),
  );
}
