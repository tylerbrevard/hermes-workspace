#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PORT="${PORT:-3002}"
PID_FILE="$ROOT/.runtime/hermes-workspace.pid"

stop_pid() {
  local pid="$1"
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    for _ in {1..20}; do
      if ! kill -0 "$pid" 2>/dev/null; then
        return 0
      fi
      sleep 0.25
    done
    kill -9 "$pid" 2>/dev/null || true
  fi
}

pid_command() {
  ps -p "$1" -o command= 2>/dev/null || true
}

if [[ -f "$PID_FILE" ]]; then
  pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "$pid" ]]; then
    stop_pid "$pid"
  fi
  rm -f "$PID_FILE"
fi

for pid in $(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true); do
  command="$(pid_command "$pid")"
  if [[ "$command" == *"server-entry.js"* && "$command" == *"$ROOT"* ]]; then
    stop_pid "$pid"
  elif [[ "${FORCE_PORT_KILL:-0}" == "1" ]]; then
    echo "[stable] FORCE_PORT_KILL=1 stopping pid=$pid command=$command" >&2
    stop_pid "$pid"
  else
    echo "[stable] leaving unowned listener on port $PORT: pid=$pid command=$command" >&2
  fi
done

echo "[stable] stopped Hermes Workspace on port $PORT"
