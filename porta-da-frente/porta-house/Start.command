#!/bin/zsh
set -eu
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Install Node.js 20 or newer from https://nodejs.org, then open this file again."
  read -r "?Press Return to close. "
  exit 1
fi
if [[ ! -d node_modules/ajv ]]; then
  npm ci --no-fund --no-audit
fi
node src/launch.mjs
