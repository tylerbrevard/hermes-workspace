# LILY Local Voice Worker

LILY uses three separate voice surfaces:

- Browser Listen: browser speech recognition and wake-word capture inside `/lily`.
- LiveKit Room: microphone/audio transport between Workspace and a voice worker.
- Voice Agent: a separate local worker process that reports health and, later, can host STT/LLM/TTS.

This repo includes a production-safe local worker scaffold. It is intentionally useful before the full LiveKit media worker is installed: it exposes a health endpoint and a mocked STT -> LLM -> TTS pipeline so Workspace can prove whether the worker runtime exists. The browser page's primary hands-free mode uses local browser speech recognition plus Hermes chat; the scaffold does not yet join a LiveKit room or publish assistant audio.

## Start

```sh
cd /Users/tylerlyon/hermes-workspace
pnpm lily:voice:worker
```

Default health URL:

```text
http://127.0.0.1:8799/health
```

Point Workspace at that worker:

```sh
export LILY_VOICE_WORKER_HEALTH_URL=http://127.0.0.1:8799/health
```

The worker reads the same runtime secret source as Workspace:

```text
~/.hermes/secrets/runtime-secrets.json
```

Environment variables still win when both are set. Health and startup logs only report provider names, missing key names, and readiness state; they must not print secret values.

## Required Environment

For Workspace health only:

```text
LILY_VOICE_WORKER_HEALTH_URL=http://127.0.0.1:8799/health
```

For LiveKit room transport secrets:

```text
LIVEKIT_URL=wss://...
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
LIVEKIT_AGENT_NAME=lily
LILY_VOICE_WORKER_MODE=livekit
```

The LaunchAgent intentionally keeps the HTTP health/pipeline scaffold active unless `LILY_ENABLE_LIVEKIT_AGENT=1` is also set. The current LiveKit/OpenAI STT worker path can register with LiveKit while failing `/health` and job-level STT, so the safe default is to degrade to the scaffold instead of advertising a broken media worker.

For provider adapters:

```text
LILY_STT_PROVIDER=mock
LILY_LLM_PROVIDER=hermes
LILY_TTS_PROVIDER=mock
LILY_SERVICE_INSTRUCTIONS=...
```

`mock` is the safe default for STT and TTS because the browser hands-free page
already handles microphone capture and spoken replies. `hermes` is the preferred
LLM provider on Tyler's machine because it uses the existing local Hermes
gateway access instead of direct OpenAI API quota:

```text
LILY_GATEWAY_URL=http://127.0.0.1:18789
HERMES_API_TOKEN=...
LILY_LLM_MODEL=hermes-agent
```

`openai` is accepted for staged integration and requires:

```text
OPENAI_API_KEY=...
LILY_STT_MODEL=gpt-4o-mini-transcribe
LILY_TTS_MODEL=gpt-4o-mini-tts
```

If a configured provider is temporarily unavailable, the worker keeps responding
with a local fallback and marks the pipeline response as `degraded: true`.

## Smoke Checks

One-shot health payload:

```sh
pnpm lily:voice:smoke
```

One-shot mocked pipeline:

```sh
pnpm lily:voice:pipeline
```

Health endpoint:

```sh
curl -fsS http://127.0.0.1:8799/health
```

Mocked STT -> LLM -> TTS pipeline:

```sh
curl -fsS http://127.0.0.1:8799/pipeline \
  -H 'content-type: application/json' \
  -d '{"transcript":"LILY, confirm voice pipeline"}'
```

Expected result: JSON with `ok: true`, `status: "ready"`, provider names, transcript text, response text, and base64 mock audio text. The legacy `/loopback` endpoint is kept as an alias for the same smoke path.

Worker health reports `status: "not_ready"` while `LILY_VOICE_WORKER_MODE=pipeline`, even when the HTTP pipeline works. That is intentional: it prevents Workspace from presenting the scaffold as a true LiveKit media-room voice agent. A future `livekit` mode should only report ready after it joins the browser room, subscribes to microphone audio, runs STT/LLM/TTS, and publishes audio back.

If you bind the worker outside loopback, set `LILY_VOICE_WORKER_TOKEN` and send `Authorization: Bearer <token>` to `/pipeline` or `/loopback`.
