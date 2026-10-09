'use client';

import { useState } from 'react';
import { ExternalLink } from 'lucide-react';

const PROVIDER_SEARCH_URL = 'https://ryze.telemedsimplified.com';

export default function FindDentistEmbed() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        className="button button--primary"
        style={{ padding: '13px 32px', fontSize: '0.9375rem' }}
        onClick={() => setOpen((prev) => !prev)}
      >
        {open ? 'Hide Provider Search' : 'Find a Dentist Near You'}
      </button>

      {open && (
        <div
          style={{
            marginTop: '1.5rem',
            borderRadius: '16px',
            overflow: 'hidden',
            border: '1.5px solid #e2e8f0',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          }}
        >
          {/* Header */}
          <div
            style={{
              background: 'linear-gradient(135deg, #D68910 0%, #F39C12 60%, #f5a42a 100%)',
              padding: '1.25rem 1.75rem',
              color: '#fff',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '-40px',
                right: '-40px',
                width: '180px',
                height: '180px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.07)',
                pointerEvents: 'none',
              }}
            />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: '#fff' }}>
              Find a Dentist
            </h3>
            <p style={{ opacity: 0.92, fontSize: '0.875rem', margin: '0.25rem 0 0', color: '#fff' }}>
              Dental Discount Network · 50,000+ providers nationwide
            </p>
            {/* Full-page search: more room on phones, and the network's
                fee-schedule download only opens outside an iframe. */}
            <a
              href={PROVIDER_SEARCH_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                position: 'relative',
                display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                marginTop: '0.75rem', padding: '0.375rem 0.75rem', borderRadius: '8px',
                background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.35)',
                color: '#fff', fontSize: '0.8125rem', fontWeight: 600, textDecoration: 'none',
              }}
            >
              <ExternalLink size={14} />
              Open full search in a new tab
            </a>
          </div>

          {/* iFrame */}
          <div style={{ height: '520px', background: '#fff' }}>
            <iframe
              src={PROVIDER_SEARCH_URL}
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              title="Dental Discount Network Provider Search"
              allow="geolocation"
              allowFullScreen
            />
          </div>
        </div>
      )}
    </div>
  );
}
