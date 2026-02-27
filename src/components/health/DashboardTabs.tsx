'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  CreditCard,
  Settings,
  FileText,
  HeartPulse,
  ShieldCheck,
  ChevronRight,
  Clock,
  RefreshCw,
  Search,
  Scan,
  Video,
} from 'lucide-react';

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
}

type TabId = 'overview' | 'provider-search' | 'oral-scan' | 'teledentistry';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <HeartPulse size={16} /> },
  { id: 'oral-scan', label: 'Oral Scan', icon: <Scan size={16} /> },
  { id: 'teledentistry', label: 'Teledentistry', icon: <Video size={16} /> },
  { id: 'provider-search', label: 'Provider Search', icon: <Search size={16} /> },
];

export default function DashboardTabs({
  firstName,
  email,
  fullName,
  memberSince,
  hasSubscriptions,
  subscriptions,
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

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
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
                          <Clock size={14} />
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
                  onClick={() => setActiveTab('provider-search')}
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
                  onClick={() => setActiveTab('oral-scan')}
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
                  onClick={() => setActiveTab('teledentistry')}
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
                  opacity: 0.9,
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
      )}

      {/* ── PROVIDER SEARCH TAB ── */}
      {activeTab === 'provider-search' && (
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
                position: 'absolute', top: '-60px', right: '-60px',
                width: '220px', height: '220px', borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(255,255,255,0.12), transparent 70%)',
                pointerEvents: 'none',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '12px',
                background: 'rgba(255,255,255,0.18)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Search size={24} color="#fff" />
              </div>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.2rem' }}>Find a Dentist</h2>
                <p style={{ opacity: 0.8, fontSize: '0.9rem', margin: 0 }}>
                  Powered by Careington International · 50,000+ participating providers nationwide
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
              {['Save 20%–50%', 'Unlimited Cleanings', 'No Waiting Period', 'Ortho Included'].map((b) => (
                <span key={b} style={{
                  padding: '0.3rem 0.75rem',
                  background: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  borderRadius: '9999px', fontSize: '0.78125rem', fontWeight: 600,
                }}>
                  {b}
                </span>
              ))}
            </div>
          </div>

          {/* Search Form — posts to Careington results page */}
          <div className="glass-card" style={{ padding: '2rem' }}>
            <h3 style={{
              fontSize: '1.125rem', fontWeight: 700, color: '#0f172a',
              marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.625rem',
            }}>
              <Search size={20} color="#0066CC" />
              Search for a Provider
            </h3>

            {/* Careington's results page accepts GET params — we build the query URL on submit */}
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

                // Build the Careington search URL with our agent code
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
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  marginBottom: '0.875rem',
                }}>
                  <span style={{
                    width: '24px', height: '24px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #0066CC, #0052a3)',
                    color: '#fff', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
                  }}>1</span>
                  <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9375rem' }}>
                    What type of provider are you looking for?
                  </span>
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '1rem',
                }}>
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
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  marginBottom: '0.875rem',
                }}>
                  <span style={{
                    width: '24px', height: '24px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #0066CC, #0052a3)',
                    color: '#fff', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
                  }}>2</span>
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
                      {['AK','AL','AR','AZ','CA','CO','CT','DC','DE','FL','GA','HI','IA','ID','IL','IN',
                        'KS','KY','LA','MA','MD','ME','MI','MN','MO','MS','MT','NC','ND','NE','NH',
                        'NJ','NM','NV','NY','OH','OK','OR','PA','PR','RI','SC','SD','TN','TX','UT',
                        'VA','VI','VT','WA','WI','WV','WY'].map((s) => (
                        <option key={s} value={s}>{s}</option>
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
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  marginBottom: '0.875rem',
                }}>
                  <span style={{
                    width: '24px', height: '24px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #0066CC, #0052a3)',
                    color: '#fff', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
                  }}>3</span>
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
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
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
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                paddingTop: '0.5rem', flexWrap: 'wrap', gap: '1rem',
              }}>
                <p style={{ fontSize: '0.8125rem', color: '#94a3b8', margin: 0, maxWidth: '500px' }}>
                  When contacting a provider, identify yourself as a member of the Careington network.
                  Results will open in a new tab.
                </p>
                <button
                  type="submit"
                  className="button button--primary"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.75rem 1.75rem', fontSize: '1rem', fontWeight: 700,
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
          <div style={{
            padding: '1.25rem 1.5rem',
            background: '#f8fafc',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            fontSize: '0.78125rem',
            color: '#94a3b8',
            lineHeight: 1.6,
          }}>
            <strong style={{ color: '#64748b' }}>THIS PLAN IS NOT INSURANCE</strong> and is not
            intended to replace health insurance. This plan does not meet the minimum creditable
            coverage requirements under M.G.L. c.111M and 956 CMR 5.00. This plan is not a
            Qualified Health Plan under the Affordable Care Act. The range of discounts will vary
            depending on the type of provider and service. The plan does not pay providers directly.
            Plan members must pay for all services but will receive a discount from participating
            providers. Discount Plan Organization and administrator: Careington International
            Corporation, 7400 Gaylord Parkway, Frisco, TX 75034; phone 800-441-0380. This plan is
            not available in Vermont or Washington.{' '}
            <a href="https://www1.careington.com/help/privacy-statement/" target="_blank" rel="noopener noreferrer" style={{ color: '#0066CC' }}>Privacy Policy</a>
            {' '}|{' '}
            <a href="https://www1.careington.com/help/terms-of-use" target="_blank" rel="noopener noreferrer" style={{ color: '#0066CC' }}>Terms of Use</a>
          </div>
        </div>
      )}

      {/* ── ORAL SCAN TAB ── */}
      {activeTab === 'oral-scan' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Hero */}
          <div
            className="glass-card"
            style={{
              padding: '2rem',
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
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
                background: 'radial-gradient(circle, rgba(0,102,204,0.3), transparent 70%)',
                pointerEvents: 'none',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'rgba(0,102,204,0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Scan size={24} color="#60a5fa" />
              </div>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                  AI-Powered Oral Scan
                </h2>
                <p style={{ opacity: 0.75, fontSize: '0.9375rem' }}>
                  Toothlens SmileScan Technology
                </p>
              </div>
            </div>
            <p style={{ opacity: 0.9, lineHeight: 1.7, marginBottom: '1.5rem', maxWidth: '600px' }}>
              Start a SmileScan. Take a few photos and let our AI give you a detailed report in
              minutes — highlighting concerns, tartar buildup, gum health, and alignment issues,
              helping you catch problems early and stay healthy.
            </p>
            <a
              href="#"
              className="button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: '#0066CC',
                color: '#fff',
                padding: '0.75rem 1.5rem',
                borderRadius: '10px',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '0.9375rem',
              }}
            >
              <Scan size={18} />
              Start Free SmileScan
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
              background: '#0f172a',
              maxHeight: '380px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src="/health-assets/toothlensscan_1086x1024.png"
              alt="Toothlens AI SmileScan"
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
                  icon: '📸',
                  step: '1',
                  title: 'Take 5 Photos',
                  desc: 'Follow the step-by-step instructions and use your phone to take five photos of your mouth from different angles.',
                },
                {
                  icon: '🤖',
                  step: '2',
                  title: 'Instant AI Analysis',
                  desc: 'Our AI analyzes your photos to create a SmileScan Report with an overall oral health score and areas of concern.',
                },
                {
                  icon: '👨‍⚕️',
                  step: '3',
                  title: 'Review with a Dentist',
                  desc: 'Have questions? Schedule a virtual consultation with one of our dentists directly from your SmileScan Report.',
                },
              ].map(({ icon, step, title, desc }) => (
                <div
                  key={step}
                  style={{
                    padding: '1.5rem',
                    background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
                    borderRadius: '14px',
                    border: '1px solid #e2e8f0',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>{icon}</div>
                  <div
                    style={{
                      display: 'inline-block',
                      padding: '0.2rem 0.6rem',
                      background: 'linear-gradient(135deg, #0066CC, #0052a3)',
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

          {/* What we detect */}
          <div className="glass-card" style={{ padding: '2rem' }}>
            <h3
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: '#0f172a',
                marginBottom: '1.25rem',
              }}
            >
              What the AI Detects
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: '0.75rem',
              }}
            >
              {[
                'Tartar Buildup',
                'Gum Health',
                'Tooth Alignment',
                'Cavity Risk Areas',
                'Plaque Presence',
                'Early Decay Signs',
              ].map((item) => (
                <div
                  key={item}
                  style={{
                    padding: '0.875rem',
                    background: '#f0f9ff',
                    borderRadius: '10px',
                    border: '1px solid #bae6fd',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: '#0369a1',
                  }}
                >
                  <span style={{ fontSize: '1rem' }}>🦷</span>
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div
            style={{
              textAlign: 'center',
              padding: '2.5rem',
              background: 'linear-gradient(135deg, #f8fafc, #eff6ff)',
              borderRadius: '16px',
              border: '1px solid #bfdbfe',
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
              Ready to check your oral health?
            </h3>
            <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
              Your SmileScan is free and takes just a few minutes.
            </p>
            <a
              href="#"
              className="button button--primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Scan size={18} />
              Start SmileScan
            </a>
          </div>
        </div>
      )}

      {/* ── TELEDENTISTRY TAB ── */}
      {activeTab === 'teledentistry' && (
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
                <p style={{ opacity: 0.8, fontSize: '0.9375rem' }}>
                  24/7 Virtual Dental Care
                </p>
              </div>
            </div>
            <p style={{ opacity: 0.9, lineHeight: 1.7, marginBottom: '1.5rem', maxWidth: '600px' }}>
              Connect with licensed dentists anytime, anywhere through secure video consultations.
              Get professional advice, diagnosis, and treatment plans from the comfort of your home.
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
      )}
    </>
  );
}
