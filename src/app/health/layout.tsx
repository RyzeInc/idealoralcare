import './health.css';
import HealthFlowBackground from '@/components/background/HealthFlowBackground';
import { NexusHealthFooter } from '@/components/health/NexusHealthFooter';
import { SiteThemeProvider } from '@/components/providers/SiteThemeProvider';
import { CartProvider } from '@/lib/health-plans/cart-context';

export const metadata = {
  title: 'Ideal Health | Modern Health Plans Made Simple',
  description: 'Ideal Health - Comprehensive oral health plan with Toothlens AI scanning, Dial Care teledentistry, and Careington POS dental network access.',
  icons: {
    icon: '/ideal-health-logo.png',
    shortcut: '/ideal-health-logo.png',
    apple: '/ideal-health-logo.png',
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
          <HealthFlowBackground />
          <div className="flex flex-col min-h-screen">
            <div className="flex-grow">
              {children}
            </div>
            <NexusHealthFooter />
          </div>
        </>
      </CartProvider>
    </SiteThemeProvider>
  );
}
