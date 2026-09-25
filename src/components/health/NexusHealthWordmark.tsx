"use client";

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import type { CSSProperties } from 'react';
import { useSiteThemeOptional } from '@/components/providers/SiteThemeProvider';
import styles from './health-header.module.css';

export default function IdealHealthWordmark() {
  const pathname = usePathname();
  const basePath = `/${pathname.split('/')[1]}`;
  const themeCtx = useSiteThemeOptional();
  const site = themeCtx?.site;

  const logoSrc = site?.branding?.logoUrl || '/ideal-oral-health-logo.png';
  const logoWidth = site?.branding?.logoWidth || 136;
  const altText = site?.name || 'Oral Health Plan';

  return (
    <a
      href={basePath}
      className={styles.wordmark}
      style={{ '--wordmark-width': `${logoWidth}px` } as CSSProperties}
    >
      <Image
        src={logoSrc}
        alt={altText}
        width={logoWidth}
        height={53}
        className={styles.wordmarkImage}
        quality={100}
        unoptimized
        priority
      />
    </a>
  );
}
