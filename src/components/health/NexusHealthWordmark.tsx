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

  const useDefaultLogo = !themeCtx?.isLoading && (!site || site.slug === 'ideal-health' || site.slug === 'ryze-health');
  const logoSrc = site?.branding?.logoUrl || (useDefaultLogo ? '/ideal-oral-health-logo.png' : undefined);
  const logoWidth = site?.branding?.logoWidth || 136;
  const altText = site?.name || 'Oral Health Plan';

  return (
    <a
      href={basePath}
      className={styles.wordmark}
      style={{ '--wordmark-width': `${logoWidth}px` } as CSSProperties}
    >
      {logoSrc ? <Image
        src={logoSrc}
        alt={altText}
        width={logoWidth}
        height={53}
        className={styles.wordmarkImage}
        quality={100}
        unoptimized
        priority
      /> : <span style={{ color: 'var(--brand-primary)', fontSize: '1.25rem', fontWeight: 700 }}>{site?.name || 'Oral Health Plan'}</span>}
    </a>
  );
}
