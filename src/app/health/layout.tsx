import './health.css';
import HealthFlowBackground from '@/components/background/HealthFlowBackground';
import { IdealHealthFooter } from '@/components/health/NexusHealthFooter';
import { SiteThemeProvider } from '@/components/providers/SiteThemeProvider';
import { CartProvider } from '@/lib/health-plans/cart-context';
import { OrganizationJsonLd, WebSiteJsonLd } from '@/components/seo/JsonLd';

export const metadata = {
  title: 'Ideal Health | Modern Health Plans Made Simple',
  description: 'Ideal Health - Comprehensive oral health plan with AI Oral Scanning, 24/7 teledentistry, and Dental Discount Network dental network access.',
  icons: {
    icon: '/logo-shortcut-icon.png',
    shortcut: '/logo-shortcut-icon.png',
    apple: '/logo-apple-touch-icon.png',
  },
  openGraph: {
    siteName: 'Ideal Health',
    images: [{ url: '/health-assets/og-default.png', width: 1200, height: 630 }],
  },
};

/**
 * HEALTH CATALOG LAYOUT
 *
 * PUBLIC ACCESS - No authentication required for browsing
 * Users can browse all pages and add items to cart
 * Authentication only required at /health/checkout
 *
 * Flow:
 * 1. Browse /health/* pages (public)
 * 2. Add items to cart (persisted locally and to Convex)
 * 3. Click checkout
 * 4. Create account + pay (Clerk signup + Stripe)
 * 5. Redirect to /health/dashboard (authenticated)
 */
export default function HealthLayout({ children }: { children: React.ReactNode }) {
  return (
    <SiteThemeProvider defaultSlug="ideal-health">
      <CartProvider>
        <>
          <OrganizationJsonLd />
          <WebSiteJsonLd />
          <HealthFlowBackground />
          <div className="flex flex-col min-h-screen">
            <div className="flex-grow">
              {children}
            </div>
            <IdealHealthFooter />
          </div>
        </>
      </CartProvider>
    </SiteThemeProvider>
  );
}
