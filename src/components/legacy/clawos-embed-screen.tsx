import { useMemo } from 'react'

type ClawosEmbedScreenProps = {
  path: string
  title: string
  description?: string
}

function resolveClawosBase(): string {
  if (typeof window === 'undefined') return ''
  const localHosts = new Set(['127.0.0.1', 'localhost', '::1'])
  if (window.location.port === '3002' || localHosts.has(window.location.hostname)) {
    return 'http://127.0.0.1:3000'
  }
  return '/workspace/legacy-clawos'
}

function withEmbedParam(path: string): string {
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}embed=1`
}

export function ClawosEmbedScreen({
  path,
  title,
  description = 'Compatibility view backed by ClawOS while the native Workspace replacement is still in progress.',
}: ClawosEmbedScreenProps) {
  const standaloneSrc = useMemo(() => {
    const base = resolveClawosBase()
    return base ? `${base}${path}` : path
  }, [path])
  const src = useMemo(() => withEmbedParam(standaloneSrc), [standaloneSrc])

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--theme-bg)] text-[var(--theme-text)]">
      <div className="border-b border-[color:var(--theme-border)] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-sm font-semibold tracking-[0.08em] uppercase">
              {title}
            </h1>
            <p className="text-xs text-[var(--theme-muted)]">{description}</p>
          </div>
          <a
            href={standaloneSrc}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-[color:var(--theme-border)] px-3 py-1.5 text-xs font-medium text-[var(--theme-text)] hover:bg-[color:var(--theme-card)]"
          >
            Open ClawOS page
          </a>
        </div>
      </div>
      <div className="min-h-0 flex-1 bg-black/5">
        <iframe
          src={src}
          title={title}
          className="h-full w-full border-0"
          loading="eager"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </div>
  )
}
