# Infrastructure

Parameterized scripts for Azure Static Web Apps deployment.

## Prerequisites

- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) (`az login`)
- [GitHub CLI](https://cli.github.com/) (`gh auth login`) — for setting secrets

## Files

| File | Purpose |
|------|---------|
| `params.env` | Shared parameters (app name, region, SKU, repo) |
| `create-static-web-app.sh` | Create resource group + static web app |
| `get-deploy-token.sh` | Retrieve deployment API token |
| `set-github-secret.sh` | Push token to GitHub Actions secrets |
| `destroy.sh` | Tear down all resources |

## Usage

```bash
# First time setup
./infra/create-static-web-app.sh
./infra/set-github-secret.sh

# Then just push to master — CI/CD handles the rest
git push origin master
```

## Customization

Edit `params.env` to change:
- `LOCATION` — Azure region (default: westeurope)
- `GITHUB_REPO` — your GitHub org/repo path
- `SKU` — Free or Standard
