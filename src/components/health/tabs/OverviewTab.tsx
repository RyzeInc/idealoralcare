'use client';

import Link from 'next/link';
import {
  ChevronRight,
  HeartPulse,
  Settings,
  CreditCard,
  FileText,
  RefreshCw,
  Search,
  Scan,
  Video,
  ShieldCheck,
} from 'lucide-react';
import FamilySection from '../FamilySection';

interface Subscription {
  id: string;
  name: string;
  category: string;
  price: number;
  cadence: string;
  renewDate: string;
  status: string;
}

interface OverviewTabProps {
  firstName: string | null;
  email: string | null;
  fullName: string | null;
  memberSince: string | null;
  hasSubscriptions: boolean;
  subscriptions: Subscription[];
  onTabChange: (tabId: 'overview' | 'provider-search' | 'oral-scan' | 'teledentistry') => void;
}

export default function OverviewTab({
  firstName,
  email,
  fullName,
  memberSince,
  hasSubscriptions,
  subscriptions,
  onTabChange,
}: OverviewTabProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 340px',
        gap: '2.5rem',
        alignItems: 'start',
      }}
    >
      {/* Main Column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Active Plans */}
        <div className="glass-card" style={{ padding: '2rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.5rem',
            }}
          >
            <h2
              style={{
                fontSize: '1.375rem',
                fontWeight: 700,
                color: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}
            >
              <HeartPulse size={24} color="#0066CC" />
              Your Active Plans
            </h2>
            <Link
              href="/health/plans"
              style={{
                color: '#0066CC',
                fontSize: '0.9375rem',
                textDecoration: 'none',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              Browse More <ChevronRight size={18} />
            </Link>
          </div>

          {hasSubscriptions ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {subscriptions.map((sub) => (
                <div
                  key={sub.id}
                  style={{
                    padding: '1.25rem',
                    background: '#f8fafc',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <span
                      style={{
                        display: 'block',
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: '#0066CC',
                        marginBottom: '0.25rem',
                      }}
                    >
                      {sub.category}
                    </span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{sub.name}</span>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginTop: '0.5rem',
                        fontSize: '0.875rem',
                        color: '#64748b',
                      }}
                    >
                      <span>🕐</span>
                      Renews {sub.renewDate}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span
                      style={{
                        fontWeight: 700,
                        color: '#0f172a',
                        fontSize: '1.125rem',
                      }}
                    >
                      ${(sub.price / 100).toFixed(2)}
                    </span>
                    <span style={{ color: '#64748b', fontSize: '0.875rem' }}>
                      /{sub.cadence === 'monthly' ? 'mo' : 'yr'}
                    </span>
                    <span
                      style={{
                        display: 'block',
                        marginTop: '0.5rem',
                        padding: '0.25rem 0.75rem',
                        background: '#dcfce7',
                        color: '#15803d',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}
                    >
                      {sub.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '3rem 2rem',
                background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
                borderRadius: '12px',
                border: '1px dashed #cbd5e1',
              }}
            >
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #0066CC20, #14b8a620)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem',
                }}
              >
                <HeartPulse size={28} color="#0066CC" />
              </div>
              <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
                You don&apos;t have any active plans yet.
                <br />
                Start saving on healthcare today!
              </p>
              <Link href="/health/plans" className="button button--primary">
                Browse Plans
              </Link>
            </div>
          )}
        </div>

        {/* Account Information */}
        <div className="glass-card" style={{ padding: '2rem' }}>
          <h2
            style={{
              fontSize: '1.375rem',
              fontWeight: 700,
              color: '#0f172a',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <Settings size={24} color="#0066CC" />
            Account Information
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem 0',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <span style={{ color: '#64748b' }}>Email</span>
              <span style={{ fontWeight: 600, color: '#0f172a' }}>{email || 'Not set'}</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem 0',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <span style={{ color: '#64748b' }}>Name</span>
              <span style={{ fontWeight: 600, color: '#0f172a' }}>{fullName || 'Not set'}</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem 0',
              }}
            >
              <span style={{ color: '#64748b' }}>Member Since</span>
              <span style={{ fontWeight: 600, color: '#0f172a' }}>{memberSince || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Family Members */}
        <FamilySection />

        {/* Billing & Payment */}
        <div className="glass-card" style={{ padding: '2rem' }}>
          <h2
            style={{
              fontSize: '1.375rem',
              fontWeight: 700,
              color: '#0f172a',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <CreditCard size={24} color="#0066CC" />
            Billing &amp; Payment
          </h2>
          <div
            style={{
              padding: '1.5rem',
              background: '#f8fafc',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              textAlign: 'center',
            }}
          >
            <p style={{ color: '#64748b', marginBottom: '1rem' }}>
              Payment methods and billing history will appear here once you have active plans.
            </p>
            <button
              className="button button--glass"
              disabled
              style={{ opacity: 0.5, cursor: 'not-allowed' }}
            >
              Manage Payment Methods
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Quick Actions */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3
            style={{
              fontSize: '1rem',
              fontWeight: 700,
              color: '#0f172a',
              marginBottom: '1rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Quick Actions
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Link
              href="/health/plans"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.875rem 1rem',
                background: '#f8fafc',
                borderRadius: '10px',
                textDecoration: 'none',
                color: '#0f172a',
                fontWeight: 500,
                transition: 'all 0.2s',
              }}
            >
              <HeartPulse size={18} color="#0066CC" />
              Browse Plans
              <ChevronRight size={16} color="#94a3b8" style={{ marginLeft: 'auto' }} />
            </Link>
            <Link
              href="/health/how-it-works"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.875rem 1rem',
                background: '#f8fafc',
                borderRadius: '10px',
                textDecoration: 'none',
                color: '#0f172a',
                fontWeight: 500,
                transition: 'all 0.2s',
              }}
            >
              <FileText size={18} color="#0066CC" />
              How It Works
              <ChevronRight size={16} color="#94a3b8" style={{ marginLeft: 'auto' }} />
            </Link>
            <Link
              href="/health/compare"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.875rem 1rem',
                background: '#f8fafc',
                borderRadius: '10px',
                textDecoration: 'none',
                color: '#0f172a',
                fontWeight: 500,
                transition: 'all 0.2s',
              }}
            >
              <RefreshCw size={18} color="#0066CC" />
              Compare Plans
              <ChevronRight size={16} color="#94a3b8" style={{ marginLeft: 'auto' }} />
            </Link>
            {/* Tab shortcuts */}
            <button
              onClick={() => onTabChange('provider-search')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.875rem 1rem',
                background: '#f8fafc',
                borderRadius: '10px',
                textDecoration: 'none',
                color: '#0f172a',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                width: '100%',
                textAlign: 'left',
              }}
            >
              <Search size={18} color="#0066CC" />
              Find a Dentist
              <ChevronRight size={16} color="#94a3b8" style={{ marginLeft: 'auto' }} />
            </button>
            <button
              onClick={() => onTabChange('oral-scan')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.875rem 1rem',
                background: '#f8fafc',
                borderRadius: '10px',
                textDecoration: 'none',
                color: '#0f172a',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                width: '100%',
                textAlign: 'left',
              }}
            >
              <Scan size={18} color="#0066CC" />
              Start Oral Scan
              <ChevronRight size={16} color="#94a3b8" style={{ marginLeft: 'auto' }} />
            </button>
            <button
              onClick={() => onTabChange('teledentistry')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.875rem 1rem',
                background: '#f8fafc',
                borderRadius: '10px',
                textDecoration: 'none',
                color: '#0f172a',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                width: '100%',
                textAlign: 'left',
              }}
            >
              <Video size={18} color="#0066CC" />
              Teledentistry
              <ChevronRight size={16} color="#94a3b8" style={{ marginLeft: 'auto' }} />
            </button>
          </div>
        </div>

        {/* Support Card */}
        <div
          className="glass-card"
          style={{
            padding: '1.5rem',
            background: 'linear-gradient(135deg, #0066CC, #0052a3)',
            color: '#fff',
          }}
        >
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            Need Help?
          </h3>
          <p
            style={{
              fontSize: '0.9375rem',
              color: '#0f172a',
              marginBottom: '1.25rem',
              lineHeight: 1.6,
            }}
          >
            Our support team is here to help you with any questions about your plans.
          </p>
          <Link
            href="/contact"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.25rem',
              background: 'rgba(255,255,255,0.15)',
              borderRadius: '10px',
              color: '#fff',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.9375rem',
              border: '1px solid rgba(255,255,255,0.2)',
              backdropFilter: 'blur(8px)',
            }}
          >
            Contact Support
          </Link>
        </div>

        {/* Important Notice */}
        <div
          style={{
            padding: '1.25rem',
            background: '#fef3c7',
            borderRadius: '12px',
            border: '1px solid #fcd34d',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <ShieldCheck size={20} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <span
                style={{
                  fontWeight: 700,
                  color: '#92400e',
                  display: 'block',
                  marginBottom: '0.25rem',
                }}
              >
                Not Insurance
              </span>
              <span style={{ fontSize: '0.8125rem', color: '#92400e', lineHeight: 1.5 }}>
                These plans provide discounts and access to services, not insurance coverage.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
