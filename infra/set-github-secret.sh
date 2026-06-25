#!/usr/bin/env bash
# Set the deployment token as a GitHub Actions secret
# Prerequisites: gh cli logged in (gh auth login)
#
# Usage: ./infra/set-github-secret.sh

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/params.env"

TOKEN=$("$SCRIPT_DIR/get-deploy-token.sh")

echo "Setting AZURE_STATIC_WEB_APPS_API_TOKEN on $GITHUB_REPO"
gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN \
  --repo "$GITHUB_REPO" \
  --body "$TOKEN"

echo "✓ Secret set. Push to master to trigger deploy."
