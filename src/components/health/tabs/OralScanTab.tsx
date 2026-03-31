'use client';

import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Scan } from 'lucide-react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../../../convex/_generated/api';

interface OralScanTabProps {
  userId: string | null;
  onTabChange?: (tabId: 'overview' | 'provider-search' | 'oral-scan' | 'teledentistry') => void;
}

export default function OralScanTab({ userId, onTabChange }: OralScanTabProps) {
  const [scannerActive, setScannerActive] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [convexScanId, setConvexScanId] = useState<string | null>(null);
  const [forwardingIds, setForwardingIds] = useState<Set<string>>(new Set());
  const [showMobileOverlay, setShowMobileOverlay] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [toothlensUid, setToothlensUid] = useState<string | null>(null);
  const [scanBaseUrl, setScanBaseUrl] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  // Convex queries
  const toothlensUser = useQuery(
    api.healthplans.toothlens.getToothlensUser,
    userId ? { clerkUserId: userId } : "skip"
  );
  const scanHistory = useQuery(
    api.healthplans.toothlens.getScanHistory,
    userId ? { clerkUserId: userId } : "skip"
  ) ?? [];

  // Convex mutations & actions
  const getOrCreateUser = useAction(api.healthplans.toothlens.getOrCreateToothlensUser);
  const recordScanStartedMut = useMutation(api.healthplans.toothlens.recordScanStarted);
  const markScanCompletedMut = useMutation(api.healthplans.toothlens.markScanCompleted);
  const forwardToTeledentistMut = useMutation(api.healthplans.toothlens.forwardToTeledentist);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Sync existing Toothlens user from DB
  useEffect(() => {
    if (toothlensUser) {
      setToothlensUid(toothlensUser.toothlensUid);
    }
  }, [toothlensUser]);

  // Lock body scroll when mobile overlay is open
  useEffect(() => {
    if (!showMobileOverlay) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const prevHtml = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [showMobileOverlay]);

  /**
   * Ensure the user is registered with Toothlens/RyzeHealth.
   * Returns the UID and base URL for the scanner.
   */
  const ensureToothlensUser = useCallback(async (): Promise<{ uid: string; scanBaseUrl: string }> => {
    // Already cached in state
    if (toothlensUid && scanBaseUrl) {
      return { uid: toothlensUid, scanBaseUrl };
    }
    // Already in DB
    if (toothlensUser) {
      const company = toothlensUser.company || 'ryzehealth';
      const url = `https://selfcheck.toothlens.com/ai/${company}`;
      setScanBaseUrl(url);
      return { uid: toothlensUser.toothlensUid, scanBaseUrl: url };
    }
    // Call the action to register with the API
    setIsRegistering(true);
    try {
      const result = await getOrCreateUser({});
      setToothlensUid(result.uid);
      setScanBaseUrl(result.scanBaseUrl);
      return result;
    } finally {
      setIsRegistering(false);
    }
  }, [toothlensUid, scanBaseUrl, toothlensUser, getOrCreateUser]);

  const openScan = useCallback(async () => {
    if (!userId) return;
    try {
      const { uid, scanBaseUrl: baseUrl } = await ensureToothlensUser();
      const newSessionId = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
      setSessionId(newSessionId);
      setScannerActive(true);

      const scanId = await recordScanStartedMut({
        clerkUserId: userId,
        toothlensUid: uid,
        sessionId: newSessionId,
        scanUrl: `${baseUrl}?uid=${encodeURIComponent(uid)}&session_id=${encodeURIComponent(newSessionId)}`,
      });
      setConvexScanId(scanId);
    } catch (err) {
      console.error('[OralScan] Failed to start scan:', err);
    }
  }, [userId, ensureToothlensUser, recordScanStartedMut]);

  const closeScan = useCallback(
    (completed = false) => {
      if (convexScanId) {
        markScanCompletedMut({ scanId: convexScanId as any, completed }).catch(() => {});
      }
      setScannerActive(false);
      setSessionId(null);
      setConvexScanId(null);
    },
    [convexScanId, markScanCompletedMut]
  );

  const handleForwardToTeledentist = useCallback(
    async (scanId: string) => {
      setForwardingIds((prev) => new Set(prev).add(scanId));
      try {
        await forwardToTeledentistMut({ scanId: scanId as any });
        // Navigate to teledentistry tab so user can start a consultation
        if (onTabChange) {
          onTabChange('teledentistry');
        }
      } finally {
        setForwardingIds((prev) => {
          const n = new Set(prev);
          n.delete(scanId);
          return n;
        });
      }
    },
    [forwardToTeledentistMut, onTabChange]
  );

  const buildScanUrl = useCallback((scan: { toothlensUid: string; sessionId: string; scanUrl?: string }) => {
    if (scan.scanUrl) return scan.scanUrl;
    // Reconstruct from uid + sessionId for older records
    const base = scanBaseUrl || 'https://selfcheck.toothlens.com/ai/ryzehealth';
    return `${base}?uid=${encodeURIComponent(scan.toothlensUid)}&session_id=${encodeURIComponent(scan.sessionId)}`;
  }, [scanBaseUrl]);

  // Build the scanner iframe URL
  const getScanUrl = useCallback(() => {
    if (!toothlensUid || !sessionId) return '';
    const base = scanBaseUrl || 'https://selfcheck.toothlens.com/ai/ryzehealth';
    return `${base}?uid=${encodeURIComponent(toothlensUid)}&session_id=${encodeURIComponent(sessionId)}`;
  }, [toothlensUid, sessionId, scanBaseUrl]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* ── INLINE SMILESCAN CARD (shown when user starts a scan) ── */}
      {scannerActive && (
        <div className="glass-card" style={{ padding: '2rem' }}>
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '1rem',
              marginBottom: '2rem',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #1a4731, #1e3a2f)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Scan size={22} color="#2ECC71" />
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  SmileScan Active
                </h3>
                <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
                  Scan the QR code with your phone
                </p>
              </div>
            </div>
            <button
              onClick={() => closeScan(false)}
              style={{
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '0.5rem 1rem',
                cursor: 'pointer',
                color: '#64748b',
                fontWeight: 600,
                fontSize: '0.875rem',
                flexShrink: 0,
              }}
            >
              Close
            </button>
          </div>

          {/* QR code + instructions */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              gap: '2.5rem',
              alignItems: 'start',
            }}
          >
            {/* QR code */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <div
                style={{
                  padding: '1rem',
                  background: '#fff',
                  borderRadius: '16px',
                  border: '2px solid #e2e8f0',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.07)',
                }}
              >
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getScanUrl())}&margin=8`}
                  alt="SmileScan QR Code"
                  width={200}
                  height={200}
                  style={{ display: 'block', borderRadius: '4px' }}
                />
              </div>
              <button
                onClick={() => setShowMobileOverlay(true)}
                style={{
                color: '#2ECC71',
                textDecoration: 'underline',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                }}
              >
                On mobile? Tap here to open directly
              </button>
            </div>

            {/* Step-by-step instructions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {[
                {
                  step: '1',
                  icon: '→',
                  title: 'Open your phone camera',
                  desc: 'Point your camera at the QR code. On Android, open the Camera app or Google Lens.',
                },
                {
                  step: '2',
                  icon: '✓',
                  title: 'Scan the QR code',
                  desc: 'Hold your phone steady until a link notification appears. Tap to open the AI Oral Scanning app.',
                },
                {
                  step: '3',
                  icon: '○',
                  title: 'Capture dental photos',
                  desc: 'Follow the on-screen guide to capture your front, upper, lower, left, and right teeth.',
                },
                {
                  step: '4',
                  icon: '⚙',
                  title: 'Receive your analysis report',
                  desc: 'The system analyzes your photos and generates a complete SmileScan report with your oral health assessment.',
                },
              ].map(({ step, icon, title, desc }) => (
                <div key={step} style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ fontSize: '1.5rem', flexShrink: 0 }}>{icon}</div>
                  <div>
                    <div
                      style={{
                        display: 'inline-block',
                        padding: '0.2rem 0.6rem',
                      background: '#f0fdf4',
                      color: '#15803d',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        marginBottom: '0.25rem',
                      }}
                    >
                      Step {step}
                    </div>
                    <h4 style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem', fontSize: '0.9375rem' }}>
                      {title}
                    </h4>
                    <p style={{ fontSize: '0.875rem', color: '#64748b', lineHeight: 1.6, margin: 0 }}>
                      {desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Completion footer */}
          <div
            style={{
              marginTop: '2rem',
              paddingTop: '1.5rem',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '1.5rem',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: 1, minWidth: '180px' }}>
              <p style={{ fontWeight: 600, color: '#0f172a', margin: '0 0 0.25rem 0' }}>
                Finished your scan on your phone?
              </p>
              <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0 }}>
                Tap below to save your session. You can then forward your results to a teledentist.
              </p>
            </div>
            <button
              onClick={() => closeScan(true)}
              style={{
                background: 'linear-gradient(135deg, #2ECC71, #27AE60)',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                padding: '0.75rem 1.5rem',
                fontWeight: 700,
                fontSize: '0.9375rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                whiteSpace: 'nowrap',
              }}
            >
              ✓ I&rsquo;ve Completed My Scan
            </button>
          </div>
        </div>
      )}

      {/* ── Mobile overlay — rendered via portal ── */}
      {isMounted &&
        showMobileOverlay &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100dvh',
              zIndex: 9999,
              display: 'flex',
              flexDirection: 'column',
              background: '#000',
              overflow: 'hidden',
              contain: 'layout size style',
            }}
          >
            {/* Header bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.5rem 1rem',
                background: '#0f172a',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                flexShrink: 0,
                minHeight: '44px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                <Scan size={18} color="#2ECC71" style={{ flexShrink: 0 }} />
                <span
                  style={{
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  SmileScan
                </span>
              </div>
              <button
                onClick={() => setShowMobileOverlay(false)}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: 'pointer',
                  padding: '0.35rem 0.75rem',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  flexShrink: 0,
                }}
              >
                ✕ Close
              </button>
            </div>

            {/* Iframe */}
            <div style={{ flex: 1, overflow: 'hidden', position: 'relative', width: '100%' }}>
              <iframe
                key={sessionId ?? 'mobile-overlay'}
                src={getScanUrl()}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  background: '#fff',
                  display: 'block',
                }}
                allow="camera; microphone; accelerometer; gyroscope; clipboard-write"
                referrerPolicy="origin"
                title="AI Oral Scanning SmileScan — Mobile"
              />
            </div>

            {/* Done bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.5rem 1rem',
                background: '#f8fafc',
                borderTop: '1px solid #e2e8f0',
                flexShrink: 0,
                minHeight: '44px',
              }}
            >
              <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>Finished your scan?</span>
              <button
                onClick={() => {
                  setShowMobileOverlay(false);
                  closeScan(true);
                }}
                style={{
                  background: 'linear-gradient(135deg, #16a34a, #15803d)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '0.5rem 1rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                  flexShrink: 0,
                }}
              >
                Done
              </button>
            </div>
          </div>,
          document.body
        )}

      {/* ── Landing content — hidden while scanner is active ── */}
      {!scannerActive && (
        <>
          <div
            className="glass-card"
            style={{
              padding: '2rem',
              background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
              color: '#14532d',
              overflow: 'hidden',
              position: 'relative',
              border: '1px solid #86efac',
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
                background: 'radial-gradient(circle, rgba(46,204,113,0.2), transparent 70%)',
                pointerEvents: 'none',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'rgba(22,163,74,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Scan size={24} color="#2ECC71" />
              </div>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem', color: '#14532d' }}>
                  AI-Powered Oral Scan
                </h2>
                <p style={{ color: '#166534', fontSize: '0.9375rem', opacity: 0.8 }}>AI Oral Scanning SmileScan Technology</p>
              </div>
            </div>
            <p style={{ color: '#166534', lineHeight: 1.7, marginBottom: '1.5rem', maxWidth: '600px' }}>
              Start a SmileScan. Take a few photos and let our AI give you a detailed report in minutes — highlighting
              concerns, tartar buildup, gum health, and alignment issues, helping you catch problems early and stay
              healthy.
            </p>
            <button
              onClick={openScan}
              disabled={isRegistering}
              className="button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: isRegistering ? '#94a3b8' : '#2ECC71',
                color: '#fff',
                padding: '0.75rem 1.5rem',
                borderRadius: '10px',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.9375rem',
                cursor: isRegistering ? 'default' : 'pointer',
              }}
            >
              <Scan size={18} />
              {isRegistering ? 'Setting up…' : 'Start Free SmileScan'}
            </button>
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
              alt="AI Oral Scanning SmileScan"
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
                  icon: '↑',
                  step: '1',
                  title: 'Capture Five Photos',
                  desc: 'Follow the step-by-step instructions and use your phone to take five photos of your mouth from different angles.',
                },
                {
                  icon: '→',
                  step: '2',
                  title: 'Instant AI Analysis',
                  desc: 'Our AI analyzes your photos to create a SmileScan Report with an overall oral health score and areas of concern.',
                },
                {
                  icon: '👤',
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
                      background: 'linear-gradient(135deg, #2ECC71, #27AE60)',
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
              {['Tartar Buildup', 'Gum Health', 'Tooth Alignment', 'Cavity Risk Areas', 'Plaque Presence', 'Early Decay Signs'].map(
                (item) => (
                  <div
                    key={item}
                    style={{
                      padding: '0.875rem',
                      background: '#f0fdf4',
                      borderRadius: '10px',
                      border: '1px solid #bbf7d0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: '#15803d',
                    }}
                  >
                    {item}
                  </div>
                )
              )}
            </div>
          </div>

          {/* CTA */}
          <div
            style={{
              textAlign: 'center',
              padding: '2.5rem',
              background: 'linear-gradient(135deg, #f8fafc, #f0fdf4)',
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
              Ready to check your oral health?
            </h3>
            <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
              Your SmileScan is free and requires only a few minutes on your phone. A QR code will appear — scan it
              to start capturing photos.
            </p>
            <button
              onClick={openScan}
              disabled={isRegistering}
              className="button button--primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                border: 'none',
                cursor: isRegistering ? 'default' : 'pointer',
              }}
            >
              <Scan size={18} />
              {isRegistering ? 'Setting up…' : 'Start SmileScan'}
            </button>
          </div>
        </>
      )}

      {/* ── SCAN HISTORY ── */}
      <div className="glass-card" style={{ padding: '2rem' }}>
        <h3
          style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: '#0f172a',
            marginBottom: '0.25rem',
          }}
        >
          Your Scan History
        </h3>
        <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          Every SmileScan you start is logged here. Completed scans can be forwarded to a teledentist when
          you&apos;re ready for a virtual consultation.
        </p>

        {scanHistory === undefined && <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Loading scan history…</p>}

        {scanHistory !== undefined && scanHistory.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '2rem',
              background: '#f8fafc',
              borderRadius: '12px',
              border: '1px dashed #cbd5e1',
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🦷</div>
            <p style={{ color: '#64748b', margin: 0 }}>No scans yet. Start your first SmileScan above.</p>
          </div>
        )}

        {scanHistory && scanHistory.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {scanHistory.map((scan) => {
              const date = new Date(scan.startedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });
              const time = new Date(scan.startedAt).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              });

              const statusColor =
                scan.status === 'completed'
                  ? { bg: '#dcfce7', text: '#166534', label: 'Completed' }
                  : scan.status === 'cancelled'
                  ? { bg: '#fef3c7', text: '#92400e', label: 'Cancelled' }
                  : { bg: '#dbeafe', text: '#1e40af', label: 'In Progress' };

              return (
                <div
                  key={scan._id}
                  style={{
                    padding: '1rem',
                    background: '#f8fafc',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: '200px' }}>
                    <Scan size={18} color="#2ECC71" />
                    <div style={{ minWidth: 0 }}>
                      <p
                        style={{
                          fontWeight: 600,
                          color: '#0f172a',
                          margin: '0 0 0.25rem 0',
                          fontSize: '0.9375rem',
                        }}
                      >
                        SmileScan
                      </p>
                      <p style={{ color: '#64748b', fontSize: '0.8125rem', margin: 0 }}>
                        {date} at {time}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        padding: '0.25rem 0.75rem',
                        background: statusColor.bg,
                        color: statusColor.text,
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}
                    >
                      {statusColor.label}
                    </span>
                    {scan.status === 'completed' && (
                      <button
                        onClick={() => window.open(buildScanUrl(scan), '_blank', 'noopener,noreferrer')}
                        style={{
                          padding: '0.5rem 0.875rem',
                          background: '#3b82f6',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        View Report
                      </button>
                    )}
                    {scan.status === 'completed' && !scan.forwardedToTeledentist && (
                      <button
                        onClick={() => handleForwardToTeledentist(scan._id as string)}
                        disabled={forwardingIds.has(scan._id as string)}
                        style={{
                          padding: '0.5rem 0.875rem',
                          background: forwardingIds.has(scan._id as string) ? '#f1f5f9' : '#2ECC71',
                          color: forwardingIds.has(scan._id as string) ? '#94a3b8' : '#fff',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: forwardingIds.has(scan._id as string) ? 'default' : 'pointer',
                        }}
                      >
                        {forwardingIds.has(scan._id as string) ? 'Forwarding…' : 'Forward to Dentist'}
                      </button>
                    )}
                    {scan.status === 'completed' && scan.forwardedToTeledentist && (
                      <span
                        style={{
                          padding: '0.25rem 0.75rem',
                          background: '#ede9fe',
                          color: '#6d28d9',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                        }}
                      >
                        Forwarded ✓
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
