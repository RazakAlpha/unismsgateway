#!/usr/bin/env bash
# Sets npmjs auth token for publishing (writes to your user ~/.npmrc).
# Usage:
#   NPM_TOKEN=npm_xxxxxxxx ./scripts/set-npm-token.sh
#   ./scripts/set-npm-token.sh npm_xxxxxxxx
# Never commit tokens; use CI secrets for NPM_TOKEN.

set -euo pipefail

TOKEN="${NPM_TOKEN:-${1:-}}"
if [[ -z "$TOKEN" ]]; then
  echo "Usage: NPM_TOKEN=<token> $0   OR   $0 <token>" >&2
  exit 1
fi

npm config set "//registry.npmjs.org/:_authToken" "$TOKEN"
echo "Auth token set for https://registry.npmjs.org/ (user npm config)."
