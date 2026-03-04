'use client';

import { Video } from 'lucide-react';

export default function TeledentistryTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Hero */}
      <div
        className="glass-card"
        style={{
          padding: '2rem',
          background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
          color: '#fff',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-40px',
            right: '-40px',
            width: '200px',
            height: '200px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.15), transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Video size={24} color="#fff" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>
              Teledentistry
            </h2>
            <p style={{ opacity: 0.8, fontSize: '0.9375rem' }}>24/7 Virtual Dental Care</p>
          </div>
        </div>
        <p style={{ opacity: 0.9, lineHeight: 1.7, marginBottom: '1.5rem', maxWidth: '600px' }}>
          Connect with licensed dentists anytime, anywhere through secure video consultations. Get professional
          advice, diagnosis, and treatment plans from the comfort of your home.
        </p>
        <a
          href="#"
          className="button"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'rgba(255,255,255,0.2)',
            color: '#fff',
            border: '2px solid rgba(255,255,255,0.4)',
            padding: '0.75rem 1.5rem',
            borderRadius: '10px',
            textDecoration: 'none',
            fontWeight: 700,
            fontSize: '0.9375rem',
            backdropFilter: 'blur(8px)',
          }}
        >
          <Video size={18} />
          Schedule Consultation
        </a>
      </div>

      {/* Preview image */}
      <div
        className="glass-card"
        style={{
          padding: '0',
          overflow: 'hidden',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          maxHeight: '380px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f0fdf4',
        }}
      >
        <img
          src="/health-assets/teledentistr_1024x1024.png"
          alt="Teledentistry Consultation"
          style={{
            width: '100%',
            maxHeight: '380px',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      </div>

      {/* How it works */}
      <div className="glass-card" style={{ padding: '2rem' }}>
        <h3
          style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: '#0f172a',
            marginBottom: '1.5rem',
          }}
        >
          How It Works
        </h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {[
            {
              icon: '📅',
              step: '1',
              title: 'Book Your Appointment',
              desc: 'Choose a time that works for you. Available 24/7 for urgent concerns or scheduled appointments.',
            },
            {
              icon: '💬',
              step: '2',
              title: 'Connect with a Dentist',
              desc: 'Join a secure video call with an experienced, licensed dentist who will review your concerns.',
            },
            {
              icon: '📋',
              step: '3',
              title: 'Get Your Treatment Plan',
              desc: 'Receive professional recommendations, prescriptions if needed, and referrals to in-person care.',
            },
          ].map(({ icon, step, title, desc }) => (
            <div
              key={step}
              style={{
                padding: '1.5rem',
                background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)',
                borderRadius: '14px',
                border: '1px solid #bbf7d0',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>{icon}</div>
              <div
                style={{
                  display: 'inline-block',
                  padding: '0.2rem 0.6rem',
                  background: 'linear-gradient(135deg, #0d9488, #0f766e)',
                  color: '#fff',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  marginBottom: '0.625rem',
                }}
              >
                Step {step}
              </div>
              <h4
                style={{
                  fontWeight: 700,
                  color: '#0f172a',
                  marginBottom: '0.5rem',
                  fontSize: '1rem',
                }}
              >
                {title}
              </h4>
              <p style={{ fontSize: '0.875rem', color: '#64748b', lineHeight: 1.6, margin: 0 }}>
                {desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Benefits */}
      <div className="glass-card" style={{ padding: '2rem' }}>
        <h3
          style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: '#0f172a',
            marginBottom: '1.25rem',
          }}
        >
          Why Teledentistry?
        </h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '1rem',
          }}
        >
          {[
            {
              icon: '🕐',
              title: 'Available 24/7',
              desc: 'Get dental advice any time of day, including nights and weekends.',
            },
            {
              icon: '🏠',
              title: 'From Your Home',
              desc: 'No travel required — consult from wherever you are most comfortable.',
            },
            {
              icon: '💊',
              title: 'Prescriptions Available',
              desc: 'Dentists can send prescriptions electronically when clinically appropriate.',
            },
            {
              icon: '🔒',
              title: 'Secure & Private',
              desc: 'HIPAA-compliant video consultations keep your health data protected.',
            },
          ].map(({ icon, title, desc }) => (
            <div
              key={title}
              style={{
                padding: '1.25rem',
                background: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                gap: '1rem',
                alignItems: 'flex-start',
              }}
            >
              <div
                style={{
                  fontSize: '1.5rem',
                  flexShrink: 0,
                  width: '40px',
                  height: '40px',
                  background: '#f0fdf4',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {icon}
              </div>
              <div>
                <h4
                  style={{
                    fontWeight: 700,
                    color: '#0f172a',
                    marginBottom: '0.25rem',
                    fontSize: '0.9375rem',
                  }}
                >
                  {title}
                </h4>
                <p style={{ fontSize: '0.875rem', color: '#64748b', lineHeight: 1.5, margin: 0 }}>
                  {desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div
        style={{
          textAlign: 'center',
          padding: '2.5rem',
          background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)',
          borderRadius: '16px',
          border: '1px solid #bbf7d0',
        }}
      >
        <h3
          style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: '#0f172a',
            marginBottom: '0.75rem',
          }}
        >
          Ready to talk to a dentist?
        </h3>
        <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
          Book a virtual consultation and get expert dental care today.
        </p>
        <a
          href="#"
          className="button"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: '#0d9488',
            color: '#fff',
            padding: '0.75rem 1.5rem',
            borderRadius: '10px',
            textDecoration: 'none',
            fontWeight: 700,
            fontSize: '0.9375rem',
          }}
        >
          <Video size={18} />
          Schedule Now
        </a>
      </div>
    </div>
  );
}
