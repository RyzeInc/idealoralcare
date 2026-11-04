# Domain and marketing boundaries

- The owner froze getidealoh.com marketing at pre-session commit `43aaa07` on November 3, 2026. Preserve its Ideal identity, public copy, design, images, navigation and enrollment destinations. Do not migrate it to AssureVantage unless the owner explicitly reverses this instruction.
- AssureVantage is the new business brand on assurevantage.com. Implement new marketing there. One repository and deployment serve both domains; shared components must preserve the legacy branch.
- Historical templates are in `src/components/marketing/legacy-ideal`; their hashes are checked by `src/lib/__tests__/legacy-marketing-freeze.test.ts`. Do not edit them or refresh their baseline for AssureVantage work. Preserve legacy `/health` and `/newideal` marketing when modifying shared dependencies or styles.
- Functional fixes, eligibility processing, and explicitly requested group-specific member benefits may proceed without changing legacy public marketing. Preserve existing groups, member branding, vendor codes and retail prices unless the task explicitly changes them.
- Clerk still uses getidealoh.com as its technical primary domain. The `/assurevantage/sign-in`, `sign-up`, `forgot-password` and `sso-callback` pages there support shared authentication; do not remove them as part of marketing isolation.
- Verify both domains and original enrollment destinations when changing routing or shared marketing components. See `docs/internal/primary-brand-rollout.md`.
