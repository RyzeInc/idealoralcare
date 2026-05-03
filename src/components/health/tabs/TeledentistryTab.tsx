'use client';

import { ExternalLink, Video, Copy, CheckCheck } from 'lucide-react';
import { useState } from 'react';

interface TeledentistryTabProps {
  memberId: string | null;
  firstName: string | null;
  fullName: string | null;
}

export default function TeledentistryTab({ memberId, firstName, fullName }: TeledentistryTabProps) {
  const [copied, setCopied] = useState(false);

  const copyMemberId = () => {
    if (!memberId) return;
    navigator.clipboard.writeText(memberId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!memberId) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '3rem 2rem', textAlign: 'center', gap: '1rem',
        background: '#f8fafc', borderRadius: '16px', border: '1.5px solid #e2e8f0',
      }}>
        <Video size={40} color="#94a3b8" />
        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>Teledentistry Access</h3>
        <p style={{ margin: 0, color: '#64748b', maxWidth: '400px', lineHeight: 1.6 }}>
          An active membership is required to access DialCare teledentistry. Please contact{' '}
          <a href="mailto:support@getidealoh.com" style={{ color: '#0066CC' }}>support@getidealoh.com</a>{' '}
          if you believe this is an error.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Hero */}
      <div style={{
        padding: '2rem',
        background: 'linear-gradient(135deg, #3498DB 0%, #2980B9 100%)',
        borderRadius: '16px',
        color: '#fff',
        overflow: 'hidden',
        position: 'relative',
      }}>
        <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '200px', height: '200px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.15), transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem', position: 'relative' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Video size={24} color="#fff" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Teledentistry via DialCare</h2>
            <p style={{ opacity: 0.8, fontSize: '0.9rem', margin: 0, marginTop: '0.2rem' }}>24/7 Virtual Dental Consultations</p>
          </div>
        </div>
        <p style={{ opacity: 0.9, lineHeight: 1.7, margin: 0, maxWidth: '600px', position: 'relative' }}>
          Your plan includes unlimited teledentistry visits through DialCare. Connect with licensed
          dentists anytime from your phone or computer — no waiting room required.
        </p>
      </div>

      {/* Member ID Card */}
      <div style={{
        padding: '1.75rem',
        background: '#fff',
        borderRadius: '16px',
        border: '1.5px solid #e2e8f0',
      }}>
        <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
          Your DialCare Credentials
        </h3>
        <p style={{ margin: '0 0 1.25rem', fontSize: '0.9rem', color: '#64748b', lineHeight: 1.6 }}>
          You&apos;ll use these details to register or log in at{' '}
          <strong style={{ color: '#0f172a' }}>dialcare.com/verify</strong>.
          DialCare will also send a registration email to your account email address.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          {/* Member ID */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '1rem 1.25rem', background: '#f8fafc',
            borderRadius: '12px', border: '1.5px solid #e2e8f0', gap: '1rem',
          }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Member ID</p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', letterSpacing: '0.05em', fontFamily: 'monospace' }}>{memberId}</p>
            </div>
            <button
              onClick={copyMemberId}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.5rem 0.875rem', borderRadius: '8px',
                border: '1.5px solid', borderColor: copied ? '#bbf7d0' : '#e2e8f0',
                background: copied ? '#f0fdf4' : '#fff',
                color: copied ? '#15803d' : '#64748b',
                cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                transition: 'all 0.15s',
              }}
            >
              {copied ? <CheckCheck size={15} /> : <Copy size={15} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          {/* Name fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
            <div style={{ padding: '1rem 1.25rem', background: '#f8fafc', borderRadius: '12px', border: '1.5px solid #e2e8f0' }}>
              <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>First Name</p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>{firstName || '—'}</p>
            </div>
            <div style={{ padding: '1rem 1.25rem', background: '#f8fafc', borderRadius: '12px', border: '1.5px solid #e2e8f0' }}>
              <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Last Name</p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>
                {fullName && firstName ? fullName.replace(firstName, '').trim() || '—' : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* How to access */}
      <div style={{ padding: '1.75rem', background: '#fff', borderRadius: '16px', border: '1.5px solid #e2e8f0' }}>
        <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>How to Access DialCare</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[
            { step: '1', title: 'Check your email', desc: 'DialCare will send a registration email to your account email address. Check your inbox (and spam folder).' },
            { step: '2', title: 'Or visit dialcare.com/verify', desc: 'Go directly to dialcare.com/verify and enter your Member ID, First Name, and Last Name to register or log in.' },
            { step: '3', title: 'Start your consultation', desc: 'Connect with a licensed dentist 24/7 for advice, prescriptions, and treatment plans — all from your device.' },
          ].map(({ step, title, desc }) => (
            <div key={step} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, #3498DB, #2980B9)',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 800,
              }}>{step}</div>
              <div>
                <p style={{ margin: 0, fontWeight: 700, color: '#0f172a', fontSize: '0.9375rem' }}>{title}</p>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#64748b', lineHeight: 1.6 }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '2rem', background: 'linear-gradient(135deg, #eff6ff, #e8f4fd)',
        borderRadius: '16px', border: '1px solid #bfdbfe', textAlign: 'center', gap: '1rem',
      }}>
        <p style={{ margin: 0, fontSize: '0.9375rem', color: '#1e40af', fontWeight: 600 }}>
          Ready to speak with a dentist?
        </p>
        <a
          href="https://dialcare.com/verify"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.875rem 2rem', borderRadius: '10px',
            background: 'linear-gradient(135deg, #3498DB, #2980B9)',
            color: '#fff', textDecoration: 'none', fontWeight: 700,
            fontSize: '0.9375rem', boxShadow: '0 4px 14px rgba(52,152,219,0.35)',
          }}
        >
          <ExternalLink size={17} />
          Go to dialcare.com/verify
        </a>
        <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
          Opens in a new tab · Use your Member ID above to sign in
        </p>
      </div>
    </div>
  );
}
