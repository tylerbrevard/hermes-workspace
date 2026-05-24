# Hermes Workspace Page Optimization Audit - 2026-05-21

Scope: main Hermes Workspace menu pages visible after PAI removal. Evidence used: live browser smoke snapshot at `.runtime/workspace-audit/audit-snapshot.json`, route/component inspection, and LILY API/config inspection.

## Cross-Workspace Priorities

1. Reduce the persistent left navigation noise by showing recent sessions only on chat-adjacent pages or behind a collapsible panel.
2. Add a shared page header contract: title, status, primary action, refresh state, last-updated timestamp.
3. Standardize empty states so every page has a clear "what can I do now?" action.
4. Add global page health telemetry: API failures, slow loads, stale data, console warnings.
5. Make command palette labels match primary navigation labels exactly.
6. Add route-level loading skeletons that match the final layout.
7. Add route-level error boundaries with retry and diagnostics.
8. Add "copy diagnostic bundle" to operational pages.
9. Add keyboard shortcuts only where discoverable in tooltips or menus.
10. Add shared responsive breakpoints for dense operational tables.
11. Add saved view presets to pages with filters.
12. Add per-page "last successful sync" metadata where data comes from scripts or Graph APIs.
13. Normalize button hierarchy: one primary action, secondary actions as icon buttons or menus.
14. Add accessibility labels to icon-only controls.
15. Add a consistent right-side details drawer pattern for selected records.
16. Track page-level Core Web Vitals and API timing in local diagnostics.
17. Add smoke tests for every main menu route.
18. Add visual regression screenshots for Dashboard, LILY, Chat, Jobs, Meetings, MCP, and Settings.
19. Replace generic "Loading sessions..." shell text on non-chat pages with contextual loading copy.
20. Add a "workspace freshness" card showing current app version, update state, and gateway/agent health.

## Dashboard

Current snapshot: loads cleanly with no console errors, but all top metrics were zero/offline in the smoke pass.

1. Add an "action required" rail that ranks broken connections, stale data, failed jobs, and unreviewed items.
2. Split hero metrics into live health, usage, money, and work-in-progress groups.
3. Show why the active model is offline, not just "Offline".
4. Add last successful gateway probe time and retry action near model health.
5. Replace zero-only cards with useful setup or recovery states.
6. Add drilldowns from every KPI to the source page and filtered view.
7. Add a "today vs 7-day average" delta to sessions, tokens, calls, and tool calls.
8. Add a visible dashboard edit/reset layout control.
9. Add saved dashboard layouts for office monitor, laptop, and phone.
10. Add a "stale data" badge when overview data exceeds a freshness threshold.
11. Collapse low-signal widgets automatically when there is no data.
12. Add a quick command row for New Chat, LILY, Jobs, Meetings, and ConnectWise.
13. Add a recent incidents card fed by Ops Intel and update-system status.
14. Add a "what changed since last login" summary.
15. Add "top failing integrations" with direct links to Settings or MCP.
16. Add trend sparklines to the four hero counters.
17. Add a cost guardrail widget for provider spend and token burn.
18. Add an "automation queue" card with next scheduled runs and failed runs.
19. Add a "recently shipped" card for workspace/agent updates and release notes.
20. Add screenshot-level visual test coverage for the empty/offline dashboard state.

## LILY

Current snapshot: LiveKit is configured, no console errors, and the page exposes Connect Voice, Listen, and text chat. The voice gap is product-level: LiveKit connects your microphone to a room, but there is no visible joined LiveKit voice-agent worker that listens, thinks, and speaks back through the room.

1. Add an explicit voice flow: "Browser Listen", "LiveKit Room", and "Voice Agent" status as separate indicators.
2. Add a clear mic permission state before and after Connect Voice.
3. Add a LiveKit participants panel showing Tyler, LILY agent, and audio tracks.
4. Add a server-side health check that confirms a LILY voice worker is online.
5. Add setup guidance when LiveKit is configured but no agent joins the room.
6. Add push-to-talk mode for safer office use.
7. Add wake-word or hold-to-talk setting only after basic voice works reliably.
8. Add a transcript panel for voice recognition results before sending.
9. Add live waveform/ring animation based on mic input level, not just status.
10. Add speaking animation based on TTS playback events.
11. Add a mute/unmute control with state reflected in the orb.
12. Add "test mic" and "test speaker" buttons.
13. Add a one-click "say hello" voice smoke test.
14. Add browser compatibility messaging for Safari/Chrome speech recognition differences.
15. Add LiveKit token expiry handling and reconnect.
16. Add room disconnect and cleanup control.
17. Add a selected model/personality control for LILY replies.
18. Add conversation memory toggles so LILY can use or ignore workspace memory.
19. Add a privacy indicator when audio is being captured.
20. Add an end-to-end test that verifies typed chat, browser listen, LiveKit connect, and TTS playback state.

## Chat

1. Add a clearer empty/new-session state with suggested first actions.
2. Show gateway/model health inline before the user types.
3. Add provider/model latency and cost estimates near the model picker.
4. Make the Agent View panel collapsible and persist the preference.
5. Add session pinning and favorite sessions.
6. Add a session source tag for API, manual, LILY, and automation-created chats.
7. Add "summarize this session" as a first-class action.
8. Add "create task/job from message" actions.
9. Add attachment upload progress and failure recovery.
10. Add visible keyboard shortcut help through a menu.
11. Add message send retry without duplicating content.
12. Add streaming interruption and regenerate controls.
13. Add a clean diff view for code suggestions.
14. Add search within current conversation.
15. Add safer delete/archive flows for sessions.
16. Add token/context usage meter during composition.
17. Add stale-session warnings when gateway history is unavailable.
18. Add mobile composer overlap tests.
19. Add better empty active-agent state messaging.
20. Add route smoke tests for `/chat/main` and a newly created session.

## Phone Cockpit

1. Replace "Loading Hermes" h1 when data is present.
2. Add a top status strip for Graph, Teams, Home voice, and local prompts.
3. Add clear save confirmation for capture notes.
4. Add capture templates for note, task, draft, and meeting follow-up.
5. Add offline queue for captures when APIs fail.
6. Add "send to LILY" or "read aloud" action for phone-friendly use.
7. Add next meeting join/prep actions as sticky controls.
8. Add inbox triage quick actions.
9. Add task due-date and owner fields directly in capture.
10. Add device health cards with last seen and battery where available.
11. Add one-handed layout review for mobile.
12. Add haptic feedback only on committed actions, not navigation-only taps.
13. Add "daily brief" summary at top.
14. Add voice prompt status and setup link.
15. Add error state if phone cockpit API is stale or unavailable.
16. Add a compact mode for car/desk glance use.
17. Add action history for recent captures.
18. Add confirmation before sending external drafts.
19. Add accessibility labels for icon-only bottom shortcuts.
20. Add smoke test for capture save and local prompt enablement.

## HermesWorld

Current snapshot: page loads, but Chrome reports AudioContext autoplay warnings until user gesture.

1. Gate all audio initialization behind an explicit Start Audio button.
2. Add visible loading state for the scene/canvas.
3. Add fallback text if WebGL or assets fail.
4. Add FPS/performance mode toggle.
5. Add keyboard/gamepad control help in a menu.
6. Add pause and mute controls.
7. Add mobile touch controls.
8. Add route-level error boundary for Three.js failures.
9. Add asset preload progress.
10. Add "return to workspace" action in-scene.
11. Add reduced-motion mode.
12. Add scene state persistence for player location.
13. Add health check for NPC/chat backend.
14. Add screenshot smoke test proving canvas is nonblank.
15. Add audio context regression test.
16. Add consistent branding between `/playground` and `/hermes-world`.
17. Add content density review so it does not feel disconnected from Workspace.
18. Add direct links to reserve/early access only when relevant.
19. Add performance budget for mobile GPUs.
20. Add telemetry for scene load failures.

## Terminal

1. Add connection status for terminal backend.
2. Add "new terminal" and "close terminal" visible controls.
3. Add shell/cwd indicator in the header.
4. Add copy/paste controls for mobile.
5. Add command history search.
6. Add split terminal support only after clear tab semantics.
7. Add safe paste warning for multiline destructive commands.
8. Add terminal session persistence naming.
9. Add resize/reflow tests.
10. Add reconnect after backend restart.
11. Add scrollback export.
12. Add "open cwd in Files" action.
13. Add command duration badges.
14. Add error highlighting for common failures.
15. Add keyboard shortcut menu.
16. Add mobile toolbar for Ctrl/Cmd/Esc/Tab.
17. Add terminal idle timeout indicator.
18. Add route-level diagnostics for websocket failure.
19. Add theme contrast audit for terminal colors.
20. Add smoke test that opens terminal and receives a prompt.

## Jobs

1. Add job status counts across pending/running/failed/completed.
2. Add next run time for recurring jobs.
3. Add failed job recovery action.
4. Add job owner/source labels.
5. Add sortable columns or grouped cards.
6. Add saved filters for active, failing, and recently changed.
7. Add job logs drawer.
8. Add duplicate job action.
9. Add pause/resume with confirmation.
10. Add dry-run button where supported.
11. Add schedule humanization.
12. Add conflict detection for overlapping jobs.
13. Add last successful output preview.
14. Add missing secret/environment warnings.
15. Add search by script path and prompt text.
16. Add bulk select for pause/delete.
17. Add audit history for changes.
18. Add export to markdown/CSV.
19. Add empty state explaining cron vs heartbeat jobs.
20. Add smoke tests for listing, creating, editing, and pausing a job.

## Conductor

1. Add a clearer primary mission composer above recent missions.
2. Add mission templates grouped by goal.
3. Add live dependency graph for multi-agent work.
4. Add phase status timeline for selected mission.
5. Add blocked reason next to failed missions.
6. Add retry from failed checkpoint.
7. Add cost/time estimate before launch.
8. Add approval gates in the main flow, not buried in details.
9. Add "open outputs" quick action.
10. Add recent mission search.
11. Add mission diff/summary after completion.
12. Add compare runs for repeated missions.
13. Add worker availability indicator.
14. Add queue depth indicator.
15. Add route-level backend health diagnostics.
16. Add template quality scoring.
17. Add archived/completed mission cleanup.
18. Add keyboard-first command flow.
19. Add mobile layout pass for dense mission controls.
20. Add smoke tests for template selection and mission creation.

## Operations

1. Add high-level fleet health before individual agent cards.
2. Add agent heartbeat/last seen timestamps.
3. Add output/error badges per agent.
4. Add agent grouping by role.
5. Add start/stop/restart controls with confirmation.
6. Add bulk action support.
7. Add "open in chat" from each agent.
8. Add per-agent logs drawer.
9. Add recent activity filtering.
10. Add pinned main agent card.
11. Add clear empty state for no active workers.
12. Add runtime ownership labels.
13. Add settings validation before saving.
14. Add duplicate/clone agent workflow.
15. Add alerting for stuck agents.
16. Add resource use metrics when available.
17. Add better textarea labeling for multiple agent inputs.
18. Add mobile card density pass.
19. Add role-specific quick prompts.
20. Add smoke tests for add agent and settings modal.

## Ops Intel

1. Add severity ranking across readiness, dependency, incidents, scripts, approvals, coverage, rollout, artifacts.
2. Add "fix now" links for actionable findings.
3. Add last scan time per panel.
4. Add source path/API for each insight.
5. Add stale data warnings.
6. Add report diff since last scan.
7. Add filters by live/partial/broken state.
8. Add export report button.
9. Add ownership field for every finding.
10. Add due date/priority editing.
11. Add route coverage trend.
12. Add dependency update risk categories.
13. Add incident acknowledgement workflow.
14. Add script ownership gaps as tasks.
15. Add approval queue drilldown.
16. Add recommendation rollout status edits.
17. Add artifact preview drawer.
18. Add search across all panels.
19. Add empty/healthy state that still gives confidence.
20. Add smoke test for refresh and filter controls.

## Swarm

1. Add clear distinction between Swarm and Conductor responsibilities.
2. Add worker discovery diagnostics.
3. Add visible route mission status after dispatch.
4. Add worker capacity and availability badges.
5. Add mission templates.
6. Add "one agent vs broadcast" explanation in a tooltip.
7. Add per-worker output preview.
8. Add cancel mission control.
9. Add retry failed worker action.
10. Add live feed with timestamps.
11. Add state persistence across refresh.
12. Add mobile layout for board/runtime tabs.
13. Add "no workers discovered" remediation.
14. Add runtime reset with safety confirmation.
15. Add cost/time estimates.
16. Add result synthesis action.
17. Add compare worker outputs.
18. Add search/filter for missions.
19. Add accessibility labels for icon tabs.
20. Add smoke test for dispatch form validation.

## Memory

1. Add clear split between file-backed memory and searchable knowledge.
2. Add memory source/owner metadata.
3. Add edit confirmation and rollback.
4. Add diff preview before saving.
5. Add search result snippets.
6. Add last indexed time.
7. Add memory health warnings for stale indexes.
8. Add "promote to durable memory" flow.
9. Add "forget/remove" flow with confirmation.
10. Add tags/categories.
11. Add graph view link if available.
12. Add import/export controls.
13. Add markdown preview.
14. Add validation for malformed memory files.
15. Add role-based grouping for USER/MEMORY/skills.
16. Add source references for generated entries.
17. Add duplicate detection.
18. Add mobile editor pass.
19. Add empty state for no search query/results.
20. Add smoke tests for read/search/edit paths.

## Skills

1. Add installed count in the header once data loads.
2. Add install health/status per skill.
3. Add compatibility warnings.
4. Add skill source provenance.
5. Add "recently used" sorting.
6. Add "update available" per skill if supported.
7. Add uninstall confirmation showing affected commands.
8. Add skill detail drawer.
9. Add screenshots/examples for marketplace skills.
10. Add search highlighting.
11. Add tag chips instead of only selects.
12. Add installed vs marketplace sync status.
13. Add failed install recovery.
14. Add bulk update.
15. Add local skill validation.
16. Add usage analytics link to Dashboard.
17. Add copy invocation examples.
18. Add permission/security review panel.
19. Add better zero-state when no skills are installed.
20. Add smoke tests for marketplace search and install modal.

## MCP

1. Add server health summary counts.
2. Add transport type badges.
3. Add tool count per server.
4. Add last test result timestamp.
5. Add log drawer surfaced from each card.
6. Add secret redaction validation.
7. Add OAuth/setup status.
8. Add disabled reason on unavailable buttons.
9. Add import/export config.
10. Add marketplace/install flow parity with Skills.
11. Add search by tool name, not only server name.
12. Add group by installed/marketplace/local.
13. Add bulk test.
14. Add restart server control where safe.
15. Add conflict detection for duplicate server names.
16. Add config diff before edits.
17. Add placeholder token warnings inline.
18. Add route-level fallback-mode explanation.
19. Add mobile card action menu.
20. Add smoke tests for test/edit/delete dialog behavior.

## Profiles

1. Add active profile badge in the global shell.
2. Add profile comparison.
3. Add duplicate/clone profile.
4. Add import/export.
5. Add validation before activation.
6. Add last used timestamp.
7. Add usage metrics per profile.
8. Add profile-specific model/provider summary.
9. Add profile search.
10. Add profile tags.
11. Add edit details drawer.
12. Add safe delete confirmation.
13. Add monitoring tab explanation.
14. Add profile drift detection against files.
15. Add quick activate from card.
16. Add default profile recovery.
17. Add profile templates.
18. Add audit log for changes.
19. Add mobile list/card refinement.
20. Add smoke tests for create/read/activate/delete.

## Meetings

1. Add sync status and last Graph pull time.
2. Add calendar connection health.
3. Add meeting priority scoring.
4. Add "prep now" primary action for next meeting.
5. Add action item extraction confidence.
6. Add owner/due date edit inline.
7. Add reviewed/unreviewed counts.
8. Add bulk review actions with undo.
9. Add meeting type filters.
10. Add attendee search/filter.
11. Add join link health checking.
12. Add transcript/notes attachment state.
13. Add follow-up draft generation.
14. Add action export to Tasks/To Do.
15. Add week load visualization.
16. Add stale meeting record cleanup.
17. Add selected meeting details drawer.
18. Add keyboard navigation through meetings.
19. Add mobile two-pane fallback.
20. Add smoke tests for force sync, search, mark reviewed, and add action item.

## Presence

1. Add current authoritative presence source.
2. Add Teams sync result timeline.
3. Add device presence merge explanation.
4. Add status expiration/auto-reset.
5. Add calendar-aware suggested status.
6. Add manual override duration.
7. Add Graph auth health.
8. Add M5 device last seen/battery.
9. Add preview vs apply distinction.
10. Add failed sync remediation.
11. Add status history.
12. Add office display mode.
13. Add privacy mode.
14. Add webhook/event subscription status.
15. Add "sync now" progress state.
16. Add conflict warning when multiple sources disagree.
17. Add status templates.
18. Add mobile quick status selector.
19. Add accessibility labels for status buttons.
20. Add smoke tests for preview and manual sync.

## ConnectWise

1. Add live PSA connection health and last pull time.
2. Add board/queue filters.
3. Add urgent ticket count.
4. Add approval queue card.
5. Add stale ticket detector.
6. Add direct-report workload trend.
7. Add recurring issue clustering.
8. Add SLA breach warnings.
9. Add customer/account drilldown.
10. Add ticket owner routing suggestions.
11. Add standup action extraction.
12. Add refresh progress state.
13. Add source links to PSA records.
14. Add safe mutation guardrails.
15. Add "create follow-up task" action.
16. Add exception report export.
17. Add role-based views for manager vs engineer.
18. Add empty/permission-denied states.
19. Add mobile dashboard pass.
20. Add smoke tests for briefing refresh and API failure display.

## Barry

1. Clarify Barry's purpose in the header without marketing copy.
2. Add 1-on-1 agenda templates.
3. Add next Barry meeting card.
4. Add action item list.
5. Add history timeline.
6. Add check-in prompts.
7. Add privacy/confidentiality indicator.
8. Add link to related Meetings records.
9. Add create follow-up task.
10. Add refresh status and last synced time.
11. Add empty state when no meetings exist.
12. Add inline notes editor.
13. Add mark reviewed/complete.
14. Add search across Barry notes.
15. Add recurring topic tracker.
16. Add sentiment/concern flags only if source-backed.
17. Add export summary.
18. Add mobile layout pass.
19. Add safe delete/archive for 1-on-1 records.
20. Add smoke tests for new 1-on-1 and refresh.

## Files

1. Add current root path and breadcrumb.
2. Add upload/create file controls where safe.
3. Add preview loading/error states.
4. Add binary file handling.
5. Add file size/type/date columns.
6. Add sort controls.
7. Add recent files.
8. Add pinned folders.
9. Add search result highlighting.
10. Add open in terminal action.
11. Add copy path action.
12. Add rename/delete with confirmation.
13. Add diff preview for text edits.
14. Add markdown rendered preview toggle.
15. Add image/PDF previews.
16. Add permission errors with remediation.
17. Add large file guardrails.
18. Add mobile split-pane fallback.
19. Add hidden files toggle.
20. Add smoke tests for search, preview, and edit.

## Settings

1. Add settings search.
2. Add unsaved changes warning.
3. Add "test connection" near provider/API settings.
4. Add secret redaction and storage location clarity.
5. Add grouped advanced settings behind disclosure.
6. Add validation before save.
7. Add reset-to-default per section.
8. Add export/import settings.
9. Add profile-specific vs global setting labels.
10. Add voice settings link to LILY health.
11. Add provider model availability check.
12. Add terminal backend health check.
13. Add about/version/update status card.
14. Add restart-required indication.
15. Add save result toast that names changed section.
16. Add accessibility labels for checkboxes/selects.
17. Add mobile sidebar-to-tabs conversion.
18. Add audit log for changes.
19. Add documentation links where settings are non-obvious.
20. Add smoke tests for provider save, voice settings, and validation errors.

## Tasks

1. Add status columns or grouped swimlanes.
2. Add due dates.
3. Add assignees.
4. Add priority.
5. Add source links to chat/meeting/job.
6. Add quick add inline input.
7. Add drag/drop reorder.
8. Add done/archive separation.
9. Add recurring tasks.
10. Add filters by owner/status/source.
11. Add search.
12. Add bulk edit.
13. Add reminder/snooze.
14. Add task detail drawer.
15. Add convert to Job.
16. Add export.
17. Add stale task warnings.
18. Add mobile board/list toggle.
19. Add undo for complete/delete.
20. Add smoke tests for new task, show done, and completion.

