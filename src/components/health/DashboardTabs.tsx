'use client';

import { useState, Suspense, lazy } from 'react';
import React from 'react';
import { HeartPulse, Scan, Search, Video } from 'lucide-react';
import OverviewTab from './tabs/OverviewTab';

// Lazy load non-critical tabs
const ProviderSearchTab = lazy(() => import('./tabs/ProviderSearchTab'));
const OralScanTab = lazy(() => import('./tabs/OralScanTab'));
const TeledentistryTab = lazy(() => import('./tabs/TeledentistryTab'));

interface Subscription {
  id: string;
  name: string;
  category: string;
  price: number;
  cadence: string;
  renewDate: string;
  status: string;
}

interface DashboardTabsProps {
  firstName: string | null;
  email: string | null;
  fullName: string | null;
  memberSince: string | null;
  hasSubscriptions: boolean;
  subscriptions: Subscription[];
  userId: string | null;
  memberCardData: {
    memberName: string;
    memberId: string;
    planName: string;
    effectiveDate: string;
    networks: {
      careington: { name: string; memberUrl: string };
      dialCare: { name: string; memberUrl: string };
      toothlens: { name: string; memberUrl: string };
    };
    supportPhone: string;
    supportEmail: string;
  } | null;
  isFamily?: boolean;
}

type TabId = 'overview' | 'provider-search' | 'oral-scan' | 'teledentistry';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <HeartPulse size={16} /> },
  { id: 'oral-scan', label: 'Oral Scan', icon: <Scan size={16} /> },
  { id: 'teledentistry', label: 'Teledentistry', icon: <Video size={16} /> },
  { id: 'provider-search', label: 'Provider Search', icon: <Search size={16} /> },
];

/** Suspense fallback for lazy-loaded tabs */
function TabLoadingFallback() {
  return (
    <div
      style={{
        padding: '3rem 2rem',
        textAlign: 'center',
        color: '#94a3b8',
      }}
    >
      <div style={{ marginBottom: '1rem' }}>Loading tab…</div>
    </div>
  );
}

export default function DashboardTabs({
  firstName,
  email,
  fullName,
  memberSince,
  hasSubscriptions,
  subscriptions,
  userId,
  memberCardData,
  isFamily = false,
}: DashboardTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  return (
    <>
      {/* Dashboard Header with Logo */}
      <div
        className="dashboard-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '2rem',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <button
          onClick={() => setActiveTab('overview')}
          style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              flexShrink: 0,
            }}
          >
            <img src="/health-assets/IdealLogo.png" alt="Ideal Health" style={{ width: '100%', height: '100%' }} />
          </div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>Dashboard</h2>
        </button>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>
            Welcome back, {firstName || 'Member'}!
          </p>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: '#64748b' }}>
            Manage your health plans and account settings
          </p>
        </div>
      </div>

      {/* Tab Bar */}
      <div
        className="dashboard-tab-bar"
        style={{
          display: 'flex',
          gap: '0.25rem',
          padding: '0.375rem',
          background: '#f1f5f9',
          borderRadius: '14px',
          marginBottom: '2rem',
          flexWrap: 'wrap',
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: '1 1 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.625rem 1rem',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
              background: activeTab === tab.id ? '#fff' : 'transparent',
              color: activeTab === tab.id ? '#0066CC' : '#64748b',
              boxShadow:
                activeTab === tab.id
                  ? '0 1px 4px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,102,204,0.08)'
                  : 'none',
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content with Suspense */}
      <Suspense fallback={<TabLoadingFallback />}>
        {activeTab === 'overview' && (
          <OverviewTab
            firstName={firstName}
            email={email}
            fullName={fullName}
            memberSince={memberSince}
            hasSubscriptions={hasSubscriptions}
            subscriptions={subscriptions}
            onTabChange={setActiveTab}
            isFamily={isFamily}
          />
        )}

        {activeTab === 'provider-search' && <ProviderSearchTab onClose={() => setActiveTab('overview')} />}

        {activeTab === 'oral-scan' && <OralScanTab userId={userId} onTabChange={setActiveTab} />}

        {activeTab === 'teledentistry' && (
          <TeledentistryTab
            memberId={memberCardData?.memberId ?? null}
            firstName={firstName}
            fullName={fullName}
          />
        )}
      </Suspense>
    </>
  );
}
