'use client';

import { useState } from 'react';

interface EmailTestResult {
  success: boolean;
  messageId?: string;
  error?: string;
  timestamp: string;
}

async function sendTestEmail(to: string, type: string): Promise<EmailTestResult> {
  try {
    const res = await fetch('/api/test-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, type, firstName: 'Test User' }),
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

const EMAIL_LABELS: Record<string, string> = {
  'fulfillment-packet': 'Fulfillment Packet (PDF + Program Guide)',
  'welcome': 'Welcome Email',
  'confirmation': 'Confirmation Email',
  'cancelled': 'Cancellation Email',
  'eligibility-set-password': 'Eligibility Welcome — Set Your Password',
  'employer-membership-agreement': 'Employer-Paid Membership Agreement',
};

export default function EmailTestPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Record<string, EmailTestResult>>({});
  const [testType, setTestType] = useState<string>('fulfillment-packet');

  const handleTest = async () => {
    if (!email) {
      alert('Please enter an email address');
      return;
    }

    setLoading(true);
    setResults({});

    try {
      if (testType === 'all') {
        const types = ['fulfillment-packet', 'welcome', 'confirmation', 'cancelled', 'eligibility-set-password', 'employer-membership-agreement'];
        const allResults: Record<string, EmailTestResult> = {};
        for (const t of types) {
          allResults[t] = await sendTestEmail(email, t);
        }
        setResults(allResults);
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
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', fontFamily: 'sans-serif', padding: '20px' }}>
      <h1>📧 Email Delivery Tester</h1>
      <p style={{ color: '#666' }}>Test Resend email integration to ensure fulfillment emails are working.</p>

      <div style={{ background: '#f3f4f6', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Test Email Address
          </label>
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
            Test Type
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
            disabled={loading}
          >
            <option value="fulfillment-packet">Fulfillment Packet (PDF + Program Guide email)</option>
            <option value="welcome">Welcome Email (Membership active)</option>
            <option value="confirmation">Confirmation Email (Enrollment summary)</option>
            <option value="cancelled">Cancellation Email</option>
            <option value="eligibility-set-password">Eligibility Welcome — Set Your Password</option>
            <option value="employer-membership-agreement">Employer-Paid Membership Agreement</option>
            <option value="all">All Emails (send all 6)</option>
          </select>
        </div>

        <button
          onClick={handleTest}
          disabled={loading || !email}
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
          {loading ? 'Sending...' : 'Send Test Email'}
        </button>
      </div>

      {/* Results */}
      {Object.entries(results).map(([key, result]) => (
        <div key={key} style={{ marginBottom: '15px', padding: '15px', border: '1px solid #d1d5db', borderRadius: '4px', background: result.success ? '#ecfdf5' : '#fef2f2' }}>
          <h3 style={{ margin: '0 0 10px 0', color: result.success ? '#059669' : '#dc2626' }}>
            {result.success ? '✅' : '❌'} {EMAIL_LABELS[key] || key}
          </h3>
          {result.success ? (
            <div style={{ fontSize: '14px', color: '#666' }}>
              <p><strong>Message ID:</strong> {result.messageId}</p>
              <p><strong>Sent at:</strong> {new Date(result.timestamp).toLocaleTimeString()}</p>
              <p style={{ color: '#059669' }}>Check your inbox at <strong>{email}</strong></p>
            </div>
          ) : (
            <div style={{ fontSize: '14px', color: '#dc2626' }}>
              <p><strong>Error:</strong> {result.error}</p>
            </div>
          )}
        </div>
      ))}

      {/* Help section */}
      <div style={{ marginTop: '30px', padding: '15px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '4px', fontSize: '13px' }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#1e40af' }}>🔍 Troubleshooting</h4>
        <ul style={{ margin: 0, paddingLeft: '20px', color: '#1e40af' }}>
          <li>Use a real email address to test (Gmail, etc.)</li>
          <li>Check spam/junk folder if email doesn't arrive</li>
          <li>Visit <a href="https://resend.com/emails" target="_blank" rel="noopener noreferrer" style={{ color: '#1e40af', fontWeight: 'bold' }}>Resend Dashboard</a> to see all sent emails</li>
          <li>Verify API key in environment: <code style={{ background: 'white', padding: '2px 4px', borderRadius: '2px' }}>RESEND_API_KEY</code></li>
          <li>Check Next.js server logs for detailed errors</li>
        </ul>
      </div>
    </div>
  );
}
