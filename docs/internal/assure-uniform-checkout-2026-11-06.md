# AssureVantage photos and uniform checkout — November 6, 2026

The homepage membership cards and pricing cards now use the requested existing photos: `pinky-swear.png` for Oral Care, `mental-health-pic.png` for Balance for Life, and `happy-family.png` for Essentials. The original Ideal marketing assets and templates are unchanged.

The previous shared checkout selected one of two legacy checkout implementations and wrapped both in `SatelliteAuthRedirect`. That moved unsigned visitors to a standalone login page before order review. It also left oral and program orders with different account and agreement presentations.

Every AssureVantage retail order now uses `UnifiedCheckout`, including oral-only, Essentials, standalone Balance for Life and mixed orders. All five sections are visible before authentication:

1. Review Your Order
2. Payment Method
3. Account, using the existing inline account wizard
4. Agent / Rep Selection
5. Confirm & Pay, with every selected membership agreement and the non-insurance terms

Authentication and signed agreements are required before proceeding to payment, rather than before viewing checkout. Each signature is tied to the current account, product, price, cadence and payment method. Agreement records must save before a Stripe payment session is requested. A failed save blocks payment and offers a retry. Original card/ACH prices, annual oral billing, monthly program rules, product IDs and the existing Stripe endpoint remain unchanged.

## Account host and cart continuity

Clerk's supported satellite-domain flow requires account authentication on its technical primary domain. To preserve the inline Account step, the full AssureVantage-branded public checkout runs at `https://www.getidealoh.com/assurevantage/program-checkout`. It opens checkout itself, not a sign-in page. The verified receipt remains on that secure host at `program-success`. These functional pages join the existing branded account pages as exceptions to the marketing-domain redirect; original Ideal marketing destinations remain unchanged.

Cross-domain navigation carries only public product IDs, billing cadence, payment-method preference and referral attribution. Cart restoration uses current visible/allowed catalog products and never accepts transferred prices. Passwords, profile data, payment credentials and signatures never go in this transfer. The transfer is consumed once; refreshing checkout retains later edits. Return links carry edits back to AssureVantage, including an emptied cart. Completed checkout clears the cart only when the server verifies the current purchaser's Stripe session.

The same existing account wizard supports email verification and Google sign-in. Mouse, pen and touch signatures use pointer input; a bare tap no longer counts as a drawn signature. Existing Ideal document names remain the default outside AssureVantage.

## Verification

- Production Next.js build and TypeScript passed.
- Scoped lint passed.
- 231 regression tests across 25 files passed, including frozen Ideal marketing, cart transfer validation, checkout gates, agreement-save failure, annual ACH amounts, consent invalidation and the existing Stripe endpoint.
- Fifteen anonymous browser checkout scenarios passed: five order types at 1440, 390 and 320 pixels. All five steps were visible, payment remained gated, and no browser errors, horizontal overflow, missing images or automated WCAG-tagged axe findings occurred.
- Browser restoration checks passed for edited selections, broker attribution, fresh catalog reconstruction and an empty cart returned to shopping.

No production account, signed contract, purchase or outbound message was created for validation. Live account authentication, actual signature persistence and payment completion still require an authorized customer session; unit tests cover those submission boundaries with mocked services.
