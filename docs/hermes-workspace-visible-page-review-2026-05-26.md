# Hermes Workspace Visible Page Review

Generated: 2026-05-26T18:22:52.987Z

Source reviewed: live workspace at http://127.0.0.1:3002/workspace, route config `config/workspace-visible-routes.json`, desktop sidebar, mobile drawer, and screenshots under `.runtime/page-review-2026-05-26/`.

## Menu Organization

- Desktop sidebar is organized as Pinned, Daily, Agent Ops, Knowledge, Systems, Settings.
- Pinned currently contains Dashboard, Phone Cockpit, Chat, LILY, Tasks. This is a sensible daily/operator set, but mobile pins Chat, LILY, Phone Cockpit, Files, Tasks, so desktop and mobile differ.
- Daily contains Meetings, 75 Hard/Soft, PTO Tracker, Barry. This is coherent for personal cadence, but Dashboard should arguably be Daily if it is not pinned.
- Agent Ops contains Conductor, Operations, Ops Intel, Swarm, Jobs, ConnectWise, Presence. This is coherent, though Presence could also belong to Daily depending on whether it is used as personal status or device operations.
- Knowledge contains Files, Memory, Skills, MCP, Profiles. Files and Profiles are debatable: Files can be Systems/Knowledge; Profiles can be Agent Ops/Settings. The current placement is acceptable if the mental model is "agent knowledge/config material".
- Systems currently appears as a header in desktop extraction but no visible Terminal/Health item because the section is collapsed by default; this makes it look empty. Add a count or keep Systems expanded until it has enough items.
- Settings is collapsed and also duplicated in the footer/user menu. That is okay, but the section needs visible disclosure state and at least the Settings route should be obvious.
- Mobile drawer mirrors the requested group labels and includes Terminal under Systems and Settings under Settings. This is better than desktop for discoverability.
- Mobile pinned pages are five as requested, but they differ from desktop: Files is pinned instead of Dashboard. Pick one canonical five-item set across both surfaces.
- The route smoke captured two text mismatches: /phone did not expose "Phone Cockpit" in body text during the route pass, and /chat/main did not expose "Begin a session". These are smoke/accessibility issues, not necessarily visual blockers.

## Page Recommendations

### /dashboard

Evidence: headings: Hermes Workspace | Today | Now | Next | Daily Loops | Action Required; issues: none; screenshot: `.runtime/page-review-2026-05-26/dashboard.png`.

1. Add a fixed "Start here" lane that ranks the next three actions by urgency and confidence.
2. Make each dashboard card expose its source, freshness, owner, and last successful refresh in a consistent footer.
3. Add one-click filters from Today, Now, and Next into Tasks, Meetings, LILY, and Operations.
4. Collapse lower-priority analytics into an expandable "details" band so the first viewport stays operational.
5. Add a "what changed since last visit" module sourced from session, task, and ops deltas.
6. Give stale gateway/session states a repair CTA that explains the expected command or route.
7. Surface cost guard/model fallback health beside cache and usage cards.
8. Add a dashboard layout preset switcher for Morning, Meeting, Focus, and Closeout modes.
9. Let the weekly utilization card pin a recommended next action into Tasks.
10. Add keyboard shortcuts visible in tooltips for Refresh All, New Chat, Open Tasks, and Open Meetings.
11. Make Action Required support "blocked by me" versus "waiting on others" tabs.
12. Add compact mobile summary ordering: needs Tyler, next meeting, urgent task, stale source, inbox.
13. Add a "copy status brief" button that emits a short operator-ready report.
14. Link every stale badge to the exact diagnostic bundle section that explains it.
15. Add empty-state guidance when sessions or overview are unavailable instead of only showing zeroes.
16. Use consistent severity colors across gateway, sessions, LILY, phone, and operations cards.
17. Add an acknowledgement state for warnings Tyler has reviewed but not fixed yet.
18. Add per-card hide/pin controls and persist them per workflow mode.
19. Add a recency-sorted activity strip for the last five meaningful workspace events.
20. Add a dashboard health score that is computed from stale data, failed routes, auth, LILY, and queue state.

### /phone

Evidence: headings: none captured; issues: smoke text not visible: Phone Cockpit; screenshot: `.runtime/page-review-2026-05-26/phone-cockpit.png`.

1. Make the route smoke text visible on mobile by ensuring "Phone Cockpit" is rendered in accessible page text.
2. Pin Needs Tyler, Capture, Next Meeting, and LILY mic above optional cards in low-data mode.
3. Add a single "at a glance" strip: next event, urgent tasks, waiting replies, desk state, source health.
4. Make capture mode deep links focus the text box and announce the selected mode for screen readers.
5. Add haptic confirmation for successful route-deeplink activation, not just manual taps.
6. Add a "safe to ignore" state for stale desk or source warnings that are expected during off-hours.
7. Provide one-tap creation for task, note, draft, and meeting prep from the top action bar.
8. Add offline queue age, retry count, and last error per queued capture.
9. Add a collapsible "commute readout" that can be copied or read aloud by LILY.
10. Let Reply Later auto-fill suggested draft intent from focused inbox messages.
11. Add a persistent bottom mini composer for quick notes when scrolled deep into Work/System tabs.
12. Add calendar join/prep priority ordering to avoid burying imminent meetings.
13. Add "waiting on me" and "waiting on others" counts beside urgent task counts.
14. Make high-contrast and low-data toggles available from the mobile header as well as inside the page.
15. Add a source health drawer with exact endpoint, checked-at time, and retry action.
16. Add install/PWA readiness checklist for daily phone use.
17. Add per-card pinning so Tyler can keep ConnectWise, 75 tracker, or Desk mode near the top.
18. Add voice-loop status chips for browser mic, LiveKit transport, worker, and actual speaking state.
19. Add one-button "closeout capture" that creates tomorrow tasks from loose notes.
20. Add a mobile screenshot smoke fixture so blank body/text regressions are caught automatically.

### /lily

Evidence: headings: LILY; issues: none; screenshot: `.runtime/page-review-2026-05-26/lily.png`.

1. Distinguish browser hands-free permission, LiveKit transport, worker online, and agent speaking as separate states.
2. Add a real "test voice loop" button that reports the exact failing stage.
3. Persist transcripts, user decisions, and accepted suggestions into the right Hermes/PAI memory surface.
4. Add typed fallback as a first-class control beside mic start, not just a backup path.
5. Show the active audio input/output devices and permission status.
6. Add a compact recent transcript timeline with decisions, tasks created, and memory writes.
7. Add a "last heard" and "last spoke" freshness badge.
8. Expose LiveKit token expiry and refresh status in the diagnostics area.
9. Add a muted/listening/speaking visual state that is readable without relying on animation.
10. Add a one-click diagnostics copy that separates browser, worker, network, and config sections.
11. Add failure-specific CTAs: grant mic, start worker, refresh token, switch browser, use typed fallback.
12. Add Safari/Chrome capability explanation when speech recognition is missing.
13. Add conversation mode presets: daily brief, meeting prep, task triage, system check.
14. Add a short command palette for common LILY actions.
15. Add an "ask LILY what changed" prompt wired to workspace deltas.
16. Add a transcript privacy indicator and retention control.
17. Add background wake-word availability only when the browser can actually support it.
18. Add E2E coverage for mic denied, typed fallback, token refresh, worker offline, and speaking state.
19. Add a mobile docked LILY control that can jump back to this page with context.
20. Add explicit handoff from LILY output to Tasks, Notes, Drafts, and Meetings.

### /chat/main

Evidence: headings: Agent View; issues: smoke text not visible: Begin a session; screenshot: `.runtime/page-review-2026-05-26/chat-main.png`.

1. Make the mobile smoke text "Begin a session" visible or update the route config to match the current empty state.
2. Add a stronger empty-state path: new session, resume latest, choose profile, or open command palette.
3. Show active model/provider/fallback status directly in the composer header.
4. Add cost guard state beside model selection before paid calls happen.
5. Add quick actions for task, note, draft, and agent job in the composer toolbar.
6. Surface session freshness and last save status so users know history is durable.
7. Add a "send to LILY" handoff for voice follow-up.
8. Add a split between user messages, tool calls, decisions, and generated artifacts in the session timeline.
9. Add a one-click "extract tasks from this chat" action.
10. Add a persistent "blocked by me" detector from chat content.
11. Add a "waiting on others" detector and follow-up scheduler.
12. Add session labels by workflow mode: Daily, Agent Ops, Knowledge, Systems.
13. Add pinned prompts for Tyler’s recurring workflows.
14. Add clearer loading copy when sessions are still loading.
15. Add error-specific recovery when session loading fails.
16. Add keyboard shortcut hints for new session, command palette, attach, and submit.
17. Add copy/export formats for Markdown, task list, and decision log.
18. Add a quality gate when the assistant proposes risky shell or workspace mutations.
19. Add a mini diagnostics drawer for current session auth, model, gateway, and stream state.
20. Add a compact mobile composer mode optimized for daily at-a-glance use.

### /playground

Evidence: headings: none captured; issues: none; screenshot: `.runtime/page-review-2026-05-26/hermesworld.png`.

1. Clarify whether HermesWorld is an external/fullscreen experience or a workspace tool.
2. Add a visible loading/fallback state if the embedded world fails to initialize.
3. Expose "Open full" as the primary action and keep workspace navigation secondary.
4. Add a short status line for runtime, websocket, assets, and input readiness.
5. Add a screenshot smoke that verifies the scene is not blank.
6. Add reduced-motion and photosensitive toggles in the first viewport.
7. Add a "return to workspace" breadcrumb in fullscreen mode.
8. Add quick links from game concepts back to Conductor, Swarm, Memory, and Skills.
9. Add asset loading progress and exact failed asset names.
10. Add keyboard/gamepad control hints in a collapsible help panel.
11. Add save/profile status for world progress.
12. Add diagnostics for browser WebGL/WebGPU capability.
13. Add mobile orientation guidance when viewport is too small.
14. Add an in-world LILY help action.
15. Add performance budget badges for FPS, memory, and asset weight.
16. Add a "safe mode" low-effects launch option.
17. Add smoke coverage for desktop and mobile framing.
18. Add direct links to generated worlds or scenes.
19. Add clear separation between demo content and operational workspace actions.
20. Add a launch checklist before calling external hosted runtime.

### /files

Evidence: headings: Recent changes; issues: none; screenshot: `.runtime/page-review-2026-05-26/files.png`.

1. Make recent changed files the default view and keep folders as a secondary mode.
2. Add ownership/source chips: workspace file, generated file, runtime file, config file.
3. Add dirty-git awareness so users do not overwrite unrelated changes.
4. Add a safe preview/edit distinction before opening large or binary files.
5. Add filters for recently changed, untracked, generated, docs, tests, config, runtime.
6. Add a "copy file reference" action using absolute path and line number.
7. Add quick open for the current route/component/source files.
8. Add warnings for files outside the intended workspace boundary.
9. Add diff preview for modified files.
10. Add last modified by process/source where available.
11. Add search scopes saved by workflow mode.
12. Add pinned project areas: routes, screens, server, scripts, docs.
13. Add image/document preview quality controls.
14. Add batch export for selected diagnostics files.
15. Add keyboard shortcuts for search, refresh, new file, and copy path.
16. Add a file health card for huge files, stale generated files, and missing tests.
17. Add direct links from route smoke failures to likely files.
18. Add breadcrumbs that match repo ownership boundaries.
19. Add empty-state copy for zero counts that explains backend state.
20. Add read-only mode indicator when running against protected runtime files.

### /terminal

Evidence: headings: none captured; issues: none; screenshot: `.runtime/page-review-2026-05-26/terminal.png`.

1. Add the active cwd prominently and make it copyable.
2. Add a command-risk banner for destructive commands before execution.
3. Add workspace-specific quick commands: build, focused tests, route smoke, restart, health.
4. Add session persistence status and reconnect state.
5. Add separate tabs for shell, logs, and task runners.
6. Add command history search scoped to this workspace.
7. Add output bookmarking for errors, URLs, and file paths.
8. Add one-click copy of last command and last error.
9. Add a safe restart button for workspace service from a confirmed control.
10. Add environment badges: node, pnpm, cwd, branch, launchd status.
11. Add a split view to keep diagnostics visible while navigating pages.
12. Add high-signal parser cards for build/test failures.
13. Add rate-limited terminal stream health if output stalls.
14. Add mobile command palette instead of relying on full terminal input.
15. Add privacy redaction for secrets before copy/export.
16. Add shell profile/source indicator.
17. Add warnings when command output is truncated.
18. Add links from terminal file paths into Files.
19. Add recovery action when terminal backend is disconnected.
20. Add per-workflow command presets for Daily, Agent Ops, Knowledge, Systems.

### /jobs

Evidence: headings: Jobs; issues: none; screenshot: `.runtime/page-review-2026-05-26/jobs.png`.

1. Keep failed jobs first and add failure age/severity sorting.
2. Add next scheduled run and last successful run per job.
3. Add owner/source chips: Codex, Hermes, launchd, workflow, manual.
4. Add safe rerun controls with dry-run where possible.
5. Add a paused/stale/disabled distinction instead of only status counts.
6. Add quick links to logs and owning scripts.
7. Add failure family classification: auth, network, file lock, DB, API, export.
8. Add a "needs Tyler" queue for jobs blocked on credentials or approval.
9. Add trend sparkline for failures over seven days.
10. Add retry policy display and next retry time.
11. Add one-click copy of a job incident report.
12. Add filters for paid-call jobs and cost-guard state.
13. Add dependency map showing upstream/downstream jobs.
14. Add last output preview with exact error text.
15. Add stale data badges for jobs not observed recently.
16. Add bulk actions for refresh selected, pause selected, export selected.
17. Add tests for search/filter persistence.
18. Add mobile compact view: failed, running, next due, blocked.
19. Add completion SLA/expected duration per job.
20. Add clear empty-state explanation when the backend returns zero jobs.

### /tasks

Evidence: headings: Tasks; issues: none; screenshot: `.runtime/page-review-2026-05-26/tasks.png`.

1. Add "blocked by me" and "waiting on others" as first-class sections above the board.
2. Add deep-linkable filters for every saved filter and assignee combination.
3. Add quick task creation from selected text, chat, meeting, LILY, and phone capture.
4. Add stale-source and backend health badges at the board level.
5. Add due-date lanes for today, this week, later, no date.
6. Add priority triage mode that hides done/deleted and surfaces overdue first.
7. Add owner workload summary across assignees.
8. Add task provenance: created from chat, meeting, note, manual, automation.
9. Add follow-up reminders and waiting-on-person fields.
10. Add batch move/assign/export actions.
11. Add keyboard shortcuts for new task, search, filter, move, complete.
12. Add per-card diagnostics for failed launches or linked sessions.
13. Add links from tasks to related chat/session/meeting/files.
14. Add a mobile single-column daily queue.
15. Add import/export that preserves IDs and provenance.
16. Add empty-state prompts for zero tasks that still encourage capture.
17. Add WIP limits by column.
18. Add "review with Tyler" lane for agent-created tasks.
19. Add conflict warning when human reviewer gates done state.
20. Add test coverage for route search create/filter behavior in UI rendering.

### /75-tracker

Evidence: headings: none captured; issues: none; screenshot: `.runtime/page-review-2026-05-26/75-tracker.png`.

1. Add visible page title and summary stats in the first viewport.
2. Add today completion ring for water, workout, reading, diet, progress photo, and custom habits.
3. Add hard/soft mode toggle with clear rule differences.
4. Add streak, missed days, and recovery plan.
5. Add quick mobile checkboxes with large tap targets.
6. Add data source/freshness indicator if synced from health or notes.
7. Add calendar heatmap for the current challenge window.
8. Add morning and evening nudges tied to phone cockpit.
9. Add weekly trend card for adherence and weak spots.
10. Add export/share report for accountability.
11. Add edit history to prevent accidental habit toggles.
12. Add custom habit templates.
13. Add reminders for incomplete daily items.
14. Add "what remains today" card at top.
15. Add shortcut to create task for missed or blocked habit.
16. Add source warning when data is absent rather than showing a blank page.
17. Add mobile smoke text and screenshot assertion for the page title.
18. Add LILY readout for progress summary.
19. Add integration with dashboard Daily Loops.
20. Add empty-state setup wizard for first-time use.

### /conductor

Evidence: headings: none captured; issues: none; screenshot: `.runtime/page-review-2026-05-26/conductor.png`.

1. Add mission templates sorted by Tyler’s common workflows.
2. Add a clear launch form with goal, constraints, verification, and handoff target.
3. Add worker availability and capability fit before mission launch.
4. Add cost/paid-call guard status before spawning agents.
5. Add model/provider fallback explanation for mission execution.
6. Add mission checkpoint timeline with files touched and commands run.
7. Add review gate before any write/destructive action.
8. Add links from completed outputs to Files, Tasks, Memory, and Chat.
9. Add "resume failed mission" and "clone mission" actions.
10. Add active/blocked/review-needed mission filters.
11. Add exact terminal/log panel per worker.
12. Add task extraction from mission outputs.
13. Add swarm handoff summary with next exact action.
14. Add browser QA launch option for frontend missions.
15. Add runbook capture when a mission changes operations behavior.
16. Add mobile operator view that only shows active mission state and blockers.
17. Add warning if backend gateway or worker pool is stale.
18. Add smoke tests for launch form validation and offline worker state.
19. Add dry-run estimate before launching a large mission.
20. Add archive/completion workflow that writes durable evidence.

### /operations

Evidence: headings: Operations | Main Agent | Workspace | work-m365 | ops-maintenance | creative; issues: none; screenshot: `.runtime/page-review-2026-05-26/operations.png`.

1. Add a single agent health table with status, owner, last action, queue, and error.
2. Add "needs Tyler" across agents, tickets, and messages.
3. Add separate sections for blocked by me and waiting on others.
4. Add safe restart controls for gateway, workspace, LILY worker, and selected agents.
5. Add stale-data badges to every agent and operational card.
6. Add output diff viewer for agent-generated artifacts.
7. Add worker capability labels and current assignment.
8. Add launchd/process status alongside app-reported status.
9. Add log tail previews with exact latest error.
10. Add dependency map between agents, jobs, and scripts.
11. Add filters for active, idle, failed, needs setup, noisy, recently changed.
12. Add bulk refresh and diagnostics export.
13. Add source ownership: Hermes runtime, Codex wrapper, workspace UI.
14. Add incident history per agent.
15. Add auto-collapse passive/healthy status cards.
16. Add mobile commander view: failed, blocked, active, restart.
17. Add safeguards before restarting anything that mutates Graph or external systems.
18. Add route links from each agent to relevant pages.
19. Add cost/model health where agents call models.
20. Add clear empty state when no jobs are attached to agents.

### /ops-intelligence

Evidence: headings: Ops Intelligence | Production Readiness | Dependency Sentinel | Incident Inbox | Script Ownership Registry | Approval Queue Seeds; issues: none; screenshot: `.runtime/page-review-2026-05-26/ops-intelligence.png`.

1. Promote top three production risks into a fixed header.
2. Add evidence links for every recommendation and incident.
3. Add filters by risk family: auth, runtime, data, CI, route, model, cost.
4. Add status for recommendation rollout progress tied to task IDs.
5. Add ownership map from scripts to pages, jobs, and agents.
6. Add "changes since last update" panel here and on dashboard.
7. Add export formats for JSON, Markdown report, and task-import list.
8. Add route coverage matrix with desktop/mobile pass state.
9. Add stale-data badges by probe with exact last success.
10. Add dependency sentinel drill-down for degraded upstreams.
11. Add incident acknowledgement and suppression windows.
12. Add severity scoring with reason, confidence, and blast radius.
13. Add links to create remediation tasks directly from each finding.
14. Add CI comparison: local passing checks versus latest remote checks.
15. Add model/provider/cost guard audit summary.
16. Add safe restart readiness checklist.
17. Add mobile top-risk cards only, with details behind drill-down.
18. Add diff from previous report to avoid rereading stable findings.
19. Add test coverage for data normalization and empty states.
20. Add printable executive summary for weekly review.

### /swarm

Evidence: headings: Swarm | Main Agent | Workspace | chief-of-staff | coding | creative; issues: none; screenshot: `.runtime/page-review-2026-05-26/swarm.png`.

1. Clarify the distinction between Swarm, Conductor, Operations, and Ops Intelligence.
2. Add live worker cards with status, assignment, last heartbeat, and queue depth.
3. Add mission-to-worker mapping with blocked/review-needed indicators.
4. Add launch template links back to Conductor.
5. Add worker capability matrix and recommended worker for a task.
6. Add cost guard and model/provider health per worker.
7. Add active mission timeline before visual/secondary content.
8. Add safe stop/pause/resume controls with confirmation.
9. Add stale heartbeat badges.
10. Add recent reports and handoffs in a dedicated panel.
11. Add "requires Tyler" lane across all worker output.
12. Add log/error previews per worker.
13. Add worker setup diagnostics for missing profiles or tools.
14. Add mobile compact view: active, blocked, handoff, logs.
15. Add search/filter by worker, capability, mission, status.
16. Add direct create-task-from-output action.
17. Add swarm utilization trend over time.
18. Add snapshot export for current swarm state.
19. Add route smoke coverage for worker detail interactions.
20. Add clear empty-state when workers are detected but inactive.

### /memory

Evidence: headings: none captured; issues: none; screenshot: `.runtime/page-review-2026-05-26/memory.png`.

1. Add tabs for active regression/watch files, recent memories, stale memories, and all files.
2. Add memory provenance: source session, automation, manual note, imported doc.
3. Add freshness and last-used badges for each memory file.
4. Add search with semantic plus filename filters.
5. Add warnings for stale memories older than a threshold.
6. Add "promote to durable memory" workflow from chat/tasks/LILY.
7. Add preview diff for memory updates before write.
8. Add duplicate/conflict detection across memory files.
9. Add owner/scope labels: machine-wide, workspace, Hermes, Codex, mailbox.
10. Add quick copy of recall commands.
11. Add graph view or backlinks for connected memory topics.
12. Add route links from memory entries to affected workspace pages.
13. Add safe delete/archive workflow with confirmation.
14. Add memory health metrics: count, stale, broken links, last index.
15. Add mobile quick recall for daily use.
16. Add tests for memory registry parsing and stale sorting.
17. Add empty-state guidance when local memory index is missing.
18. Add integration with Ops Intelligence recommendation evidence.
19. Add "review this memory" task creation.
20. Add LILY readout and writeback status for memory actions.

### /skills

Evidence: headings: Skills Browser; issues: none; screenshot: `.runtime/page-review-2026-05-26/skills.png`.

1. Add meaningful data source state when counts are zero: loading, empty, unavailable, or disabled.
2. Add used recently, installed, available, broken, and risky tabs with counts.
3. Add skill provenance: bundled, curated plugin, local, project, generated.
4. Add install/update/remove actions with dry-run and confirmation.
5. Add compatibility checks against current workspace tools.
6. Add search by task intent, not only skill name.
7. Add recommended skills for current visible page.
8. Add broken-skill diagnostics with missing files or bad metadata.
9. Add last invoked and success/failure stats.
10. Add favorite/pinned skills.
11. Add security review badges for skills that can mutate files or call network.
12. Add docs preview from SKILL.md without leaving page.
13. Add route links to pages that use each skill.
14. Add compare installed versus latest curated version.
15. Add mobile compact launcher for top skills.
16. Add export of skill inventory.
17. Add tests for zero-state and hub-unavailable branches.
18. Add onboarding wizard for creating a new skill.
19. Add command palette integration for skill invocation.
20. Add LILY/voice command mapping for daily skill use.

### /mcp

Evidence: headings: MCP Servers; issues: none; screenshot: `.runtime/page-review-2026-05-26/mcp.png`.

1. Replace "not available" with a diagnostic checklist showing gateway, config, auth, and probe state.
2. Add a clear connect/retry action when backend support is missing.
3. Add expected config path and detected config path.
4. Add server inventory when available: status, tools, latency, errors.
5. Add presets for common Tyler workflows.
6. Add per-server test connection button.
7. Add log snippets for failed MCP startup.
8. Add security indicators for remote tools and file access.
9. Add install/update actions only when safe and supported.
10. Add model context protocol explanation in a collapsible help section.
11. Add route links to Settings provider/backend configuration.
12. Add stale cache indicators for tool catalogs.
13. Add search over tools, not just servers.
14. Add mobile read-only status page for daily checks.
15. Add command palette action to open failed MCP diagnostics.
16. Add tests for unavailable backend branch.
17. Add export diagnostics button specific to MCP.
18. Add ownership: which agent/job depends on which MCP server.
19. Add paid-call/cost guard status if MCP tools can trigger models.
20. Add empty-state copy that says what to do next and what not to do.

### /profiles

Evidence: headings: Profiles; issues: none; screenshot: `.runtime/page-review-2026-05-26/profiles.png`.

1. Load profiles immediately or show a precise loading/unavailable state.
2. Add profile health score: missing fields, stale prompts, broken tools, risky permissions.
3. Add active profile indicator used by chat/LILY/agents.
4. Add profile comparison view.
5. Add create/edit workflow with validation and preview.
6. Add monitoring tab that explains what is watched and when.
7. Add links from profiles to Operations agents using them.
8. Add last used and success stats per profile.
9. Add import/export profile bundle.
10. Add tags for role, workflow, model preference, tool access.
11. Add warning for profiles that allow destructive actions.
12. Add duplicate profile detection.
13. Add pinned profiles for daily use.
14. Add mobile quick activate/deactivate controls.
15. Add tests for malformed profile files.
16. Add search by capability and workflow.
17. Add profile audit history.
18. Add suggested profile for current page/action.
19. Add LILY voice persona mapping.
20. Add clear empty state if ~/.hermes/profiles is missing or unreadable.

### /meetings

Evidence: headings: Meetings | Today and next | Recent meeting records | Two-week load | Selected meeting; issues: none; screenshot: `.runtime/page-review-2026-05-26/meetings.png`.

1. Put next meeting, join link, prep status, and open action items in the first card.
2. Add meeting-to-task extraction summary with confidence and review state.
3. Add filters for needs review, reviewed, has open actions, no prep, no transcript.
4. Add direct links to Teams/Calendar and local prep notes.
5. Add one-click "mark reviewed and create follow-ups" workflow.
6. Add stale Graph/calendar sync warning with repair CTA.
7. Add meeting owner/attendees and Tyler role classification.
8. Add recurring meeting trend: actions created, actions closed, unresolved carries.
9. Add agenda builder from tasks, previous notes, and LILY memory.
10. Add post-meeting closeout checklist.
11. Add extract decisions versus tasks versus FYIs.
12. Add mobile upcoming-meeting glance view.
13. Add notification hooks into Phone Cockpit before meetings.
14. Add safe manual sync and diagnostics details.
15. Add export meeting brief to Markdown.
16. Add "waiting on others" from meeting follow-ups.
17. Add tests for empty calendar and auth-required branches.
18. Add "prepare with LILY" voice handoff.
19. Add route deep link to selected meeting.
20. Add source freshness on every meeting section.

### /presence

Evidence: headings: Presence | Teams status | Sync diagnostics | Manual sync actions | M5 devices; issues: none; screenshot: `.runtime/page-review-2026-05-26/presence.png`.

1. Add current Teams state, desk state, M5 state, and last sync in one top row.
2. Add clear non-destructive control labels for manual state changes.
3. Add source separation: Graph, M5, local display, workspace cache.
4. Add stale sync warnings with exact failing service.
5. Add quiet-hours and focus-mode indicators.
6. Add one-click away/focus/available presets tied to Phone Cockpit.
7. Add history of recent state changes.
8. Add device inventory with firmware/last seen where available.
9. Add M5 display preview.
10. Add retry action for each sync path.
11. Add warning when manual state differs from Graph state.
12. Add integration with meetings to auto-set busy/DND.
13. Add integration with LILY so voice can report availability truth.
14. Add mobile glance card for status and stale device.
15. Add tests for Graph auth required and M5 unavailable states.
16. Add export diagnostics for support.
17. Add source freshness badges to every card.
18. Add safe restart/reconnect controls for local sync workers.
19. Add daily timeline for availability.
20. Add actionable next step when device is stale.

### /it-ops

Evidence: headings: IT Ops / ConnectWise | Tickets, approvals, and SLA risk | ConnectWise Briefing | Recurring issues | Direct-report action load | Recent standups; issues: none; screenshot: `.runtime/page-review-2026-05-26/connectwise.png`.

1. Add ConnectWise approvals summary directly to the dashboard and keep this page as drill-down.
2. Add urgent ticket queue with SLA, owner, board, status, and next action.
3. Add native ConnectWise approval state verification links.
4. Add ticket trend by recurring issue and direct-report load.
5. Add stale Graph/ConnectWise source badges.
6. Add "blocked by me" and "waiting on customer/vendor" sections.
7. Add safe native-action guidance for approvals/workflows.
8. Add exportable briefing with exact source timestamps.
9. Add links from tickets to tasks and meeting follow-ups.
10. Add authentication/setup diagnostics if ConnectWise is unavailable.
11. Add high-risk SLA alert band.
12. Add filters by board, company, owner, severity, approval state.
13. Add one-click create follow-up task.
14. Add recent standup-to-ticket correlation.
15. Add mobile urgent-only view.
16. Add tests for zero-ticket, auth-required, and stale-source states.
17. Add runbook links for common native PSA workflows.
18. Add approval button proof capture workflow.
19. Add warning before any external/non-native workaround.
20. Add dashboard deep links into urgent, approvals, and waiting queues.

### /barry

Evidence: headings: Barry | Meetings; issues: none; screenshot: `.runtime/page-review-2026-05-26/barry.png`.

1. Add next 1-on-1 date, prep completeness, and open actions in the first card.
2. Add quick create 1-on-1 flow with agenda template.
3. Add wins, blockers, asks, follow-ups, and decisions as separate sections.
4. Add historical action carryover from previous meetings.
5. Add filters for upcoming, completed, archived, needs prep.
6. Add integration with Meetings and Tasks.
7. Add "what should I bring up" suggestions from recent sessions and tasks.
8. Add privacy/visibility indicator for notes.
9. Add export brief for the next meeting.
10. Add post-meeting closeout action extraction.
11. Add mobile prep card for quick review before the meeting.
12. Add stale calendar/source badges.
13. Add reminder when no next 1-on-1 is scheduled.
14. Add links to related ConnectWise/direct-report context if applicable.
15. Add decision log section.
16. Add tests for empty next-meeting state.
17. Add keyboard shortcut/new item action.
18. Add LILY readout for prep summary.
19. Add recurring agenda templates.
20. Add clear archive/restore behavior.

### /settings

Evidence: headings: Settings | Hermes Agent; issues: none; screenshot: `.runtime/page-review-2026-05-26/settings.png`.

1. Add global settings search results that jump directly to the exact section.
2. Add configuration health summary at top: auth, model, provider, voice, display, notifications.
3. Add paid-call guard and default model fallback controls in one place.
4. Add validation status for every external integration credential without exposing secrets.
5. Add "last saved" and persistence target indicators.
6. Add reset-to-default per section.
7. Add import/export settings profile.
8. Add clear separation between chat settings and workspace settings.
9. Add diagnostic bundle shortcut for each settings section.
10. Add mobile simplified settings groups.
11. Add warning before changing settings that affect agents or automations.
12. Add route links from settings sections to affected pages.
13. Add tests for settings search and validation states.
14. Add provider latency/health summary.
15. Add LILY voice setup checklist.
16. Add theme preview and accessibility audit for selected theme.
17. Add keyboard shortcut reference.
18. Add backup/restore path for settings.
19. Add stale config detection when environment and persisted settings disagree.
20. Add setup wizard for first-run or broken-config recovery.
