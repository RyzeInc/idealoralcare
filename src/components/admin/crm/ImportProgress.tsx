'use client';

import type { Doc } from '@/convex/_generated/dataModel';

export function ImportProgress({ batch }: { batch: Doc<'crmImportBatches'> }) {
  const pct = batch.totalRows > 0 ? Math.round((batch.processedRows / batch.totalRows) * 100) : 0;

  return (
    <div className="space-y-3">
      <div>
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>{batch.processedRows.toLocaleString()} / {batch.totalRows.toLocaleString()} rows</span>
          <span>{pct}%</span>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 text-center">
        <div>
          <p className="text-lg font-semibold text-slate-900">{batch.createdCount}</p>
          <p className="text-xs text-slate-400">Created</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-slate-900">{batch.updatedCount}</p>
          <p className="text-xs text-slate-400">Updated</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-slate-900">{batch.skippedCount}</p>
          <p className="text-xs text-slate-400">Skipped</p>
        </div>
        <div>
          <p className={`text-lg font-semibold ${batch.errorCount > 0 ? 'text-red-600' : 'text-slate-900'}`}>{batch.errorCount}</p>
          <p className="text-xs text-slate-400">Errors</p>
        </div>
      </div>

      {batch.errors && batch.errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-40 overflow-y-auto">
          {batch.errors.map((e, i) => (
            <p key={i} className="text-xs text-red-700">Row {e.row + 1}: {e.message}</p>
          ))}
        </div>
      )}
    </div>
  );
}
