/**
 * BALANCE FOR LIFE BRAND TOKENS
 *
 * Taken from balanceforlifebh.com's own stylesheet so everywhere we present
 * Balance for Life — the /newideal/balance-for-life page, the plan cards, the
 * welcome email and packet — reads as their brand, sold through Ideal Health.
 *
 * Their violet is a muted indigo, not Tailwind's stock violet; use these
 * values rather than approximations. Shared by Convex (email HTML) and Next.
 */
export const BFL_BRAND = {
  violet50: "#EFEEF8",
  violet100: "#DFDDF1",
  violet300: "#9F99D5",
  violet500: "#5955A1", // primary buttons
  violet600: "#46428A", // button hover / icons
  violet700: "#353361",
  teal: "#00707A", // eyebrows, accents
  tealSoft: "#E6F3F4",
  ink: "#1F1D3A", // body text
  inkMuted: "#5C5A6E",
  inkSoft: "#6B6980",
  midnight: "#282560", // headings, dark bands
  canvas: "#FAF8F5", // warm off-white page background
  surfaceMuted: "#F3F0EB",
  hairline: "#E4E1DB",
  /** Hero wash, left to right (desktop) — their homepage hero. */
  heroGradient: "linear-gradient(90deg, #E3F3F4 0%, #CFEAEC 40%, #5CB0BC 72%, #5CB0BC 100%)",
  /** Same wash top to bottom, for narrow screens. */
  heroGradientMobile: "linear-gradient(180deg, #DDF1F2 0%, #5CB0BC 100%)",
  shadowSm: "0 1px 3px rgba(31,29,58,0.06)",
  shadowMd: "0 4px 8px rgba(31,29,58,0.12)",
  shadowElevated: "0 6px 12px rgba(31,29,58,0.15)",
  logo: "/newideal/balance-for-life-logo.png",
} as const;
