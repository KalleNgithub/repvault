#!/usr/bin/env bash
# Tear down all Azure resources for this project
# Prerequisites: az cli logged in
#
# Usage: ./infra/destroy.sh
# WARNING: This deletes everything in the resource group

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/params.env"

echo "⚠️  This will delete resource group: $RESOURCE_GROUP"
read -p "Are you sure? (y/N) " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "Aborted."
  exit 0
fi

az group delete --name "$RESOURCE_GROUP" --yes --no-wait
echo "✓ Resource group deletion initiated (async)."
