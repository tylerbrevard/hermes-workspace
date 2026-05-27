import { useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import type { LifeOsSnapshot } from '@/server/life-os-snapshot'
import { apiPath } from '@/lib/base-path'

type TabKey = 'state' | 'pai' | 'workspace' | 'logs'

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'state', label: 'STATE' },
  { key: 'pai', label: 'PAI' },
  { key: 'workspace', label: 'WORKSPACE' },
  { key: 'logs', label: 'LOGS' },
]

function tone(value: number) {
  if (value >= 80) return 'text-[#89e58f]'
  if (value >= 60) return 'text-[#e9c36f]'
  return 'text-[#ff7b93]'
}

function statusClass(status: string) {
  if (status === 'healthy') return 'text-[#8ef0a3]'
  if (status === 'warn') return 'text-[#e9c36f]'
  if (status === 'down') return 'text-[#ff7b93]'
  return 'text-[#86a7ff]'
}

function Bar({ value }: { value: number }) {
  const cells = 30
  const filled = Math.round((Math.max(0, Math.min(100, value)) / 100) * cells)
  return (
    <span aria-label={`${value}%`} className="inline-flex align-middle">
      {Array.from({ length: cells }).map((_, index) => (
        <span
          key={index}
          className={index < filled ? 'text-[#89e58f]' : 'text-[#364052]'}
        >
          {index < filled ? '●' : '○'}
        </span>
      ))}
    </span>
  )
}

function Sparkline({ values }: { values: Array<number> }) {
  const blocks = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']
  return (
    <span>
      {values.map((value, index) => {
        const block =
          blocks[Math.max(0, Math.min(blocks.length - 1, Math.round(value)))]
        return (
          <span
            key={index}
            className={index % 3 === 0 ? 'text-[#8bb7ff]' : 'text-[#f0cd77]'}
          >
            {block}
          </span>
        )
      })}
    </span>
  )
}

function Section({ children }: { children: React.ReactNode }) {
  return <div className="border-t border-[#566076]/70 py-3">{children}</div>
}

function LoadingScreen() {
  return (
    <div className="min-h-full bg-[#10141d] p-4 font-mono text-[#d8d4c7] md:p-6">
      <div className="mx-auto max-w-6xl rounded border border-[#566076]/70 bg-[#242a36] p-5 shadow-2xl">
        PAI | LOADING LIFE OS SNAPSHOT...
      </div>
    </div>
  )
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="min-h-full bg-[#10141d] p-4 font-mono text-[#d8d4c7] md:p-6">
      <div className="mx-auto max-w-6xl rounded border border-[#ff7b93]/70 bg-[#242a36] p-5 shadow-2xl">
        LIFE OS SNAPSHOT ERROR: {message}
      </div>
    </div>
  )
}

export function LifeOsScreen() {
  const [activeTab, setActiveTab] = useState<TabKey>('state')
  const [snapshot, setSnapshot] = useState<LifeOsSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const response = await fetch(apiPath('/api/life-os'), {
          cache: 'no-store',
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const next = (await response.json()) as LifeOsSnapshot
        if (!cancelled) setSnapshot(next)
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : String(err))
      }
    }
    void load()
    const timer = window.setInterval(() => void load(), 30_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  const averageState = useMemo(() => {
    if (!snapshot) return 0
    const values = Object.values(snapshot.state)
    return Math.round(
      values.reduce((sum, value) => sum + value, 0) / values.length,
    )
  }, [snapshot])

  if (error && !snapshot) return <ErrorScreen message={error} />
  if (!snapshot) return <LoadingScreen />

  return (
    <div className="min-h-full bg-[#10141d] p-3 font-mono text-[13px] leading-6 text-[#d8d4c7] md:p-6 md:text-[15px]">
      <div className="mx-auto max-w-6xl rounded border border-[#566076]/70 bg-[#242a36] p-4 shadow-2xl md:p-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[#8bb7ff]">
          <span>PAI</span>
          <span>|</span>
          <span>{snapshot.host.location}</span>
          <span>{snapshot.host.time}</span>
          <span>|</span>
          <span>LIFE OS TERMINAL</span>
          <span className="text-[#9ba3b5]">HERMES WORKSPACE</span>
        </div>

        <Section>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span>
              STATE:{' '}
              <span className={tone(averageState)}>
                HEALTH {snapshot.state.health}%
              </span>
            </span>
            <span>
              CREATIVE{' '}
              <span className={tone(snapshot.state.creative)}>
                {snapshot.state.creative}%
              </span>
            </span>
            <span>
              FREEDOM{' '}
              <span className={tone(snapshot.state.freedom)}>
                {snapshot.state.freedom}%
              </span>
            </span>
            <span>
              RELATIONS{' '}
              <span className={tone(snapshot.state.relations)}>
                {snapshot.state.relations}%
              </span>
            </span>
            <span>
              FIN{' '}
              <span className={tone(snapshot.state.finance)}>
                {snapshot.state.finance}%
              </span>
            </span>
          </div>
        </Section>

        <Section>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span>
              HERMES:{' '}
              <span className="text-[#8bb7ff]">{snapshot.versions.hermes}</span>
            </span>
            <span>
              PAI:{' '}
              <span className="text-[#8ef0a3]">{snapshot.versions.pai}</span>
            </span>
            <span>
              ALG:{' '}
              <span className="text-[#8bb7ff]">
                {snapshot.versions.algorithm}
              </span>
            </span>
            <span>
              CODEX:{' '}
              <span className="text-[#8bb7ff]">{snapshot.versions.codex}</span>
            </span>
          </div>
        </Section>

        <Section>
          <div>
            CONTEXT: <Bar value={snapshot.context.percent} />{' '}
            <span className={tone(snapshot.context.percent)}>
              {snapshot.context.percent}%
            </span>
          </div>
          <div className="mt-2 text-[#b9b4ff]">
            FILES({snapshot.context.files.length}):{' '}
            {snapshot.context.files.join(', ') || 'none found'}
          </div>
        </Section>

        <div className="border-t border-[#566076]/70 py-2">
          <div className="flex flex-wrap gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={[
                  'rounded border px-3 py-1 text-left transition-colors',
                  activeTab === tab.key
                    ? 'border-[#65d7cf] bg-[#65d7cf]/10 text-[#65d7cf]'
                    : 'border-[#566076]/70 text-[#9ba3b5] hover:border-[#8bb7ff] hover:text-[#8bb7ff]',
                ].join(' ')}
              >
                {activeTab === tab.key ? '▶ ' : '  '}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'state' ? (
          <Section>
            <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
              <div>
                <div className="text-[#8ef0a3]">LEARNING: SIMP</div>
                <div>
                  60m:{' '}
                  <span className="text-[#f0cd77]">
                    {snapshot.learning.recent[0]}
                  </span>
                </div>
                <div>
                  1d:{' '}
                  <span className="text-[#ff9da8]">
                    {snapshot.learning.recent[1]}
                  </span>
                </div>
                <div>
                  1mo:{' '}
                  <span className="text-[#f0cd77]">
                    {snapshot.learning.recent[2]}
                  </span>
                </div>
                <div className="mt-1 text-2xl tracking-[0]">
                  <Sparkline values={snapshot.learning.recent} />
                </div>
              </div>
              <div>
                <div>
                  SIGNALS:{' '}
                  <span className="text-[#8bb7ff]">
                    {snapshot.learning.signals}
                  </span>
                </div>
                <div>
                  HOST: {snapshot.host.name} / uptime {snapshot.host.uptime} /
                  load {snapshot.host.load}
                </div>
                <div className="text-[#9ba3b5]">{snapshot.learning.note}</div>
              </div>
            </div>
          </Section>
        ) : null}

        {activeTab === 'pai' ? (
          <Section>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div>
                  USER:{' '}
                  <span className="text-[#8ef0a3]">
                    {snapshot.pai.userFiles}
                  </span>{' '}
                  markdown files
                </div>
                <div>
                  MEMORY:{' '}
                  <span className="text-[#8ef0a3]">
                    {snapshot.pai.memoryFiles}
                  </span>{' '}
                  files
                </div>
                <div>
                  TOOLS:{' '}
                  <span className="text-[#8ef0a3]">{snapshot.pai.tools}</span>
                </div>
                <div>
                  PACKS:{' '}
                  <span className="text-[#8ef0a3]">{snapshot.pai.packs}</span>
                </div>
                <div>
                  WORKFLOWS:{' '}
                  <span className="text-[#8ef0a3]">
                    {snapshot.pai.workflows}
                  </span>
                </div>
                <div>
                  HOOKS:{' '}
                  <span className="text-[#8ef0a3]">{snapshot.pai.hooks}</span>
                </div>
                <div className="mt-2 text-[#8bb7ff]">
                  PAI TOOL: GetCounts.ts
                </div>
                <div>
                  SKILLS:{' '}
                  <span className="text-[#8ef0a3]">
                    {snapshot.pai.toolCounts.skills}
                  </span>{' '}
                  / WORKFLOWS:{' '}
                  <span className="text-[#8ef0a3]">
                    {snapshot.pai.toolCounts.workflows}
                  </span>
                </div>
                <div>
                  ACTIVE HOOKS:{' '}
                  <span className="text-[#8ef0a3]">
                    {snapshot.pai.toolCounts.hooks}
                  </span>{' '}
                  / FILES:{' '}
                  <span className="text-[#8ef0a3]">
                    {snapshot.pai.toolCounts.files}
                  </span>
                </div>
              </div>
              <div>
                <div>
                  PULSE:{' '}
                  <span className={statusClass(snapshot.pai.pulse.status)}>
                    {snapshot.pai.pulse.status}
                  </span>{' '}
                  {snapshot.pai.pulse.pid
                    ? `pid ${snapshot.pai.pulse.pid}`
                    : ''}
                </div>
                <div>
                  DOCS: {snapshot.pai.terminalDocs.join(', ') || 'none'}
                </div>
                <div className="mt-2 text-[#8bb7ff]">
                  PAI TOOL: HealthSnapshot.ts
                </div>
                <div>
                  HEALTH INBOX:{' '}
                  <span
                    className={
                      snapshot.pai.healthSnapshot.pending > 0
                        ? 'text-[#e9c36f]'
                        : 'text-[#8ef0a3]'
                    }
                  >
                    {snapshot.pai.healthSnapshot.pending}
                  </span>{' '}
                  pending / {snapshot.pai.healthSnapshot.count} snapshots
                </div>
                <div>
                  LATEST HEALTH:{' '}
                  <span className="text-[#9ba3b5]">
                    {snapshot.pai.healthSnapshot.latest || 'none'}
                  </span>
                </div>
                <div className="mt-2 text-[#8bb7ff]">
                  PAI TOOL: CostTracker.ts
                </div>
                <div>
                  API BYPASS SITES:{' '}
                  <span
                    className={
                      snapshot.pai.cost.bypass
                        ? 'text-[#ff7b93]'
                        : 'text-[#8ef0a3]'
                    }
                  >
                    {snapshot.pai.cost.bypass ?? 'unknown'}
                  </span>{' '}
                  / LEGIT:{' '}
                  <span className="text-[#8ef0a3]">
                    {snapshot.pai.cost.legit ?? 'unknown'}
                  </span>
                </div>
                <div>
                  COST ALERTS:{' '}
                  <span
                    className={
                      snapshot.pai.cost.alerts.length
                        ? 'text-[#ff7b93]'
                        : 'text-[#8ef0a3]'
                    }
                  >
                    {snapshot.pai.cost.alerts.length}
                  </span>
                </div>
                <div className="mt-2 text-[#9ba3b5]">
                  {snapshot.pai.telosSummary}
                </div>
              </div>
            </div>
          </Section>
        ) : null}

        {activeTab === 'workspace' ? (
          <Section>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                {snapshot.services.map((service) => (
                  <div key={service.label}>
                    <span className={statusClass(service.status)}>
                      {service.status.toUpperCase()}
                    </span>{' '}
                    {service.label}{' '}
                    <span className="text-[#9ba3b5]">{service.detail}</span>
                  </div>
                ))}
              </div>
              <div>
                <div>
                  CHAT:{' '}
                  <Link
                    to="/chat/$sessionKey"
                    params={{ sessionKey: 'main' }}
                    className="text-[#8bb7ff] underline decoration-dotted"
                  >
                    {snapshot.workspace.chatRoute}
                  </Link>
                </div>
                <div>
                  TERMINAL:{' '}
                  <Link
                    to="/terminal"
                    className="text-[#8bb7ff] underline decoration-dotted"
                  >
                    {snapshot.workspace.terminalRoute}
                  </Link>
                </div>
                <div>
                  VOICE:{' '}
                  <span className="text-[#9ba3b5]">
                    {snapshot.workspace.voice}
                  </span>
                </div>
                {snapshot.workspace.tailscale.map((line) => (
                  <div key={line} className="text-[#9ba3b5]">
                    {line}
                  </div>
                ))}
              </div>
            </div>
          </Section>
        ) : null}

        {activeTab === 'logs' ? (
          <Section>
            <div className="grid gap-4 md:grid-cols-2">
              {snapshot.logs.map((log) => (
                <div key={log.label} className="min-w-0">
                  <div>
                    <span className={statusClass(log.state)}>
                      {log.state.toUpperCase()}
                    </span>{' '}
                    {log.label}
                  </div>
                  <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-[#111722] p-2 text-[12px] leading-5 text-[#9ba3b5]">
                    {log.lines.join('\n')}
                  </pre>
                </div>
              ))}
            </div>
          </Section>
        ) : null}

        <Section>
          <div className="text-[#b9b4ff]">
            "For God alone, O my soul, wait in silence, for my hope is from
            him." - Psalm 62:5
          </div>
          <div className="text-[#ff7b93]">
            ▶▶ canonical surface: Hermes Workspace / Life OS; duplicate Codex
            PWA retired after verification
          </div>
        </Section>
      </div>
    </div>
  )
}
