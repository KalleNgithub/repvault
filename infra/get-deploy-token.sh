#!/usr/bin/env bash
# Retrieve Azure Static Web App deployment token
# Prerequisites: az cli logged in, resource already created
#
# Usage: ./infra/get-deploy-token.sh

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/params.env"

TOKEN=$(az staticwebapp secrets list \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.apiKey" \
  --output tsv)

echo "$TOKEN"
