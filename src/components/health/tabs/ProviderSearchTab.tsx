'use client';

import { useState } from 'react';

interface ProviderSearchTabProps {
  onClose: () => void;
}

export default function ProviderSearchTab({ onClose }: ProviderSearchTabProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0', height: '100%' }}>
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #D68910 0%, #F39C12 60%, #f5a42a 100%)',
        borderRadius: '16px 16px 0 0',
        padding: '1.5rem 2rem',
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(255,255,255,0.07)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-60px', left: '30%', width: '260px', height: '260px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            Find a Dentist
          </h2>
          <p style={{ opacity: 0.85, fontSize: '0.9rem', margin: '0.5rem 0 0', marginTop: '0.25rem' }}>
            Dental Discount Network · 50,000+ providers nationwide
          </p>
        </div>
      </div>

      {/* ── Provider Search iFrame ────────────────────────────────────────– */}
      <div
        style={{
          height: isExpanded ? '800px' : '380px',
          borderRadius: '0 0 16px 16px',
          border: '1.5px solid #e2e8f0',
          borderTop: 'none',
          overflow: 'hidden',
          background: '#fff',
          transition: 'height 0.3s ease',
          cursor: isExpanded ? 'default' : 'pointer',
        }}
        onClick={() => !isExpanded && setIsExpanded(true)}
      >
        <iframe
          src="https://ryze.telemedsimplified.com"
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
          }}
          title="Dental Discount Network Provider Search"
          allow="geolocation"
          allowFullScreen
          onLoad={() => setIsExpanded(true)}
        />
      </div>

      {!isExpanded && (
        <div style={{
          textAlign: 'center',
          padding: '1rem',
          fontSize: '0.875rem',
          color: '#64748b',
        }}>
          Click to expand or start searching
        </div>
      )}

      {/* ── Legal disclaimer ──────────────────────────────────────────– */}
      <p style={{
        marginTop: '1rem',
        fontSize: '0.72rem',
        color: '#b0bec5',
        lineHeight: 1.6,
        padding: '0 0.25rem',
      }}>
        <strong style={{ color: '#90a4ae' }}>THIS PLAN IS NOT INSURANCE</strong> and is not intended to replace health insurance. This plan does not meet the minimum creditable coverage requirements under M.G.L. c.111M and 956 CMR 5.00. This plan is not a Qualified Health Plan under the Affordable Care Act. The range of discounts will vary depending on the type of provider and service. The plan does not pay providers directly. Plan members must pay for all services but will receive a discount from participating providers. You may cancel within the first 30 days after effective date or receipt of membership materials (whichever is later) and receive a full refund. Discount Plan Organization and administrator: Careington International Corporation, 7400 Gaylord Parkway, Frisco, TX 75034; phone 800-441-0380. This plan is not available in Vermont or Washington.{' '}
        <a href="https://www1.careington.com/help/privacy-statement/" target="_blank" rel="noopener noreferrer" style={{ color: '#D68910' }}>Privacy</a>
        {' · '}
        <a href="https://www1.careington.com/help/terms-of-use" target="_blank" rel="noopener noreferrer" style={{ color: '#D68910' }}>Terms</a>
      </p>
    </div>
  );
}


