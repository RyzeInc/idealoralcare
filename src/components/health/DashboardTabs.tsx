'use client';

import { useState, Suspense, lazy } from 'react';
import React from 'react';
import { HeartPulse, Scan, Search } from 'lucide-react';
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
}

type TabId = 'overview' | 'provider-search' | 'oral-scan' | 'teledentistry';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <HeartPulse size={16} /> },
  { id: 'oral-scan', label: 'Oral Scan', icon: <Scan size={16} /> },
  { id: 'provider-search', label: 'Provider Search', icon: <Search size={16} /> },
  // { id: 'teledentistry', label: 'Teledentistry', icon: <Video size={16} /> }, // TODO: Enable when vendor integration ready
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
}: DashboardTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  return (
    <>
      {/* Tab Bar */}
      <div
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
          />
        )}

        {activeTab === 'provider-search' && <ProviderSearchTab onClose={() => setActiveTab('overview')} />}

        {activeTab === 'oral-scan' && <OralScanTab userId={userId} />}

        {activeTab === 'teledentistry' && <TeledentistryTab />}
      </Suspense>
    </>
  );
}
