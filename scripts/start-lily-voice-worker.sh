#!/usr/bin/env bash
set -euo pipefail

cd /Users/tylerlyon/hermes-workspace

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
MODE=$(/opt/homebrew/bin/node - <<'NODE'
import { buildRuntimeEnv, resolveWorkerConfig } from './scripts/lily-voice-worker.mjs'
const config = resolveWorkerConfig(buildRuntimeEnv())
process.stdout.write(config.mode)
NODE
)

if [[ "$MODE" == "livekit" ]]; then
  if [[ "${LILY_ENABLE_LIVEKIT_AGENT:-}" == "1" ]]; then
    exec /opt/homebrew/bin/node scripts/lily-livekit-agent.mjs start
  fi

  echo "[lily-voice-worker] LILY_VOICE_WORKER_MODE=livekit is configured, but the LiveKit media agent is gated behind LILY_ENABLE_LIVEKIT_AGENT=1 because the current LiveKit/OpenAI STT path does not expose /health reliably. Starting the safe HTTP pipeline scaffold instead."
  export LILY_VOICE_WORKER_MODE=pipeline
fi

exec /opt/homebrew/bin/node scripts/lily-voice-worker.mjs
