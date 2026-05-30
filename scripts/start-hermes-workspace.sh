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

export NODE_ENV="${NODE_ENV:-production}"

needs_build=0
if [[ ! -f dist/server/server.js ]]; then
  needs_build=1
else
  while IFS= read -r asset; do
    if [[ -n "$asset" && ! -f "dist/server/$asset" ]]; then
      needs_build=1
      break
    fi
  done < <(
    /usr/bin/grep -Eoh "['\"]\\./assets/[^'\"]+" dist/server/server.js 2>/dev/null |
      /usr/bin/sed -E "s/^['\"]\\.\\///" |
      /usr/bin/sort -u
  )
fi

if [[ "$needs_build" == "1" ]]; then
  echo "[workspace] production build missing or incomplete; rebuilding before launch"
  /opt/homebrew/bin/pnpm build
fi

exec /opt/homebrew/bin/node \
  --localstorage-file=/Users/tylerlyon/hermes-workspace/.runtime/node-localstorage.json \
  /Users/tylerlyon/hermes-workspace/server-entry.js
