'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Scan, Video, Search, ChevronRight, Shield } from 'lucide-react';

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTabChange: (tabId: 'overview' | 'provider-search' | 'oral-scan' | 'teledentistry') => void;
}

const FAQS = [
  {
    q: 'Do I need my member ID at my appointment?',
    a: 'Yes. Present your member ID card (or the digital card from your dashboard) so the provider can apply your discounts.',
  },
  {
    q: 'When do my benefits begin?',
    a: 'Benefits are activated within 24 hours of enrollment.',
  },
  {
    q: 'Is the AI scan a diagnosis?',
    a: 'No. The AI scan is a screening tool. Always consult a licensed dentist for professional evaluation.',
  },
  {
    q: 'How do I find a participating dentist?',
    a: 'Use the "Provider Search" tab on your dashboard to search by zip code.',
  },
];

export default function HowItWorksModal({ isOpen, onClose, onTabChange }: HowItWorksModalProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!isOpen) return null;

  const handleTabCta = (tabId: 'overview' | 'provider-search' | 'oral-scan' | 'teledentistry') => {
    onClose();
    onTabChange(tabId);
  };

  // Portal to document.body so ancestor backdrop-filter / transform
  // can't create a new containing block that traps position:fixed
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: '16px',
          /* 16:9 — fills up to 90vw wide, height tracks the ratio, capped at 90vh */
          width: 'min(90vw, calc(90vh * 16 / 9))',
          height: 'min(90vh, calc(90vw * 9 / 16))',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.18)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
            How to Use Your Program
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: '32px', height: '32px', borderRadius: '50%',
              border: '1px solid #e2e8f0', background: '#f8fafc',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#64748b', flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable content — two-column layout exploits the wide 16:9 space */}
        <div style={{ overflowY: 'auto', padding: '1.25rem 1.5rem', flex: 1, minHeight: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', height: '100%' }}>

            {/* Left column: steps */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: '0 0 0.25rem', lineHeight: 1.5 }}>
                Your membership includes 3 benefits. For best results, use them in this order:
              </p>
              {([
                {
                  step: 1,
                  icon: <Scan size={16} color="#2ECC71" />,
                  title: 'AI Dental Scan',
                  desc: 'Upload a photo of your teeth to spot visible areas of concern.',
                  color: '#2ECC71',
                  bg: '#f0fdf4',
                  tab: 'oral-scan' as const,
                },
                {
                  step: 2,
                  icon: <Video size={16} color="#3498DB" />,
                  title: 'Teledentistry',
                  desc: 'Consult a licensed dentist 24/7 for guidance on your concerns.',
                  color: '#3498DB',
                  bg: '#eff6ff',
                  tab: 'teledentistry' as const,
                },
                {
                  step: 3,
                  icon: <Search size={16} color="#F39C12" />,
                  title: 'Dental Discount Network',
                  desc: 'Find a participating provider and save 20–50% on dental care.',
                  color: '#F39C12',
                  bg: '#fff7ed',
                  tab: 'provider-search' as const,
                },
              ]).map(({ step, icon, title, desc, color, bg, tab }) => (
                <button
                  key={step}
                  onClick={() => handleTabCta(tab)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.75rem', background: bg,
                    border: '1px solid #e2e8f0', borderRadius: '10px',
                    cursor: 'pointer', textAlign: 'left', width: '100%',
                  }}
                >
                  <span style={{
                    flexShrink: 0, width: '28px', height: '28px', borderRadius: '50%',
                    background: color, color: '#fff', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700,
                  }}>
                    {step}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      {icon}
                      <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#0f172a' }}>{title}</span>
                    </div>
                    <p style={{ margin: '2px 0 0', fontSize: '0.8125rem', color: '#64748b', lineHeight: 1.4 }}>{desc}</p>
                  </div>
                  <ChevronRight size={14} color="#94a3b8" style={{ flexShrink: 0 }} />
                </button>
              ))}
            </div>

            {/* Right column: FAQ + disclaimer */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.25rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Quick FAQ
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {FAQS.map((faq, i) => (
                  <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                    <button
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                      style={{
                        width: '100%', padding: '0.5rem 0.75rem',
                        background: openFaq === i ? '#f0f7ff' : '#fff',
                        border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        gap: '0.5rem', textAlign: 'left',
                      }}
                    >
                      <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.8125rem' }}>{faq.q}</span>
                      <span style={{
                        flexShrink: 0, transition: 'transform 0.2s',
                        transform: openFaq === i ? 'rotate(90deg)' : 'none',
                        color: '#0066CC',
                      }}>
                        <ChevronRight size={14} />
                      </span>
                    </button>
                    {openFaq === i && (
                      <div style={{ padding: '0 0.75rem 0.5rem', background: '#f0f7ff' }}>
                        <p style={{ margin: 0, color: '#475569', fontSize: '0.8125rem', lineHeight: 1.5 }}>{faq.a}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Disclaimer */}
              <div
                style={{
                  marginTop: 'auto',
                  padding: '0.625rem 0.75rem',
                  background: '#fef3c7',
                  borderRadius: '8px',
                  border: '1px solid #fcd34d',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem',
                }}
              >
                <Shield size={13} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#92400e', lineHeight: 1.4 }}>
                  This is a discount program, not insurance. Discounts vary by provider and location.
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

