'use client';

import { useState } from 'react';
import Link from 'next/link';
import Papa from 'papaparse';
import { useMutation, useQuery } from 'convex/react';
import { Upload } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Breadcrumbs, useToast } from '@/components/admin/ui';
import { CsvMapper, type ColumnMapping } from '@/components/admin/crm/CsvMapper';
import { ImportProgress } from '@/components/admin/crm/ImportProgress';
import { TagChip } from '@/components/admin/crm/TagChip';

type Step = 'upload' | 'mapping' | 'importing' | 'done';
const CHUNK_SIZE = 200;

export default function ImportPage() {
  const toast = useToast();
  const tree = useQuery(api.crm.tags.listTagTree, {});
  const createBatch = useMutation(api.crm.imports.createBatch);
  const commitChunk = useMutation(api.crm.imports.commitChunk);
  const finalizeBatch = useMutation(api.crm.imports.finalizeBatch);

  const [step, setStep] = useState<Step>('upload');
  const [filename, setFilename] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [dedupeStrategy, setDedupeStrategy] = useState<'fill_blanks_only' | 'skip_existing' | 'update_existing' | 'create_duplicates'>('fill_blanks_only');
  const [defaultTagIds, setDefaultTagIds] = useState<Set<Id<'crmTags'>>>(new Set());
  const [batchId, setBatchId] = useState<Id<'crmImportBatches'> | null>(null);

  const batch = useQuery(api.crm.imports.getBatch, batchId ? { batchId } : 'skip');

  const handleFile = (file: File) => {
    setFilename(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (results) => {
        setHeaders(results.meta.fields ?? []);
        setRows(results.data);
        setStep('mapping');
      },
      error: (err) => toast.error('Could not parse CSV', err.message),
    });
  };

  const buildRow = (raw: Record<string, string>) => {
    const row: Record<string, string | undefined> & { extraTagValues?: { categoryId: Id<'crmTagCategories'>; value: string }[] } = {};
    const extraTagValues: { categoryId: Id<'crmTagCategories'>; value: string }[] = [];
    for (const [header, target] of Object.entries(mapping)) {
      const value = raw[header]?.trim();
      if (!value) continue;
      if (target.kind === 'field') row[target.field] = value;
      else if (target.kind === 'tag') extraTagValues.push({ categoryId: target.categoryId, value });
    }
    if (extraTagValues.length > 0) row.extraTagValues = extraTagValues;
    return row;
  };

  const handleImport = async () => {
    setStep('importing');
    try {
      const id = await createBatch({
        filename,
        entity: 'contact',
        columnMapping: mapping,
        defaultTagIds: Array.from(defaultTagIds),
        dedupeStrategy,
        totalRows: rows.length,
      });
      setBatchId(id);

      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE).map(buildRow);
        await commitChunk({ batchId: id, rows: chunk as Parameters<typeof commitChunk>[0]['rows'] });
      }
      await finalizeBatch({ batchId: id });
      setStep('done');
    } catch (err) {
      toast.fromError(err, 'Import failed');
      setStep('mapping');
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'CRM', href: '/admin/crm' }, { label: 'Import' }]} />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Import Contacts</h1>
        <p className="text-sm text-slate-500 mt-0.5">Upload a CSV, map the columns, and we&apos;ll dedupe against existing contacts automatically.</p>
      </div>

      {step === 'upload' && (
        <label className="block bg-white border-2 border-dashed border-slate-300 rounded-xl p-12 text-center cursor-pointer hover:border-blue-400">
          <Upload size={28} className="mx-auto text-slate-400 mb-3" />
          <p className="text-sm text-slate-600">Click to choose a CSV file</p>
          <input type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </label>
      )}

      {step === 'mapping' && (
        <div className="space-y-5">
          <p className="text-sm text-slate-500">{rows.length.toLocaleString()} rows found in <span className="font-medium text-slate-700">{filename}</span></p>
          <CsvMapper headers={headers} previewRows={rows.slice(0, 5)} mapping={mapping} onChange={setMapping} />

          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Duplicate handling</p>
              <select value={dedupeStrategy} onChange={(e) => setDedupeStrategy(e.target.value as typeof dedupeStrategy)} className="text-sm border border-slate-300 rounded-lg px-2 py-1.5">
                <option value="fill_blanks_only">Fill blanks only (recommended — never overwrites confirmed data)</option>
                <option value="skip_existing">Skip existing contacts (still applies default tags)</option>
                <option value="update_existing">Overwrite with incoming values</option>
                <option value="create_duplicates">Always create new (no dedupe)</option>
              </select>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Apply these tags to every imported contact</p>
              <div className="flex flex-wrap gap-1.5">
                {(tree ?? []).flatMap((g) => g.tags).map((tag) => {
                  const active = defaultTagIds.has(tag._id);
                  return (
                    <button
                      key={tag._id}
                      type="button"
                      onClick={() => setDefaultTagIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(tag._id)) next.delete(tag._id); else next.add(tag._id);
                        return next;
                      })}
                      className={active ? 'opacity-100' : 'opacity-40 hover:opacity-70'}
                    >
                      <TagChip name={tag.name} color={tag.color} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setStep('upload')} className="px-3 py-2 text-sm text-slate-600 hover:text-slate-900">Start over</button>
            <button type="button" onClick={handleImport} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              Import {rows.length.toLocaleString()} rows
            </button>
          </div>
        </div>
      )}

      {(step === 'importing' || step === 'done') && batch && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <p className="text-sm font-medium text-slate-800">
            {step === 'importing' ? 'Importing…' : 'Import complete'}
          </p>
          <ImportProgress batch={batch} />
          {step === 'done' && (
            <div className="flex justify-end">
              <Link href="/admin/crm/contacts" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                View contacts
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
