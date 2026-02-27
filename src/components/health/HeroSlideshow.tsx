'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import styles from './HeroSlideshow.module.css';

interface Slide {
  image: string;
  alt: string;
  label: string;
}

const slides: Slide[] = [
  {
    // Use PNG - the JPG is too large (2.3MB) and causes loading issues
    image: '/health-assets/hero-scan.png',
    alt: 'AI-powered oral scanning with Toothlens',
    label: '1. Scan with AI'
  },
  {
    image: '/health-assets/hero-teleconsult.jpg',
    alt: 'Virtual teledentistry consultation',
    label: '2. Virtual Consult'
  },
  {
    image: '/health-assets/hero-service.jpg',
    alt: 'Professional care and services',
    label: '3. Get Care'
  }
];

export default function HeroSlideshow() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true);
      
      setTimeout(() => {
        setCurrentSlide((prev) => (prev + 1) % slides.length);
        setIsTransitioning(false);
      }, 600); // Half of transition duration
    }, 4000); // Change slide every 4 seconds

    return () => clearInterval(interval);
  }, []);

  const goToSlide = (index: number) => {
    if (index === currentSlide) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentSlide(index);
      setIsTransitioning(false);
    }, 600);
  };

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
            <Image
              src={slide.image}
              alt={slide.alt}
              fill
              priority={index === 0}
              className={styles.image}
              sizes="(max-width: 768px) 100vw, 1200px"
              onError={(e) => {
                // If a JPG fails to load for any reason, try the PNG with same base name as a fallback.
                // Use `currentTarget` which is more reliable than `target` for React synthetic events.
                const img = e.currentTarget as HTMLImageElement | null;
                if (!img) return;
                const src = img.currentSrc || img.src || '';
                if (/\.jpe?g$/i.test(src)) {
                  img.src = src.replace(/\.jpe?g$/i, '.png');
                }
              }}
            />
            
            {/* Gradient Overlay for better text readability */}
            <div className={styles.overlay} />
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
