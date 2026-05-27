# Hermes Workspace Flow Backlog

Generated from the May 26, 2026 full workspace review. Keep this as the implementation source of truth until these items are either shipped, intentionally rejected, or replaced by a better plan.

## Current Blockers

- [x] Fix `/phone` route registration so Phone Cockpit is reachable.
- [x] Fix `/ops-intelligence` route registration or remove it from nav until live.
- [x] Fix React hydration error `#418` in production route smoke.
- [x] Fix redirected module/script loading under `/workspace`.
- [x] Restore route smoke confidence behind workspace auth.
- [x] Fix dashboard SQLite `session_id` error in `ai.hermes.dashboard` logs.
- [x] Fix Graph DNS/presence failures or degrade presence checks without log spam.
- [x] Resolve gateway/dashboard capability mismatch warnings in workspace logs.

## Workspace Recommendations

- [x] Add “Today / Now / Next” as the dashboard’s first rail.
- [x] Turn dashboard cards into action cards with a direct next button.
- [ ] Add stale-data badges to every operational card.
- [x] Add one global “what needs Tyler” queue.
- [ ] Merge duplicate passive status pages into Operations.
- [x] Add a “resume last workstream” button.
- [x] Add a morning startup checklist.
- [x] Add an end-of-day closeout checklist.
- [ ] Add a “blocked by me” section across agents, tickets, and messages.
- [ ] Add a “waiting on others” section.
- [x] Add a meeting-to-task extraction summary.
- [x] Add Outlook inbox zero progress to dashboard.
- [ ] Add ConnectWise approval/ticket summary to dashboard.
- [x] Add Teams presence and desk-device state to dashboard.
- [x] Add Lily health and voice readiness to dashboard.
- [ ] Add “safe restart” controls for gateway, workspace, Lily worker.
- [x] Add launchd service state with last log line.
- [x] Add update status for Hermes agent and workspace repo.
- [ ] Add a “changes since last update” panel.
- [x] Add local build/test status panel.
- [x] Add route smoke status with screenshots.
- [ ] Add cost/paid-call guard status everywhere model calls happen.
- [ ] Add model/provider health with fallback reason.
- [ ] Add per-page diagnostics drawer.
- [ ] Add saved page layouts per workflow mode.
- [x] Group nav into Daily, Agent Ops, Knowledge, Systems, Settings.
- [x] Pin five favorite pages above the rest.
- [x] Add command palette actions, not just page search.
- [x] Add keyboard-first “create task / note / draft / agent job”.
- [x] Add deep links from dashboard cards into filtered target pages.
- [x] Make Jobs show failed jobs first by default.
- [x] Make Tasks show overdue, today, waiting, delegated.
- [x] Make Files show recent changed workspace files first.
- [x] Make Memory show active regression/watch files first.
- [x] Make Skills show used recently, installed, available, broken.
- [x] Make MCP show server health and last tool error.
- [x] Make Meetings show next meeting prep and unresolved commitments.
- [x] Make Presence show “what will people see from me right now”.
- [x] Make ConnectWise page action-oriented: tickets, approvals, SLA risk.
- [x] Make Barry page feed into real follow-up tasks.
- [x] Make Swarm page show active missions before visual roster.
- [x] Make Conductor include proven templates for Tyler’s recurring workflows.
- [x] Add “copy diagnostics” to every page, standardized.
- [x] Add page-specific empty states that tell the next setup action.
- [x] Add a weekly “workspace utilization” report.
- [x] Add a single `/health` view that verifies all above with live evidence.

## Mobile Ideas

- [x] Make `/phone` the mobile home.
- [x] Show one top sentence: “what matters now”.
- [x] Add three counters: unread, urgent, overdue.
- [x] Add “next meeting” with Join and Prep.
- [x] Add “needs Tyler” as the first list.
- [x] Add swipeable Today / Work / Systems tabs.
- [x] Add one-tap note capture.
- [x] Add one-tap task capture.
- [x] Add safe email draft capture.
- [x] Add voice capture through Lily.
- [x] Add push notification setup status.
- [x] Add critical-only local alerts.
- [x] Add iOS PWA install prompt/status.
- [x] Add lock-screen/widget-friendly summary endpoint.
- [x] Add Shortcuts endpoint examples in-app.
- [x] Add “commute mode” readout.
- [x] Add “meeting mode” before calendar events.
- [x] Add “desk mode” when office bridge is online.
- [x] Add “away mode” quick presence/status note.
- [x] Add offline capture queue.
- [x] Add sync-failed badge for captured items.
- [x] Add haptics only for confirmed actions.
- [x] Keep bottom nav focused on Home, Chat, Lily, Files, Terminal, Swarm.
- [x] Keep hamburger for long-tail pages.
- [x] Add a compact task triage sheet.
- [x] Add “reply later” mail queue.
- [x] Add daily habit/75 tracker mini-card.
- [x] Add ConnectWise urgent ticket mini-card.
- [x] Add Teams presence mini-card.
- [x] Add system degraded mini-card.
- [x] Add Lily mic button as a persistent floating control.
- [x] Add “read me the day” button.
- [x] Add “what am I forgetting?” button.
- [x] Add quick links to meetings, tasks, ConnectWise, files.
- [x] Add card-level freshness timestamps.
- [x] Add a low-data mode for slow mobile loads.
- [x] Add dark, high-contrast mobile theme tuned for glance use.
- [x] Add per-card collapse preferences.
- [x] Add mobile route smoke in CI.
- [x] Add mobile Safari-specific mic/permission tests.

## Lily Completion

- [ ] Decide the default Lily mode: browser speech plus Hermes chat, or full LiveKit media-room voice agent.
- [ ] Promote the pipeline worker from scaffold to owned runtime with LaunchAgent status in dashboard.
- [ ] Enable full LiveKit media worker only after it joins the room, subscribes to mic audio, runs STT/LLM/TTS, and publishes audio back.
- [ ] Distinguish “browser hands-free”, “LiveKit transport connected”, and “voice agent actually speaking” in the UI.
- [ ] Persist Lily transcripts and decisions into the right Hermes/PAI memory surface.
- [ ] Add safe action permissions before sending, deleting, approving, or mutating ConnectWise/Graph state.
- [ ] Add provider fallback rules with paid-call gates.
- [ ] Add mobile Safari/Chrome permission and wake-lock behavior tests.
- [ ] Add E2E smoke for config load, mic denied state, typed fallback, LiveKit token refresh, and worker offline state.
- [x] Add a dashboard Lily card with configured state, worker status, media-room readiness, and last successful voice loop.
- [ ] Add a real “test voice loop” button that reports the exact failing stage.
