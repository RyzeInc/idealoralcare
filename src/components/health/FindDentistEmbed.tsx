'use client';

import { useState } from 'react';

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
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
              Find a Dentist
            </h3>
            <p style={{ opacity: 0.85, fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
              Dental Discount Network · 50,000+ providers nationwide
            </p>
          </div>

          {/* iFrame */}
          <div style={{ height: '520px', background: '#fff' }}>
            <iframe
              src="https://ryze.telemedsimplified.com"
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
