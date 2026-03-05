'use client';

import { useState } from 'react';
import Image from 'next/image';
import styles from './FeatureModal.module.css';

interface FeatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature: 'toothlens' | 'teledentistry' | 'network';
}

export default function FeatureModal({ isOpen, onClose, feature }: FeatureModalProps) {
  if (!isOpen) return null;

  const getContent = () => {
    switch (feature) {
      case 'toothlens':
        return {
          title: 'AI Oral Scanning',
          subtitle: 'AI-Powered Oral Health Detection',
          image: '/health-assets/toothlensscan_1086x1024.png',
          description: 'Start a SmileScan. Take a few photos and let our AI give you a detailed report in minutes, highlighting concerns, tartar buildup, gum health, and alignment issues, helping you catch problems early and stay healthy.',
          ctaText: 'Start Free SmileScan',
          ctaLink: '#',
          steps: [
            {
              number: '1',
              title: 'Take 5 Photos',
              description: 'Following the step-by-step instructions, use your phone to take five photos of your mouth.',
              icon: 'Camera'
            },
            {
              number: '2',
              title: 'Instant AI Analysis',
              description: 'Our AI analyzes your photos to create a SmileScan Report, giving you an overall oral health score and highlighting any areas of concern with clear explanations',
              icon: 'Zap'
            },
            {
              number: '3',
              title: 'Review Your Results With a Dentist',
              description: 'Have questions or concerns about your results? Schedule a virtual consultation with one of our dentists directly from your SmileScan Report.',
              icon: 'User'
            }
          ]
        };
      
      case 'teledentistry':
        return {
          title: 'Teledentistry Consultations',
          subtitle: '24/7 Virtual Care',
          image: '/health-assets/teledentistr_1024x1024.png',
          description: 'Connect with licensed dentists anytime, anywhere through secure video consultations. Get professional advice, diagnosis, and treatment plans from the comfort of your home.',
          ctaText: 'Schedule Consultation',
          ctaLink: '#',
          steps: [
            {
              number: '1',
              title: 'Book Your Appointment',
              description: 'Choose a time that works for you. Available 24/7 for urgent concerns or scheduled appointments.',
              icon: 'Calendar'
            },
            {
              number: '2',
              title: 'Connect with a Dentist',
              description: 'Join a secure video call with an experienced, licensed dentist who will review your concerns.',
              icon: 'MessageCircle'
            },
            {
              number: '3',
              title: 'Get Your Treatment Plan',
              description: 'Receive professional recommendations, prescriptions if needed, and referrals to in-person care.',
              icon: 'FileText'
            }
          ]
        };
      
      case 'network':
        return {
          title: 'Nationwide Provider Network',
          subtitle: 'Access to Quality Care',
          image: '/health-assets/dentist-network-discount_1536x1024.png',
          description: 'Access our nationwide network of trusted providers with pre-negotiated discount rates. Find quality care near you with transparent pricing.',
          ctaText: 'Find a Dentist',
          ctaLink: '#',
          steps: [
            {
              number: '1',
              title: 'Search Our Network',
              description: 'Browse thousands of qualified dentists in your area with verified credentials and patient reviews.',
              icon: 'Search'
            },
            {
              number: '2',
              title: 'Compare Prices',
              description: 'See upfront pricing for procedures with member discount rates clearly displayed.',
              icon: 'DollarSign'
            },
            {
              number: '3',
              title: 'Book Your Visit',
              description: 'Schedule directly through our platform and enjoy discounted rates on all services.',
              icon: '✅'
            }
          ]
        };
    }
  };

  const content = getContent();

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose} aria-label="Close modal">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className={styles.content}>
          {/* Hero Image */}
          <div className={styles.imageWrapper}>
            <Image
              src={content.image}
              alt={content.title}
              width={800}
              height={400}
              className={styles.image}
            />
          </div>

          {/* Header */}
          <div className={styles.header}>
            <div className={styles.subtitle}>{content.subtitle}</div>
            <h2 className={styles.title}>{content.title}</h2>
            <p className={styles.description}>{content.description}</p>
            <a href={content.ctaLink} className={styles.cta}>
              {content.ctaText}
            </a>
          </div>

          {/* How It Works */}
          <div className={styles.howItWorks}>
            <h3 className={styles.sectionTitle}>How It Works</h3>
            <div className={styles.steps}>
              {content.steps.map((step) => (
                <div key={step.number} className={styles.step}>
                  <div className={styles.stepHeader}>
                    <div className={styles.stepNumber}>{step.number}</div>
                    <h4 className={styles.stepTitle}>{step.title}</h4>
                  </div>
                  <p className={styles.stepDescription}>{step.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom CTA */}
          <div className={styles.footer}>
            <a href={content.ctaLink} className={styles.ctaPrimary}>
              Get Started
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
