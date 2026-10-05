#!/usr/bin/env bash
# Configures production Convex for Gmail eligibility intake and writes this
# site's SITE_IDEAL script property for the shared eligibility mailbox script
# (infra/eligibility-gmail/Code.gs) to the Desktop.
# Re-running rotates the secret: replace SITE_IDEAL with the new value.
# Requires ELIGIBILITY_CONVEX_SITE_URL, the production deployment's HTTP actions
# URL (https://<deployment>.convex.site, from the Convex dashboard).
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077

property=SITE_IDEAL
address=eligibility@getidealoh.com
portal=https://www.getidealoh.com/employer/upload
site="${ELIGIBILITY_CONVEX_SITE_URL:-}"
if ! [[ "$site" =~ ^https://[a-z0-9-]+\.convex\.site$ ]]; then
  echo "Set ELIGIBILITY_CONVEX_SITE_URL=https://<production-deployment>.convex.site" >&2
  exit 1
fi

secret=$(openssl rand -hex 32)
out="$HOME/Desktop/ideal-eligibility-site.txt"

npx convex env set --prod ELIGIBILITY_INBOUND_ADDRESS "$address"
npx convex env set --prod ELIGIBILITY_EMAIL_BRIDGE_SECRET "$secret" > /dev/null
printf 'Property: %s\nValue: {"address":"%s","brand":"Ideal","portal":"%s","api":"%s","secret":"%s"}\n' \
  "$property" "$address" "$portal" "$site" "$secret" > "$out"

echo "Production Convex configured for $address."
echo "In the shared mailbox's Apps Script project (Project Settings > Script properties),"
echo "set $property to the value in $out, then run setup()."
echo "$out contains a secret; delete it after pasting."
