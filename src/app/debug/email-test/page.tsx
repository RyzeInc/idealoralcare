'use client';

import { useEffect, useMemo, useState } from 'react';

interface TemplateSummary {
  id: string;
  label: string;
  description: string;
  category: 'member' | 'employer' | 'admin' | 'diagnostic';
  status: 'live' | 'not-wired';
  trigger: string;
  hasAttachments: boolean;
}

interface EmailTestResult {
  success: boolean;
  messageId?: string;
  error?: string;
  timestamp: string;
}

const CATEGORY_LABELS: Record<TemplateSummary['category'], string> = {
  member: 'Member-facing',
  employer: 'Employer',
  admin: 'Admin / operational',
  diagnostic: 'Diagnostics',
};

const CATEGORY_ORDER: TemplateSummary['category'][] = ['member', 'employer', 'admin', 'diagnostic'];

async function sendTestEmail(to: string, type: string): Promise<EmailTestResult> {
  try {
    const res = await fetch('/api/test-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, type, firstName: 'Test', lastName: 'Member' }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Request failed', timestamp: new Date().toISOString() };
    }
    return { success: true, messageId: data.messageId, timestamp: new Date().toISOString() };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error', timestamp: new Date().toISOString() };
  }
}

export default function EmailTestPage() {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, EmailTestResult>>({});
  const [testType, setTestType] = useState<string>('');

  useEffect(() => {
    fetch('/api/test-email')
      .then((r) => r.json())
      .then((data) => {
        setTemplates(data.templates ?? []);
        if (data.templates?.length) setTestType(data.templates[0].id);
      })
      .catch(() => setTemplates([]));
  }, []);

  const byId = useMemo(
    () => Object.fromEntries(templates.map((t) => [t.id, t])) as Record<string, TemplateSummary>,
    [templates],
  );

  const grouped = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({
        category,
        items: templates.filter((t) => t.category === category),
      })).filter((g) => g.items.length > 0),
    [templates],
  );

  const selected = byId[testType];

  const handleTest = async () => {
    if (!email) {
      alert('Please enter an email address');
      return;
    }

    setLoading(true);
    setResults({});

    try {
      if (testType === 'all') {
        const collected: Record<string, EmailTestResult> = {};
        for (let i = 0; i < templates.length; i++) {
          const t = templates[i];
          setProgress(`Sending ${i + 1} of ${templates.length}: ${t.label}`);
          collected[t.id] = await sendTestEmail(email, t.id);
          setResults({ ...collected });
        }
      } else {
        const result = await sendTestEmail(email, testType);
        setResults({ [testType]: result });
      }
    } catch (error) {
      setResults({
        error: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      });
    } finally {
      setProgress(null);
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '760px', margin: '40px auto', fontFamily: 'sans-serif', padding: '20px' }}>
      <h1 style={{ marginBottom: 4 }}>Email Delivery Tester</h1>
      <p style={{ color: '#666', marginTop: 0 }}>
        Every template the app can send, rendered from the same source production uses. All mail goes out through Resend.
      </p>
      <p style={{ marginTop: 0 }}>
        <a href="/debug/pdf-preview" style={{ color: '#0066CC', fontSize: 14 }}>
          Looking for documents? Open the PDF preview →
        </a>
      </p>

      <div style={{ background: '#f3f4f6', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Test Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your-email@example.com"
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '14px',
              boxSizing: 'border-box',
            }}
            disabled={loading}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Template {templates.length > 0 && <span style={{ fontWeight: 'normal', color: '#6b7280' }}>({templates.length} registered)</span>}
          </label>
          <select
            value={testType}
            onChange={(e) => setTestType(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '14px',
            }}
            disabled={loading || templates.length === 0}
          >
            {grouped.map((group) => (
              <optgroup key={group.category} label={CATEGORY_LABELS[group.category]}>
                {group.items.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                    {t.status === 'not-wired' ? ' — not wired to production' : ''}
                  </option>
                ))}
              </optgroup>
            ))}
            {templates.length > 0 && (
              <optgroup label="Bulk">
                <option value="all">All templates (send all {templates.length})</option>
              </optgroup>
            )}
          </select>
        </div>

        {selected && (
          <div
            style={{
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              padding: 12,
              marginBottom: 15,
              fontSize: 13,
            }}
          >
            <p style={{ margin: '0 0 6px 0', color: '#374151' }}>{selected.description}</p>
            <p style={{ margin: '0 0 6px 0', color: '#6b7280' }}>
              <strong>Sent by:</strong> {selected.trigger}
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: 10,
                  fontSize: 11,
                  fontWeight: 700,
                  background: selected.status === 'live' ? '#dcfce7' : '#fef3c7',
                  color: selected.status === 'live' ? '#166534' : '#92400e',
                }}
              >
                {selected.status === 'live' ? 'LIVE IN PRODUCTION' : 'NOT WIRED TO PRODUCTION'}
              </span>
              {selected.hasAttachments && (
                <span
                  style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: '#dbeafe', color: '#1e40af' }}
                >
                  PDF ATTACHMENTS
                </span>
              )}
            </div>
          </div>
        )}

        <button
          onClick={handleTest}
          disabled={loading || !email || !testType}
          style={{
            width: '100%',
            padding: '10px 20px',
            background: loading ? '#ccc' : '#8B5CF6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? (progress ?? 'Sending...') : 'Send Test Email'}
        </button>
      </div>

      {Object.entries(results).map(([key, result]) => (
        <div
          key={key}
          style={{
            marginBottom: '12px',
            padding: '15px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            background: result.success ? '#ecfdf5' : '#fef2f2',
          }}
        >
          <h3 style={{ margin: '0 0 10px 0', fontSize: 15, color: result.success ? '#059669' : '#dc2626' }}>
            {result.success ? '✅' : '❌'} {byId[key]?.label ?? key}
          </h3>
          {result.success ? (
            <div style={{ fontSize: '13px', color: '#666' }}>
              <p style={{ margin: '2px 0' }}><strong>Message ID:</strong> {result.messageId}</p>
              <p style={{ margin: '2px 0' }}><strong>Sent at:</strong> {new Date(result.timestamp).toLocaleTimeString()}</p>
            </div>
          ) : (
            <div style={{ fontSize: '13px', color: '#dc2626' }}>
              <p style={{ margin: 0 }}><strong>Error:</strong> {result.error}</p>
            </div>
          )}
        </div>
      ))}

      <div style={{ marginTop: '30px', padding: '15px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '4px', fontSize: '13px' }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#1e40af' }}>Troubleshooting</h4>
        <ul style={{ margin: 0, paddingLeft: '20px', color: '#1e40af' }}>
          <li>Use a real email address to test (Gmail, etc.)</li>
          <li>Check spam/junk folder if email doesn&apos;t arrive</li>
          <li>
            Visit{' '}
            <a href="https://resend.com/emails" target="_blank" rel="noopener noreferrer" style={{ color: '#1e40af', fontWeight: 'bold' }}>
              Resend Dashboard
            </a>{' '}
            to see all sent emails
          </li>
          <li>Verify API key in environment: <code style={{ background: 'white', padding: '2px 4px', borderRadius: '2px' }}>RESEND_API_KEY</code></li>
          <li>Templates are defined in <code style={{ background: 'white', padding: '2px 4px', borderRadius: '2px' }}>convex/lib/emailTemplates.ts</code> — adding one there adds it here automatically</li>
        </ul>
      </div>
    </div>
  );
}
