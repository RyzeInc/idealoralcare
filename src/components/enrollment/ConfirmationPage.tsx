'use client';

import { useEnrollment } from '@/components/enrollment/EnrollmentProvider';
import { useSiteThemeOptional } from '@/components/providers/SiteThemeProvider';
import { Check, Download, Share2, Home } from 'lucide-react';
import Link from 'next/link';
import styles from './confirmation-page.module.css';

export function ConfirmationPage() {
  const { state } = useEnrollment();
  const siteTheme = useSiteThemeOptional();
  const site = siteTheme?.site || state.site;
  
  const memberProfileId = state.memberProfileId;
  const personalInfo = state.personalInfo;
  const selectedPlans = state.selectedPlans || {};
  const pricing = {
    subtotal: state.subtotal,
    discount: state.discount,
    tax: state.tax,
    total: state.total,
  };

  // Get support contact from site or use defaults
  const supportEmail = site?.enrollmentDefaults?.supportEmail || 'support@idealhealth.com';
  const supportPhone = site?.enrollmentDefaults?.supportPhone || '1-844-IDEAL-01';
  const welcomeMessage = site?.enrollmentDefaults?.welcomeMessage || 'Welcome to Ideal Health';

  // Generate mock barcode content (in production, use JsBarcode library)
  const barcodeContent = memberProfileId || 'MBR-2026-00000';
  const memberId = memberProfileId?.replace('MBR-', '') || '2026-00000';

  return (
    <div className={styles.container}>
      <div className={styles.successCard}>
        {/* Success Header */}
        <div className={styles.headerSection}>
          <div className={styles.checkmark}>
            <Check size={48} />
          </div>
          <h1 className={styles.title}>Enrollment Complete!</h1>
          <p className={styles.subtitle}>
            {welcomeMessage}. Your membership is now active.
          </p>
        </div>

        {/* Member Information */}
        <div className={styles.memberSection}>
          <h2 className={styles.sectionTitle}>Your Member Information</h2>
          <div className={styles.memberCard}>
            <div className={styles.memberField}>
              <span className={styles.label}>Member ID</span>
              <span className={styles.value}>{memberId}</span>
            </div>
            <div className={styles.memberField}>
              <span className={styles.label}>Member Name</span>
              <span className={styles.value}>
                {personalInfo?.firstName} {personalInfo?.lastName}
              </span>
            </div>
            <div className={styles.memberField}>
              <span className={styles.label}>Email</span>
              <span className={styles.value}>{personalInfo?.email}</span>
            </div>
            <div className={styles.barcodeContainer}>
              <p className={styles.barcodeLabel}>Member Barcode</p>
              <div className={styles.barcode}>{barcodeContent}</div>
              <p className={styles.barcodeHint}>
                Present this barcode at participating providers
              </p>
            </div>
          </div>
        </div>

        {/* Plans Enrolled */}
        <div className={styles.plansSection}>
          <h2 className={styles.sectionTitle}>Your Plans</h2>
          <div className={styles.plansList}>
            {Object.entries(selectedPlans || {}).map(([planId, plan]) => {
              if (!plan) return null;
              return (
                <div key={planId} className={styles.planItem}>
                  <div className={styles.planCheck}>
                    <Check size={20} />
                  </div>
                  <div>
                    <h4 className={styles.planName}>{plan.name || 'Ideal Oral Health Plan'}</h4>
                    <p className={styles.planPrice}>${(plan.price / 100).toFixed(2)}/{plan.cadence}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pricing Summary */}
        <div className={styles.pricingSection}>
          <h2 className={styles.sectionTitle}>Billing Information</h2>
          <div className={styles.pricingBox}>
            <div className={styles.pricingRow}>
              <span>Monthly Total</span>
              <span className={styles.price}>
                ${((pricing?.total || 0) / 100).toFixed(2)}
              </span>
            </div>
            <div className={styles.pricingRow}>
              <span>Payment Method</span>
              <span>{state.paymentInfo?.method === 'ach' ? 'ACH' : 'Credit Card'}</span>
            </div>
            <div className={styles.pricingRow}>
              <span>Billing Cadence</span>
              <span className={styles.capitalize}>
                {Object.values(selectedPlans || {})[0]?.cadence || 'monthly'}
              </span>
            </div>
            <p className={styles.billingNote}>
              Your first payment has been processed. Subsequent payments will occur
              on the 1st of each month.
            </p>
          </div>
        </div>

        {/* Next Steps */}
        <div className={styles.nextStepsSection}>
          <h2 className={styles.sectionTitle}>What's Next?</h2>
          <ul className={styles.stepsList}>
            <li>
              <span className={styles.stepNumber}>1</span>
              <span>
                Check your email for your welcome packet and member resources
              </span>
            </li>
            <li>
              <span className={styles.stepNumber}>2</span>
              <span>
                Save your member ID and barcode to present at your first appointment
              </span>
            </li>
            <li>
              <span className={styles.stepNumber}>3</span>
              <span>
                Visit our provider directory to find dentists and specialists near you
              </span>
            </li>
            <li>
              <span className={styles.stepNumber}>4</span>
              <span>
                Log in to your member dashboard to manage your account and view benefits
              </span>
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className={styles.actionsSection}>
          <button className={styles.primaryButton}>
            <Download size={18} />
            Download ID Card
          </button>
          <button className={styles.secondaryButton}>
            <Share2 size={18} />
            Share Membership
          </button>
          <Link href="/health" className={styles.primaryButton}>
            <Home size={18} />
            Return to Health Hub
          </Link>
        </div>

        {/* Support Section */}
        <div className={styles.supportSection}>
          <p>
            Questions? Contact our member support team at{' '}
            <a href={`mailto:${supportEmail}`}>{supportEmail}</a> or
            call <a href={`tel:${supportPhone.replace(/\D/g, '')}`}>{supportPhone}</a>
          </p>
        </div>
      </div>
    </div>
  );
}
