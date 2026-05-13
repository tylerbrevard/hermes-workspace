#!/usr/bin/env bash
set -euo pipefail

cd /Users/tylerlyon/hermes-workspace
mkdir -p /Users/tylerlyon/hermes-workspace/.runtime

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

exec /opt/homebrew/bin/node \
  --localstorage-file=/Users/tylerlyon/hermes-workspace/.runtime/node-localstorage.json \
  /Users/tylerlyon/hermes-workspace/server-entry.js
