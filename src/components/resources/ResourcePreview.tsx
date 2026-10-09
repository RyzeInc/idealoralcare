'use client';

import { Download, ExternalLink, FileText, Loader2 } from 'lucide-react';
import { Modal } from '@/components/admin/ui';

/**
 * In-page preview for a partner resource: shows what a file looks like before
 * anyone downloads it. Used by the broker library and by staff on the admin
 * resources page, so both see the same thing.
 */

export type PreviewKind = 'image' | 'pdf' | 'video' | 'audio' | 'none';

export function previewKindFor(contentType?: string, fileName?: string, kind?: 'file' | 'link'): PreviewKind {
  if (kind === 'link') return 'none';
  const type = (contentType ?? '').toLowerCase();
  const name = (fileName ?? '').toLowerCase();
  if (type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/.test(name)) return 'image';
  if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (type.startsWith('video/') || /\.(mp4|webm|mov)$/.test(name)) return 'video';
  if (type.startsWith('audio/') || /\.(mp3|m4a|wav)$/.test(name)) return 'audio';
  return 'none';
}

export interface PreviewTarget {
  title: string;
  description?: string;
  kind: 'file' | 'link';
  fileName?: string;
  contentType?: string;
}

export function ResourcePreviewModal({
  target, url, loading, error, onClose, onDownload, downloading,
}: {
  target: PreviewTarget | null;
  url: string | null;
  loading: boolean;
  error?: string | null;
  onClose: () => void;
  onDownload: () => void;
  downloading?: boolean;
}) {
  if (!target) return null;
  const previewKind = previewKindFor(target.contentType, target.fileName, target.kind);
  const isLink = target.kind === 'link';

  return (
    <Modal open onClose={onClose} title={target.title} description={target.description} size="max-w-4xl">
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center min-h-[240px]">
          {loading ? (
            <Loader2 size={22} className="text-slate-400 animate-spin" />
          ) : error ? (
            <p className="text-sm text-red-600 p-6 text-center">{error}</p>
          ) : !url ? (
            <p className="text-sm text-slate-500 p-6 text-center">This resource is no longer available.</p>
          ) : previewKind === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={target.title} className="max-h-[70vh] w-auto max-w-full object-contain" />
          ) : previewKind === 'pdf' ? (
            <iframe src={`${url}#view=FitH`} title={target.title} className="w-full h-[70vh] bg-white" />
          ) : previewKind === 'video' ? (
            <video src={url} controls playsInline className="max-h-[70vh] w-full bg-black" />
          ) : previewKind === 'audio' ? (
            <audio src={url} controls className="w-full m-6" />
          ) : (
            <div className="flex flex-col items-center gap-2 p-8 text-center">
              {isLink ? <ExternalLink size={28} className="text-slate-400" /> : <FileText size={28} className="text-slate-400" />}
              <p className="text-sm text-slate-600">
                {isLink
                  ? 'This resource is a link to another site.'
                  : `${target.fileName ?? 'This file'} can't be shown in the browser. Download it to open it.`}
              </p>
              {isLink && <p className="text-xs text-slate-400 break-all max-w-md">{url}</p>}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600 rounded-lg hover:bg-slate-100">
            Close
          </button>
          <button
            type="button"
            onClick={onDownload}
            disabled={downloading || loading || !url}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
          >
            {downloading ? <Loader2 size={14} className="animate-spin" /> : isLink ? <ExternalLink size={14} /> : <Download size={14} />}
            {isLink ? 'Open link' : 'Download'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
