# Hermes Workspace Cleanup Pass - 2026-05-27

## Scope

- Reviewed current visible navigation surfaces after the prior 520-item cleanup ledger was completed.
- Focused this pass on duplicated settings entry points, menu taxonomy, stale provider copy, and icon-led settings controls.

## Completed

- Consolidated provider settings into the main Settings page.
- Redirected `/settings/providers` to `/settings?section=claude` so old links do not become dead ends.
- Removed the chat-only Settings modal and chat settings hook.
- Removed the chat sidebar provider dialog entry point.
- Routed command palette `/model` and `/skin` directly to the canonical Settings page.
- Updated stale provider copy from `Settings -> Providers` to `Settings -> Model`.
- Changed settings labels from `Model & Provider`, `Smart Routing`, `Appearance`, and `Notifications` to `Model`, `Routing`, `Look`, and `Alerts`.
- Added icons to settings sidebar and mobile settings pills.
- Reduced the Settings control center from a wordy explainer into a compact health/action strip.
- Renamed workspace menu groups to `Main`, `Daily`, `Ops`, `Knowledge`, `System`, and `Settings`.
- Fixed mobile Main menu order to `dashboard`, `phone`, `chat`, `lily`, `tasks`.
- Renamed Conductor page controls from Settings to mission Defaults and made the action icon-led.
- Renamed Operations page controls from Settings to Defaults, Agent Profile, and Orchestrator editor where they are page-local controls.
- Renamed Swarm orchestrator and worker card controls from Settings to editor/profile labels.
- Compressed Dashboard control copy into compact guardrail chips.
- Compressed Phone Cockpit view controls with shorter labels and a sliders icon.
- Renamed Knowledge Browser configuration from Settings to Source and switched it to a sliders control.
- Trimmed Skills and MCP helper copy; replaced repeated Details labels with an information icon where appropriate.
- Made Settings section and row descriptions visually quiet while preserving accessible descriptions/tooltips.
- Tightened Jobs action labels and empty states; bulk controls now read as compact action chips.
- Converted Tasks card actions to icon buttons with accessible labels, shortened task metadata chips, and reduced daily queue/control prose.
- Compressed Files sidebar and review-root copy so the file browser reads like a tool instead of a feature checklist.
- Removed large rendered feature-inventory chip blocks from Barry and Presence.
- Shortened Meetings and IT Ops filters, actions, and empty-state recovery copy.
- Compressed Profiles first-viewport copy, profile-card health chips, bundle action, and empty state.
- Tightened Ops Intelligence export actions, report copy, and executive-summary labels.
- Shortened Workspace Health, 75 Tracker, and personal health tracker status/action copy.
- Renamed HermesWorld page-local `Settings` to `World` so game options do not compete with canonical app Settings.
- Shortened LILY voice setup copy and canonical Settings links.
- Shortened Terminal command/copy controls, recovery chips, and mobile command labels.
- Shortened Chat empty-state gateway copy and workflow-panel actions.
- Shortened Swarm compose, mission, worker, report, and no-worker states.
- Replaced remaining Skill command-palette action copy with an icon-led copy action.
- Shortened Dashboard operator Settings CTAs and gateway drift/restart tip copy.
- Fixed rendered route errors on Dashboard, Chat, Conductor, and Files caused by missing helper imports after page/component splitting.
- Hardened route and visual smoke scripts so route error boundaries fail even if they contain the expected page name.
- Shortened Conductor readiness cards, guardrail/evidence copy, and route smoke marker.
- Shortened Operations dependency cards and Swarm2 empty worker chat copy.
- Compact Jobs retry, SLA, dependency, paid-call, and no-op labels so cards scan as status rows instead of report prose.
- Stripped imported backlog metadata tails from visible Tasks card titles and descriptions while keeping the underlying task data intact.
- Shortened Ops Intelligence change, audit, and production-readiness summaries.
- Made Tasks UX tests local-date-safe so due-date assertions do not drift across timezones.
- Compressed Skills Browser header chips and card actions; Docs, Pin, Remove, Copy, and LILY now read as icon-led controls.
- Compressed MCP first-viewport source/help/fallback/setup/matrix copy and shortened MCP server-card stale/risk/cache labels.
- Tightened Dashboard stale warning, action queue, Control card actions, hidden-widget button, recent-events label, and next-card stale-evidence copy.

## Verification

- `pnpm vitest run src/routes/settings/-index.test.ts src/screens/profiles/profiles-screen.test.ts src/components/command-palette.test.tsx src/components/workspace-shell.test.ts`
- `pnpm lint`
- `pnpm build`
- `pnpm smoke:routes`
- `pnpm smoke:routes:mobile`
- Focused route helper tests for Dashboard, Phone Cockpit, Operations, Conductor, gateway workflow, shell navigation, command palette, settings, and profiles.
- Focused page tests for Jobs, Tasks, Files, Meetings, Presence, IT Ops, and Barry.
- Focused page tests for Profiles, Ops Intelligence, Workspace Health, 75 Tracker, and Playground settings.
- Focused page tests for Terminal, Chat workflow/message rendering, and Swarm2 kanban/control-plane behavior.
- Targeted slop phrase scan for duplicated Settings, command-palette, Terminal, Chat, Swarm, Phone, LILY, and profile copy patterns.
- Targeted ESLint for Terminal, Chat workflow/empty states, Swarm compose/control-plane, Dashboard operator tips, Swarm reports, and Skills grid/screen files.
- Full `pnpm lint`, `pnpm build`, `pnpm smoke:routes`, and `pnpm smoke:routes:mobile` after the fifth pass.
- Desktop visual smoke: `pnpm smoke:visual` captured 25 screenshots with no route errors.
- Mobile visual smoke: `pnpm smoke:visual:mobile` captured 26 screenshots with no route errors or horizontal overflow.
- Focused tests after rendered-page crash fixes: `pnpm vitest run src/screens/gateway/conductor.test.ts src/screens/swarm2/swarm2-screen.test.ts src/screens/files/files-screen.test.ts`.
- Focused dense-page tests: `pnpm vitest run src/screens/jobs/jobs-screen-utils.test.ts src/screens/tasks/tasks-ux.test.ts src/screens/ops-intelligence/ops-intelligence-screen.test.ts`.
- Targeted ESLint for Jobs, Tasks, Ops Intelligence, Conductor, Operations, Files, smoke scripts, and Swarm2 touched files.
- Full final gate: `pnpm build && pnpm smoke:routes && pnpm smoke:visual`.
- Full mobile/code gate: `pnpm smoke:routes:mobile && pnpm smoke:visual:mobile && pnpm lint`.
- Final stale-copy scan for removed visible labels found only the intentional job incident-report/export string plus smoke guards and this cleanup document.
- Focused Skills/MCP verification: `pnpm exec eslint src/screens/skills/skills-screen.tsx src/screens/skills/skills-grid.tsx src/screens/skills/skills-workflow.ts src/screens/mcp/mcp-screen.tsx src/screens/mcp/components/mcp-server-card.tsx && pnpm vitest run src/screens/skills/skills-screen.test.ts src/screens/mcp/mcp-screen.test.ts src/screens/mcp/-marketplace-placeholder-detection.test.tsx src/screens/mcp/-marketplace-install-confirmation.test.tsx`.
- Eighth-pass route-facing gate: `pnpm build && pnpm smoke:routes && pnpm smoke:visual && pnpm smoke:routes:mobile && pnpm smoke:visual:mobile`.
- Eighth-pass full lint: `pnpm lint`.
- Focused Dashboard verification: `pnpm exec eslint src/screens/dashboard/dashboard-screen.tsx src/screens/dashboard/dashboard-sections.tsx src/screens/dashboard/components/dashboard-command-strip.tsx && pnpm vitest run src/screens/dashboard/dashboard-screen.test.ts src/screens/dashboard/lib/weekly-utilization-report.test.ts src/screens/dashboard/lib/insights.test.ts src/screens/dashboard/lib/use-dashboard-layout.test.ts`.
- Ninth-pass Dashboard route gate: `pnpm build && pnpm smoke:routes && pnpm smoke:visual`.
- Ninth-pass mobile gate: `pnpm smoke:routes:mobile && pnpm smoke:visual:mobile`.
- Focused Daily tracker verification: `pnpm exec eslint src/routes/-personal-health-trackers.tsx src/routes/75-tracker.tsx && pnpm vitest run src/routes/-personal-health-trackers.test.ts src/routes/-75-tracker.test.ts src/components/workspace-shell.test.ts`.
- Tenth-pass route-facing gate: `pnpm build && pnpm smoke:routes && pnpm smoke:visual && pnpm smoke:routes:mobile && pnpm smoke:visual:mobile`.
- Tenth-pass full lint: `pnpm lint`.
- Focused Playground verification: `pnpm exec eslint src/screens/playground/hermes-world-embed.tsx && pnpm vitest run src/screens/playground/components/wave-chat-panels.test.tsx`.
- Eleventh-pass route-facing gate: `pnpm build && pnpm smoke:routes && pnpm smoke:visual && pnpm smoke:routes:mobile && pnpm smoke:visual:mobile`.
- Eleventh-pass responsive follow-up: `pnpm build && pnpm smoke:visual:mobile && pnpm lint`.
- Focused Files verification: `pnpm exec eslint src/screens/files/files-screen.tsx src/screens/files/lib/file-workflow.ts src/screens/files/files-screen.test.ts && pnpm vitest run src/screens/files/files-screen.test.ts src/screens/files/file-ui.test.ts`.
- Twelfth-pass route-facing gate: `pnpm build && pnpm smoke:routes && pnpm smoke:visual && pnpm smoke:routes:mobile`; mobile visual initially exposed stale runtime assets, then passed after `pnpm runtime:sync`.
- Twelfth-pass final checks: `pnpm smoke:visual:mobile` and `pnpm lint`.

## Remaining Cleanup Targets

- Continue page-by-page text compression on remaining large screens, especially Chat, Terminal, Swarm, Playground world panels, Lily edge states, and tracker detail panels.
- Replace duplicate page-local settings/config modals inside operational cards with route-level settings or compact inline controls where possible.
- Reduce card density on first viewports by moving secondary explanations into tooltips, detail drawers, or diagnostics.
- Keep mobile daily surfaces biased toward glanceable next actions instead of full desktop parity.
- Maintain browser-backed visual smoke as a required guard for route-facing cleanup.

## Second Pass Notes

- Conductor and Operations no longer expose extra visible `Settings` surfaces for page-local controls; they now use `Defaults`, `Agent Profile`, or edit labels.
- Dashboard and Phone Cockpit control surfaces are less prose-heavy, but additional card-density work remains on first viewport widgets.
- Current verification after the second pass: `pnpm lint`, `pnpm build`, `pnpm smoke:routes`, and `pnpm smoke:routes:mobile` pass.

## Third Pass Notes

- Jobs, Tasks, and Files now use shorter action labels, less instructional empty-state copy, and fewer full-sentence status chips.
- Barry and Presence had the most obvious remaining slop: long lists of planned/implemented feature chips rendered in the first viewport. Those were reduced to operational status chips.
- Meetings and IT Ops now use compact filters/actions (`Sync`, `Extract`, `Review all`, `Details`, `Copy id`) and shorter no-data recovery copy.

## Fourth Pass Notes

- Profiles no longer repeats full profile-storage and duplicate-detection prose in the header/cards; the copy is now compact status chips and icon-led bundle export.
- Ops Intelligence now uses compact export labels (`JSON`, `Markdown`, `Tasks`) and shorter report/print copy.
- Workspace Health, 75 Tracker, Wegovy, Zyn, Food Log, and LILY were trimmed to shorter status/action labels.
- HermesWorld's local options panel is now labeled `World`, not `Settings`, preserving canonical app Settings as the only global settings area.

## Fifth Pass Notes

- Terminal now favors short action labels (`cwd`, `Last cmd`, `Error`, `Restart`, `Files`) and compact diagnostics instead of sentence-length helper chips.
- Chat empty and workflow states now read as operational controls: `New`, `Resume`, `Profile`, `Commands`, `Follow-up`, and `Export`.
- Swarm and Swarm2 now use compact compose/report/no-worker labels, reducing first-viewport explanatory prose.
- The targeted visible-string scan no longer finds the previously identified duplicate/wordy phrases.
- Mobile route smoke was updated from the removed Chat phrase to the current `Mobile ready` marker.

## Sixth Pass Notes

- Browser-backed visual smoke is now part of the proof set. The screenshots exposed route errors that text smoke had missed because shared sidebar labels matched route markers.
- Dashboard now imports the shared number formatter used by dashboard sections; Chat imports the shared message normalizer; Conductor imports session-status/time helpers; Files imports `Fragment` and file entry counters.
- Route smoke and visual smoke now fail on `ROUTE ERROR`, preventing false positives from error-boundary headings like `Failed to load Files`.
- Conductor first viewport now uses compact readiness details (`Add goal`, `No CWD lock`, `Auto fallback`, `Workers ready`, `Dry-run ready`) and shorter guardrail/evidence summaries.
- Operations dependency cards now use `Dependencies`, `Jobs/scripts`, `assignment`, and `Tools` instead of sentence-length dependency-map prose.
- Swarm2 worker chat empty states now read `No messages yet.` instead of repeating worker names and instructions in every card.

## Seventh Pass Notes

- Jobs now uses compact metadata (`Retry x/y`, `15-30m`, `ops -> obsidian`, `Silent`, `Paid call`) instead of sentence-style report labels in visible cards.
- Tasks cards now hide imported backlog bookkeeping such as source, section, assignment, session, and link tails from visible titles/descriptions.
- Ops Intelligence summary cards now read as short operational cues rather than explanatory paragraphs.
- Visual and route smoke now both fail on route error boundaries, and the final desktop/mobile screenshot sets passed after the cleanup.

## Eighth Pass Notes

- Skills Browser no longer renders the full data-state/provenance/action/security/compatibility telemetry wall in the header; it now uses compact source/state/safety/tool-fit chips.
- Skill cards now use icon-led `Docs`, `Pin`, remove-risk, copy-command, and `LILY` controls, with longer intent preserved in accessible labels and details.
- MCP now uses compact helper/fallback/setup/matrix copy (`Help`, `Fallback`, `Retest`, `Discover`, `Matrix`) and shorter visible server-card labels (`Risk`, `Cache`, `Stale check`).
- Refreshed desktop and mobile visual smoke screenshots show Skills and MCP rendering without route errors after the cleanup.

## Ninth Pass Notes

- Dashboard stale-source warning now reads `Gateway stale`, `Last report ... Refresh before acting.`, and `Terminal` instead of paragraph-style warning/action copy.
- Dashboard command strip now uses `Action queue` and `Hidden n` instead of longer section/button labels.
- Dashboard Control actions now render as icon-led `Source`, `Pin`, `Ack`, and `Changes`, with full intent retained in titles and accessible labels.
- Dashboard secondary card copy now uses `Recent events` and `Refresh stale evidence first.`

## Tenth Pass Notes

- Daily tracker headers/details are more compact: 75 Hard/Soft, Wegovy, Zyn, and Food Log now use shorter descriptions and metric helper text.
- 75 Hard/Soft no longer repeats recovery-plan prose in the first viewport; it now uses concise `Done`, `Next`, and `left` guidance.
- Zyn delay controls now read `Delay 10m`, `Avoided`, and `Delay instead of logging.`
- Food Log now uses `Food`, `confidence`, `Add`, and `Favorite`; the photo file input is constrained so it no longer spills across the adjacent column.

## Eleventh Pass Notes

- Playground/HermesWorld no longer exposes a debug-heavy top strip. Runtime chips now use compact labels (`Loaded`, `WS`, `Assets ready`, `100%`, `WebGL`) and removed always-visible failed-asset/input/asset-budget noise.
- The bottom world controls now use short labels (`Links`, `Agora`, `Forge`, `Controls`, `LILY`, `Motion`, `Photosafe`, `Safe`, `Full`) while preserving the hosted world actions.
- Launch checklist prose was reduced to operational chips on desktop and hidden on mobile.
- Mobile HermesWorld now keeps only essential status chips and uses `Rotate for full view. Full for touch.` instead of the previous long orientation guidance.
- Route smoke expected text for `/playground` now matches the rendered compact `FULL` control.

## Twelfth Pass Notes

- Files no longer spends first-viewport space explaining server-backed file loading in a paragraph; it now shows `Server · /api/files live workspace`.
- The Files filter count now reads `visible/total`, and `Pinned roots` is reduced to `Pins`.
- Files health copy now uses compact diagnostics (`Huge`, `Stale`, `Tests`, `Runtime`) and `Diff first.` with root chips instead of sentence guidance.
- The Files viewer toolbar now uses compact chips (`Recent`, `Owners`, `Preview`, `Smoke`, `Keys`) while preserving `Copy roots`.
- During verification, mobile visual smoke exposed a stale live runtime asset map. `pnpm runtime:sync` restarted the workspace runtime; live `/workspace/assets/main-Cv47WTT5.js` and `/workspace/assets/styles-B0GgX35-.css` then returned HTTP 200 and the rerun passed.

## Thirteenth Pass Notes

- Chat workflow controls no longer render sentence-length status chips in the first viewport. The panel now shows compact labels for label/model/transport/cost/save state (`Daily`, `gpt-5.5`, `SSE`, `Guard`, `Saved`).
- Chat actions now use short labels (`Cmds`, `Job`, `LILY`, `Page`, `Follow`) while retaining the existing prompts, titles, and routes behind the controls.
- Chat telemetry and risk rows now use compact operational cues (`U/T/D/A`, `Ready`, `Recovery`, `B 0`, `W 0`, `Clear`, `Tasks 0`, `Mobile`) instead of full-sentence labels like `Ready for the next turn` and `Blocked: no`.
- Verification: focused Chat eslint/tests passed; `pnpm lint` now passes after fixing Apple Health import-order/type-import errors surfaced by the full lint gate.
- Direct mobile proof: `/workspace/chat/main` rendered the compact Chat labels in `.runtime/chat-main-mobile-direct-debug.png`. The full mobile visual sweep is still flaky under the live runtime because routes intermittently hit stale assets, route-error boundaries, or Chrome target creation timeouts.

## Fourteenth Pass Notes

- Terminal quick commands now use compact labels (`Tests`, `Mobile`, `Restart`) while keeping the same command strings behind the buttons.
- Terminal environment/failure chips now read as short operational tags (`pnpm`, `launchd`, `Build`, `Test`, `Runtime`) instead of longer explanatory labels.
- Terminal history/search copy was reduced to `Cmds`, `Reconnect`, `Search history`, `Parse errors/URLs.`, `8KB copy cap.`, and `Redacted copy. Workspace cwd.`
- Verification: focused Terminal eslint/tests passed; `pnpm build`, `pnpm runtime:sync`, direct `/workspace/terminal` screenshot proof, and full `pnpm lint` passed after the cleanup.

## Fifteenth Pass Notes

- Desktop and mobile navigation now use the same top-level order: `Main`, `Knowledge`, `Ops`, `Daily`, `System`, `Settings`.
- Moving `Knowledge` above `Daily` keeps Files, Memory, Skills, MCP, and Profiles reachable before the longer tracker list pushes sections down.
- The mobile drawer grouping test was updated to lock the new order.
- Verification: focused sidebar eslint/tests passed; `pnpm build`, `pnpm runtime:sync`, direct desktop/mobile sidebar screenshots, and full `pnpm lint` passed after the navigation cleanup.

## Sixteenth Pass Notes

- Settings no longer shows a duplicate all-section pill row on desktop when the search box is empty; the left Settings nav remains the canonical section selector.
- The Settings control center no longer repeats `Mobile Groups` and `Route Links` blocks in the first viewport.
- Model fallback copy was compressed from a paragraph-style explainer to `Fallback`, `Optional backup when primary fails.`, `Show`, and `Save`.
- Verification: focused Settings eslint/tests passed; `pnpm build`, `pnpm runtime:sync`, direct `/workspace/settings?section=claude` screenshot/text proof, and full `pnpm lint` passed after the cleanup.

## Seventeenth Pass Notes

- Ops Intelligence now uses compact first-viewport copy: `Probes, routes, reports.`, `Sync`, `MD`, `Risk:`, `Suppress`, `Conf`, `Fix`, and `Ack 24h`.
- Summary cards were shortened from `Dependencies OK`, `Scripts Mapped`, and `Production Checks` to `Deps OK`, `Scripts`, and `Checks`.
- Lower production/incident controls now use the same compact language (`Family`, `Conf`, `Blast`, `Suppress`, `Fix`, `Ack`) so older verbose labels do not reappear further down the page.
- Verification: focused Ops Intelligence eslint/tests passed; `pnpm build`, `pnpm runtime:sync`, direct `/workspace/ops-intelligence` screenshot/text proof, and full `pnpm lint` passed after the cleanup.

## Eighteenth Pass Notes

- Meetings header copy now reads `Calendar health, prep, review.` instead of a sentence describing the whole native view.
- Meeting actions and status chips now use compact labels (`Review`, `Copy`, `Redact`, `Review:`, `Role:`, `Selected:`, `/meetings`) while preserving the same sync/extract/review/export behavior.
- Prep and commitment copy was shortened (`Prep open. Check carry-forward.`, `carry item`, `prior`, `No carry-forward items.`), and summary cards now use `Next 5 days` and `Review state`.
- Verification: focused Meetings eslint/tests passed; `pnpm build`, `pnpm runtime:sync`, direct `/workspace/meetings` screenshot/text proof, and full `pnpm lint` passed after the cleanup.

## Nineteenth Pass Notes

- MCP header copy now reads `Tools, auth, risk.` and the first-viewport controls use compact labels (`Add`, `Refreshed`, `Health ok`, `Stale`, `Config`, `No tool errors`).
- MCP primary actions were shortened to icon-friendly labels (`Logs`, `Diag`, `Retest`, `Enable`, `Tools`) while preserving the same diagnostic and routing behavior.
- Guided setup copy now uses compact labels (`Config`, `Tests`, `Discovery`, `Security`, `Mode`, `API`, `Risk`, `Browse`) instead of sentence-style labels.
- Verification: focused MCP eslint/tests passed; `pnpm build`, `pnpm runtime:sync`, direct `/workspace/mcp` screenshot/text proof, and full `pnpm lint` passed after the cleanup.

## Twentieth Pass Notes

- Skills Browser header copy now reads `Local skills, hub, safety.` with compact status chips (`Source: local + hub`, `Owner: Skills`, `Refreshed`, `Health ok`, `State`, `Confirm`, `Safety`, `Fit`).
- Skills focus cards and controls now use shorter labels (`Recent`, `Review`, `marketplace`, `disabled/risky`, `Search skill, tag, task`, `All`, `Name`) while preserving the same filters and tabs.
- Skill cards and detail modal now reduce advisory prose (`Security`, `Workspace`, `Advisory scan. Review code before run.`, `used: tracked`, `Compare`, `Routes`, `Latest`, `Copy`, `Source`, `Install`, `Remove`).
- Verification: focused Skills eslint/tests passed; `pnpm build`, `pnpm runtime:sync`, authenticated direct `/workspace/skills` screenshot/text proof, and full `pnpm lint` passed after the cleanup.

## Twenty-First Pass Notes

- LILY voice readiness labels now use compact daily controls (`Voice`, `Realtime`, `Chrome`, `Typed`, `Transport`, `Blocked`) instead of longer readiness phrases.
- LILY setup and action labels were shortened for mobile glance use (`Mic`, `Speaker`, `Realtime`, `Audio`, `Start`, `Stop`, `Spoke`, `Heard`, `Type fallback`).
- The initial assistant seed now says `I am here. Start and speak naturally.` and route smoke now targets the stable `LILY` page identity instead of the old `Start conversation` button copy.
- Verification: focused LILY eslint/tests passed; `pnpm build`, `pnpm runtime:sync`, authenticated mobile `/workspace/lily` screenshot/text proof, and full `pnpm lint` passed after the cleanup.

## Twenty-Second Pass Notes

- Profiles header copy now reads `Roles, models, env.` with compact status chips (`Source ~/.hermes/profiles`, `Refreshed`, `Health ok`, `Active`, `Duplicates`, `Suggested`).
- Profiles active/profile-card controls now use shorter operational labels (`role · model · tools`, `Active`, `Use`, `Sess`, `Info`, `env`) while preserving the same activation, pin, details, rename, copy, and delete actions.
- Profile create/details dialogs now use compact wizard and detail labels (`Name + template`, `Review`, `Name`, `Clone from`, `Fresh config`, `Summary`, `Details + config`, `Prompt`, `Path`, `Ops`, `LILY`, `Create`), and the visible route marker now targets `Roles, models, env.`.
- Verification: focused Profiles eslint/tests passed; `pnpm build`, `pnpm runtime:sync`, authenticated direct `/workspace/profiles` screenshot/text proof, and full `pnpm lint` passed after the cleanup.

## Twenty-Third Pass Notes

- Memory Browser header chips now use compact source/health labels (`Source local`, `Owner Knowledge`, `Indexed`, `Health`, `Recall`, `Mobile recall`, `Ops evidence`, `LILY read/write`, `Diff before write`).
- Memory list and filter controls now read as short labels (`Memory`, `Active`, `Recent`, `Stale`, `All`, `Semantic`, `Filename`, `Results`) instead of explanatory filter names.
- Selected-memory metadata/actions now use compact operational labels (`Prov`, `Scope`, `Fresh`, `Used`, `Stale: verify first`, `Conflicts`, `Recall`, `Use`, `Promote`, `Review`, `Archive`, `Links`, `Routes`), and route smoke now targets `Memory`.
- Verification: focused Memory eslint/tests passed; `pnpm build`, `pnpm runtime:sync`, authenticated direct `/workspace/memory` screenshot/text proof, and full `pnpm lint` passed after the cleanup.

## Twenty-Fourth Pass Notes

- Presence header and glance copy now use compact status labels (`Teams + M5 sync.`, `Status`, `M5`, `Graph`, `Sync`, `Mode`, `Next`, `VISIBLE`, `Display`, `Trust`, `Source`).
- Presence summary and sync panels now use shorter labels (`Devices`, `Fresh`, `Seen <5m`, `Drift`, `Teams`, `M5`, `SYNC`, `Preview`, `MANUAL`) and compact action labels (`Auth`, `Sync`, `Refresh`, `Avail`, `DND`, `BRB`).
- Device controls now use concise per-device copy (`Word`, `Seen`, `Refresh`, `Exp`, `ID`, `Manual`, `Hide`, `Clear`) while preserving the safe/manual override flow.
- Verification: focused Presence eslint/tests passed; `pnpm build`, `pnpm runtime:sync`, authenticated direct `/workspace/presence` screenshot/text proof, and full `pnpm lint` passed after the cleanup.

## Twenty-Fifth Pass Notes

- Barry now uses compact first-viewport labels (`1-on-1 prep, wins, follow-up.`, `Role 1-on-1`, `Last`, `Archived`, `Next`, `Private notes`, `Sync`, `Export`) instead of sentence-style role, freshness, and feature chips.
- Barry meeting actions now use short operational labels (`New`, `Prep`, `Tasks`, `Brief`, `History`, `ID`, `Wins`, `Actions`, `Task handoff`, `Created`) while preserving the existing 1-on-1, brief export, and task-handoff behavior.
- IT Ops now uses compact ConnectWise labels (`Tickets, SLA, standups.`, `Report`, `State`, `Native PSA`, `Approval links first`, `QUEUE`, `Tickets + SLA`, `Ranked risk.`, `BRIEFING`, `BOARDS`, `PRIORITY`) and shorter ticket-detail controls (`ID`, `PSA`, `Client`, `Internal`).
- Verification: focused Barry and IT Ops eslint/tests passed; `pnpm build`, `pnpm runtime:sync`, authenticated direct `/workspace/barry` and `/workspace/it-ops` screenshot/text proof passed after the cleanup.

## Twenty-Sixth Pass Notes

- LILY voice edge states now use compact recovery copy (`Allow mic.`, `Approve mic.`, `Tab audio ready.`, `Chrome loop.`, `Realtime connected.`, `Site settings: Mic Allow, then retry.`) instead of long browser/site-settings instructions.
- LILY status helpers now shorten degraded voice blockers (`Token inactive`, `Keys missing`, `Listen unavailable`, `Realtime + speech missing`) while keeping the same voice readiness decisions.
- Push-to-talk and hands-free failure messages now fit the mobile glance surface (`Realtime unavailable. Use Chrome or type.`, `Mic ready, speech missing. Use Chrome or type.`).
- Verification: focused LILY eslint/tests passed; `pnpm build`, `pnpm runtime:sync`, and authenticated mobile `/workspace/lily` screenshot/text proof passed after the cleanup.

## Twenty-Seventh Pass Notes

- Swarm2 header and help copy now uses compact operator labels (`route · reports · review`, `Updates`, `Checkpoints + reports.`, `Add`) instead of sentence-length planning/routing/reviewer-gate copy.
- The Swarm operator strip now reads as glanceable status (`Operator`, `Workers live here.`, `Map`, `Pick`, `Controls`, `JSON`, `Task`, `Glance`, `Util`) while preserving routing, report, snapshot, and task creation behavior.
- Worker cards now use shorter local controls and panel helpers (`Tracked work.`, `Artifacts, previews, reports.`, `Git changes until artifacts land.`, `Roster only.`, `Details`, `Route`, `Terminal`) so card-local profile controls no longer compete with global Settings.
- Verification: focused Swarm2 eslint/tests passed; `pnpm build`, `pnpm runtime:sync`, and authenticated direct `/workspace/swarm` screenshot/text proof passed after the cleanup.

## Twenty-Eighth Pass Notes

- Terminal state and recovery copy now uses compact status details (`No tab`, `Waiting PTY`, `Stream failed`, `No active stream`) instead of sentence-length connection state labels.
- Terminal toolbar and history copy now reads as short controls (`Safe paste.`, `Output`, `Parse`, `8KB cap`, `Search cmds`, `Redacted. Workspace cwd.`) while preserving safe paste, copy, parser, and command history behavior.
- Terminal debug panel now uses compact labels (`Debug`, `Active terminal diagnosis`, `No suggestions.`, `Debug analyzes recent output.`), and the route error fallback now gives a shorter PTY recovery instruction.
- Verification: focused Terminal eslint/tests passed; `pnpm build`, `pnpm runtime:sync`, and authenticated direct `/workspace/terminal` screenshot/text proof passed after the cleanup.

## Twenty-Ninth Pass Notes

- Chat workflow status now uses compact labels (`SSE connected`, `HTTP fallback`, `Saving`, `Saved`, `Thinking + tools`, `Ready`, `Retry / refresh`, `Recovery armed`, `Cost confirm paid runs`) instead of sentence-length workflow prose.
- Chat connection banners now use shorter recovery copy (`Auth required`, `Token rejected.`, `Settings -> Hermes token.`, `Gateway down`, `Check launchd/health, then retry.`, `Connecting...`).
- Chat tool/detail UI now uses compact labels (`Tools`, `No detail`, `Preview unavailable.`, `No tools`) while preserving inline tool grouping, raw/preview toggles, and markdown attachment behavior.
- Verification: focused Chat eslint/tests passed; `pnpm build`, `pnpm runtime:sync`, and authenticated mobile `/workspace/chat/main` screenshot/text proof passed after the cleanup.

## Thirtieth Pass Notes

- Playground/HermesWorld embed copy now uses compact route labels (`World`, `Assets ready/load`, `Local`, `30+`, `workspace`, `iframe`) instead of older remote/embed prose.
- Playground modals and panels now use shorter labels (`Keys`, `Journal`, `Lesson`, `Payoff`, `Quest`, `Ready`, `Accept`, `Hint`, `Docs + Memory`, `Forge gate`, `Generating...`, `Nearby`, `World menu`, `Reset`, `Replay`) so the game UI leans on icons and terse operational copy.
- The local Playground title, map, founder vault, admin, and inventory surfaces now remove sentence-length helper text (`Builder`, `Avatar`, `Enter`, `Worlds`, `Multiplayer`, `Path`, `Map`, `World`, `Reward cache`, `Condition`, `Drag or double-click.`).
- Verification: focused Playground eslint/tests passed; `pnpm build`, `pnpm runtime:sync`, authenticated direct `/workspace/playground` screenshot/text proof passed with Controls open, and full `pnpm lint` passed after the cleanup.

## Thirty-First Pass Notes

- System Health now uses compact diagnostic labels (`Health`, `Sync`, `Pass`, `Warn`, `Fail`) instead of repeating `Workspace Health`, `Refresh`, `Passed`, `Warnings`, and `Critical`.
- Health probes now read as short operational checks (`Auth`, `Gateway ping`, `Capabilities`, `Dashboard`, `Phone`, `LILY`, `IT Ops`, `Swarm`, `Tasks`) with concise evidence (`Auth ok.`, `JSON ok.`, `Capabilities ok.`, `15 tasks.`).
- Verification: focused Health eslint/test passed; `pnpm build`, `pnpm runtime:sync`, authenticated direct `/workspace/health` screenshot/text proof passed, and full `pnpm lint` passed after the cleanup.

## Thirty-Second Pass Notes

- Apple Health now presents the daily operating view as `Health`, `Review`, `Signals`, `Actions`, `Days`, and `Workouts`, with compact freshness/status text and shorter load/error copy.
- Apple Health insight generation now emits concise evidence and recommendations (`Day`, `RHR`, `7d avg`, `Recovery pressured`, `Sync Health Auto Export before today decisions.`) while preserving the non-medical caveat.
- Mailbox CoS report HTML now uses compact section labels (`Mailbox CoS`, `Actions`, `ROI`, `Decisions`, `People`, `Waiting`, `Tyler blocking`, `Delegate`, `Repair`, `Coverage`), and coverage is collapsed to a tracked-check count instead of a long prose list.
- Verification: focused Apple Health eslint/tests passed; mailbox digest `py_compile` passed; `pnpm build` and `pnpm runtime:sync` passed; the workspace service was manually restarted with `launchctl kickstart` after a stale server-side Apple Health payload; authenticated direct `/workspace/apple-health` and `/workspace/chief-of-staff-mailbox` screenshot/text proof passed; full `pnpm lint` passed after the cleanup.

## Thirty-Third Pass Notes

- Wegovy now uses compact tracker copy (`Wegovy`, `Dose`, `Shots`, `Weight`, `Log`, `History`, `Plan`, `Dose path`, `Site`, `Effects`) instead of repeated shot/planning phrasing.
- Zyn now uses short daily controls and reduction labels (`Zyn`, `Cap`, `Log`, `Timeline`, `Plan`, `7d avg`, `Streak`, `Avoided`) with tighter empty-state and delay copy.
- Food Log now reads as a fast capture surface (`Food`, `Capture`, `AI est.`, `Meals`, `Targets`, `Left`, `Cal goal`, `Protein goal`, `Templates`, `Coach`) instead of wordier meal/target sections.
- Verification: focused personal tracker eslint/tests passed; `pnpm build` and `pnpm runtime:sync` passed; authenticated direct `/workspace/wegovy`, `/workspace/zyn-tracker`, and `/workspace/food-log` screenshot/text proof passed with stale-label guards; full `pnpm lint` passed after the cleanup.

## Thirty-Fourth Pass Notes

- 75 Hard/Soft now uses compact daily-loop sections (`Left today`, `Heatmap`, `Trend`, `Modified`, `Custom`, `Edits`) and shorter streak guidance (`Risk: >1 item after 8 PM.`, `Watch: do smallest now.`).
- PTO Tracker report output now uses concise report labels (`PTO`, `Gaps`, `Events`, `Team wt`, `Median wt`, `People`, `Status`, `Presence`, `Alan`, `Level`, `Score`, `Why flagged`) instead of longer scorecard/presence/report phrasing.
- PTO generator labels were patched alongside the current `latest.html` report so refreshes do not reintroduce the old visible copy.
- Verification: focused 75 Tracker eslint/tests passed; PTO generator `py_compile` passed; `pnpm build` and `pnpm runtime:sync` passed; authenticated direct `/workspace/75-tracker` and `/workspace/pto-tracker` screenshot/text proof passed with stale-label guards; full `pnpm lint` passed after the cleanup.

## Thirty-Fifth Pass Notes

- Reserve now uses compact offline/intake labels (`Offline`, `Names`, `Rules`, `Confirm`, `Notes`, `Handle`, `Unavailable`) and shorter reservation helper copy while keeping the existing validation and submit flow.
- Early Access now uses tighter launch-page copy (`Agent RPG`, `Early access`, `Discord`, `GitHub`, `Star repo`, `Trailer`, `World`) instead of long action labels and step explanations.
- VT Capital now uses compact cockpit labels (`Plugin`, `VT Capital`, `Bias file`, `Council`, `Workers`, `Refresh`, `Executor`, `Live`, `Risk`, `Proposed`, `Executed`, `Vault`) and removes remaining Italian/verbose operational labels from the visible cards.
- Verification: focused Reserve/Early Access/VT Capital eslint passed; `pnpm build` and `pnpm runtime:sync` passed; authenticated direct `/workspace/reserve`, `/workspace/early-access`, and `/workspace/vt-capital` screenshot/text proof passed with stale-label guards; full `pnpm lint` passed after the cleanup.
- Reserve confirmation was moved to the flat route file and the Reserve parent now yields to its child outlet for `/workspace/reserve/confirm`, so the confirm page renders independently instead of falling through to the Reserve form.
- Verification addendum: authenticated direct `/workspace/reserve/confirm` screenshot/text proof passed with stale-label guards after the routing fix; full `pnpm lint` passed after the route fix.

## Thirty-Sixth Pass Notes

- Agent registry empty-state setup now routes to the canonical model area with the compact `Model` control instead of another visible `Open Settings` CTA.
- Operations local controls now read as fleet/profile setup (`Fleet Defaults`, `New-agent model`, `Feed rows`, `Needs model`) rather than another settings surface.
- Onboarding model setup now uses a short `Model` action and avoids the wordy `Open Model Settings` CTA.
- Settings Hermes Agent load/error copy now uses compact `config` recovery text instead of sentence-style configuration instructions.
- Verification: focused agent/operations/onboarding/settings eslint passed; `pnpm build` and `pnpm runtime:sync` passed; authenticated direct `/workspace/operations`, Operations defaults modal, `/workspace/profiles`, `/workspace/settings?section=claude`, and `/workspace/settings?section=agent` screenshot/text proof passed with stale-label guards; full `pnpm lint` passed after the operations/settings cleanup.

## Thirty-Seventh Pass Notes

- Onboarding, provider setup, usage, route-error, startup, and Settings copy now use compact `config`, `Model`, and recovery labels instead of tutorial-style configuration prose.
- Jobs now shows compact prompt summaries in cards and keeps long automation prompts in edit/log surfaces, preventing giant cron prompts from dominating the daily Jobs view.
- Jobs and Operations icon-button accessible labels were shortened so controls announce as `Run job`, `Open logs`, `Cron jobs`, and `Run agent` instead of full job/agent prompt strings.
- Operations restart and output review areas now use compact labels (`Preflight`, target names, `Output + Cost`, `Diff in Outputs`) instead of sentence-style safeguards and diff explanations.
- Verification: focused eslint passed for touched onboarding/settings/provider/usage/chat/swarm/jobs/operations/error files; `pnpm build` and `pnpm runtime:sync` passed; authenticated rendered long-control audit passed for `/workspace/jobs` and `/workspace/operations`; authenticated 33-route stale phrase scan passed; full `pnpm lint` passed.

## Thirty-Eighth Pass Notes

- Tasks cards now render compact task names and omit source/tag/session/no-owner noise from board controls while keeping full task details available in the dialog.
- Task mobile/daily queues now share the same compact title formatter, so backlog file paths and generated source suffixes do not leak into the glance view.
- Meetings list and carry-forward cards now keep compact title click targets separate from time/type/attendee metadata, preventing single controls from reading like whole meeting summaries.
- Verification: focused Tasks/Meetings eslint passed; focused Tasks/Meetings Vitest passed; `pnpm build` and `pnpm runtime:sync` passed; authenticated rendered `/workspace/tasks` and `/workspace/meetings` long-control/stale-label audit passed; full `pnpm lint` passed.

## Thirty-Ninth Pass Notes

- Chat session titles now use a shared compact formatter before rendering, so automation prompts and memory-review text no longer become oversized sidebar controls.
- The mobile sessions drawer uses the same compact session display and short ID labels, keeping daily phone navigation glanceable.
- The active Chat header title is compacted separately while rename/edit mode still preserves the full stored title.
- Lily benefits from the shared session title cleanup and now passes the same prompt-leak guard as Chat.
- Verification: focused Chat/Lily eslint passed; focused chat workflow Vitest passed; `pnpm build` and `pnpm runtime:sync` passed; authenticated rendered `/workspace/chat/main` and `/workspace/lily` long-control/prompt-leak audit passed; full `pnpm lint` passed.

## Fortieth Pass Notes

- Ops Intelligence evidence links now show compact proof labels (`desktop smoke`, `mobile smoke`, `Hermes service log`, `runtime proof ...`) instead of raw manifest paths, launchd log tails, or JSON blobs.
- Full evidence remains available through the link title and `/files`, but production-readiness cards no longer turn raw probe output into navigation text.
- Verification: focused Ops Intelligence eslint passed; focused Ops Intelligence Vitest passed; `pnpm build` and `pnpm runtime:sync` passed; authenticated rendered `/workspace/ops-intelligence` long-control/raw-evidence audit passed; full `pnpm lint` passed.

## Forty-First Pass Notes

- Jobs now uses compact ownership lane labels (`Lane Flow`, `Lane Codex`) instead of repeated `Owner:` chips in every job card.
- Tasks runtime metadata now shows owner count (`Owners 0`) instead of the wordy `Owners: none configured` fallback.
- Terminal quick commands now keep the `Tests` control short by routing through the focused test script instead of embedding multiple full test paths.
- Files recent-change buttons now render compact file and parent-path labels with the full path preserved in the title attribute.
- Skills header now uses `Lane Skills` instead of a separate owner-style label, matching the broader cleanup away from duplicate ownership/settings language.
- Verification: focused eslint passed for Jobs, Tasks, Terminal, Files, and Skills; focused Vitest passed for those five areas; `pnpm build` and `pnpm runtime:sync` passed; authenticated rendered audit passed for `/workspace/jobs`, `/workspace/tasks`, `/workspace/terminal`, `/workspace/files`, and `/workspace/skills`; full `pnpm lint` passed.

## Forty-Second Pass Notes

- MCP server cards now use compact lane labels (`Lane Hermes + Codex`) instead of repeated `Owner: Hermes/Codex jobs` text.
- Final broad cleanup audit covered the visible workspace route set: dashboard, phone, chat, operations, jobs, tasks, meetings, terminal, swarm/swarm2, profiles, settings variants, knowledge, memory, files, MCP, skills, IT/Ops intelligence, presence, Life OS, Lily, Barry, Agora, Playground/Hermes World, health, personal trackers, PTO, reserve/confirm, early access, and VT Capital.
- Verification: focused MCP eslint/test passed; `pnpm build` and `pnpm runtime:sync` passed; authenticated broad rendered audit returned zero long-control/stale-label findings across the visible route set; full `pnpm lint` passed after the final MCP cleanup.
