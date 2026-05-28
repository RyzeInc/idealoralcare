#!/usr/bin/env bash
# Create 4 New Ideal Health Stripe Products (Essentials Plan tiers) and link
# them to Convex catalog.
#
# Usage:
#   ./scripts/create-newideal-stripe-products.sh          # test mode (default)
#   ./scripts/create-newideal-stripe-products.sh --live   # live mode
#
# Requires: stripe CLI logged in, npx convex available, catalog seeded first
# (npx convex run admin/seedNewIdeal:seedNewIdeal).

set -euo pipefail

# Load .env.local if present so STRIPE_LIVE_SECRET_KEY is available
if [[ -f ".env.local" ]]; then
  # shellcheck disable=SC1091
  set -o allexport; source .env.local; set +o allexport
fi

KEY_FLAG=""
MODE_LABEL="TEST"
if [[ "${1:-}" == "--live" ]]; then
  if [[ -z "${STRIPE_LIVE_SECRET_KEY:-}" ]]; then
    echo "ERROR: Set STRIPE_LIVE_SECRET_KEY=sk_live_... in .env.local before running with --live"
    exit 1
  fi
  KEY_FLAG="-k $STRIPE_LIVE_SECRET_KEY"
  MODE_LABEL="LIVE"
fi

echo "Creating Stripe products in $MODE_LABEL mode..."
echo

# slug : human-readable name
PRODUCTS=(
  "essentials-employee:Essentials Plan — Employee"
  "essentials-employee-spouse:Essentials Plan — Employee + Spouse"
  "essentials-employee-child:Essentials Plan — Employee + Child"
  "essentials-employee-family:Essentials Plan — Employee + Family"
)

MAPPING_JSON='{'
FIRST=1

for entry in "${PRODUCTS[@]}"; do
  SLUG="${entry%%:*}"
  NAME="${entry#*:}"

  echo "→ $SLUG"
  RESPONSE=$(stripe products create $KEY_FLAG \
    --name "$NAME" \
    -d "metadata[catalog_slug]=$SLUG" \
    -d "metadata[site]=newideal")

  PRODUCT_ID=$(echo "$RESPONSE" | grep -E '^\s*"id":' | head -1 | sed -E 's/.*"(prod_[A-Za-z0-9]+)".*/\1/')
  if [[ -z "$PRODUCT_ID" ]]; then
    echo "  ✗ failed to extract product id; aborting"
    echo "$RESPONSE"
    exit 1
  fi
  echo "  ✓ $PRODUCT_ID"

  if [[ $FIRST -eq 1 ]]; then
    FIRST=0
  else
    MAPPING_JSON+=','
  fi
  MAPPING_JSON+="\"$SLUG\":\"$PRODUCT_ID\""
done

MAPPING_JSON+='}'

echo
echo "All 8 products created. Mapping:"
echo "$MAPPING_JSON" | python3 -m json.tool 2>/dev/null || echo "$MAPPING_JSON"
echo

echo "Linking to Convex catalog (admin/seedNewIdeal:setNewIdealStripeIds)..."
npx convex run admin/seedNewIdeal:setNewIdealStripeIds "{\"mapping\":$MAPPING_JSON}"

echo
echo "Done."
