import { buildChatCockpitTiles } from '../chat-workflow'
import type {
  ChatCommandRailItem,
  ChatWorkflowSummary,
  ResumeLatestContext,
} from '../chat-workflow'

export type ChatWorkflowPanelProps = {
  summary: ChatWorkflowSummary
  commandRail: Array<ChatCommandRailItem>
  resumeLatestContext: ResumeLatestContext
  onNewSession: () => void
  onResumeLatest: () => void
  onChooseProfile: () => void
  onOpenCommandPalette: () => void
  onInsertPrompt: (prompt: string) => void
  onSendToLily: () => void
  onExportConversation: () => void
}

export function ChatWorkflowPanel({
  summary,
  commandRail,
  resumeLatestContext,
  onNewSession,
  onResumeLatest,
  onChooseProfile,
  onOpenCommandPalette,
  onInsertPrompt,
  onSendToLily,
  onExportConversation,
}: ChatWorkflowPanelProps) {
  const taskPrompt =
    'Extract tasks from this chat. Return owner, due date if known, source message, and next action.'
  const notePrompt =
    'Turn this chat into a concise note with decisions, risks, and links to artifacts.'
  const draftPrompt =
    'Draft the next outbound message or follow-up based on this chat. Keep it ready to send.'
  const agentJobPrompt =
    'Create an agent job plan from this chat with objective, constraints, verification, and stop conditions.'
  const lilyPrompt =
    'Prepare this chat for LILY handoff: summarize state, decisions, blockers, and the next spoken prompt.'
  const followUpPrompt =
    'Find anything waiting on others in this chat and schedule the next follow-up with date, channel, and wording.'
  const connectionLabel = summary.fallback.includes('SSE') ? 'SSE' : 'HTTP'
  const saveLabel = summary.lastSave.includes('Saving') ? 'Saving' : 'Saved'
  const readyLabel = summary.loadingCopy.includes('Ready') ? 'Ready' : 'Working'
  const recoveryLabel = summary.errorRecovery.includes('Retry')
    ? 'Retry'
    : 'Recovery'
  const costLabel = summary.costGuard.includes('local') ? 'Local' : 'Guard'
  const blockedCount = summary.risks.blockedByMe ? 1 : 0
  const waitingCount = summary.risks.waitingOnOthers ? 1 : 0
  const riskLabel = summary.risks.riskyMutation ? 'Review' : 'Clear'
  const cockpitTiles = buildChatCockpitTiles(summary)

  return (
    <section
      className="mx-3 mb-2 rounded-md border px-3 py-2 text-xs md:mx-4"
      style={{
        background: 'var(--theme-card)',
        borderColor: 'var(--theme-border)',
        color: 'var(--theme-muted)',
      }}
      aria-label="Chat workflow controls"
    >
      <div className="mb-2 grid gap-2 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
        <div
          className="rounded border px-3 py-2"
          style={{
            background: 'var(--theme-bg)',
            borderColor: 'var(--theme-border)',
          }}
        >
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: 'var(--theme-muted)' }}
          >
            Chat cockpit
          </p>
          <p
            className="mt-1 text-sm font-semibold"
            style={{ color: 'var(--theme-text)' }}
          >
            {summary.label} command lane
          </p>
          <p className="mt-1 text-[11px]">
            Tools, decisions, risk, and handoff prompts stay visible above the
            thread.
          </p>
        </div>
        <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
          {cockpitTiles.map((tile) => (
            <div
              key={tile.id}
              className="rounded border px-2.5 py-2"
              style={{
                background: 'var(--theme-bg)',
                borderColor: 'var(--theme-border)',
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em]">
                  {tile.label}
                </p>
                <span
                  className="rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase"
                  title={tile.tone}
                >
                  {tile.tone}
                </span>
              </div>
              <p
                className="mt-1 text-lg font-semibold"
                style={{ color: 'var(--theme-text)' }}
              >
                {tile.value}
              </p>
              <p className="mt-0.5 line-clamp-2 text-[11px]">{tile.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span
            className="rounded px-2 py-1 font-semibold"
            style={{
              background: 'var(--theme-card2)',
              color: 'var(--theme-text)',
            }}
          >
            {summary.label}
          </span>
          <span title={`${summary.provider} / ${summary.model}`}>
            {summary.model}
          </span>
          <span title={summary.fallback}>{connectionLabel}</span>
          <span title={summary.costGuard}>{costLabel}</span>
          <span>{summary.sessionFreshness}</span>
          <span title={summary.lastSave}>{saveLabel}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className="rounded border px-2 py-1"
            onClick={onNewSession}
          >
            New
          </button>
          <button
            type="button"
            className="rounded border px-2 py-1"
            onClick={onResumeLatest}
            title={resumeLatestContext.detail}
          >
            {resumeLatestContext.available ? 'Resume' : 'Start'}
          </button>
          <button
            type="button"
            className="rounded border px-2 py-1"
            onClick={onChooseProfile}
          >
            Profile
          </button>
          <button
            type="button"
            className="rounded border px-2 py-1"
            onClick={onOpenCommandPalette}
          >
            Cmds
          </button>
        </div>
      </div>

      {commandRail.length > 0 ? (
        <div className="mt-2 rounded border px-2 py-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p
                className="font-semibold"
                style={{ color: 'var(--theme-text)' }}
              >
                Start here
              </p>
              <p className="mt-0.5">Capture, note, reply, or agent intent.</p>
            </div>
            <span>{resumeLatestContext.detail}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {commandRail.map((item) => (
              <button
                key={item.id}
                type="button"
                className="rounded border px-2 py-1"
                onClick={() => onInsertPrompt(item.prompt)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-2 grid gap-2 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-wrap gap-1.5">
          <button
            type="button"
            className="rounded border px-2 py-1"
            onClick={() => onInsertPrompt(taskPrompt)}
          >
            Task
          </button>
          <button
            type="button"
            className="rounded border px-2 py-1"
            onClick={() => onInsertPrompt(notePrompt)}
          >
            Note
          </button>
          <button
            type="button"
            className="rounded border px-2 py-1"
            onClick={() => onInsertPrompt(draftPrompt)}
          >
            Draft
          </button>
          <button
            type="button"
            className="rounded border px-2 py-1"
            onClick={() => onInsertPrompt(agentJobPrompt)}
          >
            Job
          </button>
          <button
            type="button"
            className="rounded border px-2 py-1"
            onClick={() => onInsertPrompt(lilyPrompt)}
          >
            LILY
          </button>
          <button
            type="button"
            className="rounded border px-2 py-1"
            onClick={onSendToLily}
          >
            Page
          </button>
          <button
            type="button"
            className="rounded border px-2 py-1"
            onClick={() => onInsertPrompt(followUpPrompt)}
          >
            Follow
          </button>
          <button
            type="button"
            className="rounded border px-2 py-1"
            onClick={onExportConversation}
          >
            Export
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          <span className="rounded border px-2 py-1">
            U {summary.timeline.userMessages}
          </span>
          <span className="rounded border px-2 py-1">
            T {summary.timeline.toolCalls}
          </span>
          <span className="rounded border px-2 py-1">
            D {summary.timeline.decisions}
          </span>
          <span className="rounded border px-2 py-1">
            A {summary.timeline.artifacts}
          </span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span title={summary.loadingCopy}>{readyLabel}</span>
        <span title={summary.errorRecovery}>{recoveryLabel}</span>
        <span title="Blocked by me">B {blockedCount}</span>
        <span title="Waiting on others">W {waitingCount}</span>
        <span title="Mutation risk">{riskLabel}</span>
        <span>Tasks {summary.risks.taskCandidates}</span>
        <span>/new · /save · Cmd+.</span>
        <span>Mobile</span>
      </div>
    </section>
  )
}
