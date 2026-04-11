import Script from "next/script";

/**
 * Google Analytics component.
 *
 * Add your GA Measurement ID to NEXT_PUBLIC_GA_MEASUREMENT_ID in your
 * environment variables (e.g. G-XXXXXXXXXX), then include <GoogleAnalytics />
 * in your root layout.
 *
 * This only loads in production when the env var is set.
 */
export function GoogleAnalytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (!gaId) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('consent', 'default', {
            analytics_storage: 'granted',
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
          });
          gtag('config', '${gaId}', {
            page_path: window.location.pathname,
          });
        `}
      </Script>
    </>
  );
}
