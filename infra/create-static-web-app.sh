#!/usr/bin/env bash
# Create Azure Static Web App resources
# Prerequisites: az cli logged in (az login)
#
# Usage: ./infra/create-static-web-app.sh
# Idempotent — safe to run multiple times

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/params.env"

echo "Creating resource group: $RESOURCE_GROUP in $LOCATION"
az group create \
  --name "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --output none

echo "Creating static web app: $APP_NAME (sku: $SKU)"
az staticwebapp create \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --sku "$SKU" \
  --output none

echo ""
echo "✓ Static Web App created: $APP_NAME"
echo ""
echo "Next steps:"
echo "  1. Get deployment token:  ./infra/get-deploy-token.sh"
echo "  2. Add to GitHub secrets: ./infra/set-github-secret.sh"
