'use client';

import { useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { FIELD_LABELS, suggestField, type ContactField } from '@/lib/crm/csvAliases';

export type MapTarget =
  | { kind: 'field'; field: ContactField }
  | { kind: 'tag'; categoryId: Id<'crmTagCategories'> }
  | { kind: 'ignore' };

export type ColumnMapping = Record<string, MapTarget>;

interface CsvMapperProps {
  headers: string[];
  previewRows: Record<string, string>[];
  mapping: ColumnMapping;
  onChange: (mapping: ColumnMapping) => void;
}

export function CsvMapper({ headers, previewRows, mapping, onChange }: CsvMapperProps) {
  const categories = useQuery(api.crm.tags.listTagTree, {});

  // Auto-suggest once, on first render with these headers.
  useEffect(() => {
    const initial: ColumnMapping = {};
    let changed = false;
    for (const header of headers) {
      if (mapping[header]) continue;
      const suggested = suggestField(header);
      initial[header] = suggested ? { kind: 'field', field: suggested } : { kind: 'ignore' };
      changed = true;
    }
    if (changed) onChange({ ...mapping, ...initial });
    // Only re-run when the header set itself changes (a new file).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers.join('|')]);

  const setTarget = (header: string, target: MapTarget) => onChange({ ...mapping, [header]: target });

  return (
    <div className="overflow-x-auto border border-slate-200 rounded-xl">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Column</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Maps to</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Preview</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {headers.map((header) => {
            const target = mapping[header] ?? { kind: 'ignore' as const };
            const selectValue = target.kind === 'field' ? `field:${target.field}` : target.kind === 'tag' ? `tag:${target.categoryId}` : 'ignore';
            return (
              <tr key={header}>
                <td className="px-3 py-2 font-medium text-slate-800">{header}</td>
                <td className="px-3 py-2">
                  <select
                    value={selectValue}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === 'ignore') setTarget(header, { kind: 'ignore' });
                      else if (v.startsWith('field:')) setTarget(header, { kind: 'field', field: v.slice(6) as ContactField });
                      else if (v.startsWith('tag:')) setTarget(header, { kind: 'tag', categoryId: v.slice(4) as Id<'crmTagCategories'> });
                    }}
                    className="text-sm border border-slate-300 rounded-lg px-2 py-1"
                  >
                    <option value="ignore">— Ignore —</option>
                    <optgroup label="Contact field">
                      {(Object.keys(FIELD_LABELS) as ContactField[]).map((f) => (
                        <option key={f} value={`field:${f}`}>{FIELD_LABELS[f]}</option>
                      ))}
                    </optgroup>
                    {categories && categories.length > 0 && (
                      <optgroup label="Turn into tags">
                        {categories.map(({ category }) => (
                          <option key={category._id} value={`tag:${category._id}`}>Tag: {category.name}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </td>
                <td className="px-3 py-2 text-slate-500 text-xs">
                  {previewRows.slice(0, 3).map((r) => r[header]).filter(Boolean).join(', ') || '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
