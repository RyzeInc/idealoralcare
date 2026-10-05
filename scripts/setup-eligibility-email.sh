#!/usr/bin/env bash
# Configures production Convex for Gmail eligibility intake and writes the
# mailbox's copy of the Apps Script (with the bridge secret) to the Desktop.
# Re-running rotates the secret: paste the new file and run setup() again.
# Requires ELIGIBILITY_CONVEX_SITE_URL, the production deployment's HTTP actions
# URL (https://<deployment>.convex.site, from the Convex dashboard).
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077

site="${ELIGIBILITY_CONVEX_SITE_URL:-}"
if ! [[ "$site" =~ ^https://[a-z0-9-]+\.convex\.site$ ]]; then
  echo "Set ELIGIBILITY_CONVEX_SITE_URL=https://<production-deployment>.convex.site" >&2
  exit 1
fi

secret=$(openssl rand -hex 32)
out="$HOME/Desktop/ideal-eligibility-script.gs"

npx convex env set --prod ELIGIBILITY_INBOUND_ADDRESS eligibility@getidealoh.com
npx convex env set --prod ELIGIBILITY_EMAIL_BRIDGE_SECRET "$secret" > /dev/null
sed -e "s/__BRIDGE_SECRET__/$secret/" -e "s|__CONVEX_SITE_URL__|$site|" infra/eligibility-gmail/Code.gs > "$out"

echo "Production Convex configured for eligibility email."
echo "Script for the eligibility@ mailbox: $out (contains a secret; delete it after pasting)."
