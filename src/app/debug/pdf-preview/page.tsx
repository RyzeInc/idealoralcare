'use client';

import { useEffect, useMemo, useState } from 'react';

interface PdfSummary {
  id: string;
  label: string;
  description: string;
  category: 'member' | 'billing' | 'vendor';
  source: string;
  filename: string;
}

const CATEGORY_LABELS: Record<PdfSummary['category'], string> = {
  member: 'Member documents',
  billing: 'Billing',
  vendor: 'Vendor statements',
};

const CATEGORY_ORDER: PdfSummary['category'][] = ['member', 'billing', 'vendor'];

export default function PdfPreviewPage() {
  const [documents, setDocuments] = useState<PdfSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');

  useEffect(() => {
    fetch('/api/debug/pdf-preview')
      .then((r) => r.json())
      .then((data) => {
        setDocuments(data.documents ?? []);
        if (data.documents?.length) setSelectedId(data.documents[0].id);
      })
      .catch(() => setDocuments([]));
  }, []);

  const grouped = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({
        category,
        items: documents.filter((d) => d.category === category),
      })).filter((g) => g.items.length > 0),
    [documents],
  );

  const selected = documents.find((d) => d.id === selectedId);
  const previewUrl = selectedId ? `/api/debug/pdf-preview?doc=${selectedId}` : '';

  return (
    <div style={{ maxWidth: '1200px', margin: '40px auto', fontFamily: 'sans-serif', padding: '20px' }}>
      <h1 style={{ marginBottom: 4 }}>PDF Preview</h1>
      <p style={{ color: '#666', marginTop: 0 }}>
        Every document the system generates, rendered from sample data. Nothing here is emailed and no member records are read.
      </p>
      <p style={{ marginTop: 0, display: 'flex', gap: 16 }}>
        <a href="/debug" style={{ color: '#6b7280', fontSize: 14 }}>← All debug tools</a>
        <a href="/debug/email-test" style={{ color: '#0066CC', fontSize: 14 }}>
          Looking for emails? Open the email tester →
        </a>
      </p>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', marginTop: 24 }}>
        {/* Document list */}
        <div style={{ flex: '0 0 320px' }}>
          {grouped.map((group) => (
            <div key={group.category} style={{ marginBottom: 20 }}>
              <h3
                style={{
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  color: '#6b7280',
                  margin: '0 0 8px 0',
                }}
              >
                {CATEGORY_LABELS[group.category]}
              </h3>
              {group.items.map((doc) => {
                const isActive = doc.id === selectedId;
                return (
                  <button
                    key={doc.id}
                    onClick={() => setSelectedId(doc.id)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 12px',
                      marginBottom: 6,
                      borderRadius: 6,
                      border: `1px solid ${isActive ? '#0066CC' : '#e5e7eb'}`,
                      background: isActive ? '#eff6ff' : 'white',
                      cursor: 'pointer',
                      fontSize: 14,
                      fontWeight: isActive ? 700 : 500,
                      color: isActive ? '#0066CC' : '#111827',
                    }}
                  >
                    {doc.label}
                  </button>
                );
              })}
            </div>
          ))}
          {documents.length === 0 && <p style={{ color: '#9ca3af', fontSize: 14 }}>Loading documents…</p>}
        </div>

        {/* Preview pane */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {selected ? (
            <>
              <div
                style={{
                  background: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  padding: 16,
                  marginBottom: 12,
                }}
              >
                <h2 style={{ margin: '0 0 6px 0', fontSize: 18 }}>{selected.label}</h2>
                <p style={{ margin: '0 0 8px 0', fontSize: 14, color: '#374151' }}>{selected.description}</p>
                <p style={{ margin: '0 0 12px 0', fontSize: 12, color: '#6b7280' }}>
                  <strong>Generated in production by:</strong> {selected.source}
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <a
                    href={`${previewUrl}&download=1`}
                    style={{
                      padding: '8px 16px',
                      background: '#0066CC',
                      color: 'white',
                      borderRadius: 6,
                      textDecoration: 'none',
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    Download PDF
                  </a>
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '8px 16px',
                      background: '#e5e7eb',
                      color: '#111827',
                      borderRadius: 6,
                      textDecoration: 'none',
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    Open in new tab
                  </a>
                </div>
              </div>

              <iframe
                key={selectedId}
                src={previewUrl}
                title={selected.label}
                style={{
                  width: '100%',
                  height: '80vh',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  background: '#525659',
                }}
              />
            </>
          ) : (
            <p style={{ color: '#9ca3af' }}>Select a document to preview.</p>
          )}
        </div>
      </div>
    </div>
  );
}
