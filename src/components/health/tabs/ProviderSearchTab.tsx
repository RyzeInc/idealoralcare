'use client';

import { Search } from 'lucide-react';

interface ProviderSearchTabProps {
  onClose: () => void;
}

export default function ProviderSearchTab({ onClose }: ProviderSearchTabProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div
        className="glass-card"
        style={{
          padding: '2rem',
          background: 'linear-gradient(135deg, #0066CC 0%, #0052a3 100%)',
          color: '#fff',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-60px',
            right: '-60px',
            width: '220px',
            height: '220px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.12), transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(255,255,255,0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Search size={24} color="#fff" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.2rem' }}>Find a Dentist</h2>
            <p style={{ opacity: 0.8, fontSize: '0.9rem', margin: 0 }}>
              Powered by Dental Discount Network International · 50,000+ participating providers nationwide
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
          {['Save 20%–50%', 'Unlimited Cleanings', 'No Waiting Period', 'Ortho Included'].map((b) => (
            <span
              key={b}
              style={{
                padding: '0.3rem 0.75rem',
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: '9999px',
                fontSize: '0.78125rem',
                fontWeight: 600,
              }}
            >
              {b}
            </span>
          ))}
        </div>
      </div>

      {/* Search Form — posts to Dental Discount Network results page */}
      <div className="glass-card" style={{ padding: '2rem' }}>
        <h3
          style={{
            fontSize: '1.125rem',
            fontWeight: 700,
            color: '#0f172a',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
          }}
        >
          <Search size={20} color="#0066CC" />
          Search for a Provider
        </h3>

        {/* Dental Discount Network's results page accepts GET params — we build the query URL on submit */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const specialty = fd.get('specialty') as string;
            const providerName = fd.get('providerName') as string;
            const city = fd.get('city') as string;
            const state = fd.get('state') as string;
            const zip = fd.get('zip') as string;
            const radius = fd.get('radius') as string;

            // Build the Dental Discount Network search URL with our agent code
            const params = new URLSearchParams({
              AgentCode: '1800DEN84707D',
              ParentDomainName: 'www1.careington.com',
              Protocol: 'https',
              ...(specialty && specialty !== '(All Specialties)' ? { Specialty: specialty } : {}),
              ...(providerName ? { PrvName: providerName } : {}),
              ...(city ? { City: city } : {}),
              ...(state ? { State: state } : {}),
              ...(zip ? { Zip: zip } : {}),
              ...(radius ? { RowCount: radius } : {}),
            });
            window.open(
              `https://www1.careington.com/Search/PrvSrchResults.aspx?${params.toString()}`,
              '_blank',
              'noopener,noreferrer'
            );
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
        >
          {/* Step 1 — Specialty */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.875rem',
              }}
            >
              <span
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #0066CC, #0052a3)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                1
              </span>
              <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9375rem' }}>
                What type of provider are you looking for?
              </span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>
                  Dental Specialty
                </label>
                <select
                  name="specialty"
                  defaultValue="GENERAL DENTIST"
                  style={{
                    padding: '0.625rem 0.875rem',
                    borderRadius: '10px',
                    border: '1.5px solid #e2e8f0',
                    background: '#f8fafc',
                    fontSize: '0.9375rem',
                    color: '#0f172a',
                    outline: 'none',
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  <option value="(All Specialties)">(All Specialties)</option>
                  <option value="ENDODONTICS">Endodontics</option>
                  <option value="GENERAL DENTIST">General Dentist</option>
                  <option value="ORAL SURGERY">Oral Surgery</option>
                  <option value="ORTHODONTICS">Orthodontics</option>
                  <option value="PEDIATRICS">Pediatrics</option>
                  <option value="PERIODONTICS">Periodontics</option>
                  <option value="PROSTHODONTIC">Prosthodontic</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>
                  Provider Name <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span>
                </label>
                <input
                  name="providerName"
                  type="text"
                  placeholder="e.g. Smith, John"
                  maxLength={66}
                  style={{
                    padding: '0.625rem 0.875rem',
                    borderRadius: '10px',
                    border: '1.5px solid #e2e8f0',
                    background: '#f8fafc',
                    fontSize: '0.9375rem',
                    color: '#0f172a',
                    outline: 'none',
                    width: '100%',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid #f1f5f9' }} />

          {/* Step 2 — Location */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.875rem',
              }}
            >
              <span
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #0066CC, #0052a3)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                2
              </span>
              <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9375rem' }}>
                Limit your search to this area
              </span>
              <span style={{ fontSize: '0.8125rem', color: '#94a3b8', marginLeft: '0.25rem' }}>
                · Enter City + State OR Zip
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 140px', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>City</label>
                <input
                  name="city"
                  type="text"
                  placeholder="e.g. Austin"
                  maxLength={32}
                  style={{
                    padding: '0.625rem 0.875rem',
                    borderRadius: '10px',
                    border: '1.5px solid #e2e8f0',
                    background: '#f8fafc',
                    fontSize: '0.9375rem',
                    color: '#0f172a',
                    outline: 'none',
                    width: '100%',
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>State</label>
                <select
                  name="state"
                  style={{
                    padding: '0.625rem 0.75rem',
                    borderRadius: '10px',
                    border: '1.5px solid #e2e8f0',
                    background: '#f8fafc',
                    fontSize: '0.9375rem',
                    color: '#0f172a',
                    outline: 'none',
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  <option value="">--</option>
                  {[
                    'AK',
                    'AL',
                    'AR',
                    'AZ',
                    'CA',
                    'CO',
                    'CT',
                    'DC',
                    'DE',
                    'FL',
                    'GA',
                    'HI',
                    'IA',
                    'ID',
                    'IL',
                    'IN',
                    'KS',
                    'KY',
                    'LA',
                    'MA',
                    'MD',
                    'ME',
                    'MI',
                    'MN',
                    'MO',
                    'MS',
                    'MT',
                    'NC',
                    'ND',
                    'NE',
                    'NH',
                    'NJ',
                    'NM',
                    'NV',
                    'NY',
                    'OH',
                    'OK',
                    'OR',
                    'PA',
                    'PR',
                    'RI',
                    'SC',
                    'SD',
                    'TN',
                    'TX',
                    'UT',
                    'VA',
                    'VI',
                    'VT',
                    'WA',
                    'WI',
                    'WV',
                    'WY',
                  ].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>Zip Code</label>
                <input
                  name="zip"
                  type="text"
                  placeholder="e.g. 90210"
                  maxLength={5}
                  pattern="\d{5}"
                  style={{
                    padding: '0.625rem 0.875rem',
                    borderRadius: '10px',
                    border: '1.5px solid #e2e8f0',
                    background: '#f8fafc',
                    fontSize: '0.9375rem',
                    color: '#0f172a',
                    outline: 'none',
                    width: '100%',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid #f1f5f9' }} />

          {/* Step 3 — Radius */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.875rem',
              }}
            >
              <span
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #0066CC, #0052a3)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                3
              </span>
              <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9375rem' }}>
                Display closest within 100 miles
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
              {[
                { value: '10', label: '10 providers' },
                { value: '25', label: '25 providers' },
                { value: '50', label: '50 providers' },
                { value: '100', label: '100 providers' },
              ].map(({ value, label }) => (
                <label
                  key={value}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 1rem',
                    borderRadius: '10px',
                    border: '1.5px solid #e2e8f0',
                    background: '#f8fafc',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: '#374151',
                  }}
                >
                  <input
                    type="radio"
                    name="radius"
                    value={value}
                    defaultChecked={value === '25'}
                    style={{ accentColor: '#0066CC' }}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '0.5rem',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <p style={{ fontSize: '0.8125rem', color: '#94a3b8', margin: 0, maxWidth: '500px' }}>
              When contacting a provider, identify yourself as a member of the Dental Discount Network network.
              Results will open in a new tab.
            </p>
            <button
              type="submit"
              className="button button--primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.75rem',
                fontSize: '1rem',
                fontWeight: 700,
                whiteSpace: 'nowrap',
              }}
            >
              <Search size={18} />
              Search for Providers
            </button>
          </div>
        </form>
      </div>

      {/* Legal Disclaimer */}
      <div
        style={{
          padding: '1.25rem 1.5rem',
          background: '#f8fafc',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          fontSize: '0.78125rem',
          color: '#94a3b8',
          lineHeight: 1.6,
        }}
      >
        <strong style={{ color: '#64748b' }}>THIS PLAN IS NOT INSURANCE</strong> and is not intended to replace
        health insurance. This plan does not meet the minimum creditable coverage requirements under M.G.L. c.111M and
        956 CMR 5.00. This plan is not a Qualified Health Plan under the Affordable Care Act. The range of discounts
        will vary depending on the type of provider and service. The plan does not pay providers directly. Plan members
        must pay for all services but will receive a discount from participating providers. Discount Plan Organization
        and administrator: Dental Discount Network International Corporation, 7400 Gaylord Parkway, Frisco, TX 75034;
        phone 800-441-0380. This plan is not available in Vermont or Washington.{' '}
        <a href="https://www1.careington.com/help/privacy-statement/" target="_blank" rel="noopener noreferrer" style={{ color: '#0066CC' }}>
          Privacy Policy
        </a>
        {' '}|{' '}
        <a href="https://www1.careington.com/help/terms-of-use" target="_blank" rel="noopener noreferrer" style={{ color: '#0066CC' }}>
          Terms of Use
        </a>
      </div>
    </div>
  );
}
