# Hermes Workspace Look and Code Review - 2026-05-27

## Evidence Reviewed

- Desktop route smoke: 22/22 routes passed with no cleanup warning.
- Mobile route smoke: 23/23 routes passed with no cleanup warning.
- Desktop visual smoke: 22/22 screenshots passed.
- Mobile visual smoke: 23/23 screenshots passed.
- Layout telemetry: every reviewed desktop and mobile route reported `horizontalOverflowPx: 0`.
- Screenshot manifests: `.runtime/workspace-visual-smoke/manifest.json` and `.runtime/workspace-visual-smoke-mobile/manifest.json`.
- DOM snapshot: `.runtime/workspace-page-review-snapshot.json`.
- Source review focus: route files, screen files, shell/navigation files, smoke scripts, and high-line-count screens.

## Cross-Page Priorities

1. Make the agent-update toast less intrusive on mobile; it currently covers first-viewport content on several pages.
2. Add a global "quiet update notice" mode that moves update prompts into the shell header or settings when the user is working.
3. Keep route smoke and visual smoke sequential by default for full-suite verification; parallel visual runs can overload navigation.
4. Add screenshot labels to the visual smoke manifest itself, since ImageMagick contact-sheet labeling is unavailable on this machine.
5. Add one shared page header contract for title, status, primary action, diagnostics, and mobile summary.
6. Add a shared empty/error/loading component for operational pages so fallback states are consistent.
7. Move repeated localStorage reads/writes into typed persistence helpers with schema validation.
8. Split screens above roughly 1,500 lines into data hooks, pure selectors, presentational sections, and tests.
9. Add first-viewport density rules for mobile so the first screen always shows the next best action.
10. Add a route-to-owner registry so each page has an owner, runtime dependency list, smoke text, and escalation path.

## /dashboard - Dashboard

Source focus: `src/routes/dashboard.tsx`, `src/screens/dashboard/dashboard-screen.tsx`.

1. Move the update toast out of the top center of the dashboard; it obscures the most important first-viewport status.
2. Promote "Gateway data stale" to a stronger incident banner with one primary recovery action.
3. Replace the separate severity-color legend with inline severity chips on the items that need interpretation.
4. Collapse the "Dashboard Control Plane" card into a slimmer command bar above the dashboard cards.
5. Add a visible H2 for the main dashboard section so screen readers and DOM snapshots expose structure.
6. Reduce the number of simultaneous card borders in the first viewport; the page reads as a grid of boxes before it reads as priorities.
7. Add a "today only" mobile digest that hides lower-priority analytics until expanded.
8. Make "Waiting on others" clickable into the exact tasks or sessions that created the count.
9. Replace "Overview refreshed never" with a timestamp plus source name and recovery hint.
10. Add a dashboard data freshness hook shared with Phone Cockpit so stale labels stay consistent.
11. Split `dashboard-screen.tsx` into query, control-plane, daily-loop, analytics, and layout modules.
12. Add tests for the "stale gateway" and "no recent workstream" action ranking.
13. Persist daily-loop checklist state through the same typed storage helper used by Tasks.
14. Add keyboard shortcuts for refresh, open tasks, and copy status brief.
15. Make hidden-widget recovery available in the main UI instead of only inside edit mode.
16. Add a compact "next action" card that is visually dominant on desktop and mobile.
17. Convert repeated metric cards to a single metric-card primitive with typed variants.
18. Add loading skeletons for dashboard source refresh instead of swapping directly from stale to loaded text.
19. Add a dashboard diagnostics export that includes source freshness and user-hidden widgets.
20. Keep the dashboard as the default command center, but route deep operational work into the specialized pages faster.

## /phone - Phone Cockpit

Source focus: `src/routes/phone.tsx`, `src/screens/phone/phone-cockpit-screen.tsx`.

1. Move the update toast below the mobile header or into a slim inline strip; it covers the urgent-task headline.
2. Remove the duplicate first-viewport "Loading..." H1 state from the rendered DOM after data is ready.
3. Make "4 urgent tasks" tappable into a filtered task queue with one-tap completion and snooze.
4. Add a low-data mode preview of what will be hidden before the user toggles it.
5. Add a safe-area spacer above the bottom nav so pinned low-data actions are not clipped.
6. Convert "Desk state stale" into a button that explains the stale source and refresh path.
7. Add a single thumb-zone primary action for "Capture" that stays above the bottom navigation.
8. Put "Next meeting" and "Waiting" into one timeline strip so the page feels glanceable.
9. Add a "driving/walking" ultra-compact mode with only urgent count, next event, capture, and LILY mic.
10. Add haptic feedback to the pinned action buttons, matching the mobile menu behavior.
11. Split `phone-cockpit-screen.tsx` into summary hooks, card components, local queue, and mobile layout modules.
12. Move localStorage queue, pinned cards, and collapsed cards behind a typed persistence helper.
13. Add tests for offline capture replay and stale-source display.
14. Add a visible sync state for pending local captures so offline input is not ambiguous.
15. Add a "last opened" recency signal for daily usage habit formation.
16. Make card collapse/pin controls icon-only with labels in accessible names to reduce text density.
17. Add a one-tap "done for now" state that summarizes what remains instead of making the user inspect every card.
18. Keep the tab rail, but shorten the labels when the viewport is narrow.
19. Add a mobile screenshot test that asserts the update toast does not overlap the H1.
20. Share source-health logic with Dashboard, Meetings, Presence, and IT Ops.

## /lily - LILY

Source focus: `src/routes/lily.tsx`, `src/routes/-lily-voice.test.ts`.

1. Move voice setup diagnostics into a progressive checklist with the current blocker highlighted first.
2. Add a stronger "typed fallback active" state so failed voice setup still feels productive.
3. Give the transcript timeline a fixed height with virtualization for long sessions.
4. Add a top-level "voice ready / degraded / unavailable" badge to the first viewport.
5. Make microphone permission state actionable with browser-specific copy and a retry path.
6. Add a mobile sticky mic control that avoids bottom-nav overlap.
7. Split the 1,900-line route into voice state, LiveKit token, typed chat, diagnostics, and transcript components.
8. Extract browser support detection into a shared tested module instead of keeping it near route UI.
9. Add tests for permission denied, token expired, worker offline, and typed fallback handoff.
10. Add a "copy voice diagnostics" button that redacts token and device identifiers.
11. Add a first-run setup card that only appears when a required voice dependency is missing.
12. Keep "Start LILY" as the primary action, but disable it with a clear reason when prerequisites fail.
13. Add latency and last-heard indicators for the voice loop.
14. Add clear reconnect behavior after network loss instead of relying on page reload.
15. Use the same settings route-link pattern as Settings for model, voice, and notification setup.
16. Add a compact mobile state that shows only mic, transcript last line, and typed fallback.
17. Move LiveKit error normalization into a utility with unit tests.
18. Add an accessibility pass for live transcript announcements.
19. Add an end-of-session summary handoff to Tasks or Chat.
20. Add a LILY-specific visual smoke assertion that the mic control is visible on mobile.

## /chat/main - Chat

Source focus: `src/screens/chat/chat-screen.tsx`, `src/screens/chat/components/*`.

1. Add a real H1 or visually hidden page title for Chat; the DOM snapshot currently has no H1.
2. Move the update toast away from the chat status strip; it competes with model/session state.
3. Reduce the top diagnostics panel height when the chat is empty so the composer feels closer to the center task.
4. Make "Begin a session" the only dominant empty-state headline and demote secondary tool chips.
5. Add a first-run command rail that is hidden after the first successful message.
6. Add a one-click "resume latest with context" action that explains what context will be restored.
7. Keep the composer sticky, but reserve bottom-right space so diagnostics and floating buttons do not collide.
8. Split `chat-screen.tsx` into session lifecycle, composer state, message streaming, layout, and command handlers.
9. Move sessionStorage recovery behavior into a typed hook with tests for stale waiting state.
10. Revisit the TODO in `use-realtime-chat-history.ts` and either remove it or add a tracked follow-up test.
11. Virtualize long message lists and artifact previews to protect mobile memory.
12. Add a route-level diagnostic bundle for active session, model, provider, tools, and recovery state.
13. Add a "safe mutation gate" affordance that clearly shows why a risky action is blocked.
14. Make the profile selector more prominent when the selected profile changes tool availability.
15. Add visual distinction between local-only drafts, sent messages, and backend-confirmed messages.
16. Convert repeated status chips into a shared compact status component.
17. Add keyboard shortcut discovery inside command palette instead of inline text in the main surface.
18. Add tests for empty-state command chips, resume latest, and failed send recovery.
19. Add a mobile composer mode that starts with capture first and expands to full tools on demand.
20. Add page-level performance budget checks because Chat is one of the highest-control-count pages.

## /playground - HermesWorld

Source focus: `src/routes/playground.tsx`, `src/screens/playground/playground-screen.tsx`, `src/screens/playground/components/*`.

1. Add a real H1 or visually hidden page title; the route currently has no H1 in the DOM snapshot.
2. Keep the launch checklist, but make the primary "enter world" action visually dominant.
3. Add a WebGL capability preflight before loading expensive 3D assets.
4. Add a reduced-motion and low-GPU mode for daily mobile usage.
5. Add a loading progress indicator for GLB and texture assets.
6. Add an escape hatch when the 3D scene fails instead of only logging render failure.
7. Split large playground state into world, RPG, multiplayer, settings, and narration modules.
8. Add smoke assertions that the canvas has nonblank pixels after scene load.
9. Add mobile-safe HUD placement that cannot collide with bottom navigation.
10. Add a "daily reward / next quest" summary for quick non-game use.
11. Add persistent but resettable character customization state with schema versioning.
12. Move admin/owner localStorage clearing into a named security helper.
13. Add accessibility alternatives for key game actions outside the canvas.
14. Add a diagnostics panel for FPS, connection state, asset load, and input mode.
15. Add tests around settings persistence and photosensitive warning behavior.
16. Add route-specific bundle budget monitoring because this page can dominate load cost.
17. Make "open full" copy more specific to the action it performs.
18. Add a mobile landscape orientation recommendation only when the device is narrow.
19. Keep game visuals richer than operations pages, but reduce nonessential panel borders.
20. Add a graceful fallback to a 2D map or journal if 3D cannot initialize.

## /files - Files

Source focus: `src/routes/files.tsx`, `src/screens/files/files-screen.tsx`.

1. Add a real H1 or visually hidden page title; the visible page currently exposes no H1.
2. Replace route-level reload fallback with a shared route error component and retry action.
3. Make current workspace/path the strongest first-viewport signal.
4. Add a breadcrumb that remains sticky while browsing deep folders.
5. Add file operation status for copy, move, rename, delete, and upload.
6. Add a diff-preview affordance before destructive edits or overwrites.
7. Split the 2,100-line screen into browser, preview, operations, recent changes, and API hooks.
8. Add tests for path traversal protection from the UI, not just API behavior.
9. Add keyboard navigation for file list, preview pane, and action menu.
10. Add file-type icons that are consistent with the rest of the workspace icon system.
11. Add mobile file actions as a bottom sheet instead of dense inline controls.
12. Add a "recently touched by agent" filter for Tyler's workflow.
13. Add a "pin workspace root" control for common folders.
14. Add preview loading skeletons to avoid blank pane ambiguity.
15. Add search result highlighting inside the file browser.
16. Add a diagnostic bundle for current path, root, last API error, and selected file.
17. Add clearer disabled states when an operation is unavailable.
18. Add an undo window for local rename/delete operations when possible.
19. Add visual smoke coverage for preview pane open state.
20. Reduce card count in the first viewport so the file list reads as the main object.

## /terminal - Terminal

Source focus: `src/routes/terminal.tsx`, `src/components/terminal/terminal-workspace.tsx`.

1. Add a real H1 or visually hidden title for Terminal.
2. Replace route-level reload fallback with shared route recovery UI.
3. Keep the terminal surface visually dominant; move secondary controls into a compact toolbar.
4. Add explicit session state: connected, reconnecting, detached, failed, and read-only.
5. Add a mobile-first command palette for common safe commands.
6. Add a clear "dangerous command" interlock before destructive shell actions.
7. Split `terminal-workspace.tsx` into transport, tabs, xterm adapter, toolbar, and diagnostics modules.
8. Add tests for reconnect after HMR/reload and detached PTY recovery.
9. Add a visible current working directory chip for every terminal tab.
10. Add command history search scoped per tab.
11. Add copy-output and save-output actions with clear truncation behavior.
12. Add keyboard shortcuts for new tab, close tab, next tab, and clear.
13. Add mobile safe-area padding so terminal input does not collide with bottom controls.
14. Add high-contrast terminal theme validation.
15. Add a route smoke assertion that xterm rendered at least one terminal row.
16. Add a diagnostic bundle for session id, shell, cwd, transport, and last close reason.
17. Add idle timeout warnings before backend session reaping.
18. Add a "resume last terminal" state when a PTY is still alive.
19. Reduce inline explanatory text and rely on icons/tooltips for known terminal actions.
20. Add a read-only mode for reviewing output without accidental input on mobile.

## /jobs - Jobs

Source focus: `src/routes/jobs.tsx`, `src/screens/jobs/jobs-screen.tsx`.

1. Make the next scheduled job and last failed job the two strongest visual elements.
2. Add clear grouping by automation owner: Hermes, Codex, workspace, and external.
3. Add a failure-recovery CTA directly on failed job rows.
4. Add "last run duration" and "next run" as aligned columns for scanability.
5. Add a compact mobile card layout that hides low-priority metadata.
6. Add filters for failed, stale, paused, and recently changed jobs.
7. Add a no-op success state that respects automation contracts like silent or no reply.
8. Extract job table, dialogs, filters, and action handlers from `jobs-screen.tsx`.
9. Add tests for run recovery labels and scheduled retry text.
10. Add optimistic action states for pause/resume/run now.
11. Add a safe confirmation flow for disabling important jobs.
12. Add diagnostics export for selected job, logs, schedule, owner, and last error.
13. Add inline log tail expansion for failed jobs.
14. Add "affected pages" or "affected systems" tags to jobs where known.
15. Add a freshness warning when the job list source is stale.
16. Add keyboard support for table navigation.
17. Add saved views for "daily checks" and "needs Tyler."
18. Add a route smoke assertion for a failed or empty state fixture.
19. Normalize job status colors with Dashboard severity colors.
20. Add a "what changed since last run" summary when job metadata changes.

## /tasks - Tasks

Source focus: `src/routes/tasks.tsx`, `src/screens/tasks/tasks-screen.tsx`.

1. Make "Daily queue" the default mental model and keep secondary analytics below it.
2. Add a "blocked by me" lane that mirrors Dashboard wording.
3. Add one-tap defer, delegate, and done actions optimized for mobile.
4. Add stronger empty states for no tasks, no urgent tasks, and source unavailable.
5. Add grouping by source: chat, meetings, phone capture, jobs, and manual.
6. Add keyboard shortcuts for create, complete, defer, and focus next.
7. Split `tasks-screen.tsx` into task query, filters, board/list, dialogs, and analytics.
8. Move local task display selectors into pure functions with tests.
9. Add drag-and-drop only where it improves repeated use; keep mobile actions tap-first.
10. Add a "today's promise" pinned task that syncs to Dashboard and Phone.
11. Add owner workload drill-down from the visible workload card.
12. Add due-date risk badges that match Jobs and IT Ops severity language.
13. Add batch triage mode for inbox-zero style cleanup.
14. Add search and command palette integration for creating tasks from anywhere.
15. Add diagnostic export for current filters, loaded tasks, and source freshness.
16. Add route smoke coverage for task creation dialog open state.
17. Add persisted view preferences through typed storage.
18. Add mobile safe-area padding for bottom actions.
19. Reduce first-viewport card count; prioritize tasks over analytics.
20. Add integration tests for Phone capture to Tasks handoff.

## /75-tracker - 75 Hard/Soft

Source focus: `src/routes/75-tracker.tsx`.

1. Keep the page lightweight, but add a stronger "remaining today" primary action.
2. Add a quick toggle mode that avoids scrolling on mobile.
3. Add streak risk messaging when a required habit is close to missed.
4. Add recovery notes for soft-mode misses so the page is not only binary.
5. Add a daily check-in notification hook for Phone Cockpit.
6. Add a weekly trend legend that does not require color alone.
7. Add typed persistence for checked state, history, and custom template.
8. Add unit tests for date rollover and localStorage migration.
9. Add export to Tasks for any unfinished habit.
10. Add a "reset today" confirmation to avoid accidental data loss.
11. Add accessible labels for each habit checkbox and heatmap cell.
12. Add a mobile compact summary: complete count, next habit, streak risk.
13. Add a custom habit template manager instead of a single text field.
14. Add per-habit notes for the user to record context.
15. Add a dashboard widget integration using the same data source.
16. Add a "travel day" or "modified day" setting for realistic daily usage.
17. Add route smoke coverage for hard/soft mode switching.
18. Add a small progress ring, but keep it secondary to the next action.
19. Add cross-device persistence if this becomes daily-critical.
20. Split helper functions out of the route once the page grows further.

## /conductor - Conductor

Source focus: `src/routes/conductor.tsx`, `src/screens/gateway/conductor.tsx`, `src/screens/gateway/hooks/use-conductor-gateway.ts`.

1. Add a real H1 or visually hidden page title for Conductor.
2. Make "Launch a mission" visually dominant and keep advanced controls collapsed.
3. Add a mission-readiness checklist before spawn: goal, cwd, model, tools, approvals.
4. Add stronger distinction between portable prompt generation and live orchestrator spawn.
5. Add recovery for saved mission draft and active mission at the top of the page.
6. Split the 3,600-line screen and 1,700-line hook into mission form, stream, history, approvals, and artifacts.
7. Move localStorage mission persistence into a typed store with versioning.
8. Add tests for active mission restore, pause, steer, and stream failure.
9. Add clear provenance for spawned files, commands, and agent outputs.
10. Add a compact mobile launch flow with one textarea, model picker, and launch button.
11. Add approval-state chips that match the rest of the workspace severity system.
12. Add a "copy portable plan" confirmation showing what will be included.
13. Add route-level diagnostics for mission id, session key, stream state, and last error.
14. Add backpressure handling UI when stream output is delayed.
15. Add a mission template search that shares patterns with Skills and MCP search.
16. Add keyboard shortcuts for launch, stop, steer, and copy.
17. Add a visible "cwd locked" indicator when mission scope is constrained.
18. Add a post-mission summary that can create Tasks and update Dashboard.
19. Add visual smoke coverage for an active mission fixture.
20. Reduce nested cards in the first viewport to improve operator scan speed.

## /operations - Operations

Source focus: `src/routes/operations.tsx`, `src/screens/agents/operations-screen.tsx`.

1. Clarify whether Operations manages agents, profiles, jobs, or all three in the first viewport.
2. Add a visible health summary for each active agent.
3. Add one primary action: create agent, resume agent, or inspect failing agent based on state.
4. Replace route-level reload fallback with shared route recovery UI.
5. Add filters for active, idle, failed, and needs Tyler.
6. Add compact mobile cards with status, owner, and next action only.
7. Move agent metadata localStorage into typed persistence.
8. Split operation screen components into roster, detail, chat, jobs, and settings.
9. Add tests for profile-backed agent creation and delete safeguards.
10. Add a clear path from Operations to Profiles when profile config is the blocker.
11. Add output previews that link to Jobs or Chat where the work originated.
12. Add "last useful output" and "last heartbeat" to each agent card.
13. Add a diagnostic export for selected agent and associated jobs.
14. Add inline empty states for no agents and missing default profile.
15. Add keyboard navigation across agent roster and detail panes.
16. Add stronger visual distinction between human-owned and autonomous operations.
17. Add action audit trail for changes to agent settings.
18. Add route smoke coverage for opening the new agent modal.
19. Normalize status colors with Swarm and Conductor.
20. Keep the page operational and dense, but reduce decorative borders around repeated rows.

## /ops-intelligence - Ops Intelligence

Source focus: `src/routes/ops-intelligence.tsx`, `src/screens/ops-intelligence/ops-intelligence-screen.tsx`.

1. Promote the top three operational risks above the long report sections.
2. Add timestamps and source names to every insight block.
3. Make "Changes Since Last Update" collapsible once reviewed.
4. Add links from each recommendation to the page or job that can fix it.
5. Add a confidence label: observed, inferred, stale, or needs live verification.
6. Add a mobile "at a glance" mode with risks, blockers, and next action only.
7. Split report rendering, data loading, filters, and action generation modules.
8. Add tests for stale source handling and empty report rendering.
9. Add an export format that can become a weekly operations note.
10. Add diffing between current and previous ops intelligence snapshots.
11. Add severity colors consistent with Dashboard and Jobs.
12. Add a "mark reviewed" flow that logs review time and hides repeated findings.
13. Add a route diagnostic bundle for report source, generated time, and failed sections.
14. Add skeleton sections so loading does not look like missing content.
15. Add search across recommendations and source evidence.
16. Add a compact table of "owner / system / risk / action".
17. Add an action queue handoff into Tasks.
18. Add visual smoke coverage for stale and healthy data fixtures.
19. Avoid long prose blocks when a metric/table would be easier to scan.
20. Add a "what changed today" chip to the shell/sidebar.

## /swarm - Swarm

Source focus: `src/routes/swarm.tsx`, `src/routes/swarm2.tsx`, `src/screens/swarm2/swarm2-screen.tsx`.

1. Add a clearer distinction between swarm overview, worker controls, and live queue.
2. Add a real-time health strip that stays visible while scrolling.
3. Replace route-level reload fallback with shared recovery UI.
4. Add "needs Tyler" as a first-class swarm state.
5. Add a mobile compact queue that shows only blocked, running, and next worker.
6. Split `swarm2-screen.tsx` into overview, workers, queue, artifacts, memory, and reports modules.
7. Add tests for recommended worker selection and surface distinction.
8. Add a per-worker diagnostic bundle with tools, cwd, task, and last error.
9. Add visual status consistency with Operations and Conductor.
10. Add a safe stop/restart confirmation for active workers.
11. Add a route smoke assertion for queue and worker panel visibility.
12. Add event-log virtualization for long swarm sessions.
13. Add a "promote to task" action from swarm output.
14. Add a "resume last swarm" button when runtime state exists.
15. Add search across artifacts and worker messages.
16. Add a low-noise default view that hides advanced wiring until needed.
17. Add keyboard shortcuts for focus worker, stop, restart, and open artifact.
18. Add latency and heartbeat indicators per worker.
19. Add stronger empty state when no swarm runtime is configured.
20. Reduce first-viewport visual competition between cards and node/wire graphics.

## /memory - Memory

Source focus: `src/routes/memory.tsx`, `src/screens/memory/memory-browser-screen.tsx`.

1. Add a real H1 or visually hidden title for Memory.
2. Make search the dominant first action.
3. Add source filters: Codex memory, Hermes memory, rollout summaries, skills, and workspace docs.
4. Add result provenance and last-updated metadata to every memory hit.
5. Add a "use in current task" action that copies or injects selected memory context.
6. Add stale-memory warnings when a note may drift.
7. Split browser screen into search, tree, preview, metadata, and actions.
8. Add tests for search empty state, read failure, and stale metadata display.
9. Add keyboard navigation for result list and preview.
10. Add mobile search-first layout with filters in a bottom sheet.
11. Add a diagnostic export for search query, selected source, and API status.
12. Add highlighting of matched text snippets.
13. Add a "recently used by Codex" section.
14. Add safe edit boundaries if writing memory notes becomes supported.
15. Add visual distinction between durable memory and temporary transcript data.
16. Add route smoke coverage for a search result fixture.
17. Add pagination or virtualization for large memory folders.
18. Add cross-linking to Skills when memory references skill behavior.
19. Add a "verify live" reminder for drift-prone facts.
20. Keep the page utilitarian; avoid card-heavy decoration around search results.

## /skills - Skills

Source focus: `src/routes/skills.tsx`, `src/screens/skills/skills-screen.tsx`.

1. Make installed, available, and recently used skills visually distinct.
2. Add a first-viewport "recommended for current task" section.
3. Add search result snippets that show why a skill matched.
4. Add clear install/update/remove risk labels.
5. Add route links from Skills to MCP when a skill requires a tool/server.
6. Split `skills-screen.tsx` into installed list, marketplace search, usage, and mutation hooks.
7. Add tests for install, toggle, uninstall, and hub search failure states.
8. Add optimistic mutation states with rollback on failure.
9. Add mobile filter chips for installed, update available, and disabled.
10. Add a "last used" sort mode.
11. Add a diagnostics export for skill path, source, enabled state, and last error.
12. Add safer confirmation copy for uninstalling local skills.
13. Add a skill detail drawer with instructions, files, and related memories.
14. Add warning when a skill is duplicated across multiple roots.
15. Add visual smoke coverage for marketplace install confirmation.
16. Add keyboard navigation and command palette integration.
17. Normalize empty/error states with MCP and Profiles.
18. Add a "pin favorite skills" section for daily Tyler workflows.
19. Add a lint check for skill metadata health if local skills are edited here.
20. Reduce repeated card outlines in large result lists.

## /mcp - MCP Servers

Source focus: `src/routes/mcp.tsx`, `src/screens/mcp/mcp-screen.tsx`.

1. Put unhealthy servers and missing auth at the top of the page.
2. Add a capability matrix by server: tools, resources, prompts, auth, and risk.
3. Add a one-click test flow that shows request, response status, and redacted error.
4. Add clearer separation between installed servers, hub sources, presets, and logs.
5. Add mobile cards with health, primary action, and last error only.
6. Split server cards, dialogs, sources, presets, and OAuth hooks more explicitly.
7. Add tests for OAuth, placeholder detection, source manager, and preset application paths.
8. Add a diagnostic export for selected server configuration with secrets redacted.
9. Add route links from MCP to Skills where a skill depends on a server.
10. Add warnings for placeholder values before a user tries to start a server.
11. Add a "recently failed" filter.
12. Add source provenance for marketplace/hub server definitions.
13. Add safe restart confirmation for running servers.
14. Add inline log snippets for failed servers.
15. Add keyboard navigation through server cards.
16. Add visual smoke coverage for logs drawer open state.
17. Normalize status colors with Settings provider health.
18. Add "last successful tool call" metadata where available.
19. Add a guided setup for common servers.
20. Keep the screen dense, but reduce modal depth for simple edits.

## /profiles - Profiles

Source focus: `src/routes/profiles.tsx`, `src/screens/profiles/profiles-screen.tsx`.

1. Clarify whether profiles affect chat, agents, tools, or all workspace behavior in the first viewport.
2. Add an active-profile banner with quick switch.
3. Add a profile diff view before saving edits.
4. Add "used by" references: Chat, Operations, Conductor, and Jobs.
5. Add duplicate-profile detection based on config similarity.
6. Split `profiles-screen.tsx` into list, editor, validation, and API hooks.
7. Add tests for create, rename, update, activate, and delete failure states.
8. Add mobile profile cards with active state and top three capabilities.
9. Add import/export for profiles with secret redaction.
10. Add validation badges for model, provider, tools, and routing.
11. Add a safe delete flow that blocks deleting active/default profiles.
12. Add last-used and last-edited metadata.
13. Add route links to Settings provider configuration when validation fails.
14. Add command palette support for switching profiles.
15. Add visual smoke coverage for profile editor open state.
16. Add optimistic activate behavior with rollback if the API fails.
17. Add a "make a copy" action for experimentation.
18. Add a profile health summary that mirrors Settings health.
19. Add keyboard navigation between list and editor.
20. Reduce form density by grouping advanced settings behind sections.

## /meetings - Meetings

Source focus: `src/routes/meetings.tsx`, `src/screens/meetings/meetings-screen.tsx`.

1. Make "Today and next" the clear top priority on desktop and mobile.
2. Add a meeting-prep CTA when a meeting is within a configurable window.
3. Add "needs follow-up" extraction into Tasks.
4. Add source freshness and calendar sync status near the title.
5. Add attendee and owner chips that are scannable without opening detail.
6. Split the 2,100-line screen into today, records, detail, actions, and trend modules.
7. Add tests for meeting detail load, action failure, and follow-up creation.
8. Add mobile agenda mode with only next meeting, prep, and open follow-ups.
9. Add "copy meeting brief" with redaction controls.
10. Add search by attendee, title, and action item.
11. Add filters for today, this week, missing notes, and needs follow-up.
12. Add skeletons for calendar loading.
13. Add route diagnostics for sync source, last refresh, and failed actions.
14. Add visual smoke coverage for meeting detail selected state.
15. Add keyboard shortcuts for next meeting and create follow-up.
16. Add a clear empty state for no meetings today.
17. Add trend interpretation for the two-week load chart.
18. Add "join" or location handling if present in source data.
19. Normalize meeting severity with Dashboard daily-loop language.
20. Reduce repeated card borders in recent meeting records.

## /presence - Presence

Source focus: `src/routes/presence.tsx`, `src/screens/presence/presence-hub-screen.tsx`.

1. Put current Tyler availability and last sync status at the top.
2. Add a clear distinction between Teams status, manual override, and inferred workspace status.
3. Add source freshness beside each presence source.
4. Add one primary sync action when data is stale.
5. Add a compact mobile glance card with status, next event, and sync.
6. Split presence screen into status summary, sync diagnostics, manual actions, and history.
7. Add tests for sync failure, stale status, and manual override.
8. Add route diagnostics for Teams auth, last sync, and source errors.
9. Add status history sparklines only if they answer a workflow question.
10. Add "do not disturb until" quick presets.
11. Add integration with Phone Cockpit so daily glance uses the same presence status.
12. Add accessible status colors with text labels.
13. Add visual smoke coverage for stale sync state.
14. Add keyboard shortcuts for sync and set focus state.
15. Add clear error copy when Graph or Teams auth is unavailable.
16. Add "copy status" for sharing availability.
17. Add filtering for people/systems if presence expands.
18. Add optimistic UI for manual sync actions.
19. Add persistent user preference for default presence mode.
20. Keep diagnostics available but secondary to current availability.

## /it-ops - IT Ops / ConnectWise

Source focus: `src/routes/it-ops.tsx`, `src/screens/it-ops/it-ops-screen.tsx`.

1. Make SLA risk and approval blockers the first row.
2. Add direct links from ticket cards to the exact ConnectWise object when available.
3. Add status labels for native ConnectWise approvals versus workspace-derived insights.
4. Add a "needs Tyler approval" filter.
5. Add source freshness and last sync near the page title.
6. Split IT Ops screen into briefing, tickets, approvals, recurring issues, and actions.
7. Add tests for stale data, no tickets, and approval risk rendering.
8. Add mobile glance mode: urgent tickets, approvals, next action.
9. Add a diagnostic export for ticket source, sync status, and failed sections.
10. Add "copy client update" and "copy internal brief" actions with clear templates.
11. Add recurring-issue grouping that links related tickets.
12. Add severity colors aligned with Dashboard and Jobs.
13. Add visual smoke coverage for ticket detail expanded state.
14. Add empty states that distinguish no tickets from failed ConnectWise sync.
15. Add keyboard navigation for ticket list.
16. Add owner and due-date chips that are aligned for scanning.
17. Add a clear native-PSA boundary note in diagnostics, not as visible page clutter.
18. Add a "last touched" marker for tickets recently updated by Tyler.
19. Add Tasks handoff for follow-ups that are not native PSA actions.
20. Reduce prose in the briefing when a table or queue would be faster to scan.

## /barry - Barry

Source focus: `src/routes/barry.tsx`, `src/screens/ops/barry-screen.tsx`.

1. Clarify Barry's current role in the first viewport: meetings, assistant, or operations contact.
2. Add the next Barry-related action as the primary CTA.
3. Add a meeting summary card only when there is meeting data.
4. Add source freshness near the title.
5. Add a compact mobile card for next meeting, last note, and follow-up.
6. Split Barry screen into summary, meetings, actions, and data hooks.
7. Add tests for load failure, empty meetings, and action failure.
8. Add route diagnostics for Barry data source and last API error.
9. Add "copy Barry brief" action.
10. Add Tasks handoff for Barry follow-ups.
11. Add filters for upcoming, recent, and needs follow-up.
12. Add skeletons for meeting/action loading.
13. Add visual smoke coverage for a non-empty meeting state.
14. Add consistent severity/freshness chips with Meetings.
15. Add command palette action to open Barry.
16. Add keyboard support for selecting a meeting.
17. Add clearer empty state when Barry has no current work.
18. Add a cross-link to Meetings when the content is primarily calendar-driven.
19. Add a compact "last interaction" timestamp.
20. Reduce generic cards until the page has enough Barry-specific data to justify them.

## /settings - Settings

Source focus: `src/routes/settings/index.tsx`, `src/screens/settings/providers-screen.tsx`.

1. Move the update toast away from the settings search and tab chips.
2. Improve contrast on the gray health cards in dark mode; they look detached from the rest of the theme.
3. Make "Provider missing" the primary recovery path when it is the highest-risk setting.
4. Add a settings search result count and matched-section highlights.
5. Add "unsaved / autosaved / failed to save" state near the active section.
6. Split the 3,400-line settings route into sections, health, validation, persistence, and export modules.
7. Add tests for each validation state, export bundle, reset section, and setup wizard.
8. Add route links from health chips directly to the problematic controls.
9. Add mobile grouping that shows only Core, AI, Voice, Look, and Alerts by default.
10. Add a "copy safe diagnostics" button beside export profile.
11. Add profile import validation before writing settings.
12. Add a provider setup wizard that can verify credentials without exposing secrets.
13. Add stronger visual distinction between workspace settings and chat-only settings.
14. Add command palette actions for common settings pages.
15. Add keyboard navigation for section tabs.
16. Add a sticky section nav on desktop when scrolling deep settings.
17. Add an accessibility pass for chip groups and section tabs.
18. Add settings schema versioning and migration reporting.
19. Add visual smoke coverage for setup wizard open state.
20. Reduce repeated rounded panels and use fewer, stronger section boundaries.
