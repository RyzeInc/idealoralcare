import Link from 'next/link';

interface DebugTool {
  href: string;
  label: string;
  description: string;
  sendsRealEmail?: boolean;
}

const TOOLS: DebugTool[] = [
  {
    href: '/debug/email-test',
    label: 'Email Delivery Tester',
    description: 'Send any registered email template through Resend to a real inbox. Every send is logged on the page.',
    sendsRealEmail: true,
  },
  {
    href: '/debug/email-preview',
    label: 'Email Preview',
    description: 'View any email template’s rendered HTML in the browser. Nothing is sent.',
  },
  {
    href: '/debug/pdf-preview',
    label: 'PDF Preview',
    description: 'View or download any PDF the system generates (member packets, ID cards, invoices, vendor statements) from sample data.',
  },
];

export default function DebugLandingPage() {
  return (
    <div style={{ maxWidth: '760px', margin: '40px auto', fontFamily: 'sans-serif', padding: '20px' }}>
      <h1 style={{ marginBottom: 4 }}>Debug Tools</h1>
      <p style={{ color: '#666', marginTop: 0 }}>
        Internal tools for verifying emails and documents without touching production data.
      </p>

      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {TOOLS.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            style={{
              display: 'block',
              padding: '16px 18px',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              textDecoration: 'none',
              color: 'inherit',
              background: 'white',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#0066CC' }}>{tool.label}</span>
              {tool.sendsRealEmail && (
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 10,
                    fontSize: 10,
                    fontWeight: 700,
                    background: '#fef3c7',
                    color: '#92400e',
                  }}
                >
                  SENDS REAL EMAIL
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: 14, color: '#4b5563' }}>{tool.description}</p>
          </Link>
        ))}
      </div>

      <div style={{ marginTop: 28, padding: '14px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 13, color: '#92400e' }}>
        These pages are not login-gated. Anyone with the URL can use them, including sending real email from our
        domain. The Email Delivery Tester keeps a visible log of every send for accountability.
      </div>
    </div>
  );
}
