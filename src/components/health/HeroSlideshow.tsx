'use client';

import { useCallback, useState, useEffect } from 'react';
import { getImageProps } from 'next/image';
import styles from './HeroSlideshow.module.css';

interface Slide {
  image: string;
  mobileImage: string;
  alt: string;
  label: string;
}

const slides: Slide[] = [
  {
    image: '/health-assets/hero-banner-ai-scan.jpg',
    mobileImage: '/health-assets/hero-mobile-aiscan.jpg',
    alt: 'Capture 5 easy photos in the app and get quick, color-coded AI results',
    label: '1. Scan w/ Quick Results'
  },
  {
    image: '/health-assets/hero-banner-teleconsult.jpg',
    mobileImage: '/health-assets/hero-mobile-teledentistry.jpg',
    alt: 'Connect with a licensed dentist 24/7/365 over video',
    label: '2. Teledentist'
  },
  {
    image: '/health-assets/hero-banner-savings.jpg',
    mobileImage: '/health-assets/hero-mobile-discountnetwork.jpg',
    alt: 'Save 20-50% on dental procedures through our provider network',
    label: '3. Save on Care'
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
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const goToSlide = useCallback((index: number) => {
    if (index === currentSlide) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentSlide(index);
      setIsTransitioning(false);
    }, 600); // Half of transition duration
  }, [currentSlide]);

  // Re-armed every time currentSlide changes, so a manual click resets the
  // countdown instead of racing against whatever was left of the old one.
  useEffect(() => {
    const timer = setTimeout(() => {
      goToSlide((currentSlide + 1) % slides.length);
    }, 5000); // Advance every 5 seconds

    return () => clearTimeout(timer);
  }, [currentSlide, goToSlide]);

  return (
    <div className={styles.slideshow}>
      {/* Image Container */}
      <div className={styles.imageContainer}>
        {slides.map((slide, index) => (
          <div
            key={index}
            className={`${styles.slide} ${
              index === currentSlide ? styles.active : ''
            } ${isTransitioning && index === currentSlide ? styles.fadeOut : ''}`}
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
              index === currentSlide ? styles.indicatorActive : ''
            }`}
            aria-label={`Go to ${slide.label}`}
          >
            <span className={styles.indicatorLabel}>{slide.label}</span>
            <div className={styles.indicatorBar}>
              {index === currentSlide && (
                <div className={styles.indicatorProgress} />
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
