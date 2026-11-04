'use client';

import { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import { getImageProps } from 'next/image';
import { usePathname } from 'next/navigation';
import LegacyHeroSlideshow from '@/components/marketing/legacy-ideal/HeroSlideshow';
import styles from './HeroSlideshow.module.css';
import { useSiteThemeOptional } from '@/components/providers/SiteThemeProvider';
import { isSiteMarketingEnabled, type SiteMarketingFeature } from '@/convex/lib/siteMarketing';

interface Slide {
  image: string;
  mobileImage: string;
  alt: string;
  label: string;
  feature: SiteMarketingFeature;
}

const allSlides: Slide[] = [
  {
    image: '/health-assets/hero-banner-ai-scan.jpg',
    mobileImage: '/health-assets/hero-mobile-aiscan.jpg',
    alt: 'Capture 5 easy photos in the app and get quick, color-coded AI results',
    label: 'Scan w/ Quick Results',
    feature: 'oralScan',
  },
  {
    image: '/health-assets/hero-banner-teleconsult.jpg',
    mobileImage: '/health-assets/hero-mobile-teledentistry.jpg',
    alt: 'Connect with a licensed dentist 24/7/365 over video',
    label: 'Teledentist',
    feature: 'teledentistry',
  },
  {
    image: '/health-assets/hero-banner-savings.jpg',
    mobileImage: '/health-assets/hero-mobile-discountnetwork.jpg',
    alt: 'Save 20-50% on dental procedures through our provider network',
    label: 'Save on Care',
    feature: 'dentalDiscount',
  }
];

function ResponsiveHeroImage({
  slide,
  priority,
}: {
  slide: Slide;
  priority: boolean;
}) {
  const commonProps = {
    alt: slide.alt,
    fill: true,
    priority,
    className: styles.image,
  };
  const { props: desktopImageProps } = getImageProps({
    ...commonProps,
    src: slide.image,
    sizes: '(max-width: 1200px) 100vw, 1200px',
  });

  return (
    <picture>
      {/* The mobile JPEG is already encoded at near-lossless quality. Serving it
          directly prevents the image optimizer from recompressing fine text. */}
      <source
        media="(max-width: 768px)"
        type="image/jpeg"
        srcSet={slide.mobileImage}
      />
      <img {...desktopImageProps} alt={slide.alt} />
    </picture>
  );
}

export default function HeroSlideshow() {
  const pathname = usePathname();
  return pathname === "/health" || pathname.startsWith("/health/") ? <LegacyHeroSlideshow /> : <ConfigurableHeroSlideshow />;
}

function ConfigurableHeroSlideshow() {
  const theme = useSiteThemeOptional();
  const slides = useMemo(() => theme?.isLoading ? [] : allSlides.filter(slide => isSiteMarketingEnabled(theme?.site?.marketing, slide.feature)), [theme?.isLoading, theme?.site?.marketing]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const activeSlide = currentSlide % Math.max(slides.length, 1);

  const goToSlide = useCallback((index: number) => {
    if (index === activeSlide) return;
    setIsTransitioning(true);
    clearTimeout(transitionTimer.current);
    transitionTimer.current = setTimeout(() => {
      setCurrentSlide(index);
      setIsTransitioning(false);
    }, 600); // Half of transition duration
  }, [activeSlide]);

  useEffect(() => () => clearTimeout(transitionTimer.current), []);

  // Re-armed every time currentSlide changes, so a manual click resets the
  // countdown instead of racing against whatever was left of the old one.
  useEffect(() => {
    if (slides.length < 2) return;
    const timer = setTimeout(() => {
      goToSlide((activeSlide + 1) % slides.length);
    }, 5000); // Advance every 5 seconds

    return () => clearTimeout(timer);
  }, [activeSlide, goToSlide, slides.length]);

  if (slides.length === 0) return null;

  return (
    <div className={styles.slideshow}>
      {/* Image Container */}
      <div className={styles.imageContainer}>
        {slides.map((slide, index) => (
          <div
            key={index}
            className={`${styles.slide} ${
              index === activeSlide ? styles.active : ''
            } ${isTransitioning && index === activeSlide ? styles.fadeOut : ''}`}
          >
            <ResponsiveHeroImage slide={slide} priority={index === 0} />
          </div>
        ))}
      </div>

      {/* Progress Indicators */}
      <div className={styles.indicators}>
        {slides.map((slide, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`${styles.indicator} ${
              index === activeSlide ? styles.indicatorActive : ''
            }`}
            aria-label={`Go to ${slide.label}`}
          >
            <span className={styles.indicatorLabel}>{slide.label}</span>
            <div className={styles.indicatorBar}>
              {index === activeSlide && (
                <div className={styles.indicatorProgress} />
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
