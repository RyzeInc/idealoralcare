'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  ChevronRight,
  HeartPulse,
  Settings,
  FileText,
  Search,
  Scan,
  Video,
  ShieldCheck,
  LayoutDashboard,
} from 'lucide-react';
import FamilySection from '../FamilySection';
import MemberIdCard, { type MemberCardData } from '../MemberIdCard';
import HowToUseProgram from '../HowToUseProgram';

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
  memberCardData?: MemberCardData | null;
  isFamily?: boolean;
}

export default function OverviewTab({
  firstName,
  email,
  fullName,
  memberSince,
  hasSubscriptions,
  subscriptions,
  onTabChange,
  memberCardData,
  isFamily = false,
}: OverviewTabProps) {
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  useEffect(() => {
    document.body.style.overflow = showHowItWorks ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showHowItWorks]);

  // Build card data from available props when full profile not yet loaded from Convex
  const cardData: MemberCardData = memberCardData ?? {
    memberName: fullName ?? 'Member',
    memberId: subscriptions[0]?.id?.slice(-9) ?? '—',
    planName: subscriptions[0]?.name ?? 'Ideal Oral Health Plan',
    effectiveDate: subscriptions[0]?.renewDate ?? '—',
    networks: {
      careington: { name: 'Dental Discount Network', memberUrl: 'https://ryse.telemedsimplified.com' },
      dialCare: { name: 'Teledentistry Program', memberUrl: 'https://www.dialcare.com' },
      toothlens: { name: 'AI Oral Scanning', memberUrl: 'https://toothlens.com' },
    },
    supportPhone: '(800) 290-0523',
    supportEmail: 'support@getidealoh.com',
  };

  const handleDownloadCard = () => {
    window.open('/api/member-card-pdf', '_blank');
  };

  const grid = (
    <div
      className="dashboard-overview-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 340px',
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
              Your Membership Card
            </h2>
            <Link
              href="/health/manage-plans"
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
              Manage Plans <ChevronRight size={18} />
            </Link>
          </div>

          {hasSubscriptions ? (
            <MemberIdCard cardData={cardData} onDownload={handleDownloadCard} />
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
                  background: 'linear-gradient(135deg, #2ECC7120, #3498DB20)',
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
              <Link href="/health/manage-plans" className="button button--primary">
                Get Started
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
        <FamilySection isFamily={isFamily} />
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
              href="/health/manage-plans"
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
              <LayoutDashboard size={18} color="#0066CC" />
              Manage Plans
              <ChevronRight size={16} color="#94a3b8" style={{ marginLeft: 'auto' }} />
            </Link>
            <button
              onClick={() => setShowHowItWorks(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.875rem 1rem',
                background: '#f8fafc',
                borderRadius: '10px',
                color: '#0f172a',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                width: '100%',
                textAlign: 'left',
              }}
            >
              <FileText size={18} color="#0066CC" />
              How It Works
              <ChevronRight size={16} color="#94a3b8" style={{ marginLeft: 'auto' }} />
            </button>
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
              <Scan size={18} color="#2ECC71" />
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
              <Video size={18} color="#3498DB" />
              Teledentistry
              <ChevronRight size={16} color="#94a3b8" style={{ marginLeft: 'auto' }} />
            </button>
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
              <Search size={18} color="#F39C12" />
              Find a Dentist
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

  const modal = showHowItWorks
    ? createPortal(
        <div
          onClick={() => setShowHowItWorks(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              background: '#fff',
              borderRadius: '16px',
              width: 'min(90vw, 1200px)',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 60px rgba(0,0,0,0.18)',
            }}
          >
            <button
              onClick={() => setShowHowItWorks(false)}
              aria-label="Close"
              style={{
                position: 'sticky',
                top: '12px',
                float: 'right',
                marginRight: '12px',
                marginTop: '12px',
                zIndex: 10,
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#64748b',
                fontSize: '1.25rem',
                lineHeight: 1,
              }}
            >
              ✕
            </button>
            <HowToUseProgram />
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      {grid}
      {modal}
    </>
  );
}
