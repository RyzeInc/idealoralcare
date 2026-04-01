'use client';

import { useState } from 'react';
import { Download, RotateCcw } from 'lucide-react';
import { renderCardFront, renderCardBack, type MemberCardData } from '@/lib/card-renderer';

/**
 * MEMBER ID CARD COMPONENT
 *
 * Physical membership card replica with front/back flip.
 * Matches card layout used by the provider network.
 * Uses shared rendering logic for consistency with PDF and wallet passes.
 */

interface MemberIdCardProps {
  cardData: MemberCardData;
  onDownload?: () => void;
}

export default function MemberIdCard({ cardData, onDownload }: MemberIdCardProps) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Top row: title + actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
          Your Member ID Card
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setFlipped(!flipped)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.375rem',
              padding: '0.375rem 0.75rem', background: '#f1f5f9', color: '#475569',
              border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer',
              fontSize: '0.8125rem', fontWeight: 500,
            }}
          >
            <RotateCcw size={14} />
            {flipped ? 'Front' : 'Back'}
          </button>
          {onDownload && (
            <button
              onClick={onDownload}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.375rem',
                padding: '0.375rem 0.75rem', background: '#eff6ff', color: '#0066CC',
                border: '1px solid #bfdbfe', borderRadius: '8px', cursor: 'pointer',
                fontSize: '0.8125rem', fontWeight: 600,
              }}
            >
              <Download size={14} />
              Download PDF
            </button>
          )}
        </div>
      </div>

      {/* Card with flip */}
      <div
        style={{
          perspective: '1000px',
          cursor: 'pointer',
          maxWidth: '100%',
          overflow: 'hidden',
        }}
        onClick={() => setFlipped(!flipped)}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '100%',
            aspectRatio: '1.586',
            transition: 'transform 0.6s',
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0)',
          }}
        >
          {/* ── FRONT ──────────────────────────────────────────────── */}
          <div
            style={{
              position: 'absolute', inset: 0,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              background: '#fff',
              borderRadius: '14px',
              border: '1px solid #cbd5e1',
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              overflow: 'hidden',
            }}
          >
            {/* Top decoration */}
            <div
              style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '4px',
                background: 'linear-gradient(90deg, #0066CC, #14b8a6)',
              }}
            />

            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/ideal-oral-health-logo.png"
                  alt="Ideal Oral Health"
                  style={{ height: '36px', width: 'auto', objectFit: 'contain' }}
                />
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                    Member ID Card
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '0.6875rem', color: '#94a3b8', textAlign: 'right' }}>
                <div>www.getidealoh.com</div>
                <div>{cardData.supportPhone}</div>
              </div>
            </div>

            {/* Fields grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1.5rem', marginTop: '0.25rem' }}>
              <div>
                <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Member
                </div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', marginTop: '1px' }}>
                  {cardData.memberName}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Member ID
                </div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace', marginTop: '1px', textTransform: 'uppercase' }}>
                  {cardData.memberId}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Group Code
                </div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#0f172a', marginTop: '1px' }}>
                  {cardData.groupCode || 'IOH-DTC'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Effective
                </div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#0f172a', marginTop: '1px' }}>
                  {cardData.effectiveDate}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                borderTop: '1px solid #e2e8f0',
                paddingTop: '0.625rem',
                marginTop: '0.25rem',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0f172a', letterSpacing: '0.04em' }}>
                THIS IS NOT INSURANCE.
              </div>
              <div style={{ fontSize: '0.625rem', color: '#94a3b8', marginTop: '2px' }}>
                This is a discount program. Savings vary by provider.
              </div>
            </div>
          </div>

          {/* ── BACK ───────────────────────────────────────────────── */}
          <div
            style={{
              position: 'absolute', inset: 0,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              background: '#f8fafc',
              borderRadius: '14px',
              border: '1px solid #cbd5e1',
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
              padding: '1.25rem 1.5rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              overflow: 'hidden',
            }}
          >
            {/* Top decoration */}
            <div
              style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '4px',
                background: 'linear-gradient(90deg, #14b8a6, #0066CC)',
              }}
            />

            {/* Networks */}
            <div>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.625rem' }}>
                Networks &amp; Services
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0f172a' }}>
                    Teledentistry — DialCare
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>(800) 290-0523</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#475569' }}>
                  {cardData.networks.dialCare.memberUrl.replace('https://', '')}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0f172a' }}>
                    Dental Discount Network
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{cardData.supportPhone}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#475569' }}>
                  {cardData.networks.careington.memberUrl.replace('https://', '')}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0f172a' }}>
                    AI Oral Scan
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#475569' }}>
                  {cardData.networks.toothlens.memberUrl.replace('https://', '')}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                borderTop: '1px solid #e2e8f0',
                paddingTop: '0.625rem',
                marginTop: '0.25rem',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#0f172a', letterSpacing: '0.02em' }}>
                THIS IS NOT INSURANCE. IT IS A DISCOUNT PROGRAM.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tap hint */}
      <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8', margin: '-0.25rem 0 0' }}>
        Tap card to flip
      </p>

    </div>
  );
}

export type { MemberCardData };
