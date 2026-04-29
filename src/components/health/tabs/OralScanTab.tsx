'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Scan, X } from 'lucide-react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../../../convex/_generated/api';

interface OralScanTabProps {
  userId: string | null;
  onTabChange?: (tabId: 'overview' | 'provider-search' | 'oral-scan' | 'teledentistry') => void;
}

export default function OralScanTab({ userId, onTabChange }: OralScanTabProps) {
  const [scannerActive, setScannerActive] = useState(false);
  // Full scanner URL for the active scan, returned by startScan (server-built)
  const [activeScanUrl, setActiveScanUrl] = useState<string | null>(null);
  const [convexScanId, setConvexScanId] = useState<string | null>(null);
  const [forwardingIds, setForwardingIds] = useState<Set<string>>(new Set());
  const [showMobileOverlay, setShowMobileOverlay] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isStartingScan, setIsStartingScan] = useState(false);
  // When viewing a completed report in the overlay, we store its reportUrl here
  const [overlayUrl, setOverlayUrl] = useState<string | null>(null);
  const [overlayIsResume, setOverlayIsResume] = useState(false);
  // True when the confirm-on-close modal is visible (during active scan)
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Convex queries — server derives the caller from auth; gate on userId to
  // avoid firing until Clerk is ready.
  const toothlensUser = useQuery(
    api.healthplans.toothlens.getToothlensUser,
    userId ? {} : "skip"
  );
  const scanHistory = useQuery(
    api.healthplans.toothlens.getScanHistory,
    userId ? {} : "skip"
  ) ?? [];

  // Convex mutations & actions
  const getOrCreateUser = useAction(api.healthplans.toothlens.getOrCreateToothlensUser);
  const startScanMut = useMutation(api.healthplans.toothlens.startScan);
  const markScanCompletedMut = useMutation(api.healthplans.toothlens.markScanCompleted);
  const markScanAbandonedMut = useMutation(api.healthplans.toothlens.markScanAbandoned);
  const forwardToTeledentistMut = useMutation(api.healthplans.toothlens.forwardToTeledentist);
  const storeReportUrlMut = useMutation(api.healthplans.toothlens.storeReportUrl);

  // Stable ref so the postMessage handler always reads the current convexScanId
  // without needing to re-register the listener on every scan state change.
  const convexScanIdRef = useRef<string | null>(null);
  useEffect(() => { convexScanIdRef.current = convexScanId; }, [convexScanId]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

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
   * Listen for postMessage events from the Toothlens iframe.
   * Toothlens may emit events such as:
   *   { type: 'scan_completed', reportUrl?: string }
   *   { type: 'report_ready',   reportUrl?: string }
   *   { type: 'report_downloaded', reportUrl?: string }
   * We trust only messages originating from selfcheck.toothlens.com.
   *
   * ⚠️  CRITICAL — Downloading scan reports is a CORE product feature.
   * The following must always be true for downloads to work:
   *   1. next.config.ts Permissions-Policy `downloads` directive MUST include
   *      "https://selfcheck.toothlens.com" (not just `self`).
   *   2. next.config.ts CSP `frame-src` MUST include selfcheck.toothlens.com.
   * If either is removed, Chromium silently blocks iframe downloads.
   * See: v0.9.9 regression (2026-04-22) for history.
   */
  useEffect(() => {
    const TOOTHLENS_ORIGIN = 'https://selfcheck.toothlens.com';

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== TOOTHLENS_ORIGIN) return;

      let data: Record<string, unknown>;
      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }

      const type = data?.type as string | undefined;
      const reportUrl = data?.reportUrl as string | undefined;

      const isCompletionEvent =
        type === 'scan_completed' ||
        type === 'report_ready' ||
        type === 'report_downloaded';

      if (!isCompletionEvent) return;

      // Auto-complete the active scan
      if (convexScanId) {
        markScanCompletedMut({ scanId: convexScanId as any, completed: true }).catch(() => {});
        if (reportUrl) {
          storeReportUrlMut({ scanId: convexScanId as any, reportUrl }).catch(() => {});
        }
      }

      // Close overlays — scan is done or report was captured
      setScannerActive(false);
      setActiveScanUrl(null);
      setConvexScanId(null);
      setShowMobileOverlay(false);
      setOverlayUrl(null);
      setOverlayIsResume(false);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [convexScanId, markScanCompletedMut, storeReportUrlMut]);

  /**
   * Ensure the user is registered with Toothlens. Safe to call multiple times —
   * the server returns the existing record when already registered.
   */
  const ensureToothlensUser = useCallback(async (): Promise<void> => {
    if (toothlensUser) return; // already registered
    setIsRegistering(true);
    try {
      await getOrCreateUser({});
    } finally {
      setIsRegistering(false);
    }
  }, [toothlensUser, getOrCreateUser]);

  const openScan = useCallback(async () => {
    if (!userId || isStartingScan) return;
    setIsStartingScan(true);
    try {
      await ensureToothlensUser();
      // Server creates the scan row and returns the authoritative URL.
      // Only enable the iframe/QR after the DB row exists (no race).
      const result = await startScanMut({});
      setConvexScanId(result.scanId);
      setActiveScanUrl(result.scanUrl);
      setScannerActive(true);
    } catch (err) {
      console.error('[OralScan] Failed to start scan:', err);
    } finally {
      setIsStartingScan(false);
    }
  }, [userId, isStartingScan, ensureToothlensUser, startScanMut]);

  /** Mark the active scan complete and close all scan UI. */
  const completeScan = useCallback(() => {
    if (convexScanId) {
      markScanCompletedMut({ scanId: convexScanId as any, completed: true }).catch(() => {});
    }
    setScannerActive(false);
    setActiveScanUrl(null);
    setConvexScanId(null);
    setShowMobileOverlay(false);
    setShowConfirmModal(false);
  }, [convexScanId, markScanCompletedMut]);

  /** Mark the active scan abandoned (user closed without completing) and clear all scan UI. */
  const abandonScan = useCallback(() => {
    if (convexScanId) {
      markScanAbandonedMut({ scanId: convexScanId as any }).catch(() => {});
    }
    setScannerActive(false);
    setActiveScanUrl(null);
    setConvexScanId(null);
    setShowMobileOverlay(false);
    setShowConfirmModal(false);
  }, [convexScanId, markScanAbandonedMut]);

  /** Open a completed scan's stored reportUrl in the overlay (read-only). */
  const openStoredReport = useCallback((reportUrl: string) => {
    setOverlayUrl(reportUrl);
    setShowMobileOverlay(true);
  }, []);

  /** Close the report-view overlay. */
  const closeReportOverlay = useCallback(() => {
    setShowMobileOverlay(false);
    setOverlayUrl(null);
  }, []);

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

  // URL for the scanner iframe / QR code — always set server-side.
  const getScanUrl = useCallback(() => activeScanUrl ?? '', [activeScanUrl]);

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
              onClick={() => setShowConfirmModal(true)}
              aria-label="Close scan"
              style={{
                background: 'rgba(0,0,0,0.06)',
                border: 'none',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#64748b',
                flexShrink: 0,
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* QR code + instructions */}
          <div
            className="dashboard-scan-grid"
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
              background: '#fff',
              overflow: 'hidden',
              contain: 'layout size style',
            }}
          >
            {/* Chromeless iframe — fills the full viewport */}
            <iframe
              key={overlayUrl ?? activeScanUrl ?? 'mobile-overlay'}
              src={overlayUrl ?? getScanUrl()}
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
              allow="camera; microphone; accelerometer; gyroscope; clipboard-write; downloads; fullscreen"
              referrerPolicy="origin-when-cross-origin"
              title={overlayUrl ? 'SmileScan Report' : 'AI Oral Scanning SmileScan — Mobile'}
            />

            {/* Floating close button — safe-area aware for iOS notch */}
            <button
              onClick={() => overlayUrl ? closeReportOverlay() : setShowConfirmModal(true)}
              aria-label="Close"
              style={{
                position: 'absolute',
                top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
                right: '12px',
                zIndex: 10000,
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'rgba(15, 23, 42, 0.55)',
                border: '1px solid rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
              }}
            >
              <X size={18} color="#fff" />
            </button>

            {/* Confirm-on-close modal — only during active scans (not report view) */}
            {showConfirmModal && !overlayUrl && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 10001,
                  background: 'rgba(0, 0, 0, 0.55)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '1.5rem',
                }}
              >
                <div
                  style={{
                    background: '#fff',
                    borderRadius: '20px',
                    padding: '2rem',
                    maxWidth: '380px',
                    width: '100%',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🦷</div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.5rem 0' }}>
                    Did you finish your scan?
                  </h3>
                  <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.75rem', lineHeight: 1.6, margin: '0 0 1.75rem 0' }}>
                    If you&apos;re still scanning, go back and finish. Once complete, tap &ldquo;Yes, I&apos;m done&rdquo; to save your results.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <button
                      onClick={() => setShowConfirmModal(false)}
                      style={{
                        background: 'linear-gradient(135deg, #2ECC71, #27AE60)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '0.875rem',
                        fontWeight: 700,
                        fontSize: '1rem',
                        cursor: 'pointer',
                      }}
                    >
                      Not yet — keep scanning
                    </button>
                    <button
                      onClick={completeScan}
                      style={{
                        background: '#f1f5f9',
                        color: '#0f172a',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '0.875rem',
                        fontWeight: 600,
                        fontSize: '0.9375rem',
                        cursor: 'pointer',
                      }}
                    >
                      Yes, I&apos;m done — save my results
                    </button>
                    <button
                      onClick={abandonScan}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#94a3b8',
                        fontSize: '0.8125rem',
                        cursor: 'pointer',
                        padding: '0.25rem',
                        textDecoration: 'underline',
                      }}
                    >
                      Cancel scan
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>,
          document.body
        )}

      {/* Confirm modal portal — for desktop inline card (when overlay is not open) */}
      {isMounted && showConfirmModal && !showMobileOverlay && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '20px',
              padding: '2rem',
              maxWidth: '380px',
              width: '100%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🦷</div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.5rem 0' }}>
              Did you finish your scan?
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '0 0 1.75rem 0', lineHeight: 1.6 }}>
              If you&apos;re still scanning on your phone, go back and finish. Once complete, tap &ldquo;Yes, I&apos;m done&rdquo; to save your results.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                onClick={() => setShowConfirmModal(false)}
                style={{
                  background: 'linear-gradient(135deg, #2ECC71, #27AE60)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '0.875rem',
                  fontWeight: 700,
                  fontSize: '1rem',
                  cursor: 'pointer',
                }}
              >
                Not yet — keep scanning
              </button>
              <button
                onClick={completeScan}
                style={{
                  background: '#f1f5f9',
                  color: '#0f172a',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '0.875rem',
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  cursor: 'pointer',
                }}
              >
                Yes, I&apos;m done — save my results
              </button>
              <button
                onClick={abandonScan}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  textDecoration: 'underline',
                }}
              >
                Cancel scan
              </button>
            </div>
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
              disabled={isRegistering || isStartingScan}
              className="button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: (isRegistering || isStartingScan) ? '#94a3b8' : '#2ECC71',
                color: '#fff',
                padding: '0.75rem 1.5rem',
                borderRadius: '10px',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.9375rem',
                cursor: (isRegistering || isStartingScan) ? 'default' : 'pointer',
              }}
            >
              <Scan size={18} />
              {isRegistering ? 'Setting up…' : isStartingScan ? 'Starting…' : 'Start Free SmileScan'}
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
              disabled={isRegistering || isStartingScan}
              className="button button--primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                border: 'none',
                cursor: (isRegistering || isStartingScan) ? 'default' : 'pointer',
              }}
            >
              <Scan size={18} />
              {isRegistering ? 'Setting up…' : isStartingScan ? 'Starting…' : 'Start SmileScan'}
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
        <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1rem' }}>
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
                  : scan.status === 'abandoned'
                  ? { bg: '#fef3c7', text: '#92400e', label: 'Not Completed' }
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
                    {/* View Report — only shown when a stored reportUrl exists */}
                    {scan.status === 'completed' && scan.reportUrl && (
                      <button
                        onClick={() => openStoredReport(scan.reportUrl!)}
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
                    {/* Start New Scan for unfinished entries */}
                    {(scan.status === 'started' || scan.status === 'abandoned') && !scannerActive && (
                      <button
                        onClick={openScan}
                        disabled={isStartingScan}
                        style={{
                          padding: '0.5rem 0.875rem',
                          background: isStartingScan ? '#f1f5f9' : '#f59e0b',
                          color: isStartingScan ? '#94a3b8' : '#fff',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: isStartingScan ? 'default' : 'pointer',
                        }}
                      >
                        {isStartingScan ? 'Starting…' : 'Start New Scan'}
                      </button>
                    )}
                    {scan.status === 'completed' && scan.reportUrl && (
                      <a
                        href={scan.reportUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        style={{
                          padding: '0.5rem 0.875rem',
                          background: '#0f172a',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                        }}
                      >
                        ↓ Download PDF
                      </a>
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
