'use client';

import { useState } from 'react';
import { Download, RotateCcw } from 'lucide-react';
import { renderCardFront, renderCardBack, type MemberCardData } from '@/lib/card-renderer';
import { PROVIDER_GROUP_CODE } from '@/lib/constants';

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

const CAREINGTON_LOGO_SRC = "/careington-logo.png";
// Sits in the footer row beside the disclaimer. It used to float over the
// bottom-right corner, where it covered the disclaimer once the card got narrow.
const cardLogoStyle: React.CSSProperties = {
  width: '64px',
  flexShrink: 0,
  opacity: 0.35,
  pointerEvents: 'none',
};
const cardFooterStyle: React.CSSProperties = {
  borderTop: '1px solid #e2e8f0',
  paddingTop: '0.375rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.5rem',
};

export default function MemberIdCard({ cardData, onDownload }: MemberIdCardProps) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Top row: title + actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem 1rem' }}>
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
              fontSize: '0.8125rem', fontWeight: 500, whiteSpace: 'nowrap',
            }}
          >
            <RotateCcw size={14} />
            {flipped ? 'View front' : 'View back'}
          </button>
          {onDownload && (
            <button
              onClick={onDownload}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.375rem',
                padding: '0.375rem 0.75rem', background: '#eff6ff', color: '#0066CC',
                border: '1px solid #bfdbfe', borderRadius: '8px', cursor: 'pointer',
                fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap',
              }}
            >
              <Download size={14} />
              Download PDF
            </button>
          )}
        </div>
      </div>

      {/* Card with flip — capped at standard credit-card proportions (CR80: 3.375" × 2.125") */}
      {/* Max-width 480px ≈ card at ~142 DPI, a comfortable on-screen size */}
      <div
        style={{
          perspective: '1000px',
          cursor: 'pointer',
          width: '100%',
          maxWidth: '480px',
          margin: '0 auto',
          containerType: 'inline-size',
        }}
        onClick={() => setFlipped(!flipped)}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            transition: 'transform 0.6s',
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0)',
          }}
        >
          {/* ── FRONT ──────────────────────────────────────────────── */}
          {/* In normal flow so the card is at least CR80-shaped (62.96cqw = 1/1.5882
              of the card's width) but grows when a phone-width card can't fit every
              line — a fixed aspect ratio clipped the footer on narrow screens. The
              back face is absolutely positioned and takes the same height. */}
          <div
            style={{
              position: 'relative',
              minHeight: '62.96cqw',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              background: '#fff',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
              padding: '4.5% 5%',     /* percentage padding scales with card width */
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              overflow: 'hidden',
              boxSizing: 'border-box',
            }}
          >
            {/* Top decoration */}
            <div
              style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
                background: 'linear-gradient(90deg, #0066CC, #14b8a6)',
              }}
            />

            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', minWidth: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/ideal-oral-health-logo.png"
                  alt="Ideal Oral Health"
                  style={{ height: '28px', width: 'auto', objectFit: 'contain', flexShrink: 0 }}
                />
                <div className="member-card-brandtext" style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                    Ideal Oral Health
                  </div>
                  <div style={{ fontSize: '0.5625rem', color: '#64748b' }}>
                    Member ID Card
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '0.5625rem', color: '#94a3b8', textAlign: 'right', flexShrink: 0 }}>
                <div>www.getidealoh.com</div>
                <div>{cardData.supportPhone ?? '(844) 679-9367'}</div>
              </div>
            </div>

            {/* Fields grid — 2-column, 3-row layout */}
            {/* minmax(0, …) so a long plan name truncates in its own column
                instead of widening it and clipping the Member ID beside it. */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '4px 12px' }}>
              {[
                { label: 'Member',             value: cardData.memberName,                          mono: false },
                { label: 'Member ID',           value: cardData.memberId,                            mono: true  },
                { label: 'Subscriber ID',       value: cardData.subscriberId || cardData.memberId,   mono: true  },
                { label: 'Provider Group Code', value: cardData.groupCode || PROVIDER_GROUP_CODE,              mono: false },
                { label: 'Plan',                value: cardData.planName,                            mono: false },
                { label: 'Effective',           value: cardData.effectiveDate,                       mono: false },
              ].map(({ label, value, mono }) => (
                <div key={label}>
                  <div style={{ fontSize: '0.5rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {label}
                  </div>
                  <div style={{
                    fontSize: '0.6875rem', fontWeight: mono ? 700 : 600, color: '#0f172a',
                    fontFamily: mono ? 'monospace' : 'inherit',
                    textTransform: mono ? 'uppercase' : 'none',
                    marginTop: '1px',
                    // IDs stay on one line; names and plans wrap — the card
                    // grows to fit rather than cutting "— Family" off a plan.
                    ...(mono
                      ? { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
                      : { overflowWrap: 'anywhere' }),
                  }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={cardFooterStyle}>
              <div>
                <div style={{ fontSize: '0.5625rem', fontWeight: 800, color: '#0f172a', letterSpacing: '0.04em' }}>
                  THIS IS NOT INSURANCE.
                </div>
                <div style={{ fontSize: '0.5rem', color: '#94a3b8', marginTop: '1px' }}>
                  This is a discount program. Savings vary by provider.
                </div>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={CAREINGTON_LOGO_SRC} alt="Careington" style={cardLogoStyle} />
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
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
              padding: '4.5% 5%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              overflow: 'hidden',
              boxSizing: 'border-box',
            }}
          >
            {/* Top decoration */}
            <div
              style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
                background: 'linear-gradient(90deg, #14b8a6, #0066CC)',
              }}
            />

            {/* Networks */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '0.5rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>
                Networks &amp; Services
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3125rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.625rem', fontWeight: 600, color: '#0f172a' }}>
                      Teledentistry — DialCare
                    </span>
                    <span style={{ fontSize: '0.5625rem', color: '#64748b', flexShrink: 0 }}>(855) 335-2255</span>
                  </div>
                  <div style={{ fontSize: '0.5625rem', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {cardData.networks.dialCare.memberUrl.replace('https://', '')}
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.625rem', fontWeight: 600, color: '#0f172a' }}>
                      Careington Dental Network
                    </span>
                    <span style={{ fontSize: '0.5625rem', color: '#64748b', flexShrink: 0 }}>(800) 290-0523</span>
                  </div>
                  <div style={{ fontSize: '0.5625rem', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {cardData.networks.careington.memberUrl.replace('https://', '')}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.625rem', fontWeight: 600, color: '#0f172a' }}>
                    AI Oral Scan
                  </div>
                  <div style={{ fontSize: '0.5625rem', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {cardData.networks.toothlens.memberUrl.replace('https://', '')}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={cardFooterStyle}>
              <div style={{ fontSize: '0.5rem', fontWeight: 800, color: '#0f172a', letterSpacing: '0.02em' }}>
                THIS IS NOT INSURANCE. IT IS A DISCOUNT PROGRAM.
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={CAREINGTON_LOGO_SRC} alt="Careington" style={cardLogoStyle} />
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
